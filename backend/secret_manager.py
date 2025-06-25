"""
Google Secret Manager integration for production environment.
"""
import os
import json
from typing import Optional
from google.cloud import secretmanager

class SecretManager:
    """Handle secret retrieval from Google Secret Manager in production."""
    
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.client = None
        self.is_production = os.getenv("ENVIRONMENT", "development") == "production"
        
        if self.is_production:
            self.client = secretmanager.SecretManagerServiceClient()
    
    def get_secret(self, secret_id: str, version: str = "latest") -> Optional[str]:
        """Retrieve a secret from Secret Manager."""
        if not self.is_production:
            # In development, return None to use local .env values
            return None
        
        try:
            secret_name = f"projects/{self.project_id}/secrets/{secret_id}/versions/{version}"
            response = self.client.access_secret_version(request={"name": secret_name})
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            print(f"Error retrieving secret {secret_id}: {e}")
            return None
    
    def get_secret_or_env(self, secret_id: str, env_var: str, default: str = "") -> str:
        """Get secret from Secret Manager in production, or from env var in development."""
        if self.is_production:
            secret_value = self.get_secret(secret_id)
            if secret_value:
                return secret_value
        
        return os.getenv(env_var, default)
    
    def get_firebase_credentials(self) -> Optional[dict]:
        """Get Firebase service account credentials."""
        if self.is_production:
            credentials_json = self.get_secret("firebase-service-account")
            if credentials_json:
                return json.loads(credentials_json)
        
        # In development, use the local credentials file
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if credentials_path and os.path.exists(credentials_path):
            with open(credentials_path, 'r') as f:
                return json.load(f)
        
        return None

# Initialize singleton instance
secret_manager = SecretManager(os.getenv("GCP_PROJECT_ID", "medlegaldoc-b31df"))