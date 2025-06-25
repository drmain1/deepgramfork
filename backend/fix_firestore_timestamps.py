#!/usr/bin/env python3
"""
One-time migration script to fix recording timestamps in Firestore.
Parses the session_id to extract the actual recording start time.
"""

import asyncio
import logging
from datetime import datetime, timezone
from firestore_client import firestore_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fix_timestamps():
    """Fix timestamps for all transcripts by parsing session_id"""
    
    try:
        # Get all transcripts
        transcripts_ref = firestore_client.transcripts_collection
        docs = transcripts_ref.stream()
        
        fixed_count = 0
        error_count = 0
        total_count = 0
        
        for doc in docs:
            total_count += 1
            transcript = doc.to_dict()
            session_id = doc.id
            
            # Check if session_id is in timestamp format
            if len(session_id) >= 14 and session_id[:14].isdigit():
                try:
                    # Parse timestamp from session_id
                    parsed_date = datetime.strptime(session_id[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
                    
                    # Get current created_at
                    current_created_at = transcript.get('created_at')
                    if current_created_at:
                        try:
                            current_date = datetime.fromisoformat(current_created_at.replace('Z', '+00:00'))
                            
                            # Only update if parsed date is earlier (more accurate)
                            if parsed_date < current_date:
                                time_diff = current_date - parsed_date
                                logger.info(f"Fixing {session_id}: {current_created_at} -> {parsed_date.isoformat()} (diff: {time_diff})")
                                
                                # Update the document
                                doc.reference.update({
                                    'created_at': parsed_date.isoformat()
                                })
                                fixed_count += 1
                            else:
                                logger.debug(f"Skipping {session_id}: timestamp already correct")
                        except Exception as e:
                            logger.warning(f"Error parsing existing date for {session_id}: {e}")
                    else:
                        # No created_at field, set it
                        logger.info(f"Setting missing created_at for {session_id}: {parsed_date.isoformat()}")
                        doc.reference.update({
                            'created_at': parsed_date.isoformat()
                        })
                        fixed_count += 1
                        
                except Exception as e:
                    logger.error(f"Error processing {session_id}: {e}")
                    error_count += 1
            else:
                logger.debug(f"Skipping {session_id}: not a timestamp-based ID")
        
        logger.info(f"\nMigration complete!")
        logger.info(f"Total documents: {total_count}")
        logger.info(f"Fixed: {fixed_count}")
        logger.info(f"Errors: {error_count}")
        logger.info(f"Skipped: {total_count - fixed_count - error_count}")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(fix_timestamps())