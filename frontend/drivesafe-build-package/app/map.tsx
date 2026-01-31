import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import axios from 'axios';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

// Conditionally import MapView for native platforms
let MapView: any = null;
let Marker: any = null;
let PROVIDER_DEFAULT: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
}

interface Camera {
  id: string;
  latitude: number;
  longitude: number;
  camera_type: string;
  road_name?: string;
  speed_limit?: number;
  distance_meters: number;
}

interface CommunityReport {
  id: string;
  latitude: number;
  longitude: number;
  report_type: string;
  confirmations: number;
  distance_meters: number;
  expires_in_minutes: number;
}

type FilterType = 'all' | 'fixed' | 'average' | 'red_light' | 'reports';

export default function MapScreen() {
  const router = useRouter();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedItem, setSelectedItem] = useState<Camera | CommunityReport | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    initializeMap();
  }, []);

  const initializeMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      await fetchNearbyData(currentLocation);
      setIsLoading(false);
    } catch (error) {
      console.error('Map init error:', error);
      setIsLoading(false);
    }
  };

  const fetchNearbyData = async (loc: Location.LocationObject) => {
    try {
      const response = await axios.get(`${API_URL}/api/nearby`, {
        params: {
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          radius_km: 10,
        },
      });
      setCameras(response.data.cameras || []);
      setReports(response.data.reports || []);
    } catch (error) {
      console.log('Fetch error:', error);
    }
  };

  const centerOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  };

  const getFilteredCameras = () => {
    switch (filter) {
      case 'fixed':
        return cameras.filter(c => c.camera_type === 'fixed');
      case 'average':
        return cameras.filter(c => c.camera_type.includes('average'));
      case 'red_light':
        return cameras.filter(c => c.camera_type === 'red_light');
      case 'reports':
        return [];
      default:
        return cameras;
    }
  };

  const getFilteredReports = () => {
    if (filter === 'reports' || filter === 'all') {
      return reports;
    }
    return [];
  };

  const getCameraColor = (type: string) => {
    switch (type) {
      case 'fixed': return '#ef4444';
      case 'average_speed_start': return '#f97316';
      case 'average_speed_end': return '#eab308';
      case 'red_light': return '#a855f7';
      default: return '#ef4444';
    }
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Web fallback - show list view
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Camera Map</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.webFallback}>
          <Ionicons name="map" size={64} color="#64748b" />
          <Text style={styles.webFallbackTitle}>Map View</Text>
          <Text style={styles.webFallbackText}>
            Interactive map available on mobile devices.
            Use the Expo Go app to view the full map experience.
          </Text>
        </View>

        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>Nearby Cameras ({cameras.length})</Text>
          {cameras.slice(0, 10).map((camera) => (
            <View key={camera.id} style={styles.listItem}>
              <View style={[styles.listIcon, { backgroundColor: getCameraColor(camera.camera_type) }]}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
              <View style={styles.listInfo}>
                <Text style={styles.listItemTitle}>
                  {camera.camera_type.replace('_', ' ')}
                </Text>
                {camera.road_name && (
                  <Text style={styles.listItemSubtitle}>{camera.road_name}</Text>
                )}
              </View>
              <Text style={styles.listDistance}>{formatDistance(camera.distance_meters)}</Text>
            </View>
          ))}

          <Text style={[styles.listTitle, { marginTop: 20 }]}>Community Reports ({reports.length})</Text>
          {reports.slice(0, 5).map((report) => (
            <View key={report.id} style={styles.listItem}>
              <View style={[styles.listIcon, { backgroundColor: '#f97316' }]}>
                <Ionicons 
                  name={report.report_type === 'mobile_camera' ? 'car' : 'shield'} 
                  size={16} 
                  color="#fff" 
                />
              </View>
              <View style={styles.listInfo}>
                <Text style={styles.listItemTitle}>
                  {report.report_type === 'mobile_camera' ? 'Mobile Camera' : 'Police Check'}
                </Text>
                <Text style={styles.listItemSubtitle}>
                  {report.confirmations} confirmation{report.confirmations > 1 ? 's' : ''} • 
                  Expires in {report.expires_in_minutes}min
                </Text>
              </View>
              <Text style={styles.listDistance}>{formatDistance(report.distance_meters)}</Text>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // Native map view
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Camera Map</Text>
        <TouchableOpacity onPress={centerOnUser} style={styles.backBtn}>
          <Ionicons name="locate" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        {[
          { key: 'all', label: 'All' },
          { key: 'fixed', label: 'Fixed' },
          { key: 'average', label: 'Average' },
          { key: 'red_light', label: 'Red Light' },
          { key: 'reports', label: 'Reports' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.filterChip,
              filter === item.key && styles.filterChipActive,
            ]}
            onPress={() => setFilter(item.key as FilterType)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === item.key && styles.filterChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Map */}
      {location && MapView && (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* Camera Markers */}
          {getFilteredCameras().map((camera) => (
            <Marker
              key={camera.id}
              coordinate={{
                latitude: camera.latitude,
                longitude: camera.longitude,
              }}
              onPress={() => setSelectedItem(camera)}
              pinColor={getCameraColor(camera.camera_type)}
            />
          ))}

          {/* Report Markers */}
          {getFilteredReports().map((report) => (
            <Marker
              key={report.id}
              coordinate={{
                latitude: report.latitude,
                longitude: report.longitude,
              }}
              onPress={() => setSelectedItem(report)}
              pinColor="#f97316"
            />
          ))}
        </MapView>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Fixed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
          <Text style={styles.legendText}>Avg Speed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#a855f7' }]} />
          <Text style={styles.legendText}>Red Light</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.legendText}>Report</Text>
        </View>
      </View>

      {/* Selected Item Details */}
      {selectedItem && (
        <View style={styles.detailCard}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setSelectedItem(null)}
          >
            <Ionicons name="close" size={24} color="#94a3b8" />
          </TouchableOpacity>
          
          {'camera_type' in selectedItem ? (
            <>
              <Text style={styles.detailTitle}>
                {selectedItem.camera_type.replace('_', ' ').toUpperCase()}
              </Text>
              {selectedItem.road_name && (
                <Text style={styles.detailRoad}>{selectedItem.road_name}</Text>
              )}
              {selectedItem.speed_limit && (
                <View style={styles.speedLimitBadge}>
                  <Text style={styles.speedLimitText}>
                    {selectedItem.speed_limit} MPH
                  </Text>
                </View>
              )}
              <Text style={styles.detailDistance}>
                {formatDistance(selectedItem.distance_meters)} away
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.detailTitle}>
                {selectedItem.report_type === 'mobile_camera'
                  ? 'MOBILE CAMERA'
                  : 'POLICE CHECK'}
              </Text>
              <Text style={styles.detailConfirm}>
                Confirmed by {selectedItem.confirmations} user
                {selectedItem.confirmations > 1 ? 's' : ''}
              </Text>
              <Text style={styles.detailExpires}>
                Expires in {selectedItem.expires_in_minutes} minutes
              </Text>
              <Text style={styles.detailDistance}>
                {formatDistance(selectedItem.distance_meters)} away
              </Text>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  map: {
    flex: 1,
  },
  legend: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 12,
    padding: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  detailCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  detailTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  detailRoad: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  speedLimitBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  speedLimitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailDistance: {
    color: '#64748b',
    fontSize: 14,
  },
  detailConfirm: {
    color: '#22c55e',
    fontSize: 14,
    marginBottom: 4,
  },
  detailExpires: {
    color: '#fbbf24',
    fontSize: 14,
    marginBottom: 8,
  },
  // Web fallback styles
  webFallback: {
    alignItems: 'center',
    padding: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  webFallbackTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  webFallbackText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  listTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  listIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listItemTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  listItemSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  listDistance: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
