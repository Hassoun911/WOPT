from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATCH = ROOT / ".github/scripts/fix-v1044-gps-prayer-mosque-display.py"

s = PATCH.read_text(encoding="utf-8")

# v1.0.39 already changed the Nearby Mosques subtitle, so v1.0.44 must target
# the current generated text rather than the older v1.0.37 sentence.
s = s.replace(
    "    'Choose where Hassoun should anchor your prayer times.',\n    'Find, save and navigate to nearby mosques. Prayer times always stay based on your phone GPS.',",
    "    'Mosques around your current GPS location, sorted by distance. Tap a mosque to use its location for prayer times.',\n    'Find, save and navigate to nearby mosques. Prayer times always stay based on your phone GPS.',",
    1,
)

# Keep the Arabic Nearby Mosques copy aligned with the GPS-only prayer rule.
needle = "mosques = mosques.replace(\n    'GPS remains the default. If you select a mosque, Hassoun uses a trusted official timetable when one is available; otherwise it calculates from that mosque’s exact coordinates. Windsor official data is only used for Windsor-area coordinates.',\n    'Mosques are shown for location, distance and directions only. Selecting a mosque never changes the prayer-time calculation. Hassoun always decides prayer times from your phone GPS.',\n    1,\n)\n"
if needle in s and 'المساجد حول موقع GPS الحالي مرتبة حسب المسافة' not in s[s.find(needle):s.find(needle)+1800]:
    extra = needle + "mosques = mosques.replace(\n    'المساجد حول موقع GPS الحالي مرتبة حسب المسافة. اضغط على مسجد لاستخدام موقعه لمواقيت الصلاة.',\n    'المساجد حول موقع GPS الحالي مرتبة حسب المسافة. اختيار المسجد للموقع والمسافة والاتجاهات فقط ولا يغيّر مواقيت الصلاة.',\n    1,\n)\nmosques = mosques.replace(\n    'يبقى GPS هو الخيار الافتراضي. إذا اخترت مسجداً، يستخدم حسون جدولاً رسمياً موثوقاً عند توفره، وإلا يحسب المواقيت من إحداثيات المسجد الدقيقة. بيانات وندسور الرسمية لا تُستخدم إلا ضمن منطقة وندسور.',\n    'المساجد للموقع والمسافة والاتجاهات فقط. اختيار مسجد لا يغيّر مواقيت الصلاة، وحسون يعتمد دائماً على GPS للهاتف لتحديد مصدر المواقيت.',\n    1,\n)\n"
    s = s.replace(needle, extra, 1)

# v1.0.39 also changed the Prayer Calculation navigation-card wording. Make
# that current text explicitly directory/navigation only as requested.
calc_anchor = 'CALC.write_text(calc, encoding="utf-8")\n'
if calc_anchor in s and 'Selected mosque: ${prefs.selectedMosque.name}. Prayer times still use phone GPS.' not in s:
    calc_extra = '''calc = calc.replace(\n    'Using ${prefs.selectedMosque.name} as your prayer location. Tap to change.',\n    'Selected mosque: ${prefs.selectedMosque.name}. Prayer times still use phone GPS. Tap to change.',\n    1,\n)\ncalc = calc.replace(\n    'Open a list of mosques around your GPS location and choose one if you want.',\n    'Open nearby mosques for location, distance and directions. Prayer times continue to use phone GPS.',\n    1,\n)\ncalc = calc.replace(\n    'يتم استخدام ${prefs.selectedMosque.name} كموقع للصلاة. اضغط للتغيير.',\n    'المسجد المحدد: ${prefs.selectedMosque.name}. مواقيت الصلاة ما زالت تعتمد على GPS. اضغط للتغيير.',\n    1,\n)\ncalc = calc.replace(\n    'افتح قائمة المساجد حول موقع GPS واختر مسجداً إذا أردت.',\n    'افتح المساجد القريبة للموقع والمسافة والاتجاهات. مواقيت الصلاة تستمر بالاعتماد على GPS.',\n    1,\n)\n'''
    s = s.replace(calc_anchor, calc_extra + calc_anchor, 1)

if "Prayer times always stay based on your phone GPS" not in s:
    raise SystemExit("v1.0.44 source fix did not install the current Nearby Mosques target")
if "Selected mosque: ${prefs.selectedMosque.name}. Prayer times still use phone GPS." not in s:
    raise SystemExit("v1.0.44 source fix did not install Prayer Calculation mosque copy")

PATCH.write_text(s, encoding="utf-8")
print("HASSOUN_V1044_BUILD_SOURCE_FIXED")
