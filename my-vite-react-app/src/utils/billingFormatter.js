// Utility functions for formatting billing data

// CPT Code descriptions
export const CPT_DESCRIPTIONS = {
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

// Standard fees (can be customized per practice)
export const CPT_FEES = {
  '98940': 45.00,
  '98941': 65.00,
  '98942': 85.00,
  '97140': 55.00,
  '97110': 45.00,
  '97124': 50.00,
  '97035': 35.00,
  '97032': 40.00,
  '97010': 25.00,
  '97012': 45.00,
  '99202': 125.00,
  '99203': 175.00,
  '99204': 225.00,
  '99212': 75.00,
  '99213': 100.00,
  '99214': 150.00
};

/**
 * Format billing data as a structured HTML table for PDF generation
 */
export function formatBillingDataAsHtml(billingLedger, patientInfo, doctorInfo) {
  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <h1 style="text-align: center; color: #333;">MEDICAL BILLING STATEMENT</h1>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
        <div>
          <h3>${doctorInfo?.doctorName || 'Healthcare Provider'}</h3>
          ${doctorInfo?.clinicName ? `<p>${doctorInfo.clinicName}</p>` : ''}
        </div>
        <div style="text-align: right;">
          <h3>Patient Information</h3>
          <p><strong>Name:</strong> ${patientInfo?.first_name || ''} ${patientInfo?.last_name || ''}</p>
          <p><strong>DOB:</strong> ${patientInfo?.date_of_birth || 'N/A'}</p>
          <p><strong>Patient ID:</strong> ${patientInfo?.id || 'N/A'}</p>
        </div>
      </div>
  `;

  let grandTotal = 0;

  // Process each service date
  billingLedger.forEach((service, index) => {
    let serviceTotal = 0;
    
    html += `
      <div style="margin-bottom: 40px; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h3 style="color: #2196F3; margin-top: 0;">Service Date: ${formatDate(service.date_of_service)}</h3>
        
        <h4>Diagnoses:</h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">ICD-10 Code</th>
              <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Description</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    service.icd10_codes.forEach(diagnosis => {
      html += `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${diagnosis.code}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${diagnosis.description}</td>
            </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
        
        <h4>Services Rendered:</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">CPT Code</th>
              <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Description</th>
              <th style="text-align: right; padding: 8px; border: 1px solid #ddd;">Fee</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    service.cpt_codes.forEach(code => {
      const fee = CPT_FEES[code] || 0;
      serviceTotal += fee;
      html += `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${code}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${CPT_DESCRIPTIONS[code] || 'Service'}</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #ddd;">$${fee.toFixed(2)}</td>
            </tr>
      `;
    });
    
    html += `
            <tr style="font-weight: bold; background-color: #f9f9f9;">
              <td colspan="2" style="text-align: right; padding: 8px; border: 1px solid #ddd;">Date Total:</td>
              <td style="text-align: right; padding: 8px; border: 1px solid #ddd;">$${serviceTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    
    grandTotal += serviceTotal;
  });

  html += `
      <div style="text-align: right; margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
        <h2 style="margin: 0; color: #2196F3;">Grand Total: $${grandTotal.toFixed(2)}</h2>
        <p style="margin: 5px 0 0 0;">Total Services: ${billingLedger.reduce((count, service) => count + service.cpt_codes.length, 0)}</p>
      </div>
    </div>
  `;

  return html;
}

/**
 * Format billing data as plain text for simple PDF
 */
export function formatBillingDataAsText(billingLedger, patientInfo, doctorInfo) {
  let text = `MEDICAL BILLING STATEMENT\n\n`;
  text += `${doctorInfo?.doctorName || 'Healthcare Provider'}\n`;
  if (doctorInfo?.clinicName) text += `${doctorInfo.clinicName}\n`;
  text += `\n`;
  text += `PATIENT INFORMATION\n`;
  text += `Name: ${patientInfo?.first_name || ''} ${patientInfo?.last_name || ''}\n`;
  text += `DOB: ${patientInfo?.date_of_birth || 'N/A'}\n`;
  text += `Patient ID: ${patientInfo?.id || 'N/A'}\n`;
  text += `\n${'='.repeat(80)}\n\n`;

  let grandTotal = 0;

  billingLedger.forEach((service, index) => {
    text += `SERVICE DATE: ${formatDate(service.date_of_service)}\n\n`;
    
    // Diagnoses table
    text += `DIAGNOSES:\n`;
    text += `${'─'.repeat(60)}\n`;
    text += `ICD-10 Code  │  Description\n`;
    text += `${'─'.repeat(60)}\n`;
    service.icd10_codes.forEach(diagnosis => {
      text += `${diagnosis.code.padEnd(12)} │  ${diagnosis.description}\n`;
    });
    text += `\n`;
    
    // Services table
    text += `SERVICES RENDERED:\n`;
    text += `${'─'.repeat(80)}\n`;
    text += `CPT Code  │  Description                                          │     Fee\n`;
    text += `${'─'.repeat(80)}\n`;
    
    let dateTotal = 0;
    service.cpt_codes.forEach(code => {
      const fee = CPT_FEES[code] || 0;
      dateTotal += fee;
      const description = (CPT_DESCRIPTIONS[code] || 'Service').substring(0, 45).padEnd(45);
      text += `${code.padEnd(9)} │  ${description} │  $${fee.toFixed(2).padStart(7)}\n`;
    });
    
    text += `${'─'.repeat(80)}\n`;
    text += `${' '.repeat(55)}Date Total: $${dateTotal.toFixed(2).padStart(7)}\n`;
    
    if (index < billingLedger.length - 1) {
      text += `\n${'='.repeat(80)}\n\n`;
    }
    
    grandTotal += dateTotal;
  });
  
  text += `\n${'='.repeat(80)}\n`;
  text += `SUMMARY\n`;
  text += `Total Services: ${billingLedger.reduce((count, service) => count + service.cpt_codes.length, 0)}\n`;
  text += `GRAND TOTAL: $${grandTotal.toFixed(2)}\n`;
  text += `${'='.repeat(80)}\n`;
  
  return text;
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return dateString;
  }
}