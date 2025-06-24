"""
Simple in-memory session manager for development.
For production, consider using Redis or similar distributed cache.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

class MemorySessionManager:
    """
    In-memory session manager for single-instance deployments.
    Sessions are lost on server restart.
    """
    
    def __init__(self, timeout_minutes: int = 25):
        self.timeout_minutes = timeout_minutes
        self.sessions: Dict[str, datetime] = {}
        self._cleanup_task = None
        
    async def check_session(self, user_id: str) -> bool:
        """Check if user session is still valid."""
        now = datetime.now(timezone.utc)
        
        # Check if session exists and is still valid
        if user_id in self.sessions:
            expires_at = self.sessions[user_id]
            if expires_at > now:
                # Extend session
                self.sessions[user_id] = now + timedelta(minutes=self.timeout_minutes)
                return True
            else:
                # Session expired
                del self.sessions[user_id]
                logger.warning(f"Session expired for user: {user_id}")
                return False
        
        # Create new session
        self.sessions[user_id] = now + timedelta(minutes=self.timeout_minutes)
        logger.info(f"New session created for user {user_id}")
        
        # Start cleanup task if not already running
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
            
        return True
    
    async def clear_session(self, user_id: str):
        """Clear user session on logout."""
        if user_id in self.sessions:
            del self.sessions[user_id]
            logger.info(f"User {user_id} logged out")
    
    async def get_active_sessions_count(self) -> int:
        """Get count of active sessions."""
        return len(self.sessions)
    
    async def _periodic_cleanup(self):
        """Periodically clean up expired sessions."""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                
                now = datetime.now(timezone.utc)
                expired_users = [
                    user_id for user_id, expires_at in self.sessions.items()
                    if expires_at <= now
                ]
                
                for user_id in expired_users:
                    del self.sessions[user_id]
                    
                if expired_users:
                    logger.info(f"Cleaned up {len(expired_users)} expired sessions")
                    
            except Exception as e:
                logger.error(f"Error in session cleanup: {str(e)}")

# Create singleton instance
memory_session_manager = MemorySessionManager(
    timeout_minutes=25  # Default 25 minutes for HIPAA compliance
)