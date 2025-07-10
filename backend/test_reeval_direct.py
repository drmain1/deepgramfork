#!/usr/bin/env python3
"""
Test the re-evaluation status function directly
"""

import asyncio
import os
import sys
import logging

# Set up logging to see debug messages
logging.basicConfig(level=logging.DEBUG)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from patient_endpoints import get_re_evaluation_status
from unittest.mock import Mock

async def test_reeval_status():
    """Test re-evaluation status for patient DEF, ABC"""
    
    # Patient ID for DEF, ABC
    patient_id = "PTcyfLf3noFs08Islj3s"
    
    # Use the actual user ID who owns this patient
    current_user_id = "HqFlxE8ig8TDNLrcgHKRVSzIs7L2"
    
    # Mock request
    request = Mock()
    
    print(f"Testing re-evaluation status for patient ID: {patient_id}")
    print("=" * 50)
    
    try:
        result = await get_re_evaluation_status(patient_id, current_user_id, request)
        
        print("\nResult:")
        for key, value in result.items():
            print(f"  {key}: {value}")
            
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_reeval_status())