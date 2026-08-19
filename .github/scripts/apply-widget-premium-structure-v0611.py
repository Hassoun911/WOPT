from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[2]
ANDROID = ROOT / "mobile/modules/hassoun-widget/android/src/main"
JAVA_DIR = ANDROID / "java/ca/wopt/hassounwidget"
RES = ANDROID / "res"
LAYOUT = RES / "layout"
PROVIDER = JAVA_DIR / "HassounPrayerWidgetProvider.kt"
RENDERER = JAVA_DIR / "HassounWidgetBitmapRenderer.kt"


def write(path: Path, text: str):
    path.write_text(dedent(text).lstrip(), encoding="utf-8")


# ---------------------------------------------------------------------------
# Premium bitmap renderer. Android RemoteViews is used only as the host;
# all typography/cards/icons are drawn as one controlled canvas so Samsung's
# launcher cannot reflow the mockup into ugly wrapped TextViews.
# ---------------------------------------------------------------------------
write(RENDERER, r'''
package ca.wopt.hassounwidget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

internal data class WidgetRenderPrayer(
  val key: String,
  val english: String,
  val arabic: String,
  val time: String,
  val active: Boolean
)

internal data class WidgetRenderState(
  val layout: String,
  val dark: Boolean,
  val showLogo: Boolean,
  val showArabic: Boolean,
  val showGregorian: Boolean,
  val showHijri: Boolean,
  val dateText: String,
  val hijriText: String,
  val nextPrayer: String,
  val nextArabic: String,
  val nextTime: String,
  val nextSuffix: String,
  val prayers: List<WidgetRenderPrayer>,
  val textScale: Float
)

internal object HassounWidgetBitmapRenderer {
  private data class Palette(
    val bg: Int,
    val card: Int,
    val activeCard: Int,
    val text: Int,
    val muted: Int,
    val gold: Int,
    val border: Int,
    val activeBorder: Int,
    val silhouette: Int
  )

  fun render(context: Context, widthDp: Int, heightDp: Int, state: WidgetRenderState): Bitmap {
    val w = widthDp.coerceIn(90, 420)
    val h = heightDp.coerceIn(60, 460)
    val maxPixels = 180000.0
    val rawPixels = (w * h).toDouble().coerceAtLeast(1.0)
    val scale = min(2.0, sqrt(maxPixels / rawPixels)).coerceAtLeast(1.0).toFloat()
    val bitmap = Bitmap.createBitmap((w * scale).roundToInt(), (h * scale).roundToInt(), Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.scale(scale, scale)
    val p = palette(state.dark)

    when (state.layout) {
      "vertical" -> drawVertical(context, canvas, w.toFloat(), h.toFloat(), state, p)
      "square" -> drawSquare(context, canvas, w.toFloat(), h.toFloat(), state, p)
      "slim" -> drawSlim(context, canvas, w.toFloat(), h.toFloat(), state, p)
      else -> drawLarge(context, canvas, w.toFloat(), h.toFloat(), state, p)
    }
    return bitmap
  }

  private fun palette(dark: Boolean): Palette = if (dark) {
    Palette(
      bg = Color.rgb(8, 43, 38),
      card = Color.rgb(14, 57, 50),
      activeCard = Color.rgb(20, 75, 64),
      text = Color.rgb(248, 242, 228),
      muted = Color.rgb(210, 187, 130),
      gold = Color.rgb(216, 180, 105),
      border = Color.rgb(118, 91, 48),
      activeBorder = Color.rgb(216, 180, 105),
      silhouette = Color.argb(38, 226, 211, 167)
    )
  } else {
    Palette(
      bg = Color.rgb(251, 248, 239),
      card = Color.rgb(255, 253, 248),
      activeCard = Color.rgb(239, 245, 235),
      text = Color.rgb(24, 74, 60),
      muted = Color.rgb(145, 105, 56),
      gold = Color.rgb(183, 139, 69),
      border = Color.rgb(225, 213, 185),
      activeBorder = Color.rgb(138, 164, 121),
      silhouette = Color.argb(34, 105, 126, 105)
    )
  }

  private fun baseCanvas(canvas: Canvas, w: Float, h: Float, p: Palette, radius: Float) {
    val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(24, 0, 0, 0) }
    canvas.drawRoundRect(RectF(2f, 3f, w - 2f, h - 1f), radius, radius, shadow)
    val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.bg }
    canvas.drawRoundRect(RectF(1f, 1f, w - 1f, h - 2f), radius, radius, bg)
    val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = 1.2f
      color = p.gold
    }
    canvas.drawRoundRect(RectF(1f, 1f, w - 1f, h - 2f), radius, radius, border)
  }

  private fun drawLarge(context: Context, c: Canvas, w: Float, h: Float, s: WidgetRenderState, p: Palette) {
    baseCanvas(c, w, h, p, 18f)
    val pad = 12f
    val headerH = 36f
    val bottomH = (h * 0.29f).coerceIn(52f, 66f)
    val heroTop = headerH + 6f
    val heroBottom = h - bottomH - 8f

    drawBrand(context, c, pad, 7f, w, s, p, 32f, 13.5f, 5.5f)
    drawDate(c, w - pad, 13f, s, p, 6.2f, 5.3f)
    drawMosqueBackdrop(c, RectF(pad + 3f, heroTop + 10f, w - pad - 3f, heroBottom - 2f), p.silhouette)

    val label = paintSans(p.gold, 7.2f * s.textScale, true)
    c.drawText("NEXT PRAYER", pad + 5f, heroTop + 17f, label)

    val namePaint = paintSerif(p.text, 34f * s.textScale, false)
    fitText(namePaint, s.nextPrayer, w * 0.33f, 34f * s.textScale, 24f)
    c.drawText(s.nextPrayer, pad + 5f, heroTop + 50f, namePaint)
    if (s.showArabic && s.nextArabic.isNotBlank()) {
      val ar = paintSans(p.muted, 9f * s.textScale, false)
      c.drawText(s.nextArabic, pad + 5f, heroTop + 67f, ar)
    }

    val rightX = w - pad - 5f
    val adhan = paintSans(p.gold, 6.8f, true).apply { textAlign = Paint.Align.RIGHT }
    c.drawText("ADHAN", rightX, heroTop + 20f, adhan)
    val suffixPaint = paintSerif(p.text, 10f * s.textScale, false).apply { textAlign = Paint.Align.RIGHT }
    val suffixW = suffixPaint.measureText(s.nextSuffix)
    val timePaint = paintSerif(p.text, 34f * s.textScale, false).apply { textAlign = Paint.Align.RIGHT }
    fitText(timePaint, s.nextTime, w * 0.27f, 34f * s.textScale, 24f)
    val timeBaseline = heroTop + 55f
    c.drawText(s.nextSuffix, rightX, timeBaseline + 1f, suffixPaint)
    c.drawText(s.nextTime, rightX - suffixW - 5f, timeBaseline, timePaint)

    drawLargePrayerCards(c, w, h, bottomH, s, p)
  }

  private fun drawLargePrayerCards(c: Canvas, w: Float, h: Float, bottomH: Float, s: WidgetRenderState, p: Palette) {
    val pad = 8f
    val gap = 3f
    val top = h - bottomH - 2f
    val available = w - pad * 2 - gap * 4
    val cardW = available / 5f
    s.prayers.take(5).forEachIndexed { index, prayer ->
      val left = pad + index * (cardW + gap)
      val rect = RectF(left, top, left + cardW, h - 8f)
      drawCard(c, rect, prayer.active, p, 12f)
      val cx = rect.centerX()
      drawPrayerIcon(c, prayer.key, cx, rect.top + 12f, 5.5f, if (prayer.active) p.activeBorder else p.gold, p.card)
      val title = paintSans(p.text, 6.9f * s.textScale, true).apply { textAlign = Paint.Align.CENTER }
      c.drawText(prayer.english, cx, rect.top + 27f, title)
      if (s.showArabic) {
        val ar = paintSans(p.text, 6.1f * s.textScale, false).apply { textAlign = Paint.Align.CENTER }
        c.drawText(prayer.arabic, cx, rect.top + 38f, ar)
      }
      val tm = paintSans(p.text, 6.8f * s.textScale, true).apply { textAlign = Paint.Align.CENTER }
      c.drawText(prayer.time, cx, rect.bottom - 8f, tm)
    }
  }

  private fun drawVertical(context: Context, c: Canvas, w: Float, h: Float, s: WidgetRenderState, p: Palette) {
    baseCanvas(c, w, h, p, 17f)
    val pad = 8f
    drawBrand(context, c, pad, 6f, w, s, p, 27f, 10.5f, 4.4f)
    drawDate(c, w - pad, 11f, s, p, 5.1f, 4.4f)

    val heroTop = 38f
    val heroBottom = (h * 0.43f).coerceIn(135f, 165f)
    drawMosqueBackdrop(c, RectF(pad, heroTop + 8f, w - pad, heroBottom), p.silhouette)
    val label = paintSans(p.gold, 6.3f, true)
    c.drawText("NEXT PRAYER", pad + 5f, heroTop + 14f, label)
    val name = paintSerif(p.text, 29f * s.textScale, false)
    fitText(name, s.nextPrayer, w - 2 * pad - 10f, 29f * s.textScale, 22f)
    c.drawText(s.nextPrayer, pad + 5f, heroTop + 43f, name)
    if (s.showArabic) {
      val ar = paintSans(p.muted, 7.5f, false)
      c.drawText(s.nextArabic, pad + 5f, heroTop + 57f, ar)
    }

    val right = w - pad - 6f
    val adhan = paintSans(p.gold, 5.5f, true).apply { textAlign = Paint.Align.RIGHT }
    c.drawText("ADHAN", right, heroTop + 78f, adhan)
    val suffix = paintSerif(p.text, 7.5f, false).apply { textAlign = Paint.Align.RIGHT }
    val sw = suffix.measureText(s.nextSuffix)
    val time = paintSerif(p.text, 25f * s.textScale, false).apply { textAlign = Paint.Align.RIGHT }
    fitText(time, s.nextTime, w * 0.43f, 25f * s.textScale, 19f)
    val by = heroTop + 104f
    c.drawText(s.nextSuffix, right, by, suffix)
    c.drawText(s.nextTime, right - sw - 3f, by, time)

    val rowsTop = heroBottom + 6f
    val gap = 4f
    val rowH = ((h - rowsTop - 8f - gap * 4) / 5f).coerceAtLeast(31f)
    s.prayers.take(5).forEachIndexed { i, prayer ->
      val top = rowsTop + i * (rowH + gap)
      val rect = RectF(pad, top, w - pad, (top + rowH).coerceAtMost(h - 8f))
      drawCard(c, rect, prayer.active, p, 11f)
      drawPrayerIcon(c, prayer.key, rect.left + 14f, rect.centerY(), 5.8f, if (prayer.active) p.activeBorder else p.gold, p.card)
      val title = paintSans(p.text, 8.6f * s.textScale, true)
      c.drawText(prayer.english, rect.left + 26f, rect.centerY() - 2f, title)
      if (s.showArabic) {
        val ar = paintSans(p.text, 7f * s.textScale, false).apply { textAlign = Paint.Align.CENTER }
        c.drawText(prayer.arabic, rect.centerX() + 10f, rect.centerY() + 2f, ar)
      }
      val tm = paintSans(p.text, 8.2f * s.textScale, true).apply { textAlign = Paint.Align.RIGHT }
      c.drawText(prayer.time, rect.right - 8f, rect.centerY() + 3f, tm)
    }
  }

  private fun drawSquare(context: Context, c: Canvas, w: Float, h: Float, s: WidgetRenderState, p: Palette) {
    baseCanvas(c, w, h, p, 17f)
    val pad = 8f
    drawBrand(context, c, pad, 6f, w, s, p, 26f, 10.5f, 4.3f)
    drawDecorativeMoon(c, w - 18f, 20f, p)
    val label = paintSans(p.gold, 6f, true)
    c.drawText("NEXT PRAYER", pad + 3f, 45f, label)
    val name = paintSerif(p.text, 28f * s.textScale, false)
    fitText(name, s.nextPrayer, w - 2 * pad, 28f * s.textScale, 21f)
    c.drawText(s.nextPrayer, pad + 3f, 73f, name)
    if (s.showArabic) c.drawText(s.nextArabic, pad + 3f, 86f, paintSans(p.muted, 7f, false))

    val right = w - pad - 3f
    c.drawText("ADHAN", right, 104f, paintSans(p.gold, 5.5f, true).apply { textAlign = Paint.Align.RIGHT })
    val suffix = paintSerif(p.text, 7f, false).apply { textAlign = Paint.Align.RIGHT }
    val sw = suffix.measureText(s.nextSuffix)
    val time = paintSerif(p.text, 23f * s.textScale, false).apply { textAlign = Paint.Align.RIGHT }
    fitText(time, s.nextTime, w * 0.42f, 23f * s.textScale, 18f)
    c.drawText(s.nextSuffix, right, 128f, suffix)
    c.drawText(s.nextTime, right - sw - 3f, 128f, time)

    val cardsTop = h - 46f
    val gap = 2f
    val cardW = (w - 2 * pad - 4 * gap) / 5f
    s.prayers.take(5).forEachIndexed { i, prayer ->
      val l = pad + i * (cardW + gap)
      val rect = RectF(l, cardsTop, l + cardW, h - 7f)
      drawCard(c, rect, prayer.active, p, 8f)
      val cx = rect.centerX()
      drawPrayerIcon(c, prayer.key, cx, rect.top + 9f, 4f, if (prayer.active) p.activeBorder else p.gold, p.card)
      val nm = paintSans(p.text, 4.8f, true).apply { textAlign = Paint.Align.CENTER }
      c.drawText(prayer.english, cx, rect.top + 20f, nm)
      val tm = paintSans(p.text, 4.7f, true).apply { textAlign = Paint.Align.CENTER }
      c.drawText(prayer.time.substringBefore(" "), cx, rect.bottom - 5f, tm)
    }
  }

  private fun drawSlim(context: Context, c: Canvas, w: Float, h: Float, s: WidgetRenderState, p: Palette) {
    baseCanvas(c, w, h, p, 15f)
    val pad = 7f
    if (s.showLogo) drawLogo(context, c, pad, (h - 28f) / 2f, 28f)
    val brandX = if (s.showLogo) 40f else pad
    c.drawText("HASSOUN", brandX, h * 0.36f, paintSerif(p.text, 9f, true))
    c.drawText("WINDSOR • CANADA", brandX, h * 0.53f, paintSans(p.muted, 3.8f, true))

    val nextX = w * 0.27f
    c.drawText("NEXT", nextX, h * 0.28f, paintSans(p.gold, 4.4f, true))
    val name = paintSerif(p.text, 12f * s.textScale, false)
    fitText(name, s.nextPrayer, w * 0.17f, 12f * s.textScale, 9f)
    c.drawText(s.nextPrayer, nextX, h * 0.52f, name)
    if (s.showArabic) c.drawText(s.nextArabic, nextX, h * 0.70f, paintSans(p.muted, 4.4f, false))

    val timeX = w * 0.62f
    c.drawText("ADHAN", timeX, h * 0.29f, paintSans(p.gold, 4.2f, true))
    val tm = paintSerif(p.text, 15f * s.textScale, false)
    c.drawText(s.nextTime, timeX, h * 0.57f, tm)
    c.drawText(s.nextSuffix, timeX, h * 0.72f, paintSerif(p.text, 5.5f, false))

    val stripLeft = w * 0.73f
    val cardW = (w - stripLeft - 6f) / 5f
    s.prayers.take(5).forEachIndexed { i, prayer ->
      val rect = RectF(stripLeft + i * cardW, 9f, stripLeft + (i + 1) * cardW - 1f, h - 9f)
      drawCard(c, rect, prayer.active, p, 6f)
      val cx = rect.centerX()
      drawPrayerIcon(c, prayer.key, cx, rect.top + 9f, 3.2f, if (prayer.active) p.activeBorder else p.gold, p.card)
      c.drawText(prayer.english.take(3), cx, rect.top + 20f, paintSans(p.text, 3.6f, true).apply { textAlign = Paint.Align.CENTER })
      c.drawText(prayer.time.substringBefore(" "), cx, rect.bottom - 5f, paintSans(p.text, 3.5f, true).apply { textAlign = Paint.Align.CENTER })
    }
  }

  private fun drawBrand(context: Context, c: Canvas, x: Float, y: Float, w: Float, s: WidgetRenderState, p: Palette, logo: Float, brandSize: Float, subSize: Float) {
    var tx = x
    if (s.showLogo) {
      drawLogo(context, c, x, y, logo)
      tx += logo + 8f
    }
    c.drawText("HASSOUN", tx, y + brandSize + 1f, paintSerif(p.text, brandSize, true))
    c.drawText("WINDSOR • CANADA", tx, y + brandSize + subSize + 6f, paintSans(p.gold, subSize, true))
  }

  private fun drawDate(c: Canvas, x: Float, y: Float, s: WidgetRenderState, p: Palette, dateSize: Float, hijriSize: Float) {
    if (s.showGregorian && s.dateText.isNotBlank()) {
      c.drawText(s.dateText, x, y + dateSize, paintSans(p.text, dateSize, true).apply { textAlign = Paint.Align.RIGHT })
    }
    if (s.showHijri && s.hijriText.isNotBlank()) {
      c.drawText(s.hijriText, x, y + dateSize + hijriSize + 3f, paintSans(p.muted, hijriSize, false).apply { textAlign = Paint.Align.RIGHT })
    }
  }

  private fun drawLogo(context: Context, c: Canvas, x: Float, y: Float, size: Float) {
    try {
      val d = context.getDrawable(R.drawable.hassoun_widget_logo) ?: return
      d.setBounds(x.roundToInt(), y.roundToInt(), (x + size).roundToInt(), (y + size).roundToInt())
      d.draw(c)
    } catch (_: Exception) { }
  }

  private fun drawCard(c: Canvas, rect: RectF, active: Boolean, p: Palette, radius: Float) {
    val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = if (active) p.activeCard else p.card }
    c.drawRoundRect(rect, radius, radius, fill)
    val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = if (active) 1.4f else 0.9f
      color = if (active) p.activeBorder else p.border
    }
    c.drawRoundRect(rect, radius, radius, line)
  }

  private fun drawMosqueBackdrop(c: Canvas, rect: RectF, color: Int) {
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
    val base = rect.bottom
    val center = rect.centerX()
    c.drawRect(rect.left + rect.width() * 0.18f, base - rect.height() * 0.13f, rect.right - rect.width() * 0.18f, base, paint)
    c.drawCircle(center, base - rect.height() * 0.13f, rect.height() * 0.18f, paint)
    c.drawRect(center - rect.width() * 0.04f, base - rect.height() * 0.43f, center + rect.width() * 0.04f, base, paint)
    c.drawCircle(center, base - rect.height() * 0.43f, rect.width() * 0.045f, paint)
    val minaretW = rect.width() * 0.035f
    val leftM = rect.left + rect.width() * 0.24f
    val rightM = rect.right - rect.width() * 0.24f
    c.drawRect(leftM - minaretW, base - rect.height() * 0.46f, leftM + minaretW, base, paint)
    c.drawRect(rightM - minaretW, base - rect.height() * 0.46f, rightM + minaretW, base, paint)
    c.drawCircle(leftM, base - rect.height() * 0.46f, minaretW * 1.3f, paint)
    c.drawCircle(rightM, base - rect.height() * 0.46f, minaretW * 1.3f, paint)
  }

  private fun drawDecorativeMoon(c: Canvas, cx: Float, cy: Float, p: Palette) {
    val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 2f; color = p.gold }
    c.drawArc(RectF(cx - 7f, cy - 7f, cx + 7f, cy + 7f), -70f, 220f, false, stroke)
  }

  private fun drawPrayerIcon(c: Canvas, key: String, cx: Float, cy: Float, r: Float, color: Int, cardColor: Int) {
    val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 1.25f; strokeCap = Paint.Cap.ROUND; this.color = color }
    when (key) {
      "fajr" -> {
        c.drawLine(cx - r * 1.6f, cy + r * 0.6f, cx + r * 1.6f, cy + r * 0.6f, line)
        c.drawArc(RectF(cx - r, cy - r * 0.5f, cx + r, cy + r * 1.5f), 180f, 180f, false, line)
        ray(c, cx, cy - r * 0.8f, r * 0.8f, -PI / 2, line)
        ray(c, cx, cy, r * 1.05f, -2.55, line)
        ray(c, cx, cy, r * 1.05f, -0.60, line)
      }
      "dhuhr" -> {
        c.drawCircle(cx, cy, r * 0.72f, line)
        for (i in 0 until 8) ray(c, cx, cy, r * 1.55f, i * PI / 4, line, r * 1.05f)
      }
      "asr" -> {
        c.drawArc(RectF(cx - r * 0.8f, cy - r * 0.3f, cx + r * 0.8f, cy + r * 1.3f), 180f, 180f, false, line)
        c.drawLine(cx - r * 1.5f, cy + r * 0.6f, cx + r * 1.5f, cy + r * 0.6f, line)
        ray(c, cx, cy - r * 0.1f, r * 1.4f, -PI / 2, line, r * 0.9f)
      }
      "maghrib", "isha" -> {
        c.drawArc(RectF(cx - r, cy - r, cx + r, cy + r), -70f, 220f, false, line)
        if (key == "isha") {
          val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
          c.drawCircle(cx + r * 1.15f, cy - r * 0.95f, 1.1f, dot)
        }
      }
    }
  }

  private fun ray(c: Canvas, cx: Float, cy: Float, outer: Float, angle: Double, p: Paint, inner: Float = outer * 0.65f) {
    c.drawLine(
      cx + (cos(angle) * inner).toFloat(), cy + (sin(angle) * inner).toFloat(),
      cx + (cos(angle) * outer).toFloat(), cy + (sin(angle) * outer).toFloat(), p
    )
  }

  private fun paintSans(color: Int, size: Float, bold: Boolean): Paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    this.color = color
    textSize = size
    typeface = Typeface.create("sans-serif", if (bold) Typeface.BOLD else Typeface.NORMAL)
  }

  private fun paintSerif(color: Int, size: Float, bold: Boolean): Paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    this.color = color
    textSize = size
    typeface = Typeface.create("serif", if (bold) Typeface.BOLD else Typeface.NORMAL)
  }

  private fun fitText(p: Paint, text: String, maxWidth: Float, maxSize: Float, minSize: Float) {
    var size = maxSize
    p.textSize = size
    while (size > minSize && p.measureText(text) > maxWidth) {
      size -= 1f
      p.textSize = size
    }
  }
}
''')

