from pathlib import Path

provider_path = Path('mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt')
apply_script_path = Path('.github/scripts/apply-widget-large-info-v108.py')

provider = provider_path.read_text(encoding='utf-8')

color_line = '        val countdownTextColor = if (theme == "ivory") Color.rgb(181, 126, 42) else Color.rgb(242, 201, 111)\n'
delay_anchor = '        val delay = (next.targetMillis - System.currentTimeMillis()).coerceAtLeast(0L)\n        if (showCountdown) {\n'

if delay_anchor not in provider:
    raise SystemExit('Countdown delay anchor not found in provider')

# countdownTextColor is also used by the following-prayer strip, so it must live
# outside the showCountdown block. The previous patch declared it inside that
# block, which makes the Android Kotlin build fail with an unresolved reference.
provider = provider.replace(delay_anchor, '        val delay = (next.targetMillis - System.currentTimeMillis()).coerceAtLeast(0L)\n' + color_line + '        if (showCountdown) {\n', 1)

inside_decl = '          val countdownTextColor = if (theme == "ivory") Color.rgb(181, 126, 42) else Color.rgb(242, 201, 111)\n          views.setTextColor(R.id.widget_countdown, countdownTextColor)'
if inside_decl in provider:
    provider = provider.replace(inside_decl, '          views.setTextColor(R.id.widget_countdown, countdownTextColor)', 1)

# Sanity check: exactly one declaration should remain, before showCountdown.
if provider.count('val countdownTextColor =') != 1:
    raise SystemExit(f'Expected one countdownTextColor declaration, found {provider.count("val countdownTextColor =")}')
if provider.index('val countdownTextColor =') > provider.index('if (showCountdown) {'):
    raise SystemExit('countdownTextColor is still scoped inside showCountdown')
if 'views.setTextColor(R.id.widget_following_countdown, countdownTextColor)' not in provider:
    raise SystemExit('Following-prayer countdown color binding missing')

provider_path.write_text(provider, encoding='utf-8')

# Future-proof the generator so re-running it does not recreate the scope bug.
script = apply_script_path.read_text(encoding='utf-8')
old_injected = '          views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, countdownSp)\\n          val countdownTextColor = if (theme == "ivory") Color.rgb(181, 126, 42) else Color.rgb(242, 201, 111)\\n          views.setTextColor(R.id.widget_countdown, countdownTextColor)'
new_injected = '          views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, countdownSp)\\n          views.setTextColor(R.id.widget_countdown, countdownTextColor)'
if old_injected in script:
    script = script.replace(old_injected, new_injected, 1)

script_delay_anchor = "# Full widget uses one clean following-prayer strip instead of five tiny prayer boxes.\n"
outer_patch = '''# Keep the contrasting countdown color in the outer prayer scope because the\n# following-prayer row uses the same accent even when the primary countdown is hidden.\nprovider = provider.replace(\n    '        val delay = (next.targetMillis - System.currentTimeMillis()).coerceAtLeast(0L)\\n        if (showCountdown) {',\n    '        val delay = (next.targetMillis - System.currentTimeMillis()).coerceAtLeast(0L)\\n        val countdownTextColor = if (theme == "ivory") Color.rgb(181, 126, 42) else Color.rgb(242, 201, 111)\\n        if (showCountdown) {',\n    1\n)\n\n'''
if 'Keep the contrasting countdown color in the outer prayer scope' not in script:
    if script_delay_anchor not in script:
        raise SystemExit('Generator insertion anchor missing')
    script = script.replace(script_delay_anchor, outer_patch + script_delay_anchor, 1)

apply_script_path.write_text(script, encoding='utf-8')
print('Fixed widget countdown color scope in provider and generator.')
