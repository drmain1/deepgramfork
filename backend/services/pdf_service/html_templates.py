from typing import Dict, List, Any
import html

class MedicalDocumentHTMLTemplate:
    def __init__(self):
        pass
    
    def generate_html(self, data: Dict[str, Any]) -> str:
        """Generate complete HTML document from medical data"""
        # Ensure data is not None
        if data is None:
            data = {}
        
        # Build HTML sections
        html_parts = []
        
        # HTML document start
        html_parts.append(self._get_html_header())
        
        # Clinic header
        if clinic_info := data.get('clinic_info'):
            html_parts.append(self._create_clinic_header(clinic_info))
        
        # Patient information
        if patient_info := data.get('patient_info'):
            html_parts.append(self._create_patient_info(patient_info))
        
        # Document sections
        if sections := data.get('sections'):
            for section_key, section_content in sections.items():
                if isinstance(section_content, str) and section_content.strip():
                    html_parts.append(self._create_section(section_key, section_content))
        
        # Motor examination
        if motor_exam := data.get('motor_exam'):
            html_parts.append(self._create_motor_exam_section(motor_exam))
        
        # Reflex examination
        if reflexes := data.get('reflexes'):
            html_parts.append(self._create_reflex_section(reflexes))
        
        # Signature section
        if provider_info := data.get('provider_info'):
            html_parts.append(self._create_signature_section(provider_info))
        
        # HTML document end
        html_parts.append(self._get_html_footer())
        
        return ''.join(html_parts)
    
    def _get_html_header(self) -> str:
        """Return HTML document header with meta tags"""
        return '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Medical Document</title>
</head>
<body>
    <div class="page">
'''
    
    def _get_html_footer(self) -> str:
        """Return HTML document footer"""
        return '''
    </div>
