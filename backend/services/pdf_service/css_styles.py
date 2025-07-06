def get_medical_document_css(besley_font_path: str = None) -> str:
    """Return CSS styles for professional medical document formatting"""
    
    # Build font-face declarations if font path is provided
    font_declarations = ""
    if besley_font_path:
        font_declarations = f'''
/* Font face declarations */
@font-face {{
    font-family: 'Besley';
    src: url('{besley_font_path}') format('truetype');
    font-weight: normal;
    font-style: normal;
}}

@font-face {{
    font-family: 'Besley';
    src: url('{besley_font_path}') format('truetype');
    font-weight: bold;
    font-style: normal;
}}
'''
    
    return font_declarations + '''

/* Page setup */
@page {
    size: letter;
    margin: 0.75in;
    @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Besley', 'Times New Roman', Times, serif;
        font-size: 10pt;
        color: #333333;
    }
}

/* Reset and base styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Besley', 'Times New Roman', Times, serif;
    font-size: 11pt;
    line-height: 1.4;
    color: #000000;
    background-color: #fcfcfa;
}

/* Page container */
.page {
    background-color: white;
    padding: 0;
}

/* Clinic header styles */
.clinic-header {
    text-align: center;
    margin-bottom: 20pt;
    padding-bottom: 15pt;
    border-bottom: 1px solid #e9ecef;
}

.clinic-name {
    font-size: 16pt;
    font-weight: bold;
    margin-bottom: 8pt;
    color: #000000;
    letter-spacing: 0.5pt;
}

.clinic-address {
    font-size: 11pt;
    margin-bottom: 4pt;
}

.clinic-contact {
    font-size: 11pt;
    color: #333333;
}

/* Patient information styles */
.patient-info {
    margin-bottom: 20pt;
    line-height: 1.6;
}

.patient-info p {
    margin-bottom: 4pt;
    font-size: 11pt;
}

.patient-info strong {
    font-weight: bold;
}

/* Section styles */
.section {
    margin-bottom: 15pt;
}

.section-header {
    font-size: 12pt;
    font-weight: bold;
    margin-bottom: 10pt;
    margin-top: 15pt;
    color: #000000;
    text-transform: uppercase;
}

.section-content {
    font-size: 11pt;
    line-height: 1.6;
    margin-bottom: 8pt;
    text-align: left;
}

/* Numbered list styles */
.numbered-list {
    margin-left: 20pt;
    margin-bottom: 10pt;
}

.numbered-list li {
    font-size: 11pt;
    line-height: 1.6;
    margin-bottom: 6pt;
    text-align: left;
}

/* Table styles */
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 15pt;
    font-size: 11pt;
}

/* Table headers */
th {
    background-color: #666666;
    color: white;
    font-weight: bold;
    padding: 8pt 6pt;
    text-align: center;
    border: 1px solid #000000;
    font-size: 10pt;
}

/* Table cells */
td {
    padding: 6pt;
    text-align: center;
    border: 1px solid #000000;
}

/* Specific table styling */
.motor-table, .reflex-table {
    margin-top: 10pt;
}

.muscle-name, .reflex-name {
    text-align: left !important;
    padding-left: 12pt;
}

.strength-value, .reflex-value {
    text-align: center;
}

/* Alternating row colors */
tbody tr:nth-child(even) {
    background-color: #f8f9fa;
}

/* Subsection headers */
h3 {
    font-size: 11pt;
    font-weight: bold;
    margin-top: 10pt;
    margin-bottom: 8pt;
}

/* Signature section */
.signature-section {
    margin-top: 40pt;
}

.signature-line {
    border-bottom: 1px solid #000000;
    width: 250pt;
    margin-bottom: 4pt;
}

.provider-name {
    font-size: 11pt;
    margin-bottom: 2pt;
}

.provider-credentials {
    font-size: 11pt;
    margin-bottom: 15pt;
}

.date-line {
    font-size: 11pt;
    margin-top: 20pt;
}

/* Print-specific adjustments */
@media print {
    body {
        background-color: white;
    }
    
    .page {
        page-break-after: auto;
    }
    
    .section-header {
        page-break-after: avoid;
    }
    
    table {
        page-break-inside: avoid;
    }
}
'''