# DriveSafe UK - Android APK Build & Installation Guide

## 📦 Download Source Package
Download: `/app/drivesafe-android-source.tar.gz` (8.6MB)

---

## 🔨 BUILD THE APK (Choose one method)

### Method 1: Android Studio (Recommended)

1. **Extract the package:**
   ```bash
   tar -xzvf drivesafe-android-source.tar.gz
   cd drivesafe-build-package
   ```

2. **Install dependencies:**
   ```bash
   yarn install
   ```

3. **Open in Android Studio:**
   - Open Android Studio
   - File → Open → Select `android` folder
   - Wait for Gradle sync to complete

4. **Build Debug APK:**
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Or run: `./gradlew assembleDebug` in terminal
   
5. **APK Location:**
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Method 2: Command Line (macOS/Linux/Windows with WSL)

```bash
# Extract and enter directory
tar -xzvf drivesafe-android-source.tar.gz
cd drivesafe-build-package

# Install JS dependencies
yarn install

# Build APK
cd android
./gradlew assembleDebug

# APK will be at:
# app/build/outputs/apk/debug/app-debug.apk
```

### Method 3: EAS Build (Cloud Build)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Create eas.json if not exists
cat > eas.json << 'EOF'
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
EOF

# Build APK in cloud
eas build --platform android --profile preview
```

---

## 📱 INSTALL APK ON ANDROID PHONE

### Step 1: Enable Developer Options
1. Go to **Settings → About Phone**
2. Tap **Build Number** 7 times
3. You'll see "You are now a developer!"

### Step 2: Enable USB Debugging
1. Go to **Settings → Developer Options**
2. Enable **USB Debugging**
3. Enable **Install via USB** (if available)

### Step 3: Enable Unknown Sources (for APK install)
1. Go to **Settings → Security** (or Settings → Apps)
2. Enable **Install unknown apps** for your file manager
3. Or enable **Unknown sources** (older Android)

### Step 4: Transfer & Install APK

**Option A: USB Transfer**
1. Connect phone to computer via USB
2. Copy `app-debug.apk` to phone's Download folder
3. On phone, open Files app
4. Navigate to Download folder
5. Tap `app-debug.apk`
6. Tap **Install**

**Option B: ADB Install (Recommended)**
```bash
# With phone connected via USB
adb install app-debug.apk
```

**Option C: Wireless ADB**
```bash
# On phone: Settings → Developer Options → Wireless Debugging
# Get IP and port, then:
adb connect <IP>:<PORT>
adb install app-debug.apk
```

---

## 🎯 OVERLAY PERMISSION SETUP

### Grant "Display Over Other Apps" Permission

1. **First Launch:**
   - Open DriveSafe UK app
   - Tap **"Driving Mode + Overlay"** button
   - App will show a prompt about overlay permission

2. **Manual Permission Grant:**
   - Go to **Settings → Apps → DriveSafe UK**
   - Tap **"Display over other apps"** (or "Appear on top")
   - Toggle **ON**
   
   **Alternative path:**
   - Settings → Apps → Special access → Display over other apps
   - Find "DriveSafe UK" and enable

3. **Verify Permission:**
   - Return to DriveSafe UK app
   - The "Driving Mode + Overlay" toggle should now work

---

## 🚗 TESTING THE OVERLAY

### Start the Overlay Service

1. Open **DriveSafe UK** app
2. Tap **"Driving Mode + Overlay"** toggle (should turn green)
3. You'll see:
   - A **persistent notification** "DriveSafe UK Active"
   - A **floating pill/bubble** at the top of screen

### Overlay States

**Collapsed (Pill/Bubble):**
- Shows: Status dot + "Alerts ON" + Speed + Report button
- Tap anywhere on the pill to **expand**

**Expanded (Full Widget):**
- Shows: Large speed display + Next camera info + Report buttons
- Tap the **up arrow** to collapse

### Test Overlay Stays on Top

1. With overlay active, press **Home** button
2. Open **Google Maps** or **Uber**
3. ✅ Verify: Overlay remains visible on top
4. ✅ Verify: You can still tap the Report button
5. Turn **screen off**, then **on** again
6. ✅ Verify: Overlay reappears (may take a few seconds)

### Test Report Buttons

1. In collapsed mode: Tap **"Report"** button
2. Or expand and tap **"Mobile Cam"** or **"Police Check"**
3. ✅ Verify: You see "Reported. Thanks!" feedback

---

## ✅ ACCEPTANCE CRITERIA CHECKLIST

| Criteria | How to Test |
|----------|-------------|
| Overlay enabled | Tap "Driving Mode + Overlay" - should turn green |
| Stays on top of other apps | Open Uber/Maps - overlay visible |
| Collapsed state | See small pill at top |
| Expanded state | Tap pill to expand |
| Draggable | Long-press and drag the overlay |
| Survives app switch | Press Home, open other app |
| Survives screen off/on | Turn screen off, then on |
| Clear ON/OFF control | Toggle "Driving Mode + Overlay" |
| 1-tap report (collapsed) | Tap "Report" on pill |
| Report options (expanded) | Tap "Mobile Cam" or "Police Check" |
| GPS speed display | Check speed number updates while moving |
| Next camera distance | When near a camera, shows distance |

---

## 🔧 TROUBLESHOOTING

### Overlay Not Appearing
1. Check "Display over other apps" permission is ON
2. Check notification says "DriveSafe UK Active"
3. Try: Kill app completely, reopen, toggle Driving Mode

### Overlay Disappears After Screen Off
1. Go to Settings → Apps → DriveSafe UK → Battery
2. Set to **"Unrestricted"** or disable battery optimization
3. Some phones: Settings → Battery → Battery optimization → DriveSafe UK → Don't optimize

### Build Fails with AAPT2 Error
- This happens on ARM64 Linux. Use:
  - Android Studio on macOS/Windows
  - Or EAS Build (cloud)

### Location Permission Issues
- Grant both "While using the app" AND "Always" location permissions
- For background alerts: must have "Always" permission

---

## 📁 FILE STRUCTURE

```
android/app/src/main/
├── java/com/drivesafe/uk/
│   ├── MainActivity.kt
│   ├── MainApplication.kt
│   └── overlay/
│       ├── OverlayService.kt      ← Foreground service + WindowManager
│       ├── OverlayModule.kt       ← React Native bridge
│       └── OverlayPackage.kt      ← Package registration
├── res/
│   ├── layout/
│   │   └── overlay_layout.xml    ← Floating widget layout
│   └── drawable/
│       ├── overlay_collapsed_bg.xml
│       ├── overlay_expanded_bg.xml
│       └── ... (button backgrounds)
└── AndroidManifest.xml           ← Permissions + service declaration
```

---

## 🎯 IMPLEMENTED FUNCTIONALITY

| Feature | Status |
|---------|--------|
| Floating overlay (collapsed + expanded) | ✅ Implemented |
| Stays on top of all apps | ✅ Implemented |
| Draggable positioning | ✅ Implemented |
| Foreground service with notification | ✅ Implemented |
| Report Mobile Camera button | ✅ Implemented |
| Report Police Check button | ✅ Implemented |
| Speed display (MPH) | ✅ Implemented |
| Next camera distance | ✅ Implemented |
| Voice alerts (TTS) | ✅ Implemented |
| Rate limiting (anti-spam) | ✅ Implemented |
| Duplicate report merging | ✅ Implemented |
| Report TTL expiry | ✅ Implemented |
| "Display over other apps" permission request | ✅ Implemented |
| Background location permission | ✅ Implemented |
| Onboarding flow | ✅ Implemented |

---

## 📞 BACKEND REQUIREMENT

The app requires the backend server running. Ensure:
- Backend is accessible from the device's network
- Update `EXPO_PUBLIC_BACKEND_URL` in `.env` if needed
- Default: `http://localhost:8001` (for local testing)

For production, deploy the backend and update the URL.
