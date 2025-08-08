#!/usr/bin/env python3
"""
Simple Backend Test - Focus on core functionality
"""

import requests
import json
from datetime import datetime, date, timedelta

BASE_URL = "https://ffa318d9-8342-4b52-9a53-56068d8055df.preview.emergentagent.com/api"

def test_core_flow():
    session = requests.Session()
    
    print("1. Testing health and root endpoints...")
    health = session.get(f"{BASE_URL}/health").json()
    root = session.get(f"{BASE_URL}/").json()
    print(f"Health: {health}, Root: {root}")
    
    print("\n2. Testing rewards store...")
    rewards = session.get(f"{BASE_URL}/rewards/store").json()
    print(f"Rewards count: {len(rewards)}")
    for r in rewards:
        print(f"  - {r['reward_name']}: {r['xp_cost']} XP")
    
    print("\n3. Creating Epic quest...")
    today = date.today().isoformat()
    quest_data = {
        "quest_name": "Epic Test Quest",
        "quest_rank": "Epic",
        "due_date": today,
        "status": "Pending"
    }
    quest_response = session.post(f"{BASE_URL}/quests/active", json=quest_data)
    print(f"Create quest status: {quest_response.status_code}")
    if quest_response.status_code == 200:
        quest = quest_response.json()
        quest_id = quest['id']
        print(f"Created quest: {quest['quest_name']} (Rank: {quest['quest_rank']}, ID: {quest_id})")
        
        print("\n4. Updating quest...")
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        update_data = {
            "status": "In Progress",
            "due_date": tomorrow
        }
        update_response = session.patch(f"{BASE_URL}/quests/active/{quest_id}", json=update_data)
        print(f"Update status: {update_response.status_code}")
        if update_response.status_code == 200:
            updated_quest = update_response.json()
            print(f"Updated quest status: {updated_quest['status']}, due_date: {updated_quest['due_date']}")
        
        print("\n5. Completing Epic quest (should give 75 XP)...")
        complete_response = session.post(f"{BASE_URL}/quests/active/{quest_id}/complete")
        print(f"Complete status: {complete_response.status_code}")
        if complete_response.status_code == 200:
            completed = complete_response.json()
            print(f"Completed quest XP: {completed['xp_earned']} (Expected: 75)")
            
            print("\n6. Checking XP summary...")
            xp_response = session.get(f"{BASE_URL}/xp/summary")
            if xp_response.status_code == 200:
                xp_summary = xp_response.json()
                print(f"XP Summary: {xp_summary}")
    
    print("\n7. Testing recurring tasks...")
    recurring_data = {
        "task_name": "Daily Test Task",
        "quest_rank": "Common",
        "frequency": "Daily"
    }
    recurring_response = session.post(f"{BASE_URL}/recurring", json=recurring_data)
    print(f"Recurring create status: {recurring_response.status_code}")
    
    if recurring_response.status_code == 200:
        print("Running recurring generation...")
        run_response = session.post(f"{BASE_URL}/recurring/run")
        print(f"Recurring run status: {run_response.status_code}")
        if run_response.status_code == 200:
            run_result = run_response.json()
            print(f"Created {run_result['created']} recurring quests")

if __name__ == "__main__":
    test_core_flow()