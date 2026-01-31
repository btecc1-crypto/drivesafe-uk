package com.drivesafe.uk.overlay

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import com.drivesafe.uk.R
import com.drivesafe.uk.MainActivity

class OverlayService : Service() {

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var isExpanded = false
    private var currentSpeed = 0
    private var nextCameraDistance = "--"
    private var nextCameraType = ""
    private var alertsEnabled = true

    companion object {
        const val CHANNEL_ID = "DriveSafeOverlayChannel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_UPDATE_SPEED = "com.drivesafe.uk.UPDATE_SPEED"
        const val ACTION_UPDATE_CAMERA = "com.drivesafe.uk.UPDATE_CAMERA"
        const val ACTION_TOGGLE_ALERTS = "com.drivesafe.uk.TOGGLE_ALERTS"
        const val ACTION_REPORT_MOBILE = "com.drivesafe.uk.REPORT_MOBILE"
        const val ACTION_REPORT_POLICE = "com.drivesafe.uk.REPORT_POLICE"
        const val EXTRA_SPEED = "speed"
        const val EXTRA_DISTANCE = "distance"
        const val EXTRA_TYPE = "type"
        const val EXTRA_ALERTS_ENABLED = "alerts_enabled"

        var instance: OverlayService? = null
        var reportCallback: ((String) -> Unit)? = null
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        createOverlayView()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.let {
            when (it.action) {
                ACTION_UPDATE_SPEED -> {
                    currentSpeed = it.getIntExtra(EXTRA_SPEED, 0)
                    updateOverlayUI()
                }
                ACTION_UPDATE_CAMERA -> {
                    nextCameraDistance = it.getStringExtra(EXTRA_DISTANCE) ?: "--"
                    nextCameraType = it.getStringExtra(EXTRA_TYPE) ?: ""
                    updateOverlayUI()
                }
                ACTION_TOGGLE_ALERTS -> {
                    alertsEnabled = it.getBooleanExtra(EXTRA_ALERTS_ENABLED, true)
                    updateOverlayUI()
                }
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        removeOverlayView()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "DriveSafe Overlay",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows speed camera alerts while driving"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("DriveSafe UK Active")
            .setContentText("Speed camera alerts enabled")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createOverlayView() {
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

        val layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = 50
        }

        overlayView = LayoutInflater.from(this).inflate(R.layout.overlay_layout, null)
        setupOverlayListeners()
        updateOverlayUI()

        try {
            windowManager?.addView(overlayView, layoutParams)
            setupDragListener(layoutParams)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupOverlayListeners() {
        overlayView?.apply {
            // Collapsed view click to expand
            findViewById<View>(R.id.collapsedView)?.setOnClickListener {
                toggleExpanded()
            }

            // Expanded view collapse button
            findViewById<View>(R.id.collapseBtn)?.setOnClickListener {
                toggleExpanded()
            }

            // Quick report button in collapsed view
            findViewById<View>(R.id.quickReportBtn)?.setOnClickListener {
                reportCallback?.invoke("mobile_camera")
            }

            // Report mobile camera button
            findViewById<View>(R.id.reportMobileBtn)?.setOnClickListener {
                reportCallback?.invoke("mobile_camera")
            }

            // Report police check button
            findViewById<View>(R.id.reportPoliceBtn)?.setOnClickListener {
                reportCallback?.invoke("police_check")
            }

            // Open app button
            findViewById<View>(R.id.openAppBtn)?.setOnClickListener {
                val intent = Intent(this@OverlayService, MainActivity::class.java)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                startActivity(intent)
            }
        }
    }

    private fun setupDragListener(layoutParams: WindowManager.LayoutParams) {
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f

        overlayView?.findViewById<View>(R.id.dragHandle)?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = layoutParams.x
                    initialY = layoutParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    layoutParams.x = initialX + (event.rawX - initialTouchX).toInt()
                    layoutParams.y = initialY + (event.rawY - initialTouchY).toInt()
                    windowManager?.updateViewLayout(overlayView, layoutParams)
                    true
                }
                else -> false
            }
        }
    }

    private fun toggleExpanded() {
        isExpanded = !isExpanded
        updateOverlayUI()
    }

    private fun updateOverlayUI() {
        overlayView?.apply {
            val collapsedView = findViewById<View>(R.id.collapsedView)
            val expandedView = findViewById<View>(R.id.expandedView)

            if (isExpanded) {
                collapsedView?.visibility = View.GONE
                expandedView?.visibility = View.VISIBLE

                // Update expanded view
                findViewById<TextView>(R.id.speedText)?.text = "$currentSpeed"
                findViewById<TextView>(R.id.speedUnit)?.text = "MPH"
                
                val cameraInfoText = if (nextCameraDistance != "--" && nextCameraType.isNotEmpty()) {
                    "Next: $nextCameraType • $nextCameraDistance"
                } else {
                    "Road clear ahead"
                }
                findViewById<TextView>(R.id.cameraInfo)?.text = cameraInfoText

                val statusIndicator = findViewById<View>(R.id.statusIndicator)
                statusIndicator?.setBackgroundResource(
                    if (alertsEnabled) R.drawable.status_active else R.drawable.status_inactive
                )
            } else {
                collapsedView?.visibility = View.VISIBLE
                expandedView?.visibility = View.GONE

                // Update collapsed view
                val statusText = if (alertsEnabled) "Alerts ON" else "Alerts OFF"
                findViewById<TextView>(R.id.statusText)?.text = statusText
                findViewById<TextView>(R.id.miniSpeed)?.text = "$currentSpeed mph"

                val statusDot = findViewById<View>(R.id.statusDot)
                statusDot?.setBackgroundResource(
                    if (alertsEnabled) R.drawable.status_active else R.drawable.status_inactive
                )
            }
        }
    }

    private fun removeOverlayView() {
        overlayView?.let {
            try {
                windowManager?.removeView(it)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        overlayView = null
    }

    fun updateSpeed(speed: Int) {
        currentSpeed = speed
        updateOverlayUI()
    }

    fun updateNextCamera(distance: String, type: String) {
        nextCameraDistance = distance
        nextCameraType = type
        updateOverlayUI()
    }

    fun setAlertsEnabled(enabled: Boolean) {
        alertsEnabled = enabled
        updateOverlayUI()
    }
}
