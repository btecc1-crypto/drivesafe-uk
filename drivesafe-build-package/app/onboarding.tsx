import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

interface PermissionStep {
  id: string;
  icon: string;
  title: string;
  description: string;
  granted: boolean | null;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [permissions, setPermissions] = useState<PermissionStep[]>([
    {
      id: 'location',
      icon: 'location',
      title: 'Location Access',
      description: 'Track your position to alert you when approaching speed cameras. Your location stays on your device.',
      granted: null,
    },
    {
      id: 'background',
      icon: 'navigate',
      title: 'Background Location',
      description: 'Keep alerts active while using other apps like Google Maps or Uber.',
      granted: null,
    },
    {
      id: 'notifications',
      icon: 'notifications',
      title: 'Notifications',
      description: 'Receive camera alerts even when the app is in the background.',
      granted: null,
    },
  ]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      updatePermission('location', status === 'granted');
      return status === 'granted';
    } catch (error) {
      console.error('Location permission error:', error);
      return false;
    }
  };

  const requestBackgroundPermission = async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      updatePermission('background', status === 'granted');
      return status === 'granted';
    } catch (error) {
      console.error('Background permission error:', error);
      return false;
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      updatePermission('notifications', status === 'granted');
      return status === 'granted';
    } catch (error) {
      console.error('Notification permission error:', error);
      return false;
    }
  };

  const updatePermission = (id: string, granted: boolean) => {
    setPermissions(prev =>
      prev.map(p => (p.id === id ? { ...p, granted } : p))
    );
  };

  const handlePermissionRequest = async () => {
    const currentPermission = permissions[currentStep];
    let granted = false;

    switch (currentPermission.id) {
      case 'location':
        granted = await requestLocationPermission();
        break;
      case 'background':
        granted = await requestBackgroundPermission();
        break;
      case 'notifications':
        granted = await requestNotificationPermission();
        break;
    }

    if (currentStep < permissions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await completeOnboarding();
    }
  };

  const skipPermission = () => {
    updatePermission(permissions[currentStep].id, false);
    if (currentStep < permissions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('onboarded', 'true');
    router.replace('/');
  };

  const currentPermission = permissions[currentStep];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="speedometer" size={48} color="#3b82f6" />
          </View>
          <Text style={styles.appName}>DriveSafe UK</Text>
          <Text style={styles.tagline}>Speed Camera Alerts for Professional Drivers</Text>
        </View>

        {/* Progress Dots */}
        <View style={styles.progressContainer}>
          {permissions.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep && styles.progressDotActive,
                index < currentStep && styles.progressDotComplete,
              ]}
            />
          ))}
        </View>

        {/* Permission Card */}
        <View style={styles.permissionCard}>
          <View style={[
            styles.iconCircle,
            currentPermission.granted === true && styles.iconCircleGranted,
            currentPermission.granted === false && styles.iconCircleDenied,
          ]}>
            <Ionicons
              name={currentPermission.icon as any}
              size={40}
              color={currentPermission.granted === true ? '#22c55e' : '#fff'}
            />
          </View>

          <Text style={styles.permissionTitle}>{currentPermission.title}</Text>
          <Text style={styles.permissionDescription}>
            {currentPermission.description}
          </Text>

          {currentPermission.granted !== null && (
            <View style={[
              styles.statusBadge,
              currentPermission.granted ? styles.statusGranted : styles.statusDenied,
            ]}>
              <Ionicons
                name={currentPermission.granted ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={currentPermission.granted ? '#22c55e' : '#ef4444'}
              />
              <Text style={[
                styles.statusText,
                { color: currentPermission.granted ? '#22c55e' : '#ef4444' },
              ]}>
                {currentPermission.granted ? 'Granted' : 'Denied'}
              </Text>
            </View>
          )}
        </View>

        {/* Why We Need This */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#3b82f6" />
          <Text style={styles.infoText}>
            {currentPermission.id === 'location' &&
              'We use GPS to calculate your distance to cameras. Location data never leaves your device.'}
            {currentPermission.id === 'background' &&
              'Background location allows alerts while you use navigation apps. Essential for driving mode.'}
            {currentPermission.id === 'notifications' &&
              'Notifications ensure you receive alerts even when the app is minimized.'}
          </Text>
        </View>

        {/* Safety Notice */}
        <View style={styles.safetyCard}>
          <Ionicons name="shield-checkmark" size={24} color="#22c55e" />
          <View style={styles.safetyContent}>
            <Text style={styles.safetyTitle}>Road Safety Tool</Text>
            <Text style={styles.safetyText}>
              This app helps you stay compliant with speed limits. Always drive safely and within the law.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.skipButton} onPress={skipPermission}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.allowButton}
          onPress={handlePermissionRequest}
        >
          <Text style={styles.allowButtonText}>
            {currentStep === permissions.length - 1 ? 'Get Started' : 'Allow'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tagline: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: '#3b82f6',
  },
  progressDotComplete: {
    backgroundColor: '#22c55e',
  },
  permissionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircleGranted: {
    backgroundColor: '#166534',
  },
  iconCircleDenied: {
    backgroundColor: '#7f1d1d',
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  permissionDescription: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusGranted: {
    backgroundColor: '#052e16',
  },
  statusDenied: {
    backgroundColor: '#450a0a',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    color: '#93c5fd',
    fontSize: 13,
    lineHeight: 20,
  },
  safetyCard: {
    flexDirection: 'row',
    backgroundColor: '#052e16',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  safetyContent: {
    flex: 1,
  },
  safetyTitle: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  safetyText: {
    color: '#86efac',
    fontSize: 13,
    lineHeight: 18,
  },
  bottomButtons: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  allowButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  allowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
