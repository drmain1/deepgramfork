#!/usr/bin/env python3
"""Quick health check for GCS connection."""

import os
import sys

# Set up environment
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = './gcp-credentials.json'
os.environ['GCS_BUCKET_NAME'] = 'medical-transcription-hipaa-prod'

from gcs_utils import GCSClient

def check_gcs_health():
    """Check if GCS is properly configured and accessible."""
    print("🏥 GCS Health Check\n")
    
    try:
        # Initialize client
        client = GCSClient()
        print(f"✅ GCS client initialized")
        print(f"📦 Bucket: {client.bucket_name}")
        
        # Check bucket exists and is accessible
        bucket = client.storage_client.bucket(client.bucket_name)
        exists = bucket.exists()
        print(f"✅ Bucket exists: {exists}")
        
        # Check bucket properties
        if exists:
            bucket.reload()
            print(f"📍 Location: {bucket.location}")
            print(f"🔐 Versioning enabled: {bucket.versioning_enabled}")
            print(f"🔒 Uniform bucket-level access: {bucket.iam_configuration.uniform_bucket_level_access_enabled}")
        
        # Test write permission
        test_key = "health_check/test.txt"
        test_content = "GCS health check successful"
        
        blob = bucket.blob(test_key)
        blob.upload_from_string(test_content)
        print(f"✅ Write test successful")
        
        # Test read permission
        downloaded = blob.download_as_text()
        if downloaded == test_content:
            print(f"✅ Read test successful")
        
        # Clean up
        blob.delete()
        print(f"✅ Delete test successful")
        
        print("\n✅ GCS is healthy and ready for use!")
        return True
        
    except Exception as e:
        print(f"\n❌ GCS health check failed: {e}")
        return False

if __name__ == "__main__":
    sys.exit(0 if check_gcs_health() else 1)