#!/usr/bin/env python3
"""
Quick fix for a single recording's timestamp.
This corrects the timezone interpretation issue.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from firestore_client import firestore_client

async def fix_single_recording(session_id: str, timezone_offset_hours: float = -7.0):
    """
    Fix a single recording's timestamp by adjusting for timezone difference.
    
    Args:
        session_id: The session ID to fix
        timezone_offset_hours: Hours offset from UTC (e.g., -7 for PDT, -8 for PST)
    """
    try:
        # Get the transcript
        transcript = await firestore_client.get_transcript(session_id)
        if not transcript:
            print(f"Recording {session_id} not found")
            return
        
        # Parse the session ID to get the actual recording time
        if len(session_id) >= 14 and session_id[:14].isdigit():
            # This was the actual local time when recorded
            actual_time = datetime.strptime(session_id[:14], "%Y%m%d%H%M%S")
            
            # The current created_at assumes this was UTC, but it was actually local time
            # So we need to subtract the timezone offset to get the correct UTC time
            corrected_utc = actual_time - timedelta(hours=timezone_offset_hours)
            corrected_utc = corrected_utc.replace(tzinfo=timezone.utc)
            
            print(f"Session ID time: {actual_time} (local)")
            print(f"Current created_at: {transcript.get('created_at')}")
            print(f"Corrected UTC time: {corrected_utc.isoformat()}")
            
            # Update the transcript
            await firestore_client.update_transcript(session_id, {
                'created_at': corrected_utc.isoformat()
            })
            
            print(f"✓ Successfully updated timestamp for {session_id}")
        else:
            print(f"Session ID {session_id} doesn't follow timestamp format")
            
    except Exception as e:
        print(f"Error fixing timestamp: {e}")

if __name__ == "__main__":
    # Fix the specific recording
    # Using PDT offset (-7 hours from UTC)
    asyncio.run(fix_single_recording("20250624180119752609", -7.0))