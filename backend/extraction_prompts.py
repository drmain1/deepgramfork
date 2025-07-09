"""
Extraction prompts for various medical findings and evaluations.
This module contains customizable prompts for extracting structured data from medical transcripts.
"""

# Default findings extraction prompt for initial evaluations
INITIAL_EVALUATION_FINDINGS_PROMPT = """
Extract positive clinical findings from this medical evaluation for baseline documentation.

INSTRUCTIONS:
1. Extract ONLY positive/abnormal findings (ignore normal findings)
2. Use direct quotes from the transcript
3. Each finding should appear in only ONE appropriate category
4. Focus on objective, measurable findings

Generate a JSON object with this structure:

```json
{
  "outcome_assessment_tools": [
    {
      "tool_name": "[Name of assessment tool]",
      "score": "[Numerical score or percentage]",
      "interpretation": "[If provided]"
    }
  ],
  "pain_findings": [
    "[Pain location, severity (0-10), and characteristics]"
  ],
  "range_of_motion_findings": [
    "[Joint/region with degrees and pain response]"
  ],
  "orthopedic_test_findings": [
    "[Test name: Result with details]"
  ],
  "neurological_findings": [
    "[Motor/sensory/reflex abnormalities with grades]"
  ],
  "palpation_findings": [
    "[Location with specific finding]"
  ],
  "functional_limitations": [
    "[Specific activity limitations]"
  ],
  "posture_and_gait_findings": [
    "[Observable abnormalities]"
  ]
}
```

Example findings:
- Pain: "Neck pain radiating to left arm, 7/10, sharp"
- ROM: "Cervical flexion limited to 30 degrees with pain"
- Tests: "Straight Leg Raise positive at 45 degrees on right"
- Neuro: "Biceps strength 4/5 on left"
- Palpation: "Bilateral trapezius muscle spasm"
- Function: "Unable to sit longer than 20 minutes"
- Posture: "Forward head posture with rounded shoulders"
"""

# Chiropractic-specific findings extraction
CHIROPRACTIC_FINDINGS_PROMPT = """
Extract all positive clinical findings from this chiropractic evaluation.
Focus on musculoskeletal and neurological findings relevant to chiropractic care.

Include:
- Chief complaint with onset and mechanism of injury
- Pain patterns (local vs radiating, quality, timing)
- Postural analysis findings
- Spinal segment dysfunction (subluxations)
- Range of motion by spinal region (degrees and quality)
- Orthopedic tests specific to spine and extremities
- Neurological findings (DTRs, dermatomes, myotomes)
- Palpation findings (static and motion palpation)
- Muscle testing (specific muscles and grades)
- Gait abnormalities
- Activities that aggravate/relieve symptoms
- Previous chiropractic care and response

Format as JSON with structure:
{
    "chief_complaint": {
        "description": "...",
        "onset": "acute/chronic/gradual",
        "mechanism": "if applicable"
    },
    "pain_assessment": {
        "location": {...},
        "intensity": {...},
        "quality": "sharp/dull/aching/burning",
        "radiation_pattern": "..."
    },
    "postural_findings": {
        "head_position": "...",
        "shoulder_height": "...",
        "pelvic_tilt": "..."
    },
    "subluxations": [
        "C5 posterior right with fixation",
        "L4 left lateral with muscle spasm"
    ],
    "range_of_motion": {
        "cervical": {...},
        "thoracic": {...},
        "lumbar": {...}
    },
    "orthopedic_tests": {
        "test_name": "positive/negative with details"
    },
    "neurological": {
        "reflexes": {...},
        "sensation": {...},
        "muscle_strength": {...}
    },
    "palpation": {
        "static": {...},
        "motion": {...},
        "muscle_tone": {...}
    },
    "functional_impact": [...],
    "aggravating_factors": [...],
    "relieving_factors": [...],
    "treatment_history": "..."
}
"""

# Physical therapy specific findings extraction
PHYSICAL_THERAPY_FINDINGS_PROMPT = """
Extract all relevant findings from this physical therapy evaluation.
Focus on functional assessments and movement impairments.

Include:
- Functional limitations and PLOF (Prior Level of Function)
- Movement analysis and quality
- Strength testing (MMT grades 0-5)
- Balance and coordination tests
- Gait analysis
- Special tests relevant to condition
- Pain with functional activities
- Endurance and cardiovascular response
- Patient-specific functional goals
- Barriers to recovery

Format as JSON with structure:
{
    "functional_status": {
        "current_level": "...",
        "prior_level": "...",
        "goals": [...]
    },
    "movement_analysis": {
        "quality": {...},
        "compensations": [...],
        "limitations": [...]
    },
    "strength_testing": {
        "muscle_group": "grade (0-5)"
    },
    "balance_assessment": {
        "static": "...",
        "dynamic": "...",
        "fall_risk": "low/moderate/high"
    },
    "gait_analysis": {
        "pattern": "...",
        "assistive_device": "...",
        "distance_tolerance": "..."
    },
    "special_tests": {...},
    "functional_activities": {
        "activity": "pain_level/limitation"
    },
    "endurance": "...",
    "barriers_to_recovery": [...],
    "other_findings": {...}
}
"""

# Function to get the appropriate extraction prompt
def get_extraction_prompt(specialty: str = "general", evaluation_type: str = "initial") -> str:
    """
    Get the appropriate extraction prompt based on specialty and evaluation type.
    
    Args:
        specialty: Medical specialty (chiropractic, physical_therapy, general)
        evaluation_type: Type of evaluation (initial, follow_up, re_evaluation)
    
    Returns:
        Appropriate extraction prompt string
    """
    specialty = specialty.lower() if specialty else "general"
    
    # Customize by specialty
    if "chiro" in specialty:
        return CHIROPRACTIC_FINDINGS_PROMPT
    elif "physical" in specialty or "pt" in specialty:
        return PHYSICAL_THERAPY_FINDINGS_PROMPT
    else:
        return INITIAL_EVALUATION_FINDINGS_PROMPT

# You can add more specialized prompts here:
# - ORTHOPEDIC_FINDINGS_PROMPT
# - NEUROLOGY_FINDINGS_PROMPT
# - PAIN_MANAGEMENT_FINDINGS_PROMPT
# etc.