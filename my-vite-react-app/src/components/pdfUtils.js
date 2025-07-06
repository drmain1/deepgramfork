import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { convertFormattedTextToHtml } from './pdfTableUtils';

/**
 * Converts structured content to formatted string
 * @param {object} structuredContent - Structured content with visits array
 * @returns {string} - Formatted text content
 */
const convertStructuredToString = (structuredContent) => {
  let result = '';
  
  for (let i = 0; i < structuredContent.visits.length; i++) {
    const item = structuredContent.visits[i];
    
    if (item.type === 'section-header') {
      // Add section headers with proper spacing
      result += `\n\n${'─'.repeat(80)}\n\n${item.content}\n\n`;
    } else if (item.type === 'visit') {
      // Add location header if needed
      if (item.showLocationHeader && item.location) {
        result += `CLINIC LOCATION:\n${item.location.trim()}\n\n---\n\n`;
      }
      
      // Add visit date header
      if (item.date) {
        let dateHeader = item.date;
        if (item.visitType === 'initial') {
          dateHeader += ' - Initial Examination';
        } else if (item.visitType === 'follow-up' && item.visitNumber) {
          dateHeader += ` - Visit #${item.visitNumber}`;
        }
        result += `${dateHeader}\n\n`;
      }
      
      // Add the actual content
      result += item.content;
      
      // Add spacing between visits
      if (i < structuredContent.visits.length - 1) {
        result += '\n\n';
      }
    }
  }
  
  return result;
};

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
 * @param {string|object} textContent - The medical document content (string or structured object)
 * @param {string} fileName - Output filename
 * @param {string} location - Practice location/header
 * @param {object} options - Configuration options
 */
