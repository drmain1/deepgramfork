# PDF Generation Refactor Plan

## Overview
This document outlines a complete refactor of the PDF generation system from client-side HTML rendering to server-side PDF generation with proper table handling.

## Current Problems
- Complex regex-based table detection (700+ lines of fragile code)
- Client-side rendering inconsistencies with html2canvas
- Tables being cut off or improperly detected
- Hours spent on edge cases with diminishing returns
- 90% of PDFs are computer-read, but we're optimizing for print appearance

## Proposed Solution: Server-Side PDF Generation

### Architecture Changes

#### Before (Current)
```
LLM → Markdown Text → Table Detection (Regex) → HTML → Canvas → PDF (Client)
```

#### After (Proposed)
```
LLM → Structured Data → PDF Template → PDF (Server)
```

## Implementation Steps

### Phase 1: Backend Setup (Python/FastAPI)

#### 1.1 Install Dependencies
```bash
# Add to requirements.txt
reportlab==4.0.7          # Core PDF generation
pdfplumber==0.10.3        # PDF parsing/validation
python-multipart==0.0.6   # Already installed
pillow==10.1.0           # Image handling for logos
```

#### 1.2 Create PDF Service Structure
```
backend/
├── services/
│   └── pdf_service/
│       ├── __init__.py
│       ├── generator.py      # Main PDF generation logic
│       ├── templates.py      # Medical document templates
│       ├── table_builder.py  # Table-specific logic
│       └── styles.py         # Consistent styling
```

### Phase 2: Data Structure Design

#### 2.1 Update LLM Instructions
Instead of markdown tables, output structured JSON:
```javascript
// Update pain-management-eval.js
const structuredOutputInstructions = `
When generating tables, output in this JSON format:

{
  "motor_examination": {
    "upper_extremity": [
      {"muscle": "DELTOID", "right": "5/5", "left": "5/5"},
      {"muscle": "BICEPS", "right": "5/5", "left": "5/5"},
      // ... rest of muscles
    ],
    "lower_extremity": [
      {"muscle": "ILIOPSOAS", "right": "5/5", "left": "5/5"},
      // ... rest of muscles
    ]
  },
  "reflexes": {
    "deep_tendon": [
      {"reflex": "BICEPS", "right": "2+", "left": "2+"},
      // ... rest of reflexes
    ],
    "pathological": [
      {"reflex": "HOFFMAN", "right": "Negative", "left": "Negative"},
      // ... rest
    ]
  }
}
`;
```

#### 2.2 Create Type Definitions
```python
# backend/models/pdf_models.py
from pydantic import BaseModel
from typing import List, Optional

class MuscleStrength(BaseModel):
    muscle: str
    right: str
    left: str

class ReflexResult(BaseModel):
    reflex: str
    right: str
    left: str

class MotorExamination(BaseModel):
    upper_extremity: List[MuscleStrength]
    lower_extremity: List[MuscleStrength]

class ReflexExamination(BaseModel):
    deep_tendon: List[ReflexResult]
    pathological: List[ReflexResult]

class MedicalDocument(BaseModel):
    patient_name: str
    date_of_birth: str
    date_of_accident: Optional[str]
    date_of_treatment: str
    sections: dict
    motor_exam: Optional[MotorExamination]
    reflexes: Optional[ReflexExamination]
```

### Phase 3: PDF Generation Service

#### 3.1 Core Generator
```python
# backend/services/pdf_service/generator.py
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors

class MedicalPDFGenerator:
    def __init__(self):
        self.styles = self._create_styles()
        
    def generate_pdf(self, data: MedicalDocument) -> bytes:
        """Generate PDF from structured medical data"""
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        
        # Build document elements
        elements = []
        elements.extend(self._create_header(data))
        elements.extend(self._create_sections(data))
        
        if data.motor_exam:
            elements.extend(self._create_motor_tables(data.motor_exam))
            
        if data.reflexes:
            elements.extend(self._create_reflex_tables(data.reflexes))
        
        # Generate PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.read()
```

#### 3.2 Table Builder
```python
# backend/services/pdf_service/table_builder.py
def create_motor_strength_table(data: List[MuscleStrength], title: str):
    """Create a properly formatted motor strength table"""
    
    # Define table data
    table_data = [
        ['MUSCLE GROUP', 'RIGHT', 'LEFT'],  # Header
    ]
    
    for item in data:
        table_data.append([
            item.muscle,
            item.right,
            item.left
        ])
    
    # Create table with fixed column widths
    table = Table(table_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
    
    # Apply styling
    table.setStyle(TableStyle([
        # Header styling
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        
        # Data styling
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
        
        # Column alignment
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),  # Muscle names left-aligned
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),  # Values centered
    ]))
    
    return table
```

### Phase 4: API Endpoints

