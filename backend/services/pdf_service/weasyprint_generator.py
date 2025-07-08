import io
import os
import re
from pathlib import Path
from typing import Dict, Any, Optional
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
from jinja2 import Environment, FileSystemLoader
from .html_templates import MedicalDocumentHTMLTemplate
from .css_styles import get_medical_document_css, get_re_evaluation_css
import logging

logger = logging.getLogger(__name__)

class WeasyPrintMedicalPDFGenerator:
    def __init__(self):
        self.html_template = MedicalDocumentHTMLTemplate()
        self.font_config = FontConfiguration()
        self._register_fonts()
        self._setup_jinja_environment()
    
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
    
    def generate_pdf(self, data: Dict[str, Any]) -> bytes:
        """Generate PDF from structured medical data using WeasyPrint"""
        # Ensure data is not None
        if data is None:
            data = {}
        
        logger.info(f"WeasyPrint PDF generation started with data keys: {list(data.keys())}")
        
        # Check if this is a re-evaluation and use Jinja2 template
        is_re_eval = self._is_re_evaluation_data(data)
        has_jinja = self.jinja_env is not None
        logger.info(f"Re-evaluation detection: {is_re_eval}, Jinja2 available: {has_jinja}")
        
        # Additional debugging for template path
        if has_jinja:
            current_dir = Path(__file__).parent
            templates_dir = current_dir / "jinja_templates" 
            template_file = templates_dir / "re_evaluation_template.html"
            logger.info(f"🔍 Template file exists: {template_file.exists()} at {template_file}")
        else:
            logger.error("❌ Jinja2 environment is None - template setup failed")
        
        if is_re_eval and has_jinja:
            try:
                logger.info("✅ Using Jinja2 re-evaluation template")
                html_content = self._generate_re_evaluation_html(data)
                css_content = get_re_evaluation_css(self._get_besley_font_path())
            except Exception as e:
                logger.error(f"❌ Error with Jinja2 template, falling back to standard template: {e}")
                html_content = self.html_template.generate_html(data)
                css_content = get_medical_document_css(self._get_besley_font_path())
        else:
            # Use standard string concatenation template
            if not is_re_eval:
                logger.info("📄 Using standard HTML template (not detected as re-evaluation)")
            else:
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
    
    def generate_from_transcript(self, transcript: str, format_type: str = "markdown") -> bytes:
        """Generate PDF from transcript text"""
        if format_type == "structured":
            # Parse structured JSON format
            import json
            data = json.loads(transcript)
        else:
            # Convert markdown to structured format
            data = self._convert_markdown_to_structured(transcript)
        
        return self.generate_pdf(data)
    
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
    
    def generate_multi_visit_pdf(self, visits_data: list, patient_name: str) -> bytes:
        """Generate PDF from multiple medical visits using WeasyPrint"""
        if not visits_data:
            raise ValueError("No visits data provided")
        
        logger.info(f"WeasyPrint multi-visit PDF generation started for {len(visits_data)} visits")
        
        # Generate combined HTML content for all visits
        combined_html_content = self.html_template.generate_multi_visit_html(visits_data, patient_name)
        
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