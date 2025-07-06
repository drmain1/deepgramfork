from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

class PDFStyles:
    def __init__(self):
        # Old PDF workflow settings - define these first
        self.fontSize = 11
        self.headerFontSize = 14
        self.footerFontSize = 10
        self.lineHeight = 1.4
        self.backgroundColor = '#fcfcfa'
        self.textColor = '#000000'
        self.headerColor = '#000000'
        self.footerColor = '#333333'
        
        # Initialize styles
        self.styles = getSampleStyleSheet()
        self._register_fonts()
        self._create_custom_styles()
    
    def _register_fonts(self):
        """Register Besley font family - using Helvetica as fallback for now"""
        # Note: In production, you would need to add Besley font files
        # For now, we'll map to similar fonts and update font references
        try:
            # This is where you'd register actual Besley fonts if available
            # pdfmetrics.registerFont(TTFont('Besley', 'path/to/Besley-Regular.ttf'))
            # pdfmetrics.registerFont(TTFont('Besley-Bold', 'path/to/Besley-Bold.ttf'))
            # registerFontFamily('Besley', normal='Besley', bold='Besley-Bold')
            pass
        except:
            pass
    
    def _create_custom_styles(self):
        # Main header style (for clinic name)
        self.styles.add(ParagraphStyle(
            name='Header',
            parent=self.styles['Heading1'],
            fontSize=self.headerFontSize,  # 14px
            textColor=colors.HexColor(self.headerColor),  # #000000
            alignment=TA_CENTER,
            spaceAfter=12,
            fontName='Helvetica-Bold',  # Will use Besley when available
            leading=self.headerFontSize * self.lineHeight
        ))
        
        # Section headers
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=self.fontSize,  # 11px
            textColor=colors.HexColor(self.textColor),  # #000000
            alignment=TA_LEFT,
            spaceAfter=10,
            spaceBefore=10,
            fontName='Helvetica-Bold',  # Will use Besley-Bold when available
            leading=self.fontSize * self.lineHeight
        ))
        
        # Normal body text
        self.styles.add(ParagraphStyle(
            name='NormalText',
            parent=self.styles['Normal'],
            fontSize=self.fontSize,  # 11px
            alignment=TA_LEFT,  # Changed from JUSTIFY to match old style
            spaceAfter=6,
            textColor=colors.HexColor(self.textColor),  # #000000
            fontName='Helvetica',  # Will use Besley when available
            leading=self.fontSize * self.lineHeight,  # 1.4 line height
            wordWrap='LTR',
            splitLongWords=True
        ))
        
        # Table header style
        self.styles.add(ParagraphStyle(
            name='TableHeader',
            parent=self.styles['Normal'],
            fontSize=self.fontSize,  # 11px
            textColor=colors.whitesmoke,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',  # Will use Besley-Bold when available
            leading=self.fontSize * 1.2
        ))
        
        # Table cell style
        self.styles.add(ParagraphStyle(
            name='TableCell',
            parent=self.styles['Normal'],
            fontSize=self.fontSize,  # 11px
            alignment=TA_CENTER,
            fontName='Helvetica',  # Will use Besley when available
            leading=self.fontSize * 1.2
        ))
        
        # Footer style for page numbers
        self.styles.add(ParagraphStyle(
            name='Footer',
            parent=self.styles['Normal'],
            fontSize=self.footerFontSize,  # 10px
            textColor=colors.HexColor(self.footerColor),  # #333333
            alignment=TA_CENTER,
            fontName='Helvetica',  # Will use Besley when available
            leading=self.footerFontSize * 1.2
        ))
    
    @property
    def table_style(self):
        """Enhanced table styling matching old PDF workflow"""
        return [
            # Header row styling
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), self.fontSize),  # 11px
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            
            # Data cells styling
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), self.fontSize),  # 11px
            ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            
            # Grid and borders
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.black),
            
            # Cell padding
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            
            # Vertical alignment
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Alternating row colors (subtle)
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ]
    
    @property
    def compact_table_style(self):
        """Compact table style for smaller tables"""
        return [
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6c757d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            
            # Data cells
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Compact padding
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]