#### 4.1 PDF Generation Endpoint
```python
# backend/routers/pdf_router.py
from fastapi import APIRouter, HTTPException
from services.pdf_service import MedicalPDFGenerator

router = APIRouter()
generator = MedicalPDFGenerator()

@router.post("/api/generate-pdf")
async def generate_pdf(data: MedicalDocument):
    try:
        pdf_bytes = generator.generate_pdf(data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=medical_record.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-pdf-from-transcript")
async def generate_pdf_from_transcript(transcript: str, format: str = "structured"):
    """Generate PDF from raw transcript"""
    if format == "structured":
        # Parse structured JSON from transcript
        data = parse_structured_transcript(transcript)
    else:
        # Legacy markdown support
        data = convert_markdown_to_structured(transcript)
    
    return await generate_pdf(data)
```

### Phase 5: Frontend Changes

#### 5.1 Remove Client-Side PDF Generation
```javascript
// Remove these files:
// - src/components/pdfUtils.js (498 lines)
// - src/components/pdfTableUtils.js (309 lines)
// Total: 807 lines of complex code removed!

// Remove these dependencies from package.json:
// - "html2canvas": "^1.4.1"
// - "jspdf": "^3.0.1"
// - "html2pdf.js": "^0.10.3"
```

#### 5.2 Update PDF Generation Hook
```javascript
// src/hooks/usePdfGeneration.js
import { useState } from 'react';

export const usePdfGeneration = () => {
  const [loading, setLoading] = useState(false);
  
  const generatePDF = async (transcriptData) => {
    setLoading(true);
    try {
      // Send to backend
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transcriptData),
      });
      
      if (!response.ok) throw new Error('PDF generation failed');
      
      // Get PDF blob
      const blob = await response.blob();
      
      // Download or preview
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  return { generatePDF, loading };
};
```

### Phase 6: Alternative Solutions

#### Option A: Puppeteer (If you need exact HTML rendering)
```javascript
// backend/services/puppeteer_pdf.js
const puppeteer = require('puppeteer');

async function generatePDFFromHTML(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  const pdf = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: {
      top: '0.5in',
      right: '0.5in',
      bottom: '0.5in',
      left: '0.5in'
    }
  });
  
  await browser.close();
  return pdf;
}
```

**Pros**: Perfect HTML/CSS rendering
**Cons**: Heavy dependency (500MB+), slower, requires headless Chrome

#### Option B: WeasyPrint (Python HTML to PDF)
```python
# Install: pip install weasyprint
from weasyprint import HTML, CSS

def generate_pdf_from_html(html_string):
    # Convert HTML to PDF
    pdf = HTML(string=html_string).write_pdf(
        stylesheets=[CSS(string='''
            @page {
                size: Letter;
                margin: 0.5in;
            }
            table {
                border-collapse: collapse;
                width: 100%;
            }
            td, th {
                border: 1px solid black;
                padding: 8px;
            }
        ''')]
    )
    return pdf
```

**Pros**: Good HTML/CSS support, lighter than Puppeteer
**Cons**: Still HTML-based, some CSS limitations

### Phase 7: Migration Strategy

#### 7.1 Parallel Implementation
1. Keep existing client-side generation as fallback
2. Add feature flag for new server-side generation
3. Test with subset of users
4. Gradually migrate all users

#### 7.2 Data Migration
```python
# Convert existing markdown transcripts to structured format
def migrate_transcript(markdown_text):
    # Parse tables from markdown
    tables = extract_tables_from_markdown(markdown_text)
    
    # Convert to structured format
    structured_data = {
        'sections': parse_sections(markdown_text),
        'motor_exam': parse_motor_exam(tables),
        'reflexes': parse_reflexes(tables)
    }
    
    return structured_data
```

### Phase 8: Benefits of This Approach

1. **Reliability**: No more regex table detection - tables are data structures
2. **Performance**: Server-side generation is faster and more consistent
3. **Maintainability**: 800+ lines reduced to ~200 lines of clear code
4. **Flexibility**: Easy to add new table formats or document types
5. **Quality**: Professional PDF library ensures consistent output
6. **Computer-Readable**: Structure preserved for automated processing

### Phase 9: Timeline Estimate

- **Week 1**: Backend PDF service setup + basic templates
- **Week 2**: Structured data format + LLM instruction updates
- **Week 3**: Frontend integration + testing
- **Week 4**: Migration of existing documents + deployment

### Phase 10: Quick Win Alternative

If full refactor is too much, consider this minimal change:

```python
# Use server-side Puppeteer just for PDF generation
@router.post("/api/quick-pdf")
async def quick_pdf(html: str):
    # Take your existing HTML and render server-side
    pdf = await generate_pdf_from_html(html)
    return Response(content=pdf, media_type="application/pdf")
```

This removes client-side rendering issues while keeping your existing table detection logic.

## Conclusion

The current approach is fundamentally flawed because it tries to detect structure from formatted text. The solution is to preserve structure throughout the pipeline. This refactor will:

1. Eliminate 807 lines of fragile table detection code
2. Provide consistent, reliable PDF output
3. Support computer-readable PDFs natively
4. Reduce ongoing maintenance burden
5. Enable new features (templates, batch processing, etc.)

The investment in refactoring will pay off immediately in reduced debugging time and improved reliability.