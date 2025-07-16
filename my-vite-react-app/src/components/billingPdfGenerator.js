// Medical Billing Invoice PDF Generator
// Updated to use server-side WeasyPrint PDF generation
// Replaces client-side html2canvas + jsPDF with server endpoint

import { auth } from '../firebaseConfig';

class MedicalBillingPDF {
  constructor() {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    this.serverEndpoint = `${API_BASE_URL}/api/generate-billing-pdf`;
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

  // Generate PDF from billing data using server-side WeasyPrint
  async generateBillingPDF(billingLedger, patientInfo, doctorInfo, options = {}) {
    try {
      // Get authentication token
      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        throw new Error('Authentication required to generate PDF');
      }

      // Prepare the request data
      const requestData = {
        billing_data: {
          billing_ledger: billingLedger
        },
        patient_info: {
          first_name: patientInfo?.first_name || '',
          last_name: patientInfo?.last_name || '',
          date_of_birth: patientInfo?.date_of_birth || '',
          id: patientInfo?.id || '',
          address: patientInfo?.address || '',
          city: patientInfo?.city || ''
        },
        doctor_info: {
          doctorName: doctorInfo?.doctorName || 'Healthcare Provider',
          clinicName: doctorInfo?.clinicName || '',
          clinicLogo: doctorInfo?.clinicLogo || null,
          doctorSignature: doctorInfo?.doctorSignature || null,
          cptFees: doctorInfo?.cptFees || {}
        },
        include_logo: doctorInfo?.includeLogoOnPdf || false,
        include_signature: options.includeSignature !== false
      };

      // Call the server endpoint
      const response = await fetch(this.serverEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      // Get the PDF blob
      const pdfBlob = await response.blob();
      
      // Extract filename from Content-Disposition header or use default
      let fileName = options.fileName;
      if (!fileName) {
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="(.+)"/);
          if (match) {
            fileName = match[1];
          }
        }
        
        if (!fileName) {
          fileName = `billing_${patientInfo?.last_name || 'patient'}_${patientInfo?.first_name || ''}_${new Date().toISOString().split('T')[0]}.pdf`;
        }
      }

      // Create download link and trigger download
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Error generating billing PDF:', error);
      throw error;
    }
  }

  // Legacy methods removed - now using server-side WeasyPrint generation
  // The convertBillingData, getCptFee, and getCptDescription methods above
  // are kept for backward compatibility but may not be needed with the new system
}

// Export the class
export default MedicalBillingPDF;