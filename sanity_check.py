#!/usr/bin/env python3
"""
Sanity Check for Backend Health
Tests only the core endpoints requested by user before Categories implementation
"""

import requests
import json
from datetime import datetime, date

# Use the production backend URL from frontend/.env
BASE_URL = "https://ace18cbc-8eb0-42fb-ac3e-6c117ce871d5.preview.emergentagent.com/api"

def test_health_endpoint():
    """Test GET /api/health"""
    print("🔍 Testing GET /api/health...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") is True:
                print("✅ Health endpoint: PASS")
                print(f"   Response: {data}")
                return True
            else:
                print("❌ Health endpoint: FAIL")
                print(f"   Expected {{ok: true}}, got: {data}")
        else:
            print("❌ Health endpoint: FAIL")
            print(f"   Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print("❌ Health endpoint: FAIL")
        print(f"   Exception: {str(e)}")
    return False

def test_list_quests():
    """Test GET /api/quests/active"""
    print("\n🔍 Testing GET /api/quests/active...")
    try:
        response = requests.get(f"{BASE_URL}/quests/active")
        if response.status_code == 200:
            data = response.json()
            print("✅ List active quests: PASS")
            print(f"   Found {len(data)} active quests")
            if data:
                print("   Sample quest fields:")
                sample = data[0]
                for key in ['id', 'quest_name', 'quest_rank', 'due_date', 'status']:
                    if key in sample:
                        print(f"     {key}: {sample[key]}")
            return True
        else:
            print("❌ List active quests: FAIL")
            print(f"   Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print("❌ List active quests: FAIL")
        print(f"   Exception: {str(e)}")
    return False

def main():
    """Run sanity check"""
    print("🚀 Backend Sanity Check")
    print(f"📍 Base URL: {BASE_URL}")
    print("=" * 50)
    
    health_ok = test_health_endpoint()
    quests_ok = test_list_quests()
    
    print("\n" + "=" * 50)
    if health_ok and quests_ok:
        print("✅ SANITY CHECK PASSED: Backend is healthy!")
        print("   Ready for Categories feature implementation")
        return True
    else:
        print("❌ SANITY CHECK FAILED: Backend has issues")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)