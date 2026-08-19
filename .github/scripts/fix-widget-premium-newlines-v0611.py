from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
path = ROOT / "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt"
text = path.read_text(encoding="utf-8")

pairs = [
    ('"$arabic  •  $name\n$time"', '"$arabic  •  $name\\n$time"'),
    ('"$name  •  $arabic\n$time"', '"$name  •  $arabic\\n$time"'),
    ('"$name\n$time"', '"$name\\n$time"'),
    ('"$name\n$arabic\n$time"', '"$name\\n$arabic\\n$time"'),
]
changed = 0
for old, new in pairs:
    count = text.count(old)
    if count:
        text = text.replace(old, new)
        changed += count

if changed == 0:
    raise RuntimeError("No malformed widget strings were found to repair")
path.write_text(text, encoding="utf-8")
print(f"Fixed {changed} malformed Kotlin widget strings")
