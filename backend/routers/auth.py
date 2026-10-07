"""
Auth router — staff login (password + PIN) and customer auth (register / login / login-by-code / logout / account_me).

Extracted from server.py (P5 Refactor Feb 2026). The auth state (JWT secret, cookies) comes from deps.py.
"""
import random
from fastapi import APIRouter, Depends, HTTPException, Response

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
    c = None
    async for row in db.customers.find({"status": {"$ne": "blacklist"}}):
        if norm_phone(row.get("phone", ""))[-8:] == tail:
            c = row
            break
    if not c:
        raise HTTPException(404, "Aucun compte trouvé avec ce numéro")
    if (c.get("access_code") or "").strip() != body.code.strip():
        raise HTTPException(401, "Code secret invalide")
    token = make_customer_token(c["id"])
    response.set_cookie("customer_token", token, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24 * 30, path="/")
    for k in ("_id", "password_hash"):
        c.pop(k, None)
    return {"customer": clean(c), "token": token}


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
