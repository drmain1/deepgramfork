"""Security middleware for HIPAA compliance and general security best practices."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all HTTP responses for HIPAA compliance."""
    
    # Default security headers
    DEFAULT_HEADERS = {
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    }
    
    # Default Content Security Policy
    DEFAULT_CSP = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob: https:; "
        "connect-src 'self' http://localhost:* ws://localhost:* wss: https://*.googleapis.com;"
    )
    
    def __init__(
        self,
        app,
        custom_headers: Optional[Dict[str, str]] = None,
        custom_csp: Optional[str] = None,
        enable_csp: bool = True,
        log_headers: bool = False
    ):
        """Initialize the security headers middleware.
        
        Args:
            app: The ASGI application
            custom_headers: Additional or override headers
            custom_csp: Custom Content Security Policy
            enable_csp: Whether to include CSP header
            log_headers: Whether to log headers being set (for debugging)
        """
        super().__init__(app)
        self.headers = self.DEFAULT_HEADERS.copy()
        
        # Apply custom headers if provided
        if custom_headers:
            self.headers.update(custom_headers)
        
        # Set CSP if enabled
        if enable_csp:
            self.headers["Content-Security-Policy"] = custom_csp or self.DEFAULT_CSP
            
        self.log_headers = log_headers
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """Process the request and add security headers to the response."""
        # Process the request
        response = await call_next(request)
        
        # Add security headers to the response, but preserve existing CORS headers
        for header_name, header_value in self.headers.items():
            # Don't override CORS-related headers if they already exist
            if header_name.startswith("Access-Control-") and header_name in response.headers:
                continue
            response.headers[header_name] = header_value
        
        # Log headers if debugging is enabled
        if self.log_headers:
            logger.debug(f"Security headers applied to {request.url.path}: {list(self.headers.keys())}")
            logger.debug(f"Response headers: {dict(response.headers)}")
        
        return response


class HIPAAComplianceMiddleware(BaseHTTPMiddleware):
    """Additional HIPAA-specific security measures."""
    
    def __init__(
        self,
        app,
        require_encryption: bool = True,
        session_timeout_minutes: int = 30,
        log_access_attempts: bool = True
    ):
        """Initialize HIPAA compliance middleware.
        
        Args:
            app: The ASGI application
            require_encryption: Whether to require HTTPS in production
            session_timeout_minutes: Session timeout for PHI access
            log_access_attempts: Whether to log access attempts
        """
        super().__init__(app)
        self.require_encryption = require_encryption
        self.session_timeout_minutes = session_timeout_minutes
        self.log_access_attempts = log_access_attempts
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """Process the request with HIPAA compliance checks."""
        # Check for HTTPS in production (when behind a proxy, check X-Forwarded-Proto)
        if self.require_encryption:
            forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
            if forwarded_proto and forwarded_proto != "https":
                # Log potential security issue
                if self.log_access_attempts:
                    logger.warning(
                        f"Non-HTTPS access attempt from {request.client.host} to {request.url.path}"
                    )
                # In production, you might want to reject non-HTTPS requests
                # For now, just add a warning header
                response = await call_next(request)
                response.headers["X-Security-Warning"] = "HTTPS required for PHI data"
                return response
        
        # Add session timeout header for client-side handling
        response = await call_next(request)
        response.headers["X-Session-Timeout"] = str(self.session_timeout_minutes * 60)
        
        # Add cache control headers for PHI data
        if self._is_phi_endpoint(request.url.path):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        return response
    
    def _is_phi_endpoint(self, path: str) -> bool:
        """Determine if an endpoint handles PHI data."""
        phi_endpoints = [
            "/api/v1/patients",
            "/api/v1/transcripts",
            "/api/v1/recordings",
            "/api/v1/user_settings",
            "/stream",
            "/api/v1/save_session_data",
        ]
        return any(path.startswith(endpoint) for endpoint in phi_endpoints)


def create_security_middleware_stack(app):
    """Create a complete security middleware stack for the application.
    
    This function applies multiple security middlewares in the correct order.
    
    Args:
        app: The FastAPI application instance
        
    Returns:
        The app with all security middlewares applied
    """
    # Apply middlewares in reverse order (last one runs first)
    
    # HIPAA Compliance (runs second)
    app.add_middleware(
        HIPAAComplianceMiddleware,
        require_encryption=True,
        session_timeout_minutes=25,  # Match your session timeout
        log_access_attempts=True
    )
    
    # Security Headers (runs first)
    app.add_middleware(
        SecurityHeadersMiddleware,
        enable_csp=True,
        log_headers=True  # Set to True for debugging
    )
    
    return app