from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from math import radians, sin, cos, sqrt, atan2

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'drivesafe_uk')]

# Create the main app
app = FastAPI(title="DriveSafe UK API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== Models ==============

class SpeedCamera(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    latitude: float
    longitude: float
    camera_type: str  # 'fixed', 'average_speed_start', 'average_speed_end', 'red_light'
    road_name: Optional[str] = None
    speed_limit: Optional[int] = None  # in mph
    direction: Optional[str] = None  # 'N', 'S', 'E', 'W', 'NE', etc.
    confidence: int = Field(default=100)  # 0-100
    last_verified: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SpeedCameraCreate(BaseModel):
    latitude: float
    longitude: float
    camera_type: str
    road_name: Optional[str] = None
    speed_limit: Optional[int] = None
    direction: Optional[str] = None

class CommunityReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    latitude: float
    longitude: float
    report_type: str  # 'mobile_camera', 'police_check'
    user_id: str  # device ID for rate limiting
    confirmations: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    is_active: bool = True

class CommunityReportCreate(BaseModel):
    latitude: float
    longitude: float
    report_type: str
    user_id: str

class ReportResponse(BaseModel):
    success: bool
    message: str
    report_id: Optional[str] = None

class NearbyDataResponse(BaseModel):
    cameras: List[dict]
    reports: List[dict]

class AppSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mobile_camera_ttl_minutes: int = Field(default=75)  # 60-90 avg
    police_check_ttl_minutes: int = Field(default=52)   # 45-60 avg
    duplicate_radius_meters: int = Field(default=200)
    duplicate_time_window_minutes: int = Field(default=15)
    rate_limit_minutes: int = Field(default=5)

# ============== Helper Functions ==============

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters"""
    R = 6371000  # Earth radius in meters
    
    phi1 = radians(lat1)
    phi2 = radians(lat2)
    delta_phi = radians(lat2 - lat1)
    delta_lambda = radians(lon2 - lon1)
    
    a = sin(delta_phi/2)**2 + cos(phi1) * cos(phi2) * sin(delta_lambda/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c

def get_bounding_box(lat: float, lon: float, radius_km: float):
    """Get approximate bounding box for geo query"""
    # Approximate degrees per km
    lat_delta = radius_km / 111.0
    lon_delta = radius_km / (111.0 * cos(radians(lat)))
    
    return {
        'min_lat': lat - lat_delta,
        'max_lat': lat + lat_delta,
        'min_lon': lon - lon_delta,
        'max_lon': lon + lon_delta
    }

async def get_settings() -> AppSettings:
    """Get app settings from database or return defaults"""
    settings_doc = await db.settings.find_one({})
    if settings_doc:
        return AppSettings(**settings_doc)
    return AppSettings()

# ============== Routes ==============

@api_router.get("/")
async def root():
    return {"message": "DriveSafe UK API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Camera endpoints
@api_router.get("/cameras/nearby")
async def get_nearby_cameras(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius_km: float = Query(default=5.0, description="Search radius in km")
):
    """Get speed cameras within radius of location"""
    bbox = get_bounding_box(lat, lon, radius_km)
    
    cameras = await db.cameras.find({
        'latitude': {'$gte': bbox['min_lat'], '$lte': bbox['max_lat']},
        'longitude': {'$gte': bbox['min_lon'], '$lte': bbox['max_lon']},
        'is_active': True
    }).to_list(1000)
    
    # Filter by actual distance and convert ObjectId
    result = []
    for cam in cameras:
        distance = haversine_distance(lat, lon, cam['latitude'], cam['longitude'])
        if distance <= radius_km * 1000:
            cam['_id'] = str(cam['_id'])
            cam['distance_meters'] = round(distance)
            result.append(cam)
    
    # Sort by distance
    result.sort(key=lambda x: x['distance_meters'])
    return result

@api_router.post("/cameras", response_model=SpeedCamera)
async def create_camera(camera: SpeedCameraCreate):
    """Add a new speed camera (admin)"""
    camera_obj = SpeedCamera(**camera.dict())
    await db.cameras.insert_one(camera_obj.dict())
    return camera_obj

@api_router.get("/cameras/all")
async def get_all_cameras():
    """Get all cameras (admin)"""
    cameras = await db.cameras.find({'is_active': True}).to_list(10000)
    for cam in cameras:
        cam['_id'] = str(cam['_id'])
    return cameras

# Community report endpoints
@api_router.post("/reports", response_model=ReportResponse)
async def create_report(report: CommunityReportCreate):
    """Create a community report with anti-spam controls"""
    settings = await get_settings()
    now = datetime.utcnow()
    
    # Rate limiting: check if user has reported this type recently
    recent_report = await db.reports.find_one({
        'user_id': report.user_id,
        'report_type': report.report_type,
        'created_at': {'$gte': now - timedelta(minutes=settings.rate_limit_minutes)}
    })
    
    if recent_report:
        wait_time = settings.rate_limit_minutes - int((now - recent_report['created_at']).total_seconds() / 60)
        return ReportResponse(
            success=False,
            message=f"Please wait {wait_time} more minutes before reporting another {report.report_type.replace('_', ' ')}"
        )
    
    # Duplicate merging: check for existing nearby report
    existing_reports = await db.reports.find({
        'report_type': report.report_type,
        'is_active': True,
        'expires_at': {'$gt': now},
        'created_at': {'$gte': now - timedelta(minutes=settings.duplicate_time_window_minutes)}
    }).to_list(100)
    
    for existing in existing_reports:
        distance = haversine_distance(
            report.latitude, report.longitude,
            existing['latitude'], existing['longitude']
        )
        if distance <= settings.duplicate_radius_meters:
            # Merge: increase confirmation count
            await db.reports.update_one(
                {'id': existing['id']},
                {'$inc': {'confirmations': 1}}
            )
            return ReportResponse(
                success=True,
                message=f"Confirmed! {existing['confirmations'] + 1} users have reported this.",
                report_id=existing['id']
            )
    
    # Calculate TTL based on report type
    if report.report_type == 'mobile_camera':
        ttl_minutes = settings.mobile_camera_ttl_minutes
    else:  # police_check
        ttl_minutes = settings.police_check_ttl_minutes
    
    # Create new report
    report_obj = CommunityReport(
        **report.dict(),
        expires_at=now + timedelta(minutes=ttl_minutes)
    )
    await db.reports.insert_one(report_obj.dict())
    
    return ReportResponse(
        success=True,
        message="Reported. Thanks!",
        report_id=report_obj.id
    )

@api_router.get("/reports/nearby")
async def get_nearby_reports(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius_km: float = Query(default=5.0, description="Search radius in km")
):
    """Get active community reports within radius"""
    now = datetime.utcnow()
    bbox = get_bounding_box(lat, lon, radius_km)
    
    reports = await db.reports.find({
        'latitude': {'$gte': bbox['min_lat'], '$lte': bbox['max_lat']},
        'longitude': {'$gte': bbox['min_lon'], '$lte': bbox['max_lon']},
        'is_active': True,
        'expires_at': {'$gt': now}
    }).to_list(500)
    
    result = []
    for report in reports:
        distance = haversine_distance(lat, lon, report['latitude'], report['longitude'])
        if distance <= radius_km * 1000:
            report['_id'] = str(report['_id'])
            report['distance_meters'] = round(distance)
            # Calculate remaining time
            remaining = (report['expires_at'] - now).total_seconds() / 60
            report['expires_in_minutes'] = round(remaining)
            result.append(report)
    
    result.sort(key=lambda x: x['distance_meters'])
    return result

@api_router.get("/nearby")
async def get_all_nearby(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius_km: float = Query(default=5.0, description="Search radius in km")
):
    """Get all nearby cameras and reports in one call"""
    cameras = await get_nearby_cameras(lat, lon, radius_km)
    reports = await get_nearby_reports(lat, lon, radius_km)
    
    return {
        "cameras": cameras,
        "reports": reports
    }

# Settings endpoints
@api_router.get("/settings")
async def get_app_settings():
    """Get current app settings"""
    return await get_settings()

@api_router.post("/settings")
async def update_settings(settings: AppSettings):
    """Update app settings (admin)"""
    await db.settings.replace_one({}, settings.dict(), upsert=True)
    return settings

# Seed data endpoint (for initial setup)
@api_router.post("/seed")
async def seed_sample_cameras():
    """Seed database with sample UK speed camera data"""
    sample_cameras = [
        # London area
        {"latitude": 51.5074, "longitude": -0.1278, "camera_type": "fixed", "road_name": "A4 Cromwell Road", "speed_limit": 30},
        {"latitude": 51.5155, "longitude": -0.1419, "camera_type": "fixed", "road_name": "A40 Marylebone Road", "speed_limit": 40},
        {"latitude": 51.4924, "longitude": -0.1917, "camera_type": "red_light", "road_name": "A4 Earl's Court Road", "speed_limit": 30},
        {"latitude": 51.5267, "longitude": -0.0873, "camera_type": "fixed", "road_name": "A10 City Road", "speed_limit": 30},
        {"latitude": 51.4818, "longitude": -0.1252, "camera_type": "average_speed_start", "road_name": "A3 Brixton Road", "speed_limit": 30},
        {"latitude": 51.4695, "longitude": -0.1161, "camera_type": "average_speed_end", "road_name": "A3 Brixton Road", "speed_limit": 30},
        # M25
        {"latitude": 51.6835, "longitude": 0.0342, "camera_type": "average_speed_start", "road_name": "M25 Junction 26-27", "speed_limit": 70},
        {"latitude": 51.7012, "longitude": 0.0824, "camera_type": "average_speed_end", "road_name": "M25 Junction 26-27", "speed_limit": 70},
        # Birmingham area
        {"latitude": 52.4862, "longitude": -1.8904, "camera_type": "fixed", "road_name": "A38 Bristol Road", "speed_limit": 40},
        {"latitude": 52.4774, "longitude": -1.9132, "camera_type": "fixed", "road_name": "A456 Hagley Road", "speed_limit": 40},
        {"latitude": 52.5127, "longitude": -1.8716, "camera_type": "red_light", "road_name": "A34 Birchfield Road", "speed_limit": 30},
        # Manchester area
        {"latitude": 53.4808, "longitude": -2.2426, "camera_type": "fixed", "road_name": "A56 Chester Road", "speed_limit": 30},
        {"latitude": 53.4723, "longitude": -2.2380, "camera_type": "fixed", "road_name": "A5103 Princess Road", "speed_limit": 40},
        {"latitude": 53.4944, "longitude": -2.2235, "camera_type": "average_speed_start", "road_name": "A635 Ashton Old Road", "speed_limit": 40},
        # Leeds area
        {"latitude": 53.7996, "longitude": -1.5491, "camera_type": "fixed", "road_name": "A58 Clay Pit Lane", "speed_limit": 30},
        {"latitude": 53.8067, "longitude": -1.5373, "camera_type": "fixed", "road_name": "A64 York Road", "speed_limit": 40},
        # Glasgow area
        {"latitude": 55.8642, "longitude": -4.2518, "camera_type": "fixed", "road_name": "M8 Kingston Bridge", "speed_limit": 50},
        {"latitude": 55.8554, "longitude": -4.2487, "camera_type": "red_light", "road_name": "A8 Argyle Street", "speed_limit": 30},
        # Edinburgh area
        {"latitude": 55.9533, "longitude": -3.1883, "camera_type": "fixed", "road_name": "A1 London Road", "speed_limit": 30},
        {"latitude": 55.9418, "longitude": -3.2047, "camera_type": "fixed", "road_name": "A7 Dalkeith Road", "speed_limit": 40},
    ]
    
    # Clear existing cameras first
    await db.cameras.delete_many({})
    
    # Insert new cameras
    for cam_data in sample_cameras:
        camera = SpeedCamera(**cam_data)
        await db.cameras.insert_one(camera.dict())
    
    return {"message": f"Seeded {len(sample_cameras)} sample cameras", "count": len(sample_cameras)}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# File download endpoint
from fastapi.responses import FileResponse
import os

@api_router.get("/download/{filename}")
async def download_file(filename: str):
    """Download files from the server"""
    file_path = os.path.join(ROOT_DIR, filename)
    if os.path.exists(file_path) and filename.endswith('.zip'):
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='application/zip'
        )
    raise HTTPException(status_code=404, detail="File not found")
