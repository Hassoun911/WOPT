from pathlib import Path

path = Path('mobile/src/quran/QuranV3.tsx')
text = path.read_text()
native_marker = '  const nativeQueuePayload ='
start = text.index(native_marker) if native_marker in text else text.index('  const playNativeAyah =')
end = text.index('  if (!quranReady()) {', start)
replacement = r'''  const nativeQueuePayload = (queue: QuranAyah[], reciterId = audioPrefs.reciter) => JSON.stringify(
    queue.map((ayah) => {
      const surah = getSurah(ayah.surah);
      const reciter = reciterInfo(reciterId);
      return {
        url: audioUrl(ayah, reciterId),
        title: `${ar ? surah?.nameArabic : surah?.nameTransliterated ?? `Surah ${ayah.surah}`} • ${tr("Ayah", "الآية")} ${num(ayah.ayah)}`,
        subtitle: `${ar ? reciter.ar : reciter.en} • Hassoun`
      };
    })
  );

  const playNativeAyah = (ayah: QuranAyah, reciterId = audioPrefs.reciter) => {
    if (!QuranAudio) return;
    completionRef.current = null;
    QuranAudio.playQueue(nativeQueuePayload([ayah], reciterId), 0, false, audioPrefs.speed);
  };

  const playQueue = (queue: QuranAyah[], repeat = false) => {
    const first = queue[0];
    if (!first || !QuranAudio) return;
    setAudioQueue(queue);
    setAudioIndex(0);
    setRepeatQueue(repeat);
    completionRef.current = null;
    QuranAudio.playQueue(nativeQueuePayload(queue), 0, repeat, audioPrefs.speed);
  };

  const playAyah = (ayah: QuranAyah, repeat = false) => playQueue([ayah], repeat);
  const playSurah = (surah: number, repeat = false) => playQueue(getSurahAyahs(surah), repeat);

  const toggleSelectedPlayback = (ayah: QuranAyah) => {
    const sameAyah = activeAyah?.surah === ayah.surah && activeAyah?.ayah === ayah.ayah;
    if (!sameAyah) {
      playAyah(ayah, false);
      return;
    }
    if (audioStatus.state === "playing") QuranAudio?.pause();
    else if (audioStatus.state === "paused") QuranAudio?.resume();
    else playAyah(ayah, repeatQueue);
  };

  const stopSelectedPlayback = () => {
    QuranAudio?.stop();
    setAudioQueue([]);
    setAudioIndex(-1);
    setRepeatQueue(false);
    completionRef.current = null;
  };

  const replaySelected = (ayah: QuranAyah) => {
    playAyah(ayah, false);
  };

  const toggleSelectedLoop = (ayah: QuranAyah) => {
    const sameAyah = activeAyah?.surah === ayah.surah && activeAyah?.ayah === ayah.ayah && audioQueue.length === 1;
    if (!sameAyah) {
      playAyah(ayah, true);
      return;
    }
    const nextRepeat = !repeatQueue;
    setRepeatQueue(nextRepeat);
    QuranAudio?.setRepeat(nextRepeat);
    if (audioStatus.state === "completed" || audioStatus.state === "idle") playAyah(ayah, nextRepeat);
  };

  const copySelectedText = async (ayah: QuranAyah) => {
    await Clipboard.setStringAsync(ayah.text);
    setCopiedSelection(true);
    setTimeout(() => setCopiedSelection(false), 1400);
  };

  const translateSelectedText = async (ayah: QuranAyah) => {
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/ayah/${ayah.surah}:${ayah.ayah}/en.sahih`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { data?: { text?: string } };
      const translation = payload.data?.text?.trim();
      if (!translation) throw new Error("No translation returned");
      const surahName = getSurah(ayah.surah)?.nameTransliterated ?? `Surah ${ayah.surah}`;
      Alert.alert(`${surahName} • Ayah ${ayah.ayah}`, translation);
    } catch {
      Alert.alert(tr("Translation unavailable", "الترجمة غير متاحة"), tr("Please check your internet connection and try again.", "تحقق من اتصال الإنترنت وحاول مرة أخرى."));
    }
  };

  const togglePlayerPlayback = () => {
    if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }
    if (audioStatus.state === "paused" || audioStatus.state === "completed") { QuranAudio?.resume(); return; }
    if (!activeAyah) { playSurah(position.surah, false); return; }
    QuranAudio?.resume();
  };

  const playPlaylist = (repeat = false) => {
    const queue: QuranAyah[] = [];
    for (const surah of radioPlaylist) queue.push(...getSurahAyahs(surah));
    playQueue(queue, repeat);
  };

  const playFullQuranRange = (repeat = false) => {
    const end = radioOngoing ? 114 : Math.max(radioStartSurah, radioEndSurah);
    playQueue(buildSurahQueue(radioStartSurah, end), repeat);
  };

  const stopAudio = () => {
    QuranAudio?.stop();
    setAudioQueue([]);
    setAudioIndex(-1);
    setRepeatQueue(false);
    setAudioStatus({ available: Boolean(QuranAudio), state: "idle", positionMs: 0, durationMs: 0, speed: audioPrefs.speed });
  };

  const nextAudio = () => {
    QuranAudio?.next();
  };

  const previousAudio = () => {
    QuranAudio?.previous();
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (!QuranAudio) return;
      const status = QuranAudio.getStatus();
      setAudioStatus(status);
      if (typeof status.queueIndex === "number" && status.queueIndex >= 0 && status.queueIndex < audioQueue.length) {
        setAudioIndex((current) => current === status.queueIndex ? current : status.queueIndex!);
      }
      if (typeof status.repeat === "boolean") setRepeatQueue(status.repeat);
      if (status.state === "idle" && audioQueue.length) {
        setAudioQueue([]);
        setAudioIndex(-1);
        setRepeatQueue(false);
      }
    }, 450);
    return () => clearInterval(timer);
  }, [audioQueue.length]);

  useEffect(() => {
    if (!activeAyah) return;
    persistLast({ surah: activeAyah.surah, ayah: activeAyah.ayah });
  }, [audioIndex]);

  const updateReciter = (id: string) => {
    persistAudioPrefs({ reciter: id });
    if (audioQueue.length) {
      const startIndex = Math.max(0, audioIndex);
      setTimeout(() => QuranAudio?.playQueue(nativeQueuePayload(audioQueue, id), startIndex, repeatQueue, audioPrefs.speed), 20);
    }
  };

  const updateSpeed = (speed: number) => {
    const safe = Math.round(clamp(speed, 0.5, 2) * 10) / 10;
    persistAudioPrefs({ speed: safe });
    QuranAudio?.setSpeed(safe);
  };
'''
path.write_text(text[:start] + replacement + '\n\n' + text[end:])
print('QuranV3 native background queue integrated')
