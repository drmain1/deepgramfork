from fastapi import APIRouter, HTTPException, Response, Depends, Request
from typing import Dict, Any
import json
import logging
from datetime import datetime
from models import MedicalDocument, PDFGenerationRequest, PDFGenerationResponse, MultiVisitPDFRequest, BillingPDFRequest
from services.pdf_service.weasyprint_generator import WeasyPrintMedicalPDFGenerator
from services.pdf_service.billing_generator import WeasyPrintBillingPDFGenerator
from firebase_auth_simple import get_current_user
from audit_logger import AuditLogger

logger = logging.getLogger(__name__)
router = APIRouter()
# Use WeasyPrint as the primary PDF generator
generator = WeasyPrintMedicalPDFGenerator()
billing_generator = WeasyPrintBillingPDFGenerator()

@router.post("/api/generate-pdf")
async def generate_pdf(data: MedicalDocument, request: Request, current_user: dict = Depends(get_current_user)):
    """Generate PDF from structured medical data"""
    user_id = current_user.get('sub')
    patient_name = data.patient_info.patient_name
    
    try:
        # Convert Pydantic model to dict
        data_dict = data.model_dump()
        
        # Log the incoming data structure for re-evaluation debugging
        logger.info("=== PDF ROUTER - generate_pdf ===")
        logger.info(f"Evaluation type: {data_dict.get('evaluation_type', 'Not specified')}")
        logger.info(f"Data structure keys: {list(data_dict.keys())}")
        logger.info(f"Full data for PDF generation: {json.dumps(data_dict, indent=2)}")
        
        # Generate PDF with WeasyPrint, passing user_id for clinic info
        pdf_bytes = await generator.generate_pdf(data_dict, user_id=user_id)
        
        # Audit log successful PDF generation
        AuditLogger.log_data_access(
            user_id=user_id,
            operation="EXPORT",
            data_type="medical_record_pdf",
            resource_id=f"patient:{patient_name}",
            request=request,
            success=True,
            additional_data={"pdf_size_bytes": len(pdf_bytes), "format": "structured"}
        )
        
        # Return PDF as response
        patient_name_safe = patient_name.replace(' ', '_').replace('/', '_').replace(',', '_')
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="medical_record_{patient_name_safe}.pdf"'
            }
        )
    except Exception as e:
        # Audit log failed PDF generation
        AuditLogger.log_data_access(
            user_id=user_id,
            operation="EXPORT",
            data_type="medical_record_pdf",
            resource_id=f"patient:{patient_name}",
            request=request,
            success=False,
            additional_data={"error": str(e), "format": "structured"}
        )
        logger.error(f"WeasyPrint PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-pdf-from-transcript")
