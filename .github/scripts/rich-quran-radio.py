from pathlib import Path

path = Path('mobile/src/quran/QuranV3.tsx')
text = path.read_text()
start = text.index('  const radioScreen = (')
end = text.index('  const renderMushafPage =', start)
replacement = r'''  const radioAudioActive = audioStatus.state !== "idle" && audioStatus.state !== "error";
  const radioProgress = audioStatus.durationMs > 0 ? Math.min(1, Math.max(0, audioStatus.positionMs / audioStatus.durationMs)) : 0;
  const radioRemaining = Math.max(0, audioStatus.durationMs - audioStatus.positionMs);

  const radioScreen = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.radioContent} showsVerticalScrollIndicator={false}>
      {topBar(tr("Qur’an Radio", "إذاعة القرآن"), tr("A richer continuous listening studio", "استماع قرآني متواصل وتحكم كامل"))}

      <View style={styles.radioStudioHero}>
        <View style={styles.radioStudioTop}>
          <View style={styles.radioStudioBadge}><Text style={styles.radioStudioBadgeIcon}>{radioAudioActive ? "🎧" : "📻"}</Text></View>
          <View style={styles.topCopy}>
            <Text style={[styles.radioStudioEyebrow, ar && styles.rtl]}>{radioAudioActive ? tr("NOW PLAYING", "يعمل الآن") : tr("HASSOUN QUR’AN AUDIO", "صوت القرآن • حسّون")}</Text>
            <Text numberOfLines={1} style={[styles.radioStudioTitle, ar && styles.rtl]}>{radioAudioActive ? (audioStatus.title || tr("Qur’an playback", "تشغيل القرآن")) : tr("Your Qur’an listening studio", "استوديو الاستماع للقرآن")}</Text>
            <Text numberOfLines={1} style={[styles.radioStudioMeta, ar && styles.rtl]}>{radioAudioActive ? (audioStatus.subtitle || (ar ? activeReciter.ar : activeReciter.en)) : tr("Choose a reciter, Surah, playlist, or continuous range.", "اختر القارئ أو السورة أو قائمة تشغيل أو نطاقاً متواصلاً.")}</Text>
          </View>
          {radioAudioActive ? <Pressable onPress={stopAudio} style={styles.radioHeroStop}><Text style={styles.radioHeroStopText}>■</Text></Pressable> : null}
        </View>

        {radioAudioActive ? (
          <>
            <View style={styles.radioProgressTrack}><View style={[styles.radioProgressFill, { width: `${Math.max(2, radioProgress * 100)}%` }]} /></View>
            <View style={styles.radioTimeRow}><Text style={styles.radioTimeText}>{formatTime(audioStatus.positionMs)}</Text><Text style={styles.radioTimeText}>−{formatTime(radioRemaining)}</Text></View>
            <View style={styles.radioTransportRow}>
              <Pressable onPress={previousAudio} style={styles.radioTransportSide}><Text style={styles.radioTransportArrow}>‹</Text></Pressable>
              <Pressable onPress={() => QuranAudio?.seekBy(-10000)} style={styles.radioTransportMini}><Text style={styles.radioTransportMiniText}>−10</Text></Pressable>
              <Pressable onPress={togglePlayerPlayback} style={styles.radioTransportMain}><Text style={styles.radioTransportMainText}>{audioStatus.state === "playing" ? "Ⅱ" : "▶"}</Text></Pressable>
              <Pressable onPress={() => QuranAudio?.seekBy(10000)} style={styles.radioTransportMini}><Text style={styles.radioTransportMiniText}>+10</Text></Pressable>
              <Pressable onPress={nextAudio} style={styles.radioTransportSide}><Text style={styles.radioTransportArrow}>›</Text></Pressable>
            </View>
            <View style={styles.radioQuickRow}>
              <Pressable onPress={() => { const next = !repeatQueue; setRepeatQueue(next); QuranAudio?.setRepeat(next); }} style={[styles.radioQuickPill, repeatQueue && styles.radioQuickPillActive]}><Text style={[styles.radioQuickText, repeatQueue && styles.radioQuickTextActive]}>∞ {tr("Loop", "تكرار")}</Text></Pressable>
              <Pressable onPress={() => updateSpeed(audioPrefs.speed >= 2 ? 0.5 : audioPrefs.speed + 0.1)} style={styles.radioQuickPill}><Text style={styles.radioQuickText}>{audioPrefs.speed.toFixed(1)}× {tr("Speed", "السرعة")}</Text></Pressable>
              <View style={styles.radioQueuePill}><Text style={styles.radioQueueText}>{audioStatus.queueSize ?? audioQueue.length} {tr("items", "مقطع")}</Text></View>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.radioSectionHead}><View><Text style={styles.radioSectionKicker}>{tr("VOICE", "الصوت")}</Text><Text style={styles.radioSectionTitle}>{tr("Choose your reciter", "اختر القارئ")}</Text></View><Text style={styles.radioSectionHint}>🎙️</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reciterRow}>{RECITERS.map((item) => <Pressable key={item.id} onPress={() => updateReciter(item.id)} style={[styles.reciterChip, audioPrefs.reciter === item.id && styles.reciterChipActive]}><Text style={[styles.reciterChipText, audioPrefs.reciter === item.id && styles.reciterChipTextActive]}>{ar ? item.ar : item.en}</Text></Pressable>)}</ScrollView>

      <View style={styles.radioStudioCard}>
        <View style={styles.radioCardHeader}><View style={styles.radioCardIconWrap}><Text style={styles.radioCardIconText}>▶</Text></View><View style={styles.topCopy}><Text style={styles.radioStudioCardTitle}>{tr("Play a Surah", "تشغيل سورة")}</Text><Text style={styles.radioStudioCardMeta}>{tr("Listen once, keep it looping, or save it to your queue.", "استمع مرة أو كرر السورة أو أضفها إلى قائمتك.")}</Text></View></View>
        {surahStepper(radioSurah, setRadioSurah)}
        <View style={styles.radioPillActions}>
          <Pressable onPress={() => playSurah(radioSurah, false)} style={styles.radioPrimaryPill}><Text style={styles.radioPrimaryPillIcon}>▶</Text><Text style={styles.radioPrimaryPillText}>{tr("Play", "تشغيل")}</Text></Pressable>
          <Pressable onPress={() => playSurah(radioSurah, true)} style={styles.radioGlassPill}><Text style={styles.radioGlassPillText}>∞ {tr("Loop", "تكرار")}</Text></Pressable>
          <Pressable onPress={() => { if (!radioPlaylist.includes(radioSurah)) persistPlaylist([...radioPlaylist, radioSurah]); }} style={styles.radioGlassPill}><Text style={styles.radioGlassPillText}>＋ {tr("Queue", "القائمة")}</Text></Pressable>
        </View>
      </View>

      <View style={styles.radioStudioCard}>
        <View style={styles.radioCardHeader}><View style={styles.radioCardIconWrap}><Text style={styles.radioCardIconText}>♫</Text></View><View style={styles.topCopy}><Text style={styles.radioStudioCardTitle}>{tr("My listening queue", "قائمة الاستماع")}</Text><Text style={styles.radioStudioCardMeta}>{radioPlaylist.length ? tr(`${radioPlaylist.length} Surahs ready to play`, `${num(radioPlaylist.length)} سور جاهزة للتشغيل`) : tr("Build a playlist from the Surah player above.", "أضف سوراً من المشغل أعلاه لإنشاء قائمتك.")}</Text></View>{radioPlaylist.length ? <Pressable onPress={() => persistPlaylist([])} style={styles.clearPill}><Text style={styles.clearPillText}>{tr("Clear", "مسح")}</Text></Pressable> : null}</View>
        {radioPlaylist.length ? <View style={styles.playlistWrap}>{radioPlaylist.map((surahNumber, index) => { const surah = getSurah(surahNumber); return <View key={`${surahNumber}-${index}`} style={styles.playlistItem}><View style={styles.playlistNumber}><Text style={styles.playlistNumberText}>{index + 1}</Text></View><View style={styles.topCopy}><Text style={styles.playlistTitle}>{ar ? surah?.nameArabic : surah?.nameTransliterated}</Text><Text style={styles.playlistMeta}>{tr(`Surah ${surahNumber}`, `سورة ${num(surahNumber)}`)}</Text></View><Pressable onPress={() => persistPlaylist(radioPlaylist.filter((_item, itemIndex) => itemIndex !== index))} style={styles.removePlaylist}><Text style={styles.removePlaylistText}>×</Text></Pressable></View>; })}</View> : <View style={styles.radioEmptyQueue}><Text style={styles.radioEmptyQueueIcon}>🎵</Text><Text style={styles.radioEmptyQueueText}>{tr("Your queue is empty", "قائمة التشغيل فارغة")}</Text></View>}
        <View style={styles.radioPillActions}>
          <Pressable disabled={!radioPlaylist.length} onPress={() => playPlaylist(false)} style={[styles.radioPrimaryPill, !radioPlaylist.length && styles.disabled]}><Text style={styles.radioPrimaryPillIcon}>▶</Text><Text style={styles.radioPrimaryPillText}>{tr("Play queue", "تشغيل القائمة")}</Text></Pressable>
          <Pressable disabled={!radioPlaylist.length} onPress={() => playPlaylist(true)} style={[styles.radioGlassPill, !radioPlaylist.length && styles.disabled]}><Text style={styles.radioGlassPillText}>∞ {tr("Loop", "تكرار")}</Text></Pressable>
        </View>
      </View>

      <View style={[styles.radioStudioCard, styles.radioContinuousCard]}>
        <View style={styles.radioCardHeader}><View style={[styles.radioCardIconWrap, styles.radioMoonWrap]}><Text style={styles.radioCardIconText}>☾</Text></View><View style={styles.topCopy}><Text style={styles.radioStudioCardTitle}>{tr("Continuous Qur’an", "القرآن المتواصل")}</Text><Text style={styles.radioStudioCardMeta}>{tr("Start anywhere and let Hassoun continue through the Qur’an, even with the screen locked.", "ابدأ من أي سورة ودع حسّون يواصل التلاوة حتى مع قفل الشاشة.")}</Text></View></View>
        <Text style={styles.radioFieldLabel}>{tr("START FROM", "ابدأ من")}</Text>
        {surahStepper(radioStartSurah, (next) => { setRadioStartSurah(next); if (radioEndSurah < next) setRadioEndSurah(next); })}
        <View style={styles.ongoingRow}><View style={styles.topCopy}><Text style={styles.ongoingTitle}>{tr("Continue to the end", "الاستمرار إلى النهاية")}</Text><Text style={styles.ongoingText}>{tr("Turn this off if you want a specific ending Surah.", "أوقفه إذا أردت تحديد سورة للنهاية.")}</Text></View><Switch value={radioOngoing} onValueChange={setRadioOngoing} /></View>
        {!radioOngoing ? <><Text style={styles.radioFieldLabel}>{tr("STOP AFTER", "توقف بعد")}</Text>{surahStepper(radioEndSurah, (next) => setRadioEndSurah(Math.max(radioStartSurah, next)))}</> : null}
        <View style={styles.radioPillActions}>
          <Pressable onPress={() => playFullQuranRange(false)} style={styles.radioPrimaryPill}><Text style={styles.radioPrimaryPillIcon}>▶</Text><Text style={styles.radioPrimaryPillText}>{tr("Start listening", "ابدأ الاستماع")}</Text></Pressable>
          <Pressable onPress={() => playFullQuranRange(true)} style={styles.radioGlassPill}><Text style={styles.radioGlassPillText}>∞ {tr("Loop range", "تكرار النطاق")}</Text></Pressable>
        </View>
      </View>
    </ScrollView>
  );

'''
path.write_text(text[:start] + replacement + text[end:])
print('Rich Quran Radio layout integrated')
