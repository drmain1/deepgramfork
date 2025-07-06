// Medical Invoice PDF Generator
// Requires: html2canvas and jsPDF libraries

class MedicalInvoicePDF {
  constructor() {
    // Check if required libraries are loaded
    if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
      throw new Error('Required libraries (html2canvas, jsPDF) are not loaded');
    }
  }

  // Generate PDF from JSON data
  async generatePDF(jsonData, filename = 'medical-invoice.pdf') {
    try {
      // Create the invoice HTML
      const invoiceHTML = this.createInvoiceHTML(jsonData);
      
      // Create temporary container
      const container = document.createElement('div');
      container.innerHTML = invoiceHTML;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px'; // A4 width in pixels at 96 DPI
      document.body.appendChild(container);

      // Generate canvas from HTML
      const canvas = await html2canvas(container.firstElementChild, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // Remove temporary container
      document.body.removeChild(container);

      // Create PDF
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add image to PDF
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Save the PDF
      pdf.save(filename);
      
      return true;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  // Create the invoice HTML structure
  createInvoiceHTML(data) {
    const totalAmount = data.services.reduce((sum, service) => sum + service.total, 0);
    const totalProcedures = data.services.reduce((sum, service) => sum + service.procedures.length, 0);

    return `
      <div style="
        width: 794px;
        background: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #111827;
      ">
        
        <!-- Invoice Header -->
        <div style="
          border-bottom: 2px solid #111827;
          padding: 32px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h1 style="
                font-size: 24px;
                font-weight: bold;
                color: #111827;
                margin: 0 0 8px 0;
              ">MEDICAL INVOICE</h1>
              <div style="font-size: 12px; color: #4B5563;">
                <p style="margin: 4px 0;"><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
                <p style="margin: 4px 0;"><strong>Invoice Date:</strong> ${new Date(data.invoiceDate).toLocaleDateString()}</p>
              </div>
            </div>
            <div style="text-align: right;">
              <h2 style="
                font-size: 18px;
                font-weight: bold;
                color: #111827;
                margin: 0 0 8px 0;
              ">${data.provider.name}</h2>
              <div style="font-size: 12px; color: #4B5563;">
                <p style="margin: 4px 0;">${data.provider.address}</p>
                <p style="margin: 4px 0;">${data.provider.city}</p>
                <p style="margin: 4px 0;">${data.provider.phone}</p>
                <p style="margin: 4px 0;"><strong>NPI:</strong> ${data.provider.npi}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Patient Information -->
        <div style="
          padding: 32px;
          border-bottom: 1px solid #D1D5DB;
        ">
          <h3 style="
            font-size: 16px;
            font-weight: 600;
            color: #111827;
            margin: 0 0 16px 0;
          ">PATIENT INFORMATION</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
            <div>
              <div style="margin-bottom: 8px;"><strong>Name:</strong> ${data.patient.name}</div>
              <div style="margin-bottom: 8px;"><strong>Date of Birth:</strong> ${data.patient.dob}</div>
              <div style="margin-bottom: 8px;"><strong>Patient ID:</strong> ${data.patient.patientId}</div>
            </div>
            <div>
              <div style="margin-bottom: 8px;"><strong>Address:</strong> ${data.patient.address}</div>
              <div style="margin-bottom: 8px;">${data.patient.city}</div>
            </div>
          </div>
        </div>

        <!-- Services -->
        <div style="padding: 32px;">
          <h3 style="
            font-size: 16px;
            font-weight: 600;
            color: #111827;
            margin: 0 0 24px 0;
          ">SERVICES RENDERED</h3>
          
          ${data.services.map((service, serviceIndex) => `
            <div style="margin-bottom: 32px;">
              
              <!-- Service Date Header -->
              <div style="
                background-color: #F9FAFB;
                padding: 12px 16px;
                border-left: 4px solid #2563EB;
                margin-bottom: 16px;
              ">
                <h4 style="
                  font-weight: 600;
                  color: #111827;
                  margin: 0;
                ">
                  Service Date: ${new Date(service.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h4>
              </div>

              <!-- Diagnoses -->
              <div style="margin-bottom: 24px;">
                <h5 style="
                  font-weight: 500;
                  color: #111827;
                  margin: 0 0 12px 0;
                ">Diagnoses (ICD-10):</h5>
                <table style="
                  width: 100%;
                  border: 1px solid #D1D5DB;
                  border-collapse: collapse;
                ">
                  <thead style="background-color: #F9FAFB;">
                    <tr>
                      <th style="
                        padding: 8px 16px;
                        text-align: left;
                        font-size: 12px;
                        font-weight: 500;
                        color: #111827;
                        border-bottom: 1px solid #D1D5DB;
                      ">Code</th>
                      <th style="
                        padding: 8px 16px;
                        text-align: left;
                        font-size: 12px;
                        font-weight: 500;
                        color: #111827;
                        border-bottom: 1px solid #D1D5DB;
                      ">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${service.diagnoses.map(diagnosis => `
                      <tr style="border-bottom: 1px solid #E5E7EB;">
                        <td style="
                          padding: 12px 16px;
                          font-size: 12px;
                          font-family: 'Courier New', monospace;
                          color: #111827;
                        ">${diagnosis.code}</td>
                        <td style="
                          padding: 12px 16px;
                          font-size: 12px;
                          color: #374151;
                        ">${diagnosis.description}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Procedures -->
              ${service.procedures.length > 0 ? `
                <div style="margin-bottom: 24px;">
                  <h5 style="
                    font-weight: 500;
                    color: #111827;
                    margin: 0 0 12px 0;
                  ">Procedures (CPT):</h5>
                  <table style="
                    width: 100%;
                    border: 1px solid #D1D5DB;
                    border-collapse: collapse;
                  ">
                    <thead style="background-color: #F9FAFB;">
                      <tr>
                        <th style="
                          padding: 8px 16px;
                          text-align: left;
                          font-size: 12px;
                          font-weight: 500;
                          color: #111827;
                          border-bottom: 1px solid #D1D5DB;
                        ">CPT Code</th>
                        <th style="
                          padding: 8px 16px;
                          text-align: left;
                          font-size: 12px;
                          font-weight: 500;
                          color: #111827;
                          border-bottom: 1px solid #D1D5DB;
                        ">Description</th>
                        <th style="
                          padding: 8px 16px;
                          text-align: center;
                          font-size: 12px;
                          font-weight: 500;
                          color: #111827;
                          border-bottom: 1px solid #D1D5DB;
                        ">Units</th>
                        <th style="
                          padding: 8px 16px;
                          text-align: right;
                          font-size: 12px;
                          font-weight: 500;
                          color: #111827;
                          border-bottom: 1px solid #D1D5DB;
                        ">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${service.procedures.map(procedure => `
                        <tr style="border-bottom: 1px solid #E5E7EB;">
                          <td style="
                            padding: 12px 16px;
                            font-size: 12px;
                            font-family: 'Courier New', monospace;
                            color: #111827;
                          ">${procedure.code}</td>
                          <td style="
                            padding: 12px 16px;
                            font-size: 12px;
                            color: #374151;
                          ">${procedure.description}</td>
                          <td style="
                            padding: 12px 16px;
                            font-size: 12px;
                            text-align: center;
                            color: #374151;
                          ">${procedure.units}</td>
                          <td style="
                            padding: 12px 16px;
                            font-size: 12px;
                            text-align: right;
                            font-weight: 500;
                            color: #111827;
                          ">$${procedure.fee.toFixed(2)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div style="margin-bottom: 24px;">
                  <h5 style="
                    font-weight: 500;
                    color: #111827;
                    margin: 0 0 12px 0;
                  ">Procedures (CPT):</h5>
                  <div style="
                    background-color: #F9FAFB;
                    border: 1px solid #D1D5DB;
                    padding: 16px 24px;
                    text-align: center;
                    font-size: 12px;
                    color: #6B7280;
                    font-style: italic;
                  ">
                    No billable procedures for this service date
                  </div>
                </div>
              `}

              <!-- Service Total -->
              <div style="
                text-align: right;
                border-top: 1px solid #D1D5DB;
                padding-top: 8px;
              ">
                <span style="
                  font-size: 12px;
                  font-weight: 500;
                  color: #111827;
                ">
                  Service Total: <span style="font-weight: bold;">$${service.total.toFixed(2)}</span>
                </span>
              </div>

              ${serviceIndex < data.services.length - 1 ? '<hr style="margin: 32px 0; border: none; border-top: 1px solid #D1D5DB;">' : ''}
            </div>
          `).join('')}
        </div>

        <!-- Invoice Summary -->
        <div style="
          border-top: 2px solid #111827;
          background-color: #F9FAFB;
          padding: 32px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 12px; color: #4B5563;">
              <p style="margin: 4px 0;"><strong>Total Service Dates:</strong> ${data.services.length}</p>
              <p style="margin: 4px 0;"><strong>Total Procedures:</strong> ${totalProcedures}</p>
            </div>
            <div style="text-align: right;">
              <div style="
                font-size: 20px;
                font-weight: bold;
                color: #111827;
              ">
                TOTAL AMOUNT DUE: $${totalAmount.toFixed(2)}
              </div>
              <div style="
                font-size: 12px;
                color: #4B5563;
                margin-top: 4px;
              ">
                Payment due within 30 days
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="
          background-color: #F3F4F6;
          padding: 24px;
          text-align: center;
          font-size: 10px;
          color: #6B7280;
        ">
          <p style="margin: 0;">Please retain this invoice for your records. For billing inquiries, contact our office at ${data.provider.phone}</p>
        </div>
      </div>
    `;
  }

  // Helper method to validate JSON data structure
  validateData(data) {
    const required = ['provider', 'patient', 'services', 'invoiceNumber', 'invoiceDate'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (!Array.isArray(data.services)) {
      throw new Error('Services must be an array');
    }

    return true;
  }
}

// Usage Example:
/*
// Sample JSON data structure
const sampleData = {
  provider: {
    name: "David Main DC",
    address: "123 Medical Center Drive",
    city: "Healthcare City, HC 12345",
    phone: "(555) 123-4567",
    npi: "1234567890"
  },
  patient: {
    name: "Anthony Rueda",
    dob: "1999-01-01",
    patientId: "t3TYkWkG2ooVfcwi8AcE",
    address: "456 Patient Street",
    city: "Patient City, PC 67890"
  },
  invoiceNumber: "INV-2025-001",
  invoiceDate: "2025-07-03",
  services: [
    {
      id: 1,
      date: "2025-03-31",
      diagnoses: [
        { code: "M99.01", description: "Segmental and somatic dysfunction of cervical region" },
        { code: "M99.02", description: "Segmental and somatic dysfunction of thoracic region" },
        { code: "M99.03", description: "Segmental and somatic dysfunction of lumbar region" }
      ],
      procedures: [
        { code: "98941", description: "Chiropractic Manipulative Treatment (3-4 regi)", fee: 75.00, units: 1 }
      ],
      total: 75.00
    }
  ]
};

// Generate PDF
const generator = new MedicalInvoicePDF();
generator.generatePDF(sampleData, 'invoice-001.pdf')
  .then(() => console.log('PDF generated successfully'))
  .catch(error => console.error('Error:', error));
*/

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MedicalInvoicePDF;
}