"""
Firestore-based session management for HIPAA-compliant production use.
Replaces in-memory sessions to survive server restarts and scale horizontally.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import logging
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from google.api_core import exceptions as gcp_exceptions
import asyncio
from functools import wraps

logger = logging.getLogger(__name__)

class FirestoreSessionManager:
    """
    Production-ready session manager using Google Firestore.
    
    Benefits:
    - Sessions survive server restarts
    - Works across multiple server instances
    - Automatic scaling
    - Built-in audit trail
    - HIPAA-compliant with encryption at rest
    """
    
    def __init__(self, timeout_minutes: int = 25):
        self.timeout_minutes = timeout_minutes
        # Use Firebase project ID for Firestore
        self.firebase_project_id = os.getenv('FIREBASE_PROJECT_ID', 'medlegaldoc-b31df')
        logger.info(f"Initializing Firestore client for project: {self.firebase_project_id}")
        self._init_firestore_client()
        
        # Create index for efficient cleanup queries
        self._ensure_indexes()
        
        # Flag to track if cleanup task has been started
        self._cleanup_task_started = False
    
    def _init_firestore_client(self):
        """Initialize or reinitialize the Firestore client."""
        try:
            self.db = firestore.Client(project=self.firebase_project_id)
            self.sessions_collection = self.db.collection('user_sessions')
            logger.info("Firestore client initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing Firestore client: {str(e)}")
            raise
    
    def _ensure_indexes(self):
        """Ensure Firestore indexes are created for efficient queries."""
        # Note: In production, these should be created via Firebase console or CLI
        # This is just documentation of required indexes
        logger.info("Required Firestore indexes: last_activity (ASC) for session cleanup")
    
    async def _ensure_cleanup_task(self):
        """Ensure the cleanup task is started when in an async context."""
        if not self._cleanup_task_started:
            self._cleanup_task_started = True
            asyncio.create_task(self._periodic_cleanup())
            logger.info("Started session cleanup background task")
    
    async def create_session(self, user_id: str) -> None:
        """Create a new session for the user."""
        # Ensure cleanup task is running
        await self._ensure_cleanup_task()
        
        try:
            now = datetime.now(timezone.utc)
            session_ref = self.sessions_collection.document(user_id)
            
            # Create or update session
            session_data = {
                'user_id': user_id,
                'created_at': now,
                'last_activity': now,
                'expires_at': now + timedelta(minutes=self.timeout_minutes),
                'active': True
            }
            session_ref.set(session_data)
            
            # Audit log for new session
            logger.info(f"AUDIT: New session created for user {user_id}")
            
        except Exception as e:
            logger.error(f"Error creating session for user {user_id}: {str(e)}")
            raise
    
    async def check_session(self, user_id: str) -> bool:
        """Check if user session is still valid."""
        # Ensure cleanup task is running
        await self._ensure_cleanup_task()
        
        try:
            # Get session document
            session_ref = self.sessions_collection.document(user_id)
            session_doc = session_ref.get()
            
            now = datetime.now(timezone.utc)
            
            if not session_doc.exists:
                # No session exists
                return False
            
            session_data = session_doc.to_dict()
            expires_at = session_data.get('expires_at')
            
            # Check if session expired
            if expires_at and expires_at < now:
                # Session expired
                session_ref.update({
                    'active': False,
                    'expired_at': now
                })
                logger.warning(f"AUDIT: Session expired for user {user_id}")
                return False
            
            # Update last activity and extend expiration
            session_ref.update({
                'last_activity': now,
                'expires_at': now + timedelta(minutes=self.timeout_minutes)
            })
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking session for user {user_id}: {str(e)}")
            # Fail closed - deny access if we can't verify session
            return False
    
    async def clear_session(self, user_id: str):
        """Clear user session on logout."""
        try:
            session_ref = self.sessions_collection.document(user_id)
            session_doc = session_ref.get()
            
            if session_doc.exists:
                # Mark as logged out instead of deleting for audit trail
                session_ref.update({
                    'active': False,
                    'logged_out_at': datetime.now(timezone.utc)
                })
                logger.info(f"AUDIT: User {user_id} logged out")
            
        except Exception as e:
            logger.error(f"Error clearing session for user {user_id}: {str(e)}")
    
    async def get_active_sessions_count(self) -> int:
        """Get count of active sessions for monitoring."""
        try:
            active_sessions = self.sessions_collection.where(
                filter=FieldFilter('active', '==', True)
            ).get()
            return len(list(active_sessions))
        except Exception as e:
            logger.error(f"Error counting active sessions: {str(e)}")
            return 0
    
    async def _periodic_cleanup(self):
        """Background task to clean up expired sessions."""
        consecutive_failures = 0
        max_consecutive_failures = 3
        
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                
                # Try to perform cleanup with retry logic
                for attempt in range(3):
                    try:
                        now = datetime.now(timezone.utc)
                        
                        # Find and mark expired sessions
                        expired_sessions = self.sessions_collection.where(
                            filter=FieldFilter('expires_at', '<', now)
                        ).where(
                            filter=FieldFilter('active', '==', True)
                        ).limit(100).get()  # Process in batches
                        
                        expired_count = 0
                        for session_doc in expired_sessions:
                            session_ref = self.sessions_collection.document(session_doc.id)
                            session_ref.update({
                                'active': False,
                                'expired_at': now
                            })
                            expired_count += 1
                        
                        if expired_count > 0:
                            logger.info(f"Cleaned up {expired_count} expired sessions")
                        
                        consecutive_failures = 0  # Reset on success
                        break  # Success, exit retry loop
                        
                    except (gcp_exceptions.ServiceUnavailable, gcp_exceptions.DeadlineExceeded, 
                            gcp_exceptions.InternalServerError, Exception) as e:
                        if attempt < 2:  # Still have retries left
                            logger.warning(f"Cleanup attempt {attempt + 1} failed, retrying: {str(e)}")
                            await asyncio.sleep(10 * (attempt + 1))  # Exponential backoff
                            
                            # Try to reinitialize client on connection errors
                            if "transport" in str(e).lower() or "connection" in str(e).lower():
                                try:
                                    self._init_firestore_client()
                                    logger.info("Reinitialized Firestore client after connection error")
                                except Exception:
                                    pass
                        else:
                            raise  # Re-raise on final attempt
                        
            except Exception as e:
                consecutive_failures += 1
                logger.error(f"Error in session cleanup (failure {consecutive_failures}/{max_consecutive_failures}): {str(e)}")
                
                # If too many consecutive failures, try to reinitialize the client
                if consecutive_failures >= max_consecutive_failures:
                    logger.warning("Too many consecutive cleanup failures, reinitializing Firestore client")
                    try:
                        self._init_firestore_client()
                        consecutive_failures = 0
                    except Exception as reinit_error:
                        logger.error(f"Failed to reinitialize Firestore client: {str(reinit_error)}")
                        # Continue anyway, will retry on next iteration

# Create singleton instance
firestore_session_manager = FirestoreSessionManager(
    timeout_minutes=int(os.getenv("SESSION_TIMEOUT_MINUTES", "25"))
)