export const painManagementEvalStructuredInstructions = 
`complete, and valid JSON object that strictly adheres to the schema provided below.
CRITICAL DIRECTIVE: Your output MUST be a single, raw JSON object and nothing else. Do not include any explanatory text, markdown, or any characters outside of the final {...} JSON structure.
Target JSON Schema:
{
"patient_info": {
"patient_name": "string",
"date_of_birth": "string | null",
"date_of_accident": "string | null",
"date_of_treatment": "string | null",
"provider": "string | null"
},
"clinic_info": {
"name": "string | null",
"address": "string | null",
"phone": "string | null",
"fax": "string | null"
},
"sections": {
"chief_complaint": "string | null",
"history_of_present_illness": "string | null",
"past_medical_history": "string | null",
"previous_accidents_trauma": "string | null",
"current_medications": "string | null",
"past_surgical_history": "string | null",
"family_history": "string | null",
"allergies": "string | null",
"social_history": "string | null",
"review_of_other_systems": "string | null",
"duties_under_duress": "string | null",
"vitals": "string | null",
"outcome_assessments": "string | null",
"physical_examination": "string | null",
"cervico_thoracic": "string | null",
"lumbopelvic": "string | null",
"extremity": "string | null",
"sensory_examination": "string | null",
"assessment_diagnosis": "string | null",
"plan": "string | null",
"treatment_performed_today": "string | null"
},
"motor_exam": {
"upper_extremity": [
{"muscle": "DELTOID", "right": "string", "left": "string"},
{"muscle": "BICEPS", "right": "string", "left": "string"},
{"muscle": "TRICEPS", "right": "string", "left": "string"},
{"muscle": "WRIST EXT", "right": "string", "left": "string"},
{"muscle": "FINGER FLEX", "right": "string", "left": "string"},
{"muscle": "FINGER EXT", "right": "string", "left": "string"},
{"muscle": "THUMB EXT", "right": "string", "left": "string"},
{"muscle": "HAND INTRINSICS", "right": "string", "left": "string"}
],
"lower_extremity": [
{"muscle": "ILIOPSOAS", "right": "string", "left": "string"},
{"muscle": "QUAD", "right": "string", "left": "string"},
{"muscle": "HAMSTRINGS", "right": "string", "left": "string"},
{"muscle": "GLUTEUS", "right": "string", "left": "string"},
{"muscle": "ANTERIOR TIBIALIS", "right": "string", "left": "string"},
{"muscle": "EXT HALLUCIS LONGUS", "right": "string", "left": "string"}
]
} | null,
"reflexes": {
"deep_tendon": [
{"reflex": "BICEPS", "right": "string", "left": "string"},
{"reflex": "TRICEPS", "right": "string", "left": "string"},
{"reflex": "BRACHIORADIALIS", "right": "string", "left": "string"},
{"reflex": "PATELLAR", "right": "string", "left": "string"},
{"reflex": "ACHILLES", "right": "string", "left": "string"}
] | null,
"pathological": [
{"reflex": "HOFFMAN", "right": "string", "left": "string"},
{"reflex": "BABINSKI", "right": "string", "left": "string"},
{"reflex": "CLONUS (ANKLE)", "right": "string", "left": "string"}
] | null
} | null
}
Detailed Processing Instructions:
A. General Rules:
Completeness: Every piece of information from the transcript must be placed in the most appropriate field in the JSON structure. Do not omit any dictated information.
No Duplication: Each piece of information should only appear in one field.
Handling Absence of Information: This rule applies to all string | null fields.
a. Explicitly Negative/Normal: If a provider explicitly states that a finding is negative, normal, or absent (e.g., "Patient denies any past surgeries," "Family history is non-contributory"), the field MUST contain the consistent string "None noted.".
b. Not Mentioned: If a topic or section is completely absent from the transcript (i.e., it was not asked about or discussed), its corresponding JSON field MUST be null.
B. Section-Specific Instructions:
patient_info & clinic_info:
Extract this information from the transcript context. Use null if a field is not available.
For all date fields (date_of_birth, date_of_accident, date_of_treatment), use the consistent "MM/DD/YYYY" format.
sections:
General Rule: All section text should be in well-formed paragraphs with complete

sections:
General Rule: All section text should be in well-formed paragraphs with complete sentences, unless specified otherwise. The General Rule A.3 for handling absence applies to all fields in this object.
chief_complaint: A numbered list of the patient's primary spinal and joint complaints. Format as "1. Neck pain, 6/7, radiating to both arms.\n2. Low back pain...". Group radiating symptoms with their spinal origin. This section is for the primary list of complaints only; the detailed narrative belongs in the history_of_present_illness.
history_of_present_illness: A detailed narrative including mechanism of injury, onset, progression of all symptoms, and treatments tried. If no ER or ambulance was mentioned, state that. This section must not include objective physical exam findings.
past_medical_history, previous_accidents_trauma, current_medications, past_surgical_history, family_history, allergies, social_history, review_of_other_systems: Document any relevant information as a paragraph. The global rule A.3 applies.
duties_under_duress: Document factors that complicate recovery, such as work requirements or activities of daily living the patient cannot avoid (e.g., "Patient is a construction worker and cannot avoid heavy lifting.").
vitals: Document height, weight, BP, etc. Format as a simple, comma-separated list (e.g., "Height: 70 inches, Weight: 180 lbs, BP: 120/80").
outcome_assessments: List any mentioned outcome assessment scores. Include the name of the questionnaire and the score (e.g., "Oswestry Low Back Pain Disability Questionnaire: 45%", "Neck Disability Index: 38/50").
physical_examination: General findings like appearance, level of distress, and cooperation only.
cervico_thoracic, lumbopelvic, extremity: These sections are for objective physical exam findings, including range of motion, palpation, and results of specific orthopedic tests for the corresponding body region.
sensory_examination: Document dermatomal sensory findings from the physical exam.
assessment_diagnosis: Format the provider's assessment as a bulleted list. Each diagnosis MUST start with - followed by the diagnosis and ICD-10 code, with each entry on a new line. Example: "- Muscle spasm on the back (M62.838)\n- Bulging disc in the neck (M50.20)"
plan: Transcribe the provider's recommendations for future treatment and follow-up in paragraph form.
treatment_performed_today: Transcribe any treatments or procedures performed during the current visit, such as spinal manipulations, therapies, or injections.
C. motor_exam Instructions:
If motor strength is not tested or mentioned, the entire motor_exam object MUST be null.
If tested, populate the arrays. All listed muscle groups for a tested region MUST be included.
Strength Values: Use the "X/5" format (e.g., "4+/5", "5/5").
Default Values: If strength is mentioned as "normal" or "5/5 throughout," you MUST fill all muscle fields for both extremities with "5/5".
Alternative Names: Map common names to the standard muscle name (e.g., "hip flexors" -> "ILIOPSOAS", "grip strength" -> "HAND INTRINSICS").
D. reflexes Instructions:
If no reflexes of any kind are mentioned, the entire reflexes object MUST be null.
Deep Tendon Reflexes (DTRs):
If DTRs are mentioned, the deep_tendon array MUST be populated.
If DTRs are NOT mentioned, the deep_tendon array MUST be null.
Values: Use the scale: 0, 1+, 2+, 3+, 4+.
Default: If DTRs are described as "normal," "symmetric," or "2+ throughout," populate every reflex in the deep_tendon array with "2+".
Pathological Reflexes:
If pathological reflexes are mentioned, the pathological array MUST be populated.
If pathological reflexes are NOT mentioned, the pathological array MUST be null.
Values: Use "Positive" or "Negative".
Default: If pathological reflexes are described as "normal," "negative," or "absent," populate every reflex in the pathological array with "Negative".
Remember: Output ONLY the JSON object. No additional text, no explanations, no markdown formatting outside of string values.`;

// This function allows customization of instructions based on exam type
export const getPainManagementEvalStructuredInstructions = () => {
  return painManagementEvalStructuredInstructions;
};