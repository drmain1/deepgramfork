from fastapi import APIRouter, HTTPException, Response
from typing import Dict, Any
import json
import logging
from datetime import datetime
from models import MedicalDocument, PDFGenerationRequest, PDFGenerationResponse, MultiVisitPDFRequest, BillingPDFRequest
from services.pdf_service.weasyprint_generator import WeasyPrintMedicalPDFGenerator
from services.pdf_service.billing_generator import WeasyPrintBillingPDFGenerator

logger = logging.getLogger(__name__)
router = APIRouter()
# Use WeasyPrint as the primary PDF generator
generator = WeasyPrintMedicalPDFGenerator()
billing_generator = WeasyPrintBillingPDFGenerator()

@router.post("/api/generate-pdf")
async def generate_pdf(data: MedicalDocument):
    """Generate PDF from structured medical data"""
    try:
        # Convert Pydantic model to dict
        data_dict = data.model_dump()
        
        # Generate PDF with WeasyPrint
        pdf_bytes = generator.generate_pdf(data_dict)
        
        # Return PDF as response
        patient_name_safe = data.patient_info.patient_name.replace(' ', '_').replace('/', '_').replace(',', '_')
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="medical_record_{patient_name_safe}.pdf"'
            }
        )
    except Exception as e:
        logger.error(f"WeasyPrint PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-pdf-from-transcript")
async def generate_pdf_from_transcript(request: PDFGenerationRequest):
    """Generate PDF from raw transcript"""
    try:
        if request.format_type == "structured":
            # Parse structured JSON from transcript
            try:
                # The transcript should already be in JSON format from the LLM
                data = json.loads(request.transcript)
            except json.JSONDecodeError:
                # If not JSON, try to extract JSON from the transcript
                import re
                json_match = re.search(r'\{.*\}', request.transcript, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                else:
                    raise ValueError("Could not parse structured JSON from transcript")
        else:
            # Legacy markdown support
            data = generator._convert_markdown_to_structured(request.transcript)
        
        # Generate PDF with WeasyPrint
        pdf_bytes = generator.generate_pdf(data)
        
        # Extract patient name for filename
        patient_name = data.get('patient_info', {}).get('patient_name', 'patient')
        safe_name = patient_name.replace(' ', '_').replace('/', '_')
        
        # Return PDF as response
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="medical_record_{safe_name}.pdf"'
            }
        )
    except Exception as e:
        logger.error(f"WeasyPrint PDF generation from transcript error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-pdf-preview")
async def generate_pdf_preview(data: MedicalDocument):
    """Generate PDF and return base64 encoded for preview"""
    try:
        import base64
        
        # Convert Pydantic model to dict
        data_dict = data.model_dump()
        
        # Generate PDF with WeasyPrint
        pdf_bytes = generator.generate_pdf(data_dict)
        
        # Encode to base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return {
            "success": True,
            "pdf_data": pdf_base64,
            "filename": f"medical_record_{data.patient_info.patient_name.replace(' ', '_')}.pdf"
        }
    except Exception as e:
        logger.error(f"WeasyPrint PDF preview generation error: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@router.get("/api/pdf-service-health")
async def pdf_service_health():
    """Check if PDF service is healthy"""
    try:
        # Test PDF generation with dummy data
        test_data = {
            "patient_info": {
                "patient_name": "Test Patient",
                "date_of_birth": "01/01/1990",
                "date_of_treatment": "01/01/2024"
            },
            "sections": {
                "chief_complaint": "Test complaint"
            }
        }
        
        pdf_bytes = generator.generate_pdf(test_data)
        
        return {
            "status": "healthy",
            "service": "weasyprint_pdf_generator",
            "test_pdf_size": len(pdf_bytes)
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "weasyprint_pdf_generator",
            "error": str(e)
        }

@router.post("/api/generate-multi-visit-pdf")
async def generate_multi_visit_pdf(request: MultiVisitPDFRequest):
    """Generate PDF from multiple medical visits"""
    try:
        if not request.visits:
            raise ValueError("No visits provided")
        
        # Convert visits to dict format
        visits_data = [visit.model_dump() for visit in request.visits]
        
        # Generate PDF with WeasyPrint
        pdf_bytes = generator.generate_multi_visit_pdf(visits_data, request.patient_name)
        
        # Create safe filename
        safe_name = request.patient_name.replace(' ', '_').replace('/', '_').replace(',', '_')
        filename = f"medical_records_{safe_name}_multi_visit.pdf"
        
        # Return PDF as response
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        logger.error(f"WeasyPrint multi-visit PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-billing-pdf")
async def generate_billing_pdf(request: BillingPDFRequest):
    """Generate billing PDF from billing data using WeasyPrint"""
    try:
        # Generate PDF with WeasyPrint
        pdf_bytes = billing_generator.generate_billing_pdf(
            billing_data=request.billing_data,
            patient_info=request.patient_info,
            doctor_info=request.doctor_info,
            include_logo=request.include_logo,
            include_signature=request.include_signature
        )
        
        # Create safe filename
        patient_name = f"{request.patient_info.get('first_name', '')} {request.patient_info.get('last_name', '')}".strip()
        safe_name = patient_name.replace(' ', '_').replace('/', '_').replace(',', '_')
        filename = f"billing_{safe_name}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        # Return PDF as response
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        logger.error(f"WeasyPrint billing PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Legacy endpoints for backward compatibility (now using WeasyPrint)
# All main endpoints above now use WeasyPrint as the default PDF generator