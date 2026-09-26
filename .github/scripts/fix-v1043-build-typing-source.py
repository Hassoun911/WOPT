from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATCH = ROOT / ".github/scripts/fix-v1043-windsor-directory-and-nested-resume.py"

s = PATCH.read_text(encoding="utf-8")
old = '  return rows.filter((row): row is MosqueRow => Boolean(row));'
new = '''  const cleanRows: MosqueRow[] = [];
  for (const row of rows) {
    if (row) cleanRows.push(row);
  }
  return cleanRows;'''

if old in s:
    s = s.replace(old, new, 1)
elif 'const cleanRows: MosqueRow[] = [];' not in s:
    raise SystemExit("Could not locate v1.0.43 trusted mosque TypeScript filter")

PATCH.write_text(s, encoding="utf-8")
print("HASSOUN_V1043_BUILD_TYPING_SOURCE_FIXED")
