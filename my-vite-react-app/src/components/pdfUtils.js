import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Extracts location data from transcript content if it was embedded as a header
 * @param {string} textContent - The transcript content
 * @returns {object} - { location: string, cleanedContent: string }
 */
export const extractLocationFromContent = (textContent) => {
  if (!textContent || typeof textContent !== 'string') {
    return { location: '', cleanedContent: textContent || '' };
  }

  // Look for embedded location header pattern
  const locationHeaderRegex = /^CLINIC LOCATION:\n(.*?)\n\n---\n\n/s;
  const match = textContent.match(locationHeaderRegex);
  
  if (match) {
    return {
      location: match[1].trim(),
      cleanedContent: textContent.replace(locationHeaderRegex, '').trim()
    };
  }
  
  return { location: '', cleanedContent: textContent };
};

/**
 * Parses medical transcript content into structured sections
 * @param {string} content - The medical transcript content
 * @returns {object} - Parsed sections with headers and content
 */
export const parseTranscriptSections = (content) => {
  if (!content || typeof content !== 'string') {
    return { sections: [], unstructuredContent: '' };
  }

  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;
  let unstructuredLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if line looks like a medical section header
    const sectionHeaderPatterns = [
      /^(CHIEF COMPLAINT|CC):\s*$/i,
      /^(HISTORY OF PRESENT ILLNESS|HPI):\s*$/i,
      /^(REVIEW OF SYSTEMS|ROS):\s*$/i,
      /^(PAST MEDICAL HISTORY|PMH):\s*$/i,
      /^(MEDICATIONS):\s*$/i,
      /^(ALLERGIES):\s*$/i,
      /^(SOCIAL HISTORY|SH):\s*$/i,
      /^(FAMILY HISTORY|FH):\s*$/i,
      /^(PHYSICAL EXAMINATION|EXAM):\s*$/i,
      /^(ASSESSMENT|IMPRESSION):\s*$/i,
      /^(PLAN|TREATMENT PLAN):\s*$/i,
      /^(PATIENT INFORMATION|PATIENT DETAILS):\s*$/i,
      /^(DATE OF BIRTH|DOB):\s*$/i,
      /^(DATE OF ACCIDENT):\s*$/i,
      /^(DATE OF CONSULTATION):\s*$/i,
      /^[A-Z\s]+:\s*$/
    ];

    const isHeader = sectionHeaderPatterns.some(pattern => pattern.test(line));
    
    if (isHeader) {
      // Save previous section if exists
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // Start new section
      currentSection = {
        header: line.replace(':', '').trim(),
        content: []
      };
    } else if (currentSection) {
      // Add to current section
      if (line) {
        currentSection.content.push(line);
      }
    } else {
      // Add to unstructured content
      if (line) {
        unstructuredLines.push(line);
      }
    }
  }

  // Add last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return {
    sections,
    unstructuredContent: unstructuredLines.join('\n')
  };
};

/**
 * Creates a professional medical document HTML template
 * @param {string} content - The medical transcript content
 * @param {object} metadata - Document metadata (location, doctor info, etc.)
 * @param {object} options - Styling options
 * @returns {string} - HTML template for PDF generation
 */
