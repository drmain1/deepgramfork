"""
Example of how to update main.py to use the extracted middleware.
This shows the key changes needed - not a complete file.
"""

# Replace the security middleware imports and setup in main.py with:

from fastapi import FastAPI
from middleware import create_security_middleware_stack, configure_cors

# ... other imports ...

# After creating the FastAPI app:
app = FastAPI(lifespan=lifespan)

# Configure CORS using the new module
configure_cors(app)

# Apply all security middlewares using the new module
create_security_middleware_stack(app)

# Add your existing rate limiter
from rate_limiter import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)
logger.info("Rate limiting middleware enabled")

# REMOVE these lines from main.py (lines 136-176):
# - The hardcoded origins list
# - The manual CORS middleware configuration
# - The SecurityHeadersMiddleware class definition
# - The manual security headers middleware addition

# The result is much cleaner:
# 1. All security configuration is centralized
# 2. Easy to modify security policies in one place
# 3. Reusable across different FastAPI apps
# 4. Proper separation of concerns