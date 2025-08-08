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
from datetime import datetime, timezone, date

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
FREQUENCY_OPTIONS = ["Daily", "Weekly", "Weekdays", "Monthly"]

# --- Models ---
class ActiveQuestCreate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quest_name: str
    quest_rank: Literal['Common', 'Rare', 'Epic', 'Legendary']
    due_date: date
    status: Literal['Pending', 'In Progress', 'Completed', 'Incomplete'] = 'Pending'
    redeem_reward: Optional[str] = None  # reward name selected from store

class ActiveQuest(ActiveQuestCreate):
    pass

class ActiveQuestUpdate(BaseModel):
    quest_name: Optional[str] = None
    quest_rank: Optional[Literal['Common', 'Rare', 'Epic', 'Legendary']] = None
    due_date: Optional[date] = None
    status: Optional[Literal['Pending', 'In Progress', 'Completed', 'Incomplete']] = None
    redeem_reward: Optional[str] = None

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

class RecurringTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_name: str
    quest_rank: Literal['Common', 'Rare', 'Epic', 'Legendary']
    frequency: Literal['Daily', 'Weekly', 'Weekdays', 'Monthly']
    days: Optional[str] = None  # e.g., "Mon, Fri" for Weekly
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
    update = {k: v for k, v in input.dict(exclude_unset=True).items() if v is not None}
    if "quest_rank" in update and update["quest_rank"] not in RANK_XP:
        raise HTTPException(status_code=400, detail="Invalid quest_rank")
    if "status" in update and update["status"] not in STATUS_OPTIONS:
        raise HTTPException(status_code=400, detail="Invalid status")
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

@api_router.post("/rewards/redeem", response_model=RewardLogItem)
async def redeem_reward(input: RewardRedeemInput):
    reward = await get_reward_by_identifier(input.reward_id, input.reward_name)
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    summary = await compute_xp_summary()
    if summary["balance"] < int(reward["xp_cost"]):
        raise HTTPException(status_code=400, detail="Not enough XP to redeem")
    log_item = RewardLogItem(
        date_redeemed=datetime.now(timezone.utc),
        reward_name=reward["reward_name"],
        xp_cost=int(reward["xp_cost"]),
    )
    await db.RewardLog.insert_one(log_item.dict())
    return log_item

# XP summary
@api_router.get("/xp/summary")
async def xp_summary():
    return await compute_xp_summary()

# Recurring tasks
@api_router.get("/recurring", response_model=List[RecurringTask])
async def list_recurring():
    cur = db.Recurringtasks.find({}, {"_id": 0})
    return [RecurringTask(**doc) async for doc in cur]

class RecurringUpsert(BaseModel):
    id: Optional[str] = None
    task_name: str
    quest_rank: Literal['Common', 'Rare', 'Epic', 'Legendary']
    frequency: Literal['Daily', 'Weekly', 'Weekdays', 'Monthly']
    days: Optional[str] = None
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
            "status": task.status,
        }})
        updated = await db.Recurringtasks.find_one({"id": task.id}, {"_id": 0})
        return RecurringTask(**updated)
    new_task = RecurringTask(
        task_name=task.task_name,
        quest_rank=task.quest_rank,
        frequency=task.frequency,
        days=task.days,
        status=task.status,
    )
    await db.Recurringtasks.insert_one(new_task.dict())
    return new_task

@api_router.delete("/recurring/{task_id}")
async def delete_recurring(task_id: str):
    res = await db.Recurringtasks.delete_one({"id": task_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recurring task not found")
    return {"ok": True}

# Helper to parse weekly days like 'Mon, Fri'
WEEKDAY_INDEX = {
    'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6
}

def is_today_for_task(today: date, task: Dict[str, Any]) -> bool:
    freq = task.get('frequency')
    if freq == 'Daily':
        return True
    if freq == 'Weekdays':
        return today.weekday() < 5
    if freq == 'Monthly':
        # Run on the same day-of-month as when it was created if last_added is None,
        # else run once per new calendar month
        last_added = task.get('last_added')
        if last_added is None:
            return True
        return (today.year, today.month) != (last_added.year, last_added.month)
    if freq == 'Weekly':
        days_str = (task.get('days') or '').strip()
        if not days_str:
            return False
        parts = [p.strip() for p in days_str.split(',') if p.strip()]
        indices = {WEEKDAY_INDEX.get(p) for p in parts if WEEKDAY_INDEX.get(p) is not None}
        return today.weekday() in indices
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
            )
            quest_data = serialize_dates_for_mongo(new_q.dict())
            await db.ActiveQuests.insert_one(quest_data)
            await db.Recurringtasks.update_one({"id": t['id']}, {"$set": {"last_added": today.isoformat()}})
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