// Medical Billing Invoice PDF Generator
// Adapted from billingpdf.js for use in the billing module
// Uses html2canvas and jsPDF libraries

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

class MedicalBillingPDF {
  constructor() {
    // Libraries are imported at the top, no need to check
  }

  // Convert our billing data format to the expected format
  convertBillingData(billingLedger, patientInfo, doctorInfo, cptFees) {
    const invoiceData = {
      provider: {
        name: doctorInfo?.clinicName || doctorInfo?.doctorName || 'Healthcare Provider',
        address: '123 Medical Center Drive', // You can update this from doctorInfo if available
        city: 'Healthcare City, HC 12345', // You can update this from doctorInfo if available
        phone: '(555) 123-4567', // You can update this from doctorInfo if available
        npi: '1234567890' // You can update this from doctorInfo if available
      },
      patient: {
        name: `${patientInfo?.first_name || ''} ${patientInfo?.last_name || ''}`.trim() || 'Patient',
        dob: patientInfo?.date_of_birth || 'N/A',
        patientId: patientInfo?.id || 'N/A',
        address: patientInfo?.address || '',
        city: patientInfo?.city || ''
      },
      invoiceNumber: `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      services: []
    };

    // Convert each service date
    billingLedger.forEach(service => {
      const serviceData = {
        id: service.date_of_service,
        date: service.date_of_service,
        diagnoses: service.icd10_codes.map(icd => ({
          code: icd.code,
          description: icd.description
        })),
        procedures: service.cpt_codes.map(cptCode => {
          const fee = this.getCptFee(cptCode, cptFees);
          return {
            code: cptCode,
            description: this.getCptDescription(cptCode),
            fee: fee,
            units: 1
          };
        }),
        total: 0
      };
      
      // Calculate service total
      serviceData.total = serviceData.procedures.reduce((sum, proc) => sum + proc.fee, 0);
      invoiceData.services.push(serviceData);
    });

    return invoiceData;
  }

  // Get CPT fee with user-specific fees
  getCptFee(code, userCptFees) {
    if (userCptFees && userCptFees[code] !== undefined) {
      return parseFloat(userCptFees[code]);
    }
    return 0;
  }

  // Get CPT description
  getCptDescription(code) {
    const CPT_DESCRIPTIONS = {
      '98940': 'Chiropractic Manipulative Treatment (1-2 regions)',
      '98941': 'Chiropractic Manipulative Treatment (3-4 regions)',
      '98942': 'Chiropractic Manipulative Treatment (5 regions)',
      '97140': 'Manual Therapy Techniques',
      '97110': 'Therapeutic Exercise',
      '97124': 'Massage Therapy',
      '97035': 'Ultrasound Therapy',
      '97032': 'Electrical Stimulation (Attended)',
      '97010': 'Hot/Cold Pack Application',
      '97012': 'Mechanical Traction',
      '99202': 'New Patient Office Visit (15-29 min)',
      '99203': 'New Patient Office Visit (30-44 min)',
      '99204': 'New Patient Office Visit (45-59 min)',
      '99212': 'Established Patient Office Visit (10-19 min)',
      '99213': 'Established Patient Office Visit (20-29 min)',
      '99214': 'Established Patient Office Visit (30-39 min)'
    };
    return CPT_DESCRIPTIONS[code] || 'Medical Service';
  }

  // Generate PDF from billing data
  async generateBillingPDF(billingLedger, patientInfo, doctorInfo, options = {}) {
    try {
      // Convert data to expected format
      const invoiceData = this.convertBillingData(
        billingLedger, 
        patientInfo, 
        doctorInfo, 
        doctorInfo?.cptFees
      );

      // Update provider info to show doctor name as primary
      if (doctorInfo?.doctorName) {
        invoiceData.provider.name = doctorInfo.doctorName;
        invoiceData.provider.clinicName = doctorInfo.clinicName;
      }

      // Create the invoice HTML
      const invoiceHTML = this.createInvoiceHTML(invoiceData, doctorInfo);
      
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

      // Create PDF with proper page handling
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Generate filename
      const fileName = options.fileName || 
        `billing_${patientInfo?.last_name || 'patient'}_${patientInfo?.first_name || ''}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Save the PDF
      pdf.save(fileName);
      
      return true;
    } catch (error) {
      console.error('Error generating billing PDF:', error);
      throw error;
    }
  }

