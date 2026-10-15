"""
Auth router — staff login (password + PIN) and customer auth (register / login / login-by-code / logout / account_me).

Extracted from server.py (P5 Refactor Feb 2026). The auth state (JWT secret, cookies) comes from deps.py.
"""
import random
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from deps import (
    db, JWT_SECRET, JWT_ALG,
    hash_pw, verify_pw, make_token, make_customer_token,
    new_id, now_iso, gen_access_code, clean,
    get_user, get_customer, norm_phone,
)
from models import (
    LoginIn, PinIn, CustomerIn, CustomerLoginIn, CustomerLoginCodeIn,
)

router = APIRouter(prefix="/api", tags=["auth"])


class CustomerSignupIn(BaseModel):
    name: str
    phone: str
    pin: str
    email: Optional[str] = None
    referral_code: Optional[str] = None


# ---------- Staff auth ----------
@router.post("/auth/login")
async def login(body: LoginIn, response: Response):
    u = await db.users.find_one({"email": body.email.lower().strip()})
    if not u or not verify_pw(body.password, u.get("password_hash", "")):
        raise HTTPException(401, "Identifiants incorrects")
    token = make_token(u["id"], u["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24 * 7, path="/")
    for k in ("_id", "password_hash", "pin_hash"):
        u.pop(k, None)
    return {"user": u, "token": token}


@router.post("/auth/login-pin")
async def login_pin(body: PinIn, response: Response):
    async for u in db.users.find({}):
        if verify_pw(body.pin.strip(), u.get("pin_hash", "")):
            token = make_token(u["id"], u["role"])
            response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24 * 7, path="/")
            for k in ("_id", "password_hash", "pin_hash"):
                u.pop(k, None)
            return {"user": u, "token": token}
    raise HTTPException(401, "PIN invalide")


@router.get("/auth/me")
async def me(user: dict = Depends(get_user)):
    return user


@router.post("/auth/me/tour-done")
async def mark_tour_done(user: dict = Depends(get_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"tour_done": True, "tour_done_at": now_iso()}})
    return {"ok": True}


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


# ---------- Customer auth ----------
@router.post("/public/customer-register")
async def cust_register(body: CustomerIn):
    if not body.password:
        raise HTTPException(400, "Mot de passe requis")
    existing = await db.customers.find_one({"$or": [{"phone": body.phone}, {"email": body.email}]})
    if existing:
        raise HTTPException(400, "Compte existant")
    doc = body.model_dump(exclude={"password"})
    doc.update({
        "id": new_id(), "created_at": now_iso(), "wallet": 0, "loyalty_points": 0,
        "referral_code": f"DINA-{random.randint(1000, 9999)}", "tier": "Bronze",
        "access_code": gen_access_code(),
        "password_hash": hash_pw(body.password), "status": "active",
    })
    await db.customers.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return clean(doc)


@router.post("/public/customer-login")
async def cust_login(body: CustomerLoginIn):
    c = await db.customers.find_one({"$or": [{"phone": body.identifier}, {"email": body.identifier.lower().strip()}]})
    if not c or not verify_pw(body.password, c.get("password_hash", "")):
        raise HTTPException(401, "Identifiants incorrects")
    c.pop("password_hash", None)
    c.pop("_id", None)
    return clean(c)


@router.post("/public/customer-login-code")
async def cust_login_code(body: CustomerLoginCodeIn, response: Response):
    """Phone + 6-digit secret access code login — no SMS OTP, no password."""
    digits = norm_phone(body.phone)
    if not digits:
        raise HTTPException(400, "Numéro invalide")
    tail = digits[-8:]
    since = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    if await db.login_attempts.count_documents({"identifier": f"cust:{tail}", "at": {"$gt": since}}) >= 5:
        raise HTTPException(429, "Trop de tentatives · réessayez dans 15 minutes")
    c = await _find_customer_by_tail(tail)
    if not c:
        raise HTTPException(404, "Aucun compte trouvé avec ce numéro")
    if (c.get("access_code") or "").strip() != body.code.strip():
        await db.login_attempts.insert_one({"identifier": f"cust:{tail}", "at": now_iso()})
        raise HTTPException(401, "Code secret invalide")
    await db.login_attempts.delete_many({"identifier": f"cust:{tail}"})
    return _customer_session(c, response)


