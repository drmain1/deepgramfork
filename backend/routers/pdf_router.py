from fastapi import APIRouter, HTTPException, Response
from typing import Dict, Any
import json
import logging
from models import MedicalDocument, PDFGenerationRequest, PDFGenerationResponse
from services.pdf_service import MedicalPDFGenerator

logger = logging.getLogger(__name__)
router = APIRouter()
generator = MedicalPDFGenerator()

@router.post("/api/generate-pdf")
async def generate_pdf(data: MedicalDocument):
    """Generate PDF from structured medical data"""
    try:
        # Convert Pydantic model to dict
        data_dict = data.model_dump()
        
        # Generate PDF
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
        logger.error(f"PDF generation error: {str(e)}")
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
        
        # Generate PDF
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
        logger.error(f"PDF generation from transcript error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-pdf-preview")
async def generate_pdf_preview(data: MedicalDocument):
    """Generate PDF and return base64 encoded for preview"""
    try:
        import base64
        
        # Convert Pydantic model to dict
        data_dict = data.model_dump()
        
        # Generate PDF
        pdf_bytes = generator.generate_pdf(data_dict)
        
        # Encode to base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return {
            "success": True,
            "pdf_data": pdf_base64,
            "filename": f"medical_record_{data.patient_info.patient_name.replace(' ', '_')}.pdf"
        }
    except Exception as e:
        logger.error(f"PDF preview generation error: {str(e)}")
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
            "service": "pdf_generator",
            "test_pdf_size": len(pdf_bytes)
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "pdf_generator",
            "error": str(e)
        }