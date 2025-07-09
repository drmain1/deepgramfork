# Re-evaluation Range of Motion (ROM) Improvements

*Created: July 8, 2025*

## Overview

This document outlines the improvements made to the re-evaluation functionality, specifically focusing on simplifying the Range of Motion (ROM) data format to better match real-world clinical practice.

## Problem Statement

The original ROM extraction format expected specific degree measurements (e.g., "Cervical right rotation limited to 30 degrees with pain"), but in practice:
- Doctors rarely use exact degree measurements during examinations
- Common descriptions include "a bit of restriction", "decreased", "limited", etc.
- The application wasn't designed to handle visual degree measurements

## Solution: Simplified ROM Format

### New ROM Data Structure

Instead of degree-based measurements, the new format captures:

```json
{
  "range_of_motion_findings": [
    {
      "body_part": "cervical spine right rotation",
      "restriction": "restricted",  // or "mild"/"moderate"/"severe" if specified
      "pain": true
    },
    {
      "body_part": "cervical spine extension",
      "restriction": "restricted",
      "pain": true
    }
  ]
}
```

### Key Features

1. **Body Part/Region**: Includes both spine and extremities
   - Examples: "cervical spine right rotation", "right shoulder abduction", "left hip flexion"

2. **Restriction Level**: Flexible options
   - Simple: "restricted" (default)
   - Severity-based: "mild", "moderate", "severe" (if doctor specifies)

3. **Pain Presence**: Boolean (true/false)

## Implementation Changes

### 1. Updated LLM Extraction Prompt

Location: `/backend/extraction_prompts_enhanced.py`

The `ENHANCED_INITIAL_EVALUATION_PROMPT` now includes:

```python
RANGE OF MOTION SPECIFIC RULES:
- Extract body part/region including spine AND extremities (e.g., "cervical spine right rotation", "right shoulder extension", "left hip flexion")
- Note restriction as "restricted" or severity if specified (mild/moderate/severe)
- Note presence of pain as boolean (true/false)
- Examples:
  - Input: "Neck examination reveals a bit of restriction on right rotation and a little restriction towards extension, both with pain"
    Output: [
      {"body_part": "cervical spine right rotation", "restriction": "restricted", "pain": true},
      {"body_part": "cervical spine extension", "restriction": "restricted", "pain": true}
    ]
  - Input: "Right shoulder decreased in extension and abduction with pain"
    Output: [
      {"body_part": "right shoulder extension", "restriction": "restricted", "pain": true},
      {"body_part": "right shoulder abduction", "restriction": "restricted", "pain": true}
    ]
```

### 2. Enhanced Logging

Added comprehensive logging to track ROM format transitions:

```python
# In patient_endpoints.py - get_patient_initial_evaluation()
rom_findings = most_recent.get('positive_findings', {}).get('range_of_motion_findings', [])
logger.info(f"ROM findings type: {type(rom_findings)}")
logger.info(f"ROM findings count: {len(rom_findings) if isinstance(rom_findings, list) else 'N/A'}")

if isinstance(rom_findings, list) and len(rom_findings) > 0:
    first_finding = rom_findings[0]
    if isinstance(first_finding, dict):
        logger.info(f"ROM format: NEW (dict) - Keys: {list(first_finding.keys())}")
        logger.info(f"First ROM finding: {first_finding}")
    else:
        logger.info(f"ROM format: OLD (string)")
        logger.info(f"First ROM finding: {first_finding}")
```

### 3. Extraction Function Logging

Enhanced logging in `extract_transcript_findings()`:

```python
# Log extraction process
logger.info(f"Extracting findings for transcript {transcript_id}")
logger.info(f"User specialty: {specialty}")
logger.info(f"Using extraction prompt type: enhanced")

# Log ROM findings after extraction
if 'range_of_motion_findings' in findings:
    rom_findings = findings['range_of_motion_findings']
    logger.info(f"ROM findings type: {type(rom_findings)}")
    if isinstance(rom_findings, list) and len(rom_findings) > 0:
        logger.info(f"ROM findings count: {len(rom_findings)}")
        logger.info(f"First ROM finding sample: {rom_findings[0]}")
```

## Current LLM Instructions for Re-evaluation

The system uses a single extraction prompt for both initial evaluations and re-evaluations. The key sections are:

