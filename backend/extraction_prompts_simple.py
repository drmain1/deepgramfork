"""
Simplified extraction prompts that generate both markdown summary and JSON output.
This provides a concise abnormal findings summary for display while maintaining 
complete data structure in JSON for system processing.
"""

# Simplified initial evaluation findings extraction - JSON with markdown summary
SIMPLE_INITIAL_EVALUATION_PROMPT = """
Extract data from the provided JSON input and output BOTH:
1. A markdown summary of positive/abnormal findings for display
2. A JSON object with all test data for machine processing

CRITICAL DIRECTIVES:
1. The markdown section should include ONLY positive/abnormal findings (no normal findings)
2. The JSON section should include ALL tested values, both normal and abnormal
3. If a section was not mentioned, its value should be null or an empty array [] as appropriate
4. Format your response EXACTLY as shown below

OUTPUT FORMAT:

```markdown
### Clinical Baseline Summary

#### Positive Findings
- [List each abnormal finding concisely]
- [Include pain levels, restrictions, positive tests, etc.]
- [Use clinical terminology]

*Initial evaluation performed on [Date if available]*
```

```json
{
  "outcome_assessments": [
    {
      "tool_name": "string | e.g., Neck Disability Index",
      "score": "string | e.g., 31/50 or 62%"
    }
  ] | null,
  "physical_examination_narrative": {
    "palpation_findings": "string | Paragraph describing tenderness, muscle tone, etc.",
    "posture_and_gait": "string | Paragraph describing postural and gait analysis."
  } | null,
  "range_of_motion": [
    {
      "body_part": "string | e.g., Cervical Flexion",
      "status": "string | e.g., normal, Restricted, Limited to 40 degrees",
      "pain_on_motion": "boolean"
    }
  ] | null,
  "orthopedic_tests": [
    {
      "test_name": "string | e.g., Kemp's Test (Right)",
      "result": "string | Positive, Negative"
    }
  ] | null,
  "motor_exam": {
    "upper_extremity": [
      {"muscle": "DELTOID", "right": "string", "left": "string"},
      {"muscle": "BICEPS", "right": "string", "left": "string"}
    ],
    "lower_extremity": [
      {"muscle": "QUAD", "right": "string", "left": "string"}
    ]
  } | null,
  "reflex_exam": {
    "deep_tendon": [
      {"reflex": "PATELLAR", "right": "string", "left": "string"}
    ],
    "pathological": [
      {"reflex": "BABINSKI", "right": "string", "left": "string"}
    ]
  } | null,
  "sensory_exam": {
    "findings": "string | Paragraph describing any sensory deficits. e.g., 'Decreased sensation to light touch in the L5 dermatome on the left.'"
  } | null,
  "cranial_nerve_examination": [
    {"nerve": "CN I: Olfactory", "finding": "string | e.g., Intact, Not tested"},
    {"nerve": "CN II: Optic", "finding": "string | e.g., Intact, Not tested"},
    {"nerve": "CN III: Oculomotor", "finding": "string | e.g., Intact, Not tested"},
    {"nerve": "CN IV: Trochlear", "finding": "string | e.g., Intact, Not tested"},
    {"nerve": "CN V: Trigeminal", "finding": "string | e.g., Intact, Not tested"},
    {"nerve": "CN VI: Abducens", "finding": "string | e.g., Intact, Not tested"},
    {"nerve": "CN VII: Facial", "finding": "string | e.g., Intact, Not tested"},
    {"nerve": "CN VIII: Vestibulocochlear", "finding": "string | e.g., Intact, Not tested"},
    {"nerve": "CN IX: Glossopharyngeal", "finding": "string | e.g., Intact, Not tested"},
    {"nerve": "CN X: Vagus", "finding": "string | e.g., Intact, Not tested"},
    {"nerve": "CN XI: Accessory", "finding": "string | e.g., Intact, Not tested"},
    {"nerve": "CN XII: Hypoglossal", "finding": "string | e.g., Intact, Not tested"}
  ] | null
}
```
"""

