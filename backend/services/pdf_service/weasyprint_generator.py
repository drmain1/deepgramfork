import io
import os
import re
import html
from pathlib import Path
from typing import Dict, Any, Optional
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
from jinja2 import Environment, FileSystemLoader
from .html_templates import MedicalDocumentHTMLTemplate
from .css_styles import get_medical_document_css, get_re_evaluation_css
from services.user_settings_service import UserSettingsService
from firestore_client import firestore_client
from gcs_utils import GCSClient
import logging

logger = logging.getLogger(__name__)

class WeasyPrintMedicalPDFGenerator:
    def __init__(self):
        self.html_template = MedicalDocumentHTMLTemplate()
        self.font_config = FontConfiguration()
        self._register_fonts()
        self._setup_jinja_environment()
        # Initialize user settings service for clinic info retrieval
        self.user_settings_service = UserSettingsService(GCSClient())
    
    def _register_fonts(self):
        """Register Besley font with WeasyPrint"""
        try:
            # Get the fonts directory path
            current_dir = Path(__file__).parent.parent.parent  # Go up to backend dir
            fonts_dir = current_dir / "fonts"
            besley_path = fonts_dir / "Besley-Regular.ttf"
            
            if besley_path.exists():
                # Register the font with WeasyPrint's FontConfiguration
                # WeasyPrint will handle the font through CSS @font-face declarations
                # No need for programmatic registration - CSS will handle it
                pass
                
                logger.info(f"Besley font registered successfully from {besley_path}")
            else:
                logger.warning(f"Besley font not found at {besley_path}, using fallback fonts")
        except Exception as e:
            logger.error(f"Could not register Besley font: {e}, using fallback fonts")
    
    def _get_besley_font_path(self) -> str:
        """Get the file URI for the Besley font"""
        try:
            current_dir = Path(__file__).parent.parent.parent  # Go up to backend dir
            fonts_dir = current_dir / "fonts"
            besley_path = fonts_dir / "Besley-Regular.ttf"
            
            if besley_path.exists():
                return besley_path.as_uri()
            else:
                return None
        except Exception as e:
            logger.error(f"Error getting Besley font path: {e}")
            return None
    
    def _setup_jinja_environment(self):
        """Setup Jinja2 environment for template rendering"""
        try:
            # Get the templates directory path
            current_dir = Path(__file__).parent
            templates_dir = current_dir / "jinja_templates"
            
            # Create Jinja2 environment
            self.jinja_env = Environment(
                loader=FileSystemLoader(str(templates_dir)),
                autoescape=True
            )
            
            # Add custom functions to Jinja2 environment
            self.jinja_env.globals['parse_chief_complaints'] = self._parse_chief_complaints
            self.jinja_env.globals['parse_outcome_assessments'] = self._parse_outcome_assessments
            self.jinja_env.globals['get_physical_exam_comparisons'] = self._get_physical_exam_comparisons
            
            logger.info(f"Jinja2 environment setup successfully with templates from {templates_dir}")
        except Exception as e:
            logger.error(f"Could not setup Jinja2 environment: {e}")
            self.jinja_env = None
    
    def _parse_chief_complaints(self, complaint_text: str) -> list:
        """Parse chief complaint text into structured format for template"""
        if not complaint_text:
            return []
        
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
                            'initial_part': initial_part,
                            'has_comparison': True
                        })
                    else:
                        complaints.append({
                            'text': text,
                            'initial_part': '',
                            'has_comparison': False
                        })
        
        return complaints
    
    def _parse_outcome_assessments(self, assessment_text: str) -> list:
        """Parse outcome assessment text into structured format with progress data"""
        if not assessment_text:
            return []
        
        assessments = []
        lines = assessment_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if ':' in line:
                # Split on the first colon
                name_part, value_part = line.split(':', 1)
                name = name_part.strip()
                
                # Extract percentages and improvement
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
    
    def _get_physical_exam_comparisons(self, data: Dict[str, Any]) -> list:
        """Extract physical examination comparisons from various sections"""
        comparisons = []
        sections = data.get('sections', {})
        
        # Check relevant sections for comparison data
        exam_sections = ['cervico_thoracic', 'lumbopelvic', 'extremity', 'physical_examination']
        
        for section_name in exam_sections:
            section_content = sections.get(section_name)
            if section_content and 'Previously:' in section_content and 'Currently:' in section_content:
                # Parse comparison format
                lines = section_content.split('\n')
                for line in lines:
                    line = line.strip()
                    if 'Previously:' in line and 'Currently:' in line:
                        # Extract finding name, initial and current states
                        parts = line.split('Previously:')
                        if len(parts) == 2:
                            finding_name = parts[0].strip().rstrip(':')
                            remaining = parts[1]
                            
                            # Split on "Currently:"
                            initial_current = remaining.split('Currently:')
                            if len(initial_current) == 2:
                                initial_state = initial_current[0].strip().rstrip('|').strip()
                                current_state = initial_current[1].strip()
                                
                                comparisons.append({
                                    'name': finding_name,
                                    'initial': initial_state,
                                    'current': current_state
                                })
        
        return comparisons
    
    async def _get_clinic_info_from_database(self, user_id: str) -> Dict[str, Any]:
        """Fetch clinic information from user settings in Firestore/GCS"""
        try:
            # First try to get from Firestore (faster)
            firestore_settings = await firestore_client.get_user_settings(user_id)
            if firestore_settings and firestore_settings.get('office_information'):
                office_info = firestore_settings.get('office_information', [])
                logger.info(f"Retrieved clinic info from Firestore for user {user_id}")
            else:
                # Fallback to GCS
                gcs_settings = await self.user_settings_service.get_user_settings(user_id)
                office_info = gcs_settings.get('officeInformation', [])
                logger.info(f"Retrieved clinic info from GCS for user {user_id}")
            
            # Parse office information into structured clinic info
            clinic_info = {}
            if office_info:
                # Office info is now stored as a list of individual lines
                # Each line is a separate piece of information added by the user
                clinic_lines = []
                for info_line in office_info:
                    if isinstance(info_line, str) and info_line.strip():
                        clinic_lines.append(info_line.strip())
                
                # Store all lines for display in template
                if clinic_lines:
                    clinic_info['lines'] = clinic_lines
                    # For compatibility, also set individual fields if we can detect them
                    for line in clinic_lines:
                        line_lower = line.lower()
                        if '@' in line and '.' in line and not clinic_info.get('email'):
                            # Detect email addresses
                            clinic_info['email'] = line.strip()
                        elif any(word in line_lower for word in ['phone', 'tel', 'call']) and not clinic_info.get('phone'):
                            # Detect phone numbers
                            clinic_info['phone'] = line.strip()
                        elif any(word in line_lower for word in ['fax']) and not clinic_info.get('fax'):
                            # Detect fax numbers
                            clinic_info['fax'] = line.strip()
                        elif not clinic_info.get('name'):
                            # First non-email/phone line is likely the clinic name
                            clinic_info['name'] = line.strip()
                        elif not clinic_info.get('address') and any(word in line_lower for word in ['street', 'st', 'avenue', 'ave', 'boulevard', 'blvd', 'road', 'rd', 'drive', 'dr', 'lane', 'ln']) or any(char.isdigit() for char in line):
                            # Lines with street indicators or numbers are likely addresses
                            clinic_info['address'] = line.strip()
                
                # Log what we extracted
                logger.info(f"Extracted clinic info: {clinic_info}")
            
            return clinic_info
            
        except Exception as e:
            logger.error(f"Error fetching clinic info for user {user_id}: {e}")
            return {}
    
    def _is_re_evaluation_data(self, data: Dict[str, Any]) -> bool:
        """Determine if this data represents a re-evaluation visit using explicit evaluation_type"""
        # Check for explicit evaluation_type field (most reliable)
        evaluation_type = data.get('evaluation_type')
        logger.info(f"🔍 Detection check - evaluation_type: '{evaluation_type}' (type: {type(evaluation_type)})")
        
        if evaluation_type == 're_evaluation':
            logger.info("✅ Detected as re-evaluation via evaluation_type field")
            return True
        
        # Fallback: check for comparison format in text (for backward compatibility)
        sections = data.get('sections', {})
        logger.info(f"🔍 Checking sections for fallback detection: {list(sections.keys())}")
        
        for section_name, section_content in sections.items():
            if isinstance(section_content, str):
                # Check for pipe format: "Previously X | Currently Y"
                if 'Previously' in section_content and 'Currently' in section_content and '|' in section_content:
                    logger.info(f"✅ Detected as re-evaluation via pipe format in {section_name}")
                    return True
                # Check for colon format: "Previously: X" and "Currently: Y"
                if 'Previously:' in section_content and 'Currently:' in section_content:
                    logger.info(f"✅ Detected as re-evaluation via colon format in {section_name}")
                    return True
        
        logger.info("❌ Not detected as re-evaluation")
        return False
    
    async def generate_pdf(self, data: Dict[str, Any], user_id: Optional[str] = None) -> bytes:
        """Generate PDF from structured medical data using WeasyPrint"""
        # Ensure data is not None
        if data is None:
            data = {}
        
        logger.info(f"WeasyPrint PDF generation started with data keys: {list(data.keys())}")
        
        # Automatically fetch and inject clinic info if user_id is provided
        if user_id and not data.get('clinic_info'):
            clinic_info = await self._get_clinic_info_from_database(user_id)
            if clinic_info:
                data['clinic_info'] = clinic_info
                logger.info(f"Injected clinic info from database: {clinic_info}")
            else:
                logger.warning(f"No clinic info found for user {user_id}")
        elif data.get('clinic_info'):
            logger.info(f"Using provided clinic info: {data['clinic_info']}")
        else:
            logger.warning("No clinic info available - no user_id provided and no clinic_info in data")
        
        # Check if this is a re-evaluation and use Jinja2 template
        is_re_eval = self._is_re_evaluation_data(data)
        has_jinja = self.jinja_env is not None
        logger.info(f"Re-evaluation detection: {is_re_eval}, Jinja2 available: {has_jinja}")
        
        # Additional debugging for template path
        if has_jinja:
            current_dir = Path(__file__).parent
            templates_dir = current_dir / "jinja_templates" 
            re_eval_template_file = templates_dir / "re_evaluation_template.html"
            initial_template_file = templates_dir / "initial_exam_template.html"
            logger.info(f"🔍 Re-eval template exists: {re_eval_template_file.exists()}")
            logger.info(f"🔍 Initial template exists: {initial_template_file.exists()}")
        else:
            logger.error("❌ Jinja2 environment is None - template setup failed")
        
        if has_jinja:
            try:
                if is_re_eval:
                    logger.info("✅ Using Jinja2 re-evaluation template")
                    html_content = self._generate_re_evaluation_html(data)
                else:
                    logger.info("✅ Using Jinja2 initial exam template")
                    html_content = self._generate_initial_exam_html(data)
                css_content = get_medical_document_css(self._get_besley_font_path())
            except Exception as e:
                logger.error(f"❌ Error with Jinja2 template, falling back to standard template: {e}")
                html_content = self.html_template.generate_html(data)
                css_content = get_medical_document_css(self._get_besley_font_path())
        else:
            # Use standard string concatenation template
            logger.info("📄 Using standard HTML template (Jinja2 not available)")
            html_content = self.html_template.generate_html(data)
            css_content = get_medical_document_css(self._get_besley_font_path())
        
        # Create PDF in memory
        buffer = io.BytesIO()
        
        # Generate PDF with WeasyPrint
        html = HTML(string=html_content)
        css = CSS(string=css_content, font_config=self.font_config)
        
        # Write PDF to buffer
        html.write_pdf(buffer, stylesheets=[css], font_config=self.font_config)
        
        # Return PDF bytes
        buffer.seek(0)
        return buffer.read()
    
    def _generate_re_evaluation_html(self, data: Dict[str, Any]) -> str:
        """Generate HTML using Jinja2 re-evaluation template"""
        if not self.jinja_env:
            raise Exception("Jinja2 environment not initialized")
        
        # Load the re-evaluation template
        template = self.jinja_env.get_template('re_evaluation_template.html')
        
        # Get CSS content for embedding in template
        besley_font_path = self._get_besley_font_path()
        css_styles = get_re_evaluation_css(besley_font_path)
        
        # Render the template with data and CSS
        html_content = template.render(
            data=data,
            css_styles=css_styles
        )
        
        return html_content
    
    def _generate_initial_exam_html(self, data: Dict[str, Any]) -> str:
        """Generate HTML using Jinja2 initial exam template"""
        if not self.jinja_env:
            raise Exception("Jinja2 environment not initialized")
        
        # Load the initial exam template
        template = self.jinja_env.get_template('initial_exam_template.html')
        
        # Get CSS content for embedding in template
        besley_font_path = self._get_besley_font_path()
        css_styles = get_medical_document_css(besley_font_path)
        
        # Render the template with data and CSS
        html_content = template.render(
            data=data,
            css_styles=css_styles
        )
        
        return html_content
    
    def _generate_multi_visit_html(self, visits_data: list, patient_name: str) -> str:
        """Generate multi-visit HTML using new Jinja2 template system"""
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
            # Convert to dict if needed
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
            
            # Visit date header with proper formatting - only for visits that don't have their own headers
            # Skip date header for initial exams and re-evaluations when using Jinja2 templates (they include their own)
            should_add_date_header = True
            if visit_type == 'initial' and self.jinja_env:
                should_add_date_header = False  # Jinja2 initial template has its own header
            elif visit_type == 're_evaluation' and self.jinja_env:
                should_add_date_header = False  # Jinja2 re-evaluation template has its own header
            
            if should_add_date_header and visit_date:
                count = visit_counters.get(visit_type, 1)
                date_header = self._format_visit_date(visit_date, visit_type, count)
                html_parts.append(f'<div class="visit-date-header"><h3>{date_header}</h3></div>')
            
            # Generate visit content based on type and template availability
            if visit_type == 'follow_up':
                # Use legacy template for follow-up visits (narrative content)
                html_parts.append(self._generate_follow_up_content(data))
            elif visit_type == 're_evaluation' and self.jinja_env:
                # Use Jinja2 re-evaluation template
                try:
                    # Remove clinic info to avoid duplication in multi-visit
                    data_without_clinic = {k: v for k, v in data.items() if k != 'clinic_info'}
                    html_parts.append(self._generate_re_evaluation_content_for_multi_visit(data_without_clinic))
                except Exception as e:
                    logger.error(f"Error generating re-evaluation content: {e}, falling back to legacy")
                    html_parts.append(self._generate_legacy_visit_content(data))
            elif visit_type == 'initial' and self.jinja_env:
                # Use Jinja2 initial exam template
                try:
                    # For initial visits, only include clinic info if it's the first visit
                    if i == 0:
                        html_parts.append(self._generate_initial_exam_content_for_multi_visit(data))
                    else:
                        # Remove clinic info to avoid duplication
                        data_without_clinic = {k: v for k, v in data.items() if k != 'clinic_info'}
                        html_parts.append(self._generate_initial_exam_content_for_multi_visit(data_without_clinic))
                except Exception as e:
                    logger.error(f"Error generating initial exam content: {e}, falling back to legacy")
                    html_parts.append(self._generate_legacy_visit_content(data))
            else:
                # Fallback to legacy template
                html_parts.append(self._generate_legacy_visit_content(data))
            
            # End visit container
            html_parts.append('</div>')
            
            # Add page break only between different initial visits
            if i < len(sorted_visits) - 1:
                next_visit_data = sorted_visits[i + 1]
                next_data = next_visit_data.model_dump() if hasattr(next_visit_data, 'model_dump') else next_visit_data
                next_visit_type = self._determine_visit_type(next_data)
                
                if visit_type == 'initial' and next_visit_type == 'initial':
                    html_parts.append('<div class="page-break"></div>')
        
        # HTML document end
        html_parts.append(self._get_html_footer())
        
        return ''.join(html_parts)
    
    def _generate_initial_exam_content_for_multi_visit(self, data: Dict[str, Any]) -> str:
        """Generate initial exam content for multi-visit PDF using Jinja2 template"""
        if not self.jinja_env:
            raise Exception("Jinja2 environment not initialized")
        
        # Load the initial exam template
        template = self.jinja_env.get_template('initial_exam_template.html')
        
        # Get CSS content for embedding in template
        besley_font_path = self._get_besley_font_path()
        css_styles = get_medical_document_css(besley_font_path)
        
        # Render just the body content (no full HTML document structure)
        html_content = template.render(
            data=data,
            css_styles=css_styles
        )
        
        # Extract only the body content (remove html, head, body tags)
        import re
        body_match = re.search(r'<body[^>]*>(.*?)</body>', html_content, re.DOTALL)
        if body_match:
            return body_match.group(1)
        else:
            return html_content
    
    def _generate_re_evaluation_content_for_multi_visit(self, data: Dict[str, Any]) -> str:
        """Generate re-evaluation content for multi-visit PDF using Jinja2 template"""
        if not self.jinja_env:
            raise Exception("Jinja2 environment not initialized")
        
        # Load the re-evaluation template
        template = self.jinja_env.get_template('re_evaluation_template.html')
        
        # Get CSS content for embedding in template
        besley_font_path = self._get_besley_font_path()
        css_styles = get_re_evaluation_css(besley_font_path)
        
        # Render just the body content (no full HTML document structure)
        html_content = template.render(
            data=data,
            css_styles=css_styles
        )
        
        # Extract only the body content (remove html, head, body tags)
        import re
        body_match = re.search(r'<body[^>]*>(.*?)</body>', html_content, re.DOTALL)
        if body_match:
            return body_match.group(1)
        else:
            return html_content
    
    def _generate_follow_up_content(self, data: Dict[str, Any]) -> str:
        """Generate follow-up content (narrative style)"""
        sections = data.get('sections', {})
        content_html = ''
        
        # For follow-up visits, render narrative content without section headers
        for section_key, section_content in sections.items():
            if isinstance(section_content, str) and section_content.strip():
                # Format as narrative paragraphs
                paragraphs = section_content.split('\n\n')
                for para in paragraphs:
                    if para.strip():
                        content_html += f'<p class="narrative-content">{html.escape(para.strip())}</p>\n'
        
        return content_html
    
    def _generate_legacy_visit_content(self, data: Dict[str, Any]) -> str:
        """Generate visit content using legacy HTML template system"""
        # Use the legacy HTML template system as fallback
        sections = data.get('sections', {})
        content_html = ''
        
        # Process sections in standard order
        for section_key, section_content in sections.items():
            if isinstance(section_content, str) and section_content.strip():
                # Format section title
                display_title = section_key.replace('_', ' ').upper()
                content_html += f'<div class="section">\n'
                content_html += f'<h2 class="section-header">{html.escape(display_title)}:</h2>\n'
                content_html += f'<p class="section-content">{html.escape(section_content)}</p>\n'
                content_html += '</div>\n'
        
        return content_html
    
    # Helper methods for multi-visit processing
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
        
        return sorted(visits_data, key=get_visit_date)
    
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
    
    async def generate_from_transcript(self, transcript: str, format_type: str = "markdown", user_id: Optional[str] = None) -> bytes:
        """Generate PDF from transcript text"""
        if format_type == "structured":
            # Parse structured JSON format
            import json
            data = json.loads(transcript)
        else:
            # Convert markdown to structured format
            data = self._convert_markdown_to_structured(transcript)
        
        return await self.generate_pdf(data, user_id=user_id)
    
    def _convert_markdown_to_structured(self, markdown_text: str) -> Dict[str, Any]:
        """Convert markdown text to structured format"""
        # This is a simplified conversion - in production, you'd want more robust parsing
        data = {
            'patient_info': {},
            'sections': {},
            'motor_exam': None,
            'reflexes': None
        }
        
        # Extract patient info from markdown
        lines = markdown_text.split('\n')
        current_section = None
        section_content = []
        
        for line in lines:
            # Check for patient info patterns
            if 'Patient Name:' in line:
                data['patient_info']['patient_name'] = line.split(':', 1)[1].strip()
            elif 'Date of Birth:' in line:
                data['patient_info']['date_of_birth'] = line.split(':', 1)[1].strip()
            elif 'Date of Accident:' in line:
                data['patient_info']['date_of_accident'] = line.split(':', 1)[1].strip()
            elif 'Date of Treatment:' in line:
                data['patient_info']['date_of_treatment'] = line.split(':', 1)[1].strip()
            
            # Check for section headers
            elif line.startswith('## '):
                # Save previous section
                if current_section and section_content:
                    data['sections'][current_section] = '\n'.join(section_content)
                    section_content = []
                
                # Start new section
                current_section = line[3:].strip().lower().replace(' ', '_')
            
            # Add content to current section
            elif current_section and line.strip():
                section_content.append(line)
        
        # Save last section
        if current_section and section_content:
            data['sections'][current_section] = '\n'.join(section_content)
        
        return data
    
    async def generate_multi_visit_pdf(self, visits_data: list, patient_name: str, user_id: Optional[str] = None) -> bytes:
        """Generate PDF from multiple medical visits using WeasyPrint"""
        if not visits_data:
            raise ValueError("No visits data provided")
        
        logger.info(f"WeasyPrint multi-visit PDF generation started for {len(visits_data)} visits")
        
        # Automatically fetch and inject clinic info ONLY for the first visit if user_id is provided
        if user_id:
            clinic_info = await self._get_clinic_info_from_database(user_id)
            if clinic_info:
                # Only add clinic info to the first visit to avoid redundancy
                if visits_data and not visits_data[0].get('clinic_info'):
                    visits_data[0]['clinic_info'] = clinic_info
                    logger.info(f"Injected clinic info into FIRST visit only for multi-visit PDF")
                
                # Ensure other visits don't have clinic info to avoid duplication
                for i, visit_data in enumerate(visits_data[1:], 1):
                    if visit_data.get('clinic_info'):
                        del visit_data['clinic_info']
                        logger.info(f"Removed clinic info from visit #{i+1} to avoid duplication")
            else:
                logger.warning(f"No clinic info found for user {user_id}")
        else:
            logger.warning("No user_id provided for multi-visit PDF generation")
        
        # Generate combined HTML content for all visits using new template system
        combined_html_content = self._generate_multi_visit_html(visits_data, patient_name)
        
        # Get font path for CSS
        besley_font_path = self._get_besley_font_path()
        
        # Use re-evaluation CSS which includes all styles needed for multi-visit with re-evaluations
        css_content = get_re_evaluation_css(besley_font_path)
        
        # Create PDF in memory
        buffer = io.BytesIO()
        
        # Generate PDF with WeasyPrint
        html = HTML(string=combined_html_content)
        css = CSS(string=css_content, font_config=self.font_config)
        
        # Write PDF to buffer
        html.write_pdf(buffer, stylesheets=[css], font_config=self.font_config)
        
        # Return PDF bytes
        buffer.seek(0)
        return buffer.read()