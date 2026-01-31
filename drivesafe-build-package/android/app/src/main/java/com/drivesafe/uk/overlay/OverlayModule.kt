package com.drivesafe.uk.overlay

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class OverlayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OverlayModule"

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        try {
            val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(reactContext)
            } else {
                true
            }
            promise.resolve(hasPermission)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.canDrawOverlays(reactContext)) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${reactContext.packageName}")
                    )
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    reactContext.startActivity(intent)
                    promise.resolve(false) // User needs to grant permission
                } else {
                    promise.resolve(true)
                }
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun startOverlay(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
                promise.reject("PERMISSION_DENIED", "Overlay permission not granted")
                return
            }

            val intent = Intent(reactContext, OverlayService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }

            // Set up report callback
            OverlayService.reportCallback = { reportType ->
                val params = Arguments.createMap().apply {
                    putString("type", reportType)
                }
                sendEvent("onOverlayReport", params)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopOverlay(promise: Promise) {
        try {
            val intent = Intent(reactContext, OverlayService::class.java)
            reactContext.stopService(intent)
            OverlayService.reportCallback = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun updateSpeed(speed: Int) {
        OverlayService.instance?.updateSpeed(speed)
    }

    @ReactMethod
    fun updateNextCamera(distance: String, type: String) {
        OverlayService.instance?.updateNextCamera(distance, type)
    }

    @ReactMethod
    fun setAlertsEnabled(enabled: Boolean) {
        OverlayService.instance?.setAlertsEnabled(enabled)
    }

    @ReactMethod
    fun isOverlayRunning(promise: Promise) {
        promise.resolve(OverlayService.instance != null)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN event emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN event emitter
    }
}