# Simplified re-evaluation findings extraction - JSON with markdown summary
SIMPLE_RE_EVALUATION_PROMPT = """
Extract data from the provided JSON input and output BOTH:
1. A markdown summary of positive/abnormal findings for display
2. A JSON object with all test data for machine processing

CRITICAL DIRECTIVES FOR RE-EVALUATION:
1. The markdown section should include ONLY positive/abnormal findings from the CURRENT evaluation
2. The JSON section should include ALL currently tested values, both normal and abnormal
3. If a section/test was not mentioned in the current evaluation, its value should be null or an empty array [] as appropriate
4. DO NOT use the "Previous Initial Evaluation Findings" data as current findings - these are provided ONLY for your reference
5. The previous findings are injected to help you understand the patient's baseline, but they should NEVER be included as current findings unless explicitly stated in the current transcript

IMPORTANT: Previous findings injection explanation:
- You will see "Previous Initial Evaluation Findings" in the input
- These are historical data points from a prior visit
- They are provided so you understand what was found before
- If a test is NOT mentioned in the current transcript, do NOT assume it was performed
- Only document findings that are explicitly stated in the CURRENT transcript

OUTPUT FORMAT:

```markdown
### Clinical Re-evaluation Summary

#### Current Positive Findings
- [List each abnormal finding from CURRENT evaluation only]
- [Include current pain levels, restrictions, positive tests, etc.]
- [Use clinical terminology]

*Re-evaluation performed on [Date if available]*
```

```json
{
  "outcome_assessments": [
    {
      "tool_name": "string | e.g., Neck Disability Index",
      "score": "string | e.g., 31/50 or 62%"
    }
  ] | null,
  "physical_examination_narrative": {
    "palpation_findings": "string | Paragraph describing tenderness, muscle tone, etc.",
    "posture_and_gait": "string | Paragraph describing postural and gait analysis."
  } | null,
  "range_of_motion": [
    {
      "body_part": "string | e.g., Cervical Flexion",
      "status": "string | e.g., Full, Restricted, Limited to 40 degrees",
      "pain_on_motion": "boolean"
    }
  ] | null,
  "orthopedic_tests": [
    {
      "test_name": "string | e.g., Kemp's Test (Right)",
      "result": "string | Positive, Negative"
    }
  ] | null,
  "motor_exam": {
    "upper_extremity": [
      {"muscle": "DELTOID", "right": "string", "left": "string"},
      {"muscle": "BICEPS", "right": "string", "left": "string"}
    ],
    "lower_extremity": [
      {"muscle": "QUAD", "right": "string", "left": "string"}
    ]
  } | null,
  "reflex_exam": {
    "deep_tendon": [
      {"reflex": "PATELLAR", "right": "string", "left": "string"}
    ],
    "pathological": [
      {"reflex": "BABINSKI", "right": "string", "left": "string"}
    ]
  } | null,
  "sensory_exam": {
    "findings": "string | Paragraph describing any sensory deficits. e.g., 'Decreased sensation to light touch in the L5 dermatome on the left.'"
  } | null,
  "cranial_nerve_examination": [
    {"nerve": "CN I: Olfactory", "previous_finding": "string", "current_finding": "string"},
    {"nerve": "CN II: Optic", "previous_finding": "string", "current_finding": "string"},
    {"nerve": "CN III: Oculomotor", "previous_finding": "string", "current_finding": "string"},
    {"nerve": "CN IV: Trochlear", "previous_finding": "string", "current_finding": "string"},
    {"nerve": "CN V: Trigeminal", "previous_finding": "string", "current_finding": "string"},
    {"nerve": "CN VI: Abducens", "previous_finding": "string", "current_finding": "string"},
    {"nerve": "CN VII: Facial", "previous_finding": "string", "current_finding": "string"},
    {"nerve": "CN VIII: Vestibulocochlear", "previous_finding": "string", "current_finding": "string"},
    {"nerve": "CN IX: Glossopharyngeal", "previous_finding": "string", "current_finding": "string"},
    {"nerve": "CN X: Vagus", "previous_finding": "string", "current_finding": "string"},
    {"nerve": "CN XI: Accessory", "previous_finding": "string", "current_finding": "string"},
    {"nerve": "CN XII: Hypoglossal", "previous_finding": "string", "current_finding": "string"}
  ] | null
}
```

REMEMBER: Only include findings that are explicitly mentioned in the current transcript. The previous findings are for context only.
"""

# Function to get the simple extraction prompt
def get_simple_extraction_prompt(specialty: str = "general", evaluation_type: str = "initial") -> str:
    """
    Get the simple extraction prompt that outputs both markdown summary and JSON.
    
    Args:
        specialty: Medical specialty (currently unused - returns same prompt for all)
        evaluation_type: Type of evaluation ("initial" or "re_evaluation")
    
    Returns:
        Simple extraction prompt string that produces markdown summary + JSON output
    """
    # Return appropriate prompt based on evaluation type
    if evaluation_type == "re_evaluation" or evaluation_type == "follow_up":
        return SIMPLE_RE_EVALUATION_PROMPT
    else:
        return SIMPLE_INITIAL_EVALUATION_PROMPT