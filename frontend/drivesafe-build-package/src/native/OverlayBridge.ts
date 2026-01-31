import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { OverlayModule } = NativeModules;

export interface OverlayModuleInterface {
  checkOverlayPermission(): Promise<boolean>;
  requestOverlayPermission(): Promise<boolean>;
  startOverlay(): Promise<boolean>;
  stopOverlay(): Promise<boolean>;
  updateSpeed(speed: number): void;
  updateNextCamera(distance: string, type: string): void;
  setAlertsEnabled(enabled: boolean): void;
  isOverlayRunning(): Promise<boolean>;
}

class OverlayBridge {
  private module: OverlayModuleInterface | null = null;
  private eventEmitter: NativeEventEmitter | null = null;
  private reportCallback: ((type: string) => void) | null = null;

  constructor() {
    if (Platform.OS === 'android' && OverlayModule) {
      this.module = OverlayModule as OverlayModuleInterface;
      this.eventEmitter = new NativeEventEmitter(OverlayModule);
      this.setupEventListeners();
    }
  }

  private setupEventListeners() {
    this.eventEmitter?.addListener('onOverlayReport', (event) => {
      if (this.reportCallback && event.type) {
        this.reportCallback(event.type);
      }
    });
  }

  isAvailable(): boolean {
    return Platform.OS === 'android' && this.module !== null;
  }

  async checkPermission(): Promise<boolean> {
    if (!this.module) return false;
    try {
      return await this.module.checkOverlayPermission();
    } catch (error) {
      console.error('Error checking overlay permission:', error);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!this.module) return false;
    try {
      return await this.module.requestOverlayPermission();
    } catch (error) {
      console.error('Error requesting overlay permission:', error);
      return false;
    }
  }

  async start(): Promise<boolean> {
    if (!this.module) return false;
    try {
      return await this.module.startOverlay();
    } catch (error) {
      console.error('Error starting overlay:', error);
      return false;
    }
  }

  async stop(): Promise<boolean> {
    if (!this.module) return false;
    try {
      return await this.module.stopOverlay();
    } catch (error) {
      console.error('Error stopping overlay:', error);
      return false;
    }
  }

  updateSpeed(speed: number): void {
    if (this.module) {
      this.module.updateSpeed(speed);
    }
  }

  updateNextCamera(distance: string, type: string): void {
    if (this.module) {
      this.module.updateNextCamera(distance, type);
    }
  }

  setAlertsEnabled(enabled: boolean): void {
    if (this.module) {
      this.module.setAlertsEnabled(enabled);
    }
  }

  async isRunning(): Promise<boolean> {
    if (!this.module) return false;
    try {
      return await this.module.isOverlayRunning();
    } catch (error) {
      console.error('Error checking overlay status:', error);
      return false;
    }
  }

  setReportCallback(callback: (type: string) => void): void {
    this.reportCallback = callback;
  }

  removeReportCallback(): void {
    this.reportCallback = null;
  }
}

export const overlayBridge = new OverlayBridge();
