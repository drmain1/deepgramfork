"""
Enhanced extraction prompts that generate both JSON and markdown formatted findings.
This provides structured data for system use AND readable format for UI display.
"""

# Enhanced initial evaluation findings extraction
ENHANCED_INITIAL_EVALUATION_PROMPT = """
Extract all positive clinical findings from this medical evaluation.
Generate TWO outputs: structured JSON data AND formatted markdown text.

PART 1 - JSON OUTPUT (for data storage and queries):
Extract and organize findings by body region/system as JSON:
{
    "chief_complaint": "specific complaint and duration",
    "pain_levels": {
        "region_name": pain_score,
        "neck": 7,
        "lower_back": 8
    },
    "range_of_motion": {
        "body_part": "limitation description with degrees",
        "cervical_flexion": "Limited to 30 degrees (normal 60)",
        "lumbar_flexion": "Limited to 45 degrees with pain"
    },
    "positive_tests": [
        "Test name: result/finding",
        "Straight leg raise: positive at 30 degrees right"
    ],
    "neurological_findings": {
        "reflexes": {...},
        "sensation": {...},
        "strength": {...}
    },
    "palpation_findings": {
        "region": "specific findings",
        "lumbar_paraspinals": "bilateral muscle tension L3-L5"
    },
    "functional_limitations": [
        "Unable to sit longer than 20 minutes",
        "Difficulty with prolonged standing"
    ],
    "diagnoses": [
        "condition name (ICD-10 if available)"
    ],
    "imaging_findings": "summary if mentioned",
    "patient_goals": ["specific goals mentioned"],
    "other_findings": {...}
}

PART 2 - MARKDOWN OUTPUT (for doctor-friendly display):
Create a well-formatted clinical summary with proper headers and emphasis:

# Clinical Findings Summary

## Chief Complaint
[Primary concern with onset and duration]

## Pain Assessment
### Current Pain Levels
| Body Region | Severity | Quality | Notes |
|-------------|----------|---------|-------|
| [Region] | [X/10] | [sharp/dull/aching] | [radiation, timing] |

### Pain Patterns
- **Aggravating factors:** [list factors]
- **Relieving factors:** [list factors]

## Objective Findings

### Range of Motion
**Cervical Spine:**
- Flexion: [degrees] (normal: 60°)
- Extension: [degrees] (normal: 70°)
- [Continue for all tested movements]

### Positive Clinical Tests
1. **[Test Name]:** [Result and significance]
2. **[Test Name]:** [Result and significance]

### Neurological Assessment
**Motor Function:**
- [Muscle group]: [Grade 0-5]

**Sensory:**
- [Dermatome]: [intact/diminished/absent]

**Reflexes:**
- [Reflex]: [Grade 0-4+]

### Palpation Findings
- **[Region]:** [Specific findings - tenderness, muscle tension, etc.]

## Functional Impact
- [List specific functional limitations]
- [Include impact on ADLs]

## Clinical Impressions
1. [Primary diagnosis with ICD-10 if available]
2. [Secondary diagnoses]

## Patient Goals
- [Specific goals as stated by patient]

## Notes for Re-evaluation
Key findings to track in future visits:
- Pain levels in [specific regions]
- ROM measurements for [specific movements]
- Functional abilities: [specific tasks]
- Special test results

---
*Initial evaluation performed on [Date]*

FORMAT YOUR RESPONSE AS:
```json
{json_output_here}
```

```markdown
[markdown_output_here]
```
"""

