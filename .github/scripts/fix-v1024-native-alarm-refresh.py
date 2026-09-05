from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
PRAYER_DATA = ROOT / "mobile/src/prayerData.ts"
SCHEDULER = ROOT / "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmScheduler.kt"
RECEIVER = ROOT / "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmReceiver.kt"
SERVICE = ROOT / "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAudioService.kt"
CONFIG = ROOT / "mobile/app.config.ts"

app = APP.read_text(encoding="utf-8")
prayer_data = PRAYER_DATA.read_text(encoding="utf-8")
scheduler = SCHEDULER.read_text(encoding="utf-8")
receiver = RECEIVER.read_text(encoding="utf-8")
service = SERVICE.read_text(encoding="utf-8")
cfg = CONFIG.read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# 1) Native alarm generation guard.
# Android can retain an already-created PendingIntent alarm even if our saved list
# no longer contains enough information to cancel it. Every newly scheduled prayer
# alarm now carries a generation token. The receiver accepts only the CURRENT saved
# generation and only a currently saved event whose due time is near now.
# ---------------------------------------------------------------------------
if 'GENERATION_KEY' not in scheduler:
    scheduler = scheduler.replace(
        '  private const val EVENTS_KEY = "exact_prayer_events"\n',
        '  private const val EVENTS_KEY = "exact_prayer_events"\n  private const val GENERATION_KEY = "exact_prayer_generation"\n',
        1,
    )

# replaceSchedule: create/store a fresh generation and schedule with it.
scheduler = scheduler.replace(
'''    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)\n      .edit()\n      .putString(EVENTS_KEY, future.toString())\n      .apply()\n\n    val exact = canScheduleExactAlarms(context)\n    for (index in 0 until future.length()) {\n      scheduleOne(context, future.getJSONObject(index), exact)\n    }''',
'''    val generation = java.util.UUID.randomUUID().toString()\n    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)\n      .edit()\n      .putString(EVENTS_KEY, future.toString())\n      .putString(GENERATION_KEY, generation)\n      .commit()\n\n    val exact = canScheduleExactAlarms(context)\n    for (index in 0 until future.length()) {\n      scheduleOne(context, future.getJSONObject(index), exact, generation, false)\n    }''',
1)

# Test alarms remain possible, but are explicitly marked and do not use the production generation.
scheduler = scheduler.replace(
'    scheduleOne(context, event, exact)\n    return exact',
'    scheduleOne(context, event, exact, "test", true)\n    return exact',
1)

# cancelAll invalidates generation synchronously before cancellation attempts.
scheduler = scheduler.replace(
'    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager\n\n    for (index in 0 until events.length()) {',
'    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager\n    preferences.edit().remove(GENERATION_KEY).commit()\n\n    for (index in 0 until events.length()) {',
1)

scheduler = scheduler.replace(
'  private fun scheduleOne(context: Context, event: JSONObject, exact: Boolean) {',
'  private fun scheduleOne(context: Context, event: JSONObject, exact: Boolean, generation: String, isTest: Boolean) {',
1)
scheduler = scheduler.replace(
'    val intent = requireNotNull(pendingIntent(context, event, PendingIntent.FLAG_UPDATE_CURRENT))',
'    val intent = requireNotNull(pendingIntent(context, event, PendingIntent.FLAG_UPDATE_CURRENT, generation, isTest))',
1)

# Existing cancellation needs a mode that does not require a generation token.
scheduler = scheduler.replace(
'      pendingIntent(context, event, PendingIntent.FLAG_NO_CREATE)?.let { manager.cancel(it) }',
'      pendingIntent(context, event, PendingIntent.FLAG_NO_CREATE, null, false)?.let { manager.cancel(it) }',
1)
scheduler = scheduler.replace(
'  private fun pendingIntent(context: Context, event: JSONObject, mode: Int): PendingIntent? {',
'  private fun pendingIntent(context: Context, event: JSONObject, mode: Int, generation: String?, isTest: Boolean): PendingIntent? {',
1)
scheduler = scheduler.replace(
'      putExtra("prayer", prayer)\n    }',
'      putExtra("prayer", prayer)\n      putExtra("scheduledAtMs", event.optLong("scheduledAtMs", 0L))\n      putExtra("generation", generation)\n      putExtra("isTest", isTest)\n    }',
1)

