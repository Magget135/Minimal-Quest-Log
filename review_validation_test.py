#!/usr/bin/env python3
"""
Review Validation Test for Quest Tracker Backend
Tests specific new endpoints and fields as requested:
1) Create active quest with duration_minutes and verify returned field persists in GET /api/quests/active
2) PATCH /api/quests/active/{id} to change due_time and duration_minutes, verify
3) Recurrence link endpoints:
   a) PUT /api/quests/active/{id}/recurrence with Weekly config, then GET /api/quests/active/{id}/recurrence returns same
   b) DELETE /api/quests/active/{id}/recurrence?delete_rule=true unlinks and deletes rule; verify GET returns null and Recurringtasks no longer contains rule
4) Recurring/run still works and sets recurring_id on generated quests
"""

import requests
import json
from datetime import datetime, date, timedelta
import sys

# Use the production backend URL from frontend/.env
BASE_URL = "https://ffa318d9-8342-4b52-9a53-56068d8055df.preview.emergentagent.com/api"

class ReviewValidationTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.test_results = []
        self.created_quest_id = None
        self.created_recurring_id = None
        
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
        
    def test_1_create_quest_with_duration_minutes(self):
        """Test 1: Create active quest with duration_minutes and verify it persists in GET"""
        print("\n🔍 Test 1: Create active quest with duration_minutes")
        
        try:
            today = date.today().isoformat()
            quest_data = {
                "quest_name": "Review Test Quest",
                "quest_rank": "Common",
                "due_date": today,
                "due_time": "14:30",
                "duration_minutes": 90,
                "status": "Pending"
            }
            
            # Create quest
            response = self.session.post(f"{self.base_url}/quests/active", json=quest_data)
            if response.status_code == 200:
                data = response.json()
                self.created_quest_id = data.get("id")
                
                # Verify duration_minutes is returned
                if data.get("duration_minutes") == 90:
                    self.log_test("1a: Create quest with duration_minutes", True, f"Quest created with duration_minutes: {data.get('duration_minutes')}")
                    
                    # Now verify it persists in GET /api/quests/active
                    list_response = self.session.get(f"{self.base_url}/quests/active")
                    if list_response.status_code == 200:
                        active_quests = list_response.json()
                        found_quest = None
                        for quest in active_quests:
                            if quest.get("id") == self.created_quest_id:
                                found_quest = quest
                                break
                                
                        if found_quest and found_quest.get("duration_minutes") == 90:
                            self.log_test("1b: duration_minutes persists in GET", True, f"Found quest with duration_minutes: {found_quest.get('duration_minutes')}")
                            return True
                        else:
                            self.log_test("1b: duration_minutes persists in GET", False, f"duration_minutes not found or incorrect: {found_quest.get('duration_minutes') if found_quest else 'quest not found'}")
                    else:
                        self.log_test("1b: duration_minutes persists in GET", False, f"GET quests failed: {list_response.status_code}")
                else:
                    self.log_test("1a: Create quest with duration_minutes", False, f"duration_minutes not returned correctly: {data.get('duration_minutes')}")
            else:
                self.log_test("1a: Create quest with duration_minutes", False, f"Create failed: {response.status_code}, {response.text}")
                
        except Exception as e:
            self.log_test("Test 1: Create quest with duration_minutes", False, f"Exception: {str(e)}")
            
        return False
        
    def test_2_patch_due_time_and_duration(self):
        """Test 2: PATCH /api/quests/active/{id} to change due_time and duration_minutes"""
        print("\n🔍 Test 2: PATCH quest to change due_time and duration_minutes")
        
        if not self.created_quest_id:
            self.log_test("Test 2: PATCH due_time and duration", False, "No quest ID available")
            return False
            
        try:
            update_data = {
                "due_time": "16:45",
                "duration_minutes": 120
            }
            
            response = self.session.patch(f"{self.base_url}/quests/active/{self.created_quest_id}", json=update_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("due_time") == "16:45" and data.get("duration_minutes") == 120:
                    self.log_test("Test 2: PATCH due_time and duration", True, f"Successfully updated: due_time={data.get('due_time')}, duration_minutes={data.get('duration_minutes')}")
                    return True
                else:
                    self.log_test("Test 2: PATCH due_time and duration", False, f"Update not reflected: due_time={data.get('due_time')}, duration_minutes={data.get('duration_minutes')}")
            else:
                self.log_test("Test 2: PATCH due_time and duration", False, f"PATCH failed: {response.status_code}, {response.text}")
                
        except Exception as e:
            self.log_test("Test 2: PATCH due_time and duration", False, f"Exception: {str(e)}")
            
        return False
        
    def test_3a_put_quest_recurrence(self):
        """Test 3a: PUT /api/quests/active/{id}/recurrence with Weekly config"""
        print("\n🔍 Test 3a: PUT quest recurrence with Weekly config")
        
        if not self.created_quest_id:
            self.log_test("Test 3a: PUT quest recurrence", False, "No quest ID available")
            return False
            
        try:
            recurrence_data = {
                "frequency": "Weekly",
                "days": "Mon, Wed, Fri",
                "interval": 1
            }
            
            response = self.session.put(f"{self.base_url}/quests/active/{self.created_quest_id}/recurrence", json=recurrence_data)
            if response.status_code == 200:
                data = response.json()
                if (data.get("frequency") == "Weekly" and 
                    data.get("days") == "Mon, Wed, Fri" and 
                    data.get("interval") == 1):
                    self.created_recurring_id = data.get("id")
                    self.log_test("Test 3a: PUT quest recurrence", True, f"Created recurrence rule: {data.get('frequency')} on {data.get('days')}")
                    
                    # Now verify GET returns the same
                    get_response = self.session.get(f"{self.base_url}/quests/active/{self.created_quest_id}/recurrence")
                    if get_response.status_code == 200:
                        get_data = get_response.json()
                        if (get_data and get_data.get("frequency") == "Weekly" and 
                            get_data.get("days") == "Mon, Wed, Fri" and 
                            get_data.get("interval") == 1):
                            self.log_test("Test 3a: GET quest recurrence returns same", True, f"GET returned matching recurrence config")
                            return True
                        else:
                            self.log_test("Test 3a: GET quest recurrence returns same", False, f"GET returned different config: {get_data}")
                    else:
                        self.log_test("Test 3a: GET quest recurrence returns same", False, f"GET failed: {get_response.status_code}")
                else:
                    self.log_test("Test 3a: PUT quest recurrence", False, f"Recurrence config incorrect: {data}")
            else:
                self.log_test("Test 3a: PUT quest recurrence", False, f"PUT failed: {response.status_code}, {response.text}")
                
        except Exception as e:
            self.log_test("Test 3a: PUT quest recurrence", False, f"Exception: {str(e)}")
            
        return False
        
    def test_3b_delete_quest_recurrence(self):
        """Test 3b: DELETE /api/quests/active/{id}/recurrence?delete_rule=true"""
        print("\n🔍 Test 3b: DELETE quest recurrence with delete_rule=true")
        
        if not self.created_quest_id or not self.created_recurring_id:
            self.log_test("Test 3b: DELETE quest recurrence", False, "No quest ID or recurring ID available")
            return False
            
        try:
            # First verify the recurring rule exists in Recurringtasks
            recurring_list_response = self.session.get(f"{self.base_url}/recurring")
            if recurring_list_response.status_code == 200:
                recurring_tasks = recurring_list_response.json()
                rule_exists_before = any(task.get("id") == self.created_recurring_id for task in recurring_tasks)
                
                if rule_exists_before:
                    # Delete with delete_rule=true
                    delete_response = self.session.delete(f"{self.base_url}/quests/active/{self.created_quest_id}/recurrence?delete_rule=true")
                    if delete_response.status_code == 200:
                        # Verify GET returns null
                        get_response = self.session.get(f"{self.base_url}/quests/active/{self.created_quest_id}/recurrence")
                        if get_response.status_code == 200:
                            get_data = get_response.json()
                            if get_data is None:
                                # Verify rule no longer exists in Recurringtasks
                                new_recurring_response = self.session.get(f"{self.base_url}/recurring")
                                if new_recurring_response.status_code == 200:
                                    new_recurring_tasks = new_recurring_response.json()
                                    rule_exists_after = any(task.get("id") == self.created_recurring_id for task in new_recurring_tasks)
                                    
                                    if not rule_exists_after:
                                        self.log_test("Test 3b: DELETE quest recurrence", True, f"Successfully unlinked and deleted rule. GET returns null, rule removed from Recurringtasks")
                                        return True
                                    else:
                                        self.log_test("Test 3b: DELETE quest recurrence", False, f"Rule still exists in Recurringtasks after deletion")
                                else:
                                    self.log_test("Test 3b: DELETE quest recurrence", False, f"Could not verify Recurringtasks: {new_recurring_response.status_code}")
                            else:
                                self.log_test("Test 3b: DELETE quest recurrence", False, f"GET still returns data: {get_data}")
                        else:
                            self.log_test("Test 3b: DELETE quest recurrence", False, f"GET after delete failed: {get_response.status_code}")
                    else:
                        self.log_test("Test 3b: DELETE quest recurrence", False, f"DELETE failed: {delete_response.status_code}, {delete_response.text}")
                else:
                    self.log_test("Test 3b: DELETE quest recurrence", False, f"Recurring rule not found before deletion")
            else:
                self.log_test("Test 3b: DELETE quest recurrence", False, f"Could not list recurring tasks: {recurring_list_response.status_code}")
                
        except Exception as e:
            self.log_test("Test 3b: DELETE quest recurrence", False, f"Exception: {str(e)}")
            
        return False
        
    def test_4_recurring_run_sets_recurring_id(self):
        """Test 4: Recurring/run still works and sets recurring_id on generated quests"""
        print("\n🔍 Test 4: Recurring/run sets recurring_id on generated quests")
        
        try:
            # Create a new recurring task for testing
            recurring_data = {
                "task_name": "Daily Review Test",
                "quest_rank": "Common",
                "frequency": "Daily"
            }
            
            create_response = self.session.post(f"{self.base_url}/recurring", json=recurring_data)
            if create_response.status_code == 200:
                recurring_task = create_response.json()
                test_recurring_id = recurring_task.get("id")
                
                # Run recurring generation
                run_response = self.session.post(f"{self.base_url}/recurring/run")
                if run_response.status_code == 200:
                    run_data = run_response.json()
                    created_count = run_data.get("created", 0)
                    
                    if created_count >= 1:
                        # Check if generated quest has recurring_id set
                        active_response = self.session.get(f"{self.base_url}/quests/active")
                        if active_response.status_code == 200:
                            active_quests = active_response.json()
                            generated_quest = None
                            
                            for quest in active_quests:
                                if (quest.get("quest_name") == "Daily Review Test" and 
                                    quest.get("recurring_id") == test_recurring_id):
                                    generated_quest = quest
                                    break
                                    
                            if generated_quest:
                                self.log_test("Test 4: Recurring/run sets recurring_id", True, f"Generated quest has correct recurring_id: {generated_quest.get('recurring_id')}")
                                
                                # Cleanup: delete the generated quest and recurring task
                                self.session.delete(f"{self.base_url}/quests/active/{generated_quest.get('id')}")
                                self.session.delete(f"{self.base_url}/recurring/{test_recurring_id}")
                                return True
                            else:
                                self.log_test("Test 4: Recurring/run sets recurring_id", False, f"Generated quest not found or missing recurring_id")
                        else:
                            self.log_test("Test 4: Recurring/run sets recurring_id", False, f"Could not list active quests: {active_response.status_code}")
                    else:
                        self.log_test("Test 4: Recurring/run sets recurring_id", False, f"No quests were created: {created_count}")
                else:
                    self.log_test("Test 4: Recurring/run sets recurring_id", False, f"Recurring run failed: {run_response.status_code}, {run_response.text}")
                    
                # Cleanup recurring task if it still exists
                self.session.delete(f"{self.base_url}/recurring/{test_recurring_id}")
            else:
                self.log_test("Test 4: Recurring/run sets recurring_id", False, f"Could not create recurring task: {create_response.status_code}, {create_response.text}")
                
        except Exception as e:
            self.log_test("Test 4: Recurring/run sets recurring_id", False, f"Exception: {str(e)}")
            
        return False
        
    def cleanup(self):
        """Clean up created test data"""
        if self.created_quest_id:
            try:
                self.session.delete(f"{self.base_url}/quests/active/{self.created_quest_id}")
                print(f"   Cleanup: Deleted test quest {self.created_quest_id}")
            except:
                pass
                
    def run_validation_tests(self):
        """Run all validation tests"""
        print(f"🔍 Starting Review Validation Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        tests = [
            self.test_1_create_quest_with_duration_minutes,
            self.test_2_patch_due_time_and_duration,
            self.test_3a_put_quest_recurrence,
            self.test_3b_delete_quest_recurrence,
            self.test_4_recurring_run_sets_recurring_id
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
            print()  # Add spacing between tests
            
        # Cleanup
        self.cleanup()
        
        print("=" * 60)
        print(f"📊 Validation Results: {passed}/{total} tests passed")
        
        # Report any 5xx errors
        five_xx_errors = []
        for result in self.test_results:
            if "500" in result["details"] or "5xx" in result["details"]:
                five_xx_errors.append(result)
                
        if five_xx_errors:
            print(f"⚠️  5xx Errors detected: {len(five_xx_errors)}")
            for error in five_xx_errors:
                print(f"   - {error['test']}: {error['details']}")
        else:
            print("✅ No 5xx errors detected")
        
        # Concise pass/fail per step
        print("\n📋 Concise Results:")
        print("1) Create quest with duration_minutes + verify persistence:", "✅ PASS" if any(r["test"].startswith("1") and r["success"] for r in self.test_results) else "❌ FAIL")
        print("2) PATCH due_time and duration_minutes:", "✅ PASS" if any(r["test"].startswith("Test 2") and r["success"] for r in self.test_results) else "❌ FAIL")
        print("3a) PUT recurrence + GET returns same:", "✅ PASS" if any(r["test"].startswith("Test 3a") and r["success"] for r in self.test_results) else "❌ FAIL")
        print("3b) DELETE recurrence unlinks and deletes:", "✅ PASS" if any(r["test"].startswith("Test 3b") and r["success"] for r in self.test_results) else "❌ FAIL")
        print("4) Recurring/run sets recurring_id:", "✅ PASS" if any(r["test"].startswith("Test 4") and r["success"] for r in self.test_results) else "❌ FAIL")
        
        return passed == total

def main():
    """Main test runner"""
    tester = ReviewValidationTester()
    success = tester.run_validation_tests()
    
    if success:
        print("\n✅ All review validation tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some validation tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()