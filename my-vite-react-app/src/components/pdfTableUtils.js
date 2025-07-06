/**
 * PDF Table and HTML Conversion Utilities
 * 
 * This module handles the conversion of formatted medical text to HTML,
 * including table detection, parsing, and markdown formatting.
 */

/**
 * Parses inline markdown formatting
 * @param {string} text - Text with markdown formatting
 * @returns {string} - HTML formatted text
 */
const parseInlineFormatting = (text) => {
  // Convert **text** to <strong>text</strong> for bold
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700;">$1</strong>');
  // Convert *text* to <em>text</em> for italic (but not if it's part of **)
  formatted = formatted.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>');
  return formatted;
};

/**
 * Detects if a group of lines forms a table
 * @param {string[]} lines - Array of text lines
 * @param {number} startIndex - Starting index to check
 * @returns {object|null} - Table info with lines and endIndex, or null if not a table
 */
const detectTable = (lines, startIndex) => {
  const tableLines = [];
  let currentIndex = startIndex;
  let tableType = null; // 'pipe' or 'space'
  
  // Enhanced patterns for table detection
  const patterns = {
    pipe: /\|/,
    multiSpace: /\S+\s{2,}\S+/,
    spaceAligned: /^[A-Z\s]+\s{2,}[A-Z]+(\s{2,}[A-Z]+)*$/,
    separator: /^[\s\-|]+$/
  };
  
  // List patterns to exclude from table detection
  const listPatterns = {
    bullet: /^[\*\-•]\s+/,
    numbered: /^\d+\.\s+/,
    lettered: /^[a-zA-Z]\.\s+/
  };
  
  // Determine table type from first line
  const firstLine = lines[startIndex]?.trim() || '';
  
  if (listPatterns.bullet.test(firstLine) || 
      listPatterns.numbered.test(firstLine) || 
      listPatterns.lettered.test(firstLine)) {
    return null; // This is a list, not a table
  }
  
  // Check for actual table patterns
  if (patterns.pipe.test(firstLine)) {
    tableType = 'pipe';
  } else if (patterns.spaceAligned.test(firstLine)) {
    // Make sure it's actually a table header with multiple columns
    const columns = firstLine.split(/\s{2,}/).filter(col => col.trim());
    if (columns.length >= 2) {
      tableType = 'space';
    } else {
      return null;
    }
  } else if (patterns.multiSpace.test(firstLine)) {
    // Check if it's a data row with consistent spacing (not just a bullet list)
    const parts = firstLine.split(/\s{2,}/).filter(part => part.trim());
    // Only consider it a table if it has multiple meaningful columns
    if (parts.length >= 2 && !parts.some(part => listPatterns.bullet.test(part))) {
      tableType = 'space';
    } else {
      return null;
    }
  } else {
    return null;
  }
  
  // Collect table lines based on type
  while (currentIndex < lines.length) {
    const line = lines[currentIndex].trim();
    
    // Skip empty lines at the start
    if (line === '' && tableLines.length === 0) {
      currentIndex++;
      continue;
    }
    
    // Check for end of table - be more lenient with empty lines
    if (line === '' && tableLines.length > 0) {
      // Look ahead up to 3 lines to see if table continues
      let foundContinuation = false;
      let emptyLineCount = 0;
      
      for (let j = currentIndex; j < Math.min(currentIndex + 3, lines.length); j++) {
        const checkLine = lines[j]?.trim() || '';
        if (checkLine === '') {
          emptyLineCount++;
          continue;
        }
        
        // Check if this line continues the table
        if (tableType === 'pipe' && patterns.pipe.test(checkLine)) {
          foundContinuation = true;
          break;
        } else if (tableType === 'space') {
          const parts = checkLine.split(/\s{2,}/).filter(p => p.trim());
          // More lenient check for space tables - even single column can continue table
          if (parts.length >= 1 && !checkLine.match(/^[A-Z][A-Z\s]*:$/)) {
            foundContinuation = true;
            break;
          }
        }
        break; // Stop at first non-empty line
      }
      
      // Only break if we found 2+ consecutive empty lines with no continuation
      if (!foundContinuation && emptyLineCount >= 2) {
        break;
      }
    }
    
    // Check if line belongs to table
    let isTableLine = false;
    if (tableType === 'pipe') {
      // For pipe tables, include any line with pipes or separator lines
      isTableLine = patterns.pipe.test(line) || patterns.separator.test(line) || 
                   (line === '' && tableLines.length > 0); // Empty lines within table
    } else if (tableType === 'space') {
      // For space-aligned tables, be more inclusive after headers
      if (tableLines.length > 0) {
        // We're already in a table - be more lenient with what we include
        const hasContent = line.trim() !== '';
        const notSectionHeader = !line.match(/^[A-Z][A-Z\s]*:$/);
        const notList = !Object.values(listPatterns).some(pattern => pattern.test(line));
        
        // Check different patterns for table rows
        const spaceParts = line.split(/\s{2,}/).filter(part => part.trim());
        const singleSpaceParts = line.trim().split(/\s+/);
        
        // Special patterns for medical tables
        const isMuscleRow = line.match(/^[A-Z\s]+\s+\d+\/\d+\s+\d+\/\d+$/); // e.g., "EXT HALLUCIS LONGUS 5/5 5/5"
        const isReflexRow = line.match(/^[A-Z\s]+\s+\d\+?\s+\d\+?$/); // e.g., "HOFFMAN 2+ 2+"
        const isPathologicalRow = line.match(/^[A-Z\s()]+\s+(Negative|Positive)\s+(Negative|Positive)$/i);
        
        // Include the line if it:
        // 1. Has multiple double-space separated parts
        // 2. Matches specific medical table patterns
        // 3. Is within the first 15 lines of the table (more lenient for longer tables)
        // 4. Has content and is not a section header or list
        isTableLine = (spaceParts.length >= 2) ||
                      isMuscleRow ||
                      isReflexRow ||
                      isPathologicalRow ||
                      (hasContent && notSectionHeader && notList && tableLines.length < 15) ||
                      (singleSpaceParts.length >= 3 && singleSpaceParts.some(p => p.match(/^\d+\/\d+$|^\d\+?$/)));
      } else {
        // First line - strict check
        const spaceParts = line.split(/\s{2,}/).filter(part => part.trim());
        const hasMultipleColumns = spaceParts.length >= 2;
        const notList = !listPatterns.bullet.test(line) && 
                       !listPatterns.numbered.test(line) && 
                       !listPatterns.lettered.test(line);
        
        isTableLine = (
          (patterns.multiSpace.test(line) && hasMultipleColumns && notList) ||
          patterns.spaceAligned.test(line) ||
          patterns.separator.test(line)
        );
      }
    }
    
    if (isTableLine || (line === '' && tableLines.length > 0)) {
      tableLines.push(line);
      currentIndex++;
    } else {
      // For pipe tables, check more carefully for continuation
      if (tableType === 'pipe' && tableLines.length > 0) {
        // Check next few lines to see if table continues
        let lookahead = 0;
        while (lookahead < 3 && (currentIndex + lookahead) < lines.length) {
          const nextLine = lines[currentIndex + lookahead]?.trim() || '';
          if (patterns.pipe.test(nextLine)) {
            // Found another pipe line - continue table
            for (let i = 0; i <= lookahead; i++) {
              if (currentIndex < lines.length) {
                tableLines.push(lines[currentIndex]);
                currentIndex++;
              }
            }
            continue;
          }
          lookahead++;
        }
      }
      
      // End of table
      if (tableLines.length > 0) {
        break;
      } else {
        return null;
      }
    }
  }
  
  // Clean up trailing empty lines
  while (tableLines.length > 0 && tableLines[tableLines.length - 1] === '') {
    tableLines.pop();
  }
  
  // Need at least 2 non-empty lines to make a table
  const nonEmptyLines = tableLines.filter(line => line !== '');
  if (nonEmptyLines.length < 2) {
    return null;
  }
  
  return {
    lines: tableLines,
    endIndex: currentIndex - 1,
    type: tableType
  };
};

