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
    path = request.url.path
    request.state.role = user.get("role")
    if user.get("role") == "rider" and not path.startswith(RIDER_PREFIXES):
        raise HTTPException(403, "Accès réservé à l'équipe de la boutique")
    from role_access import api_allowed
    if not api_allowed(user.get("role"), request.method, path):
        raise HTTPException(403, "Accès non autorisé pour votre rôle")
    if not path.startswith(PUNCH_FREE) and await punch_required(user):
        raise HTTPException(428, "Pointage d'arrivée requis")
    return user


RIDER_PREFIXES = ("/api/auth/", "/api/attendance/me", "/api/attendance/check-in", "/api/business", "/api/deliveries",
                  "/api/delivery-templates", "/api/me/", "/api/notifications", "/api/orders-messages", "/api/orders/",
                  "/api/rider", "/api/users/me", "/api/push/", "/api/public/")
PUNCH_FREE = ("/api/auth/", "/api/attendance/me", "/api/attendance/check-in")
_punch_cfg = {"at": 0.0, "roles": set()}


def reset_punch_cache():
    _punch_cfg["at"] = 0.0


async def _punch_roles() -> set:
    import time
    if time.time() - _punch_cfg["at"] > 60:
        biz = await db.business.find_one({"id": "main"}, {"attendance_config": 1}) or {}
        cfg = biz.get("attendance_config") or {}
        roles = set(cfg.get("enabled_roles") or ["manager", "sales", "stock_keeper", "community_manager"]) if cfg.get("enabled", True) else set()
        _punch_cfg.update(at=time.time(), roles=roles - {"admin", "rider"})
    return _punch_cfg["roles"]


async def punch_required(user: dict) -> bool:
    """Console staff (not admin / rider) must have an open arrival punch today."""
    if user.get("role") in ("admin", "rider") or user.get("role") not in await _punch_roles():
        return False
    today = datetime.now(timezone.utc).date().isoformat()
    last = await db.attendance.find_one({"user_id": user["id"], "day": today}, {"kind": 1}, sort=[("at", -1)])
    return not last or last.get("kind") not in ("arrival", "in")

def require_role(*roles):
    async def dep(user: dict = Depends(get_user)):
        if user.get("role") not in roles and user.get("role") != "admin":
            raise HTTPException(403, "Accès refusé")
        return user
    return dep


async def get_customer(request: Request):
    def _decode(tok):
        try:
            p = jwt.decode(tok, JWT_SECRET, algorithms=[JWT_ALG])
            return p if p.get("kind") == "customer" else None
        except Exception:
            return None
    h = request.headers.get("Authorization", "")
    payload = _decode(h[7:]) if h.startswith("Bearer ") else None
    if not payload:
        token = request.cookies.get("customer_token")
        if not token:
            raise HTTPException(401, "Non authentifié")
        payload = _decode(token)
        if not payload:
            raise HTTPException(401, "Session expirée")
    c = await db.customers.find_one({"id": payload["sub"]})
    if not c:
        raise HTTPException(401, "Compte introuvable")
    for k in ("_id", "password_hash"):
        c.pop(k, None)
    return c


def norm_phone(p: str) -> str:
    """Keep only digits — used for loose phone matching (last 8 digits)."""
    return "".join(ch for ch in (p or "") if ch.isdigit())


def gen_code() -> str:
    """Short human-friendly order code e.g. DN-250207-4713."""
    import random
    return f"DN-{datetime.now().strftime('%y%m%d')}-{random.randint(1000, 9999)}"
