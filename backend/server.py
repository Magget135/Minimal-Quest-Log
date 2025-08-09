from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
import uuid
from datetime import datetime, timezone, date, time as dtime

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# --- Constants ---
RANK_XP: Dict[str, int] = {
    "Common": 25,
    "Rare": 50,
    "Epic": 75,
    "Legendary": 100,
}

STATUS_OPTIONS = ["Pending", "In Progress", "Completed", "Incomplete"]
FREQUENCY_OPTIONS = ["Daily", "Weekly", "Weekdays", "Monthly", "Annual"]

# --- Models ---
class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    color: str  # hex color like #A3B18A
    active: bool = True

class CategoryCreate(BaseModel):
    name: str
    color: str
    active: Optional[bool] = True

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    active: Optional[bool] = None

class ActiveQuestCreate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quest_name: str
    quest_rank: Literal['Common', 'Rare', 'Epic', 'Legendary']
    due_date: date
    due_time: Optional[str] = None  # HH:MM (local user-facing), stored as string
    duration_minutes: Optional[int] = 60
    status: Literal['Pending', 'In Progress', 'Completed', 'Incomplete'] = 'Pending'
    redeem_reward: Optional[str] = None  # reward id from store (kept for compatibility)
    recurring_id: Optional[str] = None  # link to Recurringtasks
    category_id: Optional[str] = None  # link to Categories

class ActiveQuest(ActiveQuestCreate):
    pass

class ActiveQuestUpdate(BaseModel):
    quest_name: Optional[str] = None
    quest_rank: Optional[Literal['Common', 'Rare', 'Epic', 'Legendary']] = None
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Optional[Literal['Pending', 'In Progress', 'Completed', 'Incomplete']] = None
    redeem_reward: Optional[str] = None
    recurring_id: Optional[str] = None
    category_id: Optional[str] = None

class CompletedQuest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quest_name: str
    quest_rank: Literal['Common', 'Rare', 'Epic', 'Legendary']
    xp_earned: int
    date_completed: datetime  # UTC

class RewardStoreItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reward_name: str
    xp_cost: int

class RewardRedeemInput(BaseModel):
    reward_id: Optional[str] = None
    reward_name: Optional[str] = None  # allow direct name in case of future flexibility

class RewardLogItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date_redeemed: datetime
    reward_name: str
    xp_cost: int

class RewardInventoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date_redeemed: datetime
    reward_name: str
    xp_cost: int
    used: bool = False
    used_at: Optional[datetime] = None

class RecurringTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_name: str
    quest_rank: Literal['Common', 'Rare', 'Epic', 'Legendary']
    frequency: Literal['Daily', 'Weekly', 'Weekdays', 'Monthly', 'Annual']
    days: Optional[str] = None  # e.g., "Mon, Fri" for Weekly
    monthly_on_date: Optional[int] = None  # 1..31 for Monthly (by date)
    # Custom support
    interval: Optional[int] = 1  # every N units
    monthly_mode: Optional[Literal['date','weekday']] = None
    monthly_week_index: Optional[int] = None  # 1..5 or -1 for last
    monthly_weekday: Optional[str] = None  # 'Mon'..'Sun'
    ends: Optional[Literal['never','on_date','after']] = 'never'
    until_date: Optional[date] = None
    count: Optional[int] = None  # total occurrences limit when ends='after'
    occurrences: Optional[int] = 0  # how many times added
    start_date: Optional[date] = None  # anchor for interval math

    status: Literal['Pending', 'In Progress', 'Completed', 'Incomplete'] = 'Pending'
    last_added: Optional[date] = None

