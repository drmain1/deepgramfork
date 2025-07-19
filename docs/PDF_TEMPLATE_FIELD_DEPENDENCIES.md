# PDF Template Field Dependencies Guide

This document maps out the complete dependency chain for adding, modifying, or removing fields in the PDF generation system. There are 7 key files that must be updated in sync when making changes to PDF fields.

## Overview of the PDF Generation Flow

```
1. LLM Instructions (JS) → 2. Backend Processing (Python) → 3. PDF Templates (HTML)
```

## The 7 Critical Files

### 1. LLM Instructions - Initial Exam
**File:** `/my-vite-react-app/src/templates/llm-instructions/chiropractic-comprehensive-initial.js`
- **Purpose:** Defines the JSON schema and extraction rules for initial examinations
- **Key Section:** The `sections` object within the target JSON schema

### 2. LLM Instructions - Re-evaluation
**File:** `/my-vite-react-app/src/templates/llm-instructions/chiropractic-followup.js`
- **Purpose:** Defines the JSON schema and extraction rules for re-evaluations
- **Key Section:** The `sections` object within the target JSON schema

### 3. Template Preprocessor
**File:** `/backend/services/pdf_service/template_preprocessor.py`
- **Purpose:** Preprocesses data before template rendering, handles field movement
- **Key Section:** `fields_to_move` list (around line 79-85)

### 4. WeasyPrint Generator
**File:** `/backend/services/pdf_service/weasyprint_generator.py`
- **Purpose:** Handles multi-visit PDF generation and field organization
- **Key Section:** `fields_to_move` list (around line 537-543)

### 5. Initial Exam PDF Template
**File:** `/backend/services/pdf_service/jinja_templates/initial_exam_template.html`
- **Purpose:** HTML template for initial examination PDFs
- **Key Section:** The main body content where sections are rendered

### 6. Re-evaluation PDF Template
**File:** `/backend/services/pdf_service/jinja_templates/re_evaluation_template.html`
- **Purpose:** HTML template for re-evaluation PDFs
- **Key Section:** The main body content where sections are rendered

### 7. React Polished Note Display
**File:** `/my-vite-react-app/src/components/FormattedMedicalText.jsx`
- **Purpose:** React component that displays the formatted polished note in the UI
- **Key Section:** The sections rendering logic (around line 76) and specific sections after line 600

## How to Add a New Field

### Example: Adding a "home_care" field

#### Step 1: Update LLM Instructions (Initial)
```javascript
// File: chiropractic-comprehensive-initial.js
// In the sections object, add:
"home_care": "string | null"

// In the detailed instructions section, add:
- home_care: Document any home care instructions, exercises, stretches, or self-care recommendations provided to the patient. Include specific instructions for ice/heat application, frequency of exercises, activity modifications, ergonomic recommendations, or any other home-based treatments. Format as a paragraph with clear instructions (e.g., "Apply ice to the lower back for 15-20 minutes every 2-3 hours for the first 48 hours. Perform the prescribed lumbar extension exercises 3 times daily. Avoid prolonged sitting and use lumbar support when driving.").
```

#### Step 2: Update LLM Instructions (Re-evaluation)
```javascript
// File: chiropractic-followup.js
// In the sections object, add:
"home_care": "string | null"

// In the field instructions section, add:
6.  **home_care:** Document any home care instructions, exercises, stretches, or self-care recommendations provided to the patient during the current visit. Format as a paragraph with clear instructions. This field uses direct transcription without comparison format.
```

#### Step 3: Update Template Preprocessor
```python
# File: template_preprocessor.py
# Add to fields_to_move list:
fields_to_move = [
    "chief_complaint", "outcome_assessments", "cervical_rom", "lumbar_rom",
    "cervico_thoracic", "lumbopelvic", "extremity", "sensory_examination",
    "assessment_diagnosis", "plan", "treatment_performed_today",
    "history_of_present_illness", "diagnostic_imaging_review", "physical_examination",
    "duties_under_duress", "vitals", "home_care"  # ← Add here
]
```

#### Step 4: Update WeasyPrint Generator
```python
# File: weasyprint_generator.py
# Add to fields_to_move list (same as above):
fields_to_move = [
    # ... existing fields ...
    "duties_under_duress", "vitals", "home_care"  # ← Add here
]
```

