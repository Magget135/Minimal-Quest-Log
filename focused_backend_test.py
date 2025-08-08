#!/usr/bin/env python3
"""
Focused Backend API Testing for User Request
Tests specific APIs: XP summary, rewards redeem, rewards use
"""

import requests
import json
from datetime import datetime, date
import sys

# Use the production backend URL from frontend/.env
BASE_URL = "https://ace18cbc-8eb0-42fb-ac3e-6c117ce871d5.preview.emergentagent.com/api"

class FocusedTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def test_xp_summary_returns_json_with_balance(self):
        """Test 1: GET /api/xp/summary returns JSON with balance"""
        try:
            response = self.session.get(f"{self.base_url}/xp/summary")
            if response.status_code == 200:
                data = response.json()
                if ("balance" in data and 
                    "total_earned" in data and 
                    "total_spent" in data and
                    isinstance(data["balance"], int)):
                    self.log_test("GET /api/xp/summary returns JSON with balance", True, 
                                f"Response: {data}")
                    return True
                else:
                    self.log_test("GET /api/xp/summary returns JSON with balance", False, 
                                f"Missing required fields or wrong types: {data}")
            else:
                self.log_test("GET /api/xp/summary returns JSON with balance", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("GET /api/xp/summary returns JSON with balance", False, f"Exception: {str(e)}")
        return False
        
    def test_rewards_redeem_reduces_balance_creates_inventory(self):
        """Test 2: POST /api/rewards/redeem with valid store reward reduces balance and creates inventory item"""
        try:
            # First, ensure we have XP by creating and completing a quest
            today = date.today().isoformat()
            quest_data = {
                "quest_name": "Test Quest for Redeem",
                "quest_rank": "Common",
                "due_date": today,
                "status": "Pending"
            }
            create_response = self.session.post(f"{self.base_url}/quests/active", json=quest_data)
            if create_response.status_code == 200:
                quest_id = create_response.json().get("id")
                complete_response = self.session.post(f"{self.base_url}/quests/active/{quest_id}/complete")
                if complete_response.status_code != 200:
                    self.log_test("POST /api/rewards/redeem reduces balance and creates inventory", False, 
                                "Failed to create XP for test")
                    return False
            
            # Get initial balance
            initial_summary = self.session.get(f"{self.base_url}/xp/summary")
            if initial_summary.status_code != 200:
                self.log_test("POST /api/rewards/redeem reduces balance and creates inventory", False, 
                            "Could not get initial XP summary")
                return False
            initial_balance = initial_summary.json().get("balance", 0)
            
            # Get initial inventory count
            initial_inventory = self.session.get(f"{self.base_url}/rewards/inventory")
            if initial_inventory.status_code != 200:
                self.log_test("POST /api/rewards/redeem reduces balance and creates inventory", False, 
                            "Could not get initial inventory")
                return False
            initial_inventory_count = len(initial_inventory.json())
            
            # Get a valid reward from store
            store_response = self.session.get(f"{self.base_url}/rewards/store")
            if store_response.status_code != 200:
                self.log_test("POST /api/rewards/redeem reduces balance and creates inventory", False, 
                            "Could not get rewards store")
                return False
            
            store_items = store_response.json()
            valid_reward = None
            for item in store_items:
                if item.get("xp_cost", 0) <= initial_balance:
                    valid_reward = item
                    break
                    
            if not valid_reward:
                self.log_test("POST /api/rewards/redeem reduces balance and creates inventory", False, 
                            f"No affordable rewards found. Balance: {initial_balance}, Store: {[item.get('xp_cost') for item in store_items]}")
                return False
            
            # Redeem the reward
            redeem_data = {"reward_id": valid_reward.get("id")}
            redeem_response = self.session.post(f"{self.base_url}/rewards/redeem", json=redeem_data)
            if redeem_response.status_code == 200:
                redeem_result = redeem_response.json()
                
                # Check new balance
                new_summary = self.session.get(f"{self.base_url}/xp/summary")
                if new_summary.status_code == 200:
                    new_balance = new_summary.json().get("balance", 0)
                    expected_balance = initial_balance - valid_reward.get("xp_cost", 0)
                    
                    # Check new inventory count
                    new_inventory = self.session.get(f"{self.base_url}/rewards/inventory")
                    if new_inventory.status_code == 200:
                        new_inventory_count = len(new_inventory.json())
                        
                        if (new_balance == expected_balance and 
                            new_inventory_count == initial_inventory_count + 1 and
                            redeem_result.get("reward_name") == valid_reward.get("reward_name")):
                            self.log_test("POST /api/rewards/redeem reduces balance and creates inventory", True, 
                                        f"Balance: {initial_balance} -> {new_balance}, Inventory: {initial_inventory_count} -> {new_inventory_count}, Reward: {valid_reward.get('reward_name')}")
                            return redeem_result.get("id")  # Return inventory item ID for next test
                        else:
                            self.log_test("POST /api/rewards/redeem reduces balance and creates inventory", False, 
                                        f"Balance or inventory not updated correctly. Balance: {initial_balance} -> {new_balance} (expected {expected_balance}), Inventory: {initial_inventory_count} -> {new_inventory_count}")
                    else:
                        self.log_test("POST /api/rewards/redeem reduces balance and creates inventory", False, 
                                    "Could not get new inventory")
                else:
                    self.log_test("POST /api/rewards/redeem reduces balance and creates inventory", False, 
                                "Could not get new XP summary")
            else:
                self.log_test("POST /api/rewards/redeem reduces balance and creates inventory", False, 
                            f"Redeem failed: {redeem_response.status_code}, {redeem_response.text}")
        except Exception as e:
            self.log_test("POST /api/rewards/redeem reduces balance and creates inventory", False, f"Exception: {str(e)}")
        return False
        
    def test_rewards_use_marks_used_no_double_use(self, inventory_id):
        """Test 3: POST /api/rewards/use/{inventoryId} marks as used and no double-use allowed"""
        if not inventory_id:
            self.log_test("POST /api/rewards/use marks as used and prevents double-use", False, 
                        "No inventory ID provided from previous test")
            return False
            
        try:
            # First use - should succeed
            use_response = self.session.post(f"{self.base_url}/rewards/use/{inventory_id}")
            if use_response.status_code == 200:
                use_result = use_response.json()
                if use_result.get("ok") is True:
                    # Verify item is marked as used
                    inventory_response = self.session.get(f"{self.base_url}/rewards/inventory")
                    if inventory_response.status_code == 200:
                        inventory_items = inventory_response.json()
                        used_item = None
                        for item in inventory_items:
                            if item.get("id") == inventory_id:
                                used_item = item
                                break
                                
                        if used_item and used_item.get("used") is True and used_item.get("used_at") is not None:
                            # Now try to use again - should fail
                            double_use_response = self.session.post(f"{self.base_url}/rewards/use/{inventory_id}")
                            if double_use_response.status_code == 400:
                                error_text = double_use_response.text
                                if "already used" in error_text.lower():
                                    self.log_test("POST /api/rewards/use marks as used and prevents double-use", True, 
                                                f"First use succeeded, item marked as used, second use correctly rejected with 400")
                                    return True
                                else:
                                    self.log_test("POST /api/rewards/use marks as used and prevents double-use", False, 
                                                f"Wrong error message for double-use: {error_text}")
                            else:
                                self.log_test("POST /api/rewards/use marks as used and prevents double-use", False, 
                                            f"Double-use should return 400, got {double_use_response.status_code}")
                        else:
                            self.log_test("POST /api/rewards/use marks as used and prevents double-use", False, 
                                        f"Item not marked as used correctly: {used_item}")
                    else:
                        self.log_test("POST /api/rewards/use marks as used and prevents double-use", False, 
                                    "Could not get inventory to verify used status")
                else:
                    self.log_test("POST /api/rewards/use marks as used and prevents double-use", False, 
                                f"Use result incorrect: {use_result}")
            else:
                self.log_test("POST /api/rewards/use marks as used and prevents double-use", False, 
                            f"First use failed: {use_response.status_code}, {use_response.text}")
        except Exception as e:
            self.log_test("POST /api/rewards/use marks as used and prevents double-use", False, f"Exception: {str(e)}")
        return False
        
    def check_for_5xx_errors_in_logs(self):
        """Check backend logs for any 5xx errors"""
        try:
            import subprocess
            result = subprocess.run(['tail', '-n', '100', '/var/log/supervisor/backend.out.log'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                log_content = result.stdout
                five_xx_errors = [line for line in log_content.split('\n') if ' 5' in line and 'HTTP/1.1' in line]
                if five_xx_errors:
                    self.log_test("Check for 5xx errors in logs", False, 
                                f"Found {len(five_xx_errors)} 5xx errors: {five_xx_errors}")
                    return False
                else:
                    self.log_test("Check for 5xx errors in logs", True, 
                                "No 5xx errors found in recent backend logs")
                    return True
            else:
                self.log_test("Check for 5xx errors in logs", False, 
                            f"Could not read logs: {result.stderr}")
        except Exception as e:
            self.log_test("Check for 5xx errors in logs", False, f"Exception: {str(e)}")
        return False
        
    def run_focused_tests(self):
        """Run the specific tests requested by user"""
        print(f"🎯 Running Focused Backend API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Test 1: XP Summary
        test1_success = self.test_xp_summary_returns_json_with_balance()
        print()
        
        # Test 2: Rewards Redeem
        inventory_id = self.test_rewards_redeem_reduces_balance_creates_inventory()
        test2_success = bool(inventory_id)
        print()
        
        # Test 3: Rewards Use
        test3_success = self.test_rewards_use_marks_used_no_double_use(inventory_id)
        print()
        
        # Test 4: Check for 5xx errors
        test4_success = self.check_for_5xx_errors_in_logs()
        print()
        
        print("=" * 60)
        passed = sum([test1_success, test2_success, test3_success, test4_success])
        total = 4
        print(f"📊 Focused Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All focused tests passed!")
            return True
        else:
            print(f"⚠️  {total - passed} focused tests failed")
            return False

def main():
    """Main test runner"""
    tester = FocusedTester()
    success = tester.run_focused_tests()
    
    if success:
        print("\n✅ Focused backend API testing completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some focused backend tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()