class RulesDoc(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str

# --- Helpers ---
def serialize_dates_for_mongo(data: dict) -> dict:
    """Convert date objects to ISO strings for MongoDB storage"""
    result = data.copy()
    for key, value in result.items():
        if isinstance(value, date) and not isinstance(value, datetime):
            result[key] = value.isoformat()
    return result

async def seed_reward_store_if_empty():
    count = await db.RewardStore.count_documents({})
    if count == 0:
        defaults = [
            {"reward_name": "1 Hour of Movie", "xp_cost": 100},
            {"reward_name": "$1 Credit", "xp_cost": 25},
            {"reward_name": "1 Hour of Gaming", "xp_cost": 100},
            {"reward_name": "1 Hour of Scrolling", "xp_cost": 100},
        ]
        for item in defaults:
            await db.RewardStore.insert_one(RewardStoreItem(**item).dict())

async def compute_xp_summary() -> Dict[str, int]:
    # Total earned from CompletedQuests
    earned_cur = db.CompletedQuests.find({}, {"xp_earned": 1, "_id": 0})
    total_earned = 0
    async for doc in earned_cur:
        total_earned += int(doc.get("xp_earned", 0))

    # Total spent from RewardLog
    spent_cur = db.RewardLog.find({}, {"xp_cost": 1, "_id": 0})
    total_spent = 0
    async for doc in spent_cur:
        total_spent += int(doc.get("xp_cost", 0))

    return {"total_earned": total_earned, "total_spent": total_spent, "balance": total_earned - total_spent}

async def get_reward_by_identifier(reward_id: Optional[str], reward_name: Optional[str]) -> Optional[Dict[str, Any]]:
    if reward_id:
        return await db.RewardStore.find_one({"id": reward_id})
    if reward_name:
        return await db.RewardStore.find_one({"reward_name": reward_name})
    return None

# --- Routes ---
@api_router.get("/")
async def root():
    return {"message": "Quest Tracker API"}

@api_router.get("/health")
async def health():
    return {"ok": True}

# Categories CRUD
@api_router.get("/categories", response_model=List[Category])
async def list_categories():
    cur = db.Categories.find({}, {"_id": 0}).sort("name", 1)
    return [Category(**doc) async for doc in cur]

@api_router.post("/categories", response_model=Category)
async def create_category(body: CategoryCreate):
    # Allow idempotent by name if needed: if exists with same name, return it
    existing = await db.Categories.find_one({"name": body.name}, {"_id": 0})
    if existing:
        # optionally update color/active if provided
        updates = {}
        if body.color and existing.get("color") != body.color:
            updates["color"] = body.color
        if body.active is not None and existing.get("active") != body.active:
            updates["active"] = body.active
        if updates:
            await db.Categories.update_one({"id": existing["id"]}, {"$set": updates})
            existing = await db.Categories.find_one({"id": existing["id"]}, {"_id": 0})
        return Category(**existing)
    cat = Category(name=body.name, color=body.color, active=bool(body.active))
    await db.Categories.insert_one(cat.dict())
    return cat

@api_router.patch("/categories/{category_id}", response_model=Category)
async def patch_category(category_id: str, body: CategoryUpdate):
    doc = await db.Categories.find_one({"id": category_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Category not found")
    update = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if update:
        await db.Categories.update_one({"id": category_id}, {"$set": update})
    updated = await db.Categories.find_one({"id": category_id}, {"_id": 0})
    return Category(**updated)

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    # Unlink category from tasks first (idempotent)
    await db.ActiveQuests.update_many({"category_id": category_id}, {"$set": {"category_id": None}})
    res = await db.Categories.delete_one({"id": category_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"ok": True}

# ActiveQuests CRUD
@api_router.get("/quests/active", response_model=List[ActiveQuest])
async def list_active_quests():
    cur = db.ActiveQuests.find({}, {"_id": 0})
    return [ActiveQuest(**doc) async for doc in cur]

@api_router.post("/quests/active", response_model=ActiveQuest)
async def create_active_quest(input: ActiveQuestCreate):
    if input.quest_rank not in RANK_XP:
        raise HTTPException(status_code=400, detail="Invalid quest_rank")
    if input.status not in STATUS_OPTIONS:
        raise HTTPException(status_code=400, detail="Invalid status")
    quest_data = serialize_dates_for_mongo(input.dict())
    await db.ActiveQuests.insert_one(quest_data)
    return input

@api_router.patch("/quests/active/{quest_id}", response_model=ActiveQuest)
async def update_active_quest(quest_id: str, input: ActiveQuestUpdate):
    doc = await db.ActiveQuests.find_one({"id": quest_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Quest not found")
    # Handle None values explicitly for optional fields like due_time and category_id
    input_dict = input.dict(exclude_unset=True)
    update = {}
    for k, v in input_dict.items():
        if k in ("due_time", "category_id"):
            update[k] = v
        elif v is not None:
            update[k] = v
    if "quest_rank" in update and update["quest_rank"] not in RANK_XP:
        raise HTTPException(status_code=400, detail="Invalid quest_rank")
    if "status" in update and update["status"] not in STATUS_OPTIONS:
        raise HTTPException(status_code=400, detail="Invalid status")
    # Serialize dates for MongoDB
    update = serialize_dates_for_mongo(update)
    await db.ActiveQuests.update_one({"id": quest_id}, {"$set": update})
    updated = await db.ActiveQuests.find_one({"id": quest_id}, {"_id": 0})
    return ActiveQuest(**updated)

@api_router.delete("/quests/active/{quest_id}")
async def delete_active_quest(quest_id: str):
    res = await db.ActiveQuests.delete_one({"id": quest_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quest not found")
    return {"ok": True}

# Complete or Incomplete actions
@api_router.post("/quests/active/{quest_id}/complete", response_model=CompletedQuest)
async def complete_active_quest(quest_id: str):
    doc = await db.ActiveQuests.find_one({"id": quest_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Quest not found")
    quest_rank = doc["quest_rank"]
    xp = RANK_XP.get(quest_rank, 0)
    completed = CompletedQuest(
        quest_name=doc["quest_name"],
        quest_rank=quest_rank,
        xp_earned=xp,
        date_completed=datetime.now(timezone.utc),
    )
    await db.CompletedQuests.insert_one(completed.dict())
    await db.ActiveQuests.delete_one({"id": quest_id})
    return completed

@api_router.post("/quests/active/{quest_id}/mark-incomplete")
async def mark_incomplete_active_quest(quest_id: str):
    res = await db.ActiveQuests.delete_one({"id": quest_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quest not found")
    return {"ok": True}

@api_router.get("/quests/completed", response_model=List[CompletedQuest])
async def list_completed_quests():
    cur = db.CompletedQuests.find({}, {"_id": 0})
    return [CompletedQuest(**doc) async for doc in cur]

# Rewards Store
@api_router.get("/rewards/store", response_model=List[RewardStoreItem])
async def list_reward_store():
    await seed_reward_store_if_empty()
    cur = db.RewardStore.find({}, {"_id": 0})
    return [RewardStoreItem(**doc) async for doc in cur]

class RewardStoreUpsert(BaseModel):
    id: Optional[str] = None
    reward_name: str
    xp_cost: int

@api_router.post("/rewards/store", response_model=RewardStoreItem)
async def upsert_reward_store(item: RewardStoreUpsert):
    if item.id:
        # update
        existing = await db.RewardStore.find_one({"id": item.id})
        if not existing:
            raise HTTPException(status_code=404, detail="Reward not found")
        await db.RewardStore.update_one({"id": item.id}, {"$set": {"reward_name": item.reward_name, "xp_cost": item.xp_cost}})
        updated = await db.RewardStore.find_one({"id": item.id}, {"_id": 0})
        return RewardStoreItem(**updated)
    # create
    new_item = RewardStoreItem(reward_name=item.reward_name, xp_cost=item.xp_cost)
    await db.RewardStore.insert_one(new_item.dict())
    return new_item

@api_router.delete("/rewards/store/{reward_id}")
async def delete_reward_store(reward_id: str):
    res = await db.RewardStore.delete_one({"id": reward_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    return {"ok": True}

# Reward Log and Redeem
@api_router.get("/rewards/log", response_model=List[RewardLogItem])
async def list_reward_log():
    cur = db.RewardLog.find({}, {"_id": 0})
    return [RewardLogItem(**doc) async for doc in cur]

@api_router.get("/rewards/inventory", response_model=List[RewardInventoryItem])
async def list_reward_inventory():
    cur = db.RewardInventory.find({}, {"_id": 0}).sort("date_redeemed", -1)
    return [RewardInventoryItem(**doc) async for doc in cur]

@api_router.post("/rewards/redeem", response_model=RewardInventoryItem)
async def redeem_reward(input: RewardRedeemInput):
    reward = await get_reward_by_identifier(input.reward_id, input.reward_name)
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    summary = await compute_xp_summary()
    if summary["balance"] &lt; int(reward["xp_cost"]):
        raise HTTPException(status_code=400, detail="Not enough XP to redeem")
    # Create log and inventory record
    now = datetime.now(timezone.utc)
    log_item = RewardLogItem(
        date_redeemed=now,
        reward_name=reward["reward_name"],
        xp_cost=int(reward["xp_cost"]),
    )
    inv_item = RewardInventoryItem(
        date_redeemed=now,
        reward_name=reward["reward_name"],
        xp_cost=int(reward["xp_cost"]),
        used=False,
        used_at=None,
    )
    await db.RewardLog.insert_one(log_item.dict())
    await db.RewardInventory.insert_one(inv_item.dict())
    return inv_item

@api_router.post("/rewards/use/{inventory_id}")
async def use_reward(inventory_id: str):
    doc = await db.RewardInventory.find_one({"id": inventory_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    if doc.get("used"):
        raise HTTPException(status_code=400, detail="Reward already used")
    await db.RewardInventory.update_one({"id": inventory_id}, {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}})
    return {"ok": True}

# XP summary
@api_router.get("/xp/summary")
async def xp_summary():
    return await compute_xp_summary()

# Recurring tasks
@api_router.get("/recurring", response_model=List[RecurringTask])
async def list_recurring():
    cur = db.Recurringtasks.find({}, {"_id": 0})
    return [RecurringTask(**doc) async for doc in cur]

# --- Recurring helpers for custom rules ---
def months_between(a: date, b: date) -> int:
    return (b.year - a.year) * 12 + (b.month - a.month)

def years_between(a: date, b: date) -> int:
    return b.year - a.year

WEEKDAY_INDEX = {
    'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6
}

def nth_weekday_day(year: int, month: int, weekday_idx: int, n: int) -> int:
    """Return the day-of-month for nth weekday (n=1..5, -1 for last)."""
    # Find all days in this month with weekday_idx
    first = date(year, month, 1)
    # iterate days of month
    days = []
    d = first
    while d.month == month:
        if d.weekday() == weekday_idx:
            days.append(d.day)
        d = d.replace(day=d.day + 1) if d.day &lt; 28 else (d + datetime.resolution).date()  # fallback
        try:
            d = date(d.year, d.month, d.day)
        except Exception:
            # rebuild safely
            if d.month != month:
                break
    if not days:
        return 1
    if n == -1:
        return days[-1]
    idx = max(1, min(n, len(days))) - 1
    return days[idx]

class RecurringUpsert(BaseModel):
    id: Optional[str] = None
    task_name: str
    quest_rank: Literal['Common', 'Rare', 'Epic', 'Legendary']
    frequency: Literal['Daily', 'Weekly', 'Weekdays', 'Monthly', 'Annual']
    days: Optional[str] = None
    monthly_on_date: Optional[int] = None
    # Custom fields
    interval: Optional[int] = 1
    monthly_mode: Optional[Literal['date','weekday']] = None
    monthly_week_index: Optional[int] = None
    monthly_weekday: Optional[str] = None
    ends: Optional[Literal['never','on_date','after']] = 'never'
    until_date: Optional[date] = None
    count: Optional[int] = None

    status: Literal['Pending', 'In Progress', 'Completed', 'Incomplete'] = 'Pending'

@api_router.post("/recurring", response_model=RecurringTask)
async def upsert_recurring(task: RecurringUpsert):
    if task.id:
        existing = await db.Recurringtasks.find_one({"id": task.id})
        if not existing:
            raise HTTPException(status_code=404, detail="Recurring task not found")
        await db.Recurringtasks.update_one({"id": task.id}, {"$set": {
            "task_name": task.task_name,
            "quest_rank": task.quest_rank,
            "frequency": task.frequency,
            "days": task.days,
            "monthly_on_date": task.monthly_on_date,
            "interval": task.interval,
            "monthly_mode": task.monthly_mode,
            "monthly_week_index": task.monthly_week_index,
            "monthly_weekday": task.monthly_weekday,
            "ends": task.ends,
            "until_date": task.until_date,
            "count": task.count,
            "status": task.status,
        }})
        updated = await db.Recurringtasks.find_one({"id": task.id}, {"_id": 0})
        return RecurringTask(**updated)
    new_task = RecurringTask(
        task_name=task.task_name,
        quest_rank=task.quest_rank,
        frequency=task.frequency,
        days=task.days,
        monthly_on_date=task.monthly_on_date,
        interval=task.interval,
        monthly_mode=task.monthly_mode,
        monthly_week_index=task.monthly_week_index,
        monthly_weekday=task.monthly_weekday,
        ends=task.ends,
        until_date=task.until_date,
        count=task.count,
        status=task.status,
        start_date=datetime.now(timezone.utc).date(),
    )
    task_data = serialize_dates_for_mongo(new_task.dict())
    await db.Recurringtasks.insert_one(task_data)
    return new_task

@api_router.delete("/recurring/{task_id}")
async def delete_recurring(task_id: str):
    res = await db.Recurringtasks.delete_one({"id": task_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recurring task not found")
    return {"ok": True}

def is_today_for_task(today: date, task: Dict[str, Any]) -> bool:
    freq = task.get('frequency')
    interval = int(task.get('interval') or 1)
    start = task.get('start_date') or today
    # Convert start_date from string to date if needed
    if isinstance(start, str):
        try:
            start = date.fromisoformat(start)
        except Exception:
            start = today
    occurrences = int(task.get('occurrences') or 0)

    # End rules
    ends = task.get('ends') or 'never'
    if ends == 'on_date':
        until = task.get('until_date')
        if until and today &gt; until:
            return False
    if ends == 'after':
        cnt = int(task.get('count') or 0)
        if cnt and occurrences &gt;= cnt:
            return False

    if freq == 'Daily':
        # every N days
        delta_days = (today - start).days
        return delta_days &gt;= 0 and delta_days % max(1, interval) == 0

    if freq == 'Weekdays':
        return today.weekday() &lt; 5

    if freq == 'Weekly':
        # every N weeks on selected days
        days_str = (task.get('days') or '').strip()
        if not days_str:
            return False
        parts = [p.strip() for p in days_str.split(',') if p.strip()]
        indices = {WEEKDAY_INDEX.get(p) for p in parts if WEEKDAY_INDEX.get(p) is not None}
        if today.weekday() not in indices:
            return False
        weeks = ((today - start).days) // 7
        return weeks &gt;= 0 and weeks % max(1, interval) == 0

    if freq == 'Monthly':
        monthly_mode = task.get('monthly_mode') or ('date' if task.get('monthly_on_date') else None)
        if monthly_mode == 'weekday':
            idx = int(task.get('monthly_week_index') or 1)
            wd = task.get('monthly_weekday')
            wd_idx = WEEKDAY_INDEX.get(wd) if wd else None
            if wd_idx is None:
                return False
            # Check interval by months difference from start
            m = months_between(start, today)
            if m &lt; 0 or (m % max(1, interval)) != 0:
                return False
            day = nth_weekday_day(today.year, today.month, wd_idx, idx)
            return today.day == day
        else:
            # by date
            target_day = int(task.get('monthly_on_date') or start.day)
            m = months_between(start, today)
            if m &lt; 0 or (m % max(1, interval)) != 0:
                return False
            return today.day == target_day

    if freq == 'Annual':
        y = years_between(start, today)
        if y &lt; 0 or (y % max(1, interval)) != 0:
            return False
        return (today.month, today.day) == (start.month, start.day)

    return False

@api_router.post("/recurring/run")
async def run_recurring_generation():
    today = datetime.now(timezone.utc).date()
    # Fetch all recurring tasks
    tasks = [doc async for doc in db.Recurringtasks.find({}, {"_id": 0})]

    created_count = 0
    for t in tasks:
        # Convert last_added from str to date if string
        last_added = t.get('last_added')
        if isinstance(last_added, str):
            try:
                t['last_added'] = date.fromisoformat(last_added)
            except Exception:
                t['last_added'] = None
        if is_today_for_task(today, t):
            # Avoid duplicate add same day
            if t.get('last_added') == today:
                continue
            new_q = ActiveQuest(
                quest_name=t['task_name'],
                quest_rank=t['quest_rank'],
                due_date=today,
                status='Pending',
                redeem_reward=None,
                recurring_id=t['id'],
            )
            quest_data = serialize_dates_for_mongo(new_q.dict())
            await db.ActiveQuests.insert_one(quest_data)
            # bump counters/last_added
            updates = {"last_added": today.isoformat(), "occurrences": int(t.get('occurrences') or 0) + 1}
            await db.Recurringtasks.update_one({"id": t['id']}, {"$set": updates})
            created_count += 1
    return {"created": created_count}

# Rules
@api_router.get("/rules", response_model=Optional[RulesDoc])
async def get_rules():
    doc = await db.Rules.find_one({}, {"_id": 0})
    if not doc:
        return None
    return RulesDoc(**doc)

class RulesUpsert(BaseModel):
    content: str

@api_router.put("/rules", response_model=RulesDoc)
async def put_rules(body: RulesUpsert):
    # single-document collection behavior
    existing = await db.Rules.find_one({})
    if existing:
        await db.Rules.update_one({"id": existing.get("id")}, {"$set": {"content": body.content}})
        updated = await db.Rules.find_one({"id": existing.get("id")}, {"_id": 0})
        return RulesDoc(**updated)
    doc = RulesDoc(content=body.content)
    await db.Rules.insert_one(doc.dict())
    return doc

# ---- New: Per-quest recurrence management ----
class QuestRecurrencePayload(BaseModel):
    frequency: Literal['Daily', 'Weekly', 'Weekdays', 'Monthly', 'Annual']
    days: Optional[str] = None
    monthly_on_date: Optional[int] = None
    interval: Optional[int] = 1
    monthly_mode: Optional[Literal['date','weekday']] = None
    monthly_week_index: Optional[int] = None
    monthly_weekday: Optional[str] = None
    ends: Optional[Literal['never','on_date','after']] = 'never'
    until_date: Optional[date] = None
    count: Optional[int] = None

@api_router.get("/quests/active/{quest_id}/recurrence", response_model=Optional[RecurringTask])
async def get_quest_recurrence(quest_id: str):
    q = await db.ActiveQuests.find_one({"id": quest_id})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    rec_id = q.get('recurring_id')
    if not rec_id:
        return None
    rec = await db.Recurringtasks.find_one({"id": rec_id}, {"_id": 0})
    if not rec:
        return None
    return RecurringTask(**rec)

@api_router.put("/quests/active/{quest_id}/recurrence", response_model=RecurringTask)
async def put_quest_recurrence(quest_id: str, body: QuestRecurrencePayload):
    q = await db.ActiveQuests.find_one({"id": quest_id})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    rec_id = q.get('recurring_id')
    if rec_id:
        # update existing recurring
        await db.Recurringtasks.update_one({"id": rec_id}, {"$set": {
            "task_name": q["quest_name"],
            "quest_rank": q["quest_rank"],
            "frequency": body.frequency,
            "days": body.days,
            "monthly_on_date": body.monthly_on_date,
            "interval": body.interval,
            "monthly_mode": body.monthly_mode,
            "monthly_week_index": body.monthly_week_index,
            "monthly_weekday": body.monthly_weekday,
            "ends": body.ends,
            "until_date": body.until_date,
            "count": body.count,
            "status": q["status"],
        }})
        rec = await db.Recurringtasks.find_one({"id": rec_id}, {"_id": 0})
        return RecurringTask(**rec)
    # create new recurring
    new_rec = RecurringTask(
        task_name=q["quest_name"],
        quest_rank=q["quest_rank"],
        frequency=body.frequency,
        days=body.days,
        monthly_on_date=body.monthly_on_date,
        interval=body.interval,
        monthly_mode=body.monthly_mode,
        monthly_week_index=body.monthly_week_index,
        monthly_weekday=body.monthly_weekday,
        ends=body.ends,
        until_date=body.until_date,
        count=body.count,
        status=q["status"],
        start_date=datetime.now(timezone.utc).date(),
    )
    await db.Recurringtasks.insert_one(serialize_dates_for_mongo(new_rec.dict()))
    await db.ActiveQuests.update_one({"id": quest_id}, {"$set": {"recurring_id": new_rec.id}})
    return new_rec

@api_router.delete("/quests/active/{quest_id}/recurrence")
async def delete_quest_recurrence(quest_id: str, delete_rule: bool = True):
    q = await db.ActiveQuests.find_one({"id": quest_id})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    rec_id = q.get('recurring_id')
    if not rec_id:
        return {"ok": True}
    # unlink quest
    await db.ActiveQuests.update_one({"id": quest_id}, {"$set": {"recurring_id": None}})
    if delete_rule:
        await db.Recurringtasks.delete_one({"id": rec_id})
    return {"ok": True}

# ---- Holidays 2025 ----
HOLIDAYS_2025 = [
    {"name": "New Year’s Day", "date": date(2025, 1, 1)},
    {"name": "MLK Jr. Day", "date": date(2025, 1, 20)},
    {"name": "Washington’s Birthday (Presidents Day)", "date": date(2025, 2, 17)},
    {"name": "Memorial Day", "date": date(2025, 5, 26)},
    {"name": "Juneteenth", "date": date(2025, 6, 19)},
    {"name": "Independence Day", "date": date(2025, 7, 4)},
    {"name": "Labor Day", "date": date(2025, 9, 1)},
    {"name": "Columbus Day (Indigenous Peoples’ Day)", "date": date(2025, 10, 13)},
    {"name": "Veterans Day", "date": date(2025, 11, 11)},
    {"name": "Thanksgiving Day", "date": date(2025, 11, 27)},
    {"name": "Christmas Day", "date": date(2025, 12, 25)},
]

HOLIDAYS_CATEGORY_NAME = "Holidays"
HOLIDAYS_CATEGORY_COLOR = "#A3B18A"  # soft sage green

async def ensure_holidays_category() -> Category:
    existing = await db.Categories.find_one({"name": HOLIDAYS_CATEGORY_NAME}, {"_id": 0})
    if existing:
        # ensure color is set to the configured value (non-destructive if already same)
        if existing.get("color") != HOLIDAYS_CATEGORY_COLOR:
            await db.Categories.update_one({"id": existing["id"]}, {"$set": {"color": HOLIDAYS_CATEGORY_COLOR}})
            existing = await db.Categories.find_one({"id": existing["id"]}, {"_id": 0})
        return Category(**existing)
    cat = Category(name=HOLIDAYS_CATEGORY_NAME, color=HOLIDAYS_CATEGORY_COLOR, active=True)
    await db.Categories.insert_one(cat.dict())
    return cat

@api_router.get("/holidays/2025")
async def list_holidays_2025():
    return [{"name": h["name"], "date": h["date"].isoformat()} for h in HOLIDAYS_2025]

@api_router.post("/holidays/seed-2025")
async def seed_holidays_2025():
    cat = await ensure_holidays_category()
    created = 0
    skipped = 0
    for h in HOLIDAYS_2025:
        qname = h["name"]
        qdate = h["date"].isoformat()
        # Idempotent check: same name + date + category
        existing = await db.ActiveQuests.find_one({
            "quest_name": qname,
            "due_date": qdate,
            "category_id": cat.id,
        })
        if existing:
            skipped += 1
            continue
        new_q = ActiveQuest(
            quest_name=qname,
            quest_rank='Common',
            due_date=h["date"],
            due_time=None,  # all-day
            duration_minutes=None,
            status='Pending',
            redeem_reward=None,
            recurring_id=None,
            category_id=cat.id,
        )
        await db.ActiveQuests.insert_one(serialize_dates_for_mongo(new_q.dict()))
        created += 1
    return {"created": created, "skipped": skipped, "category_id": cat.id}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()