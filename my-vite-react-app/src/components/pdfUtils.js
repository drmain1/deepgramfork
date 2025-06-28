import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { convertFormattedTextToHtml } from './pdfTableUtils';


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
const parseTranscriptSections = (content) => {
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
      // Use consistent padding for all pages
      const topPadding = 20;
      const leftPadding = 20;
      
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
        padding: ${topPadding}px 20px 20px ${leftPadding}px;
      `;

      let html = '';

      // Header - only show location header on subsequent pages
      if (pageNum > 1 && includeHeaderOnAllPages) {
        html += `
          <div style="
            position: absolute;
            top: 15px;
            left: 20px;
            right: 20px;
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
            left: 20px;
            right: 20px;
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
  
  // Use the paged medical PDF generator for all documents (default behavior)
  return await generatePagedMedicalPdf(textContent, fileName, location, options);
};

/**
 * Generates a PDF and opens it in a new tab for preview instead of downloading
 */
const generatePdfPreview = async (textContent, fileName = "document.pdf", location = "", options = {}) => {
  // Simply pass through to the paged generator with previewMode enabled
  const pdfOptions = { ...options, previewMode: true };
  await generatePagedMedicalPdf(textContent, fileName, location, pdfOptions);
};

