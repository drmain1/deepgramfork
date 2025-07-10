#!/usr/bin/env python3
"""
Direct Firestore debug script for patient "DEF, ABC"
"""

import os
import asyncio
import logging
from datetime import datetime, timezone
from google.cloud import firestore

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import the firestore client
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from firestore_client import FirestoreClient
from firestore_models import EvaluationType

async def debug_patient_data():
    """Debug patient data for DEF, ABC"""
    try:
        # Initialize Firestore client
        client = FirestoreClient()
        
        # Find the patient "DEF, ABC" - try with trailing space
        patients = client.patients_collection.where('last_name', '==', 'DEF').where('first_name', '==', 'ABC ').stream()
        
        patient_found = False
        for patient_doc in patients:
            patient_found = True
            patient_data = patient_doc.to_dict()
            patient_id = patient_doc.id
            
            print(f"\n=== Found Patient ===")
            print(f"Patient ID: {patient_id}")
            print(f"Name: {patient_data.get('last_name')}, {patient_data.get('first_name')}")
            
            # Get transcripts for this patient
            transcripts_ref = client.patients_collection.document(patient_id).collection('transcripts')
            all_transcripts = list(transcripts_ref.stream())
            
            print(f"\nTotal transcripts: {len(all_transcripts)}")
            
            # Filter for evaluations
            evaluations = []
            for transcript_doc in all_transcripts:
                transcript_data = transcript_doc.to_dict()
                eval_type = transcript_data.get('evaluation_type')
                
                # Check both evaluation_type and session_type fields
                session_type = transcript_data.get('session_type', '').lower()
                
                if eval_type in [EvaluationType.INITIAL, EvaluationType.RE_EVALUATION]:
                    evaluations.append(transcript_data)
                elif 'evaluation' in session_type or 'eval' in session_type:
                    evaluations.append(transcript_data)
            
            print(f"\nEvaluation transcripts found: {len(evaluations)}")
            
            # Analyze each evaluation
            for idx, eval_data in enumerate(evaluations):
                print(f"\n--- Evaluation {idx + 1} ---")
                print(f"Session Type: {eval_data.get('session_type')}")
                print(f"Evaluation Type: {eval_data.get('evaluation_type')}")
                print(f"Session ID: {eval_data.get('session_id')}")
                print(f"Document ID: {eval_data.get('id')}")
                
                # Check timestamp fields
                created_at = eval_data.get('created_at')
                updated_at = eval_data.get('updated_at')
                
                print(f"\nTimestamp fields:")
                print(f"  created_at: {created_at}")
                print(f"  created_at type: {type(created_at)}")
                if hasattr(created_at, '_seconds'):
                    print(f"  created_at timestamp: {datetime.fromtimestamp(created_at._seconds, tz=timezone.utc)}")
                
                print(f"  updated_at: {updated_at}")
                print(f"  updated_at type: {type(updated_at)}")
                if hasattr(updated_at, '_seconds'):
                    print(f"  updated_at timestamp: {datetime.fromtimestamp(updated_at._seconds, tz=timezone.utc)}")
                
                # Try parsing session_id
                session_id = eval_data.get('session_id', eval_data.get('id', ''))
                print(f"\nParsing session_id: {session_id}")
                try:
                    parts = session_id.split('_')
                    print(f"  Parts: {parts}")
                    if len(parts) >= 3:
                        date_part = parts[-3]
                        time_part = parts[-2]
                        print(f"  Date part: {date_part}")
                        print(f"  Time part: {time_part}")
                        
                        parsed_date = datetime(
                            int(date_part[:4]), int(date_part[4:6]), int(date_part[6:8]),
                            int(time_part[:2]), int(time_part[2:4]), int(time_part[4:6]),
                            tzinfo=timezone.utc
                        )
                        print(f"  Parsed date: {parsed_date}")
                except Exception as e:
                    print(f"  Parse error: {e}")
                
                # Show all fields
                print(f"\nAll fields in evaluation:")
                for key, value in eval_data.items():
                    if key not in ['created_at', 'updated_at', 'session_id', 'id', 'session_type', 'evaluation_type']:
                        value_str = str(value)[:50] + "..." if len(str(value)) > 50 else str(value)
                        print(f"  {key}: {value_str}")
        
        if not patient_found:
            print("Patient 'DEF, ABC' not found!")
            
            # List all patients to find any with DEF or ABC in the name
            print("\nListing all patients to find DEF/ABC:")
            patients = client.patients_collection.stream()
            for patient_doc in patients:
                patient_data = patient_doc.to_dict()
                last_name = patient_data.get('last_name', '')
                first_name = patient_data.get('first_name', '')
                
                # Check if DEF or ABC appears in the name (case-insensitive)
                if 'def' in last_name.lower() or 'abc' in first_name.lower() or \
                   'def' in first_name.lower() or 'abc' in last_name.lower():
                    print(f"  - {last_name}, {first_name} (ID: {patient_doc.id})")
                    print(f"    Evaluation Type: {patient_data.get('evaluation_type')}")
                    print(f"    Session Type: {patient_data.get('session_type')}")
    
    except Exception as e:
        logger.error(f"Error in debug script: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(debug_patient_data())