export const generatePagedMedicalPdf = async (textContent, fileName = "medical-document.pdf", location = "", options = {}) => {
  // Handle both string and structured content
  let processedContent = '';
  let isStructured = false;
  
  if (typeof textContent === 'object' && textContent.visits) {
    // Handle structured content
    isStructured = true;
    processedContent = convertStructuredToString(textContent);
  } else if (typeof textContent === 'string') {
    processedContent = textContent;
  } else {
    console.error("PDF Generation: Invalid content provided.");
    alert("Cannot generate PDF: Invalid content format.");
    return;
  }

  // Extract location from content if needed
  let finalLocation = location;
  let finalContent = processedContent;
  
  if (!location || location.trim() === '') {
    const extracted = extractLocationFromContent(finalContent);
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
    fontSize = 11,
    headerFontSize = 14,
    footerFontSize = 10,
    lineHeight = 1.4,
    backgroundColor = '#fcfcfa',
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
        font-family: 'Besley', Georgia, serif;
        font-weight: 400;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
        box-sizing: border-box;
        padding: ${topPadding}px 20px 20px ${leftPadding}px;
      `;

      let html = `
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Besley:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          * {
            font-family: 'Besley', Georgia, serif !important;
          }
        </style>
      `;

      // Header - only show location header on subsequent pages
      if (pageNum > 1 && includeHeaderOnAllPages) {
        html += `
          <div style="
            position: absolute;
            top: 15px;
            left: 20px;
            right: 20px;
            font-size: ${headerFontSize}px;
            color: #000000;
            font-weight: 600;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 12px;
            text-align: center;
            letter-spacing: -0.02em;
          ">
            ${finalLocation ? finalLocation.split('\n').filter(line => line.trim())[0] : ''}
          </div>
        `;
      }

      // Main content
      html += `
        <div style="
          margin-top: ${pageNum === 1 ? '5px' : includeHeaderOnAllPages ? '70px' : '20px'};
          margin-bottom: 10px;
          font-size: ${fontSize}px;
          line-height: ${lineHeight};
          color: #000000;
          font-weight: 400;
          letter-spacing: 0;
          text-align: left;
          min-height: auto;
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
            bottom: 10px;
            left: 20px;
            right: 20px;
            font-size: ${footerFontSize}px;
            color: #333333;
            text-align: center;
            border-top: 1px solid #e9ecef;
            padding-top: 5px;
            font-weight: 400;
            letter-spacing: 0.01em;
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

    // Parse content to identify sections and tables with improved detection
    const contentElements = [];
    const lines = finalContent.split('\n');
    let currentElement = { type: 'text', content: '' };
    let inTable = false;
    let tableHeaders = null;
    
    // Enhanced table detection patterns
    const tablePatterns = {
      // Pipe-delimited tables
      pipeTable: /\|/,
      // Space-aligned tables (e.g., "MUSCLE GROUP    RIGHT    LEFT")
      spaceTable: /^[A-Z\s]+\s{2,}[A-Z]+(\s{2,}[A-Z]+)*$/,
      // Tab-delimited tables
      tabTable: /\t/,
      // Tables with multiple spaces between columns
      multiSpaceTable: /\S+\s{2,}\S+/
    };
    
    // Identify content blocks with better table detection
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
      
      // Enhanced table header detection
      const looksLikeTableHeader = (
        tablePatterns.pipeTable.test(trimmedLine) ||
        tablePatterns.spaceTable.test(trimmedLine) ||
        (tablePatterns.multiSpaceTable.test(trimmedLine) && 
         trimmedLine.split(/\s{2,}/).every(part => part.length < 20)) // Short column names
      );
      
      const nextLineLooksLikeTable = (
        tablePatterns.pipeTable.test(nextLine) ||
        tablePatterns.multiSpaceTable.test(nextLine) ||
        /^[\s\-|]+$/.test(nextLine) // Separator line
      );
      
      if (!inTable && looksLikeTableHeader && (nextLineLooksLikeTable || i === lines.length - 1)) {
        // Save current text element if it has content
        if (currentElement.content.trim()) {
          contentElements.push(currentElement);
        }
        
        // Extract table headers for later use
        if (trimmedLine.includes('|')) {
          tableHeaders = trimmedLine.split('|').map(h => h.trim()).filter(h => h);
        } else if (trimmedLine.match(/\s{2,}/)) {
          tableHeaders = trimmedLine.split(/\s{2,}/).filter(h => h);
        }
        
        // Start new table element
        currentElement = { 
          type: 'table', 
          content: line + '\n',
          headers: tableHeaders
        };
        inTable = true;
      } else if (inTable) {
        // Check if we're still in the table
        const isTableRow = (
          trimmedLine === '' || // Empty lines can be within tables
          tablePatterns.pipeTable.test(trimmedLine) ||
          tablePatterns.multiSpaceTable.test(trimmedLine) ||
          /^[\s\-|]+$/.test(trimmedLine) // Separator lines
        );
        
        const isSectionHeader = /^[A-Z][A-Z\s]*:$/.test(trimmedLine);
        const isEndOfTable = (
          (trimmedLine === '' && !tablePatterns.multiSpaceTable.test(nextLine)) ||
          isSectionHeader ||
          (i > 0 && trimmedLine !== '' && !isTableRow)
        );
        
        if (!isEndOfTable) {
          currentElement.content += line + '\n';
        } else {
          // End of table - clean up empty lines at the end
          currentElement.content = currentElement.content.replace(/\n+$/, '\n');
          contentElements.push(currentElement);
          
          // Start new element with current line
          currentElement = { type: 'text', content: trimmedLine ? line + '\n' : '' };
          inTable = false;
          tableHeaders = null;
        }
      } else {
        // Regular text content
        currentElement.content += line + '\n';
        
        // Check for natural break points
        const isNaturalBreak = (
          (trimmedLine.endsWith(':') && /^[A-Z\s]+:$/.test(trimmedLine)) ||
          (trimmedLine === '' && currentElement.content.trim() && i < lines.length - 1)
        );
        
        if (isNaturalBreak) {
          contentElements.push(currentElement);
          currentElement = { type: 'text', content: '' };
        }
      }
    }
    
    // Don't forget the last element
    if (currentElement.content.trim()) {
      contentElements.push(currentElement);
    }
    
    // Now distribute elements across pages with improved table handling
    const contentPerPage = [];
    let currentPageElements = [];
    let currentPageHeight = 0;
    const maxPageHeight = 52; // Balanced for content and margins
    
    // Helper function to split tables intelligently
    const splitTable = (tableElement, availableHeight) => {
      const lines = tableElement.content.split('\n');
      const headers = tableElement.headers;
      let headerLines = [];
      let dataLines = [];
      let inHeaders = true;
      
      // Separate headers from data - improved detection
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // First pass - identify clear headers
        if (inHeaders) {
          if (line.includes('|') || line.match(/^[A-Z\s]+\s{2,}[A-Z]+/)) {
            headerLines.push(lines[i]);
            // Check if next line is a separator
            if (i < lines.length - 1 && /^[\s\-|]+$/.test(lines[i + 1].trim())) {
              headerLines.push(lines[i + 1]);
              i++;
            }
            inHeaders = false;
          } else if (/^[\s\-|]+$/.test(line)) {
            // Separator line without header - still part of header
            headerLines.push(lines[i]);
            inHeaders = false;
          } else {
            // Data starts here
            dataLines.push(lines[i]);
            inHeaders = false;
          }
        } else {
          dataLines.push(lines[i]);
        }
      }
      
      // Calculate how many data rows fit on current page
      const headerHeight = headerLines.length;
      const continuationNoteHeight = 2; // Space for "(Table continued...)" text
      const marginHeight = 1; // Extra margin
      const availableForData = Math.max(5, availableHeight - headerHeight - continuationNoteHeight - marginHeight);
      
      // Count actual non-empty data lines
      const nonEmptyDataLines = dataLines.filter(line => line.trim() !== '');
      
      if (nonEmptyDataLines.length <= availableForData) {
        // Table fits on current page
        return [tableElement.content, null];
      }
      
      // Need to split the table - use actual count of rows that fit
      const rowsToInclude = Math.min(availableForData, dataLines.length);
      const firstPartData = dataLines.slice(0, rowsToInclude);
      const remainingData = dataLines.slice(rowsToInclude);
      
      // Only add continuation note if there's actually remaining data
      const firstPartElements = [
        ...headerLines,
        ...firstPartData
      ];
      
      if (remainingData.length > 0 && remainingData.some(line => line.trim() !== '')) {
        firstPartElements.push(''); // Empty line
        firstPartElements.push('(Table continued on next page...)');
      }
      
      const firstPart = firstPartElements.join('\n');
      
      // Build continuation only if there's remaining data
      if (remainingData.length > 0 && remainingData.some(line => line.trim() !== '')) {
        const continuationPart = [
          '(Table continued from previous page)',
          '',
          ...headerLines,
          ...remainingData
        ].join('\n');
        
        return [firstPart, { 
          type: 'table', 
          content: continuationPart,
          headers: headers,
          isContinuation: true
        }];
      } else {
        return [firstPart, null];
      }
    };
    
    let elementIndex = 0;
    while (elementIndex < contentElements.length) {
      const element = contentElements[elementIndex];
      const elementLines = element.content.split('\n').filter(line => line !== undefined);
      const elementHeight = elementLines.length;
      
      // Special handling for tables
      if (element.type === 'table') {
        const remainingHeight = maxPageHeight - currentPageHeight;
        
        // If table is too tall for remaining space and we have content on page
        if (elementHeight > remainingHeight && currentPageElements.length > 0) {
          // Check if this is a small table that should stay together
          const tableLines = element.content.split('\n');
          const nonEmptyLines = tableLines.filter(line => line.trim() !== '');
          const isSmallTable = nonEmptyLines.length <= 10; // Small tables should stay together
          
          if (isSmallTable || remainingHeight < 10) {
            // Small table or not enough space - move entire table to next page
            contentPerPage.push(currentPageElements.map(el => el.content).join(''));
            currentPageElements = [element];
            currentPageHeight = elementHeight;
          } else {
            // Large table - try to split it
            const [firstPart, continuation] = splitTable(element, remainingHeight - 2); // Leave margin
            
            // Add first part to current page
            currentPageElements.push({ type: 'table', content: firstPart });
            contentPerPage.push(currentPageElements.map(el => el.content).join(''));
            
            // Start new page with continuation
            if (continuation) {
              currentPageElements = [continuation];
              currentPageHeight = continuation.content.split('\n').length;
            } else {
              currentPageElements = [];
              currentPageHeight = 0;
            }
          }
        } else if (elementHeight > maxPageHeight) {
          // Table is too large for any single page
          if (currentPageElements.length > 0) {
            contentPerPage.push(currentPageElements.map(el => el.content).join(''));
            currentPageElements = [];
            currentPageHeight = 0;
          }
          
          // Split large table across multiple pages
          let remainingTable = element;
          while (remainingTable && remainingTable.content.split('\n').length > maxPageHeight) {
            const [pagePart, continuation] = splitTable(remainingTable, maxPageHeight - 5);
            contentPerPage.push(pagePart);
            remainingTable = continuation;
          }
          
          // Add final part
          if (remainingTable) {
            currentPageElements = [remainingTable];
            currentPageHeight = remainingTable.content.split('\n').length;
          }
        } else {
          // Table fits in current page
          currentPageElements.push(element);
          currentPageHeight += elementHeight;
        }
      } else {
        // Regular text handling
        if (currentPageHeight + elementHeight > maxPageHeight && currentPageElements.length > 0) {
          // Start new page
          contentPerPage.push(currentPageElements.map(el => el.content).join(''));
          currentPageElements = [element];
          currentPageHeight = elementHeight;
        } else {
          currentPageElements.push(element);
          currentPageHeight += elementHeight;
        }
      }
      
      elementIndex++;
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

      // Wait for render and font loading
      await new Promise(resolve => setTimeout(resolve, 500));

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

