from pathlib import Path
import runpy

script = Path(__file__).with_name("fix-hassoun-current-v2.py")
runpy.run_path(str(script), run_name="__main__")
