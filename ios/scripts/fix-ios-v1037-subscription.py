from pathlib import Path
p=Path('src/prayerCalculationSettings.ts')
s=p.read_text(encoding='utf-8')
old='  return () => listeners.delete(listener);'
new='  return () => { listeners.delete(listener); };'
if old not in s:
    raise SystemExit('subscription cleanup anchor missing')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('Fixed iOS v1.0.37 subscription cleanup return type')