  // Create the invoice HTML structure
  createInvoiceHTML(data, doctorInfo) {
    const totalAmount = data.services.reduce((sum, service) => sum + service.total, 0);
    const totalProcedures = data.services.reduce((sum, service) => sum + service.procedures.length, 0);

    // Add logo if available
    const logoHtml = (doctorInfo?.includeLogoOnPdf && doctorInfo?.clinicLogo) ? 
      `<img src="${doctorInfo.clinicLogo}" alt="Clinic Logo" style="
        max-height: 60px;
        max-width: 150px;
        object-fit: contain;
        margin-bottom: 10px;
      ">` : '';

    return `
      <div style="
        width: 794px;
        background: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 12px;
        line-height: 1.3;
        color: #111827;
      ">
        
        <!-- Invoice Header -->
        <div style="
          border-bottom: 2px solid #111827;
          padding: 20px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              ${logoHtml}
              <h1 style="
                font-size: 20px;
                font-weight: bold;
                color: #111827;
                margin: 0 0 6px 0;
              ">MEDICAL INVOICE</h1>
              <div style="font-size: 11px; color: #4B5563;">
                <p style="margin: 2px 0;"><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
                <p style="margin: 2px 0;"><strong>Invoice Date:</strong> ${new Date(data.invoiceDate).toLocaleDateString()}</p>
              </div>
            </div>
            <div style="text-align: right;">
              <h2 style="
                font-size: 16px;
                font-weight: bold;
                color: #111827;
                margin: 0 0 6px 0;
              ">${data.provider.name}</h2>
              ${data.provider.clinicName ? `<p style="margin: 2px 0; font-size: 12px;">${data.provider.clinicName}</p>` : ''}
              <div style="font-size: 11px; color: #4B5563;">
                <p style="margin: 2px 0;">${data.provider.address}</p>
                <p style="margin: 2px 0;">${data.provider.city}</p>
                <p style="margin: 2px 0;">${data.provider.phone}</p>
                <p style="margin: 2px 0;"><strong>NPI:</strong> ${data.provider.npi}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Patient Information -->
        <div style="
          padding: 16px 20px;
          border-bottom: 1px solid #D1D5DB;
        ">
          <h3 style="
            font-size: 14px;
            font-weight: 600;
            color: #111827;
            margin: 0 0 10px 0;
          ">PATIENT INFORMATION</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px;">
            <div>
              <div style="margin-bottom: 4px;"><strong>Name:</strong> ${data.patient.name}</div>
              <div style="margin-bottom: 4px;"><strong>DOB:</strong> ${data.patient.dob}</div>
              <div style="margin-bottom: 4px;"><strong>Patient ID:</strong> ${data.patient.patientId}</div>
            </div>
            <div>
              ${data.patient.address ? `<div style="margin-bottom: 4px;"><strong>Address:</strong> ${data.patient.address}</div>` : ''}
              ${data.patient.city ? `<div style="margin-bottom: 4px;">${data.patient.city}</div>` : ''}
            </div>
          </div>
        </div>

        <!-- Services -->
        <div style="padding: 16px 20px;">
          <h3 style="
            font-size: 14px;
            font-weight: 600;
            color: #111827;
            margin: 0 0 12px 0;
          ">SERVICES RENDERED</h3>
          
          ${data.services.map((service, serviceIndex) => `
            <div style="margin-bottom: 16px;">
              
              <!-- Service Date Header -->
              <div style="
                background-color: #F9FAFB;
                padding: 6px 12px;
                border-left: 3px solid #2563EB;
                margin-bottom: 8px;
              ">
                <h4 style="
                  font-weight: 600;
                  color: #111827;
                  margin: 0;
                  font-size: 12px;
                ">
                  ${new Date(service.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </h4>
              </div>

              <!-- Combined Diagnoses and Procedures Table -->
              <table style="
                width: 100%;
                border: 1px solid #D1D5DB;
                border-collapse: collapse;
                margin-bottom: 6px;
              ">
                <thead style="background-color: #F9FAFB;">
                  <tr>
                    <th style="
                      padding: 4px 8px;
                      text-align: left;
                      font-size: 10px;
                      font-weight: 500;
                      color: #111827;
                      border-bottom: 1px solid #D1D5DB;
                      width: 15%;
                    ">Code</th>
                    <th style="
                      padding: 4px 8px;
                      text-align: left;
                      font-size: 10px;
                      font-weight: 500;
                      color: #111827;
                      border-bottom: 1px solid #D1D5DB;
                      width: 10%;
                    ">Type</th>
                    <th style="
                      padding: 4px 8px;
                      text-align: left;
                      font-size: 10px;
                      font-weight: 500;
                      color: #111827;
                      border-bottom: 1px solid #D1D5DB;
                      width: 60%;
                    ">Description</th>
                    <th style="
                      padding: 4px 8px;
                      text-align: center;
                      font-size: 10px;
                      font-weight: 500;
                      color: #111827;
                      border-bottom: 1px solid #D1D5DB;
                      width: 8%;
                    ">Units</th>
                    <th style="
                      padding: 4px 8px;
                      text-align: right;
                      font-size: 10px;
                      font-weight: 500;
                      color: #111827;
                      border-bottom: 1px solid #D1D5DB;
                      width: 7%;
                    ">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${service.diagnoses.map(diagnosis => `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                      <td style="
                        padding: 4px 8px;
                        font-size: 10px;
                        font-family: 'Courier New', monospace;
                        color: #111827;
                      ">${diagnosis.code}</td>
                      <td style="
                        padding: 4px 8px;
                        font-size: 9px;
                        color: #6B7280;
                        font-weight: 500;
                      ">ICD-10</td>
                      <td style="
                        padding: 4px 8px;
                        font-size: 10px;
                        color: #374151;
                      ">${diagnosis.description}</td>
                      <td style="
                        padding: 4px 8px;
                        font-size: 10px;
                        text-align: center;
                        color: #6B7280;
                      ">-</td>
                      <td style="
                        padding: 4px 8px;
                        font-size: 10px;
                        text-align: right;
                        color: #6B7280;
                      ">-</td>
                    </tr>
                  `).join('')}
                  ${service.procedures.map(procedure => `
                    <tr style="border-bottom: 1px solid #E5E7EB; background-color: #FEFEFE;">
                      <td style="
                        padding: 4px 8px;
                        font-size: 10px;
                        font-family: 'Courier New', monospace;
                        color: #111827;
                        font-weight: 500;
                      ">${procedure.code}</td>
                      <td style="
                        padding: 4px 8px;
                        font-size: 9px;
                        color: #059669;
                        font-weight: 500;
                      ">CPT</td>
                      <td style="
                        padding: 4px 8px;
                        font-size: 10px;
                        color: #374151;
                      ">${procedure.description}</td>
                      <td style="
                        padding: 4px 8px;
                        font-size: 10px;
                        text-align: center;
                        color: #374151;
                      ">${procedure.units}</td>
                      <td style="
                        padding: 4px 8px;
                        font-size: 10px;
                        text-align: right;
                        font-weight: 500;
                        color: #111827;
                      ">$${procedure.fee.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  ${service.procedures.length === 0 ? `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                      <td colspan="5" style="
                        padding: 8px;
                        text-align: center;
                        font-size: 10px;
                        color: #6B7280;
                        font-style: italic;
                      ">No billable procedures for this date</td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>

              <!-- Service Total -->
              <div style="
                text-align: right;
                margin-bottom: 4px;
              ">
                <span style="
                  font-size: 11px;
                  font-weight: 600;
                  color: #111827;
                ">
                  Total: $${service.total.toFixed(2)}
                </span>
              </div>

              ${serviceIndex < data.services.length - 1 ? '<hr style="margin: 12px 0; border: none; border-top: 1px solid #E5E7EB;">' : ''}
            </div>
          `).join('')}
        </div>

        <!-- Invoice Summary -->
        <div style="
          border-top: 2px solid #111827;
          background-color: #F9FAFB;
          padding: 16px 20px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; color: #4B5563;">
              <p style="margin: 2px 0;"><strong>Total Service Dates:</strong> ${data.services.length}</p>
              <p style="margin: 2px 0;"><strong>Total Procedures:</strong> ${totalProcedures}</p>
            </div>
            <div style="text-align: right;">
              <div style="
                font-size: 18px;
                font-weight: bold;
                color: #111827;
              ">
                TOTAL: $${totalAmount.toFixed(2)}
              </div>
              <div style="
                font-size: 10px;
                color: #4B5563;
                margin-top: 2px;
              ">
                Payment due within 30 days
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="
          background-color: #F3F4F6;
          padding: 12px 20px;
          text-align: center;
          font-size: 9px;
          color: #6B7280;
        ">
          <p style="margin: 0;">Please retain this invoice for your records. For billing inquiries, contact our office at ${data.provider.phone}</p>
        </div>

        ${doctorInfo?.doctorSignature ? `
          <!-- Doctor Signature -->
          <div style="
            padding: 20px;
            text-align: right;
          ">
            <img src="${doctorInfo.doctorSignature}" alt="Doctor Signature" style="
              max-height: 50px;
              margin-bottom: 6px;
            ">
            <div style="
              font-size: 11px;
              color: #374151;
            ">${doctorInfo.doctorName || ''}</div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

// Export the class
export default MedicalBillingPDF;