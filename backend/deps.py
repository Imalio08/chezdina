"""
Chez Dina — shared primitives for the modular backend.

This module centralizes the stateful singletons and auth helpers that every
router needs. server.py and every file under `routers/` import from here.

Keeping these in a single module avoids duplicate Motor clients, duplicate
JWT secret decoding, and circular imports between server.py and routers.*
"""
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os, uuid, secrets
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt, jwt

# -------- Database --------
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

# -------- Auth config --------
JWT_SECRET = os.environ.get("JWT_SECRET", "dina-dev-secret")
JWT_ALG = "HS256"

# -------- Helpers --------
hash_pw = lambda p: bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_pw(p, h):
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def make_token(uid, role, m=60 * 24 * 7):
    return jwt.encode(
        {"sub": uid, "role": role, "exp": datetime.now(timezone.utc) + timedelta(minutes=m)},
        JWT_SECRET, algorithm=JWT_ALG,
    )

def make_customer_token(cid: str, m: int = 60 * 24 * 30):
    return jwt.encode(
        {"sub": cid, "kind": "customer", "exp": datetime.now(timezone.utc) + timedelta(minutes=m)},
        JWT_SECRET, algorithm=JWT_ALG,
    )

def new_id():
    return str(uuid.uuid4())

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def gen_access_code():
    return str(secrets.randbelow(1_000_000)).zfill(6)

def clean(d):
    """Recursively drop Mongo's _id keys for JSON serialization."""
    if isinstance(d, list):
        return [clean(x) for x in d]
    if isinstance(d, dict):
        return {k: clean(v) for k, v in d.items() if k != "_id"}
    return d

# -------- Auth dependencies --------
async def get_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(401, "Non authentifié")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Session expirée")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "Introuvable")
    for k in ("_id", "password_hash", "pin_hash"):
        user.pop(k, None)
    return user

def require_role(*roles):
    async def dep(user: dict = Depends(get_user)):
        if user.get("role") not in roles and user.get("role") != "admin":
            raise HTTPException(403, "Accès refusé")
        return user
    return dep


async def get_customer(request: Request):
    token = request.cookies.get("customer_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(401, "Non authentifié")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Session expirée")
    if payload.get("kind") != "customer":
        raise HTTPException(401, "Token invalide")
    c = await db.customers.find_one({"id": payload["sub"]})
    if not c:
        raise HTTPException(401, "Compte introuvable")
    for k in ("_id", "password_hash"):
        c.pop(k, None)
    return c


def norm_phone(p: str) -> str:
    """Keep only digits — used for loose phone matching (last 8 digits)."""
    return "".join(ch for ch in (p or "") if ch.isdigit())