### JSON Output Format
```json
{
  "outcome_assessment_tools": [
    {
      "tool_name": "[e.g., Neck Disability Index]",
      "score": "[e.g., 31/50 or 62%]",
      "interpretation": "[if provided]"
    }
  ],
  "pain_findings": [
    "[e.g., Neck pain radiating to left arm, 7/10, sharp and constant]"
  ],
  "range_of_motion_findings": [
    {
      "body_part": "[e.g., cervical spine right rotation]",
      "restriction": "[e.g., restricted/mild/moderate/severe]",
      "pain": true/false
    }
  ],
  "orthopedic_test_findings": [
    "[e.g., Straight Leg Raise positive at 30 degrees on right]"
  ],
  "neurological_findings": [
    "[e.g., Biceps strength 4/5 on left]",
    "[e.g., Decreased sensation L5 dermatome]"
  ],
  "palpation_findings": [
    "[e.g., Bilateral cervical paraspinal muscle spasm]",
    "[e.g., Tenderness at L4-L5 facet joints]"
  ],
  "functional_limitations": [
    "[e.g., Unable to sit for more than 20 minutes]",
    "[e.g., Difficulty with overhead reaching]"
  ],
  "posture_and_gait_findings": [
    "[e.g., Forward head posture]",
    "[e.g., Antalgic gait favoring right side]"
  ]
}
```

### Important Rules
- DO NOT duplicate findings across categories
- DO NOT include subjective complaints in neurological findings
- DO NOT include pain descriptions in range of motion findings
- DO NOT include normal findings
- Each finding should be concise and clinically relevant

## Testing and Migration

### Identifying Old Format Data

When retrieving initial evaluations, the system logs:
```
ROM findings type: <class 'list'>
ROM findings count: 1
ROM format: OLD (string)
First ROM finding: Neck examination reveals a bit of restriction...
```

### Re-extraction Process

To update existing findings to the new format:
1. The frontend detects old format findings
2. Triggers POST to `/api/v1/transcripts/{transcript_id}/extract-findings`
3. Uses the updated extraction prompt with new ROM rules
4. Saves structured findings back to Firestore

### Benefits

1. **More Natural Documentation**: Matches how doctors actually describe ROM limitations
2. **Flexible Severity Notation**: Optional mild/moderate/severe when specified
3. **Consistent Structure**: Easy to parse and display in UI
4. **Supports All Body Parts**: Works for spine and extremity assessments

## Future Considerations

1. **Chiropractic Prompt**: Left unchanged to maintain natural dictation flow
2. **Frontend Display**: Can show ROM findings in a clean, structured format
3. **Progress Tracking**: Easy to compare ROM changes between evaluations
4. **Report Generation**: Simplified format works well for PDF generation

## Related Files

- `/backend/extraction_prompts_enhanced.py` - Contains extraction prompts
- `/backend/patient_endpoints.py` - Handles initial evaluation retrieval
- `/backend/gcp_utils.py` - LLM processing with Gemini
- `/docs/re-eval-functionality.md` - Overall re-evaluation documentation

---

## Re-evaluation Template Updates - July 2025

### Multiple Outcome Assessments Support

The re-evaluation template has been updated to handle multiple outcome assessments (up to 3) with improved visualization:

**Key Changes:**
- Automatically splits multiple assessments separated by periods (`. `)
- Each assessment gets its own progress bar visualization
- Handles improvement, worsening, or no change scenarios
- Clear visual feedback with percentage labels

**Example Input:**
```json
"outcome_assessments": "Neck Disability Index: Previously 31/50, currently 25/50. Oswestry Low Back Disability Index: Previously 28/50, currently 10/50. Visual Analog Scale: Previously 8/10, currently 3/10."
```

### Consolidated Physical Findings Table

**Problem Solved:**
- Previously showed ALL motor exam entries including "Not documented"
- Multiple separate tables made it hard to see overall progress
- Cluttered display with irrelevant information

**New Implementation:**
- Single consolidated table showing only previously positive findings
- Intelligent filtering removes "Not documented" entries
- Combines findings from all examination types:
  - Orthopedic/Special tests (cervico-thoracic, lumbopelvic, extremity)
  - Motor examination (upper and lower extremity)
  - Sensory examination
  - Reflexes
- Visual status indicators: ✓ (improved), ✗ (worsened), → (no change)
- Professional 5-column layout: Category | Finding | Initial State | Current State | Status

**Benefits:**
- Clean, uncluttered display
- All improvements visible at a glance
- Consistent format across all examination types
- Professional appearance suitable for medical records

**Template Location:** `/backend/services/pdf_service/jinja_templates/re_evaluation_template.html`



