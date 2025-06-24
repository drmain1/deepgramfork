#!/usr/bin/env python3
"""
Test script to verify Firestore connection with correct project ID
"""
import os
import sys

# Try to load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed. Using system environment variables.")

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from firestore_session_manager import firestore_session_manager

def test_firestore_connection():
    """Test the Firestore connection and verify project ID"""
    print(f"Environment FIREBASE_PROJECT_ID: {os.getenv('FIREBASE_PROJECT_ID')}")
    print(f"Environment GCP_PROJECT_ID: {os.getenv('GCP_PROJECT_ID')}")
    
    try:
        # The session manager is already initialized when imported
        print(f"\nFirestore client project: {firestore_session_manager.db.project}")
        
        # Try to access the sessions collection
        print("\nTesting collection access...")
        docs = firestore_session_manager.sessions_collection.limit(1).get()
        print(f"Successfully accessed sessions collection. Document count: {len(list(docs))}")
        
        print("\n✅ Firestore connection successful!")
        print(f"Connected to project: {firestore_session_manager.db.project}")
        
    except Exception as e:
        print(f"\n❌ Firestore connection failed: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        return False
    
    return True

if __name__ == "__main__":
    success = test_firestore_connection()
    sys.exit(0 if success else 1)