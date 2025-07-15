export const painManagementEvalStructuredInstructions = 

`Your task is to extract information from a medical transcript and format it as a single, complete, and valid JSON object that strictly adheres to the schema provided below.

CRITICAL DIRECTIVES:
1.  Your output MUST be a single, raw JSON object and nothing else.
2.  Do not include any explanatory text, markdown, or any characters outside of the final {...} JSON structure.

Target JSON Schema:
{
  "evaluation_type": "initial",
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
    "treatment_performed_today": "string | null",
    "diagnostic_imaging_review": "string | null"
  },
  "postural_and_gait_analysis": {
    "posture_general": "string | null",
    "gait_analysis": "string | null"
  },
  "cranial_nerve_examination": [
    {"nerve": "CN I: Olfactory", "finding": "string"},
    {"nerve": "CN II: Optic", "finding": "string"},
    {"nerve": "CN III: Oculomotor", "finding": "string"},
    {"nerve": "CN IV: Trochlear", "finding": "string"},
    {"nerve": "CN V: Trigeminal", "finding": "string"},
    {"nerve": "CN VI: Abducens", "finding": "string"},
    {"nerve": "CN VII: Facial", "finding": "string"},
    {"nerve": "CN VIII: Vestibulocochlear", "finding": "string"},
    {"nerve": "CN IX: Glossopharyngeal", "finding": "string"},
    {"nerve": "CN X: Vagus", "finding": "string"},
    {"nerve": "CN XI: Accessory", "finding": "string"},
    {"nerve": "CN XII: Hypoglossal", "finding": "string"}
  ] | null,
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
1.  Completeness: Every piece of information from the transcript must be placed in the most appropriate field in the JSON structure. Do not omit any dictated information.
2.  No Duplication: Each piece of information should only appear in one field.
3.  Handling Absence of Information: This rule applies to all "string | null" fields. The more specific rules for structured objects (like motor_exam) take precedence.
    a. Explicitly Negative/Normal: If a provider explicitly states that a finding is negative, normal, non-contributory, or absent (e.g., "Patient denies any past surgeries," "Family history is non-contributory"), the field MUST contain the consistent string "None noted.".
    b. Not Mentioned: If a topic or section is completely absent from the transcript (i.e., it was not discussed), its corresponding JSON field MUST be null.
4.  Dates: All date fields (date_of_birth, date_of_accident, date_of_treatment) MUST be formatted as "MM/DD/YYYY".

B. Structured Object Rules (cranial_nerve_examination, motor_exam, reflexes):
- If an entire examination category (Cranial Nerves, Motor, or Reflexes) was not performed or is not mentioned at all in the transcript, the entire top-level object MUST be set to null. (e.g., "motor_exam": null).
- If an examination category was performed, but a specific test within it was not mentioned, use the specific string "Not tested" for that item's value(s).

1.  cranial_nerve_examination:
    - if Doctor mentions Cranial nerves during the examination please document findings here
      they may say all cranial nerves intact, they are numbered 1-12, they may say 2-11 intact, they may say weakness or dysfunction please document in this section. 
    - For any other finding, transcribe the dictated result.
    - If the exam was performed but a specific nerve was not mentioned, its finding must be "Not tested".

2.  motor_exam:
    - Muscle Name Mapping: You MUST map common terms to the schema names: "grip strength" -> HAND INTRINSICS; "hip flexors" -> ILIOPSOAS; "quads" -> QUAD; "ankle dorsiflexion" -> ANTERIOR TIBIALIS; "big toe extension" -> EXT HALLUCIS LONGUS.
    - Strength Grading: The ONLY valid grades are: "0/5", "1/5", "2/5", "3/5", "3+/5", "4/5", "4+/5", "5/5".
    - CRITICAL: Convert any dictated "4.5/5" to "4+/5".

3.  reflexes:
    - Deep Tendon Reflex (DTR) Grading: The ONLY valid grades are "0", "1+", "2+", "3+", "4+". "2+" is considered NORMAL.
    - Pathological Reflexes: The ONLY valid values are "positive" or "negative".
    - If the DTR or Pathological sub-sections were not performed, set them to null (e.g., "pathological": null).

C. Section-Specific Instructions ("sections" object):
- General Rule: All section text should be in well-formed paragraphs with complete sentences, unless specified otherwise. The General Rule A.3 for handling absence applies to all fields in this object.

- chief_complaint: A numbered list of the patient's primary spinal, joint, and headache complaints. Format as "1. Neck pain, 6/10, radiating to both arms.\n2. Low back pain...". Group radiating symptoms with their spinal origin. This field is for the primary list of complaints only; the detailed narrative belongs in history_of_present_illness.

- history_of_present_illness: A detailed narrative including mechanism of injury, onset, progression of all symptoms, and treatments tried. If no ER visit or ambulance was mentioned, explicitly state that. This section must not include objective physical exam findings.

- past_medical_history, previous_accidents_trauma, current_medications, past_surgical_history, family_history, allergies, social_history, review_of_other_systems: Document any relevant information as a paragraph. The global rule A.3 applies.

- duties_under_duress: Document factors that complicate recovery, such as work requirements or activities of daily living the patient cannot avoid (e.g., "Patient is a construction worker and cannot avoid heavy lifting.").

- vitals: Document height, weight, BP, etc. Format as a simple, comma-separated list (e.g., "Height: 70 inches, Weight: 180 lbs, BP: 120/80").

- outcome_assessments: List any mentioned outcome assessment scores. Include the name of the questionnaire and the score (e.g., "Oswestry Low Back Pain Disability Questionnaire: 45%", "Neck Disability Index: 38/50"). do not place anything else in this section

- physical_examination: This is a catch-all field. Place any general physical examination notes that do not fit into the more specific categories below.

- cervico_thoracic, lumbopelvic, extremity: These sections are for objective physical exam findings, including range of motion, palpation, and results of specific orthopedic tests for the corresponding body region.
  - Example content for "cervico_thoracic": Findings for Spurling's, Jackson's Compression, Cervical Distraction, Shoulder Depression, Soto-Hall, Adam's Test, Slump Test, Lhermitte's, Upper Limb Tension Test (ULTT).
  - Example content for "lumbopelvic": Findings for Straight Leg Raise (SLR), Braggard's, Kemp's, Yeoman's, Gaenslen's, FABER, FADIR, Thomas Test, Hoover Sign.
  - Example content for "extremity": Extremity Test List (for "extremity"): (Shoulder) Drop Arm, Neer's, Hawkins-Kennedy, Empty Can, Speed's; (Elbow/Wrist) Cozen's, Golfer's Elbow, Tinel's, Phalen's, Finkelstein's; (Knee) Lachman's, Anterior Drawer, McMurray's, Apley's, Valgus/Varus; (Ankle/Foot) Drawer, Talar Tilt, Thompson's.   When documenting please include body part, doctor will say left drop arm and neer’s test negative.  Please document “Left Shoulder examination: Drop Arm negative and Neer’s negative”
  - 

- sensory_examination: Document sensory findings from the physical exam (e.g., "Decreased sensation to light touch in the C6 dermatome on the left.").

- assessment_diagnosis: Format the provider's assessment as a bulleted list, causation of injury and diagnosis codes belong here,  Each diagnosis MUST be on a new line.  please match up the most appropriate icd10 code to the doctors diagnosis. 

- diagnostic_imaging_review: Document any discussion or review of diagnostic imaging (X-rays, MRI, CT scans, etc.). Include imaging dates, findings, and the provider's interpretation. Format as a paragraph with complete sentences (e.g., "Review of cervical spine X-rays dated 10/15/2023 demonstrates loss of normal cervical lordosis with no evidence of fracture or dislocation. MRI of the lumbar spine from 10/20/2023 reveals disc desiccation at L4-5 and L5-S1 with mild disc bulging.").

- plan: Transcribe the provider's recommendations for future treatment and follow-up in paragraph form.

- treatment_performed_today: Transcribe any treatments or procedures performed during the current visit, such as spinal manipulations, therapies, or injections.

- postural_and_gait_analysis: This section must be an object with two keys: \`posture_general\` and \`gait_analysis\`.
  - If the entire postural and gait analysis was not performed, the \`postural_and_gait_analysis\` object should be \`null\`.
  - **\`posture_general\`**: Document all static postural findings here as a comma-separated list (e.g., "Forward head carriage, posterior pelvic tilt"). If explicitly normal, state "Unremarkable". If not mentioned, this field should be \`null\`.
  - **\`gait_analysis\`**: Document all dynamic gait findings here as a comma-separated list (e.g., "Antalgic gait"). If explicitly normal, state "Unremarkable". If not mentioned, this field should be \`null\`.
`