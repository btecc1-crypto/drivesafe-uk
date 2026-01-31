import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';

export default function RootLayout() {
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkOnboarding();
  }, []);

  useEffect(() => {
    if (isOnboarded === false && segments[0] !== 'onboarding') {
      router.replace('/onboarding');
    }
  }, [isOnboarded, segments]);

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
