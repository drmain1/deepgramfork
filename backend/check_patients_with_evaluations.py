#!/usr/bin/env python3
"""
Check for patients that have evaluation transcripts
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

async def check_patients_with_evaluations():
    """Find patients with evaluation transcripts"""
    try:
        # Initialize Firestore client
        client = FirestoreClient()
        
        print("=== Checking Patients with Evaluation Transcripts ===\n")
        
        # Get all patients
        patients = client.patients_collection.limit(20).stream()  # Check first 20 patients
        
        patients_with_evals = []
        
        for patient_doc in patients:
            patient_data = patient_doc.to_dict()
            patient_id = patient_doc.id
            patient_name = f"{patient_data.get('last_name')}, {patient_data.get('first_name')}"
            
            # Get transcripts for this patient
            transcripts_ref = client.patients_collection.document(patient_id).collection('transcripts')
            all_transcripts = list(transcripts_ref.stream())
            
            if all_transcripts:
                # Check for evaluations
                eval_count = 0
                for transcript_doc in all_transcripts:
                    transcript_data = transcript_doc.to_dict()
                    eval_type = transcript_data.get('evaluation_type')
                    session_type = transcript_data.get('session_type', '').lower()
                    
                    if eval_type in [EvaluationType.INITIAL, EvaluationType.RE_EVALUATION]:
                        eval_count += 1
                    elif 'evaluation' in session_type or 'eval' in session_type:
                        eval_count += 1
                
                if eval_count > 0:
                    patients_with_evals.append({
                        'id': patient_id,
                        'name': patient_name,
                        'total_transcripts': len(all_transcripts),
                        'evaluation_count': eval_count
                    })
                    print(f"Patient: {patient_name} (ID: {patient_id})")
                    print(f"  Total transcripts: {len(all_transcripts)}")
                    print(f"  Evaluation transcripts: {eval_count}")
                    print()
        
        if patients_with_evals:
            # Analyze the first patient with evaluations in detail
            print("\n=== Detailed Analysis of First Patient with Evaluations ===")
            first_patient = patients_with_evals[0]
            patient_id = first_patient['id']
            
            # Get transcripts
            transcripts_ref = client.patients_collection.document(patient_id).collection('transcripts')
            all_transcripts = list(transcripts_ref.stream())
            
            # Find evaluations
            for transcript_doc in all_transcripts:
                transcript_data = transcript_doc.to_dict()
                eval_type = transcript_data.get('evaluation_type')
                session_type = transcript_data.get('session_type', '').lower()
                
                is_eval = eval_type in [EvaluationType.INITIAL, EvaluationType.RE_EVALUATION] or \
                         'evaluation' in session_type or 'eval' in session_type
                
                if is_eval:
                    print(f"\nEvaluation Transcript:")
                    print(f"  Document ID: {transcript_doc.id}")
                    print(f"  Session Type: {transcript_data.get('session_type')}")
                    print(f"  Evaluation Type: {transcript_data.get('evaluation_type')}")
                    print(f"  Session ID: {transcript_data.get('session_id')}")
                    
                    # Check timestamps
                    created_at = transcript_data.get('created_at')
                    updated_at = transcript_data.get('updated_at')
                    
                    print(f"\n  Timestamps:")
                    print(f"    created_at: {created_at} (type: {type(created_at)})")
                    if hasattr(created_at, '_seconds'):
                        print(f"    -> {datetime.fromtimestamp(created_at._seconds, tz=timezone.utc)}")
                    
                    print(f"    updated_at: {updated_at} (type: {type(updated_at)})")
                    if hasattr(updated_at, '_seconds'):
                        print(f"    -> {datetime.fromtimestamp(updated_at._seconds, tz=timezone.utc)}")
                    
                    # Show session_id parsing
                    session_id = transcript_data.get('session_id', transcript_data.get('id', ''))
                    print(f"\n  Session ID for parsing: {session_id}")
                    parts = session_id.split('_') if session_id else []
                    print(f"  Parts: {parts}")
                    
                    break  # Just show one evaluation
        else:
            print("No patients with evaluation transcripts found in the first 20 patients.")
            
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(check_patients_with_evaluations())