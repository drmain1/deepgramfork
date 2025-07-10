#!/usr/bin/env python3
"""
Script to fix missing created_at timestamps in Firestore transcripts.
This ensures re-evaluation status tracking works correctly.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from firebase_admin import firestore
from firestore_client import firestore_client
from firestore_models import EvaluationType
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def parse_datetime_from_session_id(session_id: str) -> datetime:
    """Extract datetime from session ID format: abc_20231225_140530_123"""
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
            
            return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)
    except Exception as e:
        logger.warning(f"Failed to parse datetime from session_id {session_id}: {e}")
        return None


async def fix_transcript_timestamps(dry_run=True):
    """Fix missing created_at timestamps in transcripts"""
    
    logger.info(f"Starting timestamp fix script (dry_run={dry_run})")
    
    # Get Firestore client
    db = firestore_client.db
    
    # Query all transcripts
    transcripts_ref = db.collection('transcripts')
    docs = transcripts_ref.stream()
    
    fixed_count = 0
    total_count = 0
    evaluation_count = 0
    
    for doc in docs:
        total_count += 1
        transcript_data = doc.to_dict()
        session_id = doc.id
        
        # Check if this is an evaluation
        eval_type = transcript_data.get('evaluation_type')
        is_evaluation = eval_type in [EvaluationType.INITIAL, EvaluationType.RE_EVALUATION]
        
        if is_evaluation:
            evaluation_count += 1
        
        # Check if created_at is missing or invalid
        created_at = transcript_data.get('created_at')
        needs_fix = False
        
        if not created_at:
            logger.info(f"Missing created_at for {session_id} (eval_type: {eval_type})")
            needs_fix = True
        else:
            # Verify it's a valid timestamp
            try:
                if isinstance(created_at, str):
                    datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                elif not hasattr(created_at, 'isoformat'):
                    logger.warning(f"Invalid created_at type for {session_id}: {type(created_at)}")
                    needs_fix = True
            except Exception as e:
                logger.warning(f"Invalid created_at format for {session_id}: {created_at}")
                needs_fix = True
        
        if needs_fix:
            # Try to determine the correct timestamp
            new_timestamp = None
            
            # First try: Parse from session_id
            parsed_time = await parse_datetime_from_session_id(session_id)
            if parsed_time:
                new_timestamp = parsed_time
                logger.info(f"  Using parsed timestamp from session_id: {new_timestamp.isoformat()}")
            
            # Second try: Use updated_at if available
            elif transcript_data.get('updated_at'):
                updated_at = transcript_data['updated_at']
                if hasattr(updated_at, 'isoformat'):
                    new_timestamp = updated_at
                    logger.info(f"  Using updated_at timestamp: {new_timestamp.isoformat()}")
                elif isinstance(updated_at, str):
                    try:
                        new_timestamp = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                        logger.info(f"  Using parsed updated_at: {new_timestamp.isoformat()}")
                    except Exception:
                        pass
            
            # Third try: Use current time as last resort
            if not new_timestamp:
                new_timestamp = datetime.now(timezone.utc)
                logger.warning(f"  Using current time as fallback: {new_timestamp.isoformat()}")
            
            if not dry_run:
                # Update the document
                try:
                    doc.reference.update({
                        'created_at': new_timestamp.isoformat()
                    })
                    logger.info(f"  ✓ Updated {session_id}")
                    fixed_count += 1
                except Exception as e:
                    logger.error(f"  ✗ Failed to update {session_id}: {e}")
            else:
                logger.info(f"  [DRY RUN] Would update {session_id}")
                fixed_count += 1
    
    logger.info(f"\nSummary:")
    logger.info(f"  Total transcripts: {total_count}")
    logger.info(f"  Total evaluations: {evaluation_count}")
    logger.info(f"  Fixed timestamps: {fixed_count}")
    
    if dry_run:
        logger.info("\nThis was a DRY RUN. No changes were made.")
        logger.info("Run with --execute to apply changes.")


async def main():
    """Main entry point"""
    dry_run = "--execute" not in sys.argv
    
    if not dry_run:
        response = input("This will modify production data. Are you sure? (yes/no): ")
        if response.lower() != 'yes':
            logger.info("Aborting.")
            return
    
    await fix_transcript_timestamps(dry_run)


if __name__ == "__main__":
    asyncio.run(main())