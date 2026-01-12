#!/usr/bin/env python3
"""
Password Reset Backend Testing Script
Tests the password reset endpoint locally without needing the frontend
"""

import requests
import json
from datetime import datetime

# Configuration
LOCAL_API_BASE = 'http://localhost:5000/api'
DEPLOYED_API_BASE = 'https://codeprac2.onrender.com/api'

def test_endpoint(api_base, email, test_name):
    """Test the password reset endpoint"""
    
    endpoint = f"{api_base}/auth/password-reset-request"
    
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")
    print(f"URL: {endpoint}")
    print(f"Method: POST")
    print(f"Payload: {{'email': '{email}'}}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        response = requests.post(
            endpoint,
            json={'email': email},
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        try:
            data = response.json()
            print(f"Response Body:")
            print(json.dumps(data, indent=2))
        except:
            print(f"Response Body (text): {response.text}")
        
        return response.status_code == 200
        
    except requests.exceptions.ConnectionError:
        print(f"❌ CONNECTION ERROR: Cannot connect to {api_base}")
        print(f"   Make sure the Flask server is running on {api_base}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def main():
    """Run all tests"""
    
    print("\n")
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║     PASSWORD RESET ENDPOINT TESTING SCRIPT                ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    
    tests = [
        # Local tests
        (LOCAL_API_BASE, "test@example.com", "Local - Valid Email"),
        (LOCAL_API_BASE, "student@example.com", "Local - Another Valid Email"),
        (LOCAL_API_BASE, "", "Local - Empty Email (Should Fail)"),
        (LOCAL_API_BASE, "invalid-email", "Local - Invalid Email Format (Should Fail)"),
        
        # Deployed tests (if you want to test)
        # (DEPLOYED_API_BASE, "test@example.com", "Deployed - Valid Email"),
    ]
    
    results = {}
    
    for api_base, email, test_name in tests:
        try:
            success = test_endpoint(api_base, email, test_name)
            results[test_name] = "✅ PASS" if success else "❌ FAIL"
        except Exception as e:
            results[test_name] = f"❌ ERROR: {e}"
    
    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    
    for test_name, result in results.items():
        print(f"{result:10} - {test_name}")
    
    print(f"{'='*60}\n")

if __name__ == "__main__":
    print("""
INSTRUCTIONS:
1. Make sure Flask server is running: python app.py
2. Check that port 5000 is accessible
3. Verify Firebase credentials are properly configured
4. Run this script: python test_password_reset_backend.py

Expected Results:
- Valid emails: 200 OK with success message
- Empty email: 400 Bad Request with "email is required"
- Invalid email: 400 Bad Request with "Invalid email format"
""")
    
    main()
