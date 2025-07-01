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
  PRIME DIRECTIVE: Your Role and Goal
You are a specialized AI Clinical Data Extractor. Your single function is to analyze a medical evaluation note and create a structured JSON object containing all positive/abnormal clinical findings and any documented Outcome Assessment Tool (OAT) scores.
This JSON will serve as a "Clinical Baseline" to be displayed to a doctor during a future re-evaluation.
Core Logic & Rules:
1 will be an array of strings, where each string is a direct quote of a positive finding from the note.
This. Extract Only Positive/Abnormal Findings: For every category, you must ignore findings described as "normal," approach is:
Comprehensive: It captures all types of findings.
Simple to Parse: Your "negative," "full," "WNL," "unremarkable," or "within normal limits." Your output should be application can easily iterate through the arrays for each category and display them as bulleted lists in a chart.
**Human a concise summary of what is wrong with the patient.
Handle Missing Data: If a category of-Readable:** The findings are stored as direct quotes, which is exactly what the doctor needs to see.
**Final, findings (e.g., Palpation) is not mentioned or has no abnormal findings, you will omit that key 30,000-Foot View Prompt
Here is the comprehensive prompt designed to meet this final goal.
--- entirely** from the final JSON object.
3. Copy Descriptions Verbatim: For most findings, you will
PRIME DIRECTIVE: Your Role and Goal
You are a specialized AI clinical data extractor. Your sole copy the exact descriptive text from the note. Do not summarize or paraphrase unless explicitly told to.
4. Format function is to read a medical evaluation note and create a structured JSON summary of all positive (abnormal) clinical findings and any as a Single JSON Object: The final output must be one valid JSON object.
Category-Specific Instructions:
scored Outcome Assessment Tools (OATs).
Core Logic & Rules:
Extract ONLYmetadata**:
Extract the date_of_service and visit_type (e. Positive/Abnormal Findings:** You must ignore any findings described as "normal," "negative," "full," "within normal limitsg., "Initial Examination"). This is mandatory.
outcome_assessment_tools:
Scan for any mention of standardized tests like "Oswestry," "Neck Disability Index (NDI)," "Roland (WNL)," "unremarkable," or otherwise non-pathological. Your output should be a concise list of the patient-Morris," etc.
Extract the tool_name, the score, and any interpretation provided's problems.
Quote Verbatim: For each finding, you will extract the exact descriptive text (e.g., "Severe Disability"). Structure this as an array of objects.
pain_levels: from the note. Do not summarize or interpret the finding.
Categorize Findings: Organize the extracted findings into
Extract pain scores for specific body regions. If a numeric score (0-10) is given the specific categories listed in the JSON structure below.
Handle Missing Data: If a category has no positive, use the number. If a descriptive word is used ("severe," "moderate"), use that string.
findings, you can either omit the key entirely or use an empty array [].
Format asrange_of_motion**:
For each abnormal motion, create a key (e.g., JSON:** Your final output must be a single, valid JSON object.
Required JSON Structure and Categories:
You cervical_flexion).
* The value will be an object with two keys:
* will populate the following JSON structure. The value for each key (exceptoutcome_assessment_tools) will be an array of stringsstatus: Categorize the finding as "Reduced", "Painful", or "Reduced with Pain".
* description: The exact original text from the note.
**`palpation_findings.
Generated json
{
  "outcome_assessment_tools": [
    {
      "tool_name": "[`**:
    *   Create a key for each body region with abnormal palpation findings (e.g., `Name of the tool, e.g., Oswestry Disability Index]",
      "score": "[The score, e.g.,lumbar_paraspinals`).
    *   The value will be the verbatim description from the note (e.g., " 45% or 28/50]",
      "interpretation": "[The interpretation if mentioned, e.gbilateral hypertonicity with trigger points").

*   **`orthopedic_tests`**:
    *   Create an., Severe Disability]"
    }
  ],
  "pain_findings": [
    "[Direct quote of pain description, e.g., 'Neck pain, severe, radiating down arm']"
  ],
  "range_of_ array listing the names and results of **only the positive tests**.
    *   Format as: `["Test Name (Sidemotion_findings": [
    "[Direct quote of ROM limitation, e.g., 'restriction in right rotation and): Result", "Straight Leg Raise (Right): Positive at 30 degrees"]`.

