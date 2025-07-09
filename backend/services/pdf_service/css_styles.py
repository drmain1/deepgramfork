def get_re_evaluation_css(besley_font_path: str = None) -> str:
    """Return CSS styles specifically for re-evaluation documents with progress bars"""
    return get_medical_document_css(besley_font_path)

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
    margin: 0.5in 0.5in; /* Reduced margins to give more horizontal space */
    @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Besley', 'Times New Roman', Times, serif;
        font-size: 10pt;
        color: #333333;
    }
}

/* Multi-visit specific styles */
.patient-header h1 {
    font-family: 'Besley', 'Times New Roman', Times, serif;
    font-size: 18pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 20pt;
    color: #000000;
}

.follow-up-header {
    margin-top: 30pt;
    margin-bottom: 20pt;
    border-top: 2px solid #000000;
    padding-top: 20pt;
}

.follow-up-header h2 {
    font-family: 'Besley', 'Times New Roman', Times, serif;
    font-size: 14pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 20pt;
    color: #000000;
}

.re-evaluation-header {
    margin-top: 30pt;
    margin-bottom: 20pt;
    border-top: 2px solid #004466;
    padding-top: 20pt;
}

.re-evaluation-header h2 {
    font-family: 'Besley', 'Times New Roman', Times, serif;
    font-size: 14pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 20pt;
    color: #004466;
}

.visit-container {
    margin-bottom: 20pt;
}

/* Reduce spacing for follow-up visits */
.visit-container:has(.follow-up-header) ~ .visit-container {
    margin-bottom: 15pt;
}

.visit-date-header h3 {
    font-family: 'Besley', 'Times New Roman', Times, serif;
    font-size: 12pt;
    font-weight: bold;
    margin-bottom: 15pt;
    color: #000000;
    border-bottom: 1px solid #cccccc;
    padding-bottom: 5pt;
}

.page-break {
    page-break-before: always;
}

/* Narrative section styles for follow-up visits */
.narrative-section {
    margin-bottom: 15pt;
}

.narrative-content {
    font-family: 'Besley', 'Times New Roman', Times, serif;
    font-size: 11pt;
    line-height: 1.4;
    margin-bottom: 10pt;
    text-align: justify;
}

/* Reset and base styles */
* {
    margin: 0;
    padding: 0;
    /* Removed box-sizing as it may cause issues with WeasyPrint */
}

body {
    font-family: 'Besley', 'Times New Roman', Times, serif;
    font-size: 10pt;
    line-height: 1.4;
    color: #000000;
    background-color: #fcfcfa;
}

/* Page container */
.page {
    background-color: white;
    padding: 0;
    overflow: visible; /* Ensure tables aren't clipped */
}

/* Clinic header styles */
.clinic-header {
    text-align: center;
    margin-bottom: 20pt;
    padding-bottom: 15pt;
    border-bottom: 1px solid #e9ecef;
}

.clinic-info-line {
    display: block;
    margin: 0;
    padding: 0;
}

.clinic-name {
    font-size: 14pt;
    font-weight: bold;
    margin-bottom: 6pt;
    color: #000000;
    letter-spacing: 0.3pt;
}

.clinic-address {
    font-size: 9pt;
    margin-bottom: 3pt;
}

.clinic-contact {
    font-size: 9pt;
    color: #333333;
}

/* Patient information styles */
.patient-info {
    margin-bottom: 20pt;
    line-height: 1.6;
}

.patient-info p {
    margin-bottom: 4pt;
    font-size: 10pt;
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
    font-size: 10pt;
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
    font-size: 10pt;
    line-height: 1.6;
    margin-bottom: 6pt;
    text-align: left;
}

/* Bulleted list styles */
.bulleted-list {
    margin-left: 20pt;
    margin-bottom: 10pt;
    list-style-type: disc;
}

.bulleted-list li {
    font-size: 10pt;
    line-height: 1.6;
    margin-bottom: 6pt;
    text-align: left;
}

/* Table styles */
table {
    width: 100%; /* Full width to ensure all columns are visible */
    border-collapse: collapse;
    margin-bottom: 15pt;
    font-size: 11pt;
    table-layout: auto; /* Auto layout to let browser calculate column widths */
    overflow: visible; /* Ensure content is not clipped */
}

/* Table headers */
th {
    background-color: #666666;
    color: white;
    font-weight: bold;
    padding: 6pt 4pt; /* Reduced padding from 8pt 6pt */
    text-align: center;
    border: 1px solid #000000;
    font-size: 9pt; /* Reduced from 10pt */
    word-wrap: break-word; /* Allow text wrapping in headers */
    white-space: normal; /* Ensure text can wrap properly */
    min-width: 50pt; /* Minimum width to ensure visibility */
}

