import { painManagementEvalInstructions } from './llm-instructions/pain-management-eval.js';
import { orthoSpineConsultInstructions } from './llm-instructions/ortho-spine-consult.js';

export const medicalSpecialties = [
  'Ortho Spine',
  'Ortho Extremity',
  'Pain Management',
  'Chiropractic',
  'Acupuncture',
  'Podiatry',
];

export const templatesBySpecialty = {
  'Ortho Spine': [
    { 
      id: 'os_consult', 
      name: 'Initial Consultation', 
      llmInstructions: orthoSpineConsultInstructions, 
      sampleNarrative: `Sample narrative for Ortho Spine Initial Consultation Report:

PATIENT: John Doe
DOB: 01/01/1970
DATE OF SERVICE: 2025-05-20

CHIEF COMPLAINT: Lower back pain radiating to the left leg for 3 months.

HISTORY OF PRESENT ILLNESS: The patient is a 55-year-old male who reports insidious onset of low back pain approximately 3 months ago. The pain is described as sharp and aching, rated 7/10 at its worst. It radiates down the posterior aspect of his left thigh to the calf. Pain is aggravated by prolonged sitting and bending. He has tried OTC NSAIDs with minimal relief.

PAST MEDICAL HISTORY: Hypertension, well-controlled on Lisinopril.

REVIEW OF SYSTEMS: Otherwise negative.

PHYSICAL EXAMINATION: [...]

ASSESSMENT: Lumbar radiculopathy, likely L4-L5 disc herniation.

PLAN:
1. MRI lumbar spine.
2. Physical therapy referral.
3. Prescribe NSAIDs (Naproxen 500mg BID).
4. Follow-up in 2 weeks to review MRI results.` 
    },
    { 
      id: 'os_fu', 
      name: 'Follow-up Visit', 
      llmInstructions: 'LLM instructions for Ortho Spine Follow-up...', 
      sampleNarrative: `Sample narrative for Ortho Spine Follow-up Visit:

PATIENT: Jane Smith
DOB: 03/15/1965
DATE OF SERVICE: 2025-05-20

SUBJECTIVE: Patient returns for follow-up of chronic neck pain. Reports 50% improvement with physical therapy and home exercises. Pain is now 3/10, primarily localized to the cervical paraspinal muscles.

OBJECTIVE: [...]

ASSESSMENT: Cervicalgia, improving.

PLAN:
1. Continue current physical therapy regimen.
2. Wean off muscle relaxants as tolerated.
3. Follow-up in 4 weeks or PRN.` 
    },
  ],
  'Ortho Extremity': [
    { 
      id: 'oe_fracture', 
      name: 'Fracture Report', 
      llmInstructions: 'LLM instructions for Ortho Extremity Fracture...', 
      sampleNarrative: 'Sample narrative for Ortho Extremity Fracture Report: Details about a distal radius fracture treatment plan will go here.' 
    },
    { 
      id: 'oe_shoulder', 
      name: 'Shoulder Impingement', 
      llmInstructions: 'LLM for shoulder impingement', 
      sampleNarrative: 'Sample for shoulder impingement: Examination findings and treatment recommendations.'
    }
  ],
  'Pain Management': [
    { 
      id: 'pm_eval', 
      name: 'New Patient Evaluation', 
      llmInstructions: painManagementEvalInstructions, 
      sampleNarrative: `Sample for Pain Management New Patient Evaluation:

ABC Pain management
634 west E st
Painville, ca 
310 522 -5811
310-634-0443

patient name: [Patient Name]
date of birth: [DOB]
date of accident: [Date of Accident]
date of consultation: [Date of Consultation]

**CHIEF COMPLAINT**: 
1. Lower back pain, 8/10 severity, radiating down left leg
2. Neck pain, 6/10 severity, with associated headaches

**HISTORY OF PRESENT ILLNESS**: The patient presents with chronic lower back pain that began following a motor vehicle accident six months ago. The pain is described as constant, aching, and sharp with movement, rated 8/10 at its worst. The pain radiates down the posterior aspect of the left leg to the knee level. The patient also reports associated neck pain rated 6/10, with intermittent headaches occurring 2-3 times per week.

**PAST MEDICAL HISTORY**: Hypertension, well-controlled on medication. No other significant medical history noted.

**CURRENT MEDICATIONS**: 
- Lisinopril 10mg daily
- Ibuprofen 600mg as needed for pain

**PAST SURGICAL HISTORY**: None disclosed.

**FAMILY HISTORY**: No significant family history of chronic pain or musculoskeletal disorders disclosed.

**ALLERGIES**: No known drug allergies.

**SOCIAL HISTORY**: The patient is a non-smoker and consumes alcohol occasionally on weekends. Currently employed as an office manager but has been on modified duty since the accident. Married with two children.

**PHYSICAL EXAMINATION**: The patient appears in mild distress due to pain but is cooperative throughout the examination.

**Lumbopelvic**: Tenderness noted over the L4-L5 paraspinal muscles bilaterally. Range of motion is limited in flexion and extension due to pain. Straight leg raise test is positive on the left at 45 degrees.

**ASSESSMENT**: 
1. Chronic lumbar radiculopathy - M54.16
2. Cervicalgia - M54.2
3. Post-traumatic headache - G44.309` 
    },
  ],
  'Chiropractic': [
    { 
      id: 'chiro_adjust', 
      name: 'Adjustment Note', 
      llmInstructions: 'LLM for Chiro Adjust...', 
      sampleNarrative: 'Sample for Chiropractic Adjustment Note: Details of spinal segments adjusted and patient response.' 
    },
  ],
  'Acupuncture': [
    { 
      id: 'acu_treat', 
      name: 'Treatment Session', 
      llmInstructions: 'LLM for Acu Treat...', 
      sampleNarrative: 'Sample for Acupuncture Treatment Session: Points used and patient symptoms addressed.' 
    },
  ],
  'Podiatry': [
    { 
      id: 'pod_routine', 
      name: 'Routine Foot Care', 
      llmInstructions: 'LLM for Pod Routine...', 
      sampleNarrative: 'Sample for Podiatry Routine Foot Care: Nail trimming, callus debridement, and foot examination findings.' 
    },
  ],
}; 