# ---------------------------------------------------------------------------
# Home widget hosts: image canvas + native live Chronometer only.
# ---------------------------------------------------------------------------
layouts = {
"hassoun_prayer_widget.xml": r'''
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent"
  android:background="@drawable/hassoun_widget_bg_ivory">
  <ImageView android:id="@+id/widget_canvas" android:layout_width="match_parent" android:layout_height="match_parent" android:scaleType="fitXY" android:contentDescription="Hassoun Prayer Times" />
  <LinearLayout android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical">
    <Space android:layout_width="1dp" android:layout_height="0dp" android:layout_weight="0.42" />
    <LinearLayout android:layout_width="match_parent" android:layout_height="76dp" android:orientation="horizontal" android:gravity="center_vertical">
      <Space android:layout_width="0dp" android:layout_height="1dp" android:layout_weight="1.05" />
      <Chronometer android:id="@+id/widget_countdown" android:layout_width="76dp" android:layout_height="76dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle_light" android:textColor="#184A3C" android:textStyle="bold" android:textSize="12sp" android:maxLines="2" android:includeFontPadding="false" />
      <Space android:layout_width="0dp" android:layout_height="1dp" android:layout_weight="0.95" />
    </LinearLayout>
    <Space android:layout_width="1dp" android:layout_height="0dp" android:layout_weight="0.58" />
  </LinearLayout>
</FrameLayout>
''',
"hassoun_prayer_widget_vertical.xml": r'''
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent"
  android:background="@drawable/hassoun_widget_bg_ivory">
  <ImageView android:id="@+id/widget_canvas" android:layout_width="match_parent" android:layout_height="match_parent" android:scaleType="fitXY" android:contentDescription="Hassoun Prayer Times" />
  <LinearLayout android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical">
    <Space android:layout_width="1dp" android:layout_height="0dp" android:layout_weight="0.28" />
    <LinearLayout android:layout_width="match_parent" android:layout_height="60dp" android:orientation="horizontal" android:gravity="center_vertical">
      <Space android:layout_width="0dp" android:layout_height="1dp" android:layout_weight="0.20" />
      <Chronometer android:id="@+id/widget_countdown" android:layout_width="60dp" android:layout_height="60dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle_light" android:textColor="#184A3C" android:textStyle="bold" android:textSize="10sp" android:maxLines="2" android:includeFontPadding="false" />
      <Space android:layout_width="0dp" android:layout_height="1dp" android:layout_weight="0.80" />
    </LinearLayout>
    <Space android:layout_width="1dp" android:layout_height="0dp" android:layout_weight="0.72" />
  </LinearLayout>
</FrameLayout>
''',
"hassoun_prayer_widget_square.xml": r'''
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent"
  android:background="@drawable/hassoun_widget_bg_ivory">
  <ImageView android:id="@+id/widget_canvas" android:layout_width="match_parent" android:layout_height="match_parent" android:scaleType="fitXY" android:contentDescription="Hassoun Prayer Times" />
  <LinearLayout android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical">
    <Space android:layout_width="1dp" android:layout_height="0dp" android:layout_weight="0.58" />
    <LinearLayout android:layout_width="match_parent" android:layout_height="58dp" android:orientation="horizontal" android:gravity="center_vertical">
      <Space android:layout_width="0dp" android:layout_height="1dp" android:layout_weight="0.20" />
      <Chronometer android:id="@+id/widget_countdown" android:layout_width="58dp" android:layout_height="58dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle_light" android:textColor="#184A3C" android:textStyle="bold" android:textSize="9.5sp" android:maxLines="2" android:includeFontPadding="false" />
      <Space android:layout_width="0dp" android:layout_height="1dp" android:layout_weight="0.80" />
    </LinearLayout>
    <Space android:layout_width="1dp" android:layout_height="0dp" android:layout_weight="0.42" />
  </LinearLayout>
</FrameLayout>
''',
"hassoun_prayer_widget_slim.xml": r'''
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent"
  android:background="@drawable/hassoun_widget_bg_ivory">
  <ImageView android:id="@+id/widget_canvas" android:layout_width="match_parent" android:layout_height="match_parent" android:scaleType="fitXY" android:contentDescription="Hassoun Prayer Times" />
  <LinearLayout android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="horizontal" android:gravity="center_vertical">
    <Space android:layout_width="0dp" android:layout_height="1dp" android:layout_weight="1.0" />
    <Chronometer android:id="@+id/widget_countdown" android:layout_width="46dp" android:layout_height="46dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle_light" android:textColor="#184A3C" android:textStyle="bold" android:textSize="8sp" android:maxLines="2" android:includeFontPadding="false" />
    <Space android:layout_width="0dp" android:layout_height="1dp" android:layout_weight="1.0" />
  </LinearLayout>
</FrameLayout>
'''
}
for name, body in layouts.items():
    write(LAYOUT / name, body)

