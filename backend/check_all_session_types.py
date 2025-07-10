#!/usr/bin/env python3
"""
Check all session types in the database
"""

import os
import asyncio
import logging
from collections import defaultdict
from google.cloud import firestore

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import the firestore client
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from firestore_client import FirestoreClient

async def check_session_types():
    """Find all session types in the database"""
    try:
        # Initialize Firestore client
        client = FirestoreClient()
        
        print("=== Analyzing Session Types Across All Patients ===\n")
        
        # Track session types
        session_types = defaultdict(int)
        evaluation_types = defaultdict(int)
        total_transcripts = 0
        patients_with_transcripts = 0
        
        # Get all patients
        patients = client.patients_collection.stream()
        
        for patient_doc in patients:
            patient_data = patient_doc.to_dict()
            patient_id = patient_doc.id
            
            # Get transcripts for this patient
            transcripts_ref = client.patients_collection.document(patient_id).collection('transcripts')
            all_transcripts = list(transcripts_ref.stream())
            
            if all_transcripts:
                patients_with_transcripts += 1
                total_transcripts += len(all_transcripts)
                
                for transcript_doc in all_transcripts:
                    transcript_data = transcript_doc.to_dict()
                    
                    # Track session type
                    session_type = transcript_data.get('session_type', 'NONE')
                    session_types[session_type] += 1
                    
                    # Track evaluation type
                    eval_type = transcript_data.get('evaluation_type', 'NONE')
                    evaluation_types[eval_type] += 1
        
        print(f"Total patients with transcripts: {patients_with_transcripts}")
        print(f"Total transcripts: {total_transcripts}")
        
        print("\n=== Session Types ===")
        for session_type, count in sorted(session_types.items(), key=lambda x: x[1], reverse=True):
            print(f"  {session_type}: {count}")
            
        print("\n=== Evaluation Types ===")
        for eval_type, count in sorted(evaluation_types.items(), key=lambda x: x[1], reverse=True):
            print(f"  {eval_type}: {count}")
        
        # Look for any transcript that might be an evaluation
        print("\n=== Looking for Evaluation-like Transcripts ===")
        patients = client.patients_collection.limit(50).stream()
        
        for patient_doc in patients:
            patient_data = patient_doc.to_dict()
            patient_id = patient_doc.id
            patient_name = f"{patient_data.get('last_name')}, {patient_data.get('first_name')}"
            
            # Get transcripts
            transcripts_ref = client.patients_collection.document(patient_id).collection('transcripts')
            all_transcripts = list(transcripts_ref.stream())
            
            for transcript_doc in all_transcripts:
                transcript_data = transcript_doc.to_dict()
                session_type = str(transcript_data.get('session_type', '')).lower()
                
                # Check if it looks like an evaluation
                if 'eval' in session_type or 'assessment' in session_type or 'initial' in session_type:
                    print(f"\nFound potential evaluation:")
                    print(f"  Patient: {patient_name}")
                    print(f"  Session Type: {transcript_data.get('session_type')}")
                    print(f"  Evaluation Type: {transcript_data.get('evaluation_type')}")
                    print(f"  Created At: {transcript_data.get('created_at')}")
                    print(f"  Session ID: {transcript_data.get('session_id')}")
                    break
            
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(check_session_types())