import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

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

type AlertItem = Camera | CommunityReport;

export default function DrivingMode() {
  const router = useRouter();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [lastAlertedIds, setLastAlertedIds] = useState<Set<string>>(new Set());
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [alertDistance, setAlertDistance] = useState(500); // meters
  const [isReporting, setIsReporting] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const dataFetchInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize user ID and load settings
  useEffect(() => {
    initializeApp();
    return () => {
      cleanup();
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Get or create user ID
      let storedUserId = await AsyncStorage.getItem('userId');
      if (!storedUserId) {
        storedUserId = 'user_' + Math.random().toString(36).substring(2, 15);
        await AsyncStorage.setItem('userId', storedUserId);
      }
      setUserId(storedUserId);

      // Load settings
      const savedVoice = await AsyncStorage.getItem('voiceEnabled');
      const savedDistance = await AsyncStorage.getItem('alertDistance');
      if (savedVoice !== null) setVoiceEnabled(savedVoice === 'true');
      if (savedDistance !== null) setAlertDistance(parseInt(savedDistance));

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'This app needs location access to provide speed camera alerts.',
          [{ text: 'Open Settings', onPress: () => Linking.openSettings() }]
        );
        setIsLoading(false);
        return;
      }

      // Start location tracking
      await startLocationTracking();

      // Seed initial data
      await seedData();

      setIsLoading(false);
    } catch (error) {
      console.error('Init error:', error);
      setIsLoading(false);
    }
  };

  const seedData = async () => {
    try {
      await axios.post(`${API_URL}/api/seed`);
    } catch (error) {
      console.log('Seed already done or error:', error);
    }
  };

  const cleanup = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
    }
    if (dataFetchInterval.current) {
      clearInterval(dataFetchInterval.current);
    }
    Speech.stop();
  };

  const startLocationTracking = async () => {
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 10,
      },
      (newLocation) => {
        setLocation(newLocation);
        // Convert m/s to mph
        const speedMph = (newLocation.coords.speed || 0) * 2.237;
        setSpeed(Math.max(0, Math.round(speedMph)));
      }
    );

    // Fetch nearby data every 10 seconds
    dataFetchInterval.current = setInterval(() => {
      fetchNearbyData();
    }, 10000);

    // Initial fetch
    const initialLocation = await Location.getCurrentPositionAsync({});
    setLocation(initialLocation);
    fetchNearbyData(initialLocation);
  };

  const fetchNearbyData = async (loc?: Location.LocationObject) => {
    const currentLoc = loc || location;
    if (!currentLoc) return;

    try {
      const response = await axios.get(`${API_URL}/api/nearby`, {
        params: {
          lat: currentLoc.coords.latitude,
          lon: currentLoc.coords.longitude,
          radius_km: 5,
        },
      });

      setCameras(response.data.cameras || []);
      setReports(response.data.reports || []);

      // Check for alerts
      checkAlerts(response.data.cameras || [], response.data.reports || []);
    } catch (error) {
      console.log('Fetch error:', error);
    }
  };

  const checkAlerts = (cams: Camera[], reps: CommunityReport[]) => {
    const allItems: AlertItem[] = [...cams, ...reps];
    const newAlertedIds = new Set(lastAlertedIds);

    for (const item of allItems) {
      if (item.distance_meters <= alertDistance && !lastAlertedIds.has(item.id)) {
        triggerAlert(item);
        newAlertedIds.add(item.id);
      }
    }

    // Clear alerts for items no longer nearby
    const currentIds = new Set(allItems.map(i => i.id));
    for (const id of newAlertedIds) {
      if (!currentIds.has(id)) {
        newAlertedIds.delete(id);
      }
    }

    setLastAlertedIds(newAlertedIds);
  };

  const triggerAlert = (item: AlertItem) => {
    if (!voiceEnabled) return;

    let message = '';
    
    if ('camera_type' in item) {
      // It's a camera
      switch (item.camera_type) {
        case 'fixed':
          message = item.speed_limit 
            ? `Speed camera ahead. ${item.speed_limit} miles per hour limit.`
            : 'Speed camera ahead.';
          break;
        case 'average_speed_start':
          message = 'Average speed zone ahead.';
          break;
        case 'average_speed_end':
          message = 'Average speed zone ends.';
          break;
        case 'red_light':
          message = 'Red light camera ahead.';
          break;
        default:
          message = 'Speed camera ahead.';
      }
    } else {
      // It's a community report
      if (item.report_type === 'mobile_camera') {
        message = 'Mobile camera reported ahead.';
      } else {
        message = 'Police speed check reported ahead.';
      }
    }

    Speech.speak(message, {
      language: 'en-GB',
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const handleReport = async (reportType: 'mobile_camera' | 'police_check') => {
    if (!location || isReporting) return;

    setIsReporting(true);
    try {
      const response = await axios.post(`${API_URL}/api/reports`, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        report_type: reportType,
        user_id: userId,
      });

      setReportFeedback(response.data.message);
      setTimeout(() => setReportFeedback(null), 3000);

      // Refresh data
      fetchNearbyData();
    } catch (error) {
      console.error('Report error:', error);
      setReportFeedback('Failed to submit report');
      setTimeout(() => setReportFeedback(null), 3000);
    }
    setIsReporting(false);
  };

  const toggleVoice = async () => {
    const newValue = !voiceEnabled;
    setVoiceEnabled(newValue);
    await AsyncStorage.setItem('voiceEnabled', String(newValue));
  };

  const getCameraTypeIcon = (type: string) => {
    switch (type) {
      case 'fixed': return 'camera';
      case 'average_speed_start': return 'speedometer';
      case 'average_speed_end': return 'flag';
      case 'red_light': return 'warning';
      default: return 'camera';
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
          <Text style={styles.loadingText}>Initializing...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const nearbyAlerts = [...cameras, ...reports].filter(item => item.distance_meters <= 1000);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DriveSafe UK</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={toggleVoice} style={styles.headerBtn}>
            <Ionicons 
              name={voiceEnabled ? 'volume-high' : 'volume-mute'} 
              size={24} 
              color={voiceEnabled ? '#22c55e' : '#ef4444'} 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/map')} style={styles.headerBtn}>
            <Ionicons name="map" size={24} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.headerBtn}>
            <Ionicons name="settings" size={24} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Speed Display */}
      <View style={styles.speedContainer}>
        <Text style={styles.speedValue}>{speed}</Text>
        <Text style={styles.speedUnit}>MPH</Text>
      </View>

      {/* Alert Banner */}
      {nearbyAlerts.length > 0 && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning" size={24} color="#fbbf24" />
          <Text style={styles.alertText}>
            {nearbyAlerts.length} alert{nearbyAlerts.length > 1 ? 's' : ''} within 1km
          </Text>
        </View>
      )}

      {/* Nearby Cameras/Reports List */}
      <View style={styles.alertsList}>
        {nearbyAlerts.slice(0, 3).map((item, index) => (
          <View key={item.id} style={styles.alertItem}>
            <View style={[
              styles.alertIcon,
              'report_type' in item ? styles.reportIcon : styles.cameraIcon
            ]}>
              <Ionicons 
                name={'camera_type' in item 
                  ? getCameraTypeIcon(item.camera_type) 
                  : (item.report_type === 'mobile_camera' ? 'car' : 'shield')
                } 
                size={20} 
                color="#fff" 
              />
            </View>
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>
                {'camera_type' in item 
                  ? (item.camera_type.replace('_', ' ').charAt(0).toUpperCase() + item.camera_type.replace('_', ' ').slice(1))
                  : (item.report_type === 'mobile_camera' ? 'Mobile Camera' : 'Police Check')
                }
              </Text>
              {'road_name' in item && item.road_name && (
                <Text style={styles.alertRoad}>{item.road_name}</Text>
              )}
              {'confirmations' in item && (
                <Text style={styles.alertConfirm}>
                  Confirmed by {item.confirmations} user{item.confirmations > 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <View style={styles.alertDistance}>
              <Text style={styles.distanceText}>{formatDistance(item.distance_meters)}</Text>
              {'speed_limit' in item && item.speed_limit && (
                <Text style={styles.limitText}>{item.speed_limit} mph</Text>
              )}
            </View>
          </View>
        ))}
        {nearbyAlerts.length === 0 && (
          <View style={styles.noAlertsContainer}>
            <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
            <Text style={styles.noAlertsText}>Road clear ahead</Text>
          </View>
        )}
      </View>

      {/* Report Feedback */}
      {reportFeedback && (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackText}>{reportFeedback}</Text>
        </View>
      )}

      {/* Report Buttons */}
      <View style={styles.reportButtons}>
        <TouchableOpacity
          style={[styles.reportBtn, styles.mobileCameraBtn]}
          onPress={() => handleReport('mobile_camera')}
          disabled={isReporting}
          activeOpacity={0.7}
        >
          <Ionicons name="car" size={32} color="#fff" />
          <Text style={styles.reportBtnText}>Mobile{"\n"}Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.reportBtn, styles.policeCheckBtn]}
          onPress={() => handleReport('police_check')}
          disabled={isReporting}
          activeOpacity={0.7}
        >
          <Ionicons name="shield" size={32} color="#fff" />
          <Text style={styles.reportBtnText}>Police{"\n"}Check</Text>
        </TouchableOpacity>
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {cameras.length} cameras • {reports.length} reports nearby
        </Text>
      </View>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  headerBtn: {
    padding: 8,
  },
  speedContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  speedValue: {
    color: '#fff',
    fontSize: 96,
    fontWeight: 'bold',
    lineHeight: 100,
  },
  speedUnit: {
    color: '#64748b',
    fontSize: 24,
    fontWeight: '600',
    marginTop: -8,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#422006',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 10,
  },
  alertText: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '600',
  },
  alertsList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    backgroundColor: '#ef4444',
  },
  reportIcon: {
    backgroundColor: '#f97316',
  },
  alertInfo: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  alertRoad: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 2,
  },
  alertConfirm: {
    color: '#22c55e',
    fontSize: 12,
    marginTop: 4,
  },
  alertDistance: {
    alignItems: 'flex-end',
  },
  distanceText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  limitText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  noAlertsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noAlertsText: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  feedbackBanner: {
    backgroundColor: '#166534',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  feedbackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  reportButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  reportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    gap: 12,
  },
  mobileCameraBtn: {
    backgroundColor: '#dc2626',
  },
  policeCheckBtn: {
    backgroundColor: '#2563eb',
  },
  reportBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  footerText: {
    color: '#64748b',
    fontSize: 14,
  },
});
