import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';


/**
 * Extracts location data from transcript content if it was embedded as a header
 * @param {string} textContent - The transcript content
 * @returns {object} - { location: string, cleanedContent: string }
 */
const extractLocationFromContent = (textContent) => {
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
    phoneNumber = '',
    clinicLogo = '',
    includeLogoOnPdf = false
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

  // Header section with logo on left and location on right using table layout
  let headerHTML = '';
  if ((includeLogoOnPdf && clinicLogo) || location) {
    headerHTML += `
      <table style="
        width: 100%;
        margin-bottom: 20px;
        border-collapse: collapse;
        margin-top: -10px;
      ">
        <tr>
          <td style="
            width: 50%;
            vertical-align: top;
            padding: 0;
            padding-left: 0;
          ">
    `;
    
    // Logo on the left
    if (includeLogoOnPdf && clinicLogo) {
      headerHTML += `
        <img src="${clinicLogo}" alt="Clinic Logo" style="
          max-width: 180px;
          max-height: 180px;
          object-fit: contain;
          display: block;
        " />
      `;
    }
    
    headerHTML += `
          </td>
          <td style="
            width: 50%;
            vertical-align: top;
            text-align: right;
            padding: 0;
          ">
    `;
    
    // Location on the right - Professional formatting
    if (location) {
      const locationLines = location.split('\n').filter(line => line.trim());
      headerHTML += `
        <div style="
          text-align: right;
          color: #000;
          line-height: 1.4;
        ">
      `;
      
      locationLines.forEach((line, index) => {
        if (index === 0) {
          // Office name - bold and larger
          headerHTML += `
            <div style="
              font-size: ${headerFontSize}px;
              font-weight: bold;
              margin-bottom: 4px;
            ">${line.trim()}</div>
          `;
        } else {
          // Address lines - normal weight
          headerHTML += `
            <div style="
              font-size: ${headerFontSize - 2}px;
              font-weight: normal;
            ">${line.trim()}</div>
          `;
        }
      });
      
      headerHTML += `</div>`;
    }
    
    headerHTML += `
          </td>
        </tr>
      </table>
      <div style="
        border-bottom: 2px solid #2c3e50;
        margin-bottom: 20px;
      "></div>
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
    clinicLogo = "",
    includeLogoOnPdf = false,
    previewMode = false,
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
    phoneNumber,
    clinicLogo,
    includeLogoOnPdf
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
      padding: 40px 40px 40px 40px;
      box-sizing: border-box;
    `;
    container.innerHTML = htmlTemplate;
    document.body.appendChild(container);

    // Wait for content to render and get actual height
    await new Promise(resolve => setTimeout(resolve, 100));
    const actualHeight = Math.max(container.scrollHeight, container.offsetHeight, 1123);

    console.log("Generating professional medical PDF...", { actualHeight });

    // Generate canvas from HTML with reduced quality for smaller file size
    const canvas = await html2canvas(container, {
      scale: 1, // Reduced from 2 to 1 (50% reduction)
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

    const imgData = canvas.toDataURL('image/jpeg', 0.6); // Changed to JPEG with 60% quality
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
        'JPEG',
        0,
        -yPosition,
        imgWidth,
        imgHeight
      );

      yPosition += pdfHeight;
    }

    // Save or preview PDF
    if (previewMode) {
      // Generate blob and open in new tab
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const newTab = window.open(pdfUrl, '_blank');
      
      // Clean up the object URL after the tab loads
      if (newTab) {
        newTab.addEventListener('load', () => {
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
        });
      } else {
        // If popup was blocked, clean up after a delay
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);
      }
      console.log("Professional medical PDF opened in preview!");
    } else {
      // Download the PDF
      pdf.save(fileName);
      console.log("Professional medical PDF saved successfully!");
    }

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

/**
 * Generates professional medical PDF with page-by-page rendering
 * @param {string} textContent - The medical document content
 * @param {string} fileName - Output filename
 * @param {string} location - Practice location/header
 * @param {object} options - Configuration options
 */
export const generatePagedMedicalPdf = async (textContent, fileName = "medical-document.pdf", location = "", options = {}) => {
  if (!textContent || typeof textContent !== 'string') {
    console.error("PDF Generation: No text content provided or content is not a string.");
    alert("Cannot generate PDF: No text content available.");
    return;
  }

  // Extract location from content if needed
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
    clinicLogo = "",
    includeLogoOnPdf = false,
    fontSize = 12,
    headerFontSize = 11,
    footerFontSize = 10,
    lineHeight = 1.2,
    backgroundColor = '#faf9f5',
    includePageNumbers = true,
    includeHeaderOnAllPages = true,
    previewMode = false
  } = options;

  try {
    // Parse content into sections
    const { sections, unstructuredContent } = parseTranscriptSections(finalContent);
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margins = { top: 20, right: 20, bottom: 20, left: 20 };
    const contentWidth = pageWidth - margins.left - margins.right;
    const contentHeight = pageHeight - margins.top - margins.bottom;
    
    let currentPage = 1;
    let totalPages = 1; // Will update after calculating
    
    // Function to create page container with headers/footers
    const createPageContainer = (pageContent, pageNum, totalPageCount) => {
      const container = document.createElement('div');
      // Use minimal padding for first page to allow logo to be close to corner
      const topPadding = pageNum === 1 ? 20 : margins.top * 3.77;
      const leftPadding = pageNum === 1 ? 20 : margins.left * 3.77;
      
      container.style.cssText = `
        width: 794px;
        height: 1123px;
        background: ${backgroundColor};
        position: absolute;
        top: -9999px;
        left: -9999px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        font-weight: 400;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        box-sizing: border-box;
        padding: ${topPadding}px ${margins.right * 3.77}px ${margins.bottom * 3.77}px ${leftPadding}px;
      `;

      let html = '';

      // Header - only show location header on subsequent pages
      if (pageNum > 1 && includeHeaderOnAllPages) {
        html += `
          <div style="
            position: absolute;
            top: 15px;
            left: ${margins.left * 3.77}px;
            right: ${margins.right * 3.77}px;
            font-size: ${headerFontSize}px;
            color: #000;
            font-weight: 700;
            border-bottom: 2px solid #333;
            padding-bottom: 8px;
            text-align: center;
          ">
            ${finalLocation ? finalLocation.split('\n').filter(line => line.trim())[0] : ''}
          </div>
        `;
      }

      // Main content
      html += `
        <div style="
          margin-top: ${pageNum === 1 ? '5px' : includeHeaderOnAllPages ? '70px' : '20px'};
          margin-bottom: 30px;
          font-size: ${fontSize}px;
          line-height: ${lineHeight};
          color: #1a1a1a;
          font-weight: 400;
          letter-spacing: 0;
          text-align: left;
          min-height: calc(100vh - 150px);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        ">
          ${pageContent}
        </div>
      `;

      // Footer with page numbers
      if (includePageNumbers) {
        html += `
          <div style="
            position: absolute;
            bottom: 15px;
            left: ${margins.left * 3.77}px;
            right: ${margins.right * 3.77}px;
            font-size: ${footerFontSize}px;
            color: #333;
            text-align: center;
            border-top: 1px solid #ddd;
            padding-top: 5px;
            font-weight: 500;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          ">
            Page ${pageNum} of ${totalPageCount}
            ${doctorName && pageNum === totalPageCount ? ` | ${doctorName}` : ''}
          </div>
        `;
      }

      container.innerHTML = html;
      return container;
    };

    // Parse content to identify sections and tables
    const contentElements = [];
    const lines = finalContent.split('\n');
    let currentElement = { type: 'text', content: '' };
    let inTable = false;
    let tableStartIndex = -1;
    
    // Identify content blocks (paragraphs, sections, tables)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Check if this line starts a table
      if (!inTable && trimmedLine.includes('|') && i < lines.length - 1 && lines[i + 1].trim().includes('|')) {
        // Save current text element if it has content
        if (currentElement.content.trim()) {
          contentElements.push(currentElement);
        }
        // Start new table element
        currentElement = { type: 'table', content: line + '\n' };
        inTable = true;
        tableStartIndex = i;
      } else if (inTable) {
        // Continue table if line contains |
        if (trimmedLine.includes('|') || trimmedLine === '') {
          currentElement.content += line + '\n';
        } else {
          // End of table
          contentElements.push(currentElement);
          currentElement = { type: 'text', content: line + '\n' };
          inTable = false;
        }
      } else {
        // Regular text content
        currentElement.content += line + '\n';
        
        // Check if this is a section header or natural break point
        if (trimmedLine.endsWith(':') && trimmedLine.match(/^[A-Z\s]+:$/) || 
            trimmedLine === '' && i < lines.length - 1) {
          // This might be a good break point
          if (currentElement.content.trim()) {
            contentElements.push(currentElement);
            currentElement = { type: 'text', content: '' };
          }
        }
      }
    }
    
    // Don't forget the last element
    if (currentElement.content.trim()) {
      contentElements.push(currentElement);
    }
    
    // Now distribute elements across pages
    const contentPerPage = [];
    let currentPageElements = [];
    let currentPageHeight = 0;
    const maxPageHeight = 38; // Approximate lines per page
    
    for (const element of contentElements) {
      const elementHeight = element.content.split('\n').length;
      
      // Never split tables across pages
      if (element.type === 'table') {
        if (currentPageHeight + elementHeight > maxPageHeight && currentPageElements.length > 0) {
          // Start new page for this table
          contentPerPage.push(currentPageElements.map(el => el.content).join(''));
          currentPageElements = [element];
          currentPageHeight = elementHeight;
        } else {
          // Add table to current page
          currentPageElements.push(element);
          currentPageHeight += elementHeight;
        }
      } else {
        // For text, we can be more flexible
        if (currentPageHeight + elementHeight > maxPageHeight) {
          // Check if we should start a new page
          if (currentPageElements.length > 0) {
            contentPerPage.push(currentPageElements.map(el => el.content).join(''));
            currentPageElements = [element];
            currentPageHeight = elementHeight;
          } else {
            // Single element too large, we'll have to split it (rare case)
            currentPageElements.push(element);
            currentPageHeight += elementHeight;
          }
        } else {
          currentPageElements.push(element);
          currentPageHeight += elementHeight;
        }
      }
    }
    
    // Add remaining content
    if (currentPageElements.length > 0) {
      contentPerPage.push(currentPageElements.map(el => el.content).join(''));
    }
    
    totalPages = contentPerPage.length;

    // Generate each page
    for (let pageIndex = 0; pageIndex < contentPerPage.length; pageIndex++) {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      // For first page, prepend clinic logo, location and patient info if not already in content
      let pageContent = contentPerPage[pageIndex];
      if (pageIndex === 0) {
        let headerContent = '';
        
        if (finalLocation && !pageContent.includes(finalLocation.split('\n')[0])) {
          // Build header info with special formatting marker
          headerContent += '[HEADER_START]\n';
          
          if (includeLogoOnPdf && clinicLogo) {
            headerContent += '[CLINIC_LOGO]\n';
          }
          
          headerContent += '[LOCATION_RIGHT]\n';
          const locationLines = finalLocation.split('\n').filter(line => line.trim());
          locationLines.forEach(line => {
            headerContent += `${line.trim()}\n`;
          });
          headerContent += '[/LOCATION_RIGHT]\n';
          headerContent += '[HEADER_END]\n\n';
          
          if (patientName || dateOfBirth || dateOfAccident || dateOfConsultation) {
            if (patientName) headerContent += `Patient Name: ${patientName}\n`;
            if (dateOfBirth) headerContent += `Date of Birth: ${dateOfBirth}\n`;
            if (dateOfAccident) headerContent += `Date of Accident: ${dateOfAccident}\n`;
            if (dateOfConsultation) headerContent += `Date of Treatment: ${dateOfConsultation}\n`;
            headerContent += '\n';
          }
        }
        
        if (headerContent) {
          pageContent = headerContent + '\n' + pageContent;
        }
      }

      // Create page container
      const pageContainer = createPageContainer(
        convertFormattedTextToHtml(pageContent, { clinicLogo }),
        pageIndex + 1,
        contentPerPage.length
      );
      
      document.body.appendChild(pageContainer);

      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate canvas for this page
      const canvas = await html2canvas(pageContainer, {
        scale: 2, // Balanced scale for quality vs file size
        useCORS: true,
        backgroundColor: backgroundColor,
        logging: false,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
        letterRendering: true
      });

      // Add to PDF with JPEG for smaller file size
      const imgData = canvas.toDataURL('image/jpeg', 0.92); // High quality JPEG
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);

      // Clean up
      document.body.removeChild(pageContainer);
    }

    // Save or preview PDF
    if (previewMode) {
      // Generate blob and open in new tab
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const newTab = window.open(pdfUrl, '_blank');
      
      // Clean up the object URL after the tab loads
      if (newTab) {
        newTab.addEventListener('load', () => {
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
        });
      } else {
        // If popup was blocked, clean up after a delay
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);
      }
      console.log("Professional paged medical PDF opened in preview!");
    } else {
      // Download the PDF
      pdf.save(fileName);
      console.log("Professional paged medical PDF saved successfully!");
    }

  } catch (error) {
    console.error("Error generating paged medical PDF:", error);
    alert("An error occurred while generating the PDF. Please try again.");
  }
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
  // Handle preview mode
  if (options.previewMode) {
    return await generatePdfPreview(textContent, fileName, location, options);
  }
  
  // Use the new paged medical PDF generator for professional documents (default behavior)
  if (options.usePagedFormat !== false) {
    return await generatePagedMedicalPdf(textContent, fileName, location, options);
  }
  
  // For medical transcripts, use the enhanced professional PDF generator
  if (options.useProfessionalFormat !== false) {
    return await generateProfessionalMedicalPdf(textContent, fileName, location, options);
  }
};

