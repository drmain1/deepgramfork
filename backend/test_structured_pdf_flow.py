#!/usr/bin/env python3
"""
Test script to verify the end-to-end PDF generation flow with structured JSON
"""

import asyncio
import json
import logging
from datetime import datetime
from pprint import pprint

# Import the functions we need to test
from gcp_utils import polish_transcript_with_gemini
from services.pdf_service.generator import PDFGenerator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test transcript - a simple pain management consultation
TEST_TRANSCRIPT = """
Doctor: Good morning, Mrs. Johnson. How are you feeling today?

Patient: Not great, doctor. My lower back pain has been getting worse. It's about an 8 out of 10 now, and it's radiating down my left leg.

Doctor: I'm sorry to hear that. When did this start?

Patient: It started about 4 months ago after a car accident. I was rear-ended at a traffic light.

Doctor: Have you tried any treatments?

Patient: Yes, I've done 20 sessions of physical therapy with minimal improvement. I also tried chiropractic care but had to stop because it made the pain worse.

Doctor: What medications are you currently taking?

Patient: I'm taking Lisinopril for high blood pressure, Levothyroxine for my thyroid, Ibuprofen 600mg three times a day, and Cyclobenzaprine at bedtime.

Doctor: Any allergies?

Patient: No known drug allergies.

Doctor: Let me examine you. I can see you have limited range of motion. The straight leg raise test is positive on the left at 45 degrees. Your motor strength is 5/5 in most areas but 4/5 in the left hamstrings and anterior tibialis.

Doctor: Based on my examination, you have lumbar radiculopathy, likely from an L5 disc issue. I recommend we get an MRI of your lumbar spine and start you on a lumbar epidural steroid injection at the L5-S1 level. We'll also continue with physical therapy focusing on core strengthening.
"""

# Import the structured instructions
import sys
sys.path.append('../my-vite-react-app/src/templates/llm-instructions')
from pain_management_eval_structured import painManagementEvalStructuredInstructions

async def test_structured_flow():
    """Test the complete flow from transcript to PDF using structured JSON"""
    
    print("=" * 80)
    print("Testing Structured PDF Generation Flow")
    print("=" * 80)
    
    # Step 1: Process transcript with Gemini using structured instructions
    print("\n1. Processing transcript with Gemini AI...")
    
    result = polish_transcript_with_gemini(
        transcript=TEST_TRANSCRIPT,
        patient_name="Sarah Johnson",
        patient_context="Motor vehicle accident 4 months ago",
        encounter_type="Pain Management Evaluation",
        llm_instructions=painManagementEvalStructuredInstructions,
        location="Pain Management Clinic"
    )
    
    if not result['success']:
        print(f"ERROR: Failed to polish transcript: {result.get('error')}")
        return
    
    polished_transcript = result['polished_transcript']
    print(f"\n2. Received polished transcript (length: {len(polished_transcript)} chars)")
    
    # Step 2: Parse the JSON response
    print("\n3. Parsing JSON response...")
    try:
        structured_data = json.loads(polished_transcript)
        print("SUCCESS: Valid JSON received!")
        print("\nStructured data preview:")
        print(f"- Patient Name: {structured_data.get('patient_info', {}).get('patient_name')}")
        print(f"- Chief Complaint: {structured_data.get('sections', {}).get('chief_complaint', '')[:100]}...")
        print(f"- Has Motor Exam: {'motor_exam' in structured_data and structured_data['motor_exam'] is not None}")
        print(f"- Has Reflexes: {'reflexes' in structured_data and structured_data['reflexes'] is not None}")
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON response: {e}")
        print(f"Response preview: {polished_transcript[:500]}...")
        return
    
    # Step 3: Generate PDF using the structured data
    print("\n4. Generating PDF from structured data...")
    try:
        pdf_generator = PDFGenerator()
        pdf_data = pdf_generator.generate_from_structured_data(
            structured_data,
            include_watermark=False,
            include_signature=True
        )
        
        # Save PDF for manual inspection
        output_path = "test_structured_output.pdf"
        with open(output_path, "wb") as f:
            f.write(pdf_data)
        
        print(f"SUCCESS: PDF generated! Saved to {output_path}")
        print(f"PDF size: {len(pdf_data):,} bytes")
        
    except Exception as e:
        print(f"ERROR: Failed to generate PDF: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print("\n" + "=" * 80)
    print("Test completed successfully!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_structured_flow())