/**
 * Utility functions to format medical findings from JSON to readable formats
 * Maintains data structure while improving display readability
 */

/**
 * Helper function to detect if a string is likely markdown or JSON
 * @param {string} str - String to check
 * @returns {boolean} - True if likely markdown, false if likely JSON
 */
export const isLikelyMarkdown = (str) => {
  if (!str || typeof str !== 'string') return false;
  
  const trimmed = str.trim();
  
  // If it starts with JSON indicators, it's not markdown
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return false;
  
  // Check for markdown indicators
  const markdownIndicators = [
    /^#{1,6}\s/m,  // Headers
    /\*\*/,         // Bold
    /\*/,           // Italic
    /^-\s/m,        // Bullet lists
    /^\d+\.\s/m,    // Numbered lists
    /\[.*\]\(.*\)/, // Links
    /^>/m,          // Blockquotes
    /\|.*\|/        // Tables
  ];
  
  return markdownIndicators.some(pattern => pattern.test(trimmed));
};

/**
 * Convert JSON findings to markdown format for display
 * @param {Object} findings - Structured findings object from backend
 * @returns {string} Markdown formatted findings
 */
export const convertFindingsToMarkdown = (findings) => {
  console.log('convertFindingsToMarkdown called with:', findings);
  if (!findings || typeof findings !== 'object') {
    return '### No Previous Findings Available\n\nThe transcript may need to be processed for findings extraction.';
  }

  // Check if findings contains raw_findings field with JSON string
  if (findings.raw_findings && typeof findings.raw_findings === 'string') {
    console.log('Found raw_findings field, attempting to parse JSON');
    try {
      // Extract JSON from markdown code blocks if present
      let jsonStr = findings.raw_findings;
      const jsonMatch = jsonStr.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      
      // Parse the JSON
      const parsedFindings = JSON.parse(jsonStr);
      console.log('Successfully parsed findings from raw_findings:', parsedFindings);
      
      // Now convert the parsed findings to markdown
      return convertFindingsToMarkdown(parsedFindings);
    } catch (e) {
      console.error('Failed to parse raw_findings JSON:', e);
      // Fall through to regular processing
    }
  }

  // Check if this is the enhanced format with arrays of findings
  if (findings.pain_findings || findings.range_of_motion_findings || findings.neurological_findings || 
      findings.orthopedic_test_findings || findings.palpation_findings || findings.functional_limitations ||
      findings.posture_and_gait_findings || findings.outcome_assessment_tools) {
    console.log('Detected enhanced format, using convertSimpleFormatToMarkdown');
    return convertSimpleFormatToMarkdown(findings);
  }

  // Log the keys to help debug
  console.log('Findings object keys:', Object.keys(findings));

  let markdown = '';

  // Chief Complaint
  if (findings.chief_complaint) {
    markdown += '## Chief Complaint\n';
    if (typeof findings.chief_complaint === 'object') {
      markdown += `**Description:** ${findings.chief_complaint.description || 'Not specified'}\n`;
      markdown += `**Onset:** ${findings.chief_complaint.onset || 'Not specified'}\n`;
      if (findings.chief_complaint.mechanism) {
        markdown += `**Mechanism:** ${findings.chief_complaint.mechanism}\n`;
      }
    } else {
      markdown += `${findings.chief_complaint}\n`;
    }
    markdown += '\n';
  }

  // Pain Assessment
  if (findings.pain_levels || findings.pain_assessment) {
    markdown += '## Pain Assessment\n';
    const painData = findings.pain_levels || findings.pain_assessment;
    
    if (typeof painData === 'object' && !Array.isArray(painData)) {
      // Handle pain_levels format (simple region: score)
      if (findings.pain_levels) {
        markdown += '| Body Region | Pain Level (0-10) |\n';
        markdown += '|-------------|------------------|\n';
        Object.entries(painData).forEach(([region, level]) => {
          markdown += `| ${formatBodyRegion(region)} | **${level}/10** |\n`;
        });
      } else {
        // Handle pain_assessment format (more detailed)
        if (painData.intensity) {
          markdown += '### Pain Intensity\n';
          Object.entries(painData.intensity).forEach(([region, level]) => {
            markdown += `- **${formatBodyRegion(region)}:** ${level}/10\n`;
          });
        }
        if (painData.quality) {
          markdown += `\n**Quality:** ${painData.quality}\n`;
        }
        if (painData.radiation_pattern) {
          markdown += `**Radiation Pattern:** ${painData.radiation_pattern}\n`;
        }
      }
    }
    markdown += '\n';
  }

  // Range of Motion
  if (findings.range_of_motion) {
    markdown += '## Range of Motion Limitations\n';
    if (typeof findings.range_of_motion === 'object') {
      Object.entries(findings.range_of_motion).forEach(([movement, limitation]) => {
        if (typeof limitation === 'object') {
          markdown += `### ${formatBodyRegion(movement)}\n`;
          Object.entries(limitation).forEach(([subMovement, value]) => {
            markdown += `- **${formatMovement(subMovement)}:** ${value}\n`;
          });
        } else {
          markdown += `- **${formatMovement(movement)}:** ${limitation}\n`;
        }
      });
    }
    markdown += '\n';
  }

  // Positive Tests
  if (findings.positive_tests && Array.isArray(findings.positive_tests)) {
    markdown += '## Positive Clinical Tests\n';
    findings.positive_tests.forEach(test => {
      markdown += `- ${test}\n`;
    });
    markdown += '\n';
  } else if (findings.orthopedic_tests) {
    markdown += '## Orthopedic Tests\n';
    Object.entries(findings.orthopedic_tests).forEach(([test, result]) => {
      markdown += `- **${formatTestName(test)}:** ${result}\n`;
    });
    markdown += '\n';
  }

  // Neurological Findings
  if (findings.neurological_findings || findings.neurological) {
    const neuroData = findings.neurological_findings || findings.neurological;
    markdown += '## Neurological Findings\n';
    
    if (neuroData.reflexes) {
      markdown += '### Reflexes\n';
      formatNestedObject(neuroData.reflexes, markdown);
    }
    
    if (neuroData.sensation) {
      markdown += '### Sensation\n';
      formatNestedObject(neuroData.sensation, markdown);
    }
    
    if (neuroData.strength || neuroData.muscle_strength) {
      markdown += '### Muscle Strength\n';
      formatNestedObject(neuroData.strength || neuroData.muscle_strength, markdown);
    }
    markdown += '\n';
  }

  // Palpation Findings
  if (findings.palpation_findings || findings.palpation) {
    const palpData = findings.palpation_findings || findings.palpation;
    markdown += '## Palpation Findings\n';
    
    if (typeof palpData === 'object') {
      Object.entries(palpData).forEach(([area, finding]) => {
        if (typeof finding === 'object') {
          markdown += `### ${formatBodyRegion(area)}\n`;
          formatNestedObject(finding, markdown);
        } else {
          markdown += `- **${formatBodyRegion(area)}:** ${finding}\n`;
        }
      });
    }
    markdown += '\n';
  }

  // Functional Limitations
  if (findings.functional_limitations && Array.isArray(findings.functional_limitations)) {
    markdown += '## Functional Limitations\n';
    findings.functional_limitations.forEach(limitation => {
      markdown += `- ${limitation}\n`;
    });
    markdown += '\n';
  }

  // Diagnoses
  if (findings.diagnoses && Array.isArray(findings.diagnoses)) {
    markdown += '## Clinical Diagnoses\n';
    findings.diagnoses.forEach(diagnosis => {
      markdown += `- ${diagnosis}\n`;
    });
    markdown += '\n';
  }

  // Patient Goals
  if (findings.patient_goals && Array.isArray(findings.patient_goals)) {
    markdown += '## Patient Goals\n';
    findings.patient_goals.forEach(goal => {
      markdown += `- ${goal}\n`;
    });
    markdown += '\n';
  }

  // Imaging Findings
  if (findings.imaging_findings) {
    markdown += '## Imaging Findings\n';
    markdown += `${findings.imaging_findings}\n\n`;
  }

  // Other findings not covered above
  const handledKeys = [
    'chief_complaint', 'pain_levels', 'pain_assessment', 'range_of_motion',
    'positive_tests', 'orthopedic_tests', 'neurological_findings', 'neurological',
    'palpation_findings', 'palpation', 'functional_limitations', 'diagnoses',
    'patient_goals', 'imaging_findings', 'postural_findings', 'subluxations',
    'functional_status', 'movement_analysis', 'balance_assessment', 'gait_analysis'
  ];

  const otherFindings = Object.entries(findings).filter(([key]) => !handledKeys.includes(key));
  
  if (otherFindings.length > 0) {
    markdown += '## Additional Findings\n';
    otherFindings.forEach(([key, value]) => {
      markdown += `### ${formatFieldName(key)}\n`;
      if (typeof value === 'object') {
        formatNestedObject(value, markdown);
      } else if (Array.isArray(value)) {
        value.forEach(item => {
          markdown += `- ${item}\n`;
        });
      } else {
        markdown += `${value}\n`;
      }
      markdown += '\n';
    });
  }

  const trimmedMarkdown = markdown.trim();
  return trimmedMarkdown || 'No clinical findings data available to display.';
};

