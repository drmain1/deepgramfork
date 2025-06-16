import { painManagementEvalInstructions } from './llm-instructions/pain-management-eval.js';
import { orthoSpineConsultInstructions } from './llm-instructions/ortho-spine-consult.js';
import { chiropracticInitialInstructions } from './llm-instructions/chiropractic-initial.js';
import { chiropracticFollowupInstructions } from './llm-instructions/chiropractic-followup.js';
import { chiropracticFollowupCodesInstructions } from './llm-instructions/chiropractic-followup-codes.js';
import { chiropracticMultipleVisitsInstructions } from './llm-instructions/chiropractic-multiple-visits.js';
import { chiropracticSOAPImprovedInstructions } from './llm-instructions/chiropractic-soap-improved.js';
import { testGCPTemplateInstructions } from './llm-instructions/test-gcp-template.js';

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
      sampleNarrative: `MEDLEGALDOC PAIN MANAGEMENT CLINIC
634 West E Street, Suite 200
Painville, CA 90210
Tel: (310) 522-5811 | Fax: (310) 634-0443

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPREHENSIVE PAIN MANAGEMENT EVALUATION

Patient Name: Sarah Johnson
Date of Birth: 03/15/1975
Date of Accident: 08/22/2024
Date of Consultation: 01/06/2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CHIEF COMPLAINT:
1. Lower back pain, 8/10 severity, radiating down left leg
2. Neck pain, 6/10 severity, with associated headaches
3. Bilateral shoulder pain, 5/10 severity

HISTORY OF PRESENT ILLNESS:
The patient is a 49-year-old female who presents with chronic lower back pain that began following a motor vehicle accident approximately 4 months ago. She was a restrained driver when her vehicle was rear-ended at a traffic light. The patient reports immediate onset of neck and back pain following the collision.

The lower back pain is described as constant, aching, and sharp with movement, rated 8/10 at its worst. The pain radiates down the posterior aspect of the left leg to the knee level, consistent with L5 radiculopathy. Pain is exacerbated by prolonged sitting, standing, and bending activities. The patient also reports associated neck pain rated 6/10, with intermittent headaches occurring 2-3 times per week, primarily occipital in location.

Previous treatments include physical therapy (20 sessions) with minimal improvement, chiropractic care (discontinued due to increased pain), and oral medications including NSAIDs and muscle relaxants with partial relief.

PAST MEDICAL HISTORY:
- Hypertension, well-controlled on medication
- Type 2 Diabetes Mellitus, diet-controlled
- Hypothyroidism
- No previous history of chronic pain conditions

CURRENT MEDICATIONS:
- Lisinopril 10mg daily
- Levothyroxine 75mcg daily
- Ibuprofen 600mg TID PRN
- Cyclobenzaprine 10mg at bedtime
- Metformin 500mg BID

PAST SURGICAL HISTORY:
- Cholecystectomy (2018)
- Cesarean section x2 (1998, 2001)

FAMILY HISTORY:
- Mother: Rheumatoid arthritis
- Father: Degenerative disc disease
- No family history of fibromyalgia or other chronic pain syndromes

ALLERGIES: NKDA (No Known Drug Allergies)

SOCIAL HISTORY:
The patient is a non-smoker and denies alcohol or illicit drug use. She is married with two adult children. Currently employed as an office manager but has been on modified duty since the accident, working reduced hours due to pain limitations. The patient reports significant functional impairment affecting her activities of daily living and quality of life.

PHYSICAL EXAMINATION:
General: Well-developed, well-nourished female in mild distress due to pain. Vital signs stable.

CERVICO-THORACIC:
Inspection reveals normal cervical lordosis. Palpation demonstrates significant tenderness over the C5-C7 paraspinal muscles bilaterally, more pronounced on the right. Cervical range of motion is limited to 30 degrees flexion, 20 degrees extension, and 25 degrees lateral rotation bilaterally. Spurling's test is positive on the right. Cervical compression test reproduces neck pain without radicular symptoms.

LUMBOPELVIC:
Normal lumbar lordosis noted. Significant tenderness palpated over the L4-L5 and L5-S1 paraspinal muscles bilaterally. Lumbar flexion limited to 40 degrees with pain. Extension limited to 10 degrees. Straight leg raise test positive on the left at 45 degrees reproducing radicular symptoms. Negative on the right at 70 degrees. FABER test negative bilaterally. No sacroiliac joint tenderness noted.

NEUROLOGIC ASSESSMENT: MOTOR EXAMINATION

Upper Extremity
| MUSCLE GROUP | RIGHT | LEFT |
|--------------|-------|------|
| DELTOID | 5/5 | 5/5 |
| BICEPS | 5/5 | 5/5 |
| TRICEPS | 5/5 | 5/5 |
| WRIST EXT | 5/5 | 5/5 |
| FINGER FLEX | 5/5 | 5/5 |

Lower Extremity
| MUSCLE GROUP | RIGHT | LEFT |
|--------------|-------|------|
| ILIOPSOAS | 5/5 | 5/5 |
| QUAD | 5/5 | 5/5 |
| HAMSTRINGS | 5/5 | 4/5 |
| ANTERIOR TIBIALIS | 5/5 | 4/5 |
| EXT HALLUCIS LONGUS | 5/5 | 5/5 |

Deep Tendon Reflexes:
- Biceps: 2+ bilaterally
- Triceps: 2+ bilaterally
- Patellar: 2+ bilaterally
- Achilles: 2+ right, 1+ left

Sensory: Diminished sensation to light touch over left L5 dermatome

ASSESSMENT/DIAGNOSIS:
1. Lumbar radiculopathy, L5 - M54.16
2. Cervicalgia with cervicogenic headaches - M54.2
3. Lumbar disc displacement with radiculopathy - M51.16
4. Myofascial pain syndrome - M79.3
5. Post-traumatic headache - G44.309

TREATMENT PLAN:
1. MRI lumbar spine without contrast to evaluate for disc herniation
2. MRI cervical spine to rule out disc pathology
3. Lumbar epidural steroid injection at L5-S1 level
4. Continue current oral medications
5. Referral to physical therapy for core strengthening and McKenzie exercises
6. Follow-up in 2 weeks to review imaging and assess response to treatment
7. Consider cervical medial branch blocks if headaches persist

Electronically signed by:
Dr. Michael Chen, MD
Board Certified Pain Management
CA License #A123456` 
    },
  ],
  'Chiropractic': [
    { 
      id: 'chiro_initial', 
      name: 'Initial Consultation', 
      llmInstructions: chiropracticInitialInstructions, 
      sampleNarrative: 'Sample for Chiropractic Initial Consultation: Comprehensive new patient evaluation including history, examination, and treatment plan.' 
    },
    { 
      id: 'chiro_followup', 
      name: 'Follow-up Visit', 
      llmInstructions: chiropracticFollowupInstructions, 
      sampleNarrative: 'Sample for Chiropractic Follow-up Visit: Progress assessment, treatment provided, and ongoing care plan.' 
    },
    { 
      id: 'chiro_followup_codes', 
      name: 'Follow-up with Codes Assisted Paragraph', 
      llmInstructions: chiropracticFollowupCodesInstructions, 
      sampleNarrative: 'Sample for Chiropractic Follow-up with integrated billing codes in paragraph format.' 
    },
    { 
      id: 'chiro_multiple', 
      name: 'Multiple Visits', 
      llmInstructions: chiropracticMultipleVisitsInstructions, 
      sampleNarrative: 'Sample for documenting multiple chiropractic visits in a single comprehensive note.' 
    },
    { 
      id: 'chiro_soap_improved', 
      name: 'SOAP Enhanced', 
      llmInstructions: chiropracticSOAPImprovedInstructions, 
      sampleNarrative: 'Enhanced SOAP note generation with intelligent auto-expansion from minimal input, ensuring comprehensive documentation and billing compliance.' 
    },
    { 
      id: 'test_gcp_template', 
      name: 'TEST GCP Template', 
      llmInstructions: testGCPTemplateInstructions, 
      sampleNarrative: 'Test template for Google Cloud Platform Gemini Pro integration.',
      provider: 'gcp'  // Mark this template to use GCP instead of AWS
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