# Enhanced chiropractic-specific prompt
ENHANCED_CHIROPRACTIC_PROMPT = """
Extract findings from this chiropractic evaluation and format for both data storage and clinical use.

GENERATE TWO OUTPUTS:

1. JSON FORMAT (for system use):
{
    "chief_complaint": {
        "description": "...",
        "onset": "acute/chronic/gradual",
        "mechanism": "if applicable",
        "duration": "time period"
    },
    "pain_assessment": {
        "locations": {
            "primary": {"region": "...", "severity": X, "quality": "..."},
            "secondary": {"region": "...", "severity": X, "quality": "..."}
        },
        "radiation_pattern": "...",
        "frequency": "constant/intermittent"
    },
    "postural_analysis": {
        "head_position": "forward/neutral/tilted",
        "shoulder_height": "level/elevated right/elevated left",
        "pelvic_tilt": "anterior/posterior/lateral",
        "spinal_curves": {...}
    },
    "subluxations": [
        {"level": "C5", "listing": "posterior right", "fixation": true},
        {"level": "L4", "listing": "left lateral", "muscle_spasm": true}
    ],
    "range_of_motion": {
        "cervical": {
            "flexion": {"degrees": X, "pain": true/false, "restriction": "mild/moderate/severe"},
            "extension": {...},
            "rotation_right": {...},
            "rotation_left": {...}
        },
        "thoracic": {...},
        "lumbar": {...}
    },
    "orthopedic_tests": {
        "test_name": {"result": "positive/negative", "details": "..."}
    },
    "neurological": {
        "motor": {"muscle": "grade"},
        "sensory": {"dermatome": "finding"},
        "reflexes": {"reflex": "grade"}
    },
    "palpation": {
        "static": {"segment": "findings"},
        "motion": {"segment": "findings"},
        "muscle_tone": {"region": "findings"}
    },
    "functional_assessment": [...],
    "treatment_response": "if applicable"
}

2. MARKDOWN FORMAT (for clinical display):

# Chiropractic Evaluation Findings

## Patient Presentation
**Chief Complaint:** [Description with onset, mechanism, and duration]
**Primary Symptoms:** [Location, quality, severity]

## Postural Analysis
### Standing Posture
- **Head Position:** [Finding]
- **Shoulder Level:** [Finding]
- **Pelvic Position:** [Finding]
- **Spinal Curves:** [Observations]

## Spinal Assessment

### Subluxation Listings
| Level | Listing | Fixation | Associated Findings |
|-------|---------|----------|-------------------|
| C5 | PR | Yes | Muscle spasm, tender |
| L4 | LL | Yes | Restricted motion |

### Range of Motion Testing
#### Cervical Spine
- **Flexion:** [degrees] ⚠️ [if restricted]
- **Extension:** [degrees] ✓ [if normal]
- **Right Rotation:** [degrees]
- **Left Rotation:** [degrees]

[Continue for Thoracic and Lumbar]

## Orthopedic & Neurological Testing

### Positive Orthopedic Tests
1. **[Test Name]:** [Result with clinical significance]

### Neurological Findings
- **Motor Testing:** [Notable findings]
- **Sensory Testing:** [Notable findings]
- **Deep Tendon Reflexes:** [Notable findings]

## Palpation Findings

### Static Palpation
- [Segment]: [Finding]

### Motion Palpation
- [Segment]: [Finding with movement quality]

### Soft Tissue Assessment
- [Region]: [Muscle tone, trigger points, tenderness]

## Functional Impact
- [Specific limitations]
- [ADL impacts]
- [Work/activity restrictions]

## Clinical Correlation
**Primary Working Diagnosis:** [Diagnosis]
**Secondary Findings:** [List]
**Recommended Care Plan Focus:** [Key areas]

## Progress Markers for Re-evaluation
✓ Monitor these key indicators:
- Pain levels: [specific regions to track]
- ROM: [specific measurements to repeat]
- Orthopedic tests: [tests to reassess]
- Functional abilities: [specific tasks]

---
*Examination Date: [Date]*
*Next Re-evaluation Recommended: [Timeframe]*

RETURN AS:
```json
{json_here}
```

```markdown
[markdown_here]
```
"""

# Function to get enhanced extraction prompt
def get_enhanced_extraction_prompt(specialty: str = "general") -> str:
    """
    Get the enhanced extraction prompt that generates both JSON and markdown.
    
    Args:
        specialty: Medical specialty (chiropractic, physical_therapy, general)
    
    Returns:
        Enhanced extraction prompt string
    """
    specialty = specialty.lower() if specialty else "general"
    
    if "chiro" in specialty:
        return ENHANCED_CHIROPRACTIC_PROMPT
    # Add more specialties as needed
    else:
        return ENHANCED_INITIAL_EVALUATION_PROMPT

# Prompt for comparing evaluations
COMPARISON_ANALYSIS_PROMPT = """
Compare these two evaluations and generate a clinical comparison summary.

INITIAL EVALUATION:
{initial_findings}

CURRENT EVALUATION:
{current_findings}

Generate a markdown-formatted comparison focusing on:

# Re-evaluation Comparison Report

## Summary of Changes
[Brief overview of overall progress]

## Pain Level Comparison
| Body Region | Initial | Current | Change | Clinical Significance |
|-------------|---------|---------|--------|---------------------|
| [Region] | [X/10] | [Y/10] | [↓/↑/→] | [Improved/Worsened/Stable] |

## Functional Improvements
### Resolved Issues
✅ [List items that have resolved]

### Persistent Issues
⚠️ [List ongoing problems]

### New Concerns
🆕 [List any new findings]

## Objective Findings Comparison

### Range of Motion Changes
[Table or list showing initial vs current measurements]

### Test Results Comparison
[Compare positive/negative test changes]

## Clinical Progress Assessment
- **Overall Progress:** [Excellent/Good/Fair/Poor]
- **Response to Treatment:** [Assessment]
- **Prognosis:** [Updated prognosis]

## Recommendations
- [Updated treatment recommendations based on progress]
- [Modifications to care plan]
- [Next re-evaluation timing]

---
*Comparison generated on [Date]*
"""