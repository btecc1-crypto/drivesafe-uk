import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertDistance, setAlertDistance] = useState(500);
  const [locationPermission, setLocationPermission] = useState<string>('unknown');
  const [backgroundPermission, setBackgroundPermission] = useState<string>('unknown');
  const [notificationPermission, setNotificationPermission] = useState<string>('unknown');

  useEffect(() => {
    loadSettings();
    checkPermissions();
  }, []);

  const loadSettings = async () => {
    try {
      const savedVoice = await AsyncStorage.getItem('voiceEnabled');
      const savedSound = await AsyncStorage.getItem('soundEnabled');
      const savedDistance = await AsyncStorage.getItem('alertDistance');
      
      if (savedVoice !== null) setVoiceEnabled(savedVoice === 'true');
      if (savedSound !== null) setSoundEnabled(savedSound === 'true');
      if (savedDistance !== null) setAlertDistance(parseInt(savedDistance));
    } catch (error) {
      console.error('Load settings error:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      const { status: locStatus } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(locStatus);

      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      setBackgroundPermission(bgStatus);

      const { status: notifStatus } = await Notifications.getPermissionsAsync();
      setNotificationPermission(notifStatus.status);
    } catch (error) {
      console.error('Permission check error:', error);
    }
  };

  const handleVoiceToggle = async (value: boolean) => {
    setVoiceEnabled(value);
    await AsyncStorage.setItem('voiceEnabled', String(value));
    if (value) {
      Speech.speak('Voice alerts enabled', { language: 'en-GB', rate: 0.9 });
    }
  };

  const handleSoundToggle = async (value: boolean) => {
    setSoundEnabled(value);
    await AsyncStorage.setItem('soundEnabled', String(value));
  };

  const handleDistanceChange = async (distance: number) => {
    setAlertDistance(distance);
    await AsyncStorage.setItem('alertDistance', String(distance));
  };

  const testVoiceAlert = () => {
    Speech.speak('Speed camera ahead. 30 miles per hour limit.', {
      language: 'en-GB',
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const openAppSettings = () => {
    Linking.openSettings();
  };

  const requestPermissions = async () => {
    router.push('/onboarding');
  };

  const clearData = async () => {
    Alert.alert(
      'Clear Local Data',
      'This will reset your settings and clear cached data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            await loadSettings();
            Alert.alert('Done', 'Local data cleared');
          },
        },
      ]
    );
  };

  const distanceOptions = [
    { value: 150, label: '150m' },
    { value: 300, label: '300m' },
    { value: 500, label: '500m' },
    { value: 750, label: '750m' },
  ];

  const getPermissionColor = (status: string) => {
    return status === 'granted' ? '#22c55e' : '#ef4444';
  };

  const getPermissionIcon = (status: string) => {
    return status === 'granted' ? 'checkmark-circle' : 'close-circle';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Permissions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          <Text style={styles.sectionDescription}>
            Required for background alerts while driving
          </Text>

          <View style={styles.permissionsList}>
            <View style={styles.permissionItem}>
              <Ionicons name="location" size={20} color="#3b82f6" />
              <Text style={styles.permissionLabel}>Location</Text>
              <Ionicons 
                name={getPermissionIcon(locationPermission)} 
                size={20} 
                color={getPermissionColor(locationPermission)} 
              />
            </View>
            <View style={styles.permissionItem}>
              <Ionicons name="navigate" size={20} color="#3b82f6" />
              <Text style={styles.permissionLabel}>Background Location</Text>
              <Ionicons 
                name={getPermissionIcon(backgroundPermission)} 
                size={20} 
                color={getPermissionColor(backgroundPermission)} 
              />
            </View>
            <View style={styles.permissionItem}>
              <Ionicons name="notifications" size={20} color="#3b82f6" />
              <Text style={styles.permissionLabel}>Notifications</Text>
              <Ionicons 
                name={getPermissionIcon(notificationPermission)} 
                size={20} 
                color={getPermissionColor(notificationPermission)} 
              />
            </View>
          </View>

          <View style={styles.permissionButtons}>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermissions}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.permissionBtnText}>Re-request</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={openAppSettings}>
              <Ionicons name="settings" size={18} color="#3b82f6" />
              <Text style={styles.settingsBtnText}>App Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Alert Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-high" size={24} color="#3b82f6" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Voice Alerts</Text>
                <Text style={styles.settingDescription}>Spoken camera warnings</Text>
              </View>
            </View>
            <Switch
              value={voiceEnabled}
              onValueChange={handleVoiceToggle}
              trackColor={{ false: '#374151', true: '#22c55e' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications" size={24} color="#3b82f6" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Sound Alerts</Text>
                <Text style={styles.settingDescription}>Notification sounds</Text>
              </View>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={handleSoundToggle}
              trackColor={{ false: '#374151', true: '#22c55e' }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity style={styles.testButton} onPress={testVoiceAlert}>
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.testButtonText}>Test Voice Alert</Text>
          </TouchableOpacity>
        </View>

        {/* Alert Distance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert Distance</Text>
          <Text style={styles.sectionDescription}>
            How far ahead to alert you about cameras
          </Text>

          <View style={styles.distanceOptions}>
            {distanceOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.distanceOption,
                  alertDistance === option.value && styles.distanceOptionActive,
                ]}
                onPress={() => handleDistanceChange(option.value)}
              >
                <Text
                  style={[
                    styles.distanceOptionText,
                    alertDistance === option.value && styles.distanceOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Admin Panel Link */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administration</Text>
          
          <TouchableOpacity 
            style={styles.adminButton}
            onPress={() => router.push('/admin')}
          >
            <Ionicons name="construct" size={20} color="#f97316" />
            <Text style={styles.adminButtonText}>Camera Admin Panel</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={32} color="#22c55e" />
            <Text style={styles.infoTitle}>Road Safety Tool</Text>
            <Text style={styles.infoText}>
              DriveSafe UK helps professional drivers maintain speed compliance.
              This is a road safety tool, not intended to help evade law enforcement.
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>v1.0.0</Text>
              <Text style={styles.statLabel}>Version</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>MPH</Text>
              <Text style={styles.statLabel}>Units</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>UK</Text>
              <Text style={styles.statLabel}>Region</Text>
            </View>
          </View>
        </View>

        {/* Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          
          <TouchableOpacity style={styles.dangerButton} onPress={clearData}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
            <Text style={styles.dangerButtonText}>Clear Local Data</Text>
          </TouchableOpacity>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Ionicons name="information-circle" size={20} color="#64748b" />
          <Text style={styles.disclaimerText}>
            Always drive safely and within the speed limit. GPS speed may vary
            from actual vehicle speed. Camera data may not be complete or
            up-to-date. This app does not guarantee accuracy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 16,
  },
  permissionsList: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  permissionLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  permissionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  permissionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  settingsBtnText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingDescription: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  distanceOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  distanceOption: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  distanceOptionActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
  },
  distanceOptionText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  distanceOptionTextActive: {
    color: '#3b82f6',
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  adminButtonText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  dangerButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    gap: 12,
  },
  disclaimerText: {
    flex: 1,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
});
