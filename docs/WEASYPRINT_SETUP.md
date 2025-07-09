# WeasyPrint Setup Instructions

## Overview
WeasyPrint has been added to generate PDFs with better HTML/CSS support to match your target PDF output.

## Installation

### 1. Install Python Package
```bash
cd backend
pip install -r requirements.txt
```

### 2. System Dependencies
WeasyPrint requires system libraries for Cairo and Pango. Install based on your OS:

#### macOS
```bash
brew install cairo pango gdk-pixbuf libffi
```

#### Ubuntu/Debian
```bash
sudo apt-get install python3-cffi python3-brotli libpango-1.0-0 libpangoft2-1.0-0
```

#### CentOS/RHEL/Fedora
```bash
sudo yum install python3-cffi python3-brotli pango
```

## Testing

1. Start your backend server:
```bash
cd backend
python -m uvicorn main:app --reload
```

2. Run the test script:
```bash
python test_weasyprint_pdf.py
```

This will generate two PDFs:
- `test_reportlab_output.pdf` - Current ReportLab implementation
- `test_weasyprint_output.pdf` - New WeasyPrint implementation

## New API Endpoints

### WeasyPrint Endpoints (for comparison):
- `POST /api/generate-pdf-weasyprint` - Generate PDF from structured data
- `POST /api/generate-pdf-from-transcript-weasyprint` - Generate PDF from transcript
- `GET /api/pdf-service-health-weasyprint` - Health check for WeasyPrint

### Original ReportLab Endpoints (still available):
- `POST /api/generate-pdf` - Generate PDF from structured data
- `POST /api/generate-pdf-from-transcript` - Generate PDF from transcript
- `GET /api/pdf-service-health` - Health check for ReportLab

## Key Improvements in WeasyPrint Version

1. **Professional Typography**: Uses Times New Roman for a medical document look
2. **Numbered Lists**: Properly formats chief complaints as numbered lists
3. **Better Table Styling**: Professional table borders and spacing
4. **CSS Control**: Full CSS3 support for precise styling
5. **Page Layout**: Better margins and spacing control

## Production Deployment

For Google App Engine deployment, you'll need to update `app.yaml` to include system packages:

```yaml
runtime: python310
env_flex: true

runtime_config:
  operating_system: "ubuntu22"
  
# Add system packages for WeasyPrint
system_packages:
  - libpango-1.0-0
  - libpangoft2-1.0-0
  - libffi-dev
```

## Choosing Between ReportLab and WeasyPrint

- **ReportLab**: Faster, smaller file sizes, better for simple layouts
- **WeasyPrint**: Better CSS/HTML support, easier to match complex designs, more accurate rendering

Compare the generated PDFs with your target to decide which to use in production.