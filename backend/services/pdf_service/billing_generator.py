import io
import os
from pathlib import Path
from typing import Dict, Any, Optional, List
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
from .css_styles import get_medical_document_css
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class WeasyPrintBillingPDFGenerator:
    def __init__(self):
        self.font_config = FontConfiguration()
        self._register_fonts()
    
    def _register_fonts(self):
        """Register Besley font with WeasyPrint"""
        try:
            current_dir = Path(__file__).parent.parent.parent
            fonts_dir = current_dir / "fonts"
            besley_path = fonts_dir / "Besley-Regular.ttf"
            
            if besley_path.exists():
                logger.info(f"Besley font available at {besley_path}")
            else:
                logger.warning(f"Besley font not found at {besley_path}, using fallback fonts")
        except Exception as e:
            logger.error(f"Could not register Besley font: {e}, using fallback fonts")
    
    def _get_besley_font_path(self) -> str:
        """Get the file URI for the Besley font"""
        try:
            current_dir = Path(__file__).parent.parent.parent
            fonts_dir = current_dir / "fonts"
            besley_path = fonts_dir / "Besley-Regular.ttf"
            
            if besley_path.exists():
                return besley_path.as_uri()
            else:
                return None
        except Exception as e:
            logger.error(f"Error getting Besley font path: {e}")
            return None

    def generate_billing_pdf(self, billing_data: Dict[str, Any], patient_info: Dict[str, Any], 
                           doctor_info: Dict[str, Any], include_logo: bool = True, 
                           include_signature: bool = True) -> bytes:
        """Generate a billing PDF from billing data"""
        try:
            # Create HTML content
            html_content = self._create_billing_html(
                billing_data, patient_info, doctor_info, include_logo, include_signature
            )
            
            # Create CSS
            css_content = self._create_billing_css()
            
            # Generate PDF
            html_doc = HTML(string=html_content)
            css_doc = CSS(string=css_content, font_config=self.font_config)
            
            pdf_buffer = io.BytesIO()
            html_doc.write_pdf(pdf_buffer, stylesheets=[css_doc], font_config=self.font_config)
            
            return pdf_buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Error generating billing PDF: {str(e)}")
            raise e

    def _create_billing_html(self, billing_data: Dict[str, Any], patient_info: Dict[str, Any], 
                           doctor_info: Dict[str, Any], include_logo: bool, 
                           include_signature: bool) -> str:
        """Create HTML content for billing PDF"""
        
        # Extract billing ledger from billing_data
        billing_ledger = billing_data.get('billing_ledger', [])
        
        # Calculate totals
        total_amount = 0
        total_procedures = 0
        
        for service in billing_ledger:
            if 'cpt_codes' in service:
                for cpt_code in service['cpt_codes']:
                    fee = self._get_cpt_fee(cpt_code, doctor_info.get('cptFees', {}))
                    total_amount += fee
                    total_procedures += 1
        
        # Generate invoice number and date
        invoice_number = f"INV-{datetime.now().year}-{datetime.now().strftime('%m%d%H%M')}"
        invoice_date = datetime.now().strftime('%Y-%m-%d')
        
        # Patient name
        patient_name = f"{patient_info.get('first_name', '')} {patient_info.get('last_name', '')}".strip()
        
        # Provider info
        provider_name = doctor_info.get('doctorName', 'Healthcare Provider')
        clinic_name = doctor_info.get('clinicName', '')
        
        # Logo HTML
        logo_html = ''
        if include_logo and doctor_info.get('clinicLogo'):
            logo_html = f'''
                <img src="{doctor_info['clinicLogo']}" alt="Clinic Logo" class="clinic-logo">
            '''
        
        # Generate services HTML
        services_html = ''
        for service in billing_ledger:
            service_date = service.get('date_of_service', 'Unknown Date')
            
            # ICD-10 codes
            icd_codes_html = ''
            for icd in service.get('icd10_codes', []):
                icd_codes_html += f'''
                    <tr class="diagnosis-row">
                        <td class="code-cell">{icd.get('code', '')}</td>
                        <td class="type-cell">ICD-10</td>
                        <td class="description-cell">{icd.get('description', '')}</td>
                        <td class="units-cell">-</td>
                        <td class="amount-cell">-</td>
                    </tr>
                '''
            
            # CPT codes
            cpt_codes_html = ''
            service_total = 0
            for cpt_code in service.get('cpt_codes', []):
                fee = self._get_cpt_fee(cpt_code, doctor_info.get('cptFees', {}))
                service_total += fee
                description = self._get_cpt_description(cpt_code)
                
                cpt_codes_html += f'''
                    <tr class="procedure-row">
                        <td class="code-cell">{cpt_code}</td>
                        <td class="type-cell">CPT</td>
                        <td class="description-cell">{description}</td>
                        <td class="units-cell">1</td>
                        <td class="amount-cell">${fee:.2f}</td>
                    </tr>
                '''
            
            services_html += f'''
                <div class="service-section">
                    <div class="service-date-header">
                        <h4>{datetime.strptime(service_date, '%Y-%m-%d').strftime('%b %d, %Y') if service_date != 'Unknown Date' else service_date}</h4>
                    </div>
                    
                    <table class="service-table">
                        <thead>
                            <tr>
                                <th class="code-header">Code</th>
                                <th class="type-header">Type</th>
                                <th class="description-header">Description</th>
                                <th class="units-header">Units</th>
                                <th class="amount-header">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {icd_codes_html}
                            {cpt_codes_html}
                        </tbody>
                    </table>
                    
                    <div class="service-total">
                        <strong>Total: ${service_total:.2f}</strong>
                    </div>
                </div>
            '''
        
        # Signature HTML
        signature_html = ''
        if include_signature and doctor_info.get('doctorSignature'):
            signature_html = f'''
                <div class="signature-section">
                    <img src="{doctor_info['doctorSignature']}" alt="Doctor Signature" class="doctor-signature">
                    <div class="signature-name">{provider_name}</div>
                </div>
            '''
        
        html_content = f'''
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Medical Invoice - {patient_name}</title>
        </head>
        <body>
            <div class="invoice-container">
                <!-- Header -->
                <div class="invoice-header">
                    <div class="header-left">
                        {logo_html}
                        <h1>MEDICAL INVOICE</h1>
                        <div class="invoice-details">
                            <p><strong>Invoice #:</strong> {invoice_number}</p>
                            <p><strong>Invoice Date:</strong> {invoice_date}</p>
                        </div>
                    </div>
                    <div class="header-right">
                        <h2>{provider_name}</h2>
                        {f'<p class="clinic-name">{clinic_name}</p>' if clinic_name else ''}
                        <div class="provider-details">
                            <p>123 Medical Center Drive</p>
                            <p>Healthcare City, HC 12345</p>
                            <p>(555) 123-4567</p>
                            <p><strong>NPI:</strong> 1234567890</p>
                        </div>
                    </div>
                </div>
                
                <!-- Patient Information -->
                <div class="patient-section">
                    <h3>PATIENT INFORMATION</h3>
                    <div class="patient-details">
                        <div class="patient-left">
                            <div><strong>Name:</strong> {patient_name}</div>
                            <div><strong>DOB:</strong> {patient_info.get('date_of_birth', 'N/A')}</div>
                            <div><strong>Patient ID:</strong> {patient_info.get('id', 'N/A')}</div>
                        </div>
                        <div class="patient-right">
                            <div><strong>Address:</strong> {patient_info.get('address', '')}</div>
                            <div>{patient_info.get('city', '')}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Services -->
                <div class="services-section">
                    <h3>SERVICES RENDERED</h3>
                    {services_html}
                </div>
                
                <!-- Summary -->
                <div class="invoice-summary">
                    <div class="summary-left">
                        <p><strong>Total Service Dates:</strong> {len(billing_ledger)}</p>
                        <p><strong>Total Procedures:</strong> {total_procedures}</p>
                    </div>
                    <div class="summary-right">
                        <div class="total-amount">TOTAL: ${total_amount:.2f}</div>
                        <div class="payment-terms">Payment due within 30 days</div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="invoice-footer">
                    <p>Please retain this invoice for your records. For billing inquiries, contact our office at (555) 123-4567</p>
                </div>
                
                {signature_html}
            </div>
        </body>
        </html>
        '''
        
        return html_content

    def _create_billing_css(self) -> str:
        """Create CSS styles for billing PDF"""
        besley_font_path = self._get_besley_font_path()
        
        font_face = ''
        if besley_font_path:
            font_face = f'''
            @font-face {{
                font-family: 'Besley';
                src: url('{besley_font_path}') format('truetype');
                font-weight: normal;
                font-style: normal;
            }}
            '''
        
        return f'''
        {font_face}
        
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: {'Besley, ' if besley_font_path else ''}'Times New Roman', serif;
            font-size: 11px;
            line-height: 1.3;
            color: #111827;
            background: white;
        }}
        
        .invoice-container {{
            max-width: 794px;
            margin: 0 auto;
            background: white;
            padding: 20px;
        }}
        
        .invoice-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #111827;
            padding-bottom: 20px;
            margin-bottom: 20px;
        }}
        
        .clinic-logo {{
            max-height: 60px;
            max-width: 150px;
            object-fit: contain;
            margin-bottom: 10px;
        }}
        
        .invoice-header h1 {{
            font-size: 20px;
            font-weight: bold;
            color: #111827;
            margin: 0 0 6px 0;
        }}
        
        .invoice-header h2 {{
            font-size: 16px;
            font-weight: bold;
            color: #111827;
            margin: 0 0 6px 0;
        }}
        
        .clinic-name {{
            font-size: 12px;
            margin-bottom: 6px;
        }}
        
        .invoice-details {{
            font-size: 11px;
            color: #4B5563;
        }}
        
        .invoice-details p {{
            margin: 2px 0;
        }}
        
        .header-right {{
            text-align: right;
        }}
        
        .provider-details {{
            font-size: 11px;
            color: #4B5563;
        }}
        
        .provider-details p {{
            margin: 2px 0;
        }}
        
        .patient-section {{
            padding: 16px 0;
            border-bottom: 1px solid #D1D5DB;
            margin-bottom: 16px;
        }}
        
        .patient-section h3 {{
            font-size: 14px;
            font-weight: 600;
            color: #111827;
            margin: 0 0 10px 0;
        }}
        
        .patient-details {{
            display: flex;
            justify-content: space-between;
            font-size: 11px;
        }}
        
        .patient-details div {{
            margin-bottom: 4px;
        }}
        
        .services-section h3 {{
            font-size: 14px;
            font-weight: 600;
            color: #111827;
            margin: 0 0 12px 0;
        }}
        
        .service-section {{
            margin-bottom: 16px;
        }}
        
        .service-date-header {{
            background-color: #F9FAFB;
            padding: 6px 12px;
            border-left: 3px solid #2563EB;
            margin-bottom: 8px;
        }}
        
        .service-date-header h4 {{
            font-weight: 600;
            color: #111827;
            margin: 0;
            font-size: 12px;
        }}
        
        .service-table {{
            width: 100%;
            border: 1px solid #D1D5DB;
            border-collapse: collapse;
            margin-bottom: 6px;
        }}
        
        .service-table th {{
            padding: 4px 8px;
            text-align: left;
            font-size: 10px;
            font-weight: 500;
            color: #111827;
            border-bottom: 1px solid #D1D5DB;
            background-color: #F9FAFB;
        }}
        
        .service-table td {{
            padding: 4px 8px;
            font-size: 10px;
            border-bottom: 1px solid #E5E7EB;
        }}
        
        .code-header, .code-cell {{
            width: 15%;
        }}
        
        .type-header, .type-cell {{
            width: 10%;
        }}
        
        .description-header, .description-cell {{
            width: 60%;
        }}
        
        .units-header, .units-cell {{
            width: 8%;
            text-align: center;
        }}
        
        .amount-header, .amount-cell {{
            width: 7%;
            text-align: right;
        }}
        
        .diagnosis-row {{
            background-color: #FEFEFE;
        }}
        
        .diagnosis-row .type-cell {{
            color: #6B7280;
            font-weight: 500;
        }}
        
        .diagnosis-row .units-cell,
        .diagnosis-row .amount-cell {{
            color: #6B7280;
        }}
        
        .procedure-row {{
            background-color: #FEFEFE;
        }}
        
        .procedure-row .code-cell {{
            font-family: 'Courier New', monospace;
            font-weight: 500;
        }}
        
        .procedure-row .type-cell {{
            color: #059669;
            font-weight: 500;
        }}
        
        .procedure-row .amount-cell {{
            font-weight: 500;
            color: #111827;
        }}
        
        .service-total {{
            text-align: right;
            margin-bottom: 4px;
            font-size: 11px;
            font-weight: 600;
            color: #111827;
        }}
        
        .invoice-summary {{
            border-top: 2px solid #111827;
            background-color: #F9FAFB;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 20px;
        }}
        
        .summary-left {{
            font-size: 11px;
            color: #4B5563;
        }}
        
        .summary-left p {{
            margin: 2px 0;
        }}
        
        .total-amount {{
            font-size: 18px;
            font-weight: bold;
            color: #111827;
        }}
        
        .payment-terms {{
            font-size: 10px;
            color: #4B5563;
            margin-top: 2px;
        }}
        
        .invoice-footer {{
            background-color: #F3F4F6;
            padding: 12px;
            text-align: center;
            font-size: 9px;
            color: #6B7280;
            margin-top: 20px;
        }}
        
        .signature-section {{
            padding: 20px;
            text-align: right;
        }}
        
        .doctor-signature {{
            max-height: 50px;
            margin-bottom: 6px;
        }}
        
        .signature-name {{
            font-size: 11px;
            color: #374151;
        }}
        '''

    def _get_cpt_fee(self, code: str, user_cpt_fees: Dict[str, float]) -> float:
        """Get CPT fee with user-specific fees"""
        if user_cpt_fees and code in user_cpt_fees:
            return float(user_cpt_fees[code])
        return 0.0

    def _get_cpt_description(self, code: str) -> str:
        """Get CPT description"""
        CPT_DESCRIPTIONS = {
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
        }
        return CPT_DESCRIPTIONS.get(code, 'Medical Service')