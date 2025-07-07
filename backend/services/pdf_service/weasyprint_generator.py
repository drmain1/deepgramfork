import io
import os
from pathlib import Path
from typing import Dict, Any, Optional
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
from .html_templates import MedicalDocumentHTMLTemplate
from .css_styles import get_medical_document_css
import logging

logger = logging.getLogger(__name__)

class WeasyPrintMedicalPDFGenerator:
    def __init__(self):
        self.html_template = MedicalDocumentHTMLTemplate()
        self.font_config = FontConfiguration()
        self._register_fonts()
    
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
    
    def generate_pdf(self, data: Dict[str, Any]) -> bytes:
        """Generate PDF from structured medical data using WeasyPrint"""
        # Ensure data is not None
        if data is None:
            data = {}
        
        logger.info(f"WeasyPrint PDF generation started with data keys: {list(data.keys())}")
        
        # Generate HTML content
        html_content = self.html_template.generate_html(data)
        
        # Get font path for CSS
        besley_font_path = self._get_besley_font_path()
        
        # Get CSS styles with font path
        css_content = get_medical_document_css(besley_font_path)
        
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
        
        # Get CSS styles with font path
        css_content = get_medical_document_css(besley_font_path)
        
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