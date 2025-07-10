#!/usr/bin/env python3
"""
Test script to call the re-evaluation status API endpoint
"""

import requests
import json

# API endpoint
url = "http://localhost:5000/api/patients/re-evaluation-status"

print("=== Testing Re-evaluation Status API ===\n")

try:
    response = requests.get(url)
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        
        # Find the patient "DEF, ABC"
        patient_found = False
        for patient in data:
            if patient.get('patient_name') == 'DEF, ABC':
                patient_found = True
                print(f"\nFound patient: {patient.get('patient_name')}")
                print(f"Status: {patient.get('status')}")
                print(f"Message: {patient.get('message')}")
                print(f"Session Count: {patient.get('session_count')}")
                print(f"Color: {patient.get('color')}")
                print(f"Last Evaluation Date: {patient.get('last_evaluation_date')}")
                print(f"Last Evaluation Type: {patient.get('last_evaluation_type')}")
                print(f"Days Since Last: {patient.get('days_since_last')}")
                print(f"Sessions Since Evaluation: {patient.get('sessions_since_evaluation')}")
                break
        
        if not patient_found:
            print("\nPatient 'DEF, ABC' not found in response")
            print("\nAll patients in response:")
            for patient in data:
                print(f"  - {patient.get('patient_name')}: {patient.get('message')}")
    else:
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"Error making request: {e}")

print("\n=== Test Complete ===")