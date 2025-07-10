#!/usr/bin/env python3
"""
Test script to find patient and check re-evaluation status
"""

import requests
import json
from datetime import datetime

# Base URL
base_url = "http://localhost:5000"

# We need to authenticate first - check if there's a test token or auth mechanism
print("=== Testing Patient Re-evaluation Status ===\n")

# First, let's try to get the patients list without auth to see what happens
print("1. Attempting to get patients list...")
try:
    response = requests.get(f"{base_url}/api/v1/patients")
    print(f"   Status Code: {response.status_code}")
    
    if response.status_code == 401:
        print("   Authentication required. Looking for auth mechanism...")
        
        # Check if there's a login endpoint
        # For now, let's check if there's any dev/test auth we can use
        headers = {
            "Authorization": "Bearer test-token",  # Try a test token
            "Content-Type": "application/json"
        }
        
        response = requests.get(f"{base_url}/api/v1/patients", headers=headers)
        print(f"   With test token - Status Code: {response.status_code}")
    
    if response.status_code == 200:
        patients = response.json()
        print(f"   Found {len(patients)} patients")
        
        # Look for patient "DEF, ABC"
        patient_id = None
        for patient in patients:
            if patient.get('last_name') == 'DEF' and patient.get('first_name') == 'ABC':
                patient_id = patient.get('id')
                print(f"\n2. Found patient 'DEF, ABC' with ID: {patient_id}")
                break
        
        if patient_id:
            # Get re-evaluation status for this patient
            print(f"\n3. Getting re-evaluation status for patient {patient_id}...")
            status_response = requests.get(
                f"{base_url}/api/v1/patients/{patient_id}/re-evaluation-status",
                headers=headers if 'headers' in locals() else {}
            )
            
            print(f"   Status Code: {status_response.status_code}")
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                print(f"\n   Re-evaluation Status:")
                print(f"   - Status: {status_data.get('status')}")
                print(f"   - Message: {status_data.get('message')}")
                print(f"   - Session Count: {status_data.get('session_count')}")
                print(f"   - Color: {status_data.get('color')}")
                print(f"   - Last Evaluation Date: {status_data.get('last_evaluation_date')}")
                print(f"   - Days Since Last: {status_data.get('days_since_last')}")
                
                # Also get the patient's evaluations to debug
                print(f"\n4. Getting patient evaluations...")
                eval_response = requests.get(
                    f"{base_url}/api/v1/patients/{patient_id}/evaluations",
                    headers=headers if 'headers' in locals() else {}
                )
                
                if eval_response.status_code == 200:
                    evaluations = eval_response.json()
                    print(f"   Found {len(evaluations)} evaluations")
                    
                    for idx, eval in enumerate(evaluations[:3]):  # Show first 3
                        print(f"\n   Evaluation {idx + 1}:")
                        print(f"   - Session Type: {eval.get('session_type')}")
                        print(f"   - Created At: {eval.get('created_at')}")
                        print(f"   - Updated At: {eval.get('updated_at')}")
                        print(f"   - Session ID: {eval.get('session_id')}")
                        print(f"   - ID: {eval.get('id')}")
            else:
                print(f"   Error: {status_response.text}")
        else:
            print("\n   Patient 'DEF, ABC' not found in the list")
            print("\n   Available patients:")
            for patient in patients[:5]:  # Show first 5
                print(f"   - {patient.get('last_name')}, {patient.get('first_name')} (ID: {patient.get('id')})")
    else:
        print(f"   Error: {response.text}")
        
except Exception as e:
    print(f"   Error: {e}")

print("\n=== Test Complete ===")