/* Table cells */
td {
    padding: 5pt 4pt; /* Reduced padding from 6pt */
    text-align: center;
    border: 1px solid #000000;
    word-wrap: break-word; /* Allow text wrapping in cells */
    font-size: 10pt; /* Slightly reduced */
}

/* Three-column table specific widths - removed to allow auto-sizing */
/* Commenting out width constraints to let WeasyPrint auto-size columns
table th:nth-child(1), table td:nth-child(1) {
    width: 40%;
}
table th:nth-child(2), table td:nth-child(2) {
    width: 30%;
}
table th:nth-child(3), table td:nth-child(3) {
    width: 30%;
}
*/

/* Specific table styling */
.motor-table, .reflex-table {
    margin-top: 10pt;
    width: 100%; /* Full width for motor/reflex tables */
}

/* Motor and reflex table specific column widths */
.motor-table th:nth-child(1), .motor-table td:nth-child(1),
.reflex-table th:nth-child(1), .reflex-table td:nth-child(1) {
    width: 50%; /* Muscle/reflex name column - wider */
}
.motor-table th:nth-child(2), .motor-table td:nth-child(2),
.reflex-table th:nth-child(2), .reflex-table td:nth-child(2) {
    width: 25%; /* RIGHT column */
}
.motor-table th:nth-child(3), .motor-table td:nth-child(3),
.reflex-table th:nth-child(3), .reflex-table td:nth-child(3) {
    width: 25%; /* LEFT column */
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

/* Re-evaluation specific styles */
.patient-bar { 
    background-color: #f0f8ff; 
    padding: 8pt 10pt; 
    margin: 1em 0; 
    border-left: 5pt solid #004466; 
    font-size: 9pt;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Subjective Section */
.complaint-block { 
    margin-bottom: 1.2em; 
}

.complaint-current { 
    font-size: 1.1em; 
    font-weight: bold; 
    margin-bottom: 4pt;
}

.complaint-initial { 
    color: #6c757d; 
    font-style: italic; 
    padding-left: 1em; 
    margin-bottom: 0;
}

/* Progress Dashboard */
.dashboard-item { 
    margin-bottom: 1.5em; 
}

.progress-bar-container { 
    background-color: #e9ecef; 
    border-radius: 4pt; 
    height: 18pt; 
    margin-top: 4pt; 
    margin-bottom: 8pt;
}

.progress-bar { 
    background-color: #ced4da; /* Grey for Initial */
    height: 100%; 
    border-radius: 4pt; 
    transition: width 0.3s ease;
}

.progress-bar.current { 
    background-color: #28a745; /* Green for Current */
}

.improvement-text { 
    color: #28a745; 
    font-weight: bold; 
}

/* Enhanced table styling for comparisons */
/* Commenting out third column styling - may be causing rendering issues
table th:nth-child(3), 
table td:nth-child(3) { 
    font-weight: bold; 
    background-color: #f8fff8 !important;
}
*/

/* Diagnosis formatting */
.diagnosis-list { 
    margin-left: 0;
    margin-bottom: 10pt;
}

.diagnosis-item {
    font-size: 10pt;
    line-height: 1.6;
    margin-bottom: 4pt;
    margin-left: 10pt;
}

/* Headers for re-evaluation sections */
h1 { 
    color: #004466; 
    font-size: 24pt; 
    margin-bottom: 0.5em; 
    text-align: center;
}

h2 { 
    color: #004466; 
    font-size: 18pt; 
    border-bottom: 2pt solid #004466; 
    padding-bottom: 5pt; 
    margin-bottom: 1em;
    text-align: center;
}

h3 { 
    color: #004466; 
    font-size: 14pt; 
    border-bottom: 1pt solid #e0e0e0; 
    padding-bottom: 3pt; 
    margin-top: 1em;
    margin-bottom: 0.5em;
}

h4 { 
    color: #004466; 
    font-size: 12pt; 
    margin-top: 1em;
    margin-bottom: 0.5em;
}

h5 { 
    color: #004466; 
    font-size: 11pt; 
    margin-top: 0.8em;
    margin-bottom: 0.4em;
}

/* Horizontal rule styling */
hr { 
    border: none; 
    border-top: 1pt solid #ccc; 
    margin: 2em 0; 
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
        width: 100% !important;
        table-layout: auto !important;
    }
    
    th, td {
        overflow: visible !important;
        white-space: normal !important;
    }
    
    .progress-bar-container {
        background-color: #e9ecef !important;
        -webkit-print-color-adjust: exact;
    }
    
    .progress-bar {
        -webkit-print-color-adjust: exact;
    }
    
    .progress-bar.current {
        background-color: #28a745 !important;
        -webkit-print-color-adjust: exact;
    }
}
'''