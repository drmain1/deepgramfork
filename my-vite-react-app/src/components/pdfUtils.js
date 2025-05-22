import { jsPDF } from "jspdf";/**Generates a PDF document from a given text string and initiates download.
@param {string} textContent - The text to include in the PDF.
@param {string} fileName - The desired filename for the downloaded PDF (e.g., "polished-note.pdf").
@param {string} [location=""] - Optional location string to display at the top-left of the PDF.
@param {object} [options={}] - Optional configuration for PDF generation.
@param {number} [options.fontSize=12] - Font size for the text.
@param {number} [options.locationFontSize=8] - Font size for the location text.
@param {number} [options.lineHeightFactor=1.0] - Line height factor (e.g., 1.5 for 1.5 line spacing).
@param {number} [options.pageMargins={ top: 20, right: 20, bottom: 20, left: 20 }] - Page margins in mm.
@param {number} [options.maxWidth=170] - Max width for text lines in mm (page width - left margin - right margin).
*/
export const generatePdfFromText = (textContent, fileName = "document.pdf", location = "", options = {}) => {
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
    locationFontSize = 8, // Font size for the location text
    // Standard A4 paper width is 210mm. Max width = 210 - leftMargin - rightMargin
    maxWidth = 210 - pageMargins.left - pageMargins.right
  } = options;

  let cursorY = pageMargins.top;

  // Add location text if provided
  if (location && typeof location === 'string' && location.trim() !== "") {
    doc.setFontSize(locationFontSize);
    const locationLineHeight = locationFontSize * lineHeightFactor;
    // Ensure location text doesn't go off page if it's too long, split if necessary
    const locationLines = doc.splitTextToSize(location, maxWidth);
    locationLines.forEach(locLine => {
      if (cursorY + locationLineHeight > (doc.internal.pageSize.height - pageMargins.bottom)) {
        // This case is unlikely for a short location string at the top, but good for robustness
        doc.addPage();
        cursorY = pageMargins.top;
      }
      doc.text(locLine, pageMargins.left, cursorY);
      cursorY += locationLineHeight;
    });
    cursorY += locationLineHeight * 0.5; // Add a small gap after the location
  }

  doc.setFontSize(fontSize);
  const lineHeight = fontSize * lineHeightFactor;
  // Split text into lines respecting the maxWidth
  const lines = doc.splitTextToSize(textContent, maxWidth);  lines.forEach(line => {
    if (cursorY + lineHeight > (doc.internal.pageSize.height - pageMargins.bottom)) {
      doc.addPage();
      cursorY = pageMargins.top; // Reset Y for new page

      // Re-add location text on new page if provided
      if (location && typeof location === 'string' && location.trim() !== "") {
        doc.setFontSize(locationFontSize);
        const locationLineHeight = locationFontSize * lineHeightFactor;
        const locationLinesOnNewPage = doc.splitTextToSize(location, maxWidth);
        let tempCursorY = pageMargins.top; // Use a temporary cursor for location on new page
        locationLinesOnNewPage.forEach(locLine => {
          doc.text(locLine, pageMargins.left, tempCursorY);
          tempCursorY += locationLineHeight;
        });
        cursorY = tempCursorY + (locationLineHeight * 0.5); // Adjust main content cursor
        doc.setFontSize(fontSize); // Reset font size for main content
      }
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