/**
 * Convert simple format findings (from enhanced extraction) to markdown
 */
function convertSimpleFormatToMarkdown(findings) {
  console.log('convertSimpleFormatToMarkdown called with:', findings);
  let markdown = '### Clinical Baseline Summary\n\n';
  let hasContent = false;

  // Pain Findings
  if (findings.pain_findings && Array.isArray(findings.pain_findings) && findings.pain_findings.length > 0) {
    markdown += '#### Pain Findings\n';
    findings.pain_findings.forEach(finding => {
      if (finding && finding.trim()) {
        markdown += `- ${finding}\n`;
        hasContent = true;
      }
    });
    markdown += '\n';
  }

  // Range of Motion Findings
  if (findings.range_of_motion_findings && Array.isArray(findings.range_of_motion_findings) && findings.range_of_motion_findings.length > 0) {
    markdown += '#### Range of Motion Findings\n';
    findings.range_of_motion_findings.forEach(finding => {
      if (finding && finding.trim()) {
        markdown += `- ${finding}\n`;
        hasContent = true;
      }
    });
    markdown += '\n';
  }

  // Neurological Findings
  if (findings.neurological_findings && Array.isArray(findings.neurological_findings) && findings.neurological_findings.length > 0) {
    markdown += '#### Neurological Findings\n';
    findings.neurological_findings.forEach(finding => {
      if (finding && finding.trim()) {
        markdown += `- ${finding}\n`;
        hasContent = true;
      }
    });
    markdown += '\n';
  }

  // Palpation Findings
  if (findings.palpation_findings && Array.isArray(findings.palpation_findings) && findings.palpation_findings.length > 0) {
    markdown += '#### Palpation Findings\n';
    findings.palpation_findings.forEach(finding => {
      if (finding && finding.trim()) {
        markdown += `- ${finding}\n`;
        hasContent = true;
      }
    });
    markdown += '\n';
  }

  // Orthopedic Test Findings
  if (findings.orthopedic_test_findings && Array.isArray(findings.orthopedic_test_findings) && findings.orthopedic_test_findings.length > 0) {
    markdown += '#### Orthopedic Test Findings\n';
    findings.orthopedic_test_findings.forEach(finding => {
      if (finding && finding.trim()) {
        markdown += `- ${finding}\n`;
        hasContent = true;
      }
    });
    markdown += '\n';
  }

  // Functional Limitations
  if (findings.functional_limitations && Array.isArray(findings.functional_limitations) && findings.functional_limitations.length > 0) {
    markdown += '#### Functional Limitations\n';
    findings.functional_limitations.forEach(finding => {
      if (finding && finding.trim()) {
        markdown += `- ${finding}\n`;
        hasContent = true;
      }
    });
    markdown += '\n';
  }

  // Posture and Gait Findings
  if (findings.posture_and_gait_findings && Array.isArray(findings.posture_and_gait_findings) && findings.posture_and_gait_findings.length > 0) {
    markdown += '#### Posture and Gait Findings\n';
    findings.posture_and_gait_findings.forEach(finding => {
      if (finding && finding.trim()) {
        markdown += `- ${finding}\n`;
        hasContent = true;
      }
    });
    markdown += '\n';
  }

  // Outcome Assessment Tools
  if (findings.outcome_assessment_tools && Array.isArray(findings.outcome_assessment_tools) && findings.outcome_assessment_tools.length > 0) {
    markdown += '#### Outcome Assessment Tools\n';
    findings.outcome_assessment_tools.forEach(tool => {
      if (typeof tool === 'object' && tool.tool_name) {
        markdown += `- **${tool.tool_name}**: ${tool.score}`;
        if (tool.interpretation) {
          markdown += ` (${tool.interpretation})`;
        }
        markdown += '\n';
        hasContent = true;
      } else if (typeof tool === 'string' && tool.trim()) {
        markdown += `- ${tool}\n`;
        hasContent = true;
      }
    });
    markdown += '\n';
  }

  // If we have the date, add it at the end
  if (findings.date) {
    const dateStr = new Date(findings.date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    markdown += `\n*Initial evaluation performed on ${dateStr}*\n`;
  }

  return hasContent ? markdown.trim() : '### No clinical findings available\n\nThe initial evaluation may not have extractable positive findings.';
}

/**
 * Helper function to format nested objects
 */
function formatNestedObject(obj, markdown, indent = '') {
  if (!obj || typeof obj !== 'object') {
    return `${indent}${obj}\n`;
  }

  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'object' && !Array.isArray(value)) {
      markdown += `${indent}- **${formatFieldName(key)}:**\n`;
      formatNestedObject(value, markdown, indent + '  ');
    } else if (Array.isArray(value)) {
      markdown += `${indent}- **${formatFieldName(key)}:**\n`;
      value.forEach(item => {
        markdown += `${indent}  - ${item}\n`;
      });
    } else {
      markdown += `${indent}- **${formatFieldName(key)}:** ${value}\n`;
    }
  });
}

