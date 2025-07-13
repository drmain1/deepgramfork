"""
Simplified extraction prompts that generate only JSON output.
This reduces prompt complexity and token usage while maintaining data structure.
"""

# Simplified initial evaluation findings extraction - JSON only
SIMPLE_INITIAL_EVALUATION_PROMPT = """
JSON object that can be used for machine processing.

CRITICAL DIRECTIVES:
1.  Your output MUST be a single, raw JSON object and nothing else.
2.  Extract ALL tested values, both normal and abnormal, for all fields. Do not omit normal findings.
3.  If a section was not mentioned, its value should be null or an empty array [] as appropriate for the schema.
4.  Stick strictly to the grading formats provided in the schema examples.

Return ONLY a JSON object that strictly adheres to this schema:
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
  } | null
}
"""