export const createMedicalDocumentTemplate = (content, metadata = {}, options = {}) => {
  const {
    location = '',
    doctorName = '',
    doctorSignature = '',
    isSigned = false,
    patientName = '',
    dateOfBirth = '',
    dateOfAccident = '',
    dateOfConsultation = '',
    phoneNumber = ''
  } = metadata;

  const {
    fontSize = 11,
    headerFontSize = 14,
    lineHeight = 1.4,
    marginTop = 20,
    marginBottom = 20,
    marginLeft = 25,
    marginRight = 25
  } = options;

  // Parse the content into sections
  const { sections, unstructuredContent } = parseTranscriptSections(content);

  // Header section
  let headerHTML = '';
  if (location) {
    headerHTML = `
      <div style="
        text-align: center;
        padding-bottom: 15px;
        margin-bottom: 20px;
        border-bottom: 2px solid #2c3e50;
        font-size: ${headerFontSize}px;
        font-weight: bold;
        color: #2c3e50;
        line-height: 1.3;
      ">
        ${location.split('\n').join('<br>')}
      </div>
    `;
  }

  // Patient information header (if available)
  let patientInfoHTML = '';
  if (patientName || dateOfBirth || phoneNumber) {
    patientInfoHTML = `
      <div style="
        background: #f8f9fa;
        padding: 15px;
        margin-bottom: 20px;
        border-left: 4px solid #3498db;
        border-radius: 0 5px 5px 0;
      ">
        <h3 style="
          margin: 0 0 10px 0;
          color: #2c3e50;
          font-size: ${fontSize + 2}px;
          font-weight: 600;
        ">PATIENT INFORMATION</h3>
        ${patientName ? `<p style="margin: 5px 0;"><strong>Name:</strong> ${patientName}</p>` : ''}
        ${dateOfBirth ? `<p style="margin: 5px 0;"><strong>Date of Birth:</strong> ${dateOfBirth}</p>` : ''}
        ${dateOfAccident ? `<p style="margin: 5px 0;"><strong>Date of Accident:</strong> ${dateOfAccident}</p>` : ''}
        ${dateOfConsultation ? `<p style="margin: 5px 0;"><strong>Date of Consultation:</strong> ${dateOfConsultation}</p>` : ''}
        ${phoneNumber ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${phoneNumber}</p>` : ''}
      </div>
    `;
  }

  // Generate sections HTML
  let sectionsHTML = '';
  sections.forEach((section, index) => {
    const sectionContent = section.content.join('\n').trim();
    if (sectionContent) {
      sectionsHTML += `
        <div style="margin-bottom: 25px;">
          <h3 style="
            color: #2c3e50;
            font-size: ${fontSize + 1}px;
            font-weight: 600;
            margin: 0 0 10px 0;
            padding-bottom: 5px;
            border-bottom: 1px solid #bdc3c7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">${section.header}</h3>
          <div style="
            padding-left: 10px;
            line-height: ${lineHeight};
            color: #34495e;
          ">
            ${formatSectionContent(sectionContent)}
          </div>
        </div>
      `;
    }
  });

  // Add unstructured content if any
  if (unstructuredContent.trim()) {
    sectionsHTML += `
      <div style="margin-bottom: 25px;">
        <h3 style="
          color: #2c3e50;
          font-size: ${fontSize + 1}px;
          font-weight: 600;
          margin: 0 0 10px 0;
          padding-bottom: 5px;
          border-bottom: 1px solid #bdc3c7;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        ">ADDITIONAL NOTES</h3>
        <div style="
          padding-left: 10px;
          line-height: ${lineHeight};
          color: #34495e;
        ">
          ${formatSectionContent(unstructuredContent)}
        </div>
      </div>
    `;
  }

  // Signature section
  let signatureHTML = '';
  if (isSigned && doctorName) {
    signatureHTML = `
      <div style="
        margin-top: 40px;
        padding-top: 20px;
        border-top: 2px solid #bdc3c7;
      ">
        ${doctorSignature ? `
          <div style="margin-bottom: 15px;">
            <img src="${doctorSignature}" alt="Doctor's signature" style="
              max-width: 200px;
              max-height: 80px;
              display: block;
            " />
          </div>
        ` : ''}
        <div style="
          font-weight: 600;
          font-size: ${fontSize}px;
          margin-bottom: 5px;
          color: #2c3e50;
        ">${doctorName}</div>
        <div style="
          font-size: ${fontSize - 1}px;
          color: #7f8c8d;
          font-style: italic;
        ">Electronically signed on ${new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          margin: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: ${fontSize}px;
          line-height: ${lineHeight};
          color: #2c3e50;
          margin: 0;
          padding: 0;
          background: white;
        }
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        ul, ol {
          padding-left: 20px;
        }
        li {
          margin-bottom: 5px;
        }
        .page-break {
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      ${headerHTML}
      ${patientInfoHTML}
      ${sectionsHTML}
      ${signatureHTML}
    </body>
    </html>
  `;
};

/**
 * Formats section content with proper medical formatting including tables
 * @param {string} content - Raw section content
 * @returns {string} - Formatted HTML content
 */
const formatSectionContent = (content) => {
  if (!content) return '';

  // Use the new formatted text to HTML converter
  return convertFormattedTextToHtml(content);
};

/**
 * Enhanced PDF generation with professional medical document formatting
 * @param {string} textContent - The text to include in the PDF
 * @param {string} fileName - The desired filename for the downloaded PDF
 * @param {string} location - Optional location string
 * @param {object} options - Configuration options
 */
export const generateProfessionalMedicalPdf = async (textContent, fileName = "medical-document.pdf", location = "", options = {}) => {
  if (!textContent || typeof textContent !== 'string') {
    console.error("PDF Generation: No text content provided or content is not a string.");
    alert("Cannot generate PDF: No text content available.");
    return;
  }

  // Extract location from content if no location parameter provided
  let finalLocation = location;
  let finalContent = textContent;
  
  if (!location || location.trim() === '') {
    const extracted = extractLocationFromContent(textContent);
    finalLocation = extracted.location;
    finalContent = extracted.cleanedContent;
  }

  const {
    doctorName = "",
    doctorSignature = "",
    isSigned = false,
    patientName = "",
    dateOfBirth = "",
    dateOfAccident = "",
    dateOfConsultation = "",
    phoneNumber = "",
    ...styleOptions
  } = options;

  const metadata = {
    location: finalLocation,
    doctorName,
    doctorSignature,
    isSigned,
    patientName,
    dateOfBirth,
    dateOfAccident,
    dateOfConsultation,
    phoneNumber
  };

  try {
    // Create HTML template
    const htmlTemplate = createMedicalDocumentTemplate(finalContent, metadata, styleOptions);
    
    // Create temporary container
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      top: -9999px;
      left: -9999px;
      width: 794px;
      background: white;
      padding: 20px;
      box-sizing: border-box;
    `;
    container.innerHTML = htmlTemplate;
    document.body.appendChild(container);

    // Wait for content to render and get actual height
    await new Promise(resolve => setTimeout(resolve, 100));
    const actualHeight = Math.max(container.scrollHeight, container.offsetHeight, 1123);

    console.log("Generating professional medical PDF...", { actualHeight });

    // Generate canvas from HTML with proper height
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 794,
      height: actualHeight
    });

    // Create PDF with proper dimensions
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgData = canvas.toDataURL('image/png', 0.95);
    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = 297; // A4 height in mm
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let yPosition = 0;

    // Add pages as needed
    while (yPosition < imgHeight) {
      if (yPosition > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        imgData,
        'PNG',
        0,
        -yPosition,
        imgWidth,
        imgHeight
      );

      yPosition += pdfHeight;
    }

    // Save the PDF
    pdf.save(fileName);
    console.log("Professional medical PDF saved successfully!");

  } catch (error) {
    console.error("Error generating professional medical PDF:", error);
    alert("An error occurred while generating the PDF. Please try again.");
  } finally {
    // Clean up
    const container = document.querySelector('div[style*="top: -9999px"]');
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
};

