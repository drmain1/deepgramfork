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