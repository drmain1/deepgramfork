#!/usr/bin/env python3
"""
Test script for comparing ReportLab and WeasyPrint PDF generation
"""
import json
import requests
import os
from datetime import datetime

# Base URL for your FastAPI backend
BASE_URL = "http://localhost:8000"

# Sample medical data matching the target PDF
sample_data = {
    "patient_info": {
        "patient_name": "Patient, PI",
        "date_of_birth": "6/25/1999",
        "date_of_accident": "08/01/2024",
        "date_of_treatment": "05/15/2024"
    },
    "clinic_info": {
        "name": "Efficient Chiropractic",
        "address": "1234 Main st Los Angeles, CA 90024",
        "phone": "",
        "fax": ""
    },
    "sections": {
        "chief_complaint": "1. Severe neck pain radiating down the arm.\n2. Severe mid-back pain.\n3. Right knee pain.\n4. Left ankle pain.",
        "history_of_present_illness": "The patient presents today following a motor vehicle collision that occurred on August 1, 2024. The patient reports being struck by a car while walking across the street after looking over their right shoulder. The impact occurred on the right shoulder, causing the patient to fall. Immediately following the accident, the patient experienced pain around the neck and mid-back. Later that day, the neck pain began radiating down the arm. The patient sought care at an urgent care facility, where they received a neck X-ray and some medication. The patient waited a few days for the pain to subside, but after approximately three days, the pain significantly worsened. No ambulance or hospital transport was utilized following the accident. Since the accident, the patient also reports experiencing blurry vision, insomnia, and difficulty with reading and focusing.",
        "past_medical_history": "The patient has a history of Type 2 Diabetes, for which they take Metformin.",
        "previous_accidents_trauma": "* 1994: Work compensation injury to the low back, which resolved with chiropractic sessions.",
        "current_medications": "Metformin.",
        "allergies": "None noted.",
        "social_history": "None noted.",
        "review_of_systems": "Blurry vision, insomnia, difficulty reading and focusing since the accident."
    },
    "motor_exam": {
        "upper_extremity": [
            {"muscle": "Deltoid", "right": "5/5", "left": "5/5"},
            {"muscle": "Biceps", "right": "5/5", "left": "5/5"},
            {"muscle": "Triceps", "right": "5/5", "left": "5/5"},
            {"muscle": "Wrist Extensors", "right": "5/5", "left": "5/5"},
            {"muscle": "Wrist Flexors", "right": "5/5", "left": "5/5"},
            {"muscle": "Finger Abduction", "right": "5/5", "left": "5/5"}
        ],
        "lower_extremity": [
            {"muscle": "Hip Flexors", "right": "5/5", "left": "5/5"},
            {"muscle": "Knee Extension", "right": "5/5", "left": "5/5"},
            {"muscle": "Ankle Dorsiflexion", "right": "5/5", "left": "5/5"},
            {"muscle": "Extensor Hallucis Longus", "right": "5/5", "left": "5/5"},
            {"muscle": "Ankle Plantarflexion", "right": "5/5", "left": "5/5"}
        ]
    },
    "reflexes": {
        "deep_tendon": [
            {"reflex": "Biceps (C5)", "right": "2+", "left": "2+"},
            {"reflex": "Brachioradialis (C6)", "right": "2+", "left": "2+"},
            {"reflex": "Triceps (C7)", "right": "2+", "left": "2+"},
            {"reflex": "Patellar (L4)", "right": "2+", "left": "2+"},
            {"reflex": "Achilles (S1)", "right": "2+", "left": "2+"}
        ],
        "pathological": [
            {"reflex": "Babinski", "right": "Negative", "left": "Negative"},
            {"reflex": "Clonus", "right": "Negative", "left": "Negative"}
        ]
    },
    "provider_info": {
        "name": "Dr. John Smith",
        "credentials": "D.C."
    }
}

def test_reportlab_pdf():
    """Test ReportLab PDF generation"""
    print("Testing ReportLab PDF generation...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/generate-pdf",
            json=sample_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            # Save PDF
            with open("test_reportlab_output.pdf", "wb") as f:
                f.write(response.content)
            print("✓ ReportLab PDF saved as 'test_reportlab_output.pdf'")
        else:
            print(f"✗ ReportLab PDF generation failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"✗ ReportLab test error: {e}")

def test_weasyprint_pdf():
    """Test WeasyPrint PDF generation"""
    print("\nTesting WeasyPrint PDF generation...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/generate-pdf-weasyprint",
            json=sample_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            # Save PDF
            with open("test_weasyprint_output.pdf", "wb") as f:
                f.write(response.content)
            print("✓ WeasyPrint PDF saved as 'test_weasyprint_output.pdf'")
        else:
            print(f"✗ WeasyPrint PDF generation failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"✗ WeasyPrint test error: {e}")

def test_health_endpoints():
    """Test both PDF service health endpoints"""
    print("\nTesting PDF service health endpoints...")
    
    # Test ReportLab health
    try:
        response = requests.get(f"{BASE_URL}/api/pdf-service-health")
        print(f"ReportLab health: {response.json()}")
    except Exception as e:
        print(f"✗ ReportLab health check error: {e}")
    
    # Test WeasyPrint health
    try:
        response = requests.get(f"{BASE_URL}/api/pdf-service-health-weasyprint")
        print(f"WeasyPrint health: {response.json()}")
    except Exception as e:
        print(f"✗ WeasyPrint health check error: {e}")

if __name__ == "__main__":
    print("PDF Generation Comparison Test")
    print("=" * 50)
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now()}")
    print("=" * 50)
    
    # Test health endpoints first
    test_health_endpoints()
    
    # Generate PDFs
    test_reportlab_pdf()
    test_weasyprint_pdf()
    
    print("\n" + "=" * 50)
    print("Test complete! Check the generated PDFs:")
    print("- test_reportlab_output.pdf (current implementation)")
    print("- test_weasyprint_output.pdf (new implementation)")
    print("\nCompare these with your target PDF to see which is closer.")