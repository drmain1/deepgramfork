#!/usr/bin/env python3
"""
Script to create Google Secret Manager secrets for the application.
Run this once to set up all required secrets in Google Cloud.
"""

import os
import json
from google.cloud import secretmanager

# Initialize the Secret Manager client
client = secretmanager.SecretManagerServiceClient()

# Project ID
project_id = "medlegaldoc-b31df"
parent = f"projects/{project_id}"

# Define secrets to create
secrets = {
    "deepgram-api-key": {
        "description": "Deepgram API key for medical transcription",
        "value": "PLACEHOLDER_DEEPGRAM_API_KEY"  # Replace with actual key
    },
    "speechmatics-api-key": {
        "description": "Speechmatics API key for multilingual transcription",
        "value": "PLACEHOLDER_SPEECHMATICS_API_KEY"  # Replace with actual key
    },
    "firebase-api-key": {
        "description": "Firebase API key for authentication",
        "value": "AIzaSyBLRq3spaL-8fG9BIi-91F_Wrr3Yjk7Zqk"
    },
    "firebase-service-account": {
        "description": "Firebase service account JSON for admin SDK",
        "value": json.dumps({
            "type": "service_account",
            "project_id": "medlegaldoc-b31df",
            "private_key_id": "PLACEHOLDER",
            "private_key": "PLACEHOLDER",
            "client_email": "PLACEHOLDER",
            "client_id": "PLACEHOLDER",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "PLACEHOLDER"
        })
    },
    "iap-expected-audience": {
        "description": "Expected audience for Identity-Aware Proxy in production",
        "value": "PLACEHOLDER_IAP_AUDIENCE"  # Will be set when IAP is configured
    }
}

def create_secret(secret_id, description):
    """Create a new secret in Secret Manager."""
    secret = {
        "replication": {
            "automatic": {}
        }
    }
    
    try:
        response = client.create_secret(
            parent=parent,
            secret_id=secret_id,
            secret=secret
        )
        print(f"Created secret: {response.name}")
        
        # Add description as a label
        response = client.update_secret(
            secret={
                "name": response.name,
                "labels": {
                    "description": description.replace(" ", "_").lower()[:63]
                }
            },
            update_mask={"paths": ["labels"]}
        )
        return response.name
    except Exception as e:
        if "already exists" in str(e):
            print(f"Secret {secret_id} already exists")
            return f"{parent}/secrets/{secret_id}"
        else:
            raise e

def add_secret_version(secret_name, secret_value):
    """Add a version to an existing secret."""
    try:
        response = client.add_secret_version(
            parent=secret_name,
            payload={"data": secret_value.encode("UTF-8")}
        )
        print(f"Added secret version: {response.name}")
    except Exception as e:
        print(f"Error adding secret version: {e}")

def main():
    print("Setting up Google Secret Manager secrets...")
    print(f"Project: {project_id}")
    print("-" * 50)
    
    for secret_id, config in secrets.items():
        print(f"\nProcessing: {secret_id}")
        
        # Create the secret
        secret_name = create_secret(secret_id, config["description"])
        
        # Add the secret version
        add_secret_version(secret_name, config["value"])
    
    print("\n" + "=" * 50)
    print("Secret setup complete!")
    print("\nIMPORTANT: Replace placeholder values with actual secrets:")
    print("- deepgram-api-key")
    print("- speechmatics-api-key")
    print("- firebase-service-account (upload actual service account JSON)")
    print("- iap-expected-audience (set after configuring IAP)")
    
    print("\nTo update a secret value:")
    print("gcloud secrets versions add SECRET_ID --data-file=-")
    print("\nTo grant App Engine access to secrets:")
    print("gcloud secrets add-iam-policy-binding SECRET_ID \\")
    print("    --member=serviceAccount:PROJECT_ID@appspot.gserviceaccount.com \\")
    print("    --role=roles/secretmanager.secretAccessor")

if __name__ == "__main__":
    main()