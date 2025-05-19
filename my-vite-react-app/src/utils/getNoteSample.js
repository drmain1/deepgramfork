export function getNoteSample(templateStructure, outputFormat) {
  let sample = `Sample for: ${templateStructure} (${outputFormat})\n\n`;

  const paragraphSamples = {
    SOAP: `Subjective: Patient reports intermittent headaches for the past 2 weeks, localized to the frontal region, rated 5/10 at worst. Describes them as pressure-like. Denies fever, visual changes, or recent trauma.\nObjective: Vital signs stable. Neurological exam grossly intact. No sinus tenderness on palpation.\nAssessment: Tension headaches.\nPlan: Recommend stress management techniques. Prescribe ibuprofen 400mg PRN for pain. Advise follow-up in 4 weeks or sooner if symptoms worsen.`,
    SOAP_Combined: `Subjective: Patient presents with a persistent dry cough for 3 days, accompanied by mild fatigue. Denies fever or shortness of breath.\nObjective: Lungs clear to auscultation bilaterally. Throat mildly erythematous. Rapid strep test negative.\nAssessment/Plan (Combined): Viral upper respiratory infection. Advised symptomatic relief with rest, hydration, and OTC cough suppressants. Follow up if symptoms persist beyond 7 days or worsen.`,
    DAP: `Data: Patient is a 45-year-old male complaining of right knee pain following a fall yesterday. Reports swelling and difficulty bearing weight. Examination reveals moderate effusion, tenderness along the medial joint line, and limited range of motion. Lachman's test negative, McMurray's test equivocal.\nAssessment: Suspected medial meniscus tear, right knee vs. severe sprain.\nPlan: RICE protocol. Prescribe crutches for ambulation. Refer to orthopedics for further evaluation and possible MRI. Provide NSAIDs for pain management.`,
    BIRP: `Behavior: Client arrived on time, appeared withdrawn and reported increased feelings of anxiety over the past week, citing work stressors. Displayed fidgeting and had difficulty maintaining eye contact initially.\nIntervention: Utilized CBT techniques to explore negative thought patterns related to work. Practiced grounding exercises. Collaboratively developed a list of coping strategies.\nResponse: Client reported a slight reduction in anxiety by the end of the session. Engaged more actively as the session progressed and was receptive to trying the coping strategies.\nPlan: Continue CBT, focusing on thought challenging and relaxation techniques. Assign homework to practice one coping strategy daily. Schedule follow-up next week.`,
  };

  const bulletSamples = {
    SOAP: `Subjective:\n- Headaches: Intermittent, 2 weeks, frontal, 5/10, pressure-like.\n- Denies: Fever, visual changes, trauma.\nObjective:\n- Vitals: Stable.\n- Neuro exam: Grossly intact.\n- Sinuses: No tenderness.\nAssessment:\n- Tension headaches.\nPlan:\n- Stress management techniques.\n- Ibuprofen 400mg PRN.\n- Follow-up: 4 weeks or sooner if worsening.`,
    SOAP_Combined: `Subjective:\n- Cough: Dry, persistent, 3 days.\n- Fatigue: Mild.\n- Denies: Fever, SOB.\nObjective:\n- Lungs: CTA bilaterally.\n- Throat: Mildly erythematous.\n- Rapid strep: Negative.\nAssessment/Plan (Combined):\n- Diagnosis: Viral URI.\n- Treatment: Symptomatic (rest, hydration, OTC suppressants).\n- Follow-up: If no improvement in 7 days or symptoms worsen.`,
    DAP: `Data:\n- History: 45 y/o male, right knee pain post-fall (yesterday).\n- Symptoms: Swelling, difficulty bearing weight.\n- Exam: Moderate effusion, medial joint line tenderness, limited ROM. Lachman (-), McMurray (+/-).\nAssessment:\n- Suspected medial meniscus tear, R knee vs. severe sprain.\nPlan:\n- RICE protocol.\n- Crutches.\n- Ortho referral (MRI?).\n- NSAIDs.`,
    BIRP: `Behavior:\n- Arrival: On time, withdrawn.\n- Reported: Increased anxiety (work stressors).\n- Observed: Fidgeting, poor eye contact initially.\nIntervention:\n- CBT: Explored negative thought patterns.\n- Techniques: Grounding exercises.\n- Collaboration: Developed coping strategies list.\nResponse:\n- Anxiety: Slight reduction by session end.\n- Engagement: Increased, receptive to strategies.\nPlan:\n- Continue CBT (thought challenging, relaxation).\n- Homework: Practice one coping strategy daily.\n- Follow-up: Next week.`,
  };

  if (outputFormat === 'bullet_points') {
    sample = bulletSamples[templateStructure] || `No bullet point sample available for ${templateStructure}.`;
  } else {
    sample = paragraphSamples[templateStructure] || `No paragraph sample available for ${templateStructure}.`;
  }

  return sample;
}
