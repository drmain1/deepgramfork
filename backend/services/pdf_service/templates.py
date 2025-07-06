from reportlab.platypus import Paragraph, Spacer, PageBreak
from reportlab.lib.units import inch
from typing import Dict, List, Any
from .styles import PDFStyles
from .table_builder import TableBuilder

class MedicalDocumentTemplate:
    def __init__(self, styles: PDFStyles, table_builder: TableBuilder):
        self.styles = styles
        self.table_builder = table_builder
    
    def create_header(self, clinic_info: Dict[str, str]) -> List:
        """Create document header with clinic information"""
        elements = []
        
        # Ensure clinic_info is not None
        if not clinic_info:
            return elements
        
        # Clinic name
        if clinic_name := clinic_info.get('name'):
            elements.append(Paragraph(clinic_name, self.styles.styles['Header']))
        
        # Clinic address
        if address := clinic_info.get('address'):
            elements.append(Paragraph(address, self.styles.styles['Normal']))
        
        # Phone/Fax
        contact_info = []
        if phone := clinic_info.get('phone'):
            contact_info.append(f"Phone: {phone}")
        if fax := clinic_info.get('fax'):
            contact_info.append(f"Fax: {fax}")
        
        if contact_info:
            elements.append(Paragraph(" | ".join(contact_info), self.styles.styles['Normal']))
        
        elements.append(Spacer(1, 0.3*inch))
        return elements
    
    def create_patient_info(self, patient_data: Dict[str, str]) -> List:
        """Create patient information section"""
        elements = []
        
        # Ensure patient_data is not None
        if not patient_data:
            return elements
        
        # Format patient info in the old style (not as a table)
        info_lines = []
        
        if name := patient_data.get('patient_name'):
            info_lines.append(f"Patient Name: {name}")
        if dob := patient_data.get('date_of_birth'):
            info_lines.append(f"Date of Birth: {dob}")
        if doa := patient_data.get('date_of_accident'):
            info_lines.append(f"Date of Accident: {doa}")
        if dot := patient_data.get('date_of_treatment'):
            info_lines.append(f"Date of Treatment: {dot}")
        
        # Create a single paragraph with line breaks
        if info_lines:
            patient_info_text = "<br/>".join(info_lines)
            elements.append(Paragraph(patient_info_text, self.styles.styles['NormalText']))
            elements.append(Spacer(1, 0.3*inch))
        
        return elements
    
    def create_section(self, title: str, content: str) -> List:
        """Create a standard text section"""
        elements = []
        
        # Section header
        elements.append(Paragraph(title, self.styles.styles['SectionHeader']))
        
        # Section content - handle multiple paragraphs
        paragraphs = content.split('\n\n')
        for para in paragraphs:
            if para.strip():
                elements.append(Paragraph(para.strip(), self.styles.styles['NormalText']))
        
        elements.append(Spacer(1, 0.1*inch))
        return elements
    
    def create_motor_exam_section(self, motor_data: Dict[str, List]) -> List:
        """Create motor examination section with tables"""
        elements = []
        
        elements.append(Paragraph("MOTOR EXAMINATION", self.styles.styles['SectionHeader']))
        
        # Upper extremity
        if upper_data := motor_data.get('upper_extremity'):
            elements.append(Paragraph("Upper Extremity Motor Strength", self.styles.styles['NormalText']))
            elements.extend(self.table_builder.create_motor_strength_table(upper_data, "Upper Extremity", "upper"))
            elements.append(Spacer(1, 0.1*inch))
        
        # Lower extremity
        if lower_data := motor_data.get('lower_extremity'):
            elements.append(Paragraph("Lower Extremity Motor Strength", self.styles.styles['NormalText']))
            elements.extend(self.table_builder.create_motor_strength_table(lower_data, "Lower Extremity", "lower"))
            elements.append(Spacer(1, 0.1*inch))
        
        return elements
    
    def create_reflex_section(self, reflex_data: Dict[str, List]) -> List:
        """Create reflex examination section with tables"""
        elements = []
        
        elements.append(Paragraph("REFLEX EXAMINATION", self.styles.styles['SectionHeader']))
        
        # Deep tendon reflexes
        if dtr_data := reflex_data.get('deep_tendon'):
            elements.append(Paragraph("Deep Tendon Reflexes", self.styles.styles['NormalText']))
            elements.extend(self.table_builder.create_reflex_table(dtr_data, "Deep Tendon Reflexes"))
            elements.append(Spacer(1, 0.1*inch))
        
        # Pathological reflexes
        if path_data := reflex_data.get('pathological'):
            elements.append(Paragraph("Pathological Reflexes", self.styles.styles['NormalText']))
            elements.extend(self.table_builder.create_reflex_table(path_data, "Pathological Reflexes"))
            elements.append(Spacer(1, 0.1*inch))
        
        return elements
    
    def create_signature_section(self, provider_info: Dict[str, str]) -> List:
        """Create signature section"""
        elements = []
        
        elements.append(Spacer(1, 0.5*inch))
        
        # Signature line
        elements.append(Paragraph("_" * 40, self.styles.styles['Normal']))
        
        # Provider name and credentials
        if provider_name := provider_info.get('name'):
            elements.append(Paragraph(provider_name, self.styles.styles['Normal']))
        
        if credentials := provider_info.get('credentials'):
            elements.append(Paragraph(credentials, self.styles.styles['Normal']))
        
        # Date line
        elements.append(Spacer(1, 0.2*inch))
        elements.append(Paragraph(f"Date: {'_' * 20}", self.styles.styles['Normal']))
        
        return elements