# PDF Generation System Documentation

## Overview
The application now uses a **server-side PDF generation system** that processes structured JSON data from the LLM (Gemini) to create professional medical PDFs. This replaces the old client-side approach that parsed markdown tables.

## System Architecture

### Flow Diagram
```
1. Voice Input → Deepgram → Original Transcript
2. Original Transcript + LLM Instructions → Gemini AI → Structured JSON
3. Structured JSON → Backend PDF Service → PDF File
```

### Key Components

#### Backend Structure
```
backend/
├── routers/
│   └── pdf_router.py              # PDF API endpoints
├── services/
│   └── pdf_service/
│       ├── __init__.py           # Service exports
│       ├── generator.py          # Main PDF generation logic
│       ├── styles.py            # PDF styling configuration
│       ├── table_builder.py     # Table generation utilities
│       └── templates.py         # Medical document templates
├── models.py                    # Pydantic models for validation
└── gcp_utils.py                # Gemini AI integration (with JSON cleanup)
```

#### Frontend Structure
```
my-vite-react-app/src/
├── hooks/
│   └── useServerPdfGeneration.js     # Hook for server PDF calls
├── components/
│   ├── EditableNote.jsx              # Updated to use server PDF
│   └── FormattedMedicalText.jsx      # Displays structured JSON nicely
└── templates/
    └── llm-instructions/
        └── pain-management-eval-structured.js  # JSON output instructions
```

## Dependencies

### Backend Dependencies (requirements.txt)
```
reportlab==4.0.7      # Core PDF generation library
pdfplumber==0.10.3    # PDF parsing/validation
pillow==10.1.0        # Image handling for logos/signatures
```

### Frontend Changes
- Removed dependency on client-side PDF generation
- No longer needs: html2canvas, jspdf

## API Endpoints

### 1. Generate PDF from Structured Data
```
POST /api/generate-pdf
Body: MedicalDocument (JSON)
Response: PDF file (application/pdf)
```

### 2. Generate PDF from Transcript
```
POST /api/generate-pdf-from-transcript
Body: {
  transcript: string (JSON or markdown),
  format_type: "structured" | "markdown",
  include_watermark: boolean,
  include_signature: boolean
}
Response: PDF file (application/pdf)
```

### 3. Generate PDF Preview
```
POST /api/generate-pdf-preview
Body: MedicalDocument (JSON)
Response: { pdf_data: base64, filename: string }
```

## Data Models

### MedicalDocument Structure
```typescript
{
  patient_info: {
    patient_name: string,
    date_of_birth?: string,
    date_of_accident?: string,
    date_of_treatment?: string,
    provider?: string
  },
  clinic_info?: {
    name?: string,
    address?: string,
    phone?: string,
    fax?: string
  },
  sections: {
    chief_complaint?: string,
    history_of_present_illness?: string,
    past_medical_history?: string,
    // ... other sections
  },
  motor_exam?: {
    upper_extremity: Array<{muscle, right, left}>,
    lower_extremity: Array<{muscle, right, left}>
  },
  reflexes?: {
    deep_tendon: Array<{reflex, right, left}>,
    pathological: Array<{reflex, right, left}>
  }
}
```

## Key Implementation Details

### 1. LLM Instructions (pain-management-eval-structured.js)
- Instructs Gemini to output pure JSON (no markdown wrapping)
- Defines exact schema for consistent output
- Maps transcript content to structured fields

### 2. Backend JSON Cleanup (gcp_utils.py)
- Strips markdown code blocks if Gemini adds them
- Removes outer quotes if present
- Ensures valid JSON for parsing

### 3. PDF Generation (generator.py)
- Uses ReportLab for professional PDF creation
- Generates proper tables for motor exams and reflexes
- Supports clinic logos and doctor signatures
- No markdown parsing required

### 4. Frontend Display (FormattedMedicalText.jsx)
- Detects structured JSON vs markdown
- Renders JSON as formatted medical document
- Shows tables using Material-UI components

## Files That Can Be Deleted

Once fully migrated and tested, these files can be removed:

### Frontend Files to Delete
```
src/components/pdfUtils.js              # 498 lines - Old PDF generation
src/components/pdfTableUtils.js         # 309 lines - Table parsing utilities
src/hooks/usePdfGeneration.js          # Old PDF hook (if not used elsewhere)
```

### Dependencies to Remove from package.json
```json
"html2canvas": "^x.x.x",
"jspdf": "^x.x.x"
```

### Backend Files
- No backend files need deletion (all new additions)

## Styling Improvements Needed

### Current Issues
1. **Table Styling**: Tables in PDF need better spacing and borders
2. **Font Consistency**: Ensure consistent fonts throughout PDF
3. **Header/Footer**: Add page numbers and consistent headers
4. **Margins**: Adjust margins for better readability
5. **Section Spacing**: Improve spacing between sections

### Suggested Improvements (in styles.py)
```python
# Better table styling
table_style = TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 10),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
])
```

## Testing Checklist

- [x] Basic PDF generation works
- [x] Structured JSON is properly formatted in UI
- [x] Motor exam tables appear in PDF
- [x] Reflex tables appear in PDF
- [ ] Logo appears when configured
- [ ] Signature appears when configured
- [ ] Multi-page documents work correctly
- [ ] Special characters in patient names handled
- [ ] Error handling for malformed JSON

## Migration Status

### ✅ Completed
- Pain Management template uses structured JSON
- Backend PDF service fully functional
- Frontend displays structured data properly
- PDF downloads work correctly

### 🔄 In Progress
- PDF styling improvements
- Testing other medical templates

### ❌ TODO
- Migrate other templates to structured format
- Update billing statement generation
- Update PDF preview modal
- Remove old client-side code
- Add comprehensive error handling

## Notes for Next Developer

1. **The system is functional** - PDFs generate correctly from structured JSON
2. **Main focus needed**: Styling improvements in `services/pdf_service/styles.py`
3. **Do NOT modify**: The LLM instructions or JSON structure without careful testing
4. **Test with**: Pain Management template first (it's fully migrated)
5. **Backend restart required**: After any Python file changes
6. **Frontend hot-reloads**: But clear browser cache if issues persist

## Common Issues & Solutions

### Issue: PDF shows raw JSON
**Solution**: Check that FormattedMedicalText.jsx is properly parsing the JSON

### Issue: 422 Error on PDF generation
**Solution**: Check that all required fields in MedicalDocument model are present

### Issue: Multiple Content-Disposition headers
**Solution**: Already fixed - ensure quotes around filename in headers

### Issue: Tables not appearing in PDF
**Solution**: Check that motor_exam and reflexes are properly structured arrays