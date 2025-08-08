#!/usr/bin/env python3
"""
Focused Recurring Logic Testing
Re-test modified recurring logic quickly as requested
"""

import requests
import json
from datetime import datetime, date
import sys

# Use the production backend URL from frontend/.env
BASE_URL = "https://ffa318d9-8342-4b52-9a53-56068d8055df.preview.emergentagent.com/api"

class RecurringLogicTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.test_results = []
        self.created_recurring_ids = []
        
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
        
    def cleanup_created_recurring_tasks(self):
        """Clean up any recurring tasks created during testing"""
        for task_id in self.created_recurring_ids:
            try:
                self.session.delete(f"{self.base_url}/recurring/{task_id}")
            except:
                pass
                
    def get_today_info(self):
        """Get today's date information"""
        today = date.today()
        weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        today_short = weekday_names[today.weekday()]
        today_day = today.day
        return today, today_short, today_day
        
    def count_active_quests_by_name(self, quest_name):
        """Count active quests with specific name"""
        try:
            response = self.session.get(f"{self.base_url}/quests/active")
            if response.status_code == 200:
                quests = response.json()
                return len([q for q in quests if q.get("quest_name") == quest_name])
        except:
            pass
        return 0
        
    def test_weekly_recurring_current_weekday(self):
        """Test 1: Create recurring Weekly on current weekday"""
        today, today_short, today_day = self.get_today_info()
        
        try:
            # Create Weekly recurring task for current weekday
            recurring_data = {
                "task_name": "WkTest",
                "quest_rank": "Common",
                "frequency": "Weekly",
                "days": today_short  # e.g., "Fri"
            }
            
            response = self.session.post(f"{self.base_url}/recurring", json=recurring_data)
            if response.status_code == 200:
                task_data = response.json()
                task_id = task_data.get("id")
                self.created_recurring_ids.append(task_id)
                
                # Count WkTest quests before generation
                before_count = self.count_active_quests_by_name("WkTest")
                
                # Run recurring generation
                run_response = self.session.post(f"{self.base_url}/recurring/run")
                if run_response.status_code == 200:
                    run_data = run_response.json()
                    
                    # Count WkTest quests after generation
                    after_count = self.count_active_quests_by_name("WkTest")
                    
                    if after_count > before_count:
                        self.log_test("Weekly on current weekday", True, f"Created Weekly task for {today_short}, generated {after_count - before_count} ActiveQuest(s)")
                        return True
                    else:
                        self.log_test("Weekly on current weekday", False, f"No ActiveQuest generated for {today_short} (before: {before_count}, after: {after_count})")
                else:
                    self.log_test("Weekly on current weekday", False, f"Recurring run failed: {run_response.status_code}")
            else:
                self.log_test("Weekly on current weekday", False, f"Failed to create recurring task: {response.status_code}, {response.text}")
        except Exception as e:
            self.log_test("Weekly on current weekday", False, f"Exception: {str(e)}")
        return False
        
    def test_monthly_on_date_rule(self):
        """Test 2: Create Monthly on date rule"""
        today, today_short, today_day = self.get_today_info()
        
        try:
            # Create Monthly recurring task for current date
            recurring_data = {
                "task_name": "MonDate",
                "quest_rank": "Common",
                "frequency": "Monthly",
                "monthly_on_date": today_day  # e.g., 8
            }
            
            response = self.session.post(f"{self.base_url}/recurring", json=recurring_data)
            if response.status_code == 200:
                task_data = response.json()
                task_id = task_data.get("id")
                self.created_recurring_ids.append(task_id)
                
                # Count MonDate quests before generation
                before_count = self.count_active_quests_by_name("MonDate")
                
                # Run recurring generation
                run_response = self.session.post(f"{self.base_url}/recurring/run")
                if run_response.status_code == 200:
                    run_data = run_response.json()
                    
                    # Count MonDate quests after generation
                    after_count = self.count_active_quests_by_name("MonDate")
                    
                    if after_count > before_count:
                        self.log_test("Monthly on date rule", True, f"Created Monthly task for day {today_day}, generated {after_count - before_count} ActiveQuest(s)")
                        return True
                    else:
                        self.log_test("Monthly on date rule", False, f"No ActiveQuest generated for day {today_day} (before: {before_count}, after: {after_count})")
                else:
                    self.log_test("Monthly on date rule", False, f"Recurring run failed: {run_response.status_code}")
            else:
                self.log_test("Monthly on date rule", False, f"Failed to create recurring task: {response.status_code}, {response.text}")
        except Exception as e:
            self.log_test("Monthly on date rule", False, f"Exception: {str(e)}")
        return False
        
    def test_annual_rule(self):
        """Test 3: Create Annual rule"""
        try:
            # Create Annual recurring task
            recurring_data = {
                "task_name": "Ann",
                "quest_rank": "Common",
                "frequency": "Annual"
            }
            
            response = self.session.post(f"{self.base_url}/recurring", json=recurring_data)
            if response.status_code == 200:
                task_data = response.json()
                task_id = task_data.get("id")
                self.created_recurring_ids.append(task_id)
                
                # Count Ann quests before generation
                before_count = self.count_active_quests_by_name("Ann")
                
                # Run recurring generation
                run_response = self.session.post(f"{self.base_url}/recurring/run")
                if run_response.status_code == 200:
                    run_data = run_response.json()
                    
                    # Count Ann quests after generation
                    after_count = self.count_active_quests_by_name("Ann")
                    
                    if after_count > before_count:
                        self.log_test("Annual rule", True, f"Created Annual task, generated {after_count - before_count} ActiveQuest(s) on first run")
                        return True
                    else:
                        self.log_test("Annual rule", False, f"No ActiveQuest generated for Annual task on first run (before: {before_count}, after: {after_count})")
                else:
                    self.log_test("Annual rule", False, f"Recurring run failed: {run_response.status_code}")
            else:
                self.log_test("Annual rule", False, f"Failed to create recurring task: {response.status_code}, {response.text}")
        except Exception as e:
            self.log_test("Annual rule", False, f"Exception: {str(e)}")
        return False
        
    def test_weekdays_rule(self):
        """Test 4: Create Weekdays rule"""
        today, today_short, today_day = self.get_today_info()
        is_weekday = today.weekday() < 5  # Monday=0, Friday=4
        
        try:
            # Create Weekdays recurring task
            recurring_data = {
                "task_name": "Weekdays",
                "quest_rank": "Common",
                "frequency": "Weekdays"
            }
            
            response = self.session.post(f"{self.base_url}/recurring", json=recurring_data)
            if response.status_code == 200:
                task_data = response.json()
                task_id = task_data.get("id")
                self.created_recurring_ids.append(task_id)
                
                # Count Weekdays quests before generation
                before_count = self.count_active_quests_by_name("Weekdays")
                
                # Run recurring generation
                run_response = self.session.post(f"{self.base_url}/recurring/run")
                if run_response.status_code == 200:
                    run_data = run_response.json()
                    
                    # Count Weekdays quests after generation
                    after_count = self.count_active_quests_by_name("Weekdays")
                    
                    if is_weekday:
                        # Today is Mon-Fri, expect ActiveQuest
                        if after_count > before_count:
                            self.log_test("Weekdays rule", True, f"Today is {today_short} (weekday), generated {after_count - before_count} ActiveQuest(s)")
                            return True
                        else:
                            self.log_test("Weekdays rule", False, f"Today is {today_short} (weekday) but no ActiveQuest generated (before: {before_count}, after: {after_count})")
                    else:
                        # Today is Sat/Sun, expect no ActiveQuest
                        if after_count == before_count:
                            self.log_test("Weekdays rule", True, f"Today is {today_short} (weekend), correctly generated no ActiveQuest")
                            return True
                        else:
                            self.log_test("Weekdays rule", False, f"Today is {today_short} (weekend) but generated {after_count - before_count} ActiveQuest(s)")
                else:
                    self.log_test("Weekdays rule", False, f"Recurring run failed: {run_response.status_code}")
            else:
                self.log_test("Weekdays rule", False, f"Failed to create recurring task: {response.status_code}, {response.text}")
        except Exception as e:
            self.log_test("Weekdays rule", False, f"Exception: {str(e)}")
        return False
        
    def run_recurring_tests(self):
        """Run all recurring logic tests"""
        today, today_short, today_day = self.get_today_info()
        
        print(f"🔄 Testing Modified Recurring Logic")
        print(f"📅 Today: {today.strftime('%A %B %d, %Y')} ({today_short} {today_day})")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        tests = [
            ("1) Weekly on current weekday", self.test_weekly_recurring_current_weekday),
            ("2) Monthly on date rule", self.test_monthly_on_date_rule),
            ("3) Annual rule", self.test_annual_rule),
            ("4) Weekdays rule", self.test_weekdays_rule)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n🧪 {test_name}")
            if test_func():
                passed += 1
            
        # Cleanup
        print(f"\n🧹 Cleaning up {len(self.created_recurring_ids)} created recurring tasks...")
        self.cleanup_created_recurring_tasks()
            
        print("\n" + "=" * 60)
        print(f"📊 Recurring Logic Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All recurring logic tests passed!")
            return True
        else:
            print(f"⚠️  {total - passed} recurring logic tests failed")
            return False

def main():
    """Main test runner"""
    tester = RecurringLogicTester()
    success = tester.run_recurring_tests()
    
    if success:
        print("\n✅ Recurring logic testing completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some recurring logic tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()