# Add the receiver-side production validator.
if 'fun isCurrentDueAlarm' not in scheduler:
    insert_at = scheduler.rfind('\n}')
    validator = '''\n\n  fun isCurrentDueAlarm(\n    context: Context,\n    eventId: String,\n    prayer: String,\n    generation: String,\n    scheduledAtMs: Long\n  ): Boolean {\n    if (eventId.isBlank() || generation.isBlank() || scheduledAtMs <= 0L) return false\n    val preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)\n    val currentGeneration = preferences.getString(GENERATION_KEY, null) ?: return false\n    if (generation != currentGeneration) return false\n\n    val saved = preferences.getString(EVENTS_KEY, "[]") ?: "[]"\n    val events = runCatching { JSONArray(saved) }.getOrDefault(JSONArray())\n    var matched = false\n    for (index in 0 until events.length()) {\n      val event = events.optJSONObject(index) ?: continue\n      if (event.optString("id") == eventId &&\n          event.optString("prayer").equals(prayer, ignoreCase = true) &&\n          event.optLong("scheduledAtMs", -1L) == scheduledAtMs) {\n        matched = true\n        break\n      }\n    }\n    if (!matched) return false\n\n    // AlarmManager can be slightly late, but a launch-time zombie alarm must never\n    // be accepted minutes/hours/days away from the saved event time.\n    return kotlin.math.abs(System.currentTimeMillis() - scheduledAtMs) <= 2 * 60 * 1000L\n  }\n'''
    scheduler = scheduler[:insert_at] + validator + scheduler[insert_at:]

# Receiver: reject any legacy/zombie broadcast before it can start the foreground service.
receiver = re.sub(
    r'  override fun onReceive\(context: Context, intent: Intent\) \{.*?\n  \}\n\n  private fun isDuplicateEvent',
'''  override fun onReceive(context: Context, intent: Intent) {\n    val eventId = intent.getStringExtra("eventId") ?: return\n    val prayer = intent.getStringExtra("prayer") ?: return\n    val isTest = intent.getBooleanExtra("isTest", false)\n    val generation = intent.getStringExtra("generation") ?: ""\n    val scheduledAtMs = intent.getLongExtra("scheduledAtMs", 0L)\n\n    if (!isTest && !PrayerAlarmScheduler.isCurrentDueAlarm(context, eventId, prayer, generation, scheduledAtMs)) {\n      return\n    }\n    if (isDuplicateEvent(context, eventId)) return\n\n    val serviceIntent = Intent(context, PrayerAudioService::class.java).apply {\n      action = PrayerAudioService.ACTION_PLAY\n      putExtra("eventId", eventId)\n      putExtra("prayer", prayer)\n      putExtra("authorizedAlarm", true)\n    }\n    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n      context.startForegroundService(serviceIntent)\n    } else {\n      context.startService(serviceIntent)\n    }\n  }\n\n  private fun isDuplicateEvent''',
    receiver,
    count=1,
    flags=re.S,
)

# Service refuses to play if started by anything other than the validated receiver.
if 'authorizedAlarm' not in service:
    service = service.replace(
'''  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {\n    if (intent?.action == ACTION_STOP) {\n      finishPlayback()\n      return START_NOT_STICKY\n    }\n\n    val prayer =''',
'''  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {\n    if (intent?.action == ACTION_STOP) {\n      finishPlayback()\n      return START_NOT_STICKY\n    }\n    if (intent?.action != ACTION_PLAY || intent.getBooleanExtra("authorizedAlarm", false) != true) {\n      stopSelf(startId)\n      return START_NOT_STICKY\n    }\n\n    val prayer =''',
1)

# ---------------------------------------------------------------------------
# 2) Home refresh hardening.
# Keep native RefreshControl, but make the manual action visibly prove a fresh run.
# Force highest-accuracy GPS and never silently fall back during manual refresh.
# ---------------------------------------------------------------------------
prayer_data = prayer_data.replace(
'accuracy: options.forceLocation ? Location.Accuracy.High : Location.Accuracy.Balanced',
'accuracy: options.forceLocation ? Location.Accuracy.Highest : Location.Accuracy.Balanced',
1)