// Test function to verify PDF generation with location
export const testPdfGeneration = () => {
  const testContent = `3. Patient Presentation:
   - The patient is reporting left-sided radicular cervical spine pain.
   - The pain has not been alleviated by any medication.
   - Chiropractic treatment has also failed to provide relief.
4. Recommendation:
   - It is advised that the patient undergo a cervical epidural injection.`;
  
  const testLocation = "ABC Medical Center\n123 Main Street\nAnytown, ST 12345";
  
  console.log("Test function called - generating PDF...");
  generatePdfFromText(testContent, "test-pdf.pdf", testLocation, { lineHeight: 1.1 });
};

// Simple version for debugging
export const generateSimplePdf = (text) => {
  console.log("Simple PDF generation with text:", text.substring(0, 50));
  
  const element = document.createElement('div');
  element.innerHTML = text;
  element.style.cssText = `
    font-family: Arial, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    padding: 20px;
    width: 600px;
    background: white;
    color: black;
    position: absolute;
    top: -9999px;
    left: -9999px;
  `;
  
  document.body.appendChild(element);
  
  html2canvas(element, {
    scale: 1,
    backgroundColor: '#ffffff'
  }).then(canvas => {
    const pdf = new jsPDF();
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save('simple-test.pdf');
    
    document.body.removeChild(element);
    console.log("Simple PDF saved!");
  }).catch(err => {
    console.error("Simple PDF error:", err);
    document.body.removeChild(element);
  });
};