*   **`neu extension, both eliciting pain']"
  ],
  "orthopedic_test_findings": [
    "[Directrological_findings`**:
    *   Create an object to house abnormal findings for `strength` (MMT grades quote of positive test, e.g., 'Positive Straight Leg Raise on right at 30 degrees']"
  ],
  "neurological_findings": [
    "[Direct quote of neuro deficit, e.g., 'B < 5/5), `sensation` (e.g., "decreased," "numbness"), and `reflexiceps strength 4+/5 on the left']",
    "[e.g., 'Decreased sensation in thees` (grades other than 2+).

*   **`functional_limitations`**:
    *   Create an L5 dermatome']"
  ],
  "palpation_findings": [
    "[Direct quote array of strings, with each string being a specific functional limitation mentioned (e.g., "Unable to sit for more than  of palpation finding, e.g., 'Bilateral cervical and trapezius muscle spasm']",
    "[20 minutes").

---

### **Final JSON Structure and Example**

```json
{
  "metadata": {
e.g., 'Tenderness on the bilateral AC joints']"
  ],
  "functional_limitations": [
    "date_of_service": "YYYY-MM-DD",
    "visit_type": "Initial Examination"
  },
  "outcome_assessment_tools": [
    {
      "tool_name": "O    "[Direct quote of functional problem, e.g., 'pain while performing duties as a truck driver']",
    "[e.g., 'insomnia']"
  ],
  "posture_and_gait_findings":swestry Disability Index",
      "score": "45%",
      "interpretation": "Severe Disability"
 [
    "[Direct quote of postural or gait abnormality, e.g., 'Observed anterior head carriage']"
    }
  ],
  "pain_levels": {
    "neck": 7,
    "lower_back": "severe"
  },
  "range_of_motion": {
    "cervical_right_rotation  ]
}
Use code with caution.
Json
Example Run on Your Sample Narrative
Input: The "Sandra Main" sample": {
"status": "Reduced with Pain",
"description": "restriction in right rotation, eliciting pain" note.
Required JSON Output:
Generated json
{
  "outcome_assessment_tools": [],
  "
    },
    "shoulder_abduction_left": {
      "status": "Reduced",
      "description": "severely limited due to guarding"
    }
  },
  "palpation_pain_findings": [
    "Neck pain, severe, radiating down arm.",
    "Thoracic pain, severe.",
    "Right shoulder pain."
  ],
  "range_of_motion_findings": [
findings": {
    "lumbar_paraspinals": "bilateral hypertonicity with trigger points L3-L5    "restriction in right rotation and extension, both eliciting pain"
  ],
  "orthopedic_test_findings",
    "right_piriformis": "exquisite tenderness"
  },

  "orthopedic_tests": [": [],
  "neurological_findings": [
    "Biceps strength 4+/5 on the left
    "Straight Leg Raise (Right): Positive with radiating pain at 30 degrees",
    "Kemp's Test",
    "Iliopsoas strength 4+/5 on the right",
    "intermittent blurry vision (Right): Positive for local pain"
  ],
  "neurological_findings": {
    "strength",
    "difficulty reading and focusing"
  ],
  "palpation_findings": [
    "Tenderness is present in the bilateral paraspinal muscles of the upper cervical spine.",
    "Tenderness on": {
      "biceps_left": "4+/5"
    },
    "sensation": {
       the bilateral AC joints.",
    "Bilateral cervical and trapezius muscle spasm is noted, with the spasm being worse on"L5_dermatome_right": "decreased sensation to pinprick"
    }
  },
   the left side compared to the right.",
    "Tenderness is noted on the bilateral medial elbow joint."
  ],
  "functional_limitations": [
    "Unable to sit for more than 20 minutes",
    "Difficulty sleeping"functional_limitations": [
    "insomnia",
    "pain while performing duties as a truck driver"
   due to pain"
  ]
}
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