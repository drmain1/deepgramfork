"""
Extraction prompts for various medical findings and evaluations.
This module contains customizable prompts for extracting structured data from medical transcripts.
"""

# Default findings extraction prompt for initial evaluations
INITIAL_EVALUATION_FINDINGS_PROMPT = """
Extract all positive clinical findings from this medical evaluation. 
This will be used for comparison in future re-evaluations.

Organize findings by body region/system.
Include:
- Chief complaint and symptom onset
- Pain levels by specific body region (use numeric scale 0-10)
- Range of motion limitations (include degrees when mentioned)
- Positive orthopedic/special tests (list test name and result)
- Neurological findings (reflexes, sensation, strength grades)
- Muscle testing results (grade 0-5 scale)
- Palpation findings (tenderness, muscle tension, trigger points)
- Functional limitations and disabilities
- Diagnosed conditions (ICD-10 codes if mentioned)
- Imaging findings if mentioned
- Patient's goals and expectations

Format as JSON with structure:
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