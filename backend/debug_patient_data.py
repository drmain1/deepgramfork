#!/usr/bin/env python3
"""
Debug script to inspect Firestore data for patient "DEF, ABC"
"""

import os
from datetime import datetime, timezone
from google.cloud import firestore
from google.oauth2 import service_account

# Initialize Firestore
if os.path.exists('service-account-key.json'):
    credentials = service_account.Credentials.from_service_account_file(
        'service-account-key.json'
    )
    db = firestore.Client(credentials=credentials, project='patient-progress-tracker')
else:
    db = firestore.Client(project='patient-progress-tracker')

print("=== Debugging Patient Data for 'DEF, ABC' ===\n")

# First, find the patient
patients_ref = db.collection('patients')
patients = patients_ref.where('last_name', '==', 'DEF').where('first_name', '==', 'ABC').stream()

patient_found = False
for patient in patients:
    patient_found = True
    patient_data = patient.to_dict()
    patient_id = patient.id
    
    print(f"Found patient: {patient_id}")
    print(f"Patient data: {patient_data}\n")
    
    # Get all transcripts for this patient
    transcripts_ref = db.collection('patients').document(patient_id).collection('transcripts')
    all_transcripts = list(transcripts_ref.stream())
    
    print(f"Total transcripts found: {len(all_transcripts)}\n")
    
    # Separate evaluation and non-evaluation transcripts
    evaluation_transcripts = []
    non_evaluation_transcripts = []
    
    for transcript in all_transcripts:
        transcript_data = transcript.to_dict()
        session_type = transcript_data.get('session_type', '').lower()
        
        if 'evaluation' in session_type or 'eval' in session_type:
            evaluation_transcripts.append((transcript.id, transcript_data))
        else:
            non_evaluation_transcripts.append((transcript.id, transcript_data))
    
    print(f"Evaluation transcripts: {len(evaluation_transcripts)}")
    print(f"Non-evaluation transcripts: {len(non_evaluation_transcripts)}\n")
    
    # Analyze evaluation transcripts
    print("=== Evaluation Transcripts Analysis ===")
    for idx, (transcript_id, transcript_data) in enumerate(evaluation_transcripts):
        print(f"\nEvaluation {idx + 1}:")
        print(f"  Transcript ID: {transcript_id}")
        print(f"  Session Type: {transcript_data.get('session_type', 'MISSING')}")
        print(f"  Session ID: {transcript_data.get('session_id', 'MISSING')}")
        print(f"  Document ID: {transcript_data.get('id', 'MISSING')}")
        
        # Check timestamp fields
        print("\n  Timestamp fields:")
        created_at = transcript_data.get('created_at')
        updated_at = transcript_data.get('updated_at')
        
        print(f"    created_at: {created_at} (type: {type(created_at).__name__})")
        if created_at and hasattr(created_at, '_nanoseconds'):
            print(f"      -> Firestore Timestamp: {created_at}")
        
        print(f"    updated_at: {updated_at} (type: {type(updated_at).__name__})")
        if updated_at and hasattr(updated_at, '_nanoseconds'):
            print(f"      -> Firestore Timestamp: {updated_at}")
        
        # Try to parse timestamps using the same logic as the backend
        print("\n  Parsing attempts:")
        
        # Helper function (same as in backend)
        def get_timestamp(transcript):
            # Try created_at first
            if transcript.get('created_at'):
                try:
                    created_at = transcript['created_at']
                    if isinstance(created_at, str):
                        return datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    elif hasattr(created_at, 'isoformat'):
                        return created_at
                except Exception as e:
                    print(f"      created_at parse error: {e}")
            
            # Try updated_at as fallback
            if transcript.get('updated_at'):
                try:
                    updated_at = transcript['updated_at']
                    if isinstance(updated_at, str):
                        return datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                    elif hasattr(updated_at, 'isoformat'):
                        return updated_at
                except Exception as e:
                    print(f"      updated_at parse error: {e}")
            
            # Try parsing from session_id
            session_id = transcript.get('session_id', transcript.get('id', ''))
            try:
                parts = session_id.split('_')
                if len(parts) >= 3:
                    date_part = parts[-3]  # YYYYMMDD
                    time_part = parts[-2]  # HHMMSS
                    
                    year = int(date_part[:4])
                    month = int(date_part[4:6])
                    day = int(date_part[6:8])
                    hour = int(time_part[:2])
                    minute = int(time_part[2:4])
                    second = int(time_part[4:6])
                    
                    parsed_date = datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)
                    print(f"      Successfully parsed from session_id: {parsed_date}")
                    return parsed_date
            except Exception as e:
                print(f"      session_id parse error: {e}")
            
            return None
        
        parsed_timestamp = get_timestamp(transcript_data)
        print(f"    Final parsed timestamp: {parsed_timestamp}")
        
        # Show all available fields
        print("\n  All fields in transcript:")
        for key, value in transcript_data.items():
            value_str = str(value)[:100] + "..." if len(str(value)) > 100 else str(value)
            print(f"    {key}: {value_str} (type: {type(value).__name__})")

if not patient_found:
    print("Patient 'DEF, ABC' not found in Firestore!")

print("\n=== Debug Complete ===")