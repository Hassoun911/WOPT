from pathlib import Path

config = Path('mobile/app.config.ts')
text = config.read_text(encoding='utf-8')
text = text.replace('version: "0.4.8"', 'version: "0.4.9"')
text = text.replace('versionCode: 20', 'versionCode: 21')
config.write_text(text, encoding='utf-8')

workflow = Path('.github/workflows/android-debug.yml')
text = workflow.read_text(encoding='utf-8')
text = text.replace('# Rebuild after Hijri date correction', '# Rebuild after Hijri and Quran appearance safe-area corrections')
text = text.replace('Hassoun-v0.4.8.apk', 'Hassoun-v0.4.9.apk')
text = text.replace('hassoun-v0.4.8-${{ github.run_number }}', 'hassoun-v0.4.9-${{ github.run_number }}')
workflow.write_text(text, encoding='utf-8')

print('Bumped Hassoun to v0.4.9 / versionCode 21')
