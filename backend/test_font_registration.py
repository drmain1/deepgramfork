#!/usr/bin/env python3
"""Test font registration"""

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pathlib import Path

# Get the fonts directory path
fonts_dir = Path(__file__).parent / "fonts"
besley_path = fonts_dir / "Besley-Regular.ttf"

print(f"Looking for font at: {besley_path}")
print(f"Font exists: {besley_path.exists()}")

if besley_path.exists():
    print(f"Font file size: {besley_path.stat().st_size} bytes")
    
    # Try to register font
    try:
        pdfmetrics.registerFont(TTFont('Besley', str(besley_path)))
        print("Font registered successfully!")
        
        # Check registered fonts
        print("\nRegistered fonts:")
        for font_name in pdfmetrics.getRegisteredFontNames():
            print(f"  - {font_name}")
    except Exception as e:
        print(f"Error registering font: {e}")
else:
    print("Font file not found!")