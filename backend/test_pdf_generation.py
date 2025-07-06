#!/usr/bin/env python3
"""Test PDF generation service"""

import json
from services.pdf_service import MedicalPDFGenerator

def test_pdf_generation():
    """Test basic PDF generation"""
    print("Testing PDF generation service...")
    
    # Create generator
    generator = MedicalPDFGenerator()
    
    # Test data
    test_data = {
        "patient_info": {
            "patient_name": "John Doe",
            "date_of_birth": "01/15/1980",
            "date_of_accident": "12/01/2023",
            "date_of_treatment": "01/06/2025",
            "provider": "Dr. Smith"
        },
        "clinic_info": {
            "name": "Test Medical Clinic",
            "address": "123 Main St, Suite 100, City, State 12345",
            "phone": "(555) 123-4567",
            "fax": "(555) 123-4568"
        },
        "sections": {
            "chief_complaint": "1. Neck pain with radiation to right arm\n2. Low back pain\n3. Headaches",
            "history_of_present_illness": "Patient presents with complaints of neck pain that began after a motor vehicle accident on 12/01/2023. The pain radiates down the right arm and is associated with numbness and tingling.",
            "physical_examination": "Patient appears comfortable at rest. Normal gait observed.",
            "assessment_diagnosis": "1. Cervical radiculopathy - M54.12\n2. Low back pain - M54.5\n3. Post-traumatic headache - G44.309",
            "plan": "Conservative management with physical therapy 2-3 times per week for 4-6 weeks. NSAIDs for pain management. Follow up in 4 weeks."
        },
        "motor_exam": {
            "upper_extremity": [
                {"muscle": "DELTOID", "right": "5/5", "left": "5/5"},
                {"muscle": "BICEPS", "right": "4+/5", "left": "5/5"},
                {"muscle": "TRICEPS", "right": "5/5", "left": "5/5"},
                {"muscle": "WRIST EXT", "right": "5/5", "left": "5/5"},
                {"muscle": "FINGER FLEX", "right": "5/5", "left": "5/5"},
                {"muscle": "FINGER EXT", "right": "5/5", "left": "5/5"},
                {"muscle": "THUMB EXT", "right": "5/5", "left": "5/5"},
                {"muscle": "HAND INTRINSICS", "right": "5/5", "left": "5/5"}
            ],
            "lower_extremity": [
                {"muscle": "ILIOPSOAS", "right": "5/5", "left": "5/5"},
                {"muscle": "QUAD", "right": "5/5", "left": "5/5"},
                {"muscle": "HAMSTRINGS", "right": "5/5", "left": "5/5"},
                {"muscle": "GLUTEUS", "right": "5/5", "left": "5/5"},
                {"muscle": "ANTERIOR TIBIALIS", "right": "5/5", "left": "5/5"},
                {"muscle": "EXT HALLUCIS LONGUS", "right": "5/5", "left": "5/5"}
            ]
        },
        "reflexes": {
            "deep_tendon": [
                {"reflex": "BICEPS", "right": "2+", "left": "2+"},
                {"reflex": "TRICEPS", "right": "1+", "left": "2+"},
                {"reflex": "BRACHIORADIALIS", "right": "2+", "left": "2+"},
                {"reflex": "PATELLAR", "right": "2+", "left": "2+"},
                {"reflex": "ACHILLES", "right": "2+", "left": "2+"}
            ],
            "pathological": [
                {"reflex": "HOFFMAN", "right": "Negative", "left": "Negative"},
                {"reflex": "BABINSKI", "right": "Negative", "left": "Negative"},
                {"reflex": "CLONUS (ANKLE)", "right": "Negative", "left": "Negative"}
            ]
        },
        "provider_info": {
            "name": "Dr. Jane Smith, MD",
            "credentials": "Board Certified in Physical Medicine & Rehabilitation"
        }
    }
    
    try:
        # Generate PDF
        pdf_bytes = generator.generate_pdf(test_data)
        
        # Save to file
        output_file = "test_medical_record.pdf"
        with open(output_file, 'wb') as f:
            f.write(pdf_bytes)
        
        print(f"✓ PDF generated successfully!")
        print(f"✓ Saved to: {output_file}")
        print(f"✓ Size: {len(pdf_bytes):,} bytes")
        
        # Test markdown conversion
        print("\nTesting markdown to structured conversion...")
        markdown_text = """
Patient Name: Jane Smith
Date of Birth: 03/22/1975
Date of Treatment: 01/06/2025

**CHIEF COMPLAINT**: 
1. Chronic low back pain
2. Bilateral knee pain

**HISTORY OF PRESENT ILLNESS**: Patient reports ongoing low back pain for the past 3 months.

**ASSESSMENT/DIAGNOSIS**: 
1. Chronic low back pain - M54.5
2. Bilateral knee osteoarthritis - M17.0
"""
        
        structured = generator._convert_markdown_to_structured(markdown_text)
        print("✓ Markdown conversion successful")
        print(f"  - Found {len(structured['sections'])} sections")
        print(f"  - Patient: {structured['patient_info'].get('patient_name', 'Unknown')}")
        
        return True
        
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_pdf_generation()
    exit(0 if success else 1)