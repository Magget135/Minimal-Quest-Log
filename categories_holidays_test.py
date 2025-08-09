#!/usr/bin/env python3
"""
Categories and Holidays Backend API Testing Suite
Tests the new Categories and Holidays features while ensuring no regressions
"""

import requests
import json
from datetime import datetime, date
import sys
import random
import string

# Use the production backend URL from frontend/.env
BASE_URL = "https://fd8786ae-2506-4181-9443-332a0afbad8b.preview.emergentagent.com/api"

class CategoriesHolidaysTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.test_results = []
        self.created_category_id = None
        self.created_quest_id = None
        self.holidays_category_id = None
        
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
        
    def generate_random_suffix(self):
        """Generate random suffix for test data"""
        return ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        
    def test_health_baseline(self):
        """1) Health + baseline sanity - GET /api/health => {ok:true}"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") is True:
                    self.log_test("Health endpoint baseline", True, f"Response: {data}")
                    return True
                else:
                    self.log_test("Health endpoint baseline", False, f"Expected {{ok: true}}, got: {data}")
            else:
                self.log_test("Health endpoint baseline", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Health endpoint baseline", False, f"Exception: {str(e)}")
        return False
        
    def test_active_quests_baseline(self):
        """1) Health + baseline sanity - GET /api/quests/active should return array"""
        try:
            response = self.session.get(f"{self.base_url}/quests/active")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Active quests baseline", True, f"Retrieved {len(data)} active quests (array)")
                    return True
                else:
                    self.log_test("Active quests baseline", False, f"Expected array, got: {type(data)}")
            else:
                self.log_test("Active quests baseline", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Active quests baseline", False, f"Exception: {str(e)}")
        return False
        
    def test_create_category(self):
        """2) Categories API - POST /api/categories {name:"Sample", color:"#ffccaa"}"""
        try:
            suffix = self.generate_random_suffix()
            category_data = {
                "name": f"Sample_{suffix}",
                "color": "#ffccaa"
            }
            response = self.session.post(f"{self.base_url}/categories", json=category_data)
            if response.status_code == 200:
                data = response.json()
                self.created_category_id = data.get("id")
                if (data.get("name") == category_data["name"] and 
                    data.get("color") == category_data["color"] and
                    data.get("active") is True and
                    data.get("id") is not None):
                    self.log_test("Create category", True, f"Created category with ID: {self.created_category_id}")
                    return True
                else:
                    self.log_test("Create category", False, f"Category data mismatch: {data}")
            else:
                self.log_test("Create category", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Create category", False, f"Exception: {str(e)}")
        return False
        
    def test_list_categories(self):
        """2) Categories API - GET /api/categories includes the new category"""
        try:
            response = self.session.get(f"{self.base_url}/categories")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Find our created category
                    created_category = None
                    for cat in data:
                        if cat.get("id") == self.created_category_id:
                            created_category = cat
                            break
                    
                    if created_category:
                        self.log_test("List categories includes new", True, f"Found created category in list of {len(data)} categories")
                        return True
                    else:
                        self.log_test("List categories includes new", False, f"Created category not found in list of {len(data)} categories")
                else:
                    self.log_test("List categories includes new", False, f"Expected array, got: {type(data)}")
            else:
                self.log_test("List categories includes new", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("List categories includes new", False, f"Exception: {str(e)}")
        return False
        
    def test_update_category(self):
        """2) Categories API - PATCH /api/categories/{id} {name:"Renamed", color:"#aabbcc", active:false}"""
        if not self.created_category_id:
            self.log_test("Update category", False, "No category ID available for update")
            return False
            
        try:
            update_data = {
                "name": "Renamed",
                "color": "#aabbcc",
                "active": False
            }
            response = self.session.patch(f"{self.base_url}/categories/{self.created_category_id}", json=update_data)
            if response.status_code == 200:
                data = response.json()
                if (data.get("name") == "Renamed" and 
                    data.get("color") == "#aabbcc" and
                    data.get("active") is False):
                    self.log_test("Update category", True, f"Successfully updated category: {data}")
                    return True
                else:
                    self.log_test("Update category", False, f"Update data mismatch: {data}")
            else:
                self.log_test("Update category", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Update category", False, f"Exception: {str(e)}")
        return False
        
    def test_delete_category(self):
        """2) Categories API - DELETE /api/categories/{id} => {ok:true}"""
        if not self.created_category_id:
            self.log_test("Delete category", False, "No category ID available for deletion")
            return False
            
        try:
            response = self.session.delete(f"{self.base_url}/categories/{self.created_category_id}")
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") is True:
                    self.log_test("Delete category", True, f"Successfully deleted category: {data}")
                    return True
                else:
                    self.log_test("Delete category", False, f"Expected {{ok: true}}, got: {data}")
            else:
                self.log_test("Delete category", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Delete category", False, f"Exception: {str(e)}")
        return False
        
    def test_verify_category_deletion(self):
        """2) Categories API - Verify deletion truly removes from GET /api/categories"""
        try:
            response = self.session.get(f"{self.base_url}/categories")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Ensure our deleted category is not in the list
                    deleted_category_found = any(cat.get("id") == self.created_category_id for cat in data)
                    if not deleted_category_found:
                        self.log_test("Verify category deletion", True, f"Deleted category not found in list of {len(data)} categories")
                        return True
                    else:
                        self.log_test("Verify category deletion", False, f"Deleted category still found in categories list")
                else:
                    self.log_test("Verify category deletion", False, f"Expected array, got: {type(data)}")
            else:
                self.log_test("Verify category deletion", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Verify category deletion", False, f"Exception: {str(e)}")
        return False
        
    def test_holidays_list_2025(self):
        """3) Holidays list - GET /api/holidays/2025 returns 11 entries with correct name/date iso strings"""
        try:
            response = self.session.get(f"{self.base_url}/holidays/2025")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) == 11:
                    # Check that all entries have name and date fields with valid ISO dates
                    all_valid = True
                    for item in data:
                        if not item.get("name") or not isinstance(item.get("name"), str):
                            all_valid = False
                            break
                        if not item.get("date") or not isinstance(item.get("date"), str):
                            all_valid = False
                            break
                        try:
                            # Verify it's a valid ISO date
                            date.fromisoformat(item.get("date"))
                        except:
                            all_valid = False
                            break
                    
                    if all_valid:
                        self.log_test("Holidays list 2025", True, f"Retrieved 11 holidays with valid names and ISO date strings")
                        return True
                    else:
                        self.log_test("Holidays list 2025", False, f"Some holidays have invalid name or date format")
                else:
                    self.log_test("Holidays list 2025", False, f"Expected 11 holidays, got {len(data) if isinstance(data, list) else 'non-array'}")
            else:
                self.log_test("Holidays list 2025", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Holidays list 2025", False, f"Exception: {str(e)}")
        return False
        
    def test_holidays_seed_first_time(self):
        """3) Holidays seeding - POST /api/holidays/seed-2025 once => response contains created:11, skipped:0, category_id"""
        try:
            response = self.session.post(f"{self.base_url}/holidays/seed-2025")
            if response.status_code == 200:
                data = response.json()
                created = data.get("created", 0)
                skipped = data.get("skipped", 0)
                category_id = data.get("category_id")
                
                if created == 11 and skipped == 0 and category_id:
                    self.holidays_category_id = category_id
                    self.log_test("Holidays seed first time", True, f"Created 11 holidays, skipped 0, category_id: {category_id}")
                    return True
                else:
                    # Allow for partial creation if some holidays already exist
                    if created + skipped == 11 and category_id:
                        self.holidays_category_id = category_id
                        self.log_test("Holidays seed first time", True, f"Created {created} holidays, skipped {skipped}, category_id: {category_id}")
                        return True
                    else:
                        self.log_test("Holidays seed first time", False, f"Expected created+skipped=11, got created:{created}, skipped:{skipped}, category_id:{category_id}")
            else:
                self.log_test("Holidays seed first time", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Holidays seed first time", False, f"Exception: {str(e)}")
        return False
        
    def test_holidays_seed_idempotent(self):
        """3) Holidays seeding - POST /api/holidays/seed-2025 again => created:0, skipped:11"""
        try:
            response = self.session.post(f"{self.base_url}/holidays/seed-2025")
            if response.status_code == 200:
                data = response.json()
                created = data.get("created", 0)
                skipped = data.get("skipped", 0)
                category_id = data.get("category_id")
                
                if created == 0 and skipped == 11 and category_id == self.holidays_category_id:
                    self.log_test("Holidays seed idempotent", True, f"Created 0 holidays, skipped 11 (idempotent behavior)")
                    return True
                else:
                    self.log_test("Holidays seed idempotent", False, f"Expected created:0, skipped:11, got created:{created}, skipped:{skipped}")
            else:
                self.log_test("Holidays seed idempotent", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Holidays seed idempotent", False, f"Exception: {str(e)}")
        return False
        
    def test_holiday_quests_created(self):
        """3) Holidays seeding - GET /api/quests/active contains 11 holiday quests with correct properties"""
        try:
            response = self.session.get(f"{self.base_url}/quests/active")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Find holiday quests (those with our holidays category_id)
                    holiday_quests = [quest for quest in data if quest.get("category_id") == self.holidays_category_id]
                    
                    if len(holiday_quests) == 11:
                        # Check properties of holiday quests
                        expected_names = [
                            "New Year's Day", "MLK Jr. Day", "Washington's Birthday (Presidents Day)",
                            "Memorial Day", "Juneteenth", "Independence Day", "Labor Day",
                            "Columbus Day (Indigenous Peoples' Day)", "Veterans Day", "Thanksgiving Day", "Christmas Day"
                        ]
                        
                        quest_names = [quest.get("quest_name") for quest in holiday_quests]
                        all_names_match = all(name in quest_names for name in expected_names)
                        
                        if not all_names_match:
                            print(f"   Expected names: {expected_names}")
                            print(f"   Found names: {quest_names}")
                            missing = [name for name in expected_names if name not in quest_names]
                            print(f"   Missing: {missing}")
                        
                        # Check that all holiday quests have due_time=null and duration_minutes=null
                        all_all_day = all(
                            quest.get("due_time") is None and quest.get("duration_minutes") is None
                            for quest in holiday_quests
                        )
                        
                        # Check that all have the correct category_id
                        all_correct_category = all(
                            quest.get("category_id") == self.holidays_category_id
                            for quest in holiday_quests
                        )
                        
                        if all_names_match and all_all_day and all_correct_category:
                            self.log_test("Holiday quests created", True, f"Found 11 holiday quests with correct names, all-day format, and category_id")
                            return True
                        else:
                            self.log_test("Holiday quests created", False, f"Holiday quests have incorrect properties: names_match={all_names_match}, all_day={all_all_day}, correct_category={all_correct_category}")
                    else:
                        self.log_test("Holiday quests created", False, f"Expected 11 holiday quests, found {len(holiday_quests)}")
                else:
                    self.log_test("Holiday quests created", False, f"Expected array, got: {type(data)}")
            else:
                self.log_test("Holiday quests created", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Holiday quests created", False, f"Exception: {str(e)}")
        return False
        
    def test_category_delete_unlink_behavior(self):
        """4) Category delete behavior - Create category, create quest with it, delete category, verify quest remains with category_id=null"""
        try:
            # Create a new category
            suffix = self.generate_random_suffix()
            category_data = {
                "name": f"TestCategory_{suffix}",
                "color": "#123456"
            }
            cat_response = self.session.post(f"{self.base_url}/categories", json=category_data)
            if cat_response.status_code != 200:
                self.log_test("Category delete unlink behavior", False, f"Failed to create test category: {cat_response.status_code}")
                return False
                
            test_category_id = cat_response.json().get("id")
            
            # Create an active quest with this category_id
            today = date.today().isoformat()
            quest_data = {
                "quest_name": f"Test Quest for Category Delete_{suffix}",
                "quest_rank": "Common",
                "due_date": today,
                "status": "Pending",
                "category_id": test_category_id
            }
            quest_response = self.session.post(f"{self.base_url}/quests/active", json=quest_data)
            if quest_response.status_code != 200:
                self.log_test("Category delete unlink behavior", False, f"Failed to create test quest: {quest_response.status_code}")
                return False
                
            test_quest_id = quest_response.json().get("id")
            
            # Delete the category
            delete_response = self.session.delete(f"{self.base_url}/categories/{test_category_id}")
            if delete_response.status_code != 200:
                self.log_test("Category delete unlink behavior", False, f"Failed to delete test category: {delete_response.status_code}")
                return False
            
            # Verify the quest still exists but with category_id=null
            quest_check_response = self.session.get(f"{self.base_url}/quests/active")
            if quest_check_response.status_code == 200:
                active_quests = quest_check_response.json()
                test_quest = None
                for quest in active_quests:
                    if quest.get("id") == test_quest_id:
                        test_quest = quest
                        break
                
                if test_quest:
                    if test_quest.get("category_id") is None:
                        self.log_test("Category delete unlink behavior", True, f"Quest remains with category_id=null after category deletion")
                        # Cleanup: delete the test quest
                        self.session.delete(f"{self.base_url}/quests/active/{test_quest_id}")
                        return True
                    else:
                        self.log_test("Category delete unlink behavior", False, f"Quest still has category_id: {test_quest.get('category_id')}")
                        # Cleanup: delete the test quest
                        self.session.delete(f"{self.base_url}/quests/active/{test_quest_id}")
                else:
                    self.log_test("Category delete unlink behavior", False, f"Test quest not found after category deletion")
            else:
                self.log_test("Category delete unlink behavior", False, f"Failed to check active quests: {quest_check_response.status_code}")
                
        except Exception as e:
            self.log_test("Category delete unlink behavior", False, f"Exception: {str(e)}")
        return False
        
    def run_all_tests(self):
        """Run all Categories and Holidays tests"""
        print(f"🚀 Starting Categories and Holidays Backend API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 70)
        
        tests = [
            # 1) Health + baseline sanity
            self.test_health_baseline,
            self.test_active_quests_baseline,
            
            # 2) Categories API
            self.test_create_category,
            self.test_list_categories,
            self.test_update_category,
            self.test_delete_category,
            self.test_verify_category_deletion,
            
            # 3) Holidays list + seeding
            self.test_holidays_list_2025,
            self.test_holidays_seed_first_time,
            self.test_holidays_seed_idempotent,
            self.test_holiday_quests_created,
            
            # 4) Category delete behavior
            self.test_category_delete_unlink_behavior
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
            print()  # Add spacing between tests
            
        print("=" * 70)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All Categories and Holidays tests passed!")
            return True
        else:
            print(f"⚠️  {total - passed} tests failed")
            return False

def main():
    """Main test runner"""
    tester = CategoriesHolidaysTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Categories and Holidays backend testing completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some Categories and Holidays tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()