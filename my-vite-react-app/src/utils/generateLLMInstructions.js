export function generateLLMInstructions(template) {
  let basePrompt = "";

  // Define base prompts for each structure
  switch (template.structure) {
    case 'SOAP':
      basePrompt = `Generate a comprehensive SOAP note.
Subjective: Capture the patient's reported symptoms, history, and concerns.
Objective: Document objective findings from physical examination, lab results, and other diagnostic data.
Assessment: Provide a diagnosis or differential diagnosis based on subjective and objective information.
Plan: Outline the treatment plan, including medications, therapies, patient education, and follow-up.`;
      break;
    case 'SOAP_Combined':
      basePrompt = `Generate a SOAP note with a combined Assessment and Plan section.
Subjective: Detail the patient's reported symptoms and history.
Objective: Document objective findings.
Assessment/Plan (Combined): Synthesize the assessment and outline the integrated treatment plan.`;
      break;
    case 'DAP':
      basePrompt = `Generate a DAP note.
Data: Combine subjective and objective information.
Assessment: Provide your clinical assessment based on the data.
Plan: Detail the plan of action.`;
      break;
    case 'BIRP':
      basePrompt = `Generate a BIRP note for a behavioral health context.
Behavior: Describe the patient's presenting behavior and concerns.
Intervention: Detail the therapeutic interventions applied during the session.
Response: Document the patient's response to the interventions.
Plan: Outline the plan for future sessions or follow-up.`;
      break;
    default:
      basePrompt = `Create a medical note structured as: ${template.structure}.`;
  }

  // Add output format instructions
  if (template.outputFormat === 'bullet_points') {
    basePrompt += `\nFormat the content within each section primarily using bullet points for conciseness and readability.`;
  } else {
    basePrompt += `\nFormat the content within each section primarily using well-structured paragraphs.`;
  }

  // Add diagnosis display instructions
  if (template.showDiagnoses) {
    basePrompt += `\n please include relevent icd10 diagnosis codes for this patient`;
  }

  let finalInstructions = basePrompt;

  if (template.customInstructions) {
    finalInstructions += `\n\nUser's Additional Specific Instructions:\n${template.customInstructions}`;
  }

  // Assuming macroPhrases is an array of objects like { trigger: "...", phrase: "..." }
  // Or simply an array of strings if that's how it's stored from MacroPhrasesTab
  if (template.macroPhrases && template.macroPhrases.length > 0) {
    finalInstructions += `\n\nConsider using the following macro phrases where relevant:\n`;
    // Adjust this part based on the actual structure of macroPhrases items
    template.macroPhrases.forEach(macro => {
      if (typeof macro === 'string') { // If it's just an array of strings
        finalInstructions += `- ${macro}\n`;
      } else if (macro.trigger && macro.phrase) { // If it's an object with trigger and phrase
        finalInstructions += `- If trigger "${macro.trigger}" is typed, expand to: "${macro.phrase}"\n`;
      }
    });
  }

  // Assuming customVocabulary is an array of objects like { word: "...", sounds_like: [...] }
  // Or simply an array of strings
  if (template.customVocabulary && template.customVocabulary.length > 0) {
    finalInstructions += `\n\nPay special attention to the following custom vocabulary (and their potential phonetic misinterpretations to correct for):\n`;
    template.customVocabulary.forEach(vocabItem => {
      if (typeof vocabItem === 'string') { // If it's just an array of strings
        finalInstructions += `- ${vocabItem}\n`;
      } else if (vocabItem.word) { // If it's an object with at least a 'word' property
        let vocabText = `- Term: "${vocabItem.word}"`;
        if (vocabItem.sounds_like && vocabItem.sounds_like.length > 0) {
          vocabText += ` (may sound like: ${vocabItem.sounds_like.join(', ')})`;
        }
        finalInstructions += `${vocabText}\n`;
      }
    });
  }

  finalInstructions += `\n\nGeneral Guidelines: Ensure the note is clinically accurate, concise, professional, and clearly formatted. Avoid jargon where simpler terms suffice unless clinically necessary.`;

  return finalInstructions;
}
