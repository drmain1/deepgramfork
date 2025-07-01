"""
Enhanced extraction prompts that generate both JSON and markdown formatted findings.
This provides structured data for system use AND readable format for UI display.
"""

# Enhanced initial evaluation findings extraction
ENHANCED_INITIAL_EVALUATION_PROMPT = """
Extract ALL positive clinical findings from this initial evaluation for baseline documentation.

IMPORTANT: Generate TWO outputs in the exact format specified below.

Part 1: Markdown Summary
Create a well-formatted clinical summary using proper markdown formatting.
- Use ### for main title
- Use #### for category headers
- Use - for bullet points
- Focus on clarity and readability

Part 2: JSON Data
Create a structured JSON object with categorized findings.
Each finding should be a verbatim quote from the transcript.

FORMAT YOUR RESPONSE EXACTLY AS:
```markdown
### Clinical Baseline Summary

#### Pain Findings
- [List each pain finding]

#### Range of Motion Findings
- [List each ROM limitation]

#### Neurological Findings
- [List each neurological finding]

#### Palpation Findings
- [List each palpation finding]

#### Orthopedic Test Findings
- [List each positive test]

#### Functional Limitations
- [List each functional limitation]

#### Posture and Gait Findings
- [List each postural/gait abnormality]

#### Outcome Assessment Tools
- [List each assessment tool with score]

*Initial evaluation performed on [Date if available]*
```

```json
{
  "outcome_assessment_tools": [
    {
      "tool_name": "[Name of the tool]",
      "score": "[The score]",
      "interpretation": "[The interpretation if mentioned]"
    }
  ],
  "pain_findings": [
    "[Direct quote of pain description]"
  ],
  "range_of_motion_findings": [
    "[Direct quote of ROM limitation]"
  ],
  "orthopedic_test_findings": [
    "[Direct quote of positive test]"
  ],
  "neurological_findings": [
    "[Direct quote of neuro deficit]"
  ],
  "palpation_findings": [
    "[Direct quote of palpation finding]"
  ],
  "functional_limitations": [
    "[Direct quote of functional problem]"
  ],
  "posture_and_gait_findings": [
    "[Direct quote of postural or gait abnormality]"
  ]
}
```

EXTRACTION RULES:
1. Only include POSITIVE/ABNORMAL findings
2. Use exact quotes from the transcript
3. If a category has no findings, use empty array []
4. Include all relevant clinical details
5. Maintain professional medical terminology
"""

# Enhanced chiropractic-specific prompt
ENHANCED_CHIROPRACTIC_PROMPT = """
Extract findings from this chiropractic evaluation and format for both data storage and clinical use.

GENERATE TWO OUTPUTS IN THIS EXACT FORMAT:

```markdown
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
| [Level] | [Listing] | [Yes/No] | [Findings] |

### Range of Motion Testing
#### Cervical Spine
- **Flexion:** [degrees] [if restricted: ⚠️]
- **Extension:** [degrees] [if normal: ✓]
- **Right Rotation:** [degrees]
- **Left Rotation:** [degrees]

#### Thoracic Spine
[Similar format]

#### Lumbar Spine
[Similar format]

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
```

```json
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
        "spinal_curves": {}
    },
    "subluxations": [
        {"level": "C5", "listing": "posterior right", "fixation": true},
        {"level": "L4", "listing": "left lateral", "muscle_spasm": true}
    ],
    "range_of_motion": {
        "cervical": {
            "flexion": {"degrees": X, "pain": true, "restriction": "mild/moderate/severe"},
            "extension": {},
            "rotation_right": {},
            "rotation_left": {}
        },
        "thoracic": {},
        "lumbar": {}
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
    "functional_assessment": [],
    "treatment_response": "if applicable"
}
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