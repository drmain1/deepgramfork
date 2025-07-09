# Multi-Visit PDF Generation Documentation

*Created: January 2025*  
*Last Updated: January 2025*

## Overview

This document describes the multi-visit PDF generation system that allows users to select multiple patient transcripts and generate a single, comprehensive PDF document containing all visits in chronological order.

## Architecture

### Frontend Components

#### 1. **Patient Transcript List** (`/my-vite-react-app/src/components/PatientTranscriptList.jsx`)
- Displays patient transcripts with multi-select checkboxes
- Provides "View Selected" and "Print Selected" buttons
- Manages bulk selection state

#### 2. **PDF Generation Hooks**
- **`usePdfGeneration.js`** - Main hook for PDF generation logic
  - Fetches transcript details if needed
  - Converts transcripts to structured format
  - Coordinates with backend API
  
- **`useServerPdfGeneration.js`** - Server-side PDF operations
  - `generateMultiVisitPDF()` - Generates PDF on server
  - `downloadMultiVisitPDF()` - Downloads generated PDF
  - `openMultiVisitPDFInNewTab()` - Opens PDF in new browser tab

### Backend Components

#### 1. **API Endpoint** (`/backend/routers/pdf_router.py`)
```python
POST /api/generate-multi-visit-pdf
```
Accepts `MultiVisitPDFRequest`:
- `visits`: List of `MedicalDocument` objects
- `patient_name`: String
- `include_watermark`: Boolean (default: False)
- `include_signature`: Boolean (default: True)

#### 2. **PDF Generator** (`/backend/services/pdf_service/weasyprint_generator.py`)

##### Visit Type Detection (lines 605-620)
```python
def _determine_visit_type(self, data: dict) -> str:
    """Determine visit type using explicit evaluation_type field"""
    # Check for explicit evaluation_type field (most reliable)
    evaluation_type = data.get('evaluation_type')
    if evaluation_type in ['initial', 'follow_up', 're_evaluation', 'final']:
        return evaluation_type
    
    # Fallback: look for indicators in content
    sections = data.get('sections', {})
    for section_content in sections.values():
        if isinstance(section_content, str):
            content_lower = section_content.lower()
            if 'follow' in content_lower and 'up' in content_lower:
                return 'follow_up'
            elif 'previously:' in content_lower and 'currently:' in content_lower:
                return 're_evaluation'
    return 'initial'
```

##### Visit Organization (lines 385-482)
The `_generate_multi_visit_html()` method handles:
1. **Sorting visits by date** (oldest first)
2. **Grouping by visit type** with section headers
3. **Applying appropriate templates** based on visit type
4. **Managing clinic info** (only on first page)
5. **Handling page breaks** between initial visits

## Visit Types and Templates

### 1. **Initial Examination** (`initial`)
- **Template**: Jinja2 initial exam template
- **Location**: `/backend/services/pdf_service/jinja_templates/initial_exam_template.html`
- **Features**: Full structured format with all sections
- **Display**: Complete patient and clinic information

### 2. **Follow-up Visits** (`follow_up`)
- **Template**: Legacy narrative format
- **Features**: Simple paragraph-based content
- **Display**: Under "FOLLOW-UP VISITS" section header
- **Numbering**: Sequential (Follow-up Visit #1, #2, etc.)

### 3. **Re-evaluations** (`re_evaluation`)
- **Template**: Jinja2 re-evaluation template
- **Location**: `/backend/services/pdf_service/jinja_templates/re_evaluation_template.html`
- **Features**: 
  - Progress visualization with bars
  - Consolidated physical findings table
  - Comparison formatting
- **Display**: Under "RE-EVALUATIONS" section header

### 4. **Final Examination** (`final`)
- **Template**: Uses initial exam template structure
- **Display**: Marked as "Final Examination"

## Multi-Visit PDF Structure

```
PATIENT NAME - MEDICAL RECORDS

[Clinic Information - First Page Only]

Initial Examination - [Date]
├── Full structured content
├── Patient demographics
├── All examination sections
└── Treatment plan

FOLLOW-UP VISITS
Follow-up Visit #1 - [Date]
└── Narrative content

Follow-up Visit #2 - [Date]
└── Narrative content

RE-EVALUATIONS
Re-evaluation - [Date]
├── Progress visualization
├── Outcome assessments with bars
├── Consolidated findings table
└── Updated treatment plan

FOLLOW-UP VISITS (continued)
Follow-up Visit #3 - [Date]
└── Narrative content
```

## Key Features

### 1. **Intelligent Clinic Info Management**
- Clinic information is automatically fetched from database
- Only displayed on the first page to avoid redundancy
- Removed from subsequent visits programmatically

### 2. **Chronological Organization**
- Visits sorted by date automatically
- Oldest visits appear first
- Maintains logical flow of patient care

### 3. **Section Headers**
- Visits grouped under appropriate headers
- Headers only appear once when that visit type first occurs
- Clear visual separation between visit types

### 4. **Visit Numbering**
- Follow-up visits numbered sequentially
- Re-evaluations not numbered (typically singular events)
- Initial and final exams labeled explicitly

### 5. **Page Break Logic**
- Page breaks only between multiple initial examinations
- Follow-up visits flow continuously
- Re-evaluations maintain document flow

## CSS Styling

The system uses `get_re_evaluation_css()` which includes:
- `.patient-header` - Main patient name header
- `.visit-container` - Individual visit wrapper
- `.visit-date-header` - Visit date and type headers
- `.follow-up-header` - Section header for follow-ups
- `.re-evaluation-header` - Section header for re-evaluations
- `.page-break` - Force new page between initials

## Special Templates

### Chiropractic Multiple Visits Profile
**Location**: `/my-vite-react-app/src/templates/llm-instructions/chiropractic-multiple-visits.js`

This special profile allows doctors to dictate multiple patients in a single session:
- Doctor says "new patient [name]" to start a new SOAP note
- Each patient becomes a separate paragraph
- Used for rapid documentation of multiple follow-up visits

## Workflow

1. **Selection Phase**
   - User selects multiple transcripts via checkboxes
   - Can use "Select All" for bulk operations

2. **Generation Phase**
   - Frontend fetches complete transcript data
   - Converts each to structured format
   - Sends array of visits to backend

3. **Processing Phase**
   - Backend sorts visits chronologically
   - Determines visit types
   - Applies appropriate templates
   - Injects clinic info (first page only)

4. **Rendering Phase**
   - WeasyPrint generates PDF from HTML
   - Applies professional medical CSS
   - Returns PDF bytes

5. **Delivery Phase**
   - PDF can be downloaded
   - Or opened in new tab for preview
   - Maintains patient privacy

## Error Handling

- Missing visit dates: Placed at beginning of document
- Unknown visit types: Default to 'initial' type
- Template rendering failures: Fallback to legacy format
- Empty visits array: Returns error to user

## Future Considerations

1. **Custom Visit Grouping**: Allow manual reordering
2. **Template Selection**: Let users choose templates per visit
3. **Cover Page**: Add summary statistics
4. **Table of Contents**: For documents with many visits
5. **Export Options**: Support for other formats (DOCX, etc.)