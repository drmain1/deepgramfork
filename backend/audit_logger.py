import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from google.cloud import logging as cloud_logging
from google.cloud.logging import DESCENDING
from fastapi import Request

# Initialize Cloud Logging client
try:
    if os.getenv("ENVIRONMENT") != "development":
        logging_client = cloud_logging.Client()
        audit_logger = logging_client.logger("medical-transcription-audit")
    else:
        audit_logger = None
except Exception as e:
    print(f"Failed to initialize Cloud Logging: {str(e)}")
    audit_logger = None

# Also use local logger as fallback
local_logger = logging.getLogger("audit")

class AuditLogger:
    """HIPAA-compliant audit logging system."""
    
    @staticmethod
    def log_access(
        user_id: str,
        action: str,
        resource: str,
        request: Request,
        success: bool = True,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Log user access for HIPAA compliance.
        
        Args:
            user_id: User identifier
            action: Action performed (e.g., "READ", "WRITE", "DELETE")
            resource: Resource accessed (e.g., "transcript/session123")
            request: FastAPI request object
            success: Whether the action was successful
            details: Additional details to log
        """
        try:
            # Extract client IP
            client_ip = request.client.host if request.client else "unknown"
            
            # Check for forwarded IP (when behind proxy/IAP)
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                client_ip = forwarded_for.split(",")[0].strip()
            
            # Build audit entry
            audit_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": user_id,
                "action": action,
                "resource": resource,
                "success": success,
                "ip_address": client_ip,
                "user_agent": request.headers.get("User-Agent", "unknown"),
                "request_id": request.headers.get("X-Request-Id", "unknown"),
                "method": request.method,
                "path": str(request.url.path),
                "query_params": dict(request.query_params),
                "severity": "INFO" if success else "WARNING"
            }
            
            # Add optional details
            if details:
                audit_entry["details"] = details
            
            # Log to Cloud Logging if available
            if audit_logger:
                audit_logger.log_struct(
                    audit_entry,
                    severity=audit_entry["severity"]
                )
            
            # Always log locally as well
            local_logger.info(f"AUDIT: {json.dumps(audit_entry)}")
            
        except Exception as e:
            local_logger.error(f"Failed to log audit entry: {str(e)}")
    
    @staticmethod
    def log_authentication(
        user_id: Optional[str],
        action: str,
        success: bool,
        request: Request,
        failure_reason: Optional[str] = None
    ):
        """
        Log authentication events.
        
        Args:
            user_id: User identifier (may be None for failed attempts)
            action: Auth action (e.g., "LOGIN", "LOGOUT", "TOKEN_REFRESH")
            success: Whether authentication succeeded
            request: FastAPI request object
            failure_reason: Reason for failure if applicable
        """
        details = {}
        if failure_reason:
            details["failure_reason"] = failure_reason
        
        AuditLogger.log_access(
            user_id=user_id or "anonymous",
            action=f"AUTH_{action}",
            resource="authentication",
            request=request,
            success=success,
            details=details
        )
    
    @staticmethod
    def log_data_access(
        user_id: str,
        operation: str,
        data_type: str,
        resource_id: str,
        request: Request,
        success: bool = True
    ):
        """
        Log data access events.
        
        Args:
            user_id: User identifier
            operation: Operation type (e.g., "CREATE", "READ", "UPDATE", "DELETE")
            data_type: Type of data (e.g., "transcript", "settings", "recording")
            resource_id: Specific resource identifier
            request: FastAPI request object
            success: Whether the operation succeeded
        """
        AuditLogger.log_access(
            user_id=user_id,
            action=f"DATA_{operation}",
            resource=f"{data_type}/{resource_id}",
            request=request,
            success=success
        )
    
    @staticmethod
    def log_security_event(
        event_type: str,
        description: str,
        request: Request,
        user_id: Optional[str] = None,
        severity: str = "WARNING"
    ):
        """
        Log security-related events.
        
        Args:
            event_type: Type of security event
            description: Event description
            request: FastAPI request object
            user_id: User if known
            severity: Event severity
        """
        try:
            client_ip = request.client.host if request.client else "unknown"
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                client_ip = forwarded_for.split(",")[0].strip()
            
            security_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": f"SECURITY_{event_type}",
                "description": description,
                "user_id": user_id or "anonymous",
                "ip_address": client_ip,
                "user_agent": request.headers.get("User-Agent", "unknown"),
                "path": str(request.url.path),
                "severity": severity
            }
            
            if audit_logger:
                audit_logger.log_struct(security_entry, severity=severity)
            
            local_logger.warning(f"SECURITY: {json.dumps(security_entry)}")
            
        except Exception as e:
            local_logger.error(f"Failed to log security event: {str(e)}")
    
    @staticmethod
    def query_audit_logs(
        user_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100
    ) -> list:
        """
        Query audit logs (for compliance reporting).
        
        Args:
            user_id: Filter by user ID
            start_time: Start of time range
            end_time: End of time range
            limit: Maximum number of entries
        
        Returns:
            List of audit log entries
        """
        if not audit_logger:
            local_logger.warning("Cloud Logging not available for audit queries")
            return []
        
        try:
            # Build filter
            filters = []
            if user_id:
                filters.append(f'jsonPayload.user_id="{user_id}"')
            if start_time:
                filters.append(f'timestamp>="{start_time.isoformat()}Z"')
            if end_time:
                filters.append(f'timestamp<="{end_time.isoformat()}Z"')
            
            filter_str = " AND ".join(filters) if filters else None
            
            # Query logs
            entries = list(audit_logger.list_entries(
                filter_=filter_str,
                order_by=DESCENDING,
                page_size=limit
            ))
            
            # Convert to list of dicts
            return [
                {
                    "timestamp": entry.timestamp.isoformat(),
                    "severity": entry.severity,
                    "payload": entry.payload
                }
                for entry in entries
            ]
            
        except Exception as e:
            local_logger.error(f"Failed to query audit logs: {str(e)}")
            return []

# Decorator for automatic audit logging
from functools import wraps
from typing import Callable

def audit_endpoint(action: str, resource_type: str):
    """
    Decorator to automatically add audit logging to endpoints.
    
    Args:
        action: Action being performed
        resource_type: Type of resource being accessed
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request and user_id from kwargs
            request = kwargs.get('request') or kwargs.get('req')
            user_id = kwargs.get('user_id') or kwargs.get('current_user')
            
            if not request or not user_id:
                # Try to find them in args
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                    elif isinstance(arg, str) and not user_id:
                        user_id = arg
            
            try:
                # Call the actual function
                result = await func(*args, **kwargs)
                
                # Log successful access
                if request and user_id:
                    resource_id = kwargs.get('session_id') or kwargs.get('resource_id') or 'unknown'
                    AuditLogger.log_data_access(
                        user_id=user_id,
                        operation=action,
                        data_type=resource_type,
                        resource_id=resource_id,
                        request=request,
                        success=True
                    )
                
                return result
                
            except Exception as e:
                # Log failed access
                if request and user_id:
                    resource_id = kwargs.get('session_id') or kwargs.get('resource_id') or 'unknown'
                    AuditLogger.log_data_access(
                        user_id=user_id,
                        operation=action,
                        data_type=resource_type,
                        resource_id=resource_id,
                        request=request,
                        success=False
                    )
                raise
        
        return wrapper
    return decorator