#!/bin/bash

# DriveSafe UK - Local Android Build Script
# Run this on a machine with Android Studio installed

set -e

echo "========================================"
echo "DriveSafe UK - Android APK Build Script"
echo "========================================"
echo ""

# Check prerequisites
if ! command -v java &> /dev/null; then
    echo "ERROR: Java is not installed. Please install JDK 17+"
    exit 1
fi

if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
    echo "WARNING: ANDROID_HOME or ANDROID_SDK_ROOT not set"
    echo "Trying common locations..."
    
    if [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    elif [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
    elif [ -d "/usr/local/android-sdk" ]; then
        export ANDROID_HOME="/usr/local/android-sdk"
    else
        echo "ERROR: Android SDK not found. Please install Android Studio."
        exit 1
    fi
    echo "Found Android SDK at: $ANDROID_HOME"
fi

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Project directory: $PROJECT_DIR"

# Install JS dependencies
echo ""
echo "[1/3] Installing JavaScript dependencies..."
cd "$PROJECT_DIR"
if command -v yarn &> /dev/null; then
    yarn install
else
    npm install
fi

# Build Android APK
echo ""
echo "[2/3] Building Android Debug APK..."
cd "$PROJECT_DIR/android"
chmod +x gradlew
./gradlew assembleDebug --no-daemon

# Check output
APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    echo ""
    echo "========================================"
    echo "BUILD SUCCESSFUL!"
    echo "========================================"
    echo ""
    echo "APK Location: $APK_PATH"
    echo "APK Size: $(du -h "$APK_PATH" | cut -f1)"
    echo ""
    echo "[3/3] To install on connected device:"
    echo "  adb install $APK_PATH"
    echo ""
    echo "Or copy the APK to your phone and install manually."
else
    echo ""
    echo "ERROR: Build failed. APK not found."
    exit 1
fi