ooking at these LLM instruction files, I can spot several edge
  cases that could cause issues with the new consolidated physical
  findings table:

  Edge Cases to Consider:

  1. Range of Motion Descriptions

  The re-evaluation instructions don't specify how to handle ROM
  findings. Doctors might say:
  - "Cervical flexion: Previously limited to 30 degrees | Currently
  full range"
  - "Lumbar extension: Previously painful at end range | Currently
  pain-free"
  - "Shoulder abduction: Previously restricted | Currently improved
  but still limited"

  Issue: The table expects clear "positive/negative" or
  "normal/abnormal" states, but ROM is often described in degrees or
  qualitative terms.

  2. Partial Improvements

  From the examples:
  "chief_complaint": "1. Neck pain radiating to arm: Previously
  present | Currently present (no change)"

  Issue: The template might not handle "(no change)" or "(partial
  improvement)" annotations well in the status determination logic.

  3. Bilateral Findings with Different Sides

  "Kemp's test: Previously positive bilaterally | Currently negative"
  "Spurling's test: Previously positive left | Currently negative"

  Issue: When a test was positive on both sides but only one side
  improved, the current format might not capture this nuance.

  4. Mixed Motor Strength Formats

  The pain management template expects formats like "4+/5" while
  re-evaluation might have:
  - "Previously 4/5, currently 5/5" (standard)
  - "Previously weak, currently normal" (qualitative)
  - "Right 5/5, Left previously 4/5 now 5/5" (mixed in one field)

  5. Sensory Findings

  Neither template gives clear examples for sensory examination
  comparisons. Doctors might dictate:
  - "L5 dermatome: Previously diminished | Currently intact"
  - "Light touch: Previously absent below knee | Currently present but
   reduced"

  Issue: The template's improvement detection logic might not handle
  sensory-specific terminology.

  6. New Positive Findings

  The template handles "Previously not present | Currently 3/10" but
  what about:
  - New positive orthopedic tests discovered during re-evaluation
  - Tests that were negative initially but are now positive
  (worsening)

  7. Incomplete Comparisons

  What if the doctor only mentions current state without referencing
  the previous state:
  - "Straight leg raise is negative today"
  - "Motor strength is 5/5 throughout"

  Issue: The template filters for entries with "Previously" - these
  might get excluded even though they represent improvements.

  8. Multiple Test Components

  Some tests have multiple components:
  - "Straight leg raise: Previously positive at 30 degrees on right
  with radicular symptoms | Currently positive at 60 degrees without
  radicular symptoms"

  Issue: This is technically both improved (angle) and improved (no
  radicular symptoms), but the simple positive/negative logic might
  miss this nuance.

  Recommendations:

  1. Add ROM-specific handling in the template to parse degree
  measurements and qualitative descriptions
  2. Enhance status determination to handle partial improvements and
  mixed findings
  3. Create fallback display for findings that don't fit the standard
  format
  4. Consider a "Notes" column for complex findings that need
  additional context
  5. Add instruction examples for sensory and ROM comparisons in the
  LLM prompts

  Would you like me to implement any of these improvements to make the
   template more robust?


 2 seperate PDF tempaltes 

  Here's the key difference:

  Single Visit PDF (from /transcription):

  - Uses the full re-evaluation template
  including HTML structure, headers, body
   tags
  - Renders complete HTML document with
  <html>, <head>, <body> tags
  - Includes CSS styles embedded in the
  template

  Multi-Visit PDF (from /patients):

  - Uses _generate_re_evaluation_content_
  for_multi_visit() method (line 607)
  - Renders the same template BUT then
  extracts only the body content (line
  627)
  - Strips out the <html>, <head>, and
  <body> tags using regex
  - Returns only the inner HTML content
  between <body> tags

  The specific code difference:
  # Multi-visit version (line 625-631):
  body_match =
  re.search(r'<body[^>]*>(.*?)</body>',
  html_content, re.DOTALL)
  if body_match:
      return body_match.group(1)  # 
  Returns only body content

  This extraction process could
  potentially:
  1. Remove important CSS styles that
  were in the <head> section
  2. Lose formatting that depends on the
  full document structure
  3. Cause slight rendering differences

  The reason for this approach is that
  multi-visit PDFs combine multiple
  visits into one document, so they can't
   have multiple <html> structures. But
  this body extraction might be causing
  the differences you're seeing between
  single visit and multi-visit
  re-evaluation outputs.

---

### Separation of ROM and Orthopedic Tests - July 2025

**Problem**: ROM tables were appearing even when no ROM testing was performed because the template checked for any content in `cervico_thoracic` or `lumbopelvic` sections, which also contained orthopedic tests.

**Solution**: Created dedicated ROM fields in the JSON schema:
- `cervical_rom`: Exclusively for cervical range of motion findings
- `lumbar_rom`: Exclusively for lumbar range of motion findings
- `cervico_thoracic` and `lumbopelvic`: Now only for orthopedic/special tests

**Implementation Changes**:

1. **Updated LLM Instructions** (`chiropractic-reevaluation.js`):
   - Added new fields to JSON schema
   - Clear instructions to separate ROM from orthopedic tests
   - ROM findings go in `cervical_rom`/`lumbar_rom`
   - Orthopedic tests go in `cervico_thoracic`/`lumbopelvic`/`extremity`

2. **Updated Re-evaluation Template**:
   - ROM tables only display if `cervical_rom` or `lumbar_rom` fields exist
   - No longer parse ROM from orthopedic test sections
   - Orthopedic findings now properly displayed in consolidated table

**Benefits**:
- No more empty ROM tables when ROM wasn't tested
- Clear separation of test types
- More accurate PDF generation
- Better data organization