# ---------------------------------------------------------------------------
# Provider: route home-screen widgets through the bitmap renderer. Lock screen
# keeps the existing RemoteViews path. Also clean malformed multiline strings
# left by the previous attempt so Kotlin still compiles.
# ---------------------------------------------------------------------------
provider = PROVIDER.read_text(encoding="utf-8")
provider = provider.replace('"$arabic  •  $name\n$time"', '"$arabic  •  $name\\n$time"')
provider = provider.replace('"$name  •  $arabic\n$time"', '"$name  •  $arabic\\n$time"')
provider = provider.replace('"$name\n$arabic\n$time"', '"$name\\n$arabic\\n$time"')
provider = provider.replace('"$name\n$time"', '"$name\\n$time"')

lock_marker = '''      val isLockScreen = forceLockScreen || (hostCategory and AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD) != 0\n'''
route = '''      val isLockScreen = forceLockScreen || (hostCategory and AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD) != 0\n      if (!isLockScreen) {\n        updateRenderedHomeWidget(context, manager, appWidgetId)\n        return\n      }\n'''
if 'updateRenderedHomeWidget(context, manager, appWidgetId)' not in provider:
    if lock_marker not in provider:
        raise RuntimeError("Could not find lock-screen route marker")
    provider = provider.replace(lock_marker, route, 1)

