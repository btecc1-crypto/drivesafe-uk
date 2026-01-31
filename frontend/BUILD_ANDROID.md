# DriveSafe UK - Native Android Build Instructions

## Project Overview
This is a UK-focused driver app with **true Android system overlay** (TomTom AmiGO-style floating widget) that stays on top of all apps.

## Native Android Features Implemented

### 1. Floating Overlay Widget
- **Collapsed State**: Small pill/bubble showing "Alerts ON", speed, and quick Report button
- **Expanded State**: Full widget with speed display, next camera info, and report buttons
- **Draggable**: User can reposition the overlay within screen bounds
- **Always-on-top**: Uses `WindowManager` with `TYPE_APPLICATION_OVERLAY`

### 2. Foreground Service
- Runs in background with persistent notification
- Maintains location tracking even when app is minimized
- Service type: `location` for background location access

### 3. Permissions
- `SYSTEM_ALERT_WINDOW` - Display over other apps
- `ACCESS_BACKGROUND_LOCATION` - Background location tracking
- `FOREGROUND_SERVICE` - Background service
- `ACCESS_FINE_LOCATION` - GPS tracking

## Build Instructions

### Prerequisites
1. **Android Studio** (latest version recommended)
2. **Java JDK 17** or higher
3. **Android SDK** with:
   - Build Tools 34.0.0
   - Platform Android 34 (API 34)
   - NDK (side by side)

### Step 1: Clone/Download the Project
```bash
# Copy the entire /app/frontend directory to your local machine
```

### Step 2: Open in Android Studio
1. Open Android Studio
2. Select "Open an existing project"
3. Navigate to `/frontend/android`
4. Wait for Gradle sync to complete

### Step 3: Build Debug APK
```bash
cd /frontend/android
./gradlew assembleDebug
```
The APK will be at: `app/build/outputs/apk/debug/app-debug.apk`

### Step 4: Build Release APK (for distribution)
1. Create a keystore:
```bash
keytool -genkey -v -keystore drivesafe-release.keystore -alias drivesafe -keyalg RSA -keysize 2048 -validity 10000
```

2. Add to `android/gradle.properties`:
```properties
DRIVESAFE_RELEASE_STORE_FILE=drivesafe-release.keystore
DRIVESAFE_RELEASE_KEY_ALIAS=drivesafe
DRIVESAFE_RELEASE_STORE_PASSWORD=your_password
DRIVESAFE_RELEASE_KEY_PASSWORD=your_password
```

3. Build release:
```bash
./gradlew assembleRelease
```

### Alternative: EAS Build (Expo Application Services)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build APK
eas build --platform android --profile preview
```

## File Structure

```
android/
├── app/
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml          # Permissions & service declaration
│           ├── java/com/drivesafe/uk/
│           │   ├── MainActivity.kt
│           │   ├── MainApplication.kt       # Registers OverlayPackage
│           │   └── overlay/
│           │       ├── OverlayService.kt    # Foreground service with WindowManager
│           │       ├── OverlayModule.kt     # React Native bridge
│           │       └── OverlayPackage.kt    # Package registration
│           └── res/
│               ├── drawable/
│               │   ├── overlay_collapsed_bg.xml
│               │   ├── overlay_expanded_bg.xml
│               │   ├── status_active.xml
│               │   ├── status_inactive.xml
│               │   ├── report_button_bg.xml
│               │   ├── camera_info_bg.xml
│               │   ├── mobile_camera_btn_bg.xml
│               │   ├── police_check_btn_bg.xml
│               │   └── open_app_btn_bg.xml
│               └── layout/
│                   └── overlay_layout.xml   # Floating widget XML layout
```

## React Native Bridge

The overlay is controlled from JavaScript via `OverlayModule`:

```typescript
import { useOverlay } from '../src/native';

const overlay = useOverlay();

// Check/request permission
await overlay.checkPermission();
await overlay.requestPermission();

// Start/stop overlay
await overlay.startOverlay();
await overlay.stopOverlay();

// Update overlay data
overlay.updateSpeed(65);
overlay.updateNextCamera('320m', 'Fixed Camera');
overlay.setAlertsEnabled(true);

// Handle reports from overlay
overlay.setReportCallback((type) => {
  // type: 'mobile_camera' or 'police_check'
});
```

## Testing on Device

1. Enable **Developer Options** on your Android device
2. Enable **USB Debugging**
3. Connect device via USB
4. Run: `adb install app-debug.apk`

### Testing Overlay Permission
1. Open app and enable "Driving Mode"
2. If overlay permission not granted, app will redirect to system settings
3. Find "DriveSafe UK" and enable "Display over other apps"
4. Return to app - overlay should now appear

## Known Limitations

1. **Overlay not available on web preview** - This is native Android only
2. **iOS**: True overlay not possible due to iOS restrictions. Phase 2 would implement Live Activities or persistent notifications as alternative.
3. **Battery optimization**: Users may need to disable battery optimization for reliable background operation

## API Backend

The app connects to a FastAPI backend at the configured `EXPO_PUBLIC_BACKEND_URL`. Ensure the backend is running and accessible from the device.

## Acceptance Criteria Checklist

- [x] Overlay can be enabled and stays on top of every app
- [x] Overlay supports collapsed + expanded states
- [x] Collapsed: small pill/bubble at top of screen
- [x] Expanded: shows buttons + basic info
- [x] Overlay is draggable
- [x] Overlay survives app switching
- [x] Overlay has clear ON/OFF control (Driving Mode toggle)
- [x] Background location alerts for fixed cameras
- [x] Community "mobile camera" proximity alerts
- [x] Alerts trigger at configurable distances
- [x] Alerts have cooldown (3 minutes per camera)
- [x] 1-tap Report button in collapsed overlay
- [x] Report Mobile Camera / Police Check in expanded overlay
- [x] Rate limiting enforced (1 per type per 5 min)
- [x] Duplicate merge within 200m
- [x] TTL expiry (mobile: 75min, police: 52min)
- [x] Voice alerts using expo-speech (en-GB)
- [x] Sound on/off toggle
- [x] Database-backed camera dataset
- [x] Admin panel for camera management
- [x] Onboarding explains permissions
- [x] Positioned as road safety tool