/**
 * Parses table lines into HTML
 * @param {string[]} tableLines - Array of table row strings
 * @param {string} tableType - Type of table ('pipe' or 'space')
 * @returns {string} - HTML table string
 */
const parseTableToHtml = (tableLines, tableType = 'pipe') => {
  let headerRow = null;
  const rows = [];
  
  // Process lines based on table type
  tableLines.forEach((line, index) => {
    // Skip empty lines and separator lines
    if (!line.trim() || /^[\s\-|]+$/.test(line)) {
      return;
    }
    
    let cells = [];
    
    if (tableType === 'pipe') {
      // Split by | and clean up cells - handle markdown bold syntax
      cells = line.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '')
        .map(cell => cell.replace(/\*\*/g, '')); // Remove ** for bold text
    } else {
      // For space-aligned tables, split by multiple spaces
      // First check if it's a header-style line
      if (line.match(/^[A-Z\s]+\s{2,}[A-Z]+/)) {
        // Split carefully to preserve column alignment
        cells = line.split(/\s{2,}/).map(cell => cell.trim());
      } else {
        // For data rows, be more flexible
        cells = line.split(/\s{2,}/).map(cell => cell.trim());
        
        // Filter out cells that are just bullet points or list markers
        cells = cells.filter(cell => !cell.match(/^[\*\-•]\s*$/));
        
        // If we only got one cell, try splitting by single spaces for short values
        if (cells.length === 1 && headerRow && headerRow.length > 1) {
          const parts = line.trim().split(/\s+/);
          
          // Special handling for medical table formats
          if (headerRow.length === 3) {
            // For 3-column tables (MUSCLE GROUP | RIGHT | LEFT)
            // Check if last two parts look like values (e.g., 5/5, 2+, Negative)
            if (parts.length >= 3) {
              const lastTwo = parts.slice(-2);
              const valuePattern = /^\d+\/\d+$|^\d\+?$|^(Negative|Positive)$/i;
              
              if (lastTwo.every(part => valuePattern.test(part))) {
                // Last two are values, everything else is the first column
                const muscleGroup = parts.slice(0, -2).join(' ');
                cells = [muscleGroup, lastTwo[0], lastTwo[1]];
              } else if (parts.length === headerRow.length) {
                // Perfect match
                cells = parts;
              }
            } else if (parts.length === 2) {
              // Might be missing one value
              cells = [parts[0], parts[1], ''];
            }
          } else if (headerRow.length === 2 && parts.length >= 2) {
            // For 2-column tables
            const lastValue = parts[parts.length - 1];
            const firstPart = parts.slice(0, -1).join(' ');
            cells = [firstPart, lastValue];
          } else if (parts.length === headerRow.length) {
            // Perfect match for any column count
            cells = parts;
          }
        }
      }
    }
    
    if (cells.length > 0) {
      if (headerRow === null && index < tableLines.length / 2) {
        // First non-separator row is likely the header
        headerRow = cells;
      } else {
        rows.push(cells);
      }
    }
  });
  
  // Determine column widths based on content type
  let columnWidths = [];
  if (headerRow && headerRow.length === 3) {
    // For 3-column tables (like MUSCLE GROUP | RIGHT | LEFT)
    columnWidths = ['60%', '20%', '20%'];
  } else if (headerRow && headerRow.length === 2) {
    // For 2-column tables
    columnWidths = ['60%', '40%'];
  } else {
    // Default equal width
    const colWidth = Math.floor(100 / (headerRow?.length || 1));
    columnWidths = Array(headerRow?.length || 1).fill(`${colWidth}%`);
  }
  
  let tableHtml = `
    <table style="
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-family: 'Besley', Georgia, serif;
      background: #fcfcfa;
      table-layout: fixed;
    ">
  `;
  
  // Add header if exists
  if (headerRow) {
    tableHtml += '<thead><tr>';
    headerRow.forEach((cell, cellIndex) => {
      // Clean cell content - remove ** formatting
      const cleanCell = cell.replace(/\*\*/g, '');
      tableHtml += `
        <th style="
          border: 1px solid #e0e0e0;
          padding: 10px 12px;
          background-color: #f5f5f3;
          font-weight: 700;
          text-align: ${cellIndex === 0 ? 'left' : 'center'};
          font-size: 12px;
          color: #000;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          width: ${columnWidths[cellIndex]};
        ">${cleanCell}</th>
      `;
    });
    tableHtml += '</tr></thead>';
  }
  
  // Add body rows
  tableHtml += '<tbody>';
  rows.forEach((row, rowIndex) => {
    // Subtle alternating rows
    const backgroundColor = rowIndex % 2 === 0 ? '#fcfcfa' : '#f9f9f7';
    tableHtml += `<tr style="background-color: ${backgroundColor};">`;
    
    row.forEach((cell, cellIndex) => {
      // Clean cell content - remove ** formatting
      const cleanCell = cell.replace(/\*\*/g, '');
      // First column gets left alignment and bold, others center
      const textAlign = cellIndex === 0 ? 'left' : 'center';
      const fontWeight = cellIndex === 0 ? 'normal' : 'normal';
      
      tableHtml += `
        <td style="
          border: 1px solid #e0e0e0;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: ${fontWeight};
          vertical-align: middle;
          text-align: ${textAlign};
          color: #000000;
          text-transform: ${cellIndex === 0 ? 'uppercase' : 'none'};
        ">${cleanCell}</td>
      `;
    });
    tableHtml += '</tr>';
  });
  tableHtml += '</tbody></table>';
  
  return tableHtml;
};

