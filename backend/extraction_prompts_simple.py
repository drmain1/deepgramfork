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
```
"""

# Function to get the simple extraction prompt
def get_simple_extraction_prompt(specialty: str = "general", evaluation_type: str = "initial") -> str:
    """
    Get the simple extraction prompt that outputs both markdown summary and JSON.
    
    Args:
        specialty: Medical specialty (currently unused - returns same prompt for all)
        evaluation_type: Type of evaluation (currently unused - returns same prompt for all)
    
    Returns:
        Simple extraction prompt string that produces markdown summary + JSON output
    """
    # For now, return the same prompt regardless of parameters
    # This simplified version outputs both markdown summary and JSON
    return SIMPLE_INITIAL_EVALUATION_PROMPT