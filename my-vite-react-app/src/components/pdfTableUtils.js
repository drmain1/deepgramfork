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
  
  // Look for lines that contain | characters (potential table rows)
  while (currentIndex < lines.length) {
    const line = lines[currentIndex].trim();
    
    // Skip empty lines at the start
    if (line === '' && tableLines.length === 0) {
      currentIndex++;
      continue;
    }
    
    // If we hit an empty line after finding table content, end the table
    if (line === '' && tableLines.length > 0) {
      break;
    }
    
    // Check if line looks like a table row (contains |)
    if (line.includes('|')) {
      tableLines.push(line);
      currentIndex++;
    } else {
      // If we have table content and hit a non-table line, end the table
      if (tableLines.length > 0) {
        break;
      } else {
        // Not a table, return null
        return null;
      }
    }
  }
  
  // Need at least 2 lines to make a table (header + data or separator + data)
  if (tableLines.length < 2) {
    return null;
  }
  
  return {
    lines: tableLines,
    endIndex: currentIndex - 1
  };
};

/**
 * Parses table lines into HTML
 * @param {string[]} tableLines - Array of table row strings
 * @returns {string} - HTML table string
 */
const parseTableToHtml = (tableLines) => {
  let headerRow = null;
  const rows = [];
  
  tableLines.forEach((line, index) => {
    // Skip separator lines (lines with mostly dashes and |)
    if (/^[\s\-|]+$/.test(line)) {
      return;
    }
    
    // Split by | and clean up cells
    const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
    
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
      htmlContent += parseTableToHtml(tableResult.lines);
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
    
    // Check for visit headers (e.g., "June 2, 2025 - Visit #2")
    // Only match if it's exactly in this format with the dash and Visit #
    const visitHeaderPattern = /^([A-Za-z]+ \d{1,2}, \d{4})\s*-\s*(Visit #\d+)$/;
    const visitMatch = line.match(visitHeaderPattern);
    if (visitMatch) {
      const [, date, visitNum] = visitMatch;
      htmlContent += `<p style="margin: 10px 0 5px 0; font-weight: 700; font-size: 16px; color: #000; letter-spacing: -0.02em;">${date} - ${visitNum}</p>`;
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