# Re-Evaluation PDF Generation Documentation
**Date: July 14, 2025**
**Last Updated: July 15, 2025 - Added table visibility controls and UI improvements**

## Overview
This document describes the current re-evaluation functionality, dependencies, and PDF generation process for the medical transcription system.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Key Components](#key-components)
3. [Data Flow](#data-flow)
4. [Dependencies](#dependencies)
5. [Re-Evaluation Features](#re-evaluation-features)
6. [PDF Generation Process](#pdf-generation-process)
7. [Template Structure](#template-structure)
8. [Known Issues and Fixes](#known-issues-and-fixes)

## Architecture Overview

The re-evaluation PDF generation system consists of several layers:
- **Frontend**: Sends transcription data via API
- **Backend API**: Processes and validates data using Pydantic models
- **Template Preprocessor**: Parses comparison data and prepares it for rendering
- **Jinja2 Templates**: HTML templates with dynamic content
- **WeasyPrint**: Converts HTML to PDF with CSS styling

## Key Components

### 1. Models (`/backend/models.py`)
```python
- MedicalDocument: Main data structure containing:
  - evaluation_type: "re_evaluation" for re-evaluation visits
  - patient_info: Patient demographics
  - clinic_info: Clinic header information
  - sections: Dictionary of medical findings
  - motor_exam: Motor examination data
  - reflexes: Reflex examination data
  - cranial_nerve_examination: Cranial nerve findings (List[CranialNerveExamination])
  - postural_and_gait_analysis: Postural/gait assessment

- CranialNerveExamination: Pydantic model with field aliasing
  - cranial_nerve: str = Field(..., alias="nerve")  # Internal field name
  - finding: Optional[str] = None  # For initial evaluations
  - previous_finding: Optional[str] = None  # For re-evaluations
  - current_finding: Optional[str] = None  # For re-evaluations
  Note: Accepts "nerve" in JSON but stores as "cranial_nerve" internally
```

### 2. Template Preprocessor (`/backend/services/pdf_service/template_preprocessor.py`)
- `prepare_re_evaluation_data_for_template()`: Main preprocessing function for re-evaluations
  - Parses comparison data in format: "Previously X | Currently Y"
  - Calculates improvement percentages and comparison statuses
  - Creates `_parsed` versions of data for template consumption
  - Handles flexible JSON structure (fields at root or in sections)
  - Skips processing when motor_exam or reflexes data is null
  - **NEW**: Adds `all_not_documented` flags for table visibility control

- `prepare_initial_exam_data_for_template()`: Preprocessing for initial examinations
  - **NEW**: Handles Pydantic field aliasing for cranial nerves
  - Checks both "nerve" and "cranial_nerve" field names
  - Normalizes output to always use "nerve" for template compatibility
  - Preserves existing findings without overwriting

### 3. WeasyPrint Generator (`/backend/services/pdf_service/weasyprint_generator.py`)
- `WeasyPrintMedicalPDFGenerator`: Main PDF generation class
- Auto-detects re-evaluation visits using `evaluation_type` field
- Routes to appropriate Jinja2 template
- Handles font registration and CSS styling
- **NEW**: Contains custom Jinja2 filters (e.g., `strip_denominator`)

### 4. Re-Evaluation Template (`/backend/services/pdf_service/jinja_templates/re_evaluation_template.html`)
- Jinja2 HTML template with embedded CSS
- Renders comparison tables and progress visualizations
- Includes status icons and improvement indicators
- **NEW**: Checks `all_not_documented` flags before rendering tables
- **NEW**: Uses combined status column for motor/reflexes
- **NEW**: Applies `strip_denominator` filter to motor values

### 5. LLM Instructions (`/my-vite-react-app/src/templates/llm-instructions/chiropractic-followup.js`)
- Contains instructions for how LLM should format re-evaluation data
- Specifies comparison format: "Previously X | Currently Y"
- **NEW**: Updated carry-forward rules to prevent ROM data persistence

### 6. Extraction Prompts (`/backend/extraction_prompts_simple.py`)
- **NEW**: Contains separate prompts for initial vs re-evaluation
- `SIMPLE_RE_EVALUATION_PROMPT`: Specific instructions for re-evaluations
- Prevents LLM from using injected previous findings as current data

### 7. PDF Router (`/backend/routers/pdf_router.py`)
- Handles API endpoints for PDF generation
- Routes to appropriate generator based on request type
- **NEW**: Enhanced logging for debugging data flow

## Data Flow

### Single Visit PDF Generation
1. **Frontend sends JSON data** → `/api/generate-pdf` endpoint
2. **PDF Router** validates data using Pydantic models
3. **WeasyPrint Generator** detects evaluation type (initial/re-evaluation)
4. **Template Preprocessor** prepares data for template
5. **Jinja2 Template** renders HTML with tables and styling
6. **WeasyPrint** converts HTML to PDF
7. **PDF uploaded to GCS** and URL returned

### Multi-Visit PDF Generation
1. **Frontend sends array of visits** → `/api/generate-multi-visit-pdf` endpoint
2. **PDF Router** converts each visit using `model_dump(exclude_unset=True)`
3. **WeasyPrint Generator** processes each visit:
   - Sorts visits by date
   - Determines visit type for each
   - Routes to appropriate template
4. **For Initial Examinations**:
   - Data passes through `prepare_initial_exam_data_for_template()`
   - Handles Pydantic field aliasing (nerve/cranial_nerve)
   - Preserves original findings
5. **For Re-Evaluations**:
   - Data passes through `prepare_re_evaluation_data_for_template()`
   - Parses comparison format
   - Calculates status indicators
6. **Combined HTML generated** with all visits
7. **PDF created and returned**

## Dependencies

### Python Packages
```python
- weasyprint==60.1        # PDF generation engine
- Jinja2==3.1.2          # Template engine
- pydantic==2.5.0        # Data validation
- google-cloud-storage    # File storage
```

### System Dependencies
```bash
- pango                   # Text rendering
- cairo                   # Graphics rendering
- gdk-pixbuf             # Image handling
- libffi                 # Foreign function interface
- Besley-Regular.ttf     # Custom font (optional)
```

## Re-Evaluation Features

### 1. Comparison Data Format
All comparison fields follow the pattern:
- Initial evaluation: Single value (e.g., "4/5")
- Re-evaluation: "Previously X | Currently Y" format

### 2. Supported Comparisons

#### Chief Complaints
- Pain scores with previous/current values
- Status indicators: improved (↓), worsened (↑), resolved (✓)

#### Outcome Assessments
- Functional outcome scores (e.g., NDI, Oswestry)
- Visual progress bars showing disability percentages
- Improvement percentage calculations

#### Physical Examination
- **Cervical ROM**: 6 movements with comparison status
- **Lumbar ROM**: 6 movements with comparison status
- **Orthopedic Tests**: Test results (positive/negative) with changes

#### Neurological Examination
- **Motor Exam**: Muscle strength (0-5/5 scale) for upper/lower extremities
  - **NEW**: Displays as two separate tables (Upper Extremity, Lower Extremity)
  - **NEW**: Tables only appear when data exists (null data = no tables)
- **Reflexes**: Deep tendon and pathological reflexes (0-4+ scale)
  - **NEW**: Displays as two separate tables (Deep Tendon, Pathological)
  - **NEW**: Tables only appear when data exists (null data = no tables)
- **Cranial Nerves**: 12 cranial nerves with findings
- **Sensory**: Narrative description of sensory changes

### 3. Status Indicators
- ✓ Improved/Resolved
- ↑ Worsened  
- → Unchanged
- ● New finding
- ~ Changed (non-directional)

### 4. Combined Status Logic (Motor/Reflexes)
When both left and right sides are evaluated, the combined status follows this priority:
1. **Improved (✓)**: If either/both sides improved AND none worsened
2. **Worsened (↑)**: If either/both sides worsened (takes priority)
3. **Changed (~)**: If one side improved and the other worsened
4. **New (●)**: If either side is a new finding
5. **Unchanged (→)**: If both sides are unchanged
6. **Changed (~)**: Any other mixed status combination

## PDF Generation Process

### Step 1: Data Validation
```python
# PDF router validates incoming data
pdf_request = PDFGenerationRequest(
    transcript=transcript,
    format_type="structured",
    include_watermark=False,
    include_signature=True
)
```

### Step 2: Re-Evaluation Detection
```python
def _is_re_evaluation_data(self, data: Dict[str, Any]) -> bool:
    # Primary check: explicit evaluation_type
    if data.get('evaluation_type') == 're_evaluation':
        return True
    
    # Fallback: check for comparison format in content
    # Looks for "Previously:" and "Currently:" patterns
```

### Step 3: Template Preprocessing
```python
# Parse comparison data and calculate statuses
preprocessed_data = prepare_re_evaluation_data_for_template(data)

# Creates parsed fields:
- chief_complaint_parsed
- outcome_assessments_parsed
- cervical_rom_parsed + cervical_rom_all_not_documented
- lumbar_rom_parsed + lumbar_rom_all_not_documented
- cervico_thoracic_parsed + cervico_thoracic_all_not_documented
- lumbopelvic_parsed + lumbopelvic_all_not_documented
- extremity_parsed + extremity_all_not_documented
- motor_exam.upper_extremity_parsed + upper_extremity_all_not_documented
- motor_exam.lower_extremity_parsed + lower_extremity_all_not_documented
- reflexes.deep_tendon_parsed + deep_tendon_all_not_documented
- reflexes.pathological_parsed + pathological_all_not_documented
- cranial_nerve_examination_parsed + cranial_nerve_examination_all_not_documented
```

### Step 4: HTML Generation
```python
# Render Jinja2 template with preprocessed data
template = self.jinja_env.get_template('re_evaluation_template.html')
html_content = template.render(
    data=preprocessed_data,
    css_styles=css_styles
)
```

### Step 5: PDF Creation
```python
# Convert HTML to PDF using WeasyPrint
html = HTML(string=html_content)
css = CSS(string=css_content, font_config=self.font_config)
html.write_pdf(buffer, stylesheets=[css])
```

## Template Structure

### Header Section
- Clinic information (right-aligned)
- "RE-EVALUATION REPORT" title
- Patient information bar

### Chief Complaint & Status
- Numbered list of complaints
- Current scores with status icons
- Previous scores in smaller text

### Objective Progress & Data
- **Functional Outcome Assessments**: Visual progress bars
- **Physical Examination Progress**: Comparison tables
- **Neurological Examination Progress**: Multi-column tables

### Assessment & Plan
- Diagnosis list with ICD-10 codes
- Treatment plan
- Treatment performed today

## Known Issues and Fixes

### Issue 1: Missing Tables in PDF Output (FIXED)
**Problem**: Tables not rendering, falling back to basic template
**Cause**: Template error when `postural_and_gait_analysis` is None
**Fix**: Added null check before accessing nested properties
```jinja2
{% if data.postural_and_gait_analysis and (data.postural_and_gait_analysis.posture_general or data.postural_and_gait_analysis.gait_analysis) %}
```

### Issue 2: [object Object] in JSON Viewer
**Problem**: Objects display as "[object Object]" when switching between Plain Text and JSON views
**Cause**: JSON editor serialization issue when switching modes
**Impact**: Display only - does not affect PDF generation
**Workaround**: Disable JSON view for production

### Issue 3: Table Column Width
**Problem**: Tables may be cut off with fixed column widths
**Fix**: Removed fixed width constraints, using auto-layout
```css
table {
    width: 100%;
    table-layout: auto;
}
```

### Issue 4: JSON Structure Mismatch (FIXED)
**Problem**: ROM and orthopedic data at root level not being processed
**Cause**: Preprocessor expected all data inside `sections` object
**Fix**: Added flexible data structure handling in preprocessor
```python
# Moves root-level fields into sections if needed
fields_to_move = ["cervical_rom", "lumbar_rom", "outcome_assessments", ...]
```

### Issue 5: key_field Variable Scope Error (FIXED)
**Problem**: "cannot access local variable 'key_field' where it is not associated with a value"
**Cause**: Variable defined inside conditional block but used outside
**Fix**: Moved variable definition outside the conditional
```python
key_field = "muscle" if exam_type == "motor_exam" else "reflex"
```

### Issue 6: Empty Tables Showing When Data is Null (FIXED)
**Problem**: Motor exam and reflexes tables showing with "Not Documented" when data is null
**Cause**: Preprocessor was creating parsed data even for null inputs
**Fix**: Skip processing entirely when exam data is null
```python
if data.get(exam_type) is None:
    continue  # Skip processing
```

### Issue 7: Initial Exam Cranial Nerves Not Displaying (FIXED)
**Problem**: Initial examination cranial nerve table showing "Not tested" instead of actual findings in multi-visit PDFs
**Cause**: Pydantic model field aliasing issue
1. The `CranialNerveExamination` model uses `cranial_nerve` as the field name with `nerve` as an alias
2. When data comes in as `{"nerve": "CN I: Olfactory", "finding": "Intact"}`, Pydantic converts it to `{"cranial_nerve": "CN I: Olfactory", "finding": "Intact"}`
3. The template preprocessor was looking for "nerve" field and not finding it
4. This caused it to create default entries with "Not tested"
**Fix**: 
- Updated `prepare_initial_exam_data_for_template()` to handle both field names
- Preprocessor now checks for both "nerve" and "cranial_nerve" fields
- Always outputs "nerve" as the field name for template compatibility
- Preserves actual findings instead of defaulting to "Not tested"

## Configuration

### Environment Variables
```bash
# Google Cloud Storage
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# PDF Generation
PDF_FONT_PATH=/backend/fonts/Besley-Regular.ttf
```

### Clinic Information Setup
Clinic info can be configured in user settings:
- Multiple lines supported
- First line displayed as clinic name (larger font)
- Subsequent lines for address, phone, etc.

## Testing

### Manual Testing Steps
1. Create a re-evaluation visit with comparison data
2. Verify JSON structure includes:
   - `evaluation_type: "re_evaluation"`
   - Comparison format in sections
   - Motor/reflex data with Previous/Current values
3. Generate PDF and verify:
   - All tables render correctly
   - Status icons display properly
   - Progress bars show correct percentages
   - No missing sections

### Common Test Cases
- Re-evaluation with all sections populated
- Re-evaluation with missing optional sections
- Mixed improvement/worsening statuses
- New findings in re-evaluation

### Testing Table Visibility Features
1. **Test Empty Table Hiding**:
   - Create re-evaluation where lumbar ROM was not tested
   - Verify lumbar ROM table does not appear in PDF
   - Check logs for `lumbar_rom_all_not_documented: true`

2. **Test Combined Status Column**:
   - Create motor exam with mixed results (left improved, right worsened)
   - Verify single status shows "~" (changed)
   - Test all combinations of left/right status pairs

3. **Test Motor Value Display**:
   - Ensure motor values display without "/5"
   - Check that "4+/5" displays as "4+"
   - Verify filter doesn't affect non-motor values

## Future Enhancements

1. **Add True Charts/Graphs**
   - Implement matplotlib for bar/line charts
   - Show progress over multiple visits
   - Visual timeline of improvements

2. **Enhanced Status Calculations**
   - Configurable thresholds for improvement
   - Weighted scoring for multiple complaints
   - Trend analysis across visits

3. **Template Customization**
   - Allow clinic-specific templates
   - Configurable sections and ordering
   - Custom branding options

## Support

For issues or questions:
1. Check error logs in `/tmp/debug_*.log`
2. Verify data structure matches schema
3. Ensure all dependencies are installed
4. Test with sample data first

## Recent Updates

### July 15, 2025 Updates (Part 2)

#### Fixed Multi-Visit PDF Cranial Nerve Display Issue
1. **Pydantic Field Aliasing Problem**: Fixed issue where cranial nerve findings were showing as "Not tested" in multi-visit PDFs
   - Root cause: `CranialNerveExamination` model uses `cranial_nerve` field with `nerve` alias
   - Pydantic converts incoming `"nerve"` to `"cranial_nerve"` internally
   - Template preprocessor couldn't find the data with the transformed field name
   - Fix: Updated preprocessor to check both "nerve" and "cranial_nerve" field names
   - Now correctly preserves findings like "Intact" instead of defaulting to "Not tested"

### July 15, 2025 Updates (Part 1)

#### Fixed LLM Extraction Issues
1. **Previous Findings Injection Problem**: Fixed issue where LLM was incorrectly using injected previous findings as current findings
   - Added dedicated re-evaluation extraction prompt in `extraction_prompts_simple.py`
   - Clear directives that previous findings are for reference only
   - Explicit instruction: "If a test is NOT mentioned in the current transcript, do NOT assume it was performed"

2. **ROM Carry-Forward Issue**: Fixed issue where ROM findings were being carried forward when not tested
   - Updated `chiropractic-followup.js` instructions to clarify carry-forward rule
   - ROM sections must be set to `null` if not mentioned in current evaluation
   - Carry-forward rule now limited to specific orthopedic tests only

3. **Enhanced Logging**: Added comprehensive logging throughout the pipeline
   - PDF Router logs incoming data structure and evaluation type
   - Template Preprocessor logs full data transformation process
   - Extraction prompt selection based on evaluation type

#### Table Visibility and UI Improvements
4. **Empty Table Hiding**: Tables now automatically hide when all entries are "Not documented"
   - Added `all_not_documented` flags in template preprocessor for each section
   - Template checks these flags before rendering tables
   - Affected sections: ROM, Orthopedic Tests, Motor Exam, Reflexes, Cranial Nerves

5. **Simplified Status Columns**: Motor exam and reflexes tables now use single combined status
   - Removed separate "R" and "L" status columns
   - Single "Status" column shows overall change for both sides
   - Logic: Improved > Worsened > Changed (~) > New > Unchanged

6. **Motor Strength Display**: Removed "/5" denominator from motor values
   - Added custom Jinja2 filter `strip_denominator`
   - "5/5" now displays as "5", "4+/5" as "4+"
   - Cleaner, less cluttered appearance

7. **Cranial Nerve Examination Improvements**:
   - Added cranial nerve examination to extraction prompts (`extraction_prompts_simple.py`)
   - Initial evaluation format: `{"nerve": "CN I: Olfactory", "finding": "Intact"}`
   - Re-evaluation format: `{"nerve": "CN I: Olfactory", "previous_finding": "Intact", "current_finding": "Intact"}`
   - Fixed initial examination template to display cranial nerves in proper table format
   - Added preprocessing function `prepare_initial_exam_data_for_template()` to ensure all 12 cranial nerves are displayed
   - Applied preprocessing to both single PDF and multi-visit PDF generation

### July 14, 2025 Updates

#### Fixed Issues
1. **JSON Structure Flexibility**: Preprocessor now handles data at root level or in sections
2. **Variable Scope Error**: Fixed key_field scope issue in motor/reflex processing
3. **Empty Table Handling**: Tables no longer appear when data is null
4. **Table Separation**: Motor exam and reflexes now display as separate tables by category

#### Enhanced Features
- Motor Examination split into Upper Extremity and Lower Extremity tables
- Reflexes split into Deep Tendon and Pathological tables
- Improved null data handling - tables only show when data exists
- Better error handling with fallback to standard template

## Technical Implementation Details

### Table Visibility Control Implementation

#### Files Modified:
1. **`/backend/services/pdf_service/template_preprocessor.py`**
   - Added `all_not_documented` flags for each section
   - Logic checks if all entries have both previous and current as "Not documented"
   - Example for ROM:
   ```python
   all_not_documented = all(
       item["previous_state"].lower() in ["not documented", "not tested"] and 
       item["current_state"].lower() in ["not documented", "not tested"]
       for item in processed_rom
   )
   data["sections"][f"{rom_key}_all_not_documented"] = all_not_documented
   ```

2. **`/backend/services/pdf_service/jinja_templates/re_evaluation_template.html`**
   - Template checks flag before rendering each table
   - Example: `{% if data.sections.lumbar_rom_parsed and not data.sections.lumbar_rom_all_not_documented %}`

### Combined Status Column Implementation

#### Template Changes:
- Replaced individual R/L status columns with single Status column
- Logic prioritizes: Improved > Worsened > Changed > New > Unchanged
- Example template code:
```jinja2
{% if right_status == "improved" or left_status == "improved" %}
    {% if right_status == "worsened" or left_status == "worsened" %}
        {{ status_icon("changed") }}
    {% else %}
        {{ status_icon("improved") }}
    {% endif %}
{% elif right_status == "worsened" or left_status == "worsened" %}
    {{ status_icon("worsened") }}
...
```

### Motor Strength Display Filter

#### Files Modified:
1. **`/backend/services/pdf_service/weasyprint_generator.py`**
   - Added custom Jinja2 filter: `_strip_denominator`
   - Registered filter in `_setup_jinja_environment`
   ```python
   def _strip_denominator(self, value: str) -> str:
       """Strip /5 from motor strength values"""
       if value.endswith('/5'):
           return value[:-2]
       return value
   ```

2. **Template Usage**:
   - Applied filter to all motor value displays
   - Example: `{{ muscle.right_current|strip_denominator }}`

## Debugging Tips

### Checking LLM Behavior
1. Enable backend logging to see full data flow
2. Look for these log markers:
   - `=== PDF ROUTER ===` - Shows incoming data structure
   - `=== TEMPLATE PREPROCESSOR ===` - Shows data transformation
   - `Transcript evaluation_type:` - Confirms correct prompt selection

### Common Issues and Solutions

#### Issue: LLM includes previous findings when test not performed
**Solution**: Ensure evaluation_type is correctly set and re-evaluation prompt is being used

#### Issue: ROM data carried forward incorrectly
**Solution**: Check that LLM instructions explicitly state to set ROM to null when not tested

#### Issue: Tables showing when all data is "Not documented"
**Solution**: Check that `all_not_documented` flags are being set in preprocessor and checked in template

#### Issue: Motor values showing with "/5"
**Solution**: Ensure `strip_denominator` filter is registered and applied in template

#### Issue: Cranial nerves showing "Not tested" in multi-visit PDFs
**Solution**: Check for Pydantic field aliasing - preprocessor must handle both "nerve" and "cranial_nerve" field names

---
*Last Updated: July 15, 2025*