# Motor Examination Display Fix Documentation

## Overview
This document details the issue with motor examination value display in PDF reports and the fixes applied to ensure proper formatting.

## Problem Statement
Motor examination values were displaying as fractions (e.g., "5/5") in the PDF reports, but the requirement was to show only the numerator (e.g., "5") for cleaner presentation.

### Affected Areas:
1. Re-evaluation reports showing both previous and current motor exam values
2. Initial examination reports showing motor strength values
3. Both upper and lower extremity motor examination tables

## Technical Context

### Data Flow
1. **Data Source**: Motor exam data comes from AI extraction (Gemini) via `extraction_prompts_enhanced.py`
2. **Data Format**: Values are sent as strings in format "X/5" (e.g., "5/5", "4/5")
3. **Re-evaluation Format**: "Previously X/5 | Currently Y/5" or "Previously not performed | Currently 5/5"
4. **Templates**: Jinja2 templates render this data in HTML tables for PDF generation

### File Structure
```
backend/
├── services/
│   └── pdf_service/
│       └── jinja_templates/
│           ├── initial_exam_template.html
│           └── re_evaluation_template.html
├── extraction_prompts_enhanced.py
└── models.py
```

## Key Files and Their Roles

### 1. `/backend/extraction_prompts_enhanced.py`
- **Purpose**: Defines prompts for AI to extract clinical findings
- **Motor Exam Structure** (lines 91-108):
  ```python
  "motor_strength": {
      "performed": true/false,
      "upper_extremity_all_normal": true/false,
      "upper_extremity": [
          {
              "muscle": "[e.g., DELTOID]",
              "right": "[e.g., 5/5 or 4/5 or Not tested]",
              "left": "[e.g., 5/5 or 4/5 or Not tested]"
          }
      ]
  }
  ```

### 2. `/backend/models.py`
- **MuscleStrength Model**: Stores muscle name and bilateral strength values
- **MotorExamination Model**: Contains upper_extremity and lower_extremity lists

### 3. `/backend/services/pdf_service/jinja_templates/re_evaluation_template.html`
- **Lines 451-585**: Upper extremity motor examination table
- **Lines 587-723**: Lower extremity motor examination table
- **Parsing Logic**: Handles "Previously X | Currently Y" format
- **Display**: Shows previous and current values in separate columns

### 4. `/backend/services/pdf_service/jinja_templates/initial_exam_template.html`
- **Lines 186-206**: Upper extremity motor strength table
- **Lines 208-228**: Lower extremity motor strength table
- **Display**: Shows right and left values directly

## Standard Muscle Groups

### Upper Extremity
- DELTOID
- BICEPS
- TRICEPS
- WRIST EXT
- FINGER FLEX
- FINGER EXT
- THUMB EXT
- HAND INTRINSICS

### Lower Extremity
- ILIOPSOAS
- QUAD
- HAMSTRINGS
- GLUTEUS
- ANTERIOR TIBIALIS
- EXT HALLUCIS LONGUS

## Fixes Applied

### 1. Re-evaluation Template Fix
**Location**: `re_evaluation_template.html`

**Changes**:
- Modified parsing logic to extract numerator from "X/5" format
- Added logic to handle both pipe ("|") and comma-separated formats
- Updated status determination to use "5" instead of "5/5"

**Code Pattern**:
```jinja
{% if "/" in right_curr_raw %}
    {% set right_curr = right_curr_raw.split("/")[0].strip() %}
{% else %}
    {% set right_curr = right_curr_raw %}
{% endif %}
```

### 2. Initial Exam Template Fix
**Location**: `initial_exam_template.html`

**Changes**:
- Modified display logic to extract numerator from muscle strength values
- Preserved original format for reflex values (e.g., "2+")

**Code Pattern**:
```jinja
<td class="strength-value">
    {% if "/" in muscle.right %}
        {{ muscle.right.split("/")[0].strip() }}
    {% else %}
        {{ muscle.right }}
    {% endif %}
</td>
```

## Status Indicators (Re-evaluation Only)
- ✓ = Improved (new finding or strength increased)
- ✗ = Worsened
- → = No change
- • = Status changed or new finding

## Related Issues and Considerations

### 1. Template Complexity
The re_evaluation_template.html file is 990+ lines, making it difficult to maintain. Consider refactoring into smaller components.

### 2. Data Source Consistency
The motor exam data format is determined by the AI extraction process. Any changes to the extraction prompts could affect display.

### 3. Edge Cases
- "Not performed" or "not performed" (case sensitivity)
- "Not tested" values
- Missing or null values
- Non-standard formats

## Testing Checklist
- [ ] Initial exam displays "5" instead of "5/5" for all muscle groups
- [ ] Re-evaluation shows proper previous/current comparison
- [ ] Status indicators display correctly based on changes
- [ ] Reflex values maintain their original format (e.g., "2+")
- [ ] Handle "not performed" and "Not tested" values properly
- [ ] Both upper and lower extremity tables format correctly

## Future Improvements
1. **Data Standardization**: Consider standardizing motor exam values at the extraction level
2. **Template Refactoring**: Break down large templates into smaller, reusable components
3. **Validation**: Add validation for motor exam values to ensure consistent format
4. **Configuration**: Make display format configurable (e.g., show full "5/5" vs just "5")

## Dependencies
- Python 3.x
- Jinja2 templating engine
- WeasyPrint for PDF generation
- AI extraction service (Gemini)

## Notes
- The display format change is purely cosmetic and doesn't affect data storage
- Original values are preserved in the database
- Changes are backward compatible with existing data