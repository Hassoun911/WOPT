package ca.hassoun.wear.data

import android.app.Activity
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.View
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

class QiblaCompassActivity : Activity(), SensorEventListener {
    private lateinit var sensorManager: SensorManager
    private lateinit var compassView: CompassView
    private var targetBearing = 0f
    private var hasTarget = false
    private var lastAligned = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WatchDataStore.location(this)?.let { (lat, lon) ->
            targetBearing = qiblaBearing(lat, lon).toFloat()
            hasTarget = true
        }

        compassView = CompassView(this).apply {
            target = targetBearing
            targetAvailable = hasTarget
            setOnClickListener { finish() }
        }
        setContentView(compassView)
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    }

    override fun onResume() {
        super.onResume()
        val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
            ?: sensorManager.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR)
        if (sensor != null) {
            sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_UI)
        }
    }

    override fun onPause() {
        sensorManager.unregisterListener(this)
        super.onPause()
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!hasTarget) return
        val rotation = FloatArray(9)
        val orientation = FloatArray(3)
        SensorManager.getRotationMatrixFromVector(rotation, event.values)
        SensorManager.getOrientation(rotation, orientation)
        val heading = ((Math.toDegrees(orientation[0].toDouble()) + 360.0) % 360.0).toFloat()
        compassView.heading = heading
        val aligned = abs(shortestDelta(targetBearing, heading)) <= ALIGNMENT_DEGREES
        compassView.aligned = aligned
        compassView.invalidate()

        if (aligned && !lastAligned) {
            runCatching {
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                vibrator.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
            }
        }
        lastAligned = aligned
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun shortestDelta(target: Float, heading: Float): Float {
        return ((target - heading + 540f) % 360f) - 180f
    }

    private fun qiblaBearing(latitude: Double, longitude: Double): Double {
        val kaabaLat = Math.toRadians(21.422487)
        val kaabaLon = Math.toRadians(39.826206)
        val userLat = Math.toRadians(latitude)
        val userLon = Math.toRadians(longitude)
        val deltaLon = kaabaLon - userLon
        val y = sin(deltaLon) * cos(kaabaLat)
        val x = cos(userLat) * sin(kaabaLat) - sin(userLat) * cos(kaabaLat) * cos(deltaLon)
        return (Math.toDegrees(atan2(y, x)) + 360.0) % 360.0
    }

    private inner class CompassView(context: Context) : View(context) {
        var target = 0f
        var heading = 0f
        var aligned = false
        var targetAvailable = false
        private var flashOn = true
        private val handler = Handler(Looper.getMainLooper())
        private val flashRunnable = object : Runnable {
            override fun run() {
                flashOn = !flashOn
                invalidate()
                handler.postDelayed(this, 280)
            }
        }

        private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 11f
        }
        private val thinRingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 2f
            color = Color.rgb(80, 220, 110)
        }
        private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }
        private val arrowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
        }

        init {
            handler.post(flashRunnable)
        }

        override fun onDetachedFromWindow() {
            handler.removeCallbacks(flashRunnable)
            super.onDetachedFromWindow()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            canvas.drawColor(Color.BLACK)

            val cx = width / 2f
            val cy = height / 2f
            val radius = min(width, height) * 0.45f
            val blue = Color.rgb(0, 145, 255)
            val green = Color.rgb(80, 235, 115)

            ringPaint.color = if (aligned && flashOn) blue else green
            canvas.drawCircle(cx, cy, radius, ringPaint)
            canvas.drawCircle(cx, cy, radius - 16f, thinRingPaint)

            textPaint.color = Color.WHITE
            textPaint.textSize = radius * 0.12f
            canvas.drawText("N", cx, cy - radius + 32f, textPaint)
            canvas.drawText("S", cx, cy + radius - 18f, textPaint)
            canvas.drawText("W", cx - radius + 24f, cy + 8f, textPaint)
            canvas.drawText("E", cx + radius - 24f, cy + 8f, textPaint)

            if (!targetAvailable) {
                textPaint.color = green
                textPaint.textSize = radius * 0.12f
                canvas.drawText("QIBLA SETUP", cx, cy - 12f, textPaint)
                textPaint.color = Color.WHITE
                textPaint.textSize = radius * 0.07f
                canvas.drawText("Open Hassoun Watch Data", cx, cy + 26f, textPaint)
                canvas.drawText("and connect location", cx, cy + 52f, textPaint)
                return
            }

            textPaint.color = green
            textPaint.textSize = radius * 0.10f
            canvas.drawText("QIBLA", cx, cy - radius * 0.42f, textPaint)
            textPaint.color = Color.WHITE
            textPaint.textSize = radius * 0.22f
            canvas.drawText("${target.toInt()}°", cx, cy - radius * 0.18f, textPaint)

            val delta = shortestDelta(target, heading)
            val angle = Math.toRadians((delta - 90f).toDouble())
            val arrowLength = radius * 0.42f
            val tipX = cx + cos(angle).toFloat() * arrowLength
            val tipY = cy + sin(angle).toFloat() * arrowLength
            val side = radius * 0.09f
            val backX = cx - cos(angle).toFloat() * side
            val backY = cy - sin(angle).toFloat() * side
            val perpX = -sin(angle).toFloat() * side
            val perpY = cos(angle).toFloat() * side

            val path = Path().apply {
                moveTo(tipX, tipY)
                lineTo(backX + perpX, backY + perpY)
                lineTo(backX - perpX, backY - perpY)
                close()
            }
            arrowPaint.color = if (aligned) blue else Color.WHITE
            canvas.drawPath(path, arrowPaint)

            textPaint.color = if (aligned) blue else green
            textPaint.textSize = radius * 0.09f
            val status = if (aligned) "ALIGNED" else if (delta > 0) "TURN RIGHT" else "TURN LEFT"
            canvas.drawText(status, cx, cy + radius * 0.54f, textPaint)
            textPaint.color = Color.WHITE
            textPaint.textSize = radius * 0.065f
            val detail = if (aligned) "Facing Qibla • tap to close" else "${abs(delta).toInt()}° • tap to close"
            canvas.drawText(detail, cx, cy + radius * 0.70f, textPaint)
        }
    }

    companion object {
        private const val ALIGNMENT_DEGREES = 5f
    }
}