</body>
</html>'''
    
    def _create_clinic_header(self, clinic_info: Dict[str, str]) -> str:
        """Create clinic header section"""
        header_html = '<div class="clinic-header">\n'
        
        if name := clinic_info.get('name'):
            header_html += f'<h1 class="clinic-name">{html.escape(name)}</h1>\n'
        
        if address := clinic_info.get('address'):
            header_html += f'<p class="clinic-address">{html.escape(address)}</p>\n'
        
        contact_parts = []
        if phone := clinic_info.get('phone'):
            contact_parts.append(f'Phone: {html.escape(phone)}')
        if fax := clinic_info.get('fax'):
            contact_parts.append(f'Fax: {html.escape(fax)}')
        
        if contact_parts:
            header_html += f'<p class="clinic-contact">{" | ".join(contact_parts)}</p>\n'
        
        header_html += '</div>\n'
        return header_html
    
    def _create_patient_info(self, patient_info: Dict[str, str]) -> str:
        """Create patient information section"""
        info_html = '<div class="patient-info">\n'
        
        if name := patient_info.get('patient_name'):
            info_html += f'<p><strong>Patient Name:</strong> {html.escape(name)}</p>\n'
        
        if dob := patient_info.get('date_of_birth'):
            info_html += f'<p><strong>Date of Birth:</strong> {html.escape(dob)}</p>\n'
        
        if doa := patient_info.get('date_of_accident'):
            info_html += f'<p><strong>Date of Accident:</strong> {html.escape(doa)}</p>\n'
        
        if dot := patient_info.get('date_of_treatment'):
            info_html += f'<p><strong>Date of Treatment:</strong> {html.escape(dot)}</p>\n'
        
        info_html += '</div>\n'
        return info_html
    
    def _create_section(self, section_key: str, content: str) -> str:
        """Create a document section with proper formatting"""
        # Format section title
        display_title = section_key.replace('_', ' ').upper()
        
        section_html = f'<div class="section">\n'
        section_html += f'<h2 class="section-header">{html.escape(display_title)}:</h2>\n'
        
        # Check if content contains numbered list items
        if self._contains_numbered_list(content):
            section_html += self._format_numbered_list(content)
        else:
            # Format as paragraphs
            paragraphs = content.split('\n\n')
            for para in paragraphs:
                if para.strip():
                    section_html += f'<p class="section-content">{html.escape(para.strip())}</p>\n'
        
        section_html += '</div>\n'
        return section_html
    
    def _contains_numbered_list(self, content: str) -> bool:
        """Check if content contains numbered list items"""
        lines = content.strip().split('\n')
        for line in lines:
            if line.strip() and line.strip()[0].isdigit() and '.' in line[:3]:
                return True
        return False
    
    def _format_numbered_list(self, content: str) -> str:
        """Format content as numbered list"""
        lines = content.strip().split('\n')
        list_html = '<ol class="numbered-list">\n'
        
        current_item = []
        for line in lines:
            line = line.strip()
            if line and line[0].isdigit() and '.' in line[:3]:
                # Start of new list item
                if current_item:
                    list_html += f'<li>{html.escape(" ".join(current_item))}</li>\n'
                    current_item = []
                # Remove the number and period
                item_text = line.split('.', 1)[1].strip() if '.' in line else line
                current_item.append(item_text)
            elif line and current_item:
                # Continuation of current item
                current_item.append(line)
        
        # Add last item
        if current_item:
            list_html += f'<li>{html.escape(" ".join(current_item))}</li>\n'
        
        list_html += '</ol>\n'
        return list_html
    
    def _create_motor_exam_section(self, motor_data: Dict[str, List]) -> str:
        """Create motor examination section with tables"""
        section_html = '<div class="section">\n'
        section_html += '<h2 class="section-header">MOTOR EXAMINATION</h2>\n'
        
        # Upper extremity
        if upper_data := motor_data.get('upper_extremity'):
            section_html += '<h3>Upper Extremity Motor Strength</h3>\n'
            section_html += self._create_motor_table(upper_data)
        
        # Lower extremity
        if lower_data := motor_data.get('lower_extremity'):
            section_html += '<h3>Lower Extremity Motor Strength</h3>\n'
            section_html += self._create_motor_table(lower_data)
        
        section_html += '</div>\n'
        return section_html
    
    def _create_motor_table(self, data: List[Dict[str, str]]) -> str:
        """Create motor strength table"""
        table_html = '<table class="motor-table">\n'
        table_html += '<thead>\n<tr>\n'
        table_html += '<th>MUSCLE GROUP</th>\n'
        table_html += '<th>RIGHT</th>\n'
        table_html += '<th>LEFT</th>\n'
        table_html += '</tr>\n</thead>\n'
        table_html += '<tbody>\n'
        
        for item in data:
            table_html += '<tr>\n'
            table_html += f'<td class="muscle-name">{html.escape(item.get("muscle", ""))}</td>\n'
            table_html += f'<td class="strength-value">{html.escape(item.get("right", ""))}</td>\n'
            table_html += f'<td class="strength-value">{html.escape(item.get("left", ""))}</td>\n'
            table_html += '</tr>\n'
        
        table_html += '</tbody>\n</table>\n'
        return table_html
    
    def _create_reflex_section(self, reflex_data: Dict[str, List]) -> str:
        """Create reflex examination section with tables"""
        section_html = '<div class="section">\n'
        section_html += '<h2 class="section-header">REFLEX EXAMINATION</h2>\n'
        
        # Deep tendon reflexes
        if dtr_data := reflex_data.get('deep_tendon'):
            section_html += '<h3>Deep Tendon Reflexes</h3>\n'
            section_html += self._create_reflex_table(dtr_data)
        
        # Pathological reflexes
        if path_data := reflex_data.get('pathological'):
            section_html += '<h3>Pathological Reflexes</h3>\n'
            section_html += self._create_reflex_table(path_data)
        
        section_html += '</div>\n'
        return section_html
    
    def _create_reflex_table(self, data: List[Dict[str, str]]) -> str:
        """Create reflex table"""
        table_html = '<table class="reflex-table">\n'
        table_html += '<thead>\n<tr>\n'
        table_html += '<th>REFLEX</th>\n'
        table_html += '<th>RIGHT</th>\n'
        table_html += '<th>LEFT</th>\n'
        table_html += '</tr>\n</thead>\n'
        table_html += '<tbody>\n'
        
        for item in data:
            table_html += '<tr>\n'
            table_html += f'<td class="reflex-name">{html.escape(item.get("reflex", ""))}</td>\n'
            table_html += f'<td class="reflex-value">{html.escape(item.get("right", ""))}</td>\n'
            table_html += f'<td class="reflex-value">{html.escape(item.get("left", ""))}</td>\n'
            table_html += '</tr>\n'
        
        table_html += '</tbody>\n</table>\n'
        return table_html
    
    def _create_signature_section(self, provider_info: Dict[str, str]) -> str:
        """Create signature section"""
        section_html = '<div class="signature-section">\n'
        section_html += '<div class="signature-line"></div>\n'
        
        if name := provider_info.get('name'):
            section_html += f'<p class="provider-name">{html.escape(name)}</p>\n'
        
        if credentials := provider_info.get('credentials'):
            section_html += f'<p class="provider-credentials">{html.escape(credentials)}</p>\n'
        
        section_html += '<p class="date-line">Date: _____________________</p>\n'
        section_html += '</div>\n'
        
        return section_html