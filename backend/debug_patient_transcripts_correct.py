#!/usr/bin/env python3
"""
Debug transcripts for patient DEF, ABC using correct collection structure
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

async def debug_patient_transcripts():
    """Debug transcripts for DEF, ABC"""
    try:
        # Initialize Firestore client
        client = FirestoreClient()
        
        print("=== Finding Patient DEF, ABC ===")
        
        # Find the patient (with trailing space)
        patients = client.patients_collection.where('last_name', '==', 'DEF').where('first_name', '==', 'ABC ').stream()
        
        patient_found = False
        for patient_doc in patients:
            patient_found = True
            patient_data = patient_doc.to_dict()
            patient_id = patient_doc.id
            
            print(f"\nFound Patient:")
            print(f"  ID: {patient_id}")
            print(f"  Name: {patient_data.get('last_name')}, {patient_data.get('first_name')}")
            
            # Get transcripts from top-level collection for this patient
            print(f"\n=== Checking Transcripts for Patient {patient_id} ===")
            
            transcripts = client.transcripts_collection.where('patient_id', '==', patient_id).stream()
            transcript_list = list(transcripts)
            
            print(f"\nTotal transcripts found: {len(transcript_list)}")
            
            # Analyze each transcript
            evaluations = []
            for idx, transcript_doc in enumerate(transcript_list):
                transcript_data = transcript_doc.to_dict()
                
                print(f"\n--- Transcript {idx + 1} ---")
                print(f"  Document ID: {transcript_doc.id}")
                print(f"  Session Type: {transcript_data.get('session_type')}")
                print(f"  Evaluation Type: {transcript_data.get('evaluation_type')}")
                print(f"  Status: {transcript_data.get('status')}")
                
                # Check if it's an evaluation
                eval_type = transcript_data.get('evaluation_type')
                session_type = str(transcript_data.get('session_type', '')).lower()
                
                is_eval = eval_type in [EvaluationType.INITIAL, EvaluationType.RE_EVALUATION] or \
                         'evaluation' in session_type or 'eval' in session_type
                
                if is_eval:
                    evaluations.append(transcript_data)
                    print("  >> This is an EVALUATION transcript")
                
                # Check timestamps
                created_at = transcript_data.get('created_at')
                updated_at = transcript_data.get('updated_at')
                session_id = transcript_data.get('session_id', transcript_doc.id)
                
                print(f"\n  Timestamps:")
                print(f"    created_at: {created_at} (type: {type(created_at)})")
                print(f"    updated_at: {updated_at} (type: {type(updated_at)})")
                print(f"    session_id: {session_id}")
                
                # Try parsing session_id
                if session_id:
                    parts = session_id.split('_')
                    print(f"    session_id parts: {parts}")
            
            print(f"\n=== Summary ===")
            print(f"Total transcripts: {len(transcript_list)}")
            print(f"Evaluation transcripts: {len(evaluations)}")
            
            if not evaluations and len(transcript_list) > 0:
                print("\nNo evaluation transcripts found, but patient has regular transcripts.")
                print("This would trigger the 'No valid evaluation dates found' message.")
        
        if not patient_found:
            print("Patient not found!")
            
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(debug_patient_transcripts())