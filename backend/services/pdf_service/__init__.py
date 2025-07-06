from .weasyprint_generator import WeasyPrintMedicalPDFGenerator
from .html_templates import MedicalDocumentHTMLTemplate
from .css_styles import get_medical_document_css

# Legacy ReportLab components (keeping for reference but not actively used)
# from .generator import MedicalPDFGenerator
# from .templates import MedicalDocumentTemplate
# from .table_builder import TableBuilder
# from .styles import PDFStyles

__all__ = ['WeasyPrintMedicalPDFGenerator', 'MedicalDocumentHTMLTemplate', 'get_medical_document_css']