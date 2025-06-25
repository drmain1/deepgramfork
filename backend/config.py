"""
Configuration management for the application.
Handles environment variables and secrets for both development and production.
"""
import os
from secret_manager import secret_manager

class Config:
    """Application configuration with Secret Manager integration."""
    
    def __init__(self):
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.is_production = self.environment == "production"
        
        # Google Cloud Configuration
        self.gcp_project_id = os.getenv("GCP_PROJECT_ID", "medlegaldoc-b31df")
        self.gcp_location = os.getenv("GCP_LOCATION", "us-central1")
        self.gcs_bucket_name = os.getenv("GCS_BUCKET_NAME", "medlegaldoc-b31df.firebasestorage.app")
        
        # Firebase Configuration
        self.firebase_project_id = os.getenv("FIREBASE_PROJECT_ID", "medlegaldoc-b31df")
        self.firebase_api_key = secret_manager.get_secret_or_env(
            "firebase-api-key", 
            "FIREBASE_API_KEY",
            "AIzaSyBLRq3spaL-8fG9BIi-91F_Wrr3Yjk7Zqk"
        )
        
        # Speech-to-Text API Keys
        self.deepgram_api_key = secret_manager.get_secret_or_env(
            "deepgram-api-key",
            "DEEPGRAM_API_KEY",
            ""
        )
        self.speechmatics_api_key = secret_manager.get_secret_or_env(
            "speechmatics-api-key",
            "SPEECHMATICS_API_KEY",
            ""
        )
        
        # Security Settings
        self.allowed_origins = os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,https://scribe.medlegaldoc.com,https://www.scribe.medlegaldoc.com"
        ).split(",")
        self.session_timeout_minutes = int(os.getenv("SESSION_TIMEOUT_MINUTES", "25"))
        self.rate_limit_per_minute = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
        
        # IAP Configuration (for production)
        self.iap_expected_audience = secret_manager.get_secret_or_env(
            "iap-expected-audience",
            "IAP_EXPECTED_AUDIENCE",
            ""
        )
        
        # Firebase Credentials
        self.firebase_credentials = secret_manager.get_firebase_credentials()
    
    def validate(self):
        """Validate required configuration values."""
        required = {
            "gcp_project_id": self.gcp_project_id,
            "firebase_project_id": self.firebase_project_id,
            "gcs_bucket_name": self.gcs_bucket_name
        }
        
        missing = [key for key, value in required.items() if not value]
        if missing:
            raise ValueError(f"Missing required configuration: {', '.join(missing)}")
        
        # Validate API keys in production
        if self.is_production:
            if not self.deepgram_api_key:
                raise ValueError("DEEPGRAM_API_KEY is required in production")
            if not self.speechmatics_api_key:
                raise ValueError("SPEECHMATICS_API_KEY is required in production")
            if not self.firebase_credentials:
                raise ValueError("Firebase credentials are required in production")

# Initialize configuration
config = Config()