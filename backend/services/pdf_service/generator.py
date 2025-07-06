import io
from typing import Dict, List, Any, Optional
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, PageTemplate, Frame
from reportlab.lib.units import inch
from datetime import datetime
from .styles import PDFStyles
from .table_builder import TableBuilder
from .templates import MedicalDocumentTemplate

class MedicalPDFGenerator:
    def __init__(self):
        self.styles = PDFStyles()
        self.table_builder = TableBuilder(self.styles)
        self.template = MedicalDocumentTemplate(self.styles, self.table_builder)
        self.page_info = {}  # Store page info for footer
    
    def _add_page_number(self, canvas, doc):
        """Add page number footer to each page"""
        canvas.saveState()
        
        # Get page dimensions
        page_width = letter[0]
        page_height = letter[1]
        
        # Set page background color (from old workflow: #fcfcfa)
        canvas.setFillColorRGB(0.988, 0.988, 0.980)  # #fcfcfa
        canvas.rect(0, 0, page_width, page_height, fill=1, stroke=0)
        
        # Footer text
        page_num = canvas.getPageNumber()
        footer_text = f"Page {page_num} of {self.page_info.get('total_pages', '?')}"
        
        # Add doctor name if on last page
        if self.page_info.get('doctor_name') and page_num == self.page_info.get('total_pages'):
            footer_text += f" | {self.page_info['doctor_name']}"
        
        # Draw footer
        canvas.setFont("Besley", self.styles.footerFontSize)  # 10px
        canvas.setFillColorRGB(0.2, 0.2, 0.2)  # #333333
        
        # Draw separator line
        canvas.setStrokeColorRGB(0.913, 0.925, 0.937)  # #e9ecef
        canvas.line(0.75*inch, 0.65*inch, page_width - 0.75*inch, 0.65*inch)
        
        # Draw text centered
        canvas.drawCentredString(page_width / 2, 0.5*inch, footer_text)
        
        canvas.restoreState()
    
    def generate_pdf(self, data: Dict[str, Any]) -> bytes:
        """Generate PDF from structured medical data"""
        # Ensure data is not None
        if data is None:
            data = {}
        
        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"PDF generation started with data keys: {list(data.keys())}")
        
        # Extract doctor name if available
        provider_info = data.get('provider_info', {})
        self.page_info['doctor_name'] = provider_info.get('name', '') if provider_info else ''
        
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=0.75*inch,
            bottomMargin=1*inch  # Increased bottom margin for footer
        )
        
        # Build document elements
        elements = []
        
        # Add clinic header if available
        if clinic_info := data.get('clinic_info'):
            header_elements = self.template.create_header(clinic_info)
            elements.extend(header_elements)
            logger.info(f"Added {len(header_elements)} header elements")
        
        # Add patient information
        if patient_info := data.get('patient_info'):
            patient_elements = self.template.create_patient_info(patient_info)
            elements.extend(patient_elements)
            logger.info(f"Added {len(patient_elements)} patient info elements")
        
        # Add document sections
        if sections := data.get('sections'):
            logger.info(f"Processing {len(sections)} sections")
            for section_title, section_content in sections.items():
                if isinstance(section_content, str) and section_content.strip():
                    # Format section title for display
                    display_title = section_title.replace('_', ' ').upper()
                    section_elements = self.template.create_section(display_title, section_content)
                    elements.extend(section_elements)
                    logger.info(f"Added section '{display_title}' with {len(section_elements)} elements")
        
        # Add motor examination if available
        if motor_exam := data.get('motor_exam'):
            elements.extend(self.template.create_motor_exam_section(motor_exam))
        
        # Add reflex examination if available
        if reflexes := data.get('reflexes'):
            elements.extend(self.template.create_reflex_section(reflexes))
        
        # Add signature section
        if provider_info := data.get('provider_info'):
            elements.extend(self.template.create_signature_section(provider_info))
        
        logger.info(f"Total elements to be added to PDF: {len(elements)}")
        
        if not elements:
            # Add at least one element to avoid empty PDF
            elements.append(Paragraph("No content available", self.styles.styles['Normal']))
        
        # Build PDF with page numbers
        # For now, we'll use a simple approach without pre-counting pages
        self.page_info['total_pages'] = '?'  # Will be updated in a future version
        
        doc.build(elements, onFirstPage=self._add_page_number, onLaterPages=self._add_page_number)
        
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
    
    def add_image(self, elements: List, image_path: str, width: float = None, height: float = None):
        """Add an image to the PDF"""
        try:
            from reportlab.platypus import Image
            from PIL import Image as PILImage
            
            # Open image to get dimensions
            with PILImage.open(image_path) as img:
                img_width, img_height = img.size
                aspect_ratio = img_height / img_width
            
            # Calculate dimensions
            if width and not height:
                height = width * aspect_ratio
            elif height and not width:
                width = height / aspect_ratio
            elif not width and not height:
                width = 2 * inch
                height = width * aspect_ratio
            
            # Create ReportLab image
            rl_image = Image(image_path, width=width, height=height)
            elements.append(rl_image)
            
        except Exception as e:
            print(f"Error adding image: {e}")
    
    def create_watermark(self, canvas, doc):
        """Add watermark to each page"""
        # This can be used for DRAFT watermarks or clinic logos
        pass