method = r'''
    private fun updateRenderedHomeWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
      val info = manager.getAppWidgetInfo(appWidgetId)
      val className = info?.provider?.className.orEmpty()
      val layout = when {
        className.endsWith("HassounVerticalWidgetProvider") -> "vertical"
        className.endsWith("HassounSquareWidgetProvider") -> "square"
        className.endsWith("HassounSlimWidgetProvider") -> "slim"
        else -> "full"
      }
      val layoutRes = when (layout) {
        "vertical" -> R.layout.hassoun_prayer_widget_vertical
        "square" -> R.layout.hassoun_prayer_widget_square
        "slim" -> R.layout.hassoun_prayer_widget_slim
        else -> R.layout.hassoun_prayer_widget
      }
      val options = manager.getAppWidgetOptions(appWidgetId)
      val fallback = when (layout) {
        "vertical" -> 165 to 330
        "square" -> 180 to 180
        "slim" -> 320 to 90
        else -> 320 to 180
      }
      val widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0).takeIf { it > 0 } ?: fallback.first
      val heightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0).takeIf { it > 0 } ?: fallback.second

      val appearance = prefs.getString("appearance", "auto") ?: "auto"
      val systemDark = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
      val dark = when (appearance) {
        "light" -> false
        "dark" -> true
        else -> systemDark
      }
      val locale = prefs.getString("locale", "en") ?: "en"
      val showLogo = prefs.getBoolean("showLogo", true)
      val showArabic = prefs.getBoolean("showArabicNames", true)
      val showGregorian = prefs.getBoolean("showGregorian", true)
      val showHijri = prefs.getBoolean("showHijri", true)
      val highlightNext = prefs.getBoolean("highlightNext", true)
      val showCountdown = prefs.getBoolean("showCountdown", true)
      val timeSize = prefs.getString("timeSize", "large") ?: "large"
      val textScale = when (timeSize) {
        "small" -> 0.88f
        "medium" -> 0.95f
        "xlarge" -> 1.10f
        else -> 1.0f
      }

      val next = loadSchedule(context)?.let { findNextPrayer(it, locale) }
      val now = Date()
      val prayerData = if (next == null) emptyList() else prayerKeys.map { key ->
        WidgetRenderPrayer(
          key = key,
          english = englishNames[key] ?: key,
          arabic = arabicNames[key] ?: "",
          time = formatClock(next.day.optString(key, "--:--"), locale),
          active = highlightNext && key == next.key
        )
      }
      val englishNext = if (next == null) "Open Hassoun" else englishNames[next.key] ?: next.key
      val arabicNext = if (next == null) "" else arabicNames[next.key] ?: ""
      val mainName = if (locale == "ar" && next != null) arabicNext else englishNext
      val secondary = if (locale == "ar" && next != null) englishNext else arabicNext
      val state = WidgetRenderState(
        layout = layout,
        dark = dark,
        showLogo = showLogo,
        showArabic = showArabic,
        showGregorian = showGregorian,
        showHijri = showHijri,
        dateText = if (showGregorian) gregorianLabel(now, locale) else "",
        hijriText = if (showHijri) hijriLabel(now, locale) else "",
        nextPrayer = mainName,
        nextArabic = if (showArabic) secondary else "",
        nextTime = if (next == null) "--:--" else formatClockMain(next.timeText),
        nextSuffix = if (next == null) "" else formatClockSuffix(next.timeText),
        prayers = prayerData,
        textScale = textScale
      )

      val views = RemoteViews(context.packageName, layoutRes)
      bindLaunchIntent(context, views)
      val bitmap = HassounWidgetBitmapRenderer.render(context, widthDp, heightDp, state)
      views.setImageViewBitmap(R.id.widget_canvas, bitmap)

      if (next != null && showCountdown) {
        val delay = (next.targetMillis - System.currentTimeMillis()).coerceAtLeast(0L)
        views.setViewVisibility(R.id.widget_countdown, View.VISIBLE)
        views.setChronometer(R.id.widget_countdown, SystemClock.elapsedRealtime() + delay, "%s\nLEFT", true)
        views.setInt(
          R.id.widget_countdown,
          "setBackgroundResource",
          if (dark) R.drawable.hassoun_widget_countdown_circle_dark else R.drawable.hassoun_widget_countdown_circle_light
        )
        views.setTextColor(R.id.widget_countdown, if (dark) Color.rgb(246, 222, 161) else Color.rgb(24, 74, 60))
        val chronoSize = when (layout) {
          "vertical" -> 9.5f
          "square" -> 9f
          "slim" -> 7.5f
          else -> 11.5f
        }
        views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, chronoSize)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
          views.setChronometerCountDown(R.id.widget_countdown, true)
        }
        scheduleNextRefresh(context, next.targetMillis + 15_000L)
      } else {
        views.setViewVisibility(R.id.widget_countdown, View.GONE)
      }
      manager.updateAppWidget(appWidgetId, views)
    }

'''
if 'private fun updateRenderedHomeWidget(' not in provider:
    marker = '    private fun bindPrayerStrip('
    if marker not in provider:
        raise RuntimeError("Could not find provider insertion marker")
    provider = provider.replace(marker, method + marker, 1)

PROVIDER.write_text(provider, encoding="utf-8")
print("Applied premium canvas-rendered Hassoun widgets")
