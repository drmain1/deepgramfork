from reportlab.platypus import Table, TableStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from typing import List, Dict, Any
from .styles import PDFStyles

class TableBuilder:
    def __init__(self, styles: PDFStyles):
        self.styles = styles
    
    def create_motor_strength_table(self, data: List[Dict[str, str]], title: str, section: str = "upper") -> List:
        """Create a motor strength examination table"""
        elements = []
        
        # Table data with headers
        table_data = [['MUSCLE GROUP', 'RIGHT', 'LEFT']]
        
        # Add muscle data
        for item in data:
            table_data.append([
                item.get('muscle', ''),
                item.get('right', ''),
                item.get('left', '')
            ])
        
        # Set appropriate column widths based on section
        if section == "upper":
            col_widths = [3*inch, 1.5*inch, 1.5*inch]
        else:
            col_widths = [3*inch, 1.5*inch, 1.5*inch]
        
        # Create table
        table = Table(table_data, colWidths=col_widths)
        table.setStyle(TableStyle(self.styles.table_style))
        
        # Special styling for muscle names (left align)
        table.setStyle(TableStyle([
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),
            ('LEFTPADDING', (0, 1), (0, -1), 12),
        ]))
        
        elements.append(table)
        return elements
    
    def create_reflex_table(self, data: List[Dict[str, str]], title: str) -> List:
        """Create a reflex examination table"""
        elements = []
        
        # Table data with headers
        table_data = [['REFLEX', 'RIGHT', 'LEFT']]
        
        # Add reflex data
        for item in data:
            table_data.append([
                item.get('reflex', ''),
                item.get('right', ''),
                item.get('left', '')
            ])
        
        # Set column widths
        col_widths = [3*inch, 1.5*inch, 1.5*inch]
        
        # Create table
        table = Table(table_data, colWidths=col_widths)
        table.setStyle(TableStyle(self.styles.table_style))
        
        # Special styling for reflex names (left align)
        table.setStyle(TableStyle([
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),
            ('LEFTPADDING', (0, 1), (0, -1), 12),
        ]))
        
        elements.append(table)
        return elements
    
    def create_generic_table(self, headers: List[str], data: List[List[str]], 
                           col_widths: List[float] = None) -> Table:
        """Create a generic table with custom headers and data"""
        table_data = [headers] + data
        
        if col_widths is None:
            # Auto-calculate column widths
            num_cols = len(headers)
            total_width = 6.5 * inch  # Letter width minus margins
            col_widths = [total_width / num_cols] * num_cols
        
        table = Table(table_data, colWidths=col_widths)
        table.setStyle(TableStyle(self.styles.table_style))
        
        return table
    
    def create_summary_table(self, summary_data: Dict[str, str]) -> Table:
        """Create a patient summary table"""
        table_data = []
        
        # Convert dict to table rows
        for key, value in summary_data.items():
            # Format the key for display
            display_key = key.replace('_', ' ').title() + ':'
            table_data.append([display_key, value])
        
        # Create two-column table
        table = Table(table_data, colWidths=[2*inch, 4*inch])
        
        # Custom styling for summary table
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('RIGHTPADDING', (0, 0), (0, -1), 12),
            ('LEFTPADDING', (1, 0), (1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        
        return table