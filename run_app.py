import subprocess
import sys
import pathlib

# Resolve the path to app.py relative to this script
app_path = pathlib.Path(__file__).parent / "app.py"

# Run the Streamlit app
subprocess.run([sys.executable, "-m", "streamlit", "run", str(app_path)])
