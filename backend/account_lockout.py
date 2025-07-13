"""Account lockout service for HIPAA compliance - tracks failed login attempts."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
from google.cloud import firestore
from firestore_client import FirestoreClient

logger = logging.getLogger(__name__)

class AccountLockoutService:
    """Service to manage account lockout after failed login attempts."""
    
    COLLECTION_NAME = "account_lockout"
    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_DURATION_MINUTES = 30
    RESET_WINDOW_MINUTES = 15  # Reset counter after 15 minutes of no attempts
    
    def __init__(self):
        self.firestore_client = FirestoreClient()
        self.db = self.firestore_client.db
    
    async def record_failed_attempt(self, email: str, ip_address: Optional[str] = None) -> Dict[str, any]:
        """Record a failed login attempt.
        
        Args:
            email: The email address that failed to login
            ip_address: The IP address of the attempt
            
        Returns:
            Dict with lockout status and remaining attempts
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION_NAME).document(email.lower())
            
            # Get current lockout data
            doc = doc_ref.get()
            current_time = datetime.now(timezone.utc)
            
            if doc.exists:
                data = doc.to_dict()
                
                # Check if account is currently locked
                if data.get('locked_until'):
                    locked_until = data['locked_until']
                    if isinstance(locked_until, datetime):
                        if current_time < locked_until:
                            remaining_minutes = int((locked_until - current_time).total_seconds() / 60)
                            return {
                                "is_locked": True,
                                "locked_until": locked_until.isoformat(),
                                "remaining_minutes": remaining_minutes,
                                "message": f"Account is locked. Try again in {remaining_minutes} minutes."
                            }
                
                # Check if we should reset the counter (no attempts in reset window)
                last_attempt = data.get('last_attempt')
                if last_attempt and isinstance(last_attempt, datetime):
                    time_since_last = current_time - last_attempt
                    if time_since_last > timedelta(minutes=self.RESET_WINDOW_MINUTES):
                        # Reset the counter
                        data['failed_attempts'] = 0
                
                # Increment failed attempts
                failed_attempts = data.get('failed_attempts', 0) + 1
                
            else:
                # First failed attempt
                failed_attempts = 1
                data = {}
            
            # Update the document
            update_data = {
                'failed_attempts': failed_attempts,
                'last_attempt': current_time,
                'last_ip': ip_address,
                'updated_at': current_time
            }
            
            # Check if we need to lock the account
            if failed_attempts >= self.MAX_FAILED_ATTEMPTS:
                locked_until = current_time + timedelta(minutes=self.LOCKOUT_DURATION_MINUTES)
                update_data['locked_until'] = locked_until
                update_data['locked_at'] = current_time
                
                # Log security event
                logger.warning(f"Account locked due to {failed_attempts} failed attempts: {email} from IP {ip_address}")
                
                doc_ref.set(update_data, merge=True)
                
                return {
                    "is_locked": True,
                    "locked_until": locked_until.isoformat(),
                    "remaining_minutes": self.LOCKOUT_DURATION_MINUTES,
                    "message": f"Account locked due to too many failed attempts. Try again in {self.LOCKOUT_DURATION_MINUTES} minutes."
                }
            
            doc_ref.set(update_data, merge=True)
            
            remaining_attempts = self.MAX_FAILED_ATTEMPTS - failed_attempts
            return {
                "is_locked": False,
                "failed_attempts": failed_attempts,
                "remaining_attempts": remaining_attempts,
                "message": f"Invalid credentials. {remaining_attempts} attempts remaining before account lockout."
            }
            
        except Exception as e:
            logger.error(f"Error recording failed login attempt: {e}")
            # Don't block login on lockout service errors
            return {
                "is_locked": False,
                "error": "Could not check account status"
            }
    
    async def check_lockout_status(self, email: str) -> Dict[str, any]:
        """Check if an account is locked.
        
        Args:
            email: The email address to check
            
        Returns:
            Dict with lockout status
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION_NAME).document(email.lower())
            doc = doc_ref.get()
            
            if not doc.exists:
                return {"is_locked": False}
            
            data = doc.to_dict()
            current_time = datetime.now(timezone.utc)
            
            # Check if account is locked
            locked_until = data.get('locked_until')
            if locked_until and isinstance(locked_until, datetime):
                if current_time < locked_until:
                    remaining_minutes = int((locked_until - current_time).total_seconds() / 60)
                    return {
                        "is_locked": True,
                        "locked_until": locked_until.isoformat(),
                        "remaining_minutes": remaining_minutes,
                        "message": f"Account is locked. Try again in {remaining_minutes} minutes."
                    }
            
            return {
                "is_locked": False,
                "failed_attempts": data.get('failed_attempts', 0)
            }
            
        except Exception as e:
            logger.error(f"Error checking lockout status: {e}")
            return {"is_locked": False, "error": "Could not check account status"}
    
    async def clear_failed_attempts(self, email: str) -> None:
        """Clear failed attempts after successful login.
        
        Args:
            email: The email address to clear
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION_NAME).document(email.lower())
            doc_ref.delete()
            logger.info(f"Cleared failed login attempts for: {email}")
        except Exception as e:
            logger.error(f"Error clearing failed attempts: {e}")
    
    async def unlock_account(self, email: str) -> Dict[str, any]:
        """Manually unlock an account (admin function).
        
        Args:
            email: The email address to unlock
            
        Returns:
            Dict with unlock status
        """
        try:
            doc_ref = self.db.collection(self.COLLECTION_NAME).document(email.lower())
            doc = doc_ref.get()
            
            if not doc.exists:
                return {"success": False, "message": "Account not found in lockout records"}
            
            # Clear the lockout
            doc_ref.delete()
            logger.info(f"Account manually unlocked: {email}")
            
            return {"success": True, "message": "Account unlocked successfully"}
            
        except Exception as e:
            logger.error(f"Error unlocking account: {e}")
            return {"success": False, "error": str(e)}

# Global instance
account_lockout_service = AccountLockoutService()