async def generate_pdf_from_transcript(pdf_request: PDFGenerationRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """Generate PDF from raw transcript"""
    user_id = current_user.get('sub')
    patient_name = "unknown_patient"
    
    try:
        if pdf_request.format_type == "structured":
            # Parse structured JSON from transcript
            try:
                # The transcript should already be in JSON format from the LLM
                data = json.loads(pdf_request.transcript)
                
                # Log the parsed data for debugging
                logger.info("=== PDF ROUTER - generate_pdf_from_transcript (structured) ===")
                logger.info(f"Successfully parsed JSON transcript")
                logger.info(f"Evaluation type: {data.get('evaluation_type', 'Not specified')}")
                logger.info(f"Data structure keys: {list(data.keys()) if data else 'None'}")
                logger.info(f"Full parsed data: {json.dumps(data, indent=2)}")
            except json.JSONDecodeError:
                # If not JSON, try to extract JSON from the transcript
                import re
                # Look for JSON block that starts with opening brace and ends with closing brace
                # This handles cases where there might be text before/after the JSON
                # Use a more robust approach to find the JSON object
                transcript_stripped = pdf_request.transcript.strip()
                
                # First, try to find a JSON object by looking for balanced braces
                # Start from the first { and find its matching }
                start_idx = transcript_stripped.find('{')
                if start_idx != -1:
                    brace_count = 0
                    end_idx = start_idx
                    for i in range(start_idx, len(transcript_stripped)):
                        if transcript_stripped[i] == '{':
                            brace_count += 1
                        elif transcript_stripped[i] == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                end_idx = i
                                break
                    
                    if end_idx > start_idx:
                        json_str = transcript_stripped[start_idx:end_idx + 1]
                        try:
                            data = json.loads(json_str)
                            logger.info("Successfully extracted JSON from transcript using balanced brace method")
                        except json.JSONDecodeError as e:
                            logger.warning(f"Found JSON-like content but it's not valid JSON: {str(e)}, falling back to markdown conversion")
                            data = generator._convert_markdown_to_structured(pdf_request.transcript)
                    else:
                        logger.warning("Could not find matching closing brace for JSON object")
                        data = generator._convert_markdown_to_structured(pdf_request.transcript)
                else:
                    # No JSON found, convert markdown to structured format
                    logger.info("No JSON found in transcript, converting from markdown format")
                    data = generator._convert_markdown_to_structured(pdf_request.transcript)
        else:
            # Legacy markdown support
            data = generator._convert_markdown_to_structured(pdf_request.transcript)
        
        # Extract patient name for logging
        patient_name = data.get('patient_info', {}).get('patient_name', 'unknown_patient')
        
        # Generate PDF with WeasyPrint, passing user_id for clinic info
        pdf_bytes = await generator.generate_pdf(data, user_id=user_id)
        
        # Audit log successful PDF generation from transcript
        AuditLogger.log_data_access(
            user_id=user_id,
            operation="EXPORT",
            data_type="transcript_pdf",
            resource_id=f"patient:{patient_name}",
            request=request,
            success=True,
            additional_data={
                "pdf_size_bytes": len(pdf_bytes), 
                "format": pdf_request.format_type,
                "transcript_length": len(pdf_request.transcript)
            }
        )
        
        # Extract patient name for filename
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
        # Audit log failed PDF generation from transcript
        AuditLogger.log_data_access(
            user_id=user_id,
            operation="EXPORT",
            data_type="transcript_pdf",
            resource_id=f"patient:{patient_name}",
            request=request,
            success=False,
            additional_data={
                "error": str(e), 
                "format": pdf_request.format_type,
                "transcript_length": len(pdf_request.transcript) if pdf_request.transcript else 0
            }
        )
        logger.error(f"WeasyPrint PDF generation from transcript error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-pdf-preview")
async def generate_pdf_preview(data: MedicalDocument, request: Request, current_user: dict = Depends(get_current_user)):
    """Generate PDF and return base64 encoded for preview"""
    user_id = current_user.get('sub')
    patient_name = data.patient_info.patient_name
    
    try:
        import base64
        
        # Convert Pydantic model to dict
        data_dict = data.model_dump()
        
        # Generate PDF with WeasyPrint, passing user_id for clinic info
        pdf_bytes = await generator.generate_pdf(data_dict, user_id=user_id)
        
        # Audit log successful PDF preview generation
        AuditLogger.log_data_access(
            user_id=user_id,
            operation="PREVIEW",
            data_type="medical_record_pdf",
            resource_id=f"patient:{patient_name}",
            request=request,
            success=True,
            additional_data={"pdf_size_bytes": len(pdf_bytes), "format": "preview_base64"}
        )
        
        # Encode to base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return {
            "success": True,
            "pdf_data": pdf_base64,
            "filename": f"medical_record_{patient_name.replace(' ', '_')}.pdf"
        }
    except Exception as e:
        # Audit log failed PDF preview generation
        AuditLogger.log_data_access(
            user_id=user_id,
            operation="PREVIEW",
            data_type="medical_record_pdf",
            resource_id=f"patient:{patient_name}",
            request=request,
            success=False,
            additional_data={"error": str(e), "format": "preview_base64"}
        )
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
        
        pdf_bytes = await generator.generate_pdf(test_data)
        
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
async def generate_multi_visit_pdf(pdf_request: MultiVisitPDFRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """Generate PDF from multiple medical visits"""
    user_id = current_user.get('sub')
    patient_name = pdf_request.patient_name
    
    try:
        logger.info(f"Multi-visit PDF request received for patient: {patient_name}")
        logger.debug(f"Number of visits: {len(pdf_request.visits) if pdf_request.visits else 0}")
        
        if not pdf_request.visits:
            raise ValueError("No visits provided")
        
        # Convert visits to dict format with exclude_unset to handle optional fields
        visits_data = []
        for idx, visit in enumerate(pdf_request.visits):
            try:
                visit_dict = visit.model_dump(exclude_unset=True)
                visits_data.append(visit_dict)
                logger.debug(f"Visit {idx} converted successfully, type: {visit_dict.get('evaluation_type', 'unknown')}")
                
                # Debug cranial nerve data for initial visits
                if visit_dict.get('evaluation_type') == 'initial' and 'cranial_nerve_examination' in visit_dict:
                    logger.info(f"\n=== CRANIAL NERVE DEBUG - Visit {idx} ===")
                    cns = visit_dict['cranial_nerve_examination']
                    logger.info(f"Cranial nerve examination present: Type={type(cns)}, Length={len(cns) if isinstance(cns, list) else 'N/A'}")
                    if isinstance(cns, list) and cns:
                        logger.info(f"First cranial nerve: {cns[0]}")
                        intact_count = sum(1 for item in cns if isinstance(item, dict) and item.get('finding') == 'Intact')
                        logger.info(f"Intact count: {intact_count} out of {len(cns)} total nerves")
                        
            except Exception as e:
                logger.error(f"Error converting visit {idx} to dict: {str(e)}")
                raise
        
        # Generate PDF with WeasyPrint, passing user_id for clinic info
        pdf_bytes = await generator.generate_multi_visit_pdf(visits_data, patient_name, user_id=user_id)
        
        # Audit log successful multi-visit PDF generation
        AuditLogger.log_data_access(
            user_id=user_id,
            operation="EXPORT",
            data_type="multi_visit_pdf",
            resource_id=f"patient:{patient_name}",
            request=request,
            success=True,
            additional_data={
                "pdf_size_bytes": len(pdf_bytes), 
                "visit_count": len(pdf_request.visits),
                "format": "multi_visit"
            }
        )
        
        # Create safe filename
        safe_name = patient_name.replace(' ', '_').replace('/', '_').replace(',', '_')
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
        # Audit log failed multi-visit PDF generation
        AuditLogger.log_data_access(
            user_id=user_id,
            operation="EXPORT",
            data_type="multi_visit_pdf",
            resource_id=f"patient:{patient_name}",
            request=request,
            success=False,
            additional_data={
                "error": str(e), 
                "visit_count": len(pdf_request.visits) if pdf_request.visits else 0,
                "format": "multi_visit"
            }
        )
        logger.error(f"WeasyPrint multi-visit PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/generate-billing-pdf")
async def generate_billing_pdf(billing_request: BillingPDFRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """Generate billing PDF from billing data using WeasyPrint"""
    user_id = current_user.get('sub')
    patient_name = f"{billing_request.patient_info.get('first_name', '')} {billing_request.patient_info.get('last_name', '')}".strip()
    
    try:
        # Generate PDF with WeasyPrint
        pdf_bytes = billing_generator.generate_billing_pdf(
            billing_data=billing_request.billing_data,
            patient_info=billing_request.patient_info,
            doctor_info=billing_request.doctor_info,
            include_logo=billing_request.include_logo,
            include_signature=billing_request.include_signature
        )
        
        # Audit log successful billing PDF generation
        AuditLogger.log_data_access(
            user_id=user_id,
            operation="EXPORT",
            data_type="billing_pdf",
            resource_id=f"patient:{patient_name}",
            request=request,
            success=True,
            additional_data={
                "pdf_size_bytes": len(pdf_bytes),
                "include_logo": billing_request.include_logo,
                "include_signature": billing_request.include_signature,
                "format": "billing"
            }
        )
        
        # Create safe filename
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
        # Audit log failed billing PDF generation
        AuditLogger.log_data_access(
            user_id=user_id,
            operation="EXPORT",
            data_type="billing_pdf",
            resource_id=f"patient:{patient_name}",
            request=request,
            success=False,
            additional_data={
                "error": str(e),
                "include_logo": billing_request.include_logo,
                "include_signature": billing_request.include_signature,
                "format": "billing"
            }
        )
        logger.error(f"WeasyPrint billing PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Legacy endpoints for backward compatibility (now using WeasyPrint)
# All main endpoints above now use WeasyPrint as the default PDF generator