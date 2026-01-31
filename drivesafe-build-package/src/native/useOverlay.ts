import { useState, useEffect, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { overlayBridge } from './OverlayBridge';

export interface UseOverlayReturn {
  isAvailable: boolean;
  hasPermission: boolean;
  isRunning: boolean;
  checkPermission: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  startOverlay: () => Promise<boolean>;
  stopOverlay: () => Promise<boolean>;
  updateSpeed: (speed: number) => void;
  updateNextCamera: (distance: string, type: string) => void;
  setAlertsEnabled: (enabled: boolean) => void;
  setReportCallback: (callback: (type: string) => void) => void;
}

export function useOverlay(): UseOverlayReturn {
  const [hasPermission, setHasPermission] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const isAvailable = overlayBridge.isAvailable();

  useEffect(() => {
    if (!isAvailable) return;

    // Check initial state
    checkPermission();
    checkRunningState();

    // Re-check when app becomes active (user might have granted permission)
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAvailable]);

  const handleAppStateChange = async (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      await checkPermission();
      await checkRunningState();
    }
  };

  const checkPermission = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    const permitted = await overlayBridge.checkPermission();
    setHasPermission(permitted);
    return permitted;
  }, [isAvailable]);

  const checkRunningState = useCallback(async () => {
    if (!isAvailable) return;
    const running = await overlayBridge.isRunning();
    setIsRunning(running);
  }, [isAvailable]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    const result = await overlayBridge.requestPermission();
    // User was redirected to settings, they need to come back
    // We'll re-check when app becomes active
    return result;
  }, [isAvailable]);

  const startOverlay = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    const success = await overlayBridge.start();
    if (success) {
      setIsRunning(true);
    }
    return success;
  }, [isAvailable]);

  const stopOverlay = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    const success = await overlayBridge.stop();
    if (success) {
      setIsRunning(false);
    }
    return success;
  }, [isAvailable]);

  const updateSpeed = useCallback((speed: number) => {
    overlayBridge.updateSpeed(speed);
  }, []);

  const updateNextCamera = useCallback((distance: string, type: string) => {
    overlayBridge.updateNextCamera(distance, type);
  }, []);

  const setAlertsEnabled = useCallback((enabled: boolean) => {
    overlayBridge.setAlertsEnabled(enabled);
  }, []);

  const setReportCallback = useCallback((callback: (type: string) => void) => {
    overlayBridge.setReportCallback(callback);
  }, []);

  return {
    isAvailable,
    hasPermission,
    isRunning,
    checkPermission,
    requestPermission,
    startOverlay,
    stopOverlay,
    updateSpeed,
    updateNextCamera,
    setAlertsEnabled,
    setReportCallback,
  };
}
