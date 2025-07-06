#!/usr/bin/env python3
"""Test current PDF output"""

import json
import requests

# Test data matching the old PDF
test_data = {
    "patient_info": {
        "patient_name": "Patient, PI",
        "date_of_birth": "6/25/1969", 
        "date_of_accident": "08/01/2024",
        "date_of_treatment": "05/15/2024"
    },
    "clinic_info": {
        "name": "Efficient Chiropractic",
        "address": "1234 Main st\nLos Angeles, CA 90024",
        "phone": "Admin@office.com"
    },
    "sections": {
        "chief_complaint": "1. Severe neck pain radiating down the arm.\n2. Severe mid-back pain.\n3. Right knee pain.\n4. Left ankle pain.",
        "history_of_present_illness": "The patient presents today following a motor vehicle collision that occurred on August 1, 2024. The patient reports being struck by a car while walking across the street after looking over their right shoulder. The impact occurred on the right shoulder, causing the patient to fall. Immediately following the accident, the patient experienced pain around the neck and mid-back.",
        "past_medical_history": "The patient has a history of Type 2 Diabetes, for which they take Metformin."
    }
}

# Make API call
response = requests.post(
    "http://localhost:8000/api/generate-pdf",
    json=test_data,
    headers={"Content-Type": "application/json"}
)

if response.status_code == 200:
    # Save PDF
    with open("test_styled_output.pdf", "wb") as f:
        f.write(response.content)
    print(f"PDF saved successfully! Size: {len(response.content):,} bytes")
else:
    print(f"Error: {response.status_code}")
    print(response.text)