# WOPT Smart Qur'an Memorization

## Goal
Make Memorize a guided, fun Qur'an training system rather than a simple hide/reveal screen. Qur'an accuracy remains the priority; displayed Qur'an text must always come from the verified Qur'an dataset.

## Lesson input
A user can create a memorization lesson from:
- Entire Surah
- One ayah
- Multiple ayahs / selected range
- Current Mushaf page or selected lines
- Search result opened in the Qur'an
- Bookmarked passage
- Pasted/imported Qur'an text, matched back to the verified Qur'an source before being used as Qur'an text

If imported text does not match verified Qur'an text confidently, do not silently treat it as Qur'an. Ask the user to choose the intended match or mark it as personal study text.

## Smart lesson cards
Automatically break the selected passage into manageable cards. Card sizes can be:
- Word
- Phrase
- Line
- Ayah
- Smart chunks based on passage length

Users can manually merge/split cards.

Each card supports:
- Play full card once
- Play full card N times
- Loop indefinitely
- Play line once / N times / loop
- Word-by-word playback
- Slow learning playback
- Repeat gap between plays
- Auto-advance to next card
- Hide/reveal Arabic
- Translation / transliteration optionally shown

## Speak & check mode
Allow the learner to recite aloud.

For every attempt:
- Capture microphone input only after explicit user action/permission
- Align spoken Arabic against the verified expected words
- Mark each expected word as correct, uncertain, skipped, or incorrect
- Correct words: green
- Incorrect words: red
- Uncertain words: amber
- Show score, e.g. `17 / 20 correct` and `3 to review`
- Let the learner tap a wrong word to hear that word and the surrounding phrase
- Never alter the verified Qur'an text when showing feedback

Pronunciation scoring must be framed as learning feedback, not as a religious ruling on tajweed correctness. Tajweed-specific scoring can be added only when the speech model provides reliable rule-level confidence.

## Attempt history & ranking
Track locally per anonymous WOPT profile:
- Attempts
- Correct / incorrect word counts
- Accuracy percentage
- Best score
- Current score
- Improvement from previous attempt
- Cards mastered
- Cards needing review
- Time spent memorizing
- Listening repetitions
- Speaking repetitions
- Last practiced date
- Daily / weekly streak

Example:
- Attempt 1: 13/20
- Attempt 2: 16/20
- Attempt 3: 18/20
- Improvement: +25 percentage points

## Smart progression
A lesson should adapt:
- Repeat weak cards more often
- Reduce repetition on mastered cards
- Re-surface repeatedly missed words
- Suggest listening before speaking after several weak attempts
- Advance only when the learner chooses or reaches a configurable threshold
- Offer quick review of yesterday's weak words before a new lesson

## Encouragement
Use positive Islamic-appropriate encouragement without shaming.

Examples:
- 🌟 `Masha'Allah — 3 more words correct than last time.`
- 📈 `You're improving. Try this line one more time.`
- 💚 `Great effort — 17 of 20 words matched.`
- 🔁 `Three words need another round. You can do it.`
- 🏆 `New personal best!`
- 🌱 `Consistency builds memorization.`

When performance drops, encourage retry and show concrete next steps instead of negative labels.

## Memorization techniques button
Show a visible `💡 Memorization Tips` icon on lessons.

Tips can include:
- Listen before reading
- Repeat one phrase several times
- Recite without looking
- Link the end of one card to the start of the next
- Review after a short break
- Review yesterday's lesson before adding new material
- Use slower recitation while learning
- Practice difficult words individually
- Increase the hidden-text level gradually

## Lesson modes
1. Listen
2. Read & Repeat
3. Word by Word
4. Hide & Reveal
5. Speak & Check
6. Weak Words Review
7. Full Passage Test

## Audio behavior
Use the selected WOPT Qur'an reciter and the native Qur'an audio engine.

Playback options:
- once
- 2x / 3x / 5x / 10x
- unlimited loop
- word-by-word
- phrase/line
- ayah
- card range
- full lesson

Respect background playback and lock-screen audio controls where applicable.

## Navigation
Memorization is a Qur'an sub-section.
- Opening a lesson should preserve where the user came from.
- Back returns to the previous Qur'an context.
- Main WOPT navigation follows the Qur'an navigation visibility rules.

## Data & privacy
- No registration required for local progress.
- Use anonymous local WOPT profile ID.
- Optional verified email/account can later back up and restore lessons across devices.
- Microphone audio should not be retained by default after scoring unless the user explicitly saves a recording.

## Future extensions
- Parent/teacher lesson sharing
- Friends/family memorization challenges
- AI recitation coach with more reliable tajweed-rule detection
- Cloud sync
- Weekly memorization report
- Optional motivation emails linked to verified email opt-in