/**
 * Generates a PDF document from text content using html2canvas + jsPDF for reliable output.
 * @param {string} textContent - The text to include in the PDF.
 * @param {string} [fileName="document.pdf"] - The desired filename for the downloaded PDF.
 * @param {string} [location=""] - Optional location string to display at the top-left of the PDF.
 * @param {object} [options={}] - Optional configuration for PDF generation.
 * @param {number} [options.fontSize=12] - Font size for the text in pixels.
 * @param {number} [options.locationFontSize=10] - Font size for the location text in pixels.
 * @param {string} [options.fontFamily="Arial, sans-serif"] - Font family to use.
 * @param {number} [options.lineHeight=1.2] - Line height multiplier for spacing.
 * @param {object} [options.margins={ top: 15, right: 15, bottom: 15, left: 15 }] - Page margins in mm.
 * @param {string} [options.doctorName=""] - Doctor's name to display in signature section.
 * @param {string} [options.doctorSignature=""] - Base64 image data of doctor's signature.
 * @param {boolean} [options.isSigned=false] - Whether the document has been signed.
 * @param {boolean} [options.useProfessionalFormat=true] - Whether to use professional medical formatting.
 */
export const generatePdfFromText = async (textContent, fileName = "document.pdf", location = "", options = {}) => {
  // For medical transcripts, use the enhanced professional PDF generator by default
  if (options.useProfessionalFormat !== false) {
    return await generateProfessionalMedicalPdf(textContent, fileName, location, options);
  }

  if (!textContent || typeof textContent !== 'string') {
    console.error("PDF Generation: No text content provided or content is not a string.");
    alert("Cannot generate PDF: No text content available.");
    return;
  }

  // Extract location from content if no location parameter provided
  let finalLocation = location;
  let finalContent = textContent;
  
  if (!location || location.trim() === '') {
    const extracted = extractLocationFromContent(textContent);
    finalLocation = extracted.location;
    finalContent = extracted.cleanedContent;
  }

  const {
    fontSize = 12,
    locationFontSize = 10,
    fontFamily = "Arial, sans-serif",
    lineHeight = 1.2,
    margins = { top: 15, right: 15, bottom: 15, left: 15 },
    doctorName = "",
    doctorSignature = "",
    isSigned = false
  } = options;

  // Create a styled container element
  const container = document.createElement('div');
  container.style.cssText = `
    font-family: ${fontFamily};
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    color: black;
    background: white;
    padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
    width: 794px;
    box-sizing: border-box;
    position: absolute;
    top: -9999px;
    left: -9999px;
  `;
  
  let content = '';
  
  // Add location if available
  if (finalLocation && finalLocation.trim()) {
    content += `<div style="
      font-size: ${locationFontSize}px;
      font-weight: normal;
      margin-bottom: 8px;
      white-space: pre-line;
      line-height: 1.3;
    ">${finalLocation.trim()}</div>`;
  }
  
  // Add main content (cleaned of location header if it was extracted)
  content += `<div style="
    word-wrap: break-word;
    font-family: ${fontFamily};
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    margin-bottom: 40px;
  ">${convertFormattedTextToHtml(finalContent)}</div>`;
  
  // Add signature section if signed
  if (isSigned && doctorName) {
    content += `<div style="
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ccc;
      font-size: ${fontSize}px;
    ">`;
    
    if (doctorSignature) {
      content += `<div style="margin-bottom: 10px;">
        <img src="${doctorSignature}" alt="Doctor's signature" style="
          max-width: 200px;
          max-height: 80px;
          display: block;
        " />
      </div>`;
    }
    
    content += `<div style="
      font-weight: bold;
      font-size: ${fontSize}px;
      margin-bottom: 5px;
    ">${doctorName}</div>`;
    
    content += `<div style="
      font-size: ${fontSize - 1}px;
      color: #666;
    ">Electronically signed on ${new Date().toLocaleDateString()}</div>`;
    
    content += `</div>`;
  }
  
  container.innerHTML = content;
  document.body.appendChild(container);

  try {
    console.log("Generating PDF with html2canvas + jsPDF...");

    // Wait for content to render and get actual height
    await new Promise(resolve => setTimeout(resolve, 100));
    const actualHeight = Math.max(container.scrollHeight, container.offsetHeight, 1123);

    console.log("Container dimensions:", { 
      scrollHeight: container.scrollHeight, 
      offsetHeight: container.offsetHeight, 
      actualHeight 
    });

    // Generate canvas from HTML with proper height
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 794,
      height: actualHeight
    });

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    console.log("PDF dimensions:", { imgWidth, imgHeight, pageHeight });

    let yPosition = 0;

    // Add pages as needed
    while (yPosition < imgHeight) {
      if (yPosition > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        imgData,
        'PNG',
        0,
        -yPosition,
        imgWidth,
        imgHeight
      );

      yPosition += pageHeight;
    }

    // Save the PDF
    pdf.save(fileName);
    console.log("PDF saved successfully!");

  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("An error occurred while generating the PDF. Please try again.");
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
};

