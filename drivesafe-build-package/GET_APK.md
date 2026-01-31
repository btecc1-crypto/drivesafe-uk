# DriveSafe UK - Get the APK

## ⚠️ Build Environment Limitation

The current cloud environment runs on ARM64 architecture, which is **incompatible** with Android's AAPT2 build tools (x86_64 only). 

**You must build the APK locally on your machine.**

---

## 📦 Download Source Package

**File:** `/app/drivesafe-android-build.tar.gz` (3.1MB)

---

## 🔨 BUILD APK LOCALLY (Choose One Method)

### Method 1: Android Studio (Easiest)

```bash
# 1. Extract the package
tar -xzvf drivesafe-android-build.tar.gz
cd drivesafe-build-package

# 2. Install dependencies
yarn install
# or: npm install

# 3. Open in Android Studio
# - Launch Android Studio
# - File → Open → Select the "android" folder
# - Wait for Gradle sync

# 4. Build APK
# - Build → Build Bundle(s) / APK(s) → Build APK(s)
# - Wait for build to complete

# 5. APK Location:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Method 2: Command Line (macOS/Linux/Windows WSL)

```bash
# Extract
tar -xzvf drivesafe-android-build.tar.gz
cd drivesafe-build-package

# Install JS dependencies
yarn install

# Build
cd android
chmod +x gradlew
./gradlew assembleDebug

# APK at: app/build/outputs/apk/debug/app-debug.apk
```

### Method 3: Use the Build Script

```bash
tar -xzvf drivesafe-android-build.tar.gz
cd drivesafe-build-package
chmod +x scripts/build-android.sh
./scripts/build-android.sh
```

### Method 4: GitHub Actions (CI/CD)

1. Push the code to a GitHub repository
2. The included `.github/workflows/build-android.yml` will automatically build
3. Download the APK from the Actions artifacts

---

## 📱 INSTALL APK ON PHONE

### Prerequisites on Android Phone:
1. **Enable Developer Options:** 
   - Settings → About Phone → Tap "Build Number" 7 times
   
2. **Enable USB Debugging:**
   - Settings → Developer Options → USB Debugging → ON

3. **Allow Unknown Sources:**
   - Settings → Security → Install unknown apps → Allow for file manager

### Install Methods:

**Option A: ADB (Recommended)**
```bash
# Connect phone via USB
adb devices  # Should show your device
adb install app-debug.apk
```

**Option B: Manual Transfer**
1. Connect phone to computer
2. Copy `app-debug.apk` to phone's Download folder
3. On phone: Open Files → Download → Tap `app-debug.apk` → Install

---

## 🎯 OVERLAY TESTING PROCEDURE

### 1. Grant "Display Over Other Apps" Permission

When you first tap "Driving Mode + Overlay":
- App will redirect to system settings
- Find "DriveSafe UK" in the list
- Toggle ON "Display over other apps"
- Press Back to return to app

**Manual path:** Settings → Apps → Special access → Display over other apps → DriveSafe UK → ON

### 2. Start the Overlay

1. Open DriveSafe UK app
2. Tap the **"Driving Mode + Overlay"** toggle
3. Toggle should turn **green**
4. You'll see:
   - A **notification** "DriveSafe UK Active"
   - A **floating pill** at the top of screen

### 3. Test Overlay Stays on Top

| Test | Action | Expected |
|------|--------|----------|
| Home screen | Press Home button | Overlay visible ✅ |
| Open Uber | Launch Uber app | Overlay on top ✅ |
| Open Google Maps | Launch Maps | Overlay on top ✅ |
| Screen off/on | Lock then unlock | Overlay returns ✅ |
| App switch | Use recent apps | Overlay persists ✅ |

### 4. Test Overlay Functions

**Collapsed Mode (Pill):**
- Shows: Green dot + "Alerts ON" + Speed + "Report" button
- Tap pill to expand
- Tap "Report" for quick mobile camera report

**Expanded Mode:**
- Shows: Large speed display + Next camera info
- Tap "Mobile Cam" to report mobile camera
- Tap "Police Check" to report police
- Tap "Open Full App" to return to main app
- Tap up arrow (↑) to collapse

---

## ✅ WHAT'S IMPLEMENTED

| Feature | Status |
|---------|--------|
| Floating overlay (WindowManager) | ✅ |
| Collapsed pill state | ✅ |
| Expanded widget state | ✅ |
| Stays on top of ALL apps | ✅ |
| Draggable positioning | ✅ |
| Foreground service | ✅ |
| Persistent notification | ✅ |
| Report Mobile Camera | ✅ |
| Report Police Check | ✅ |
| Speed display (MPH) | ✅ |
| Next camera distance | ✅ |
| Voice alerts (TTS) | ✅ |
| Background location | ✅ |
| Rate limiting | ✅ |
| Duplicate merging | ✅ |

---

## 🔧 TROUBLESHOOTING

### "Display over other apps" not appearing
- On some phones: Settings → Apps → DriveSafe UK → Advanced → Display over other apps

### Overlay disappears after screen off
- Disable battery optimization for DriveSafe UK
- Settings → Apps → DriveSafe UK → Battery → Unrestricted

### Build fails with "AAPT2" error
- Ensure you're building on x86_64 machine (not ARM)
- Use Android Studio on macOS/Windows
- Or use GitHub Actions cloud build

### App crashes on launch
- Ensure all permissions are granted (Location, Overlay)
- Check that backend server is accessible