/**
 * Converts formatted medical text to HTML with tables and styling for PDF generation
 * @param {string} content - The medical transcript content with markdown formatting
 * @param {object} options - Options including clinicLogo
 * @returns {string} - HTML formatted content with tables and styling
 */
export const convertFormattedTextToHtml = (content, options = {}) => {
  if (!content) return '';

  const { clinicLogo = '' } = options;
  const lines = content.split('\n');
  let htmlContent = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    
    // Check for special header section
    if (line.trim() === '[HEADER_START]') {
      let logoHTML = '';
      let locationHTML = '';
      
      i++; // Move past [HEADER_START]
      
      while (i < lines.length && lines[i].trim() !== '[HEADER_END]') {
        const headerLine = lines[i].trim();
        
        if (headerLine === '[CLINIC_LOGO]' && clinicLogo) {
          logoHTML = `
            <img src="${clinicLogo}" alt="Clinic Logo" style="
              max-width: 200px;
              max-height: 200px;
              object-fit: contain;
              display: block;
              margin: 0;
              padding: 0;
            " />
          `;
        } else if (headerLine === '[LOCATION_RIGHT]') {
          locationHTML = `<div style="text-align: right; line-height: 1.4;">`;
          i++;
          let lineIndex = 0;
          while (i < lines.length && lines[i].trim() !== '[/LOCATION_RIGHT]') {
            if (lines[i].trim()) {
              if (lineIndex === 0) {
                // First line (office name) - bold and larger
                locationHTML += `<div style="font-size: 13px; font-weight: 600; color: #000; margin-bottom: 2px;">${lines[i].trim()}</div>`;
              } else {
                // Address lines
                locationHTML += `<div style="font-size: 11px; color: #333333; font-weight: 400;">${lines[i].trim()}</div>`;
              }
              lineIndex++;
            }
            i++;
          }
          locationHTML += '</div>';
        }
        i++;
      }
      
      // Build table-based header
      let headerHTML = `
        <table style="width: calc(100% + 20px); margin-left: -10px; margin-top: -10px; margin-bottom: 20px; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding: 0;">
              ${logoHTML || '&nbsp;'}
            </td>
            <td style="width: 50%; vertical-align: top; text-align: right; padding: 0; padding-right: 10px;">
              ${locationHTML || '&nbsp;'}
            </td>
          </tr>
        </table>
        <div style="border-bottom: 1px solid #e0e0e0; margin-bottom: 20px; margin-left: -10px; margin-right: -10px; margin-top: 10px;"></div>
      `;
      
      htmlContent += headerHTML;
      i++; // Move past [HEADER_END]
      continue;
    }
    
    // Skip standalone [CLINIC_LOGO] - only process it within [HEADER_START]/[HEADER_END]
    if (line.trim() === '[CLINIC_LOGO]' && clinicLogo) {
      i++;
      continue;
    }
    
    // Check for table at current position
    const tableResult = detectTable(lines, i);
    if (tableResult) {
      htmlContent += parseTableToHtml(tableResult.lines, tableResult.type);
      i = tableResult.endIndex + 1;
      continue;
    }

    // Regular line processing
    // Check for "FOLLOW-UP VISITS" header
    if (line.trim() === 'FOLLOW-UP VISITS') {
      htmlContent += `<p style="margin: 30px 0 15px 0; font-weight: 700; font-size: 16px; color: #000; text-align: left; text-transform: uppercase; letter-spacing: 0.05em;">FOLLOW-UP VISITS</p>`;
      i++;
      continue;
    }
    
    // Check for visit headers (e.g., "June 2, 2025 - Visit #2" or "June 1, 2025 - Initial Examination" or just "June 4, 2025")
    const visitHeaderPattern = /^([A-Za-z]+ \d{1,2}, \d{4})\s*(-\s*(.+))?$/;
    const visitMatch = line.match(visitHeaderPattern);
    if (visitMatch) {
      const [, date, , visitType] = visitMatch;
      if (visitType) {
        htmlContent += `<p style="margin: 10px 0 5px 0; font-weight: 700; font-size: 16px; color: #000; letter-spacing: -0.02em;">${date} - ${visitType}</p>`;
      } else {
        htmlContent += `<p style="margin: 10px 0 5px 0; font-weight: 700; font-size: 16px; color: #000; letter-spacing: -0.02em;">${date}</p>`;
      }
      i++;
      continue;
    }
    
    // Check for markdown-style headers (**HEADER:**)
    const markdownHeaderPattern = /^\*\*([A-Z][A-Z\s&,()/-]*:)\*\*\s*(.*)/;
    // Check if line is a medical header (all caps ending with colon)
    const headerPattern = /^([A-Z][A-Z\s&,()/-]*:)\s*(.*)/;
    // Check for numbered lists (1., 2., etc.)
    const numberedListPattern = /^(\s*)(\d+\.\s+)(.*)/;
    // Check for bullet points (-, •, *, etc.)
    const bulletPattern = /^(\s*)([-•*]\s+)(.*)/;
    
    const markdownMatch = line.match(markdownHeaderPattern);
    const headerMatch = line.match(headerPattern);
    const numberedMatch = line.match(numberedListPattern);
    const bulletMatch = line.match(bulletPattern);

    if (markdownMatch || headerMatch) {
      const match = markdownMatch || headerMatch;
      const [, header, content] = match;
      htmlContent += `<p style="margin: 8px 0 4px 0; font-weight: 700; font-size: 13px; color: #000; letter-spacing: -0.01em; text-transform: uppercase;"><strong style="font-weight: 700;">${header}</strong>`;
      if (content) {
        htmlContent += ` <span style="font-weight: 400; font-size: 12px;">${parseInlineFormatting(content)}</span>`;
      }
      htmlContent += '</p>';
    } else if (numberedMatch) {
      const [, indent, number, content] = numberedMatch;
      const marginLeft = indent ? indent.length * 10 : 0;
      htmlContent += `<p style="margin: 3px 0 3px ${marginLeft}px; font-size: 12px; font-weight: 400; color: #000000; line-height: 1.4;"><strong style="font-weight: 700;">${number}</strong>${parseInlineFormatting(content)}</p>`;
    } else if (bulletMatch) {
      const [, indent, bullet, content] = bulletMatch;
      const marginLeft = indent ? indent.length * 10 : 0;
      htmlContent += `<p style="margin: 3px 0 3px ${marginLeft}px; font-size: 12px; font-weight: 400; color: #000000; line-height: 1.4;"><strong style="font-weight: 700;">${bullet}</strong>${parseInlineFormatting(content)}</p>`;
    } else if (line.trim() === '') {
      htmlContent += '<br>';
    } else {
      // Regular content line
      htmlContent += `<p style="margin: 2px 0; font-weight: 400; font-size: 12px; color: #000000; line-height: 1.4;">${parseInlineFormatting(line)}</p>`;
    }
    
    i++;
  }

  return htmlContent;
};