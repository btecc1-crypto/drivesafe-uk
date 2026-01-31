#!/usr/bin/env python3
"""
DriveSafe UK Backend API Test Suite
Tests all backend endpoints with focus on anti-spam controls
"""

import requests
import json
import time
from datetime import datetime
import sys

# Use the production URL from frontend/.env
BASE_URL = "https://drivesafe-uk.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
    
    def test_health_endpoints(self):
        """Test basic health and root endpoints"""
        print("\n=== Testing Health & Root Endpoints ===")
        
        # Test root endpoint
        try:
            response = self.session.get(f"{BASE_URL}/")
            if response.status_code == 200:
                data = response.json()
                expected = {"message": "DriveSafe UK API", "version": "1.0.0"}
                if data == expected:
                    self.log_test("Root Endpoint", True, "Returns correct API info")
                else:
                    self.log_test("Root Endpoint", False, f"Unexpected response: {data}")
            else:
                self.log_test("Root Endpoint", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Connection error: {str(e)}")
        
        # Test health endpoint
        try:
            response = self.session.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                data = response.json()
                if 'status' in data and data['status'] == 'healthy':
                    self.log_test("Health Endpoint", True, "Returns healthy status")
                else:
                    self.log_test("Health Endpoint", False, f"Unexpected response: {data}")
            else:
                self.log_test("Health Endpoint", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Health Endpoint", False, f"Connection error: {str(e)}")
    
    def test_camera_endpoints(self):
        """Test speed camera endpoints"""
        print("\n=== Testing Speed Camera Endpoints ===")
        
        # Test seed endpoint first
        try:
            response = self.session.post(f"{BASE_URL}/seed")
            if response.status_code == 200:
                data = response.json()
                if 'count' in data and data['count'] == 20:
                    self.log_test("Seed Cameras", True, f"Seeded {data['count']} cameras successfully")
                else:
                    self.log_test("Seed Cameras", False, f"Unexpected seed response: {data}")
            else:
                self.log_test("Seed Cameras", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Seed Cameras", False, f"Error: {str(e)}")
        
        # Test nearby cameras (London coordinates)
        try:
            params = {"lat": 51.5074, "lon": -0.1278, "radius_km": 5}
            response = self.session.get(f"{BASE_URL}/cameras/nearby", params=params)
            if response.status_code == 200:
                cameras = response.json()
                if isinstance(cameras, list) and len(cameras) > 0:
                    # Check if cameras have required fields
                    first_camera = cameras[0]
                    required_fields = ['latitude', 'longitude', 'camera_type', 'distance_meters']
                    if all(field in first_camera for field in required_fields):
                        self.log_test("Nearby Cameras", True, f"Found {len(cameras)} cameras near London")
                    else:
                        self.log_test("Nearby Cameras", False, f"Missing required fields in camera data")
                else:
                    self.log_test("Nearby Cameras", False, "No cameras returned or invalid format")
            else:
                self.log_test("Nearby Cameras", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Nearby Cameras", False, f"Error: {str(e)}")
        
        # Test all cameras endpoint
        try:
            response = self.session.get(f"{BASE_URL}/cameras/all")
            if response.status_code == 200:
                cameras = response.json()
                if isinstance(cameras, list) and len(cameras) >= 20:
                    self.log_test("All Cameras", True, f"Retrieved {len(cameras)} total cameras")
                else:
                    self.log_test("All Cameras", False, f"Expected at least 20 cameras, got {len(cameras) if isinstance(cameras, list) else 'invalid format'}")
            else:
                self.log_test("All Cameras", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("All Cameras", False, f"Error: {str(e)}")
    
    def test_community_reports_basic(self):
        """Test basic community report functionality"""
        print("\n=== Testing Community Reports - Basic Functionality ===")
        
        # Test creating a mobile camera report
        report_data = {
            "latitude": 51.5,
            "longitude": -0.12,
            "report_type": "mobile_camera",
            "user_id": "test_user_001"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/reports", json=report_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'report_id' in data:
                    self.log_test("Create Report", True, f"Created report: {data['message']}")
                    return data['report_id']
                else:
                    self.log_test("Create Report", False, f"Unexpected response: {data}")
            else:
                self.log_test("Create Report", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Create Report", False, f"Error: {str(e)}")
        
        return None
    
    def test_rate_limiting(self):
        """Test anti-spam rate limiting"""
        print("\n=== Testing Anti-Spam Rate Limiting ===")
        
        user_id = "rate_limit_test_user"
        report_data = {
            "latitude": 51.51,
            "longitude": -0.13,
            "report_type": "mobile_camera",
            "user_id": user_id
        }
        
        # First report should succeed
        try:
            response = self.session.post(f"{BASE_URL}/reports", json=report_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_test("Rate Limit - First Report", True, "First report accepted")
                else:
                    self.log_test("Rate Limit - First Report", False, f"First report failed: {data}")
                    return
            else:
                self.log_test("Rate Limit - First Report", False, f"HTTP {response.status_code}")
                return
        except Exception as e:
            self.log_test("Rate Limit - First Report", False, f"Error: {str(e)}")
            return
        
        # Second report immediately should fail (rate limited)
        try:
            response = self.session.post(f"{BASE_URL}/reports", json=report_data)
            if response.status_code == 200:
                data = response.json()
                if not data.get('success') and 'wait' in data.get('message', '').lower():
                    self.log_test("Rate Limit - Second Report", True, f"Rate limit working: {data['message']}")
                else:
                    self.log_test("Rate Limit - Second Report", False, f"Rate limit not working: {data}")
            else:
                self.log_test("Rate Limit - Second Report", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_test("Rate Limit - Second Report", False, f"Error: {str(e)}")
    
    def test_duplicate_merging(self):
        """Test duplicate report merging within 200m"""
        print("\n=== Testing Duplicate Report Merging ===")
        
        # First report
        report1 = {
            "latitude": 51.52,
            "longitude": -0.14,
            "report_type": "police_check",
            "user_id": "merge_test_user_1"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/reports", json=report1)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_test("Duplicate Merge - First Report", True, "First report created")
                    original_report_id = data.get('report_id')
                else:
                    self.log_test("Duplicate Merge - First Report", False, f"Failed: {data}")
                    return
            else:
                self.log_test("Duplicate Merge - First Report", False, f"HTTP {response.status_code}")
                return
        except Exception as e:
            self.log_test("Duplicate Merge - First Report", False, f"Error: {str(e)}")
            return
        
        # Second report within 200m (should merge)
        report2 = {
            "latitude": 51.5202,  # ~150m from first report
            "longitude": -0.1402,
            "report_type": "police_check",
            "user_id": "merge_test_user_2"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/reports", json=report2)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'confirmed' in data.get('message', '').lower():
                    self.log_test("Duplicate Merge - Second Report", True, f"Reports merged: {data['message']}")
                else:
                    self.log_test("Duplicate Merge - Second Report", False, f"Merge not working: {data}")
            else:
                self.log_test("Duplicate Merge - Second Report", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_test("Duplicate Merge - Second Report", False, f"Error: {str(e)}")
    
    def test_nearby_reports(self):
        """Test getting nearby reports"""
        print("\n=== Testing Nearby Reports ===")
        
        try:
            params = {"lat": 51.5, "lon": -0.12, "radius_km": 5}
            response = self.session.get(f"{BASE_URL}/reports/nearby", params=params)
            if response.status_code == 200:
                reports = response.json()
                if isinstance(reports, list):
                    self.log_test("Nearby Reports", True, f"Retrieved {len(reports)} active reports")
                    
                    # Check report structure if any exist
                    if len(reports) > 0:
                        first_report = reports[0]
                        required_fields = ['latitude', 'longitude', 'report_type', 'confirmations', 'expires_in_minutes']
                        if all(field in first_report for field in required_fields):
                            self.log_test("Report Structure", True, "Reports have correct structure")
                        else:
                            self.log_test("Report Structure", False, f"Missing fields in report data")
                else:
                    self.log_test("Nearby Reports", False, "Invalid response format")
            else:
                self.log_test("Nearby Reports", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Nearby Reports", False, f"Error: {str(e)}")
    
    def test_combined_endpoint(self):
        """Test combined cameras and reports endpoint"""
        print("\n=== Testing Combined Endpoint ===")
        
        try:
            params = {"lat": 51.5074, "lon": -0.1278, "radius_km": 5}
            response = self.session.get(f"{BASE_URL}/nearby", params=params)
            if response.status_code == 200:
                data = response.json()
                if 'cameras' in data and 'reports' in data:
                    cameras_count = len(data['cameras']) if isinstance(data['cameras'], list) else 0
                    reports_count = len(data['reports']) if isinstance(data['reports'], list) else 0
                    self.log_test("Combined Endpoint", True, f"Returns {cameras_count} cameras and {reports_count} reports")
                else:
                    self.log_test("Combined Endpoint", False, f"Missing cameras or reports in response: {data}")
            else:
                self.log_test("Combined Endpoint", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Combined Endpoint", False, f"Error: {str(e)}")
    
    def test_ttl_behavior(self):
        """Test report TTL behavior (basic check)"""
        print("\n=== Testing Report TTL Configuration ===")
        
        # Create reports and check their expiration times
        mobile_report = {
            "latitude": 51.53,
            "longitude": -0.15,
            "report_type": "mobile_camera",
            "user_id": "ttl_test_mobile"
        }
        
        police_report = {
            "latitude": 51.54,
            "longitude": -0.16,
            "report_type": "police_check",
            "user_id": "ttl_test_police"
        }
        
        # Test mobile camera TTL
        try:
            response = self.session.post(f"{BASE_URL}/reports", json=mobile_report)
            if response.status_code == 200 and response.json().get('success'):
                self.log_test("Mobile Camera TTL", True, "Mobile camera report created (75min TTL expected)")
            else:
                self.log_test("Mobile Camera TTL", False, f"Failed to create mobile report")
        except Exception as e:
            self.log_test("Mobile Camera TTL", False, f"Error: {str(e)}")
        
        # Test police check TTL
        try:
            response = self.session.post(f"{BASE_URL}/reports", json=police_report)
            if response.status_code == 200 and response.json().get('success'):
                self.log_test("Police Check TTL", True, "Police check report created (52min TTL expected)")
            else:
                self.log_test("Police Check TTL", False, f"Failed to create police report")
        except Exception as e:
            self.log_test("Police Check TTL", False, f"Error: {str(e)}")
    
    def run_all_tests(self):
        """Run comprehensive test suite"""
        print(f"🚀 Starting DriveSafe UK Backend API Tests")
        print(f"📍 Testing against: {BASE_URL}")
        print("=" * 60)
        
        # Run all test categories
        self.test_health_endpoints()
        self.test_camera_endpoints()
        self.test_community_reports_basic()
        self.test_rate_limiting()
        self.test_duplicate_merging()
        self.test_nearby_reports()
        self.test_combined_endpoint()
        self.test_ttl_behavior()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"✅ Passed: {passed}/{total}")
        print(f"❌ Failed: {total - passed}/{total}")
        
        if total - passed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   ❌ {result['test']}: {result['message']}")
        
        print(f"\n🏁 Testing completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)