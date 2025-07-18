#!/usr/bin/env python3
"""
Test script to debug transcript polishing issue
"""

import os
import asyncio
import json
from datetime import datetime, timezone
from firestore_client import firestore_client
from gcp_utils import polish_transcript_with_gemini
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_transcript_polish():
    """Test the transcript polishing process"""
    
    # Test transcript ID from the screenshot
    transcript_id = "222-111"  # Adjust this to your actual transcript ID
    
    print(f"\n=== Testing Transcript Polish for ID: {transcript_id} ===\n")
    
    try:
        # 1. Get the transcript from Firestore
        print("1. Fetching transcript from Firestore...")
        transcript = await firestore_client.get_transcript(transcript_id)
        
        if not transcript:
            print(f"ERROR: Transcript {transcript_id} not found in Firestore")
            return
            
        print(f"   ✓ Found transcript: {transcript.get('session_id')}")
        print(f"   - Status: {transcript.get('status')}")
        print(f"   - Has original transcript: {bool(transcript.get('transcript_original'))}")
        print(f"   - Original length: {len(transcript.get('transcript_original', ''))}")
        print(f"   - Has polished transcript: {bool(transcript.get('transcript_polished'))}")
        print(f"   - Polished length: {len(transcript.get('transcript_polished', ''))}")
        
        # 2. Check if polished transcript exists
        if transcript.get('transcript_polished'):
            print("\n2. Polished transcript already exists!")
            print(f"   Preview: {transcript.get('transcript_polished')[:200]}...")
            return
            
        # 3. If not, try to polish it
        print("\n2. No polished transcript found. Attempting to polish...")
        
        original_content = transcript.get('transcript_original', '')
        if not original_content:
            print("   ERROR: No original transcript content to polish")
            return
            
        # Get template instructions
        custom_instructions = "You are transcribing a medical encounter. Please polish and format the transcript appropriately."
        
        print("\n3. Calling polish_transcript_with_gemini...")
        result = polish_transcript_with_gemini(
            transcript=original_content,
            patient_name=transcript.get('patient_name', ''),
            patient_context=transcript.get('patient_context', ''),
            encounter_type=transcript.get('encounter_type', ''),
            llm_instructions=custom_instructions,
            location=transcript.get('location', '')
        )
        
        print(f"\n4. Polish result:")
        print(f"   - Success: {result.get('success')}")
        if result.get('success'):
            print(f"   - Polished length: {len(result.get('polished_transcript', ''))}")
            print(f"   - Preview: {result.get('polished_transcript', '')[:200]}...")
            
            # 5. Update Firestore
            print("\n5. Updating Firestore with polished transcript...")
            await firestore_client.update_transcript(transcript_id, {
                'transcript_polished': result['polished_transcript'],
                'updated_at': datetime.now(timezone.utc).isoformat()
            })
            print("   ✓ Updated successfully!")
            
            # 6. Verify the update
            print("\n6. Verifying update...")
            updated = await firestore_client.get_transcript(transcript_id)
            if updated.get('transcript_polished'):
                print("   ✓ Polished transcript saved successfully!")
            else:
                print("   ✗ ERROR: Polished transcript not saved")
                
        else:
            print(f"   - Error: {result.get('error')}")
            
    except Exception as e:
        print(f"\nERROR during test: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_transcript_polish())