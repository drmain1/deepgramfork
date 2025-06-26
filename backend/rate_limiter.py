"""
Rate limiting middleware for HIPAA compliance and DDoS protection.
Uses in-memory storage for simplicity, but can be upgraded to Redis for production.
"""
import time
from collections import defaultdict, deque
from typing import Dict, Deque, Tuple
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    """
    Simple rate limiter using token bucket algorithm.
    Tracks requests per user and IP address.
    """
    
    def __init__(
        self, 
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        burst_size: int = 10
    ):
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.burst_size = burst_size
        
        # Storage: {identifier: deque of timestamps}
        self.requests: Dict[str, Deque[float]] = defaultdict(deque)
        
        # Blocked IPs/users
        self.blocked_until: Dict[str, float] = {}
    
    def _clean_old_requests(self, identifier: str, current_time: float):
        """Remove requests older than 1 hour."""
        cutoff_time = current_time - 3600  # 1 hour
        
        # Remove old timestamps
        while self.requests[identifier] and self.requests[identifier][0] < cutoff_time:
            self.requests[identifier].popleft()
    
    def _is_blocked(self, identifier: str, current_time: float) -> bool:
        """Check if identifier is temporarily blocked."""
        if identifier in self.blocked_until:
            if current_time < self.blocked_until[identifier]:
                return True
            else:
                # Unblock if time has passed
                del self.blocked_until[identifier]
        return False
    
    def check_rate_limit(self, identifier: str) -> Tuple[bool, str]:
        """
        Check if request should be allowed.
        Returns (allowed, reason_if_denied)
        """
        current_time = time.time()
        
        # Check if blocked
        if self._is_blocked(identifier, current_time):
            remaining_time = int(self.blocked_until[identifier] - current_time)
            return False, f"Too many requests. Please try again in {remaining_time} seconds."
        
        # Clean old requests
        self._clean_old_requests(identifier, current_time)
        
        # Get request history
        request_times = self.requests[identifier]
        
        # Check hourly limit
        if len(request_times) >= self.requests_per_hour:
            # Block for 5 minutes
            self.blocked_until[identifier] = current_time + 300
            logger.warning(f"Rate limit exceeded (hourly) for {identifier}")
            return False, "Hourly rate limit exceeded. Please try again in 5 minutes."
        
        # Check minute limit
        one_minute_ago = current_time - 60
        recent_requests = sum(1 for t in request_times if t > one_minute_ago)
        
        if recent_requests >= self.requests_per_minute:
            # Block for 1 minute
            self.blocked_until[identifier] = current_time + 60
            logger.warning(f"Rate limit exceeded (per minute) for {identifier}")
            return False, "Rate limit exceeded. Please try again in 1 minute."
        
        # Check burst limit (requests in last 10 seconds)
        ten_seconds_ago = current_time - 10
        burst_requests = sum(1 for t in request_times if t > ten_seconds_ago)
        
        if burst_requests >= self.burst_size:
            logger.warning(f"Burst limit exceeded for {identifier}")
            return False, "Too many requests in a short time. Please slow down."
        
        # Request allowed - record it
        request_times.append(current_time)
        return True, ""

# Global rate limiter instances
user_rate_limiter = RateLimiter(
    requests_per_minute=60,
    requests_per_hour=1000,
    burst_size=10
)

ip_rate_limiter = RateLimiter(
    requests_per_minute=120,  # More lenient for shared IPs
    requests_per_hour=2000,
    burst_size=20
)

# Lenient rate limiter for read operations
read_rate_limiter = RateLimiter(
    requests_per_minute=200,  # Much more lenient for reads
    requests_per_hour=5000,
    burst_size=50  # Allow bursts for navigation
)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for rate limiting.
    """
    
    def __init__(self, app):
        super().__init__(app)
        
        # Endpoints that should be rate limited more strictly
        self.strict_endpoints = [
            "/api/v1/polish",
            "/api/v1/save_audio",
            "/api/v1/user_settings"
        ]
        
        # Endpoints that should have relaxed limits (read operations)
        self.relaxed_endpoints = [
            "/api/v1/user_recordings",
            "/api/v1/test-gcp",
            "/api/v1/patients",
            "/api/v1/patients/",  # Patient-specific endpoints
            "/api/v1/login"  # Session creation should be lenient
        ]
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for static files and docs
        if request.url.path.startswith(("/docs", "/redoc", "/openapi.json", "/static")):
            return await call_next(request)
        
        # Get identifiers
        client_ip = request.client.host if request.client else "unknown"
        
        # Try to get user ID from various sources
        user_id = None
        
        # Check authorization header
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            # For authenticated requests, we'll use the token as identifier
            # In production, decode the token to get user_id
            user_id = f"user_{hash(auth_header) % 100000}"  # Simple hash for demo
        
        # Apply IP-based rate limiting
        ip_allowed, ip_reason = ip_rate_limiter.check_rate_limit(f"ip_{client_ip}")
        if not ip_allowed:
            logger.warning(f"IP rate limit exceeded: {client_ip}")
            return JSONResponse(
                status_code=429,
                content={"detail": ip_reason},
                headers={"Retry-After": "60"}
            )
        
        # Apply user-based rate limiting if authenticated
        if user_id:
            # Check if this is a read operation (GET request or relaxed endpoint)
            is_read_operation = (
                request.method == "GET" or 
                any(request.url.path.startswith(ep) for ep in self.relaxed_endpoints)
            )
            
            if is_read_operation:
                # Use lenient limits for read operations
                allowed, reason = read_rate_limiter.check_rate_limit(user_id)
            elif any(request.url.path.startswith(ep) for ep in self.strict_endpoints):
                # Use stricter limits for certain endpoints
                allowed, reason = user_rate_limiter.check_rate_limit(user_id)
            else:
                # Normal limits for other operations
                allowed, reason = user_rate_limiter.check_rate_limit(user_id)
            
            if not allowed:
                logger.warning(f"User rate limit exceeded: {user_id}")
                return JSONResponse(
                    status_code=429,
                    content={"detail": reason},
                    headers={"Retry-After": "60"}
                )
        
        # Process the request
        response = await call_next(request)
        
        # Add rate limit headers
        if user_id:
            # In production, calculate actual remaining requests
            response.headers["X-RateLimit-Limit"] = "60"
            response.headers["X-RateLimit-Remaining"] = "50"  # Placeholder
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) + 60)
        
        return response