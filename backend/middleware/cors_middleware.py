"""CORS middleware configuration for the application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import os


def configure_cors(
    app: FastAPI,
    origins: Optional[List[str]] = None,
    allow_credentials: bool = True,
    allow_methods: Optional[List[str]] = None,
    allow_headers: Optional[List[str]] = None
) -> None:
    """Configure CORS middleware for the FastAPI application.
    
    Args:
        app: The FastAPI application instance
        origins: List of allowed origins (defaults to environment-based list)
        allow_credentials: Whether to allow credentials in CORS requests
        allow_methods: List of allowed HTTP methods
        allow_headers: List of allowed headers
    """
    # Default origins from environment or hardcoded list
    if origins is None:
        # Try to get from environment variable first
        env_origins = os.getenv("ALLOWED_ORIGINS", "")
        if env_origins:
            origins = [origin.strip() for origin in env_origins.split(",")]
        else:
            # Default origins for development and production
            origins = [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "https://scribe.medlegaldoc.com",
                "https://medlegaldoc.com",
            ]
    
    # Default allowed methods
    if allow_methods is None:
        allow_methods = ["GET", "POST", "OPTIONS", "PUT", "DELETE"]
    
    # Default allowed headers - explicit headers only for security
    if allow_headers is None:
        allow_headers = [
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With"
        ]
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=allow_credentials,
        allow_methods=allow_methods,
        allow_headers=allow_headers,
    )
    
    # Log CORS configuration for debugging
    print(f"✓ CORS configured with origins: {origins}")