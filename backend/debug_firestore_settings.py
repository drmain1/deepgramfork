#!/usr/bin/env python3
"""Debug script to check what's actually stored in Firestore for user settings."""

import asyncio
import sys
import json
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, '/Users/davidmain/Desktop/cursor_projects/github_fork/backend')

from firestore_client import firestore_client


async def debug_user_settings(user_id: str):
    """Check what's actually stored in Firestore for a user."""
    
    print(f"\n=== Debugging Firestore Settings for User: {user_id} ===")
    print(f"Time: {datetime.now()}")
    
    # Get raw user document from Firestore
    user_doc = await firestore_client.get_user_settings(user_id)
    
    if not user_doc:
        print(f"\n❌ No user document found for {user_id}")
        return
    
    print(f"\n✓ User document found")
    print("\n--- Raw Firestore Document ---")
    
    # Check each field
    fields_to_check = [
        'doctor_name',
        'medical_specialty',
        'custom_vocabulary',
        'macro_phrases',
        'transcription_profiles',
        'doctor_signature',
        'clinic_logo',
        'include_logo_on_pdf',
        'office_information',
        'custom_billing_rules',
        'cpt_fees',
        'settings_summary',  # Check if this exists
        'updated_at'
    ]
    
    for field in fields_to_check:
        value = user_doc.get(field)
        
        if value is None:
            print(f"{field}: NOT PRESENT")
        elif isinstance(value, (list, dict)):
            if len(value) == 0:
                print(f"{field}: EMPTY {type(value).__name__}")
            else:
                print(f"{field}: {type(value).__name__} with {len(value)} items")
                # Show first item as sample
                if isinstance(value, list) and len(value) > 0:
                    print(f"  First item: {json.dumps(value[0], indent=2)}")
                elif isinstance(value, dict):
                    first_key = list(value.keys())[0] if value else None
                    if first_key:
                        print(f"  First entry: {first_key} = {value[first_key]}")
        else:
            # For strings and other simple types
            if isinstance(value, str) and len(value) > 50:
                print(f"{field}: {type(value).__name__} (length: {len(value)})")
            else:
                print(f"{field}: {value}")
    
    # Check for any unexpected fields
    print("\n--- All Document Fields ---")
    for key in user_doc.keys():
        if key not in fields_to_check:
            print(f"UNEXPECTED FIELD: {key} = {user_doc[key]}")
    
    print("\n=== End Debug ===\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python debug_firestore_settings.py <user_id>")
        print("Example: python debug_firestore_settings.py test_user_123")
        sys.exit(1)
    
    user_id = sys.argv[1]
    asyncio.run(debug_user_settings(user_id))