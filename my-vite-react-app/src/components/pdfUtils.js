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
 */
export const generatePdfFromText = async (textContent, fileName = "document.pdf", location = "", options = {}) => {
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
    console.log("PDF Generation - Extracted location from content:", finalLocation);
  }

  console.log("PDF Generation - Final location parameter:", finalLocation);
  console.log("PDF Generation - Text content length:", finalContent.length);

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
    min-height: 1123px;
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
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: ${fontFamily};
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    margin-bottom: 40px;
  ">${finalContent}</div>`;
  
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
    console.log("Container added to DOM, content length:", container.innerHTML.length);

    // Generate canvas from HTML
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 794,
      height: 1123
    });

    console.log("Canvas generated, size:", canvas.width, "x", canvas.height);

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
    let heightLeft = imgHeight;

    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
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

