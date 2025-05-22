import { jsPDF } from "jspdf";/**Generates a PDF document from a given text string and initiates download.
@param {string} textContent - The text to include in the PDF.
@param {string} fileName - The desired filename for the downloaded PDF (e.g., "polished-note.pdf").
@param {object} [options={}] - Optional configuration for PDF generation.
@param {number} [options.fontSize=12] - Font size for the text.
@param {number} [options.lineHeightFactor=1.0] - Line height factor (e.g., 1.5 for 1.5 line spacing).
@param {number} [options.pageMargins={ top: 20, right: 20, bottom: 20, left: 20 }] - Page margins in mm.
@param {number} [options.maxWidth=170] - Max width for text lines in mm (page width - left margin - right margin).
 */
export const generatePdfFromText = (textContent, fileName = "document.pdf", options = {}) => {
  if (!textContent || typeof textContent !== 'string') {
 console.error("PDF Generation: No text content provided or content is not a string.");
 // Optionally, throw an error or alert the user
 alert("Cannot generate PDF: No text content available.");
 return;
  }

  const doc = new jsPDF();  const {
    fontSize = 10, // Using a slightly smaller default font size for better fitting
    lineHeightFactor = 1.2, // Adjusted for better readability with smaller font
    pageMargins = { top: 20, right: 20, bottom: 20, left: 20 },
    // Standard A4 paper width is 210mm. Max width = 210 - leftMargin - rightMargin
    maxWidth = 210 - pageMargins.left - pageMargins.right 
  } = options;  doc.setFontSize(fontSize);
  const lineHeight = fontSize * lineHeightFactor;
  let cursorY = pageMargins.top;  // Split text into lines respecting the maxWidth
  const lines = doc.splitTextToSize(textContent, maxWidth);  lines.forEach(line => {
    if (cursorY + lineHeight > (doc.internal.pageSize.height - pageMargins.bottom)) {
      doc.addPage();
      cursorY = pageMargins.top; // Reset Y for new page
    }
    doc.text(line, pageMargins.left, cursorY);
    cursorY += lineHeight;
  });  try {
    doc.save(fileName);
  } catch (error) {
    console.error("Error saving PDF:", error);
    alert("An error occurred while trying to save the PDF.");
  }
};

