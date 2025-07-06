#!/usr/bin/env python3
"""Test script to generate a sample PDF with the new styling"""

import json
from services.pdf_service.generator import MedicalPDFGenerator

# Sample medical data
sample_data = {
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
        "history_of_present_illness": "The patient presents today following a motor vehicle collision that occurred on August 1, 2024. The patient reports being struck by a car while walking across the street after looking over their right shoulder. The impact occurred on the right shoulder, causing the patient to fall. Immediately following the accident, the patient experienced pain around the neck and mid-back. Later that day, the neck pain began radiating down the arm. The patient sought care at an urgent care facility, where they received a neck X-ray and some medication. The patient waited a few days for the pain to subside, but after approximately three days, the pain significantly worsened. No ambulance or hospital transport was utilized following the accident. Since the accident, the patient also reports experiencing blurry vision, insomnia, and difficulty with reading and focusing.",
        "past_medical_history": "The patient has a history of Type 2 Diabetes, for which they take Metformin.",
        "previous_accidents": "1994: Work compensation injury to the low back, which resolved with chiropractic sessions."
    },
    "motor_exam": {
        "upper_extremity": [
            {"muscle": "Deltoids", "right": "5/5", "left": "5/5"},
            {"muscle": "Biceps", "right": "5/5", "left": "5/5"},
            {"muscle": "Triceps", "right": "5/5", "left": "5/5"},
            {"muscle": "Wrist Extensors", "right": "5/5", "left": "5/5"},
            {"muscle": "Grip Strength", "right": "5/5", "left": "5/5"}
        ],
        "lower_extremity": [
            {"muscle": "Hip Flexors", "right": "5/5", "left": "5/5"},
            {"muscle": "Quadriceps", "right": "5/5", "left": "5/5"},
            {"muscle": "Hamstrings", "right": "5/5", "left": "5/5"},
            {"muscle": "Ankle Dorsiflexors", "right": "5/5", "left": "5/5"},
            {"muscle": "Ankle Plantarflexors", "right": "5/5", "left": "5/5"}
        ]
    },
    "reflexes": {
        "deep_tendon": [
            {"reflex": "Biceps (C5-C6)", "right": "2+", "left": "2+"},
            {"reflex": "Triceps (C7)", "right": "2+", "left": "2+"},
            {"reflex": "Patellar (L4)", "right": "2+", "left": "2+"},
            {"reflex": "Achilles (S1)", "right": "2+", "left": "2+"}
        ]
    },
    "provider_info": {
        "name": "Dr. John Smith"
    }
}

# Generate PDF
generator = MedicalPDFGenerator()
pdf_bytes = generator.generate_pdf(sample_data)

# Save to file
output_path = "test_styled_output.pdf"
with open(output_path, "wb") as f:
    f.write(pdf_bytes)

print(f"PDF generated successfully: {output_path}")
print(f"PDF size: {len(pdf_bytes):,} bytes")