/**
 * Converts formatted medical text to HTML with tables and styling for PDF generation
 * @param {string} content - The medical transcript content with markdown formatting
 * @returns {string} - HTML formatted content with tables and styling
 */
export const convertFormattedTextToHtml = (content) => {
  if (!content) return '';

  const lines = content.split('\n');
  let htmlContent = '';
  let i = 0;

  // Function to detect if a group of lines forms a table
  const detectTable = (startIndex) => {
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

  // Function to parse table lines into HTML
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
    
    let tableHtml = `
      <table style="
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
        font-family: monospace;
        font-size: 10px;
        border: 1px solid #ddd;
      ">
    `;
    
    // Add header if exists
    if (headerRow) {
      tableHtml += '<thead><tr>';
      headerRow.forEach(cell => {
        tableHtml += `
          <th style="
            border: 1px solid #ddd;
            padding: 8px 6px;
            background-color: #f5f5f5;
            font-weight: bold;
            text-align: left;
            font-size: 9px;
          ">${cell}</th>
        `;
      });
      tableHtml += '</tr></thead>';
    }
    
    // Add body rows
    tableHtml += '<tbody>';
    rows.forEach(row => {
      tableHtml += '<tr>';
      row.forEach(cell => {
        tableHtml += `
          <td style="
            border: 1px solid #ddd;
            padding: 6px;
            font-size: 9px;
            vertical-align: top;
          ">${cell}</td>
        `;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    
    return tableHtml;
  };

  // Function to parse inline markdown formatting
  const parseInlineFormatting = (text) => {
    // Convert **text** to <strong>text</strong>
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  while (i < lines.length) {
    const line = lines[i];
    
    // Check for table at current position
    const tableResult = detectTable(i);
    if (tableResult) {
      htmlContent += parseTableToHtml(tableResult.lines);
      i = tableResult.endIndex + 1;
      continue;
    }

    // Regular line processing
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
      htmlContent += `<p style="margin: 15px 0 8px 0;"><strong>${header}</strong>`;
      if (content) {
        htmlContent += ` ${parseInlineFormatting(content)}`;
      }
      htmlContent += '</p>';
    } else if (numberedMatch) {
      const [, indent, number, content] = numberedMatch;
      const marginLeft = indent ? indent.length * 10 : 0;
      htmlContent += `<p style="margin: 5px 0 5px ${marginLeft}px;"><strong>${number}</strong>${parseInlineFormatting(content)}</p>`;
    } else if (bulletMatch) {
      const [, indent, bullet, content] = bulletMatch;
      const marginLeft = indent ? indent.length * 10 : 0;
      htmlContent += `<p style="margin: 5px 0 5px ${marginLeft}px;"><strong>${bullet}</strong>${parseInlineFormatting(content)}</p>`;
    } else if (line.trim() === '') {
      htmlContent += '<br>';
    } else {
      // Regular content line
      htmlContent += `<p style="margin: 5px 0;">${parseInlineFormatting(line)}</p>`;
    }
    
    i++;
  }

  return htmlContent;
};