# Add a refresh-result timestamp so the user can tell the operation actually completed.
if 'lastHomeRefreshAt' not in app:
    state_anchor = '  const [startupAudioCleared, setStartupAudioCleared] = useState(false);'
    if state_anchor not in app:
        state_anchor = '  const [refreshingHome, setRefreshingHome] = useState(false);'
    app = app.replace(state_anchor, state_anchor + '\n  const [lastHomeRefreshAt, setLastHomeRefreshAt] = useState<Date | null>(null);', 1)

# Mark successful refresh only after state has been updated.
needle = '      HassounWidget.refresh();'
if needle in app and 'setLastHomeRefreshAt(new Date())' not in app:
    app = app.replace(needle, needle + '\n      setLastHomeRefreshAt(new Date());', 1)

# Make pull control unmistakable and directly bound to the callback.
app = app.replace('onRefresh={refreshHome}', 'onRefresh={() => { void refreshHome(); }}')
if 'colors={["#0b5b47"]}' not in app:
    app = app.replace(
        '          progressViewOffset={96}\n          enabled',
        '          progressViewOffset={96}\n          colors={["#0b5b47"]}\n          progressBackgroundColor="#ffffff"\n          enabled',
        1,
    )

# Add live refresh status immediately under the explicit refresh button.
if 'Last location refresh' not in app:
    anchor = '''      <Pressable\n        onPress={() => void refreshHome()}\n        disabled={refreshingHome}'''
    pos = app.find(anchor)
    if pos >= 0:
        close = app.find('      </Pressable>\n', pos)
        if close >= 0:
            close += len('      </Pressable>\n')
            status = '''      {lastHomeRefreshAt ? (\n        <Text style={{ marginHorizontal: 18, marginBottom: 10, color: "#55706a", fontSize: 12, fontWeight: "700", textAlign: "center" }}>\n          {locale === "ar" ? "آخر تحديث للموقع" : "Last location refresh"}: {lastHomeRefreshAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} • {prayerLocation.label}\n        </Text>\n      ) : null}\n'''
            app = app[:close] + status + app[close:]

# ---------------------------------------------------------------------------
# 3) Version bump.
# ---------------------------------------------------------------------------
cfg = re.sub(r'version:\s*(?:process\.env\.EXPO_APP_VERSION\s*\|\|\s*)?"[^"]+"', 'version: process.env.EXPO_APP_VERSION || "1.0.24"', cfg, count=1)
cfg = re.sub(r'versionCode:\s*\d+', 'versionCode: 68', cfg, count=1)

SCHEDULER.write_text(scheduler, encoding='utf-8')
RECEIVER.write_text(receiver, encoding='utf-8')
SERVICE.write_text(service, encoding='utf-8')
PRAYER_DATA.write_text(prayer_data, encoding='utf-8')
APP.write_text(app, encoding='utf-8')
CONFIG.write_text(cfg, encoding='utf-8')

checks = {
    SCHEDULER: ['GENERATION_KEY', 'isCurrentDueAlarm', 'java.util.UUID.randomUUID()', 'putExtra("generation"', 'putExtra("isTest"'],
    RECEIVER: ['PrayerAlarmScheduler.isCurrentDueAlarm', 'authorizedAlarm', 'isTest'],
    SERVICE: ['authorizedAlarm', 'intent?.action != ACTION_PLAY'],
    PRAYER_DATA: ['Location.Accuracy.Highest', 'options.forceLocation'],
    APP: ['lastHomeRefreshAt', 'Last location refresh', 'onRefresh={() => { void refreshHome(); }}'],
    CONFIG: ['1.0.24', 'versionCode: 68'],
}
for path, needles in checks.items():
    text = path.read_text(encoding='utf-8')
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Missing {needle!r} in {path}')

print('Applied v1.0.24: native generation-validated Adhan alarms + verified Home fresh-location refresh')