async def _find_customer_by_tail(tail: str):
    async for row in db.customers.find({"status": {"$ne": "blacklist"}}):
        if norm_phone(row.get("phone", ""))[-8:] == tail:
            return row
    return None


def _customer_session(c: dict, response: Response) -> dict:
    token = make_customer_token(c["id"])
    response.set_cookie("customer_token", token, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24 * 30, path="/")
    for k in ("_id", "password_hash"):
        c.pop(k, None)
    return {"customer": clean(c), "token": token}


WEAK_PINS = {"123456", "654321", "000000", "111111", "222222", "333333", "444444", "555555", "666666", "777777", "888888", "999999", "121212"}


@router.post("/public/customer-signup")
async def cust_signup(body: CustomerSignupIn, response: Response):
    """Self-service storefront signup: name + phone + 6-digit PIN (+ optional email, referral code)."""
    name = body.name.strip()
    digits = norm_phone(body.phone)
    if len(name) < 2:
        raise HTTPException(400, "Nom requis")
    if len(digits) < 8:
        raise HTTPException(400, "Numéro invalide")
    pin = body.pin.strip()
    if len(pin) != 6 or not pin.isdigit():
        raise HTTPException(400, "Code PIN à 6 chiffres requis")
    if pin in WEAK_PINS:
        raise HTTPException(400, "Code PIN trop simple")
    if await _find_customer_by_tail(digits[-8:]):
        raise HTTPException(409, "Un compte existe déjà avec ce numéro · connectez-vous")
    email = (body.email or "").lower().strip() or None
    marraine = None
    if (body.referral_code or "").strip():
        marraine = await db.customers.find_one({"referral_code": body.referral_code.strip().upper()})
        if not marraine:
            raise HTTPException(400, "Code de parrainage introuvable")
    c = {
        "id": new_id(), "name": name, "phone": body.phone.strip(), "email": email, "created_at": now_iso(),
        "wallet": 0, "loyalty_points": 0, "tier": "Bronze", "status": "active", "source": "site_web",
        "referral_code": f"DINA-{random.randint(1000, 9999)}", "access_code": pin, "addresses": [],
        "communication_prefs": {"whatsapp": True, "sms": True, "email": bool(email), "newsletter": False},
    }
    await db.customers.insert_one(c)
    if marraine:
        s = await db.loyalty_settings.find_one({"id": "main"}) or {}
        bp, bf = int(s.get("referral_bonus_parrain", 1000)), int(s.get("referral_bonus_filleul", 500))
        await db.customers.update_one({"id": marraine["id"]}, {"$inc": {"wallet": bp, "referral_count": 1}})
        await db.customers.update_one({"id": c["id"]}, {"$inc": {"wallet": bf}, "$set": {"referred_by": marraine["id"], "referred_by_code": marraine["referral_code"]}})
        await db.referrals.insert_one({"id": new_id(), "parrain_id": marraine["id"], "parrain_name": marraine.get("name"),
                                       "filleul_id": c["id"], "filleul_name": name, "code": marraine["referral_code"],
                                       "bonus_parrain": bp, "bonus_filleul": bf, "created_at": now_iso(), "source": "inscription"})
        c["wallet"] = bf
    return _customer_session(c, response)


@router.post("/public/customer-logout")
async def cust_logout(response: Response):
    response.delete_cookie("customer_token", path="/")
    return {"ok": True}


@router.get("/public/account/me")
async def account_me(c: dict = Depends(get_customer)):
    orders = await db.orders.find({"customer.id": c["id"]}).sort("created_at", -1).to_list(100)
    total_spent = sum(o.get("total", 0) for o in orders)
    referrals = await db.referrals.count_documents({"parrain_id": c["id"]})
    return {
        "customer": clean(c),
        "orders": clean(orders),
        "metrics": {"total_orders": len(orders), "total_spent": total_spent, "referrals": referrals},
    }
