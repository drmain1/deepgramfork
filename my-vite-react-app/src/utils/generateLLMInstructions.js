export function generateLLMInstructions(template) {
  let instructions = `Create a medical note with the following structure: ${template.structure}.\n`;
  if (template.customInstructions) {
    instructions += `Additional instructions: ${template.customInstructions}\n`;
  }
  if (template.macroPhrases.length > 0) {
    instructions += `Use the following macro phrases:\n${template.macroPhrases.join('\n')}\n`;
  }
  if (template.customVocabulary.length > 0) {
    instructions += `Incorporate custom vocabulary:\n${template.customVocabulary.join(', ')}\n`;
  }
  instructions += `Ensure the note is concise, professional, and formatted for clarity.`;
  return instructions;
}
