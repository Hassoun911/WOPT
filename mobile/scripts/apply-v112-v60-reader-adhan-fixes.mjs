import fs from 'node:fs';

function read(path){ return fs.readFileSync(path,'utf8'); }
function write(path,text){ fs.writeFileSync(path,text); }
function mustReplace(text, oldValue, newValue, label){
  if (text.includes(newValue)) return text;
  if (!text.includes(oldValue)) throw new Error(`Missing patch marker: ${label}`);
  return text.replaceAll(oldValue,newValue);
}

// Make vertical Mushaf paging forgiving on Android. The old 8px edge window
// required users to nudge the ScrollView back to the exact edge before a
// reverse page gesture would be recognized.
{
  const path='src/quran/QuranV3.tsx';
  let s=read(path);
  s=mustReplace(s,'if (vertical < 12 || vertical <= horizontal * 1.05) return false;','if (vertical < 8 || vertical <= horizontal * 1.15) return false;','Quran gesture threshold');
  s=mustReplace(s,'readerAtTop.current || readerLastScrollY.current <= 8 || contentFits','readerAtTop.current || readerLastScrollY.current <= 48 || contentFits','Quran previous-page edge tolerance');
  s=mustReplace(s,'readerAtTop.current = y <= 8;','readerAtTop.current = y <= 48;','Quran top edge tracking');
  s=mustReplace(s,'nativeEvent.contentSize.height - 8;','nativeEvent.contentSize.height - 48;','Quran bottom edge tracking');
  write(path,s);
}

// Pass the alarm timestamp all the way into the playback service so the
// service can independently reject stale/accidental starts after install/update.
{
  const path='modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmReceiver.kt';
  let s=read(path);
  s=mustReplace(s,'putExtra("prayer", intent.getStringExtra("prayer"))','putExtra("prayer", intent.getStringExtra("prayer"))\n      putExtra("scheduledAtMs", scheduledAtMs)','Adhan receiver timestamp');
  write(path,s);
}

{
  const path='modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAudioService.kt';
  let s=read(path);
  if (!s.includes('import kotlin.math.abs')) s=s.replace('import java.util.Locale','import java.util.Locale\nimport kotlin.math.abs');
  const marker='''    if (intent?.action == ACTION_STOP) {\n      finishPlayback()\n      return START_NOT_STICKY\n    }\n\n    val prayer = intent?.getStringExtra("prayer")?.replaceFirstChar {''';
  const replacement='''    if (intent?.action == ACTION_STOP) {\n      finishPlayback()\n      return START_NOT_STICKY\n    }\n\n    // Never start Adhan just because Android recreated the service during an\n    // install/update. Only a current validated prayer-alarm broadcast may play.\n    if (intent?.action != ACTION_PLAY) {\n      stopSelf()\n      return START_NOT_STICKY\n    }\n    val scheduledAtMs = intent.getLongExtra("scheduledAtMs", 0L)\n    if (scheduledAtMs <= 0L || abs(System.currentTimeMillis() - scheduledAtMs) > MAX_TRIGGER_DRIFT_MS) {\n      stopSelf()\n      return START_NOT_STICKY\n    }\n\n    val prayer = intent.getStringExtra("prayer")?.replaceFirstChar {''';
  if (!s.includes('Only a current validated prayer-alarm broadcast may play.')) {
    if (!s.includes(marker)) throw new Error('Missing patch marker: Adhan service start guard');
    s=s.replace(marker,replacement);
  }
  if (!s.includes('private const val MAX_TRIGGER_DRIFT_MS')) {
    s=s.replace('private const val NOTIFICATION_ID = 7861','private const val NOTIFICATION_ID = 7861\n    private const val MAX_TRIGGER_DRIFT_MS = 2 * 60 * 1000L');
  }
  write(path,s);
}

console.log('Applied v60 Quran bidirectional paging + stale Adhan install guard');
