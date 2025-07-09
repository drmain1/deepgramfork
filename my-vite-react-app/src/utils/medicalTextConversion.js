// Utility functions for converting between JSON and plain text formats for medical notes

export function jsonToPlainText(jsonData) {
  try {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    let text = '';

    // Header with evaluation type
    if (data.evaluation_type) {
      text += `=== ${data.evaluation_type === 're_evaluation' ? 'RE-EVALUATION' : 'INITIAL EVALUATION'} ===\n\n`;
    }

    // Patient Information
    if (data.patient_info) {
      text += 'PATIENT INFORMATION\n';
      text += `Name: ${data.patient_info.patient_name || '[Not specified]'}\n`;
      text += `DOB: ${data.patient_info.date_of_birth || '[Not specified]'}\n`;
      text += `Accident Date: ${data.patient_info.date_of_accident || '[Not specified]'}\n`;
      text += `Treatment Date: ${data.patient_info.date_of_treatment || '[Not specified]'}\n`;
      text += `Provider: ${data.patient_info.provider || '[Not specified]'}\n\n`;
    }

    // Clinic Information
    if (data.clinic_info && data.clinic_info.name) {
      text += 'CLINIC INFORMATION\n';
      text += `Name: ${data.clinic_info.name}\n`;
      if (data.clinic_info.address) text += `Address: ${data.clinic_info.address}\n`;
      if (data.clinic_info.phone) text += `Phone: ${data.clinic_info.phone}\n`;
      if (data.clinic_info.fax) text += `Fax: ${data.clinic_info.fax}\n`;
      text += '\n';
    }

    // Sections
    if (data.sections) {
      const sectionTitles = {
        chief_complaint: 'CHIEF COMPLAINT',
        history_of_present_illness: 'HISTORY OF PRESENT ILLNESS',
        past_medical_history: 'PAST MEDICAL HISTORY',
        previous_accidents_trauma: 'PREVIOUS ACCIDENTS/TRAUMA',
        current_medications: 'CURRENT MEDICATIONS',
        past_surgical_history: 'PAST SURGICAL HISTORY',
        family_history: 'FAMILY HISTORY',
        allergies: 'ALLERGIES',
        social_history: 'SOCIAL HISTORY',
        review_of_other_systems: 'REVIEW OF OTHER SYSTEMS',
        duties_under_duress: 'DUTIES UNDER DURESS',
        vitals: 'VITALS',
        outcome_assessments: 'OUTCOME ASSESSMENTS',
        physical_examination: 'PHYSICAL EXAMINATION',
        cervico_thoracic: 'CERVICO-THORACIC',
        lumbopelvic: 'LUMBOPELVIC',
        extremity: 'EXTREMITY',
        sensory_examination: 'SENSORY EXAMINATION',
        assessment_diagnosis: 'ASSESSMENT/DIAGNOSIS',
        plan: 'PLAN',
        prognosis: 'PROGNOSIS',
        goals: 'GOALS'
      };

      Object.entries(data.sections).forEach(([key, value]) => {
        if (value && value !== null) {
          const title = sectionTitles[key] || key.toUpperCase().replace(/_/g, ' ');
          text += `${title}\n`;
          
          // Handle special formatting for chief complaint with comparisons
          if (key === 'chief_complaint' && value.includes('|')) {
            // Split by numbered items
            const items = value.split(/\d+\.\s+/).filter(item => item.trim());
            items.forEach((item, index) => {
              if (item.trim()) {
                text += `${index + 1}. ${item.trim()}\n`;
              }
            });
          } else {
            text += `${value}\n`;
          }
          text += '\n';
        }
      });
    }

    // Progress Comparison (for re-evaluations)
    if (data.progress_comparison) {
      text += 'PROGRESS COMPARISON\n';
      
      if (data.progress_comparison.symptoms_improved) {
        text += '\nSymptoms Improved:\n';
        data.progress_comparison.symptoms_improved.forEach(item => {
          text += `- ${item}\n`;
        });
      }
      
      if (data.progress_comparison.symptoms_unchanged) {
        text += '\nSymptoms Unchanged:\n';
        data.progress_comparison.symptoms_unchanged.forEach(item => {
          text += `- ${item}\n`;
        });
      }
      
      if (data.progress_comparison.symptoms_worsened) {
        text += '\nSymptoms Worsened:\n';
        data.progress_comparison.symptoms_worsened.forEach(item => {
          text += `- ${item}\n`;
        });
      }
      
      if (data.progress_comparison.overall_progress) {
        text += `\nOverall Progress: ${data.progress_comparison.overall_progress}\n`;
      }
      text += '\n';
    }

    // Summary
    if (data.summary) {
      text += 'SUMMARY\n';
      text += `${data.summary}\n\n`;
    }

    // Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      text += 'RECOMMENDATIONS\n';
      data.recommendations.forEach((rec, index) => {
        text += `${index + 1}. ${rec}\n`;
      });
    }

    return text.trim();
  } catch (error) {
    console.error('Error converting JSON to plain text:', error);
    // If it's not valid JSON, return as-is
    return jsonData;
  }
}

