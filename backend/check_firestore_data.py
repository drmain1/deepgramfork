#!/usr/bin/env python3
"""
Check Firestore data for a specific user
"""
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from google.cloud import firestore
import json

# Initialize Firestore client
firebase_project_id = os.getenv('FIREBASE_PROJECT_ID', 'medlegaldoc-b31df')
db = firestore.Client(project=firebase_project_id)

# User ID to check
user_id = "HqFlxE8ig8TDNLrcgHKRVSzIs7L2"

print(f"Checking Firestore data for user: {user_id}")
print(f"Project: {firebase_project_id}")
print("=" * 60)

# Check users collection
print("\n1. USERS COLLECTION:")
user_ref = db.collection('users').document(user_id)
user_doc = user_ref.get()

if user_doc.exists:
    print("User document found!")
    user_data = user_doc.to_dict()
    print(json.dumps(user_data, indent=2, default=str))
else:
    print("No user document found")

# Check sessions collection
print("\n\n2. USER_SESSIONS COLLECTION:")
session_ref = db.collection('user_sessions').document(user_id)
session_doc = session_ref.get()

if session_doc.exists:
    print("Session document found!")
    session_data = session_doc.to_dict()
    print(json.dumps(session_data, indent=2, default=str))
else:
    print("No session document found")

# Check transcripts collection
print("\n\n3. TRANSCRIPTS COLLECTION:")
transcripts = db.collection('transcripts').where('user_id', '==', user_id).limit(5).get()
print(f"Found {len(list(transcripts))} transcript documents")

print("\n" + "=" * 60)