#### Step 5: Update Initial Exam Template
```html
<!-- File: initial_exam_template.html -->
<!-- Add after treatment_performed_today section: -->
{% if data.sections.home_care %}
<h4>Home Care Instructions</h4>
<p>{{ data.sections.home_care }}</p>
{% endif %}
```

#### Step 6: Update Re-evaluation Template
```html
<!-- File: re_evaluation_template.html -->
<!-- Add after treatment_performed_today section: -->
{% if data.sections.home_care %}
<h4>Home Care Instructions</h4>
<p>{{ data.sections.home_care.replace('\n', '<br>') | safe }}</p>
{% endif %}
```

#### Step 7: Update React Component
```jsx
// File: FormattedMedicalText.jsx
// After the treatment_performed_today section (around line 618):
{/* Home Care Instructions - after treatment */}
{structuredData.sections?.home_care && (
  <Box sx={{ mb: 3 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
      HOME CARE INSTRUCTIONS:
    </Typography>
    <Typography sx={{ whiteSpace: 'pre-wrap', pl: 2 }}>
      {structuredData.sections.home_care}
    </Typography>
  </Box>
)}
```

## Common Field Types and Their Requirements

### 1. Simple Text Fields
- **LLM Schema:** `"field_name": "string | null"`
- **Template:** `{{ data.sections.field_name }}`
- **Example:** home_care, plan, social_history

### 2. Structured Array Fields
- **LLM Schema:** Array of objects with specific structure
- **Template:** Requires loop with table or list rendering
- **Example:** outcome_assessments, cervical_rom, motor_exam

### 3. Comparison Fields (Re-evaluation only)
- **LLM Schema:** Objects with previous/current structure
- **Template:** Special handling with status icons
- **Example:** chief_complaint, orthopedic tests

## Field Categories in the System

### Always in `sections` object:
- chief_complaint
- history_of_present_illness
- past_medical_history
- previous_accidents_trauma
- current_medications
- past_surgical_history
- family_history
- allergies
- social_history
- review_of_other_systems
- duties_under_duress
- vitals
- outcome_assessments
- physical_examination
- cervical_rom
- lumbar_rom
- cervico_thoracic
- lumbopelvic
- extremity
- sensory_examination
- assessment_diagnosis
- plan
- treatment_performed_today
- diagnostic_imaging_review
- home_care

### Outside `sections` object:
- patient_info
- clinic_info
- motor_exam
- reflexes
- cranial_nerve_examination
- postural_and_gait_analysis
- evaluation_type
- provider_info

## Quick Checklist for Field Changes

When adding a new field:
- [ ] Add to LLM initial exam schema
- [ ] Add to LLM initial exam instructions
- [ ] Add to LLM re-evaluation schema
- [ ] Add to LLM re-evaluation instructions
- [ ] Add to template_preprocessor.py fields_to_move
- [ ] Add to weasyprint_generator.py fields_to_move
- [ ] Add rendering block to initial_exam_template.html
- [ ] Add rendering block to re_evaluation_template.html
- [ ] Add rendering block to FormattedMedicalText.jsx

When removing a field:
- [ ] Remove from all 7 files listed above
- [ ] Check for any special processing logic in template_preprocessor.py
- [ ] Verify no CSS styles specifically target the field

## Testing Your Changes

1. Create a test transcript that includes the new field
2. Process through the appropriate template (initial or re-evaluation)
3. Verify the field appears in the generated PDF
4. For re-evaluations, test with both "Previously not documented" and comparison scenarios

## Common Pitfalls

1. **Forgetting fields_to_move:** If you add a field to LLM instructions but not to fields_to_move, it won't be moved to the sections object and won't render
2. **HTML escaping:** For multi-line text, use `.replace('\n', '<br>') | safe` in templates
3. **Re-evaluation comparison format:** Remember that re-evaluation fields may need special comparison handling
4. **Field naming:** Ensure consistent naming across all files (use underscores, not camelCase)

## Related Files (Not Usually Modified)

- `/backend/models.py` - Pydantic models (only modify if changing core structure)
- `/my-vite-react-app/src/templates/templateConfig.js` - Template configuration (rarely needs updates)
- `/backend/services/pdf_service/css_styles.py` - CSS styling for PDFs
- `/backend/services/pdf_service/status_icon_helper.py` - Status icon rendering