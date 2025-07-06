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
        """Register Besley font family"""
        import os
        from pathlib import Path
        
        try:
            # Get the fonts directory path
            current_dir = Path(__file__).parent.parent.parent  # Go up to backend dir
            fonts_dir = current_dir / "fonts"
            
            # Register Besley font
            besley_path = fonts_dir / "Besley-Regular.ttf"
            if besley_path.exists():
                # Register the variable font
                from reportlab.pdfbase.ttfonts import TTFont
                
                # Register regular weight (400)
                regular_font = TTFont('Besley', str(besley_path))
                pdfmetrics.registerFont(regular_font)
                
                # For bold, we'll use the same font file but ReportLab doesn't directly support variable fonts
                # So we register it as a separate font name
                bold_font = TTFont('Besley-Bold', str(besley_path))
                pdfmetrics.registerFont(bold_font)
                
                # Register the font family
                registerFontFamily('Besley',
                                 normal='Besley',
                                 bold='Besley-Bold',
                                 italic='Besley',
                                 boldItalic='Besley-Bold')
                
                print(f"Besley font registered successfully from {besley_path}")
            else:
                print(f"Besley font not found at {besley_path}, using Helvetica fallback")
        except Exception as e:
            print(f"Could not register Besley font: {e}, using Helvetica fallback")
    
    def _create_custom_styles(self):
        # Main header style (for clinic name)
        self.styles.add(ParagraphStyle(
            name='Header',
            parent=self.styles['Heading1'],
            fontSize=self.headerFontSize,  # 14px
            textColor=colors.HexColor(self.headerColor),  # #000000
            alignment=TA_CENTER,
            spaceAfter=12,
            fontName='Besley-Bold',
            leading=self.headerFontSize * self.lineHeight
        ))
        
        # Section headers - matching old style
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=self.fontSize + 1,  # 12px for headers
            textColor=colors.HexColor(self.textColor),  # #000000
            alignment=TA_LEFT,
            spaceAfter=8,
            spaceBefore=15,
            fontName='Helvetica-Bold',  # Will use Besley-Bold when available
            leading=(self.fontSize + 1) * 1.2,
            keepWithNext=True
        ))
        
        # Normal body text - matching old style exactly
        self.styles.add(ParagraphStyle(
            name='NormalText',
            parent=self.styles['Normal'],
            fontSize=self.fontSize,  # 11px
            alignment=TA_LEFT,  # Left aligned like old style
            spaceAfter=8,  # Increased spacing
            spaceBefore=2,
            textColor=colors.HexColor(self.textColor),  # #000000
            fontName='Besley',
            leading=self.fontSize * self.lineHeight,  # 15.4px (11 * 1.4)
            wordWrap='LTR',
            splitLongWords=True,
            leftIndent=0,
            rightIndent=0,
            firstLineIndent=0,
            bulletFontName='Besley',
            bulletFontSize=self.fontSize,
            bulletIndent=0
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
            fontName='Besley',
            leading=self.fontSize * 1.2
        ))
        
        # Footer style for page numbers
        self.styles.add(ParagraphStyle(
            name='Footer',
            parent=self.styles['Normal'],
            fontSize=self.footerFontSize,  # 10px
            textColor=colors.HexColor(self.footerColor),  # #333333
            alignment=TA_CENTER,
            fontName='Besley',
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
            ('FONTNAME', (0, 0), (-1, 0), 'Besley-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), self.fontSize),  # 11px
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            
            # Data cells styling
            ('FONTNAME', (0, 1), (-1, -1), 'Besley'),
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
            ('FONTNAME', (0, 0), (-1, 0), 'Besley-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            
            # Data cells
            ('FONTNAME', (0, 1), (-1, -1), 'Besley'),
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