/**
 * Converts formatted medical text to HTML with tables and styling for PDF generation
 * @param {string} content - The medical transcript content with markdown formatting
 * @returns {string} - HTML formatted content with tables and styling
 */
const convertFormattedTextToHtml = (content, options = {}) => {
  if (!content) return '';

  const { clinicLogo = '' } = options;
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
        margin: 20px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        background: #faf9f5;
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
            border: 1px solid #d4d2cd;
            padding: 10px 12px;
            background-color: #f0ede6;
            font-weight: bold;
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
      const backgroundColor = rowIndex % 2 === 0 ? '#faf9f5' : '#f7f5f0';
      tableHtml += `<tr style="background-color: ${backgroundColor};">`;
      
      row.forEach((cell, cellIndex) => {
        // Clean cell content - remove ** formatting
        const cleanCell = cell.replace(/\*\*/g, '');
        // First column gets left alignment and bold, others center
        const textAlign = cellIndex === 0 ? 'left' : 'center';
        const fontWeight = cellIndex === 0 ? 'normal' : 'normal';
        
        tableHtml += `
          <td style="
            border: 1px solid #d4d2cd;
            padding: 8px 12px;
            font-size: 11px;
            font-weight: ${fontWeight};
            vertical-align: middle;
            text-align: ${textAlign};
            color: #1a1a1a;
            text-transform: ${cellIndex === 0 ? 'uppercase' : 'none'};
          ">${cleanCell}</td>
        `;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    
    return tableHtml;
  };

  // Function to parse inline markdown formatting
  const parseInlineFormatting = (text) => {
    // Convert **text** to <strong>text</strong> for bold
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Convert *text* to <em>text</em> for italic (but not if it's part of **)
    formatted = formatted.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>');
    return formatted;
  };

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
                locationHTML += `<div style="font-size: 14px; font-weight: bold; color: #000; margin-bottom: 2px;">${lines[i].trim()}</div>`;
              } else {
                // Address lines
                locationHTML += `<div style="font-size: 11px; color: #2c3e50;">${lines[i].trim()}</div>`;
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
        <div style="border-bottom: 2px solid #2c3e50; margin-bottom: 20px; margin-left: -10px; margin-right: -10px; margin-top: 10px;"></div>
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
      htmlContent += `<p style="margin: 12px 0 6px 0; font-weight: 900; font-size: 14px; color: #000; letter-spacing: -0.02em;"><strong style="font-weight: 900;">${header}</strong>`;
      if (content) {
        htmlContent += ` <span style="font-weight: 400; font-size: 13px;">${parseInlineFormatting(content)}</span>`;
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
      htmlContent += `<p style="margin: 4px 0; font-weight: 400; font-size: 13px; color: #1a1a1a; line-height: 1.5;">${parseInlineFormatting(line)}</p>`;
    }
    
    i++;
  }

  return htmlContent;
};

/**
 * Generates a PDF and opens it in a new tab for preview instead of downloading
 */
const generatePdfPreview = async (textContent, fileName = "document.pdf", location = "", options = {}) => {
  // Simply pass through to the appropriate generator with previewMode enabled
  const pdfOptions = { ...options, previewMode: true };
  
  // Generate the PDF using the paged format
  if (pdfOptions.usePagedFormat !== false) {
    await generatePagedMedicalPdf(textContent, fileName, location, pdfOptions);
  } else {
    await generateProfessionalMedicalPdf(textContent, fileName, location, pdfOptions);
  }
};