/**
 * Format body region names for display
 */
function formatBodyRegion(region) {
  return region
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\bRom\b/g, 'ROM')
    .replace(/\bMmt\b/g, 'MMT');
}

/**
 * Format movement names for display
 */
function formatMovement(movement) {
  return movement
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format test names for display
 */
function formatTestName(test) {
  return test
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\bSlr\b/g, 'SLR')
    .replace(/\bDtr\b/g, 'DTR');
}

/**
 * Format field names for display
 */
function formatFieldName(field) {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Generate a summary comparison between initial and current findings
 * @param {Object} initialFindings - Initial evaluation findings
 * @param {Object} currentFindings - Current evaluation findings
 * @returns {string} Markdown formatted comparison
 */
export const generateFindingsComparison = (initialFindings, currentFindings) => {
  let markdown = '# Comparative Analysis\n\n';

  // Compare pain levels
  if (initialFindings.pain_levels && currentFindings.pain_levels) {
    markdown += '## Pain Level Changes\n';
    markdown += '| Body Region | Initial | Current | Change |\n';
    markdown += '|-------------|---------|---------|--------|\n';

    const allRegions = new Set([
      ...Object.keys(initialFindings.pain_levels),
      ...Object.keys(currentFindings.pain_levels)
    ]);

    allRegions.forEach(region => {
      const initial = initialFindings.pain_levels[region] || 0;
      const current = currentFindings.pain_levels[region] || 0;
      const change = current - initial;
      const changeStr = change > 0 ? `+${change} ⬆️` : change < 0 ? `${change} ⬇️` : '0 ➡️';
      const improvement = change < 0 ? '✅' : change > 0 ? '❌' : '➖';
      
      markdown += `| ${formatBodyRegion(region)} | ${initial}/10 | ${current}/10 | ${changeStr} ${improvement} |\n`;
    });
    markdown += '\n';
  }

  // Compare functional limitations
  if (initialFindings.functional_limitations && currentFindings.functional_limitations) {
    markdown += '## Functional Status Comparison\n';
    markdown += '### Resolved Limitations\n';
    const resolved = initialFindings.functional_limitations.filter(
      limitation => !currentFindings.functional_limitations.includes(limitation)
    );
    if (resolved.length > 0) {
      resolved.forEach(item => markdown += `- ✅ ${item}\n`);
    } else {
      markdown += '- None\n';
    }

    markdown += '\n### Persistent Limitations\n';
    const persistent = initialFindings.functional_limitations.filter(
      limitation => currentFindings.functional_limitations.includes(limitation)
    );
    if (persistent.length > 0) {
      persistent.forEach(item => markdown += `- ⚠️ ${item}\n`);
    } else {
      markdown += '- None\n';
    }

    markdown += '\n### New Limitations\n';
    const newLimitations = currentFindings.functional_limitations.filter(
      limitation => !initialFindings.functional_limitations.includes(limitation)
    );
    if (newLimitations.length > 0) {
      newLimitations.forEach(item => markdown += `- 🆕 ${item}\n`);
    } else {
      markdown += '- None\n';
    }
    markdown += '\n';
  }

  return markdown;
};

/**
 * Create a clinical summary from findings
 * @param {Object} findings - Findings object
 * @returns {string} Brief clinical summary
 */
export const createClinicalSummary = (findings) => {
  if (!findings) return 'No findings available.';

  const summary = [];

  // Chief complaint
  if (findings.chief_complaint) {
    const complaint = typeof findings.chief_complaint === 'object' 
      ? findings.chief_complaint.description 
      : findings.chief_complaint;
    summary.push(`**Primary Concern:** ${complaint}`);
  }

  // Highest pain levels
  if (findings.pain_levels) {
    const painEntries = Object.entries(findings.pain_levels);
    const maxPain = painEntries.reduce((max, [region, level]) => 
      level > max.level ? { region, level } : max, 
      { region: '', level: 0 }
    );
    if (maxPain.level > 0) {
      summary.push(`**Highest Pain:** ${formatBodyRegion(maxPain.region)} (${maxPain.level}/10)`);
    }
  }

  // Count of positive tests
  if (findings.positive_tests && findings.positive_tests.length > 0) {
    summary.push(`**Positive Tests:** ${findings.positive_tests.length} findings`);
  }

  // Primary diagnoses
  if (findings.diagnoses && findings.diagnoses.length > 0) {
    summary.push(`**Diagnoses:** ${findings.diagnoses[0]}${findings.diagnoses.length > 1 ? ` (+${findings.diagnoses.length - 1} more)` : ''}`);
  }

  return summary.join(' | ');
};