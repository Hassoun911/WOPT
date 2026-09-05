from pathlib import Path

HERE = Path(__file__).resolve().parent

# Preserve the proven v1.0.23 Adhan/camera/refresh hard-fix stack first.
base = HERE / "fix-v1023-adhan-refresh-hardfix-base.py"
exec(compile(base.read_text(encoding="utf-8"), str(base), "exec"), {"__file__": str(base), "__name__": "__main__"})

# Then apply the v1.0.24 runtime location repair and version bump.
v1024 = HERE / "fix-v1024-location-refresh.py"
exec(compile(v1024.read_text(encoding="utf-8"), str(v1024), "exec"), {"__file__": str(v1024), "__name__": "__main__"})
