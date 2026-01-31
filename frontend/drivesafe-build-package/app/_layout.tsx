import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { Platform } from 'react-native';

export default function RootLayout() {
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  useEffect(() => {
    checkOnboarding();
  }, []);

  useEffect(() => {
    // Only redirect to onboarding on native platforms, not web
    // Also allow access to settings and admin directly
    const allowedPaths = ['/onboarding', '/settings', '/admin', '/map'];
    if (Platform.OS !== 'web' && isOnboarded === false && !allowedPaths.includes(pathname)) {
      router.replace('/onboarding');
    }
  }, [isOnboarded, pathname]);

  const checkOnboarding = async () => {
    try {
      const onboarded = await AsyncStorage.getItem('onboarded');
      setIsOnboarded(onboarded === 'true');
    } catch (error) {
      setIsOnboarded(false);
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0f172a' },
          animation: 'fade',
        }}
      />
    </SafeAreaProvider>
  );
}
