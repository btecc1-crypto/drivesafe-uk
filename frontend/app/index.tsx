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
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const LOCATION_TASK_NAME = 'background-location-task';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

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
  const [alertCooldowns, setAlertCooldowns] = useState<Map<string, number>>(new Map());
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertDistance, setAlertDistance] = useState(500);
  const [isReporting, setIsReporting] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [drivingMode, setDrivingMode] = useState(false);
  const [isOverlayExpanded, setIsOverlayExpanded] = useState(true);
  const [nextCamera, setNextCamera] = useState<AlertItem | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const dataFetchInterval = useRef<NodeJS.Timeout | null>(null);
  const ALERT_COOLDOWN_MS = 180000; // 3 minutes cooldown per camera

  useEffect(() => {
    initializeApp();
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      cleanup();
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    setAppState(nextAppState);
    if (nextAppState === 'active' && drivingMode) {
      fetchNearbyData();
    }
  };

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
      const savedSound = await AsyncStorage.getItem('soundEnabled');
      const savedDistance = await AsyncStorage.getItem('alertDistance');
      const savedDrivingMode = await AsyncStorage.getItem('drivingMode');
      
      if (savedVoice !== null) setVoiceEnabled(savedVoice === 'true');
      if (savedSound !== null) setSoundEnabled(savedSound === 'true');
      if (savedDistance !== null) setAlertDistance(parseInt(savedDistance));
      if (savedDrivingMode === 'true') setDrivingMode(true);

      // Check location permission
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
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
      console.log('Seed already done or error');
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

      const fetchedCameras = response.data.cameras || [];
      const fetchedReports = response.data.reports || [];
      
      setCameras(fetchedCameras);
      setReports(fetchedReports);

      // Find closest alert
      const allItems = [...fetchedCameras, ...fetchedReports];
      if (allItems.length > 0) {
        const closest = allItems.reduce((prev, curr) => 
          prev.distance_meters < curr.distance_meters ? prev : curr
        );
        setNextCamera(closest);
      } else {
        setNextCamera(null);
      }

      // Check for alerts
      if (drivingMode) {
        checkAlerts(fetchedCameras, fetchedReports);
      }
    } catch (error) {
      console.log('Fetch error:', error);
    }
  };

  const checkAlerts = (cams: Camera[], reps: CommunityReport[]) => {
    const now = Date.now();
    const allItems: AlertItem[] = [...cams, ...reps];
    const newCooldowns = new Map(alertCooldowns);

    for (const item of allItems) {
      // Check if within alert distance
      if (item.distance_meters <= alertDistance) {
        const lastAlerted = alertCooldowns.get(item.id) || 0;
        
        // Check cooldown (3 minutes between alerts for same camera)
        if (now - lastAlerted > ALERT_COOLDOWN_MS) {
          triggerAlert(item);
          newCooldowns.set(item.id, now);
        }
      }
    }

    setAlertCooldowns(newCooldowns);
  };

  const triggerAlert = async (item: AlertItem) => {
    let message = '';
    let notificationTitle = '';
    
    if ('camera_type' in item) {
      switch (item.camera_type) {
        case 'fixed':
          message = item.speed_limit 
            ? `Speed camera ahead. ${item.speed_limit} miles per hour limit.`
            : 'Speed camera ahead.';
          notificationTitle = 'Speed Camera Ahead';
          break;
        case 'average_speed_start':
          message = 'Average speed zone ahead.';
          notificationTitle = 'Average Speed Zone';
          break;
        case 'average_speed_end':
          message = 'Average speed zone ends.';
          notificationTitle = 'Speed Zone Ends';
          break;
        case 'red_light':
          message = 'Red light camera ahead.';
          notificationTitle = 'Red Light Camera';
          break;
        default:
          message = 'Speed camera ahead.';
          notificationTitle = 'Camera Alert';
      }
    } else {
      if (item.report_type === 'mobile_camera') {
        message = 'Mobile camera reported ahead.';
        notificationTitle = 'Mobile Camera Reported';
      } else {
        message = 'Police speed check reported ahead.';
        notificationTitle = 'Police Check Reported';
      }
    }

    // Voice alert
    if (voiceEnabled) {
      Speech.speak(message, {
        language: 'en-GB',
        pitch: 1.0,
        rate: 0.9,
      });
    }

    // Send notification (works in background)
    if (appState !== 'active') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationTitle,
          body: `${Math.round(item.distance_meters)}m ahead`,
          sound: soundEnabled,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    }
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
      fetchNearbyData();
    } catch (error) {
      console.error('Report error:', error);
      setReportFeedback('Failed to submit report');
      setTimeout(() => setReportFeedback(null), 3000);
    }
    setIsReporting(false);
  };

  const toggleDrivingMode = async () => {
    const newValue = !drivingMode;
    setDrivingMode(newValue);
    await AsyncStorage.setItem('drivingMode', String(newValue));
    
    if (newValue && voiceEnabled) {
      Speech.speak('Driving mode activated. Alerts enabled.', {
        language: 'en-GB',
        rate: 0.9,
      });
    }
  };

  const toggleVoice = async () => {
    const newValue = !voiceEnabled;
    setVoiceEnabled(newValue);
    await AsyncStorage.setItem('voiceEnabled', String(newValue));
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getCameraTypeLabel = (item: AlertItem) => {
    if ('camera_type' in item) {
      switch (item.camera_type) {
        case 'fixed': return 'Fixed Camera';
        case 'average_speed_start': return 'Avg Speed Start';
        case 'average_speed_end': return 'Avg Speed End';
        case 'red_light': return 'Red Light';
        default: return 'Camera';
      }
    }
    return item.report_type === 'mobile_camera' ? 'Mobile Camera' : 'Police Check';
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

  // Mini Overlay Mode (Collapsed)
  if (drivingMode && !isOverlayExpanded) {
    return (
      <SafeAreaView style={styles.miniOverlayContainer}>
        <TouchableOpacity 
          style={styles.miniOverlay}
          onPress={() => setIsOverlayExpanded(true)}
          activeOpacity={0.9}
        >
          <View style={styles.miniOverlayLeft}>
            <View style={[styles.statusDot, drivingMode && styles.statusDotActive]} />
            <Text style={styles.miniOverlayText}>Alerts ON</Text>
            <Text style={styles.miniSpeedText}>{speed} mph</Text>
          </View>
          
          <TouchableOpacity
            style={styles.miniReportBtn}
            onPress={() => handleReport('mobile_camera')}
            disabled={isReporting}
          >
            <Ionicons name="camera" size={18} color="#fff" />
            <Text style={styles.miniReportText}>Report</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {nextCamera && (
          <View style={styles.miniNextCamera}>
            <Text style={styles.miniNextText}>
              Next: {getCameraTypeLabel(nextCamera)} • {formatDistance(nextCamera.distance_meters)}
            </Text>
          </View>
        )}

        {reportFeedback && (
          <View style={styles.miniFeedback}>
            <Text style={styles.miniFeedbackText}>{reportFeedback}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // Full Driving Mode (Expanded)
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

      {/* Driving Mode Toggle */}
      <TouchableOpacity 
        style={[styles.drivingModeToggle, drivingMode && styles.drivingModeActive]}
        onPress={toggleDrivingMode}
      >
        <View style={styles.drivingModeContent}>
          <Ionicons 
            name={drivingMode ? 'car' : 'car-outline'} 
            size={24} 
            color={drivingMode ? '#22c55e' : '#94a3b8'} 
          />
          <View style={styles.drivingModeText}>
            <Text style={[styles.drivingModeLabel, drivingMode && styles.drivingModeLabelActive]}>
              Driving Mode
            </Text>
            <Text style={styles.drivingModeStatus}>
              {drivingMode ? 'Alerts active • Tap to minimize' : 'Tap to enable alerts'}
            </Text>
          </View>
        </View>
        <View style={[styles.drivingModeIndicator, drivingMode && styles.drivingModeIndicatorActive]} />
      </TouchableOpacity>

      {/* Collapse Button when Driving Mode is ON */}
      {drivingMode && (
        <TouchableOpacity 
          style={styles.collapseBtn}
          onPress={() => setIsOverlayExpanded(false)}
        >
          <Ionicons name="chevron-up" size={20} color="#94a3b8" />
          <Text style={styles.collapseBtnText}>Minimize to overlay</Text>
        </TouchableOpacity>
      )}

      {/* Speed Display */}
      <View style={styles.speedContainer}>
        <Text style={[styles.speedValue, drivingMode && styles.speedValueActive]}>{speed}</Text>
        <Text style={styles.speedUnit}>MPH</Text>
      </View>

      {/* Next Camera Info */}
      {nextCamera && drivingMode && (
        <View style={styles.nextCameraBanner}>
          <Ionicons name="navigate" size={20} color="#fbbf24" />
          <Text style={styles.nextCameraText}>
            Next: {getCameraTypeLabel(nextCamera)}
          </Text>
          <Text style={styles.nextCameraDistance}>
            {formatDistance(nextCamera.distance_meters)}
          </Text>
        </View>
      )}

      {/* Alert Banner */}
      {nearbyAlerts.length > 0 && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning" size={24} color="#fbbf24" />
          <Text style={styles.alertText}>
            {nearbyAlerts.length} alert{nearbyAlerts.length > 1 ? 's' : ''} within 1km
          </Text>
        </View>
      )}

      {/* Alerts List */}
      <View style={styles.alertsList}>
        {nearbyAlerts.slice(0, 3).map((item) => (
          <View key={item.id} style={styles.alertItem}>
            <View style={[
              styles.alertIcon,
              'report_type' in item ? styles.reportIcon : styles.cameraIcon
            ]}>
              <Ionicons 
                name={'camera_type' in item 
                  ? (item.camera_type === 'red_light' ? 'warning' : 'camera')
                  : (item.report_type === 'mobile_camera' ? 'car' : 'shield')
                } 
                size={20} 
                color="#fff" 
              />
            </View>
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>{getCameraTypeLabel(item)}</Text>
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

      {/* Footer */}
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
  drivingModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  drivingModeActive: {
    borderColor: '#22c55e',
    backgroundColor: '#052e16',
  },
  drivingModeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drivingModeText: {
    gap: 2,
  },
  drivingModeLabel: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  drivingModeLabelActive: {
    color: '#22c55e',
  },
  drivingModeStatus: {
    color: '#64748b',
    fontSize: 12,
  },
  drivingModeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#374151',
  },
  drivingModeIndicatorActive: {
    backgroundColor: '#22c55e',
  },
  collapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  collapseBtnText: {
    color: '#64748b',
    fontSize: 12,
  },
  speedContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  speedValue: {
    color: '#fff',
    fontSize: 80,
    fontWeight: 'bold',
    lineHeight: 85,
  },
  speedValueActive: {
    color: '#22c55e',
  },
  speedUnit: {
    color: '#64748b',
    fontSize: 24,
    fontWeight: '600',
    marginTop: -8,
  },
  nextCameraBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#422006',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
  },
  nextCameraText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
  },
  nextCameraDistance: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
    paddingTop: 12,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 15,
    fontWeight: '600',
  },
  alertRoad: {
    color: '#94a3b8',
    fontSize: 13,
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
    fontSize: 17,
    fontWeight: 'bold',
  },
  limitText: {
    color: '#fbbf24',
    fontSize: 13,
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
    marginBottom: 12,
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
    paddingBottom: 12,
    gap: 12,
  },
  reportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
  },
  mobileCameraBtn: {
    backgroundColor: '#dc2626',
  },
  policeCheckBtn: {
    backgroundColor: '#2563eb',
  },
  reportBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  footerText: {
    color: '#64748b',
    fontSize: 13,
  },
  // Mini Overlay Styles
  miniOverlayContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  miniOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  miniOverlayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#64748b',
  },
  statusDotActive: {
    backgroundColor: '#22c55e',
  },
  miniOverlayText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  miniSpeedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  miniReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 6,
  },
  miniReportText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  miniNextCamera: {
    backgroundColor: '#422006',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  miniNextText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  miniFeedback: {
    backgroundColor: '#166534',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  miniFeedbackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
