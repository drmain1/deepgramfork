from typing import Dict, List, Any
import html
from datetime import datetime

class MedicalDocumentHTMLTemplate:
    def __init__(self):
        pass
    
    def _format_date(self, date_str: str) -> str:
        """Format date string to consistent MM/DD/YYYY format"""
        if not date_str or not date_str.strip():
            return date_str
        
        # Try different date formats and convert to MM/DD/YYYY
        date_formats = [
            '%Y-%m-%d',      # 2025-05-02
            '%m/%d/%Y',      # 08/01/2024
            '%m/%d/%y',      # 08/01/24
            '%d/%m/%Y',      # 02/05/2025
            '%B %d, %Y',     # May 2, 2025
            '%b %d, %Y',     # May 2, 2025
            '%Y%m%d',        # 20250502
            '%m-%d-%Y',      # 05-02-2025
            '%d-%m-%Y',      # 02-05-2025
        ]
        
        for fmt in date_formats:
            try:
                parsed_date = datetime.strptime(date_str.strip(), fmt)
                return parsed_date.strftime('%m/%d/%Y')
            except ValueError:
                continue
        
        # If no format matches, return original
        return date_str
    
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
        
        # Document sections with proper SOAP order
        if sections := data.get('sections'):
            # Process sections in SOAP order
            # Subjective sections first
            subjective_sections = ['chief_complaint', 'history_of_present_illness', 'past_medical_history', 
                                 'previous_accidents_trauma', 'current_medications', 'past_surgical_history', 
                                 'family_history', 'allergies', 'social_history', 'review_of_other_systems']
            
            # Objective sections (before tables)
            objective_sections_before = ['duties_under_duress', 'vitals', 'physical_examination', 
                                       'cervico_thoracic', 'lumbopelvic', 'extremity']
            
            # Objective sections (after tables)
            objective_sections_after = ['sensory_examination']
            
            # Assessment and Plan
            assessment_plan_sections = ['assessment_diagnosis', 'plan']
            
            # Process subjective sections
            for section_key in subjective_sections:
                if section_key in sections:
                    section_content = sections[section_key]
                    if isinstance(section_content, str) and section_content.strip():
                        html_parts.append(self._create_section(section_key, section_content))
            
            # Process objective sections (before tables)
            for section_key in objective_sections_before:
                if section_key in sections:
                    section_content = sections[section_key]
                    if isinstance(section_content, str) and section_content.strip():
                        html_parts.append(self._create_section(section_key, section_content))
            
            # Motor examination (part of objective)
            if motor_exam := data.get('motor_exam'):
                html_parts.append(self._create_motor_exam_section(motor_exam))
            
            # Reflex examination (part of objective)
            if reflexes := data.get('reflexes'):
                html_parts.append(self._create_reflex_section(reflexes))
            
            # Process remaining objective sections (after tables)
            for section_key in objective_sections_after:
                if section_key in sections:
                    section_content = sections[section_key]
                    if isinstance(section_content, str) and section_content.strip():
                        html_parts.append(self._create_section(section_key, section_content))
            
            # Process assessment and plan sections
            for section_key in assessment_plan_sections:
                if section_key in sections:
                    section_content = sections[section_key]
                    if isinstance(section_content, str) and section_content.strip():
                        html_parts.append(self._create_section(section_key, section_content))
            
            # Process any other sections not in our lists
            for section_key, section_content in sections.items():
                if (section_key not in subjective_sections and 
                    section_key not in objective_sections_before and 
                    section_key not in objective_sections_after and 
                    section_key not in assessment_plan_sections):
                    if isinstance(section_content, str) and section_content.strip():
                        html_parts.append(self._create_section(section_key, section_content))
        
        # Signature section
        if provider_info := data.get('provider_info'):
            html_parts.append(self._create_signature_section(provider_info))
        
        # HTML document end
        html_parts.append(self._get_html_footer())
        
        return ''.join(html_parts)
    
    def generate_multi_visit_html(self, visits_data: list, patient_name: str) -> str:
        """Generate HTML for multiple medical visits combined into one document"""
        # Sort visits by date (oldest first)
        sorted_visits = self._sort_visits_by_date(visits_data)
        
        html_parts = []
        
        # HTML document start
        html_parts.append(self._get_html_header())
        
        # Patient header for multi-visit document
        html_parts.append(f'<div class="patient-header"><h1>Medical Records for {html.escape(patient_name)}</h1></div>\n')
        
        visit_counters = {'follow_up': 0, 're_evaluation': 0}
        section_headers_added = {'follow_up': False, 're_evaluation': False}
        
        for i, visit_data in enumerate(sorted_visits):
            data = visit_data.model_dump() if hasattr(visit_data, 'model_dump') else visit_data
            
            # Extract visit date and type information
            visit_date = self._extract_visit_date(data)
            visit_type = self._determine_visit_type(data)
            
            # Add section headers for different visit types
            if visit_type == 'follow_up' and not section_headers_added['follow_up']:
                html_parts.append('<div class="follow-up-header"><h2>FOLLOW-UP VISITS</h2></div>')
                section_headers_added['follow_up'] = True
            elif visit_type == 're_evaluation' and not section_headers_added['re_evaluation']:
                html_parts.append('<div class="re-evaluation-header"><h2>RE-EVALUATIONS</h2></div>')
                section_headers_added['re_evaluation'] = True
            
            # Count visits by type
            if visit_type in visit_counters:
                visit_counters[visit_type] += 1
            
            # Start visit container
            html_parts.append('<div class="visit-container">')
            
            # Visit date header with proper formatting
            if visit_date:
                count = visit_counters.get(visit_type, 1)
                date_header = self._format_visit_date(visit_date, visit_type, count)
                html_parts.append(f'<div class="visit-date-header"><h3>{date_header}</h3></div>')
            
            # Show clinic header and patient info for structured visits (initial, re_evaluation, final)
            if visit_type not in ['follow_up']:
                # Clinic header for this visit
                if clinic_info := data.get('clinic_info'):
                    html_parts.append(self._create_clinic_header(clinic_info))
                
                # Patient information for this visit
                if patient_info := data.get('patient_info'):
                    html_parts.append(self._create_patient_info(patient_info))
            
            # Document sections for this visit with proper SOAP order
            if sections := data.get('sections'):
                # For follow-up visits with narrative content
                if visit_type == 'follow_up' and ('follow_up_visit' in sections or 'clinical_notes' in sections):
                    # Just render the narrative content
                    for section_key, section_content in sections.items():
                        if isinstance(section_content, str) and section_content.strip():
                            html_parts.append(self._create_section(section_key, section_content))
                elif visit_type == 're_evaluation':
                    # For re-evaluations, render with special comparison highlighting
                    html_parts.append(self._create_re_evaluation_content(data))
                else:
                    # For structured visits, use SOAP order
                    # Subjective sections first
                    subjective_sections = ['chief_complaint', 'history_of_present_illness', 'past_medical_history', 
                                         'previous_accidents_trauma', 'current_medications', 'past_surgical_history', 
                                         'family_history', 'allergies', 'social_history', 'review_of_other_systems']
                    
                    # Objective sections (before tables)
                    objective_sections_before = ['duties_under_duress', 'vitals', 'physical_examination', 
                                               'cervico_thoracic', 'lumbopelvic', 'extremity']
                    
                    # Objective sections (after tables)
                    objective_sections_after = ['sensory_examination']
                    
                    # Assessment and Plan
                    assessment_plan_sections = ['assessment_diagnosis', 'plan']
                    
                    # Process subjective sections
                    for section_key in subjective_sections:
                        if section_key in sections:
                            section_content = sections[section_key]
                            if isinstance(section_content, str) and section_content.strip():
                                html_parts.append(self._create_section(section_key, section_content))
                    
                    # Process objective sections (before tables)
                    for section_key in objective_sections_before:
                        if section_key in sections:
                            section_content = sections[section_key]
                            if isinstance(section_content, str) and section_content.strip():
                                html_parts.append(self._create_section(section_key, section_content))
                    
                    # Motor examination for this visit (part of objective)
                    if motor_exam := data.get('motor_exam'):
                        html_parts.append(self._create_motor_exam_section(motor_exam))
                    
                    # Reflex examination for this visit (part of objective)
                    if reflexes := data.get('reflexes'):
                        html_parts.append(self._create_reflex_section(reflexes))
                    
                    # Process remaining objective sections (after tables)
                    for section_key in objective_sections_after:
                        if section_key in sections:
                            section_content = sections[section_key]
                            if isinstance(section_content, str) and section_content.strip():
                                html_parts.append(self._create_section(section_key, section_content))
                    
                    # Process assessment and plan sections
                    for section_key in assessment_plan_sections:
                        if section_key in sections:
                            section_content = sections[section_key]
                            if isinstance(section_content, str) and section_content.strip():
                                html_parts.append(self._create_section(section_key, section_content))
                    
                    # Process any other sections not in our lists
                    for section_key, section_content in sections.items():
                        if (section_key not in subjective_sections and 
                            section_key not in objective_sections_before and 
                            section_key not in objective_sections_after and 
                            section_key not in assessment_plan_sections):
                            if isinstance(section_content, str) and section_content.strip():
                                html_parts.append(self._create_section(section_key, section_content))
            
            # End visit container
            html_parts.append('</div>')
            
            # Add page break only between initial visits and before follow-up section
            # Follow-up visits should flow together without page breaks
            if i < len(sorted_visits) - 1:
                next_visit_data = sorted_visits[i + 1]
                next_data = next_visit_data.model_dump() if hasattr(next_visit_data, 'model_dump') else next_visit_data
                next_visit_type = self._determine_visit_type(next_data)
                
                # Only add page break if current is initial and next is initial
                # (Don't break between initial and follow-up, or between follow-ups)
                if visit_type == 'initial' and next_visit_type == 'initial':
                    html_parts.append('<div class="page-break"></div>')
        
        # Signature section (only at the end)
        if sorted_visits and (provider_info := sorted_visits[-1].get('provider_info')):
            html_parts.append(self._create_signature_section(provider_info))
        
        # HTML document end
        html_parts.append(self._get_html_footer())
        
        return ''.join(html_parts)
    
    def _extract_visit_date(self, data: dict) -> str:
        """Extract visit date from medical data"""
        if patient_info := data.get('patient_info'):
            return patient_info.get('date_of_treatment') or patient_info.get('date_of_service')
        return None
    
    def _determine_visit_type(self, data: dict) -> str:
        """Determine visit type using explicit evaluation_type field"""
        # Check for explicit evaluation_type field (most reliable)
        evaluation_type = data.get('evaluation_type')
        if evaluation_type in ['initial', 'follow_up', 're_evaluation', 'final']:
            return evaluation_type
        
        # Fallback: look for indicators in content (for backward compatibility)
        sections = data.get('sections', {})
        for section_content in sections.values():
            if isinstance(section_content, str):
                content_lower = section_content.lower()
                if 'follow' in content_lower and 'up' in content_lower:
                    return 'follow_up'
                elif 'previously:' in content_lower and 'currently:' in content_lower:
                    return 're_evaluation'
        return 'initial'
    
    def _format_visit_date(self, date_str: str, visit_type: str, visit_count: int) -> str:
        """Format visit date with visit number and type"""
        if visit_type == 'initial':
            return f"{date_str} - Initial Examination"
        elif visit_type == 'follow_up':
            return f"{date_str} - Follow-up Visit #{visit_count}"
        elif visit_type == 're_evaluation':
            return f"{date_str} - Re-evaluation"
        elif visit_type == 'final':
            return f"{date_str} - Final Examination"
        else:
            return f"{date_str} - Visit #{visit_count}"
    
    def _sort_visits_by_date(self, visits_data: list) -> list:
        """Sort visits by date (oldest first)"""
        def get_visit_date(visit_data):
            # Convert to dict if needed
            data = visit_data.model_dump() if hasattr(visit_data, 'model_dump') else visit_data
            
            # Try to extract date from patient_info
            if patient_info := data.get('patient_info'):
                date_str = patient_info.get('date_of_treatment') or patient_info.get('date_of_service')
                if date_str:
                    try:
                        # Try different date formats
                        from datetime import datetime
                        # Try common formats
                        for fmt in ['%B %d, %Y', '%m/%d/%Y', '%Y-%m-%d', '%d/%m/%Y']:
                            try:
                                return datetime.strptime(date_str, fmt)
                            except ValueError:
                                continue
                    except:
                        pass
            
            # Fallback: return a very old date to put at beginning
            from datetime import datetime
            return datetime(1900, 1, 1)
        
        # Sort by date (oldest first)
        return sorted(visits_data, key=get_visit_date)
    
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
            formatted_dob = self._format_date(dob)
            info_html += f'<p><strong>Date of Birth:</strong> {html.escape(formatted_dob)}</p>\n'
        
        if doa := patient_info.get('date_of_accident'):
            formatted_doa = self._format_date(doa)
            info_html += f'<p><strong>Date of Accident:</strong> {html.escape(formatted_doa)}</p>\n'
        
        if dot := patient_info.get('date_of_treatment'):
            formatted_dot = self._format_date(dot)
            info_html += f'<p><strong>Date of Treatment:</strong> {html.escape(formatted_dot)}</p>\n'
        
        info_html += '</div>\n'
        return info_html
    
    def _create_section(self, section_key: str, content: str) -> str:
        """Create a document section with proper formatting"""
        # Special handling for follow-up visits - no section header needed
        if section_key in ['follow_up_visit', 'clinical_notes']:
            section_html = f'<div class="narrative-section">\n'
            # Format as paragraphs without a header
            paragraphs = content.split('\n\n')
            for para in paragraphs:
                if para.strip():
                    section_html += f'<p class="narrative-content">{html.escape(para.strip())}</p>\n'
            section_html += '</div>\n'
            return section_html
        
        # Standard section formatting for structured content
        display_title = section_key.replace('_', ' ').upper()
        
        section_html = f'<div class="section">\n'
        section_html += f'<h2 class="section-header">{html.escape(display_title)}:</h2>\n'
        
        # Check if content contains numbered list items
        if self._contains_numbered_list(content):
            section_html += self._format_numbered_list(content)
        elif self._contains_bulleted_list(content):
            section_html += self._format_bulleted_list(content)
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
    
    def _contains_bulleted_list(self, content: str) -> bool:
        """Check if content contains bulleted list items (dashes or bullets)"""
        lines = content.strip().split('\n')
        for line in lines:
            stripped = line.strip()
            if stripped and (stripped.startswith('- ') or stripped.startswith('• ') or stripped.startswith('* ')):
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
    
    def _format_bulleted_list(self, content: str) -> str:
        """Format content as bulleted list"""
        lines = content.strip().split('\n')
        list_html = '<ul class="bulleted-list">\n'
        
        current_item = []
        for line in lines:
            line = line.strip()
            if line and (line.startswith('- ') or line.startswith('• ') or line.startswith('* ')):
                # Start of new list item
                if current_item:
                    list_html += f'<li>{html.escape(" ".join(current_item))}</li>\n'
                    current_item = []
                # Remove the bullet marker
                item_text = line[2:].strip() if line.startswith('- ') or line.startswith('• ') or line.startswith('* ') else line
                current_item.append(item_text)
            elif line and current_item:
                # Continuation of current item
                current_item.append(line)
        
        # Add last item
        if current_item:
            list_html += f'<li>{html.escape(" ".join(current_item))}</li>\n'
        
        list_html += '</ul>\n'
        return list_html
    
    def _create_re_evaluation_content(self, data: Dict[str, Any]) -> str:
        """Create re-evaluation content with comparison highlighting for multi-visit PDFs"""
        import re
        sections = data.get('sections', {})
        content_html = ''
        
        # Chief Complaint with comparison
        if chief_complaint := sections.get('chief_complaint'):
            content_html += '<div class="section">\n'
            content_html += '<h2 class="section-header">CHIEF COMPLAINT & STATUS:</h2>\n'
            # Parse and format complaints with comparison highlighting
            complaints = self._parse_complaints_for_display(chief_complaint)
            for i, complaint in enumerate(complaints, 1):
                content_html += f'<div class="complaint-block">\n'
                content_html += f'<p class="complaint-current">{i}. {html.escape(complaint["text"])}</p>\n'
                if complaint.get("initial_part"):
                    content_html += f'<p class="complaint-initial">{html.escape(complaint["initial_part"])}</p>\n'
                content_html += '</div>\n'
            content_html += '</div>\n'
        
        # History of Present Illness
        if hpi := sections.get('history_of_present_illness'):
            content_html += '<div class="section">\n'
            content_html += '<h2 class="section-header">HISTORY OF PRESENT ILLNESS:</h2>\n'
            content_html += f'<p class="section-content">{html.escape(hpi)}</p>\n'
            content_html += '</div>\n'
        
        # Outcome Assessments with progress visualization
        if outcomes := sections.get('outcome_assessments'):
            content_html += '<div class="section">\n'
            content_html += '<h2 class="section-header">OUTCOME ASSESSMENTS:</h2>\n'
            assessments = self._parse_outcomes_for_display(outcomes)
            for assessment in assessments:
                content_html += '<div class="dashboard-item">\n'
                content_html += f'<strong>{html.escape(assessment["name"])}: '
                if assessment.get("improvement_percentage"):
                    content_html += f'<span class="improvement-text">{assessment["improvement_percentage"]}% Improvement</span>'
                content_html += '</strong>\n'
                
                if assessment.get("initial_percentage"):
                    content_html += f'<p style="margin: 2px 0; font-size: 9pt;">Initial: {assessment["initial_percentage"]}% Disabled</p>\n'
                    content_html += '<div class="progress-bar-container">\n'
                    content_html += f'<div class="progress-bar" style="width: {assessment["initial_percentage"]}%;"></div>\n'
                    content_html += '</div>\n'
                
                if assessment.get("current_percentage"):
                    content_html += f'<p style="margin: 2px 0; font-size: 9pt;">Current: {assessment["current_percentage"]}% Disabled</p>\n'
                    content_html += '<div class="progress-bar-container">\n'
                    content_html += f'<div class="progress-bar current" style="width: {assessment["current_percentage"]}%;"></div>\n'
                    content_html += '</div>\n'
                
                content_html += '</div>\n'
            content_html += '</div>\n'
        
        # Physical Examination with comparisons
        exam_sections = ['cervico_thoracic', 'lumbopelvic', 'extremity', 'physical_examination']
        for section_key in exam_sections:
            if section_content := sections.get(section_key):
                display_title = section_key.replace('_', ' ').upper()
                content_html += '<div class="section">\n'
                content_html += f'<h2 class="section-header">{html.escape(display_title)}:</h2>\n'
                content_html += f'<p class="section-content">{html.escape(section_content)}</p>\n'
                content_html += '</div>\n'
        
        # Assessment and Plan
        if assessment := sections.get('assessment_diagnosis'):
            content_html += '<div class="section">\n'
            content_html += '<h2 class="section-header">ASSESSMENT & DIAGNOSIS:</h2>\n'
            content_html += f'<p class="diagnosis-list">{html.escape(assessment)}</p>\n'
            content_html += '</div>\n'
        
        if plan := sections.get('plan'):
            content_html += '<div class="section">\n'
            content_html += '<h2 class="section-header">PLAN:</h2>\n'
            content_html += f'<p class="section-content">{html.escape(plan)}</p>\n'
            content_html += '</div>\n'
        
        return content_html
    
    def _parse_complaints_for_display(self, complaint_text: str) -> list:
        """Parse chief complaints for display formatting"""
        if not complaint_text:
            return []
        
        import re
        complaints = []
        lines = complaint_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if re.match(r'^\d+\.', line):  # Starts with number and period
                # Extract the main complaint text
                complaint_match = re.match(r'^\d+\.\s*(.+)', line)
                if complaint_match:
                    text = complaint_match.group(1)
                    
                    # Check for comparison format
                    if 'Previously:' in text and 'Currently:' in text:
                        # Split into current and initial parts
                        parts = text.split('Previously:')
                        current_part = parts[0].strip().rstrip(',').rstrip(':')
                        initial_part = 'Previously:' + parts[1] if len(parts) > 1 else ''
                        
                        complaints.append({
                            'text': current_part,
                            'initial_part': initial_part
                        })
                    else:
                        complaints.append({
                            'text': text,
                            'initial_part': ''
                        })
        
        return complaints
    
    def _parse_outcomes_for_display(self, assessment_text: str) -> list:
        """Parse outcome assessments for progress display"""
        if not assessment_text:
            return []
        
        import re
        assessments = []
        lines = assessment_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if ':' in line:
                # Split on the first colon
                name_part, value_part = line.split(':', 1)
                name = name_part.strip()
                
                # Extract percentages and improvement using regex
                initial_match = re.search(r'Previously\s+(\d+)%', value_part)
                current_match = re.search(r'currently\s+(\d+)%', value_part)
                improvement_match = re.search(r'\((\d+)%\s+improvement\)', value_part)
                
                assessment = {'name': name}
                
                if initial_match:
                    assessment['initial_percentage'] = int(initial_match.group(1))
                if current_match:
                    assessment['current_percentage'] = int(current_match.group(1))
                if improvement_match:
                    assessment['improvement_percentage'] = int(improvement_match.group(1))
                
                assessments.append(assessment)
        
        return assessments
    
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