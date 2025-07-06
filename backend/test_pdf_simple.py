#!/usr/bin/env python3
"""Simple test to debug PDF generation"""

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
import io

# Create simple PDF
buffer = io.BytesIO()
doc = SimpleDocTemplate(buffer, pagesize=letter)
styles = getSampleStyleSheet()

# Create elements
elements = []
elements.append(Paragraph("Test PDF Document", styles['Title']))
elements.append(Spacer(1, 0.5*inch))
elements.append(Paragraph("This is a test paragraph.", styles['Normal']))

print(f"Number of elements: {len(elements)}")

# Build PDF
doc.build(elements)

# Check size
buffer.seek(0)
pdf_bytes = buffer.read()
print(f"PDF size: {len(pdf_bytes)} bytes")

# Save to file
with open("test_simple.pdf", "wb") as f:
    f.write(pdf_bytes)
print("Saved to test_simple.pdf")