export function plainTextToJson(plainText) {
  try {
    // First check if it's already JSON
    try {
      const parsed = JSON.parse(plainText);
      if (typeof parsed === 'object') {
        return plainText; // Return as-is if it's valid JSON
      }
    } catch (e) {
      // Not JSON, continue with plain text parsing
    }

    const lines = plainText.split('\n');
    const result = {
      patient_info: {},
      clinic_info: {},
      sections: {}
    };

    let currentSection = null;
    let currentContent = [];
    let isInProgressComparison = false;
    let progressComparisonSection = null;

    // Check for evaluation type
    const evalTypeMatch = plainText.match(/=== (RE-EVALUATION|INITIAL EVALUATION) ===/);
    if (evalTypeMatch) {
      result.evaluation_type = evalTypeMatch[1] === 'RE-EVALUATION' ? 're_evaluation' : 'initial_evaluation';
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and header
      if (!line || line.startsWith('===')) continue;

      // Patient Information section
      if (line === 'PATIENT INFORMATION') {
        currentSection = 'patient_info';
        continue;
      }

      // Clinic Information section
      if (line === 'CLINIC INFORMATION') {
        currentSection = 'clinic_info';
        continue;
      }

      // Progress Comparison section
      if (line === 'PROGRESS COMPARISON') {
        currentSection = 'progress_comparison';
        result.progress_comparison = {
          symptoms_improved: [],
          symptoms_unchanged: [],
          symptoms_worsened: [],
          overall_progress: ''
        };
        continue;
      }

      // Handle progress comparison subsections
      if (currentSection === 'progress_comparison') {
        if (line === 'Symptoms Improved:') {
          progressComparisonSection = 'symptoms_improved';
          continue;
        } else if (line === 'Symptoms Unchanged:') {
          progressComparisonSection = 'symptoms_unchanged';
          continue;
        } else if (line === 'Symptoms Worsened:') {
          progressComparisonSection = 'symptoms_worsened';
          continue;
        } else if (line.startsWith('Overall Progress:')) {
          result.progress_comparison.overall_progress = line.replace('Overall Progress:', '').trim();
          continue;
        } else if (line.startsWith('- ') && progressComparisonSection) {
          result.progress_comparison[progressComparisonSection].push(line.substring(2));
          continue;
        }
      }

      // Check if it's a new section header (all caps)
      const sectionMap = {
        'CHIEF COMPLAINT': 'chief_complaint',
        'HISTORY OF PRESENT ILLNESS': 'history_of_present_illness',
        'PAST MEDICAL HISTORY': 'past_medical_history',
        'PREVIOUS ACCIDENTS/TRAUMA': 'previous_accidents_trauma',
        'CURRENT MEDICATIONS': 'current_medications',
        'PAST SURGICAL HISTORY': 'past_surgical_history',
        'FAMILY HISTORY': 'family_history',
        'ALLERGIES': 'allergies',
        'SOCIAL HISTORY': 'social_history',
        'REVIEW OF OTHER SYSTEMS': 'review_of_other_systems',
        'DUTIES UNDER DURESS': 'duties_under_duress',
        'VITALS': 'vitals',
        'OUTCOME ASSESSMENTS': 'outcome_assessments',
        'PHYSICAL EXAMINATION': 'physical_examination',
        'CERVICO-THORACIC': 'cervico_thoracic',
        'LUMBOPELVIC': 'lumbopelvic',
        'EXTREMITY': 'extremity',
        'SENSORY EXAMINATION': 'sensory_examination',
        'ASSESSMENT/DIAGNOSIS': 'assessment_diagnosis',
        'PLAN': 'plan',
        'PROGNOSIS': 'prognosis',
        'GOALS': 'goals',
        'SUMMARY': 'summary',
        'RECOMMENDATIONS': 'recommendations'
      };

      const isNewSection = Object.keys(sectionMap).includes(line);
      
      if (isNewSection) {
        // Save previous section content
        if (currentSection === 'sections' && currentContent.length > 0 && result._currentSectionKey) {
          result.sections[result._currentSectionKey] = currentContent.join('\n').trim();
          currentContent = [];
        }
        
        // Start new section
        const sectionKey = sectionMap[line];
        
        // Handle special sections
        if (line === 'SUMMARY') {
          currentSection = 'summary';
          currentContent = [];
        } else if (line === 'RECOMMENDATIONS') {
          currentSection = 'recommendations';
          result.recommendations = [];
        } else {
          // Store the section key for later use
          currentSection = 'sections';
          currentContent = [];
          result._currentSectionKey = sectionKey;
        }
        continue;
      }

      // Parse patient/clinic info fields
      if (currentSection === 'patient_info' || currentSection === 'clinic_info') {
        const fieldMatch = line.match(/^(.+?):\s*(.*)$/);
        if (fieldMatch) {
          const [, field, value] = fieldMatch;
          const fieldMap = {
            'Name': currentSection === 'patient_info' ? 'patient_name' : 'name',
            'DOB': 'date_of_birth',
            'Accident Date': 'date_of_accident',
            'Treatment Date': 'date_of_treatment',
            'Provider': 'provider',
            'Address': 'address',
            'Phone': 'phone',
            'Fax': 'fax'
          };
          
          const mappedField = fieldMap[field] || field.toLowerCase().replace(/\s+/g, '_');
          if (value && value !== '[Not specified]') {
            result[currentSection][mappedField] = value;
          }
        }
        continue;
      }

      // Handle recommendations
      if (currentSection === 'recommendations') {
        const recMatch = line.match(/^\d+\.\s*(.+)$/);
        if (recMatch) {
          result.recommendations.push(recMatch[1]);
        }
        continue;
      }

      // Handle summary
      if (currentSection === 'summary') {
        currentContent.push(line);
        continue;
      }

      // Collect section content
      if (currentSection === 'sections') {
        currentContent.push(line);
      }
    }

    // Save any remaining content
    if (currentSection === 'sections' && currentContent.length > 0 && result._currentSectionKey) {
      result.sections[result._currentSectionKey] = currentContent.join('\n').trim();
    } else if (currentSection === 'summary' && currentContent.length > 0) {
      result.summary = currentContent.join('\n').trim();
    }

    // Clean up temporary tracking field
    delete result._currentSectionKey;

    // Clean up empty objects
    if (Object.keys(result.patient_info).length === 0) delete result.patient_info;
    if (Object.keys(result.clinic_info).length === 0) delete result.clinic_info;
    if (Object.keys(result.sections).length === 0) delete result.sections;

    return JSON.stringify(result, null, 2);
  } catch (error) {
    console.error('Error converting plain text to JSON:', error);
    throw new Error('Failed to parse plain text format. Please check the formatting and try again.');
  }
}