"""
Enhanced extraction prompts that generate both JSON and markdown formatted findings.
This provides structured data for system use AND readable format for UI display.
"""

# Enhanced initial evaluation findings extraction
ENHANCED_INITIAL_EVALUATION_PROMPT = """
Extract clinical findings from this initial evaluation to establish a baseline for future comparison.

CRITICAL INSTRUCTIONS:
1. Extract ONLY positive/abnormal findings (ignore normal findings)
2. Use direct quotes from the transcript
3. Focus on objective, measurable findings
4. Avoid redundancy - each finding should appear only once in the most appropriate category
5. Be concise and clinically relevant

Generate TWO outputs in this EXACT format:

```markdown
### Clinical Baseline Summary

#### Pain Findings
- [Primary pain complaint with location, severity (0-10), and characteristics]
- [Additional pain areas if present]

#### Range of Motion Findings
- [Body part/region: restriction level (if specified: mild/moderate/severe), with/without pain]

#### Neurological Findings
- [Motor weakness with specific grades (0-5)]
- [Sensory deficits with dermatome/distribution]
- [Reflex abnormalities with grades]

#### Palpation Findings
- [Specific anatomical location with finding (e.g., tenderness, spasm, trigger points)]

#### Orthopedic Test Findings
- [Test name: Result (positive/negative with details)]

#### Functional Limitations
- [Specific activity limitations or disabilities]

#### Posture and Gait Findings
- [Observable postural deviations or gait abnormalities]

#### Outcome Assessment Tools
- [Tool name: Score (numerical or percentage)]

*Initial evaluation performed on [Date if available]*
```

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
  ],
  "comprehensive_exam_data": {
    "motor_strength": {
      "performed": true/false,
      "upper_extremity_all_normal": true/false,
      "upper_extremity": [
        {
          "muscle": "[e.g., DELTOID]",
          "right": "[e.g., 5/5 or 4/5 or Not tested]",
          "left": "[e.g., 5/5 or 4/5 or Not tested]"
        }
      ],
      "lower_extremity": [
        {
          "muscle": "[e.g., QUAD]",
          "right": "[e.g., 5/5 or 4/5 or Not tested]",
          "left": "[e.g., 5/5 or 4/5 or Not tested]"
        }
      ]
    },
    "reflexes": {
      "performed": true/false,
      "deep_tendon": [
        {
          "reflex": "[e.g., BICEPS]",
          "right": "[e.g., 2+ or 1+ or Not tested]",
          "left": "[e.g., 2+ or 1+ or Not tested]"
        }
      ]
    },
    "range_of_motion": {
      "performed": true/false,
      "findings": [
        {
          "body_part": "[e.g., cervical spine flexion]",
          "status": "[e.g., Normal/Full range or Restricted or Limited to X degrees]",
          "pain": true/false
        }
      ]
    }
  }
}
```

IMPORTANT RULES:
- DO NOT duplicate findings across categories
- DO NOT include subjective complaints in neurological findings
- DO NOT include pain descriptions in range of motion findings
- DO NOT include normal findings in the main findings sections
- Each finding should be concise and clinically relevant

COMPREHENSIVE EXAM DATA RULES:
- The "comprehensive_exam_data" section captures ALL tested values (normal AND abnormal)
- Set "performed": true if the examination was done, false if not mentioned
- For motor strength: Include ALL tested muscles with their grades (5/5 for normal)
- Set "upper_extremity_all_normal": true ONLY if ALL upper extremity muscles tested are 5/5 bilaterally
- Set "upper_extremity_all_normal": false if ANY muscle shows weakness (less than 5/5) or if not all muscles were tested
- For reflexes: Include ALL tested reflexes with their grades (2+ for normal)
- Use "Not tested" only for individual muscles/reflexes not tested during an otherwise performed exam
- This data is for re-evaluation comparison only and won't appear in the Previous Findings sidebar

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
    import logging
    logger = logging.getLogger(__name__)
    
    specialty = specialty.lower() if specialty else "general"
    logger.info(f"get_enhanced_extraction_prompt called with specialty: {specialty}")
    
    if "chiro" in specialty:
        logger.info("Returning ENHANCED_CHIROPRACTIC_PROMPT")
        return ENHANCED_CHIROPRACTIC_PROMPT
    # Add more specialties as needed
    else:
        logger.info("Returning ENHANCED_INITIAL_EVALUATION_PROMPT")
        # Log a sample of the ROM section to verify format
        import re
        rom_section = re.search(r'RANGE OF MOTION SPECIFIC RULES:.*?(?=\n""")', ENHANCED_INITIAL_EVALUATION_PROMPT, re.DOTALL)
        if rom_section:
            logger.info(f"ROM extraction rules preview: {rom_section.group(0)[:200]}...")
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