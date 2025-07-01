#!/usr/bin/env python3
"""
Script to migrate all base64 logos to GCS file storage.
This is a one-time migration script for existing users.
"""

import os
import sys
import asyncio
import aiohttp
from typing import List, Dict

# Configuration
API_BASE_URL = os.getenv('VITE_API_BASE_URL', 'https://api.medlegaldoc.com')
if 'localhost' in API_BASE_URL or '127.0.0.1' in API_BASE_URL:
    API_BASE_URL = 'http://localhost:8000'

async def migrate_user_logo(session: aiohttp.ClientSession, user_id: str, token: str) -> Dict:
    """Migrate a single user's logo from base64 to GCS."""
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        # Call the migration endpoint
        async with session.post(
            f"{API_BASE_URL}/api/v1/migrate_logo",
            headers=headers
        ) as response:
            result = await response.json()
            return {
                'user_id': user_id,
                'status': 'success' if result.get('migrated') else 'skipped',
                'message': result.get('message', 'Unknown'),
                'logo_url': result.get('logoUrl')
            }
    except Exception as e:
        return {
            'user_id': user_id,
            'status': 'error',
            'message': str(e),
            'logo_url': None
        }

async def main():
    """Main migration function."""
    print("Base64 Logo to GCS Migration Script")
    print("===================================")
    
    # Check if running as admin
    admin_token = os.getenv('ADMIN_FIREBASE_TOKEN')
    if not admin_token:
        print("\nError: ADMIN_FIREBASE_TOKEN environment variable not set.")
        print("Please set this to a valid Firebase admin token to run migrations.")
        sys.exit(1)
    
    print(f"\nUsing API URL: {API_BASE_URL}")
    
    # For a real migration, you would get a list of all users
    # For now, this is a template that can be run per user
    user_id = input("\nEnter user ID to migrate (or 'all' for all users): ").strip()
    
    if user_id == 'all':
        print("\nBulk migration not implemented in this script.")
        print("Please contact admin for bulk migration.")
        sys.exit(0)
    
    if not user_id:
        print("No user ID provided.")
        sys.exit(1)
    
    print(f"\nMigrating logo for user: {user_id}")
    
    async with aiohttp.ClientSession() as session:
        # In a real scenario, you'd use the user's token or an admin token
        # For now, we'll use the provided token
        result = await migrate_user_logo(session, user_id, admin_token)
        
        print(f"\nMigration Result:")
        print(f"  Status: {result['status']}")
        print(f"  Message: {result['message']}")
        if result['logo_url']:
            print(f"  New Logo URL: {result['logo_url']}")

if __name__ == "__main__":
    asyncio.run(main())