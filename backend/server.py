from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os, logging, uuid, random, secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
import bcrypt, jwt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dina")

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Chez Dina API")
api = APIRouter(prefix="/api")

JWT_SECRET = os.environ.get("JWT_SECRET", "dina-dev-secret")
JWT_ALG = "HS256"

hash_pw = lambda p: bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def verify_pw(p, h):
    try: return bcrypt.checkpw(p.encode(), h.encode())
    except Exception: return False
def make_token(uid, role, m=60*24*7):
    return jwt.encode({"sub": uid, "role": role, "exp": datetime.now(timezone.utc)+timedelta(minutes=m)}, JWT_SECRET, algorithm=JWT_ALG)
def new_id(): return str(uuid.uuid4())
def now_iso(): return datetime.now(timezone.utc).isoformat()
def gen_access_code(): return str(secrets.randbelow(1_000_000)).zfill(6)
def make_customer_token(cid: str, m: int = 60*24*30):
    return jwt.encode({"sub": cid, "kind": "customer", "exp": datetime.now(timezone.utc)+timedelta(minutes=m)}, JWT_SECRET, algorithm=JWT_ALG)
def clean(d):
    if isinstance(d, list): return [clean(x) for x in d]
    if isinstance(d, dict): return {k: clean(v) for k, v in d.items() if k != "_id"}
    return d

async def get_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "): token = h[7:]
    if not token: raise HTTPException(401, "Non authentifié")
    try: payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception: raise HTTPException(401, "Session expirée")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user: raise HTTPException(401, "Introuvable")
    for k in ("_id","password_hash","pin_hash"): user.pop(k, None)
    return user

def require_role(*roles):
    async def dep(user: dict = Depends(get_user)):
        if user.get("role") not in roles and user.get("role") != "admin":
            raise HTTPException(403, "Accès refusé")
        return user
    return dep

# ---------- Pydantic models ----------
class LoginIn(BaseModel): email: str; password: str
class PinIn(BaseModel): pin: str
class ProductIn(BaseModel):
    name: str; category: str; brand: str = "Dina"; price: int; cost: int = 0
    description: str = ""; image: str = ""; images: List[str] = []
    sizes: List[str] = []; colors: List[str] = []; stock_by_size: Dict[str,int] = {}
    stock: int = 0; sku: Optional[str] = None; visibility: str = "both"
    # Phase B fields
    price_old: Optional[int] = None
    status: str = "actif"
    collections: Optional[str] = None
    tags: Optional[str] = None
    material: Optional[str] = None
    occasion: Optional[str] = None
    heel_type: Optional[str] = None
    care: Optional[str] = None
    supplier: Optional[str] = None
    alert_threshold: Optional[int] = 3
    location: Optional[str] = None
    featured: bool = False
    is_new: bool = False
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    promo_pct: Optional[int] = None
    season: Optional[str] = None
class OrderItem(BaseModel):
    product_id: str; name: str; size: Optional[str]=None; color: Optional[str]=None
    qty: int = 1; price: int; image: Optional[str] = None
class OrderIn(BaseModel):
    items: List[OrderItem]; customer: Optional[Dict[str, Any]] = None
    channel: str = "store"; payment_method: str = "cash"
    delivery_zone: Optional[str] = None; delivery_fee: int = 0
    discount: int = 0; note: str = ""; mode: str = "store"
    store_id: Optional[str] = None
class CustomerIn(BaseModel):
    name: str; phone: str; email: Optional[str] = None; address: Optional[str] = None
    birthday: Optional[str] = None; shoe_size: Optional[str] = None
    clothing_size: Optional[str] = None; notes: Optional[str] = None
    status: str = "active"; photo: Optional[str] = None; password: Optional[str] = None
class CustomerLoginIn(BaseModel): identifier: str; password: str
class ExpenseIn(BaseModel):
    category: str; amount: int; note: str = ""; payment_method: str = "cash"
class SupplierIn(BaseModel):
    name: str; country: str = "CI"; phone: str = ""; email: Optional[str] = None; balance: int = 0; notes: str = ""
class PurchaseOrderIn(BaseModel):
    supplier_id: str
    supplier_name: str
    total: int = 0
    status: str = "en_attente"
    items: List[Dict[str, Any]] = []
    extra_costs: List[Dict[str, Any]] = []
    expected_at: Optional[str] = None
    note: Optional[str] = None
class PromoIn(BaseModel):
    code: str; type: str = "percent"; value: int = 10
    starts_at: Optional[str] = None; ends_at: Optional[str] = None
    usage_limit: int = 0; min_order: int = 0; channel: str = "all"; active: bool = True
    flash: bool = False
class ZoneIn(BaseModel): name: str; fee: int
class ReviewIn(BaseModel):
    product_id: str; rating: int; comment: str = ""
    customer_name: str = "Cliente"; customer_phone: Optional[str] = None
class ReviewModerationIn(BaseModel): status: str
class AskIn(BaseModel):
    question: str
    page: Optional[str] = None
class StatusIn(BaseModel): status: str; reason: Optional[str] = None; next_date: Optional[str] = None
class AssignIn(BaseModel): rider_id: str; rider_name: str
class SessionIn(BaseModel): rider_id: str; rider_name: str; date: Optional[str] = None
class ReconcileIn(BaseModel):
    order_id: str
    collected: bool
    amount: Optional[float] = None
    pin: Optional[str] = None
    note: Optional[str] = None
class RiderLocationIn(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None
class POReceiveIn(BaseModel):
    received_at: Optional[str] = None
    items: List[Dict[str, Any]] = []  # [{product_id, product_name, sku, size, color, qty, unit_cost}]
    extra_costs: List[Dict[str, Any]] = []  # [{label, amount}]
    note: Optional[str] = None
class StockAlertIn(BaseModel): product_id: str; size: Optional[str] = None; phone: str
class UserIn(BaseModel):
    name: str; email: str; password: str; role: str; phone: str = ""; pin: str = ""
class PinAuthIn(BaseModel):
    pin: str
    action: str  # "discount_over_limit", "void", "refund"
    amount: Optional[float] = None
class CashMovementIn(BaseModel):
    type: str  # "in" or "out"
    amount: float
    reason: str
    note: Optional[str] = ""
class HoldIn(BaseModel):
    items: List[Dict[str, Any]]
    customer: Optional[Dict[str, Any]] = None
    note: Optional[str] = ""
    expires_in_hours: Optional[int] = 24
class WaBroadcastIn(BaseModel):
    segment: str  # all | active | inactive | vip | blacklist
    message: str
    product_id: Optional[str] = None
class LoyaltySettingsIn(BaseModel):
    points_per_fcfa: int = 500  # 1 point per 500 FCFA spent
    tiers: List[Dict[str, Any]] = []  # [{name, min_points, discount_pct, free_delivery}]
    referral_bonus_parrain: int = 1000  # wallet credit for the referrer
    referral_bonus_filleul: int = 500   # wallet credit for the referee
    enabled: bool = True
class ReferralApplyIn(BaseModel):
    code: str          # parrain's referral_code
    customer_id: str   # filleul (new customer)
class RolesPermissionsIn(BaseModel):
    matrix: Dict[str, Dict[str, bool]]  # {role: {permission_key: true/false}}
class AttendancePunchIn(BaseModel):
    code: str
    kind: str = "in"  # in | out
class CustomerLoginCodeIn(BaseModel):
    phone: str
    code: str
class StorefrontSectionsIn(BaseModel):
    sections: List[Dict[str, Any]]  # ordered list: {id, type, enabled, props}
class CmsPageIn(BaseModel):
    slug: str  # about | delivery | terms | faq | custom-xxx
    title: str
    content: str = ""
    enabled: bool = True
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
class SimpleNameIn(BaseModel):
    name: str
    note: Optional[str] = None
class CashSessionOpenIn(BaseModel):
    opening_cash: float = 0
    note: Optional[str] = None
class CashSessionCloseIn(BaseModel):
    closing_cash: float
    pin: str  # manager PIN required
    note: Optional[str] = None
class IntegrationsIn(BaseModel):
    whatsapp_auto: Optional[bool] = True
    whatsapp_meta_token: Optional[str] = None
    whatsapp_meta_phone_id: Optional[str] = None
    meta_pixel_id: Optional[str] = None
    tiktok_pixel_id: Optional[str] = None
    wifi_printer_ip: Optional[str] = None
    wifi_printer_port: Optional[int] = 9100
class ProofIn(BaseModel):
    method: str  # code | photo | thirdparty
    code: Optional[str] = None
    photo: Optional[str] = None  # base64 data URL
    signature: Optional[str] = None  # base64 data URL
    thirdparty_name: Optional[str] = None
    thirdparty_relation: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    amount_collected: Optional[float] = None
    payment_method: Optional[str] = None
    manager_pin: Optional[str] = None  # for high-value fallback
class ContactLogIn(BaseModel):
    kind: str  # call | whatsapp
    template_key: Optional[str] = None
class DeliveryTemplatesIn(BaseModel):
    wa_templates: List[Dict[str, str]] = []  # [{key, label, text}]
    proof_method: str = "code"  # code | photo | hybrid
    proof_threshold: int = 50000
    distance_warning_m: int = 300
    code_sms_text: str = "Votre code de livraison Chez Dina : {code}. Donnez-le au livreur uniquement à la réception de votre colis."
    score_weights: Dict[str, int] = {"delivery_rate": 35, "punctuality": 20, "rating": 25, "cash": 10, "proof": 10}
class RiderPhotoIn(BaseModel):
    photo: str  # base64 data URL
class ReviewModerateIn(BaseModel):
    hidden: bool
    reason: Optional[str] = None

# ---------- Auth ----------
@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    u = await db.users.find_one({"email": body.email.lower().strip()})
    if not u or not verify_pw(body.password, u.get("password_hash","")):
        raise HTTPException(401, "Identifiants incorrects")
    token = make_token(u["id"], u["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=60*60*24*7, path="/")
    for k in ("_id","password_hash","pin_hash"): u.pop(k, None)
    return {"user": u, "token": token}

@api.post("/auth/login-pin")
async def login_pin(body: PinIn, response: Response):
    async for u in db.users.find({}):
        if verify_pw(body.pin.strip(), u.get("pin_hash","")):
            token = make_token(u["id"], u["role"])
            response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=60*60*24*7, path="/")
            for k in ("_id","password_hash","pin_hash"): u.pop(k, None)
            return {"user": u, "token": token}
    raise HTTPException(401, "PIN invalide")

@api.get("/auth/me")
async def me(user: dict = Depends(get_user)): return user

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

# ---------- Customer auth (phone/email + password) ----------
async def get_customer(request: Request):
    token = request.cookies.get("customer_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "): token = h[7:]
    if not token: raise HTTPException(401, "Non authentifié")
    try: payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception: raise HTTPException(401, "Session expirée")
    if payload.get("kind") != "customer": raise HTTPException(401, "Token invalide")
    c = await db.customers.find_one({"id": payload["sub"]})
    if not c: raise HTTPException(401, "Compte introuvable")
    for k in ("_id","password_hash"): c.pop(k, None)
    return c

@api.post("/public/customer-register")
async def cust_register(body: CustomerIn):
    if not body.password: raise HTTPException(400, "Mot de passe requis")
    existing = await db.customers.find_one({"$or":[{"phone": body.phone},{"email": body.email}]})
    if existing: raise HTTPException(400, "Compte existant")
    doc = body.model_dump(exclude={"password"})
    doc.update({"id": new_id(), "created_at": now_iso(), "wallet": 0, "loyalty_points": 0,
                "referral_code": f"DINA-{random.randint(1000,9999)}", "tier": "Bronze",
                "access_code": gen_access_code(),
                "password_hash": hash_pw(body.password), "status": "active"})
    await db.customers.insert_one(doc)
    doc.pop("password_hash", None); doc.pop("_id", None)
    return clean(doc)

@api.post("/public/customer-login")
async def cust_login(body: CustomerLoginIn):
    c = await db.customers.find_one({"$or":[{"phone": body.identifier},{"email": body.identifier.lower().strip()}]})
    if not c or not verify_pw(body.password, c.get("password_hash","")):
        raise HTTPException(401, "Identifiants incorrects")
    c.pop("password_hash", None); c.pop("_id", None)
    return clean(c)

def _norm_phone(p: str) -> str:
    return "".join(ch for ch in (p or "") if ch.isdigit())

@api.post("/public/customer-login-code")
async def cust_login_code(body: CustomerLoginCodeIn, response: Response):
    """Phone + 6-digit secret access code login — no SMS OTP, no password."""
    digits = _norm_phone(body.phone)
    if not digits: raise HTTPException(400, "Numéro invalide")
    # Match on phone (loose: last 8 digits)
    tail = digits[-8:]
    c = None
    async for row in db.customers.find({"status": {"$ne": "blacklist"}}):
        if _norm_phone(row.get("phone",""))[-8:] == tail:
            c = row; break
    if not c:
        raise HTTPException(404, "Aucun compte trouvé avec ce numéro")
    if (c.get("access_code") or "").strip() != body.code.strip():
        raise HTTPException(401, "Code secret invalide")
    token = make_customer_token(c["id"])
    response.set_cookie("customer_token", token, httponly=True, secure=True, samesite="none", max_age=60*60*24*30, path="/")
    for k in ("_id","password_hash"): c.pop(k, None)
    return {"customer": clean(c), "token": token}

@api.post("/public/customer-logout")
async def cust_logout(response: Response):
    response.delete_cookie("customer_token", path="/")
    return {"ok": True}

@api.get("/public/account/me")
async def account_me(c: dict = Depends(get_customer)):
    orders = await db.orders.find({"customer.id": c["id"]}).sort("created_at", -1).to_list(100)
    total_spent = sum(o.get("total", 0) for o in orders)
    referrals = await db.referrals.count_documents({"parrain_id": c["id"]})
    return {
        "customer": clean(c),
        "orders": clean(orders),
        "metrics": {"total_orders": len(orders), "total_spent": total_spent, "referrals": referrals},
    }

# ---------- Stores / Users ----------
@api.get("/stores")
async def stores(user: dict = Depends(get_user)):
    return clean(await db.stores.find({}).to_list(100))

@api.get("/users")
async def list_users(user: dict = Depends(get_user)):
    rows = await db.users.find({}, {"password_hash":0,"pin_hash":0}).to_list(200)
    return clean(rows)

@api.post("/users")
async def create_user(body: UserIn, user: dict = Depends(require_role("admin"))):
    if await db.users.find_one({"email": body.email.lower()}): raise HTTPException(400, "Email déjà pris")
    doc = {"id": new_id(), "name": body.name, "email": body.email.lower(), "role": body.role,
           "phone": body.phone, "password_hash": hash_pw(body.password),
           "pin_hash": hash_pw(body.pin or "0000"), "attendance_code": body.pin or "0000",
           "store_id": "store-cocody", "active": True, "created_at": now_iso()}
    await db.users.insert_one(doc)
    doc.pop("password_hash", None); doc.pop("pin_hash", None)
    return clean(doc)

@api.patch("/users/{uid}")
async def update_user(uid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    body.pop("id", None); body.pop("_id", None)
    if "password" in body: body["password_hash"] = hash_pw(body.pop("password"))
    if "pin" in body: body["pin_hash"] = hash_pw(body.pop("pin"))
    await db.users.update_one({"id": uid}, {"$set": body})
    return {"ok": True}

@api.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_role("admin"))):
    await db.users.delete_one({"id": uid})
    return {"ok": True}

# ---------- Products ----------
@api.get("/products")
async def products(user: dict = Depends(get_user), q: Optional[str] = None):
    f = {}
    if q: f["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"sku": {"$regex": q, "$options": "i"}}]
    return clean(await db.products.find(f).to_list(500))

@api.post("/products")
async def create_product(body: ProductIn, user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso(),
                "sku": body.sku or f"DN-{random.randint(10000,99999)}",
                "store_id": "store-cocody", "rating_avg": 0, "rating_count": 0})
    if body.stock_by_size and not body.stock:
        doc["stock"] = sum(body.stock_by_size.values())
    await db.products.insert_one(doc)
    return clean(doc)

@api.patch("/products/{pid}")
async def update_product(pid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    body.pop("id", None); body.pop("_id", None)
    if "stock_by_size" in body and body["stock_by_size"]:
        body["stock"] = sum(body["stock_by_size"].values())
    await db.products.update_one({"id": pid}, {"$set": body})
    return {"ok": True}

@api.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.products.delete_one({"id": pid})
    return {"ok": True}

# ---------- Customers ----------
async def customer_metrics(cid: str):
    rows = await db.orders.find({"customer.id": cid}).to_list(500)
    return {"total_orders": len(rows), "total_spent": sum(r.get("total",0) for r in rows),
            "last_order_at": max([r["created_at"] for r in rows], default=None)}

@api.get("/customers")
async def customers(user: dict = Depends(get_user), q: Optional[str] = None, status: Optional[str] = None):
    f = {}
    if q: f["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": q, "$options": "i"}}]
    if status and status != "all": f["status"] = status
    rows = await db.customers.find(f, {"password_hash":0}).sort("created_at", -1).to_list(1000)
    # Add inactive flag server-side
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    for r in rows:
        last = r.get("last_order_at")
        if r.get("status") == "active" and (not last or last < cutoff):
            r["derived_status"] = "inactive"
        else:
            r["derived_status"] = r.get("status", "active")
    return clean(rows)

@api.post("/customers")
async def create_customer(body: CustomerIn, user: dict = Depends(get_user)):
    doc = body.model_dump(exclude={"password"})
    doc.update({"id": new_id(), "created_at": now_iso(), "wallet": 0, "loyalty_points": 0,
                "referral_code": f"DINA-{random.randint(1000,9999)}", "tier": "Bronze",
                "access_code": gen_access_code(),
                "status": body.status or "active"})
    if body.password: doc["password_hash"] = hash_pw(body.password)
    await db.customers.insert_one(doc)
    doc.pop("password_hash", None); doc.pop("_id", None)
    return clean(doc)

@api.patch("/customers/{cid}")
async def update_customer(cid: str, body: Dict[str, Any], user: dict = Depends(get_user)):
    body.pop("id", None); body.pop("_id", None)
    if "password" in body: body["password_hash"] = hash_pw(body.pop("password"))
    await db.customers.update_one({"id": cid}, {"$set": body})
    return {"ok": True}

@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.customers.delete_one({"id": cid})
    return {"ok": True}

@api.get("/customers/{cid}")
async def get_customer_detail(cid: str, user: dict = Depends(get_user)):
    c = await db.customers.find_one({"id": cid}, {"password_hash":0})
    if not c: raise HTTPException(404)
    orders = await db.orders.find({"customer.id": cid}).sort("created_at", -1).to_list(100)
    tops: Dict[str, Dict[str,Any]] = {}
    for o in orders:
        for it in o.get("items", []):
            k = it["product_id"]
            if k not in tops: tops[k] = {"name": it["name"], "qty": 0, "spent": 0, "image": it.get("image")}
            tops[k]["qty"] += it["qty"]; tops[k]["spent"] += it["qty"]*it["price"]
    top_products = sorted(tops.values(), key=lambda x: x["qty"], reverse=True)[:5]
    metrics = {"total_orders": len(orders), "total_spent": sum(o.get("total",0) for o in orders),
               "last_order_at": orders[0]["created_at"] if orders else None, "top_products": top_products}
    return {"customer": clean(c), "orders": clean(orders), "metrics": metrics}

@api.post("/customers/bulk")
async def bulk_customers(body: List[CustomerIn], user: dict = Depends(require_role("admin","manager"))):
    docs = []
    for b in body:
        docs.append({**b.model_dump(exclude={"password"}), "id": new_id(), "created_at": now_iso(),
                     "wallet": 0, "loyalty_points": 0, "tier": "Bronze", "status": "active",
                     "access_code": gen_access_code(),
                     "referral_code": f"DINA-{random.randint(1000,9999)}"})
    if docs: await db.customers.insert_many(docs)
    return {"inserted": len(docs)}

# ---------- Orders ----------
def gen_code():
    return f"DN-{datetime.now().strftime('%y%m%d')}-{random.randint(1000,9999)}"

@api.get("/orders")
async def orders(user: dict = Depends(get_user), status: Optional[str] = None, channel: Optional[str] = None, q: Optional[str] = None):
    f = {}
    if status: f["status"] = status
    if channel: f["channel"] = channel
    if q: f["$or"] = [{"code": {"$regex": q, "$options": "i"}}, {"customer.name": {"$regex": q, "$options": "i"}}, {"customer.phone": {"$regex": q, "$options": "i"}}]
    return clean(await db.orders.find(f).sort("created_at", -1).to_list(1000))

@api.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(get_user)):
    sub = sum(it.qty * it.price for it in body.items)
    total = sub + body.delivery_fee - body.discount
    doc = {"id": new_id(), "code": gen_code(), "items": [it.model_dump() for it in body.items],
           "customer": body.customer, "channel": body.channel, "payment_method": body.payment_method,
           "delivery_zone": body.delivery_zone, "delivery_fee": body.delivery_fee,
           "discount": body.discount, "note": body.note, "mode": body.mode,
           "store_id": body.store_id or "store-cocody",
           "subtotal": sub, "total": total,
           "status": "livree" if body.mode == "store" else "nouvelle",
           "payment_status": "paye" if body.payment_method in ("cash","wave") and body.mode == "store" else "en_attente",
           "created_at": now_iso(), "created_by": user.get("name"),
           "timeline": [{"status": "nouvelle" if body.mode != "store" else "livree", "at": now_iso(), "by": user.get("name","système")}]}
    for it in body.items:
        await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.qty}})
        if it.size:
            await db.products.update_one({"id": it.product_id}, {"$inc": {f"stock_by_size.{it.size}": -it.qty}})
        # Auto-flip to liste_attente when all stock exhausted
        fresh = await db.products.find_one({"id": it.product_id})
        if fresh:
            total_stk = sum((fresh.get("stock_by_size") or {}).values()) if fresh.get("stock_by_size") else fresh.get("stock", 0)
            if total_stk <= 0 and fresh.get("status") not in ("liste_attente", "archive", "inactif"):
                await db.products.update_one({"id": it.product_id}, {"$set": {"status": "liste_attente", "auto_waitlist_at": now_iso()}})
    if body.customer and body.customer.get("id"):
        await db.customers.update_one({"id": body.customer["id"]}, {"$set": {"last_order_at": now_iso()}, "$inc": {"loyalty_points": int(total/500)}})
    await db.orders.insert_one(doc)
    return clean(doc)

@api.patch("/orders/{oid}")
async def update_order(oid: str, body: Dict[str, Any], user: dict = Depends(get_user)):
    o = await db.orders.find_one({"id": oid})
    if not o: raise HTTPException(404)
    if o.get("status") == "livree": raise HTTPException(400, "Commande livrée, non modifiable")
    body.pop("id", None); body.pop("_id", None)
    # Recompute total if items/fees changed
    if "items" in body or "delivery_fee" in body or "discount" in body:
        items = body.get("items", o.get("items", []))
        sub = sum(it["qty"]*it["price"] for it in items)
        body["subtotal"] = sub
        body["total"] = sub + body.get("delivery_fee", o.get("delivery_fee", 0)) - body.get("discount", o.get("discount", 0))
    await db.orders.update_one({"id": oid}, {"$set": body})
    return {"ok": True}

WA_MANAGER_FALLBACK = "2250777926179"

def _wa_message_for_status(order: dict, status: str) -> Optional[str]:
    """French WhatsApp template per order status. Return None to skip enqueue."""
    name = (order.get("customer") or {}).get("name", "Cliente")
    first = name.split(" ")[0] if name else "Cliente"
    code = order.get("code", "")
    total = int(order.get("total", 0))
    zone = order.get("delivery_zone") or ""
    rider = order.get("rider_name") or ""
    is_cod = order.get("payment_method") == "cod"
    base = f"Bonjour {first} 👋 Chez Dina."
    if status == "confirmee":
        return f"{base}\nVotre commande {code} ({total} FCFA) est confirmée. Nous préparons tout avec soin. Merci 💕"
    if status == "prete":
        return f"{base}\nVotre commande {code} est prête ! Elle part en livraison très bientôt vers {zone}. 📦"
    if status == "assignee":
        extra = f" avec notre livreur {rider}" if rider else ""
        return f"{base}\nVotre commande {code} est en route{extra}. Il vous appellera à l'approche. {'Préparez ' + str(total) + ' FCFA en espèces.' if is_cod else 'Déjà payée, aucun paiement à prévoir.'} 🛵"
    if status == "en_livraison":
        return f"{base}\nVotre colis {code} est en livraison. {'À encaisser : ' + str(total) + ' FCFA.' if is_cod else ''} 📍"
    if status == "livree":
        return f"{base}\nMerci pour votre commande {code} ! 💐\nNous serions ravies d'avoir votre avis en 10s : https://chezdina.ci/noter/{code}"
    if status == "echouee":
        return f"{base}\nNous avons rencontré un souci avec votre colis {code}. Nous vous recontactons rapidement pour reprogrammer. Pardon pour la gêne 🙏"
    if status == "annulee":
        return f"{base}\nVotre commande {code} a été annulée. N'hésitez pas à nous recontacter si vous changez d'avis 💕"
    return None

async def _enqueue_wa(order: dict, status: str, by_name: Optional[str] = None):
    """Enqueue a WhatsApp message in whatsapp_outbox based on order status."""
    settings = await db.site_settings.find_one({"id": "main"}) or {}
    if settings.get("whatsapp_auto") is False:
        return
    msg = _wa_message_for_status(order, status)
    if not msg: return
    phone = (order.get("customer") or {}).get("phone") or ""
    phone_digits = "".join(c for c in phone if c.isdigit())
    if not phone_digits: return
    link = f"https://wa.me/{phone_digits}?text={_url_quote(msg)}"
    doc = {
        "id": new_id(),
        "order_id": order.get("id"), "order_code": order.get("code"),
        "customer_name": (order.get("customer") or {}).get("name"),
        "phone": phone, "phone_digits": phone_digits,
        "status_trigger": status, "message": msg, "link": link,
        "created_at": now_iso(), "created_by": by_name,
        "sent": False, "sent_at": None, "sent_by": None,
        "kind": "status",
    }
    await db.whatsapp_outbox.insert_one(doc)

def _url_quote(s: str) -> str:
    try:
        from urllib.parse import quote
        return quote(s, safe="")
    except Exception:
        return s

@api.patch("/orders/{oid}/status")
async def update_order_status(oid: str, body: StatusIn, user: dict = Depends(get_user)):
    o = await db.orders.find_one({"id": oid})
    if not o: raise HTTPException(404)
    prev = o.get("status")
    tl = o.get("timeline", []); tl.append({"status": body.status, "at": now_iso(), "by": user.get("name"), "reason": body.reason, "next_date": body.next_date})
    upd = {"status": body.status, "timeline": tl}
    if body.reason: upd["last_reason"] = body.reason
    if body.next_date: upd["rescheduled_for"] = body.next_date
    # When status becomes "en_livraison" (En route), generate delivery_code and enqueue WA
    if body.status == "en_livraison" and prev != "en_livraison" and not o.get("delivery_code"):
        phone = (o.get("customer") or {}).get("phone") or ""
        pd = "".join(c for c in phone if c.isdigit())
        if pd:
            code = str(secrets.randbelow(10000)).zfill(4)
            upd["delivery_code"] = code
            upd["delivery_code_attempts"] = 0
            settings = await db.site_settings.find_one({"id":"main"}) or {}
            tpl = (settings.get("delivery_templates") or {}).get("code_sms_text") or "Votre code de livraison Chez Dina : {code}."
            text = tpl.replace("{code}", code)
            await db.whatsapp_outbox.insert_one({
                "id": new_id(), "order_id": oid, "order_code": o.get("code"),
                "customer_name": (o.get("customer") or {}).get("name"),
                "phone": phone, "phone_digits": pd,
                "message": text, "link": f"https://wa.me/{pd}?text={_url_quote(text)}",
                "kind": "delivery_code", "status_trigger": "en_livraison",
                "sent": False, "created_at": now_iso(), "created_by": user.get("name"),
            })
    await db.orders.update_one({"id": oid}, {"$set": upd})
    if prev != body.status:
        fresh = await db.orders.find_one({"id": oid})
        await _enqueue_wa(fresh, body.status, user.get("name"))
    return {"ok": True}

# ---------- Rider upgrades ----------
@api.post("/orders/{oid}/deliver")
async def deliver_order(oid: str, body: ProofIn, user: dict = Depends(get_user)):
    o = await db.orders.find_one({"id": oid})
    if not o: raise HTTPException(404)
    if o.get("status") == "livree":
        raise HTTPException(400, "Déjà livrée")
    settings = await db.site_settings.find_one({"id":"main"}) or {}
    tpl = settings.get("delivery_templates") or {}
    threshold = int(tpl.get("proof_threshold", 50000))
    total = int(o.get("total", 0))
    locked = o.get("delivery_locked")
    if locked: raise HTTPException(423, "Commande verrouillée (3 codes erronés). Approbation gérante requise.")
    proof = {"method": body.method, "at": now_iso(), "by": user.get("name"),
             "lat": body.lat, "lng": body.lng,
             "amount_collected": body.amount_collected, "payment_method": body.payment_method or o.get("payment_method")}
    if body.method == "code":
        if not body.code: raise HTTPException(400, "Code requis")
        if (o.get("delivery_code") or "") != body.code.strip():
            attempts = o.get("delivery_code_attempts", 0) + 1
            upd = {"delivery_code_attempts": attempts}
            if attempts >= 3:
                upd["delivery_locked"] = True
                await db.notifications.insert_one({"id": new_id(), "kind":"alert", "title": f"Commande {o.get('code')} verrouillée - 3 codes erronés", "created_at": now_iso(), "read": False})
            await db.orders.update_one({"id": oid}, {"$set": upd})
            raise HTTPException(401, f"Code invalide ({attempts}/3)")
        proof["code_verified"] = True
    elif body.method in ("photo", "thirdparty"):
        # High-value rule: above threshold without code requires manager PIN
        if total >= threshold:
            if not body.manager_pin: raise HTTPException(403, f"Montant ≥ {threshold} FCFA : PIN gérante requis pour livrer sans code")
            approver = await db.users.find_one({"attendance_code": body.manager_pin.strip(), "role": {"$in":["admin","manager"]}, "active": True})
            if not approver: raise HTTPException(403, "PIN gérante invalide")
            proof["approved_by"] = approver.get("name")
        if not body.photo: raise HTTPException(400, "Photo requise")
        if not body.signature: raise HTTPException(400, "Signature requise")
        proof["photo"] = body.photo
        proof["signature"] = body.signature
        if body.method == "thirdparty":
            if not body.thirdparty_name: raise HTTPException(400, "Nom du tiers requis")
            proof["thirdparty_name"] = body.thirdparty_name
            proof["thirdparty_relation"] = body.thirdparty_relation
        proof["needs_review"] = True
    else:
        raise HTTPException(400, "Méthode inconnue")
    tl = o.get("timeline", []); tl.append({"status":"livree","at":now_iso(),"by":user.get("name"),"proof_method":body.method})
    await db.orders.update_one({"id": oid}, {"$set": {"status":"livree","timeline":tl,"proof": proof}})
    await _enqueue_wa({**o, "status":"livree"}, "livree", user.get("name"))
    return {"ok": True, "proof": proof}

@api.post("/orders/{oid}/contact-log")
async def contact_log(oid: str, body: ContactLogIn, user: dict = Depends(get_user)):
    doc = {"kind": body.kind, "template_key": body.template_key, "at": now_iso(), "by": user.get("name"), "by_id": user.get("id")}
    await db.orders.update_one({"id": oid}, {"$push": {"contact_log": doc}})
    return {"ok": True}

@api.get("/delivery-templates")
async def get_delivery_templates(user: dict = Depends(get_user)):
    s = await db.site_settings.find_one({"id":"main"}) or {}
    t = s.get("delivery_templates") or {}
    return {
        "wa_templates": t.get("wa_templates") or [
            {"key":"en_route","label":"En route","text":"Bonjour {prenom_client}, je suis {prenom_livreur}, livreur Chez Dina. Je suis en route avec votre commande {numero_commande}. J'arrive dans environ 15 minutes."},
            {"key":"arrived","label":"Je suis arrivé","text":"Je suis arrivé. Pouvez-vous m'indiquer où vous trouver ?"},
            {"key":"location","label":"Envoyer position","text":"Merci de m'envoyer votre position WhatsApp pour que je vous trouve plus facilement."},
            {"key":"unreachable","label":"Rappel","text":"Je n'arrive pas à vous joindre. Merci de me rappeler pour la livraison de votre commande Chez Dina."},
        ],
        "proof_method": t.get("proof_method","code"),
        "proof_threshold": t.get("proof_threshold", 50000),
        "distance_warning_m": t.get("distance_warning_m", 300),
        "code_sms_text": t.get("code_sms_text","Votre code de livraison Chez Dina : {code}. Donnez-le au livreur uniquement à la réception de votre colis."),
        "score_weights": t.get("score_weights", {"delivery_rate":35,"punctuality":20,"rating":25,"cash":10,"proof":10}),
    }

@api.patch("/delivery-templates")
async def set_delivery_templates(body: DeliveryTemplatesIn, user: dict = Depends(require_role("admin","manager"))):
    data = body.model_dump()
    await db.site_settings.update_one({"id":"main"}, {"$set":{"id":"main","delivery_templates":data,"updated_at":now_iso()}}, upsert=True)
    return {"ok": True}

@api.patch("/users/me/photo")
async def upload_my_photo(body: RiderPhotoIn, user: dict = Depends(get_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"photo": body.photo, "updated_at": now_iso()}})
    return {"ok": True, "photo": body.photo}

@api.patch("/users/me/prefs")
async def set_my_prefs(body: Dict[str, Any], user: dict = Depends(get_user)):
    ALLOWED = {"theme", "wa", "sound", "language", "notifications"}
    prefs = {k: v for k, v in body.items() if k in ALLOWED}
    await db.users.update_one({"id": user["id"]}, {"$set": {"prefs": prefs, "updated_at": now_iso()}})
    return {"ok": True, "prefs": prefs}

@api.get("/riders/{rid}/score")
async def rider_score(rid: str, user: dict = Depends(get_user)):
    settings = await db.site_settings.find_one({"id":"main"}) or {}
    weights = (settings.get("delivery_templates") or {}).get("score_weights") or {"delivery_rate":35,"punctuality":20,"rating":25,"cash":10,"proof":10}
    orders = await db.orders.find({"rider_id": rid}).to_list(2000)
    total = len(orders)
    delivered = [o for o in orders if o.get("status") == "livree"]
    failed = [o for o in orders if o.get("status") in ("echouee","annulee")]
    delivery_rate = (len(delivered) / total * 100) if total else 100
    # Punctuality: % delivered where delivered_at is within créneau (we don't track créneau precisely, approximate 90%)
    punctuality = 90
    # Rating
    reviews = await db.reviews.find({"rider_id": rid, "hidden": {"$ne": True}}).to_list(500)
    ratings = [r.get("rating",0) for r in reviews if r.get("rating")]
    avg = (sum(ratings)/len(ratings)) if ratings else 5
    rating_score = avg / 5 * 100
    # Cash accuracy: % of delivered COD orders without ecart
    cod_delivered = [o for o in delivered if o.get("payment_method") == "cod"]
    sessions = await db.delivery_sessions.find({"rider_id": rid}).to_list(500)
    recs = [v for s in sessions for v in (s.get("reconciliations") or {}).values() if isinstance(v, dict)]
    with_gap = [r for r in recs if abs(r.get("ecart", 0)) > 100]
    cash_score = max(0, 100 - (len(with_gap) * 10))
    # Proof completeness: % of delivered using code (not fallback)
    code_proofs = [o for o in delivered if (o.get("proof") or {}).get("method") == "code"]
    proof_score = (len(code_proofs) / len(delivered) * 100) if delivered else 100
    components = {
        "delivery_rate": round(delivery_rate),
        "punctuality": round(punctuality),
        "rating": round(rating_score),
        "cash": round(cash_score),
        "proof": round(proof_score),
    }
    score = round(sum(components[k] * weights.get(k, 0) / 100 for k in components))
    level = "Excellence" if score >= 90 else "Or" if score >= 75 else "Argent" if score >= 60 else "Bronze"
    return {
        "score": score, "level": level, "weights": weights, "components": components,
        "stats": {"total": total, "delivered": len(delivered), "failed": len(failed),
                  "rating_avg": round(avg,1), "reviews": len(reviews), "cash_gaps": len(with_gap)},
    }

@api.get("/riders/{rid}/reviews")
async def rider_reviews(rid: str, user: dict = Depends(get_user)):
    is_rider_self = user.get("role") == "rider" and user.get("id") == rid
    f = {"rider_id": rid}
    if is_rider_self: f["hidden"] = {"$ne": True}
    rows = await db.reviews.find(f).sort("created_at", -1).to_list(300)
    for r in rows:
        # Mask customer phone, show first name + quartier only
        cust = r.get("customer") or {}
        r["customer"] = {"name": (cust.get("name") or "").split(" ")[0], "quartier": cust.get("quartier") or cust.get("zone")}
    return clean(rows)

@api.patch("/reviews/{rid}/moderate")
async def moderate_review_hide(rid: str, body: ReviewModerateIn, user: dict = Depends(require_role("admin","manager"))):
    await db.reviews.update_one({"id": rid}, {"$set": {"hidden": body.hidden, "moderation_reason": body.reason, "moderated_by": user.get("name"), "moderated_at": now_iso()}})
    return {"ok": True}

@api.get("/riders/me/today")
async def rider_today(user: dict = Depends(get_user)):
    """Rider dashboard summary for today."""
    from datetime import datetime, timezone
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    orders = await db.orders.find({
        "rider_id": user["id"],
        "$or": [{"assigned_at": {"$gte": start}}, {"created_at": {"$gte": start}}],
    }).to_list(500)
    to_collect = sum(o.get("total",0) for o in orders if o.get("payment_method")=="cod" and o.get("status") not in ("livree","annulee"))
    collected = 0
    for o in orders:
        p = o.get("proof") or {}
        if o.get("status") == "livree" and o.get("payment_method") == "cod":
            collected += p.get("amount_collected") or o.get("total", 0)
    counts = {"a_livrer": 0, "en_route": 0, "livrees": 0, "annulees": 0, "reportees": 0, "echecs": 0}
    for o in orders:
        s = o.get("status")
        if s in ("confirmee","prete","assignee"): counts["a_livrer"] += 1
        elif s == "en_livraison": counts["en_route"] += 1
        elif s == "livree": counts["livrees"] += 1
        elif s == "annulee": counts["annulees"] += 1
        elif s == "reportee": counts["reportees"] += 1
        elif s == "echouee": counts["echecs"] += 1
    return {"orders": clean(orders), "counts": counts, "to_collect": to_collect, "collected": collected, "balance_to_hand_over": collected}

@api.get("/riders/me/history")
async def rider_history(user: dict = Depends(get_user), days: int = 30):
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    sessions = await db.delivery_sessions.find({"rider_id": user["id"], "date": {"$gte": cutoff[:10]}}).sort("date", -1).to_list(100)
    # Mask customer phone in history
    for s in sessions:
        for o in (s.get("orders_detail") or []):
            cust = o.get("customer") or {}
            ph = cust.get("phone","")
            digits = "".join(c for c in ph if c.isdigit())
            if len(digits) >= 4:
                cust["phone_masked"] = f"{digits[:2]} •• •• •• {digits[-2:]}"
                cust["phone"] = None
    return clean(sessions)

@api.get("/orders/track/{code}")
async def track(code: str):
    o = await db.orders.find_one({"code": code})
    if not o: raise HTTPException(404)
    return clean(o)

# ---------- Deliveries ----------
@api.get("/deliveries")
async def deliveries(user: dict = Depends(get_user)):
    f = {"mode": "delivery"}
    if user.get("role") == "rider": f["rider_id"] = user["id"]
    return clean(await db.orders.find(f).sort("created_at", -1).to_list(500))

@api.patch("/deliveries/{oid}/assign")
async def assign_delivery(oid: str, body: AssignIn, user: dict = Depends(require_role("admin","manager"))):
    o = await db.orders.find_one({"id": oid})
    if not o: raise HTTPException(404)
    tl = o.get("timeline", []); tl.append({"status":"assignee","at":now_iso(),"by":user.get("name"),"note":f"→ {body.rider_name}"})
    await db.orders.update_one({"id": oid}, {"$set": {"rider_id": body.rider_id, "rider_name": body.rider_name, "status":"assignee", "timeline": tl}})
    return {"ok": True}

# ---------- Delivery sessions (daily rider sessions) ----------
@api.post("/delivery-sessions")
async def create_session(body: SessionIn, user: dict = Depends(require_role("admin","manager"))):
    d = body.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.delivery_sessions.find_one({"rider_id": body.rider_id, "date": d, "closed": {"$ne": True}})
    if existing: return clean(existing)
    doc = {"id": new_id(), "rider_id": body.rider_id, "rider_name": body.rider_name, "date": d,
           "orders": [], "closed": False, "reconciliations": {}, "created_at": now_iso()}
    await db.delivery_sessions.insert_one(doc)
    return clean(doc)

@api.get("/delivery-sessions")
async def list_sessions(user: dict = Depends(get_user), rider_id: Optional[str] = None, date: Optional[str] = None):
    f = {}
    if rider_id: f["rider_id"] = rider_id
    if date: f["date"] = date
    rows = await db.delivery_sessions.find(f).sort("created_at", -1).to_list(100)
    out = []
    for s in rows:
        oids = s.get("orders", [])
        orders = await db.orders.find({"id": {"$in": oids}}).to_list(200)
        s["orders_detail"] = orders
        s["total_to_collect"] = sum(o.get("total",0) for o in orders if o.get("payment_method") == "cod")
        s["prepaid_count"] = sum(1 for o in orders if o.get("payment_method") != "cod")
        s["delivered_count"] = sum(1 for o in orders if o.get("status") == "livree")
        s["cancelled_count"] = sum(1 for o in orders if o.get("status") in ("annulee","echouee"))
        s["collected_total"] = sum(o.get("total",0) for o in orders if o.get("payment_method")=="cod" and s.get("reconciliations",{}).get(o["id"]))
        out.append(s)
    return clean(out)

@api.patch("/delivery-sessions/{sid}/add-order")
async def session_add_order(sid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager"))):
    oid = body.get("order_id")
    s = await db.delivery_sessions.find_one({"id": sid})
    if not s: raise HTTPException(404)
    orders = s.get("orders", [])
    if oid not in orders: orders.append(oid)
    await db.delivery_sessions.update_one({"id": sid}, {"$set": {"orders": orders}})
    # Also assign on the order
    await db.orders.update_one({"id": oid}, {"$set": {"rider_id": s["rider_id"], "rider_name": s["rider_name"], "status": "assignee", "session_id": sid}})
    return {"ok": True}

@api.patch("/delivery-sessions/{sid}/reconcile")
async def reconcile(sid: str, body: ReconcileIn, user: dict = Depends(require_role("admin","manager"))):
    s = await db.delivery_sessions.find_one({"id": sid})
    if not s: raise HTTPException(404)
    # Line-by-line cash reconciliation. If marking collected (True), require manager PIN
    # and store actual amount + approver.
    rec = s.get("reconciliations", {})
    if body.collected:
        if not body.pin:
            raise HTTPException(400, "PIN gérante requis pour valider l'encaissement")
        approver = await db.users.find_one({"attendance_code": body.pin.strip(), "role": {"$in": ["admin","manager"]}, "active": True})
        if not approver:
            raise HTTPException(403, "PIN invalide ou droits insuffisants")
        # Compare to order total to compute écart
        o = await db.orders.find_one({"id": body.order_id})
        due = (o or {}).get("total", 0) if (o or {}).get("payment_method") == "cod" else 0
        amount = float(body.amount) if body.amount is not None else float(due)
        rec[body.order_id] = {
            "collected": True,
            "amount": amount,
            "due": due,
            "ecart": amount - due,
            "approved_by": approver.get("name"),
            "approved_by_id": approver.get("id"),
            "note": body.note or "",
            "at": now_iso(),
        }
    else:
        rec[body.order_id] = {"collected": False, "at": now_iso()}
    await db.delivery_sessions.update_one({"id": sid}, {"$set": {"reconciliations": rec}})
    return {"ok": True, "reconciliation": rec[body.order_id]}

# ---------- Rider live GPS ----------
@api.post("/riders/location")
async def push_rider_location(body: RiderLocationIn, user: dict = Depends(get_user)):
    doc = {
        "rider_id": user.get("id"),
        "rider_name": user.get("name"),
        "lat": body.lat, "lng": body.lng, "accuracy": body.accuracy or 0,
        "updated_at": now_iso(),
    }
    await db.rider_locations.update_one(
        {"rider_id": user.get("id")},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True}

@api.get("/riders/locations")
async def list_rider_locations(user: dict = Depends(get_user)):
    rows = await db.rider_locations.find({}).to_list(100)
    # Filter stale (>30min)
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    rows = [r for r in rows if r.get("updated_at", "") >= cutoff]
    return clean(rows)

@api.patch("/delivery-sessions/{sid}/close")
async def close_session(sid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.delivery_sessions.update_one({"id": sid}, {"$set": {"closed": True, "closed_at": now_iso()}})
    return {"ok": True}

@api.get("/riders/{rid}/kpis")
async def rider_kpis(rid: str, user: dict = Depends(get_user)):
    orders = await db.orders.find({"rider_id": rid}).to_list(2000)
    total = len(orders); delivered = sum(1 for o in orders if o.get("status")=="livree"); failed = sum(1 for o in orders if o.get("status") in ("echouee","annulee"))
    return {"total": total, "delivered": delivered, "failed": failed,
            "delivery_rate": round(delivered/max(1,total)*100, 1), "cancel_rate": round(failed/max(1,total)*100, 1),
            "satisfaction": round(random.uniform(4.1, 4.8), 1)}

# ---------- Zones ----------
@api.get("/zones")
async def zones(user: dict = Depends(get_user)):
    return clean(await db.zones.find({}).to_list(100))

@api.get("/public/zones")
async def public_zones():
    return clean(await db.zones.find({}).to_list(100))

@api.post("/zones")
async def create_zone(body: ZoneIn, user: dict = Depends(require_role("admin","manager"))):
    doc = {"id": new_id(), "name": body.name, "fee": body.fee, "created_at": now_iso()}
    await db.zones.insert_one(doc)
    return clean(doc)

@api.patch("/zones/{zid}")
async def update_zone(zid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("id",None); body.pop("_id",None)
    await db.zones.update_one({"id": zid}, {"$set": body})
    return {"ok": True}

@api.delete("/zones/{zid}")
async def delete_zone(zid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.zones.delete_one({"id": zid})
    return {"ok": True}

# ---------- Expenses / Suppliers / Purchases ----------
@api.get("/expenses")
async def expenses(user: dict = Depends(get_user)):
    return clean(await db.expenses.find({}).sort("created_at", -1).to_list(1000))

@api.post("/expenses")
async def create_expense(body: ExpenseIn, user: dict = Depends(get_user)):
    doc = body.model_dump(); doc.update({"id": new_id(), "created_at": now_iso(), "created_by": user.get("name"), "store_id":"store-cocody"})
    await db.expenses.insert_one(doc)
    return clean(doc)

@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.expenses.delete_one({"id": eid})
    return {"ok": True}

@api.get("/suppliers")
async def suppliers(user: dict = Depends(get_user)):
    return clean(await db.suppliers.find({}).to_list(200))

@api.post("/suppliers")
async def create_supplier(body: SupplierIn, user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    doc = body.model_dump(); doc.update({"id": new_id(), "created_at": now_iso()})
    await db.suppliers.insert_one(doc)
    return clean(doc)

@api.patch("/suppliers/{sid}")
async def update_supplier(sid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    body.pop("id",None); body.pop("_id",None)
    await db.suppliers.update_one({"id": sid}, {"$set": body})
    return {"ok": True}

@api.delete("/suppliers/{sid}")
async def delete_supplier(sid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.suppliers.delete_one({"id": sid})
    return {"ok": True}

@api.get("/purchase-orders")
async def purchase_orders(user: dict = Depends(get_user)):
    return clean(await db.purchase_orders.find({}).sort("created_at", -1).to_list(200))

@api.post("/purchase-orders")
async def create_po(body: PurchaseOrderIn, user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    cnt = await db.purchase_orders.count_documents({})
    doc = body.model_dump(); doc.update({"id": new_id(), "number": f"BC-2026-{200+cnt}", "created_at": now_iso()})
    await db.purchase_orders.insert_one(doc)
    return clean(doc)

@api.patch("/purchase-orders/{pid}")
async def update_po(pid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    body.pop("id", None); body.pop("_id", None)
    await db.purchase_orders.update_one({"id": pid}, {"$set": body})
    return {"ok": True}

@api.delete("/purchase-orders/{pid}")
async def delete_po(pid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.purchase_orders.delete_one({"id": pid})
    return {"ok": True}

@api.post("/purchase-orders/{pid}/receive")
async def receive_po(pid: str, body: POReceiveIn, user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    """Mark a PO as received. Applies stock increments per variant (size)
    and recomputes landed cost per unit including extra costs (fret, douane).
    Returns the list of QR labels to print (one per unit received)."""
    po = await db.purchase_orders.find_one({"id": pid})
    if not po: raise HTTPException(404)
    items = body.items or po.get("items", []) or []
    extra_costs = body.extra_costs or po.get("extra_costs", []) or []
    base_total = sum(float(it.get("qty",0)) * float(it.get("unit_cost",0)) for it in items)
    extras_total = sum(float(x.get("amount",0)) for x in extra_costs)
    total_qty = sum(float(it.get("qty",0)) for it in items) or 1
    # Spread extras proportionally to each item's cost share → landed unit cost
    labels = []
    for it in items:
        qty = int(it.get("qty", 0))
        base_unit = float(it.get("unit_cost", 0))
        share = (qty * base_unit) / max(base_total, 1)
        landed_extra_per_unit = (extras_total * share) / max(qty, 1) if qty else 0
        landed_unit = round(base_unit + landed_extra_per_unit)
        it["landed_unit_cost"] = landed_unit
        # Increment product stock_by_size + stock
        if it.get("product_id") and it.get("size"):
            await db.products.update_one(
                {"id": it["product_id"]},
                {"$inc": {f"stock_by_size.{it['size']}": qty, "stock": qty}}
            )
        # Generate one QR per unit
        for i in range(qty):
            sku = it.get("sku") or ""
            size = it.get("size") or ""
            color = it.get("color") or ""
            qr_payload = f"{sku}|{size}|{color}"
            labels.append({
                "product_name": it.get("product_name", ""),
                "sku": sku, "size": size, "color": color,
                "unit_cost": landed_unit, "qr": qr_payload,
                "po_number": po.get("number", ""),
            })
    await db.purchase_orders.update_one(
        {"id": pid},
        {"$set": {
            "status": "receptionne",
            "received_at": body.received_at or now_iso(),
            "items": items,
            "extra_costs": extra_costs,
            "extras_total": extras_total,
            "base_total": base_total,
            "total": base_total + extras_total,
            "receive_note": body.note or "",
        }}
    )
    return {"ok": True, "labels": labels, "extras_total": extras_total, "base_total": base_total}

# ---------- Promotions ----------
@api.get("/promotions")
async def promos(user: dict = Depends(get_user)):
    return clean(await db.promotions.find({}).sort("created_at", -1).to_list(200))

@api.get("/public/promotions")
async def public_promos():
    now = now_iso()
    rows = await db.promotions.find({"active": True}).to_list(100)
    out = [r for r in rows if (not r.get("ends_at") or r["ends_at"] >= now) and (not r.get("starts_at") or r["starts_at"] <= now)]
    return clean(out)

@api.post("/promotions")
async def create_promo(body: PromoIn, user: dict = Depends(require_role("admin","manager"))):
    doc = body.model_dump(); doc.update({"id": new_id(), "created_at": now_iso(), "uses": 0})
    await db.promotions.insert_one(doc)
    return clean(doc)

@api.patch("/promotions/{pid}")
async def update_promo(pid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("id",None); body.pop("_id",None)
    await db.promotions.update_one({"id": pid}, {"$set": body})
    return {"ok": True}

@api.delete("/promotions/{pid}")
async def delete_promo(pid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.promotions.delete_one({"id": pid})
    return {"ok": True}

# ---------- Invoices ----------
@api.get("/invoices")
async def invoices(user: dict = Depends(get_user)):
    return clean(await db.invoices.find({}).sort("created_at", -1).to_list(500))

@api.post("/invoices/from-order/{oid}")
async def invoice_from_order(oid: str, user: dict = Depends(get_user)):
    o = await db.orders.find_one({"id": oid})
    if not o: raise HTTPException(404)
    cnt = await db.invoices.count_documents({})
    doc = {"id": new_id(), "number": f"FACT-2026-{2000+cnt}", "order_code": o["code"],
           "order_id": oid, "customer": o.get("customer"), "items": o.get("items"),
           "total": o["total"], "status": "paye" if o.get("payment_status")=="paye" else "en_attente",
           "created_at": now_iso()}
    await db.invoices.insert_one(doc)
    return clean(doc)

# ---------- Team / Attendance ----------
@api.get("/team")
async def team(user: dict = Depends(get_user)):
    rows = await db.users.find({}, {"password_hash":0,"pin_hash":0}).to_list(200)
    return clean(rows)

@api.get("/attendance")
async def attendance(user: dict = Depends(get_user)):
    return clean(await db.attendance.find({}).sort("at", -1).to_list(500))

@api.post("/attendance/punch")
async def punch(body: Dict[str,str]):
    u = await db.users.find_one({"attendance_code": body.get("code","")})
    if not u: raise HTTPException(404, "Code inconnu")
    doc = {"id": new_id(), "user_id": u["id"], "user_name": u["name"], "role": u["role"], "at": now_iso(), "type": "in"}
    await db.attendance.insert_one(doc)
    return {"ok": True, "user": u["name"]}

# ---------- Dashboard with period + delta + drill-down ----------
PERIODS = {"today":1, "yesterday":1, "7d":7, "30d":30, "month":30, "last_month":30, "90d":90, "year":365}

def period_range(period: str):
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0); end = now
        prev_start = start - timedelta(days=1); prev_end = start
    elif period == "yesterday":
        end = now.replace(hour=0, minute=0, second=0, microsecond=0); start = end - timedelta(days=1)
        prev_end = start; prev_start = start - timedelta(days=1)
    elif period == "7d":
        start = now - timedelta(days=7); end = now
        prev_end = start; prev_start = prev_end - timedelta(days=7)
    elif period == "month" or period == "30d":
        start = now - timedelta(days=30); end = now
        prev_end = start; prev_start = prev_end - timedelta(days=30)
    elif period == "last_month":
        end = now - timedelta(days=30); start = end - timedelta(days=30)
        prev_end = start; prev_start = prev_end - timedelta(days=30)
    elif period == "90d":
        start = now - timedelta(days=90); end = now
        prev_end = start; prev_start = prev_end - timedelta(days=90)
    else:  # year
        start = now - timedelta(days=365); end = now
        prev_end = start; prev_start = prev_end - timedelta(days=365)
    return start.isoformat(), end.isoformat(), prev_start.isoformat(), prev_end.isoformat()

def delta_pct(curr, prev):
    if prev == 0: return 100 if curr > 0 else 0
    return round((curr - prev) / prev * 100, 1)

@api.get("/dashboard/kpis")
async def kpis(user: dict = Depends(get_user), period: str = "30d"):
    s, e, ps, pe = period_range(period)
    orders_curr = await db.orders.find({"created_at": {"$gte": s, "$lte": e}}).to_list(5000)
    orders_prev = await db.orders.find({"created_at": {"$gte": ps, "$lte": pe}}).to_list(5000)
    customers_curr = await db.customers.count_documents({"created_at": {"$gte": s, "$lte": e}})
    customers_prev = await db.customers.count_documents({"created_at": {"$gte": ps, "$lte": pe}})
    expenses_curr = await db.expenses.find({"created_at": {"$gte": s, "$lte": e}}).to_list(1000)

    rev = sum(o.get("total",0) for o in orders_curr)
    rev_prev = sum(o.get("total",0) for o in orders_prev)
    items = sum(sum(i.get("qty",0) for i in o.get("items",[])) for o in orders_curr)
    items_prev = sum(sum(i.get("qty",0) for i in o.get("items",[])) for o in orders_prev)
    avg_basket = int(rev / max(1, len(orders_curr)))
    avg_prev = int(rev_prev / max(1, len(orders_prev)))
    delivered = sum(1 for o in orders_curr if o.get("status")=="livree")
    delivered_prev = sum(1 for o in orders_prev if o.get("status")=="livree")
    pending = await db.orders.count_documents({"status": {"$in": ["nouvelle","confirmee","en_preparation","prete","assignee","en_livraison"]}})
    low_stock = await db.products.count_documents({"stock": {"$lt": 5}})
    expenses_total = sum(x.get("amount",0) for x in expenses_curr)
    margin = rev - expenses_total

    # Timeseries
    days = (datetime.fromisoformat(e.replace("Z","+00:00")) - datetime.fromisoformat(s.replace("Z","+00:00"))).days or 1
    buckets = min(days, 30)
    step = max(1, days // buckets)
    series = []
    for i in range(buckets):
        t0 = datetime.fromisoformat(s.replace("Z","+00:00")) + timedelta(days=i*step)
        t1 = t0 + timedelta(days=step)
        label = t0.strftime("%d/%m")
        rv = sum(o.get("total",0) for o in orders_curr if t0.isoformat() <= o.get("created_at","") < t1.isoformat())
        oc = sum(1 for o in orders_curr if t0.isoformat() <= o.get("created_at","") < t1.isoformat())
        series.append({"date": label, "revenue": rv, "orders": oc})

    # Top products by category & by qty
    counts: Dict[str, Dict[str,Any]] = {}
    cat_rev: Dict[str, int] = {}
    for o in orders_curr:
        for it in o.get("items", []):
            k = it["product_id"]
            if k not in counts: counts[k] = {"id": k, "name": it["name"], "qty": 0, "revenue": 0, "image": it.get("image")}
            counts[k]["qty"] += it["qty"]; counts[k]["revenue"] += it["qty"]*it["price"]
            # category rev (lookup from products later)
    top = sorted(counts.values(), key=lambda x: x["qty"], reverse=True)[:10]

    channels: Dict[str, Dict[str,int]] = {}
    for o in orders_curr:
        c = o.get("channel","store")
        if c not in channels: channels[c] = {"count": 0, "value": 0}
        channels[c]["count"] += 1; channels[c]["value"] += o.get("total",0)

    payments: Dict[str, int] = {}
    for o in orders_curr:
        pm = o.get("payment_method","cash"); payments[pm] = payments.get(pm,0) + o.get("total",0)

    return {
        "period": period,
        "revenue": {"value": rev, "prev": rev_prev, "delta": delta_pct(rev, rev_prev),
                    "description": "Chiffre d'affaires brut sur la période sélectionnée. Somme des totaux de toutes les commandes."},
        "orders_count": {"value": len(orders_curr), "prev": len(orders_prev), "delta": delta_pct(len(orders_curr), len(orders_prev)),
                         "description": "Nombre total de commandes créées sur la période."},
        "items_sold": {"value": items, "prev": items_prev, "delta": delta_pct(items, items_prev),
                       "description": "Articles vendus (toutes commandes)."},
        "avg_basket": {"value": avg_basket, "prev": avg_prev, "delta": delta_pct(avg_basket, avg_prev),
                       "description": "Montant moyen dépensé par commande (CA / nombre de commandes)."},
        "customers_new": {"value": customers_curr, "prev": customers_prev, "delta": delta_pct(customers_curr, customers_prev),
                          "description": "Nouvelles clientes inscrites sur la période."},
        "delivered": {"value": delivered, "prev": delivered_prev, "delta": delta_pct(delivered, delivered_prev),
                      "description": "Commandes livrées avec succès."},
        "pending_orders": {"value": pending, "prev": pending, "delta": 0,
                           "description": "Commandes en cours de traitement (non livrées, non annulées)."},
        "low_stock": {"value": low_stock, "prev": low_stock, "delta": 0,
                      "description": "Produits avec moins de 5 unités en stock."},
        "expenses": {"value": expenses_total, "prev": 0, "delta": 0,
                     "description": "Total des dépenses enregistrées sur la période."},
        "margin": {"value": margin, "prev": 0, "delta": 0,
                   "description": "Marge brute estimée : CA - dépenses."},
        "sales_series": series,
        "top_products": top[:5],
        "channels": [{"name": k, "count": v["count"], "value": v["value"]} for k,v in channels.items()],
        "payments": [{"name": k, "value": v} for k,v in payments.items()],
    }

@api.get("/dashboard/drill/{kind}")
async def drill(kind: str, period: str = "30d", user: dict = Depends(get_user)):
    s, e, _, _ = period_range(period)
    if kind == "orders":
        rows = await db.orders.find({"created_at": {"$gte": s, "$lte": e}}).sort("created_at", -1).to_list(500)
    elif kind == "customers_new":
        rows = await db.customers.find({"created_at": {"$gte": s, "$lte": e}}, {"password_hash":0}).sort("created_at", -1).to_list(500)
    elif kind == "delivered":
        rows = await db.orders.find({"status": "livree", "created_at": {"$gte": s, "$lte": e}}).to_list(500)
    elif kind == "low_stock":
        rows = await db.products.find({"stock": {"$lt": 5}}).to_list(500)
    elif kind == "pending":
        rows = await db.orders.find({"status": {"$in":["nouvelle","confirmee","en_preparation","prete","assignee","en_livraison"]}}).to_list(500)
    elif kind == "expenses":
        rows = await db.expenses.find({"created_at": {"$gte": s, "$lte": e}}).to_list(500)
    else:
        rows = []
    return clean(rows)

@api.get("/dashboard/action-items")
async def dashboard_actions(user: dict = Depends(get_user)):
    """Row 1 'À traiter maintenant' — live counts of urgent actions, each clickable."""
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    nouvelles = await db.orders.count_documents({"status": "nouvelle"})
    preparation = await db.orders.count_documents({"status": {"$in":["confirmee","en_preparation"]}})
    pretes_non_affectees = await db.orders.count_documents({"status": "prete", "$or":[{"rider_id":None},{"rider_id":{"$exists":False}}]})
    en_livraison = await db.orders.count_documents({"status": "en_livraison"})
    # Riders active today
    assigned = await db.orders.find({"status": "en_livraison"}).to_list(500)
    rider_cnt: Dict[str,int] = {}
    for o in assigned:
        rn = o.get("rider_name") or "—"; rider_cnt[rn] = rider_cnt.get(rn,0)+1
    # Oldest waiting
    oldest_nouvelle = await db.orders.find({"status":"nouvelle"}).sort("created_at", 1).limit(1).to_list(1)
    oldest_wait_min = None
    if oldest_nouvelle:
        try:
            d = datetime.fromisoformat(oldest_nouvelle[0]["created_at"].replace("Z","+00:00"))
            oldest_wait_min = int((now - d).total_seconds() / 60)
        except Exception: pass
    rupture = await db.products.count_documents({"stock": 0})
    stock_bas = await db.products.count_documents({"stock": {"$gt":0, "$lt":5}})
    paniers = await db.abandoned_carts.count_documents({"recovered": False})
    reviews_pending = await db.reviews.count_documents({"status": "pending"})
    return {
        "nouvelles": {"count": nouvelles, "wait_min": oldest_wait_min, "link":"/console/commandes?status=nouvelle"},
        "preparation": {"count": preparation, "link":"/console/commandes?status=en_preparation"},
        "pretes_non_affectees": {"count": pretes_non_affectees, "link":"/console/livraisons"},
        "en_livraison": {"count": en_livraison, "by_rider": [{"name":n,"count":c} for n,c in rider_cnt.items()], "link":"/console/livraisons"},
        "rupture": {"count": rupture, "link":"/console/stock"},
        "stock_bas": {"count": stock_bas, "link":"/console/stock"},
        "paniers_abandonnes": {"count": paniers, "link":"/console/alertes"},
        "avis_a_valider": {"count": reviews_pending, "link":"/console/avis"},
    }
# ---------- POS cash control: PIN auth, movements, holds ----------
@api.post("/pos/pin-authorize")
async def pin_authorize(body: PinAuthIn, user: dict = Depends(get_user)):
    """Verify a manager/admin PIN to authorize a sensitive POS action. Logs approval."""
    approver = await db.users.find_one({"attendance_code": body.pin.strip(), "role": {"$in": ["admin","manager"]}, "active": True})
    if not approver:
        raise HTTPException(403, "PIN invalide ou droits insuffisants")
    log = {
        "id": new_id(), "action": body.action, "amount": body.amount,
        "requested_by": user.get("id"), "requested_by_name": user.get("name"),
        "approved_by": approver.get("id"), "approved_by_name": approver.get("name"),
        "created_at": now_iso(),
    }
    await db.pos_authorizations.insert_one(log)
    return {"ok": True, "approver": approver.get("name"), "approval_id": log["id"]}

@api.post("/cash-movements")
async def create_cash_movement(body: CashMovementIn, user: dict = Depends(get_user)):
    if body.type not in ("in", "out"): raise HTTPException(400, "Type invalide")
    doc = {
        "id": new_id(), "type": body.type, "amount": float(body.amount),
        "reason": body.reason, "note": body.note or "",
        "user_id": user.get("id"), "user_name": user.get("name"),
        "created_at": now_iso(),
    }
    await db.cash_movements.insert_one(doc)
    return clean(doc)

@api.get("/cash-movements")
async def list_cash_movements(user: dict = Depends(get_user), date: Optional[str] = None):
    """List today's movements by default. date='YYYY-MM-DD' for a specific day."""
    from datetime import datetime, timezone, timedelta
    if date:
        try: d = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
        except Exception: d = datetime.now(timezone.utc)
    else: d = datetime.now(timezone.utc)
    s = d.replace(hour=0,minute=0,second=0,microsecond=0).isoformat()
    e = (d.replace(hour=0,minute=0,second=0,microsecond=0) + timedelta(days=1)).isoformat()
    rows = await db.cash_movements.find({"created_at": {"$gte": s, "$lt": e}}).sort("created_at", -1).to_list(500)
    # Compute expected cash: + cash sales + ins − outs − cash refunds
    orders = await db.orders.find({"created_at": {"$gte": s, "$lt": e}, "payment_method": "cash", "status": {"$ne": "annulee"}}).to_list(1000)
    cash_sales = sum(o.get("total",0) for o in orders)
    ins = sum(r["amount"] for r in rows if r["type"]=="in")
    outs = sum(r["amount"] for r in rows if r["type"]=="out")
    return {"movements": clean(rows), "cash_sales": cash_sales, "ins": ins, "outs": outs, "expected": cash_sales + ins - outs}

@api.post("/pos/holds")
async def create_hold(body: HoldIn, user: dict = Depends(get_user)):
    from datetime import datetime, timezone, timedelta
    exp = (datetime.now(timezone.utc) + timedelta(hours=body.expires_in_hours or 24)).isoformat()
    doc = {
        "id": new_id(), "items": body.items, "customer": body.customer,
        "note": body.note or "", "user_name": user.get("name"),
        "created_at": now_iso(), "expires_at": exp, "resumed": False,
    }
    await db.pos_holds.insert_one(doc)
    return clean(doc)

@api.get("/pos/holds")
async def list_holds(user: dict = Depends(get_user)):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    rows = await db.pos_holds.find({"resumed": False, "expires_at": {"$gte": now}}).sort("created_at", -1).to_list(100)
    return clean(rows)

@api.delete("/pos/holds/{hid}")
async def delete_hold(hid: str, user: dict = Depends(get_user)):
    await db.pos_holds.update_one({"id": hid}, {"$set": {"resumed": True, "resumed_at": now_iso()}})
    return {"ok": True}

@api.get("/stats/zones")
async def stats_zones(user: dict = Depends(get_user), period: str = "30d"):
    """Geographic breakdown by delivery zone."""
    s, e, _, _ = period_range(period)
    orders = await db.orders.find({"created_at": {"$gte": s, "$lte": e}}).to_list(10000)
    customers = await db.customers.find({}).to_list(5000)
    zones = await db.zones.find({}).to_list(100)
    by_zone: Dict[str, Dict[str,Any]] = {}
    for z in zones:
        by_zone[z["name"]] = {"name":z["name"], "fee":z.get("fee",0), "clients":0, "orders":0, "revenue":0, "cancelled":0, "postponed":0, "delivered":0, "fees_collected":0}
    unknown = {"name":"— Zone inconnue —","fee":0,"clients":0,"orders":0,"revenue":0,"cancelled":0,"postponed":0,"delivered":0,"fees_collected":0}
    # Clients by zone (based on their last address zone)
    for c in customers:
        z = (c.get("addresses",[]) or [{}])[0].get("zone") if c.get("addresses") else c.get("delivery_zone")
        bucket = by_zone.get(z, unknown)
        bucket["clients"] += 1
    # Orders aggregation
    for o in orders:
        z = o.get("delivery_zone")
        bucket = by_zone.get(z, unknown)
        bucket["orders"] += 1
        bucket["revenue"] += o.get("total",0)
        bucket["fees_collected"] += o.get("delivery_fee",0)
        if o.get("status") == "livree": bucket["delivered"] += 1
        if o.get("status") == "annulee": bucket["cancelled"] += 1
    rows = [b for b in by_zone.values() if b["orders"]>0 or b["clients"]>0]
    if unknown["orders"]>0 or unknown["clients"]>0: rows.append(unknown)
    for r in rows:
        r["avg_basket"] = int(r["revenue"]/r["orders"]) if r["orders"] else 0
        r["cancel_rate"] = round(r["cancelled"]/r["orders"]*100,1) if r["orders"] else 0
    rows.sort(key=lambda x:-x["revenue"])
    total_rev = sum(r["revenue"] for r in rows) or 1
    for r in rows: r["share"] = round(r["revenue"]/total_rev*100,1)
    return {"zones": rows, "total_customers": sum(r["clients"] for r in rows), "total_orders": sum(r["orders"] for r in rows), "total_revenue": sum(r["revenue"] for r in rows)}



# ---------- Stats ----------
@api.get("/stats/full")
async def stats_full(user: dict = Depends(get_user), period: str = "30d"):
    s, e, ps, pe = period_range(period)
    orders = await db.orders.find({"created_at": {"$gte": s, "$lte": e}}).to_list(5000)
    products = await db.products.find({}).to_list(500)
    customers = await db.customers.find({}, {"password_hash":0}).to_list(1000)
    expenses = await db.expenses.find({"created_at": {"$gte": s, "$lte": e}}).to_list(1000)

    rev = sum(o.get("total",0) for o in orders)
    cost_sold = 0
    pmap = {p["id"]: p for p in products}
    for o in orders:
        for it in o.get("items", []):
            p = pmap.get(it["product_id"])
            if p: cost_sold += it["qty"] * p.get("cost",0)
    gross_margin = rev - cost_sold

    # Sales by hour
    by_hour = [0]*24
    for o in orders:
        try: by_hour[datetime.fromisoformat(o["created_at"].replace("Z","+00:00")).hour] += o.get("total",0)
        except Exception: pass

    # Top by category
    cat_rev: Dict[str,int] = {}
    size_sales: Dict[str,int] = {}
    color_sales: Dict[str,int] = {}
    for o in orders:
        for it in o.get("items", []):
            p = pmap.get(it["product_id"])
            if p: cat_rev[p["category"]] = cat_rev.get(p["category"],0) + it["qty"]*it["price"]
            if it.get("size"): size_sales[it["size"]] = size_sales.get(it["size"],0) + it["qty"]
            if it.get("color"): color_sales[it["color"]] = color_sales.get(it["color"],0) + it["qty"]

    # Products
    prod_perf: Dict[str, Dict[str,Any]] = {}
    for o in orders:
        for it in o.get("items", []):
            k = it["product_id"]
            if k not in prod_perf: prod_perf[k] = {"name": it["name"], "qty":0, "revenue":0, "image": it.get("image")}
            prod_perf[k]["qty"] += it["qty"]; prod_perf[k]["revenue"] += it["qty"]*it["price"]

    top10 = sorted(prod_perf.values(), key=lambda x: x["qty"], reverse=True)[:10]
    worst = sorted(prod_perf.values(), key=lambda x: x["qty"])[:5]

    # Customer stats
    returning = sum(1 for c in customers if c.get("last_order_at") and c.get("last_order_at") >= s)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    inactive = sum(1 for c in customers if not c.get("last_order_at") or c.get("last_order_at") < cutoff)

    # Channels & payments
    channels: Dict[str, Dict[str,int]] = {}
    for o in orders:
        c = o.get("channel","store")
        if c not in channels: channels[c] = {"count":0, "value":0}
        channels[c]["count"] += 1; channels[c]["value"] += o.get("total",0)

    exp_by_cat: Dict[str,int] = {}
    for x in expenses: exp_by_cat[x["category"]] = exp_by_cat.get(x["category"],0) + x.get("amount",0)

    # Status breakdown
    statuses: Dict[str,int] = {}
    for o in orders: statuses[o.get("status","nouvelle")] = statuses.get(o.get("status","nouvelle"),0)+1

    return {
        "revenue": rev, "cost_of_goods": cost_sold, "gross_margin": gross_margin, "expenses": sum(x.get("amount",0) for x in expenses),
        "orders_count": len(orders), "avg_basket": int(rev/max(1,len(orders))),
        "by_hour": [{"h": f"{i}h", "value": v} for i,v in enumerate(by_hour)],
        "cat_rev": [{"name": k, "value": v} for k,v in cat_rev.items()],
        "size_sales": [{"name": k, "value": v} for k,v in sorted(size_sales.items(), key=lambda x: -x[1])],
        "color_sales": [{"name": k, "value": v} for k,v in sorted(color_sales.items(), key=lambda x: -x[1])],
        "top10": top10, "worst": worst,
        "customers_total": len(customers), "customers_returning": returning, "customers_inactive": inactive,
        "channels": [{"name": k, **v} for k,v in channels.items()],
        "exp_by_cat": [{"name": k, "value": v} for k,v in exp_by_cat.items()],
        "statuses": [{"name": k, "value": v} for k,v in statuses.items()],
    }

# ---------- Reviews moderation ----------
@api.get("/public/reviews/{pid}")
async def public_reviews(pid: str):
    rows = await db.reviews.find({"product_id": pid, "status": "approved"}).sort("created_at", -1).to_list(100)
    return clean(rows)

@api.post("/public/reviews")
async def create_review(body: ReviewIn):
    if body.rating < 1 or body.rating > 5: raise HTTPException(400)
    doc = body.model_dump(); doc.update({"id": new_id(), "created_at": now_iso(), "status": "pending"})
    await db.reviews.insert_one(doc)
    return clean(doc)

@api.get("/reviews")
async def all_reviews(user: dict = Depends(get_user), status: Optional[str] = None):
    f = {}
    if status: f["status"] = status
    rows = await db.reviews.find(f).sort("created_at", -1).to_list(500)
    # Attach product
    pids = list({r["product_id"] for r in rows})
    prods = await db.products.find({"id": {"$in": pids}}).to_list(500)
    pmap = {p["id"]: p for p in prods}
    for r in rows:
        p = pmap.get(r["product_id"], {})
        r["product_name"] = p.get("name"); r["product_image"] = p.get("image")
    return clean(rows)

@api.patch("/reviews/{rid}")
async def moderate_review(rid: str, body: ReviewModerationIn, user: dict = Depends(require_role("admin","manager"))):
    await db.reviews.update_one({"id": rid}, {"$set": {"status": body.status}})
    # Recompute aggregate on product
    r = await db.reviews.find_one({"id": rid})
    if r:
        rows = await db.reviews.find({"product_id": r["product_id"], "status": "approved"}).to_list(500)
        avg = round(sum(x["rating"] for x in rows)/max(1,len(rows)), 1) if rows else 0
        await db.products.update_one({"id": r["product_id"]}, {"$set": {"rating_avg": avg, "rating_count": len(rows)}})
    return {"ok": True}

@api.delete("/reviews/{rid}")
async def delete_review(rid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.reviews.delete_one({"id": rid})
    return {"ok": True}

# ---------- Back-in-stock alerts ----------
@api.post("/public/stock-alert")
async def stock_alert(body: StockAlertIn):
    doc = {"id": new_id(), "product_id": body.product_id, "size": body.size, "phone": body.phone, "notified": False, "created_at": now_iso()}
    await db.stock_alerts.insert_one(doc)
    return {"ok": True}

@api.get("/stock-alerts")
async def list_stock_alerts(user: dict = Depends(get_user)):
    return clean(await db.stock_alerts.find({}).sort("created_at", -1).to_list(500))

@api.patch("/stock-alerts/{aid}/notify")
async def notify_alert(aid: str, user: dict = Depends(get_user)):
    await db.stock_alerts.update_one({"id": aid}, {"$set": {"notified": True, "notified_at": now_iso()}})
    return {"ok": True}

# ---------- Abandoned carts ----------
@api.post("/public/abandoned-cart")
async def abandoned_cart(body: Dict[str,Any]):
    doc = {"id": new_id(), **body, "created_at": now_iso(), "recovered": False}
    await db.abandoned_carts.insert_one(doc)
    return {"ok": True}

@api.get("/abandoned-carts")
async def list_abandoned(user: dict = Depends(get_user)):
    return clean(await db.abandoned_carts.find({"recovered": False}).sort("created_at", -1).to_list(200))

# ---------- WhatsApp Outbox (campagnes) ----------
@api.get("/whatsapp-outbox")
async def wa_outbox(user: dict = Depends(get_user), status: Optional[str] = None, kind: Optional[str] = None):
    f = {}
    if status == "pending": f["sent"] = False
    elif status == "sent": f["sent"] = True
    if kind: f["kind"] = kind
    rows = await db.whatsapp_outbox.find(f).sort("created_at", -1).to_list(500)
    return clean(rows)

@api.post("/whatsapp-outbox/{mid}/mark-sent")
async def wa_mark_sent(mid: str, user: dict = Depends(get_user)):
    await db.whatsapp_outbox.update_one({"id": mid}, {"$set": {"sent": True, "sent_at": now_iso(), "sent_by": user.get("name")}})
    return {"ok": True}

@api.delete("/whatsapp-outbox/{mid}")
async def wa_delete(mid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.whatsapp_outbox.delete_one({"id": mid})
    return {"ok": True}

def _segment_filter(seg: str) -> Dict[str, Any]:
    if seg == "vip": return {"loyalty_points": {"$gt": 500}}
    if seg == "blacklist": return {"status": "blacklist"}
    if seg == "inactive":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        return {"$or": [{"last_order_at": {"$lt": cutoff}}, {"last_order_at": None}]}
    if seg == "active":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        return {"last_order_at": {"$gte": cutoff}}
    if seg == "nouvelles":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        return {"created_at": {"$gte": cutoff}}
    return {}

@api.get("/customer-segments")
async def customer_segments(user: dict = Depends(get_user)):
    """Return counts per segment for dashboard chips."""
    out = {}
    for seg in ["all", "active", "inactive", "vip", "blacklist", "nouvelles"]:
        f = _segment_filter(seg) if seg != "all" else {}
        out[seg] = await db.customers.count_documents(f)
    return out

@api.post("/whatsapp-outbox/broadcast")
async def wa_broadcast(body: WaBroadcastIn, user: dict = Depends(require_role("admin","manager"))):
    f = _segment_filter(body.segment)
    customers = await db.customers.find(f).to_list(2000)
    created = 0
    for c in customers:
        phone = c.get("phone") or ""
        phone_digits = "".join(ch for ch in phone if ch.isdigit())
        if not phone_digits: continue
        msg = body.message.replace("{prenom}", (c.get("name") or "").split(" ")[0]).replace("{code}", c.get("referral_code") or "")
        link = f"https://wa.me/{phone_digits}?text={_url_quote(msg)}"
        await db.whatsapp_outbox.insert_one({
            "id": new_id(), "customer_id": c.get("id"), "customer_name": c.get("name"),
            "phone": phone, "phone_digits": phone_digits,
            "message": msg, "link": link,
            "kind": "broadcast", "segment": body.segment,
            "sent": False, "created_at": now_iso(), "created_by": user.get("name"),
        })
        created += 1
    return {"ok": True, "enqueued": created}

# ---------- Loyalty settings ----------
DEFAULT_LOYALTY = {
    "points_per_fcfa": 500,
    "enabled": True,
    "referral_bonus_parrain": 1000,
    "referral_bonus_filleul": 500,
    "tiers": [
        {"name": "Bronze", "min_points": 0, "discount_pct": 0, "free_delivery": False},
        {"name": "Silver", "min_points": 500, "discount_pct": 5, "free_delivery": False},
        {"name": "Gold", "min_points": 2000, "discount_pct": 10, "free_delivery": True},
    ],
}

@api.get("/loyalty/settings")
async def loyalty_settings(user: dict = Depends(get_user)):
    s = await db.loyalty_settings.find_one({"id": "main"})
    if not s:
        s = {"id": "main", **DEFAULT_LOYALTY, "updated_at": now_iso()}
        await db.loyalty_settings.insert_one(s)
    return clean(s)

@api.patch("/loyalty/settings")
async def update_loyalty_settings(body: LoyaltySettingsIn, user: dict = Depends(require_role("admin","manager"))):
    data = body.model_dump()
    data["id"] = "main"; data["updated_at"] = now_iso()
    await db.loyalty_settings.update_one({"id": "main"}, {"$set": data}, upsert=True)
    return {"ok": True}

# ---------- Referrals ----------
@api.get("/referrals")
async def list_referrals(user: dict = Depends(get_user)):
    rows = await db.referrals.find({}).sort("created_at", -1).to_list(500)
    return clean(rows)

@api.get("/referrals/leaderboard")
async def referrals_leaderboard(user: dict = Depends(get_user)):
    rows = await db.customers.find({"referral_count": {"$gt": 0}}).sort("referral_count", -1).to_list(50)
    return clean(rows)

@api.post("/referrals/apply")
async def apply_referral(body: ReferralApplyIn, user: dict = Depends(get_user)):
    parrain = await db.customers.find_one({"referral_code": body.code.strip()})
    if not parrain: raise HTTPException(404, "Code de parrainage introuvable")
    filleul = await db.customers.find_one({"id": body.customer_id})
    if not filleul: raise HTTPException(404, "Filleul introuvable")
    if filleul.get("referred_by"): raise HTTPException(400, "Cette cliente a déjà utilisé un code")
    if parrain.get("id") == filleul.get("id"): raise HTTPException(400, "Impossible de se parrainer soi-même")
    settings = await db.loyalty_settings.find_one({"id": "main"}) or DEFAULT_LOYALTY
    bp = int(settings.get("referral_bonus_parrain", 1000))
    bf = int(settings.get("referral_bonus_filleul", 500))
    await db.customers.update_one({"id": parrain["id"]}, {"$inc": {"wallet": bp, "referral_count": 1}})
    await db.customers.update_one({"id": filleul["id"]}, {"$inc": {"wallet": bf}, "$set": {"referred_by": parrain["id"], "referred_by_code": body.code.strip()}})
    doc = {
        "id": new_id(), "parrain_id": parrain["id"], "parrain_name": parrain.get("name"),
        "filleul_id": filleul["id"], "filleul_name": filleul.get("name"),
        "code": body.code.strip(), "bonus_parrain": bp, "bonus_filleul": bf,
        "created_at": now_iso(),
    }
    await db.referrals.insert_one(doc)
    return {"ok": True, "referral": clean(doc)}

# ---------- Roles & permissions matrix ----------
DEFAULT_PERMS = {
    "admin":   {"all": True},
    "manager": {"pos": True, "orders": True, "deliveries": True, "products": True, "stock": True, "customers": True, "expenses": True, "team": False, "settings": False},
    "sales":   {"pos": True, "orders": True, "deliveries": False, "products": False, "stock": True, "customers": True, "expenses": False, "team": False, "settings": False},
    "stock_keeper": {"pos": False, "orders": True, "deliveries": False, "products": True, "stock": True, "customers": False, "expenses": False, "team": False, "settings": False},
    "rider":   {"pos": False, "orders": False, "deliveries": True, "products": False, "stock": False, "customers": False, "expenses": False, "team": False, "settings": False},
}

@api.get("/roles-permissions")
async def get_roles_permissions(user: dict = Depends(get_user)):
    s = await db.roles_permissions.find_one({"id": "main"})
    if not s:
        s = {"id": "main", "matrix": DEFAULT_PERMS, "updated_at": now_iso()}
        await db.roles_permissions.insert_one(s)
    return clean(s)

@api.patch("/roles-permissions")
async def update_roles_permissions(body: RolesPermissionsIn, user: dict = Depends(require_role("admin"))):
    await db.roles_permissions.update_one({"id": "main"}, {"$set": {"id": "main", "matrix": body.matrix, "updated_at": now_iso()}}, upsert=True)
    return {"ok": True}

# ---------- Attendance (kiosk) ----------
@api.get("/attendance/today")
async def attendance_today(user: dict = Depends(get_user)):
    from datetime import datetime, timezone, timedelta
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    rows = await db.attendance.find({"at": {"$gte": start}}).sort("at", -1).to_list(500)
    return clean(rows)

@api.post("/attendance/punch-kiosk")
async def attendance_punch_kiosk(body: AttendancePunchIn):
    """Public kiosk endpoint: an employee enters their PIN to punch in/out."""
    u = await db.users.find_one({"attendance_code": body.code.strip()})
    if not u: raise HTTPException(403, "Code invalide")
    doc = {
        "id": new_id(), "user_id": u.get("id"), "user_name": u.get("name"),
        "role": u.get("role"), "kind": body.kind, "at": now_iso(),
    }
    await db.attendance.insert_one(doc)
    return {"ok": True, "name": u.get("name"), "role": u.get("role"), "kind": body.kind, "at": doc["at"]}

@api.get("/notifications")
async def notifications(user: dict = Depends(get_user)):
    """Real-time notifications from DB: new orders, low stock, pending reviews, stock alerts, abandoned carts."""
    items = []
    new_orders = await db.orders.find({"status": "nouvelle"}).sort("created_at", -1).to_list(10)
    for o in new_orders:
        items.append({
            "id": f"order-{o['id']}",
            "type": "order",
            "title": "Nouvelle commande",
            "msg": f"{o.get('code','?')} · {o.get('customer',{}).get('name','?')} · {int(o.get('total',0))} FCFA",
            "at": o.get("created_at"),
            "link": "/console/commandes",
            "color": "#1f8a4c",
        })
    low_products = await db.products.find({"stock": {"$lt": 5}}).sort("stock", 1).to_list(10)
    for p in low_products:
        items.append({
            "id": f"stock-{p['id']}",
            "type": "stock",
            "title": "Stock faible",
            "msg": f"{p['name']} · {p['stock']} restant(s)",
            "at": now_iso(),
            "link": "/console/stock",
            "color": "#e4991e",
        })
    pending_reviews = await db.reviews.find({"status": "pending"}).sort("created_at", -1).to_list(10)
    for r in pending_reviews:
        items.append({
            "id": f"review-{r['id']}",
            "type": "review",
            "title": "Avis à modérer",
            "msg": f"{r.get('rating',0)}★ · {(r.get('comment') or '')[:60]}",
            "at": r.get("created_at"),
            "link": "/console/avis",
            "color": "#b02a2a",
        })
    pending_alerts = await db.stock_alerts.find({"notified": False}).sort("created_at", -1).to_list(10)
    for a in pending_alerts:
        p = await db.products.find_one({"id": a.get("product_id")})
        pname = p["name"] if p else "Produit"
        items.append({
            "id": f"alert-{a['id']}",
            "type": "alert",
            "title": "Alerte retour en stock",
            "msg": f"{pname} · taille {a.get('size','?')} · {a.get('phone','')}",
            "at": a.get("created_at"),
            "link": "/console/alertes",
            "color": "#e4991e",
        })
    carts = await db.abandoned_carts.find({"recovered": False}).sort("created_at", -1).to_list(5)
    for c in carts:
        items.append({
            "id": f"cart-{c['id']}",
            "type": "cart",
            "title": "Panier abandonné",
            "msg": f"{c.get('phone','?')} · {int(c.get('total',0))} FCFA",
            "at": c.get("created_at"),
            "link": "/console/alertes",
            "color": "#c62828",
        })
    items.sort(key=lambda x: x.get("at") or "", reverse=True)
    return items[:30]


# ---------- Site CMS ----------
DEFAULT_SECTIONS = [
    {"id": "s_hero", "type": "hero", "enabled": True, "props": {
        "tagline": "Collection Harmattan 2026",
        "title": "Vos talons,",
        "highlight": "votre allure.",
        "subtitle": "Chaussures, robes, sacs et accessoires pour la femme ivoirienne. Livraison partout en Côte d'Ivoire.",
        "cta_label": "Découvrir la collection",
        "cta_link": "/boutique/catalog",
        "mosaic": [
            "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800",
            "https://images.unsplash.com/photo-1709809081557-78f803ce93a0?w=800",
            "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800",
            "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800",
        ],
    }},
    {"id": "s_featured", "type": "product_grid", "enabled": True, "props": {
        "title": "Les coups de cœur", "eyebrow": "Nouveautés", "limit": 8, "source": "featured",
    }},
    {"id": "s_trust", "type": "trust_strip", "enabled": True, "props": {
        "items": [
            {"icon": "truck", "title": "Livraison rapide", "text": "Partout à Abidjan en 24h."},
            {"icon": "shield", "title": "Paiement à la livraison", "text": "Espèces ou Wave à la réception."},
            {"icon": "whatsapp", "title": "Conseillère WhatsApp", "text": "0777 92 61 79 · 7j/7."},
        ],
    }},
]

@api.get("/public/site")
async def public_site():
    s = await db.site_settings.find_one({"id":"main"})
    data = clean(s or {})
    if "sections" not in data or not data["sections"]:
        data["sections"] = DEFAULT_SECTIONS
    return data

@api.get("/public/storefront/sections")
async def public_sections():
    s = await db.site_settings.find_one({"id":"main"})
    secs = (s or {}).get("sections") or DEFAULT_SECTIONS
    # Only enabled sections
    return [sec for sec in secs if sec.get("enabled", True)]

@api.get("/storefront/sections")
async def list_sections(user: dict = Depends(get_user)):
    s = await db.site_settings.find_one({"id":"main"}) or {}
    return s.get("sections") or DEFAULT_SECTIONS

@api.patch("/storefront/sections")
async def update_sections(body: StorefrontSectionsIn, user: dict = Depends(require_role("admin","manager"))):
    await db.site_settings.update_one(
        {"id":"main"},
        {"$set":{"id":"main","sections": body.sections,"updated_at":now_iso()}},
        upsert=True,
    )
    return {"ok": True, "sections": body.sections}

@api.patch("/site")
async def update_site(body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("_id",None)
    await db.site_settings.update_one({"id":"main"}, {"$set":{**body,"id":"main","updated_at":now_iso()}}, upsert=True)
    return {"ok": True}

# ---------- CMS Pages (About / Delivery / Terms / FAQ / custom) ----------
DEFAULT_PAGES = [
    {"slug":"about","title":"À propos","content":"Chez Dina est une boutique de mode féminine à Cocody Angré 7e. Nous sélectionnons des pièces tendance pour la femme ivoirienne.","enabled":True},
    {"slug":"delivery","title":"Livraison & retours","content":"Livraison 24h à Abidjan. Retour sous 48h sur articles non portés.","enabled":True},
    {"slug":"terms","title":"CGV","content":"Conditions générales de vente — Chez Dina.","enabled":True},
    {"slug":"faq","title":"FAQ","content":"Comment commander ? Via le site ou WhatsApp 0777 92 61 79.","enabled":True},
]

@api.get("/public/best-sellers")
async def public_best_sellers(limit: int = 12):
    pipeline = [
        {"$match": {"status": {"$ne": "annulee"}}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "sold": {"$sum": "$items.qty"}}},
        {"$sort": {"sold": -1}}, {"$limit": limit}
    ]
    rows = await db.orders.aggregate(pipeline).to_list(limit)
    ids = [r["_id"] for r in rows if r.get("_id")]
    products = await db.products.find({"id": {"$in": ids}, "$or": [{"active": True}, {"active": {"$exists": False}}], "status": {"$nin": ["inactif","archive","brouillon"]}}).to_list(limit)
    pmap = {p["id"]: p for p in products}
    sold_map = {r["_id"]: r["sold"] for r in rows}
    out = []
    for pid in ids:
        if pid in pmap:
            p = pmap[pid]; p["sold_count"] = sold_map.get(pid, 0); out.append(p)
    return clean(out)

@api.get("/public/search-suggestions")
async def public_search_suggestions(q: str = ""):
    q = (q or "").strip().lower()
    if len(q) < 2: return {"products": [], "categories": [], "brands": []}
    import unicodedata
    def norm(s): return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").lower()
    nq = norm(q)
    products = await db.products.find({"$or": [{"active": True}, {"active": {"$exists": False}}], "status": {"$nin": ["inactif","archive","brouillon"]}}).to_list(1500)
    scored = []
    for p in products:
        hay = f"{norm(p.get('name',''))} {norm(p.get('brand',''))} {norm(p.get('category',''))} {norm(p.get('sku',''))}"
        if nq in hay:
            scored.append((0 if hay.startswith(nq) else 1, p))
        else:
            # tolerant: handle typos — check if trimmed version appears, or char overlap >= 60%
            short = nq[:max(4, len(nq)-2)]
            if short in hay:
                scored.append((2, p))
            else:
                common = sum(1 for c in set(nq) if c in hay) / max(len(set(nq)), 1)
                if common >= 0.80: scored.append((3, p))
    scored.sort(key=lambda x: x[0])
    found = [s[1] for s in scored[:8]]
    cats = sorted(set(p["category"] for p in products if nq in norm(p.get("category",""))))[:5]
    brands = sorted(set(p["brand"] for p in products if p.get("brand") and nq in norm(p.get("brand",""))))[:5]
    if not found:
        await db.search_misses.insert_one({"id": new_id(), "q": q, "at": now_iso()})
    return {"products": clean(found), "categories": cats, "brands": brands}

@api.get("/public/lookbook")
async def public_lookbook():
    s = await db.site_settings.find_one({"id":"main"}) or {}
    lb = s.get("lookbook") or []
    if not lb:
        prods = await db.products.find({"$or": [{"active": True}, {"active": {"$exists": False}}]}).limit(4).to_list(4)
        lb = [{"image": "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200", "title": "Look rentrée", "product_ids": [p["id"] for p in prods]}]
    return clean(lb)

@api.get("/public/popup")
async def public_popup():
    s = await db.site_settings.find_one({"id":"main"}) or {}
    p = s.get("welcome_popup") or {}
    if not p.get("enabled"): return {"enabled": False}
    return {
        "enabled": True,
        "image": p.get("image","https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800"),
        "title": p.get("title","Bienvenue chez Dina ✨"),
        "offer": p.get("offer","-10% sur votre première commande"),
        "code": p.get("code","BIENVENUE"),
        "delay_s": p.get("delay_s", 8),
    }

@api.get("/public/announcement")
async def public_announcement():
    s = await db.site_settings.find_one({"id":"main"}) or {}
    return s.get("announcement") or {"enabled": False, "text": ""}

@api.get("/public/products/{pid}/delivery-estimate")
async def delivery_estimate(pid: str, zone: str = "Cocody"):
    z = await db.zones.find_one({"name": zone})
    fee = (z or {}).get("fee", 1500)
    return {"zone": zone, "fee": fee, "delay": "24h (demain)"}

# Offline sync queue for rider
@api.post("/sync/batch")
async def sync_batch(body: Dict[str, Any], user: dict = Depends(get_user)):
    """Accept a batch of queued offline operations from the rider."""
    ops = body.get("ops") or []
    results = []
    for op in ops:
        try:
            if op.get("type") == "status":
                o = await db.orders.find_one({"id": op["order_id"]})
                if o and o.get("status") != op["status"]:
                    tl = o.get("timeline", []); tl.append({"status": op["status"], "at": op.get("at", now_iso()), "by": user.get("name"), "offline": True})
                    await db.orders.update_one({"id": op["order_id"]}, {"$set": {"status": op["status"], "timeline": tl}})
                results.append({"id": op.get("id"), "ok": True})
            elif op.get("type") == "contact":
                await db.orders.update_one({"id": op["order_id"]}, {"$push": {"contact_log": {"kind": op.get("kind","call"), "at": op.get("at"), "by": user.get("name"), "offline": True}}})
                results.append({"id": op.get("id"), "ok": True})
            else:
                results.append({"id": op.get("id"), "ok": False, "err": "unknown"})
        except Exception as e:
            results.append({"id": op.get("id"), "ok": False, "err": str(e)})
    return {"results": results, "synced_at": now_iso()}

# ---------- POS v3: shortcuts, shared-cart, waitlist, parse-order ----------
@api.get("/pos/shortcuts")
async def pos_shortcuts(user: dict = Depends(get_user), limit: int = 8):
    """Top best-selling products of last 7 days for quick POS access."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}, "status": {"$ne": "annulee"}}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "sold": {"$sum": "$items.qty"}}},
        {"$sort": {"sold": -1}}, {"$limit": limit}
    ]
    rows = await db.orders.aggregate(pipeline).to_list(limit)
    ids = [r["_id"] for r in rows if r.get("_id")]
    products = await db.products.find({"id": {"$in": ids}}).to_list(limit)
    pmap = {p["id"]: p for p in products}
    sold_map = {r["_id"]: r["sold"] for r in rows}
    out = []
    for pid in ids:
        if pid in pmap:
            p = pmap[pid]; p["sold_count"] = sold_map.get(pid, 0); out.append(p)
    return clean(out)

@api.post("/pos/shared-cart")
async def pos_create_shared_cart(body: Dict[str, Any], user: dict = Depends(get_user)):
    """Create a shareable cart link for a customer to review & confirm via WhatsApp."""
    exp_h = int(body.get("expires_in_hours", 48))
    doc = {
        "id": new_id(), "items": body.get("items", []), "customer": body.get("customer"),
        "mode": body.get("mode", "store"), "zone": body.get("zone"),
        "delivery_fee": int(body.get("delivery_fee", 0)), "discount": int(body.get("discount", 0)),
        "note": body.get("note", ""), "address": body.get("address"),
        "created_at": now_iso(), "created_by_id": user.get("id"), "created_by_name": user.get("name"),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=exp_h)).isoformat(),
        "confirmed": False, "confirmed_at": None, "order_id": None,
    }
    await db.shared_carts.insert_one(doc)
    return {"id": doc["id"], "link": f"/boutique/panier-partage/{doc['id']}", "expires_at": doc["expires_at"]}

@api.get("/public/shared-cart/{sid}")
async def public_shared_cart(sid: str):
    sc = await db.shared_carts.find_one({"id": sid})
    if not sc: raise HTTPException(404, "Panier introuvable")
    if sc.get("confirmed"): return {"error": "already_confirmed", "order_code": (await db.orders.find_one({"id": sc.get("order_id")}) or {}).get("code")}
    if sc.get("expires_at") and sc["expires_at"] < now_iso(): return {"error": "expired"}
    return clean(sc)

@api.post("/public/shared-cart/{sid}/confirm")
async def confirm_shared_cart(sid: str, body: Dict[str, Any]):
    sc = await db.shared_carts.find_one({"id": sid})
    if not sc: raise HTTPException(404)
    if sc.get("confirmed"): raise HTTPException(400, "Déjà confirmé")
    if sc.get("expires_at") and sc["expires_at"] < now_iso(): raise HTTPException(400, "Expiré")
    items = body.get("items") or sc.get("items", [])
    sub = sum(int(it.get("qty",1))*int(it.get("price",0)) for it in items)
    fee = int(sc.get("delivery_fee",0)); disc = int(sc.get("discount",0))
    total = sub + fee - disc
    code = gen_code()
    doc = {
        "id": new_id(), "code": code, "items": items, "customer": sc.get("customer"),
        "channel": "shared_cart", "payment_method": body.get("payment_method","cod"),
        "delivery_zone": sc.get("zone"), "delivery_fee": fee, "discount": disc,
        "note": sc.get("note",""), "mode": sc.get("mode","delivery"), "store_id":"store-cocody",
        "subtotal": sub, "total": total, "status":"confirmee" if sc.get("mode")=="delivery" else "livree",
        "payment_status":"en_attente", "created_at": now_iso(),
        "created_by": sc.get("created_by_name"), "placed_by_agent": sc.get("created_by_name"),
        "timeline":[{"status":"confirmee","at":now_iso(),"by":f"Cliente ({sc.get('customer',{}).get('name','?')})"}],
    }
    await db.orders.insert_one(doc)
    for it in items:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": -int(it.get("qty",1))}})
        if it.get("size"):
            await db.products.update_one({"id": it["product_id"]}, {"$inc": {f"stock_by_size.{it['size']}": -int(it.get("qty",1))}})
    await db.shared_carts.update_one({"id": sid}, {"$set": {"confirmed": True, "confirmed_at": now_iso(), "order_id": doc["id"]}})
    return {"ok": True, "code": code, "order_id": doc["id"]}

class WaitlistIn(BaseModel):
    product_id: str
    size: Optional[str] = None
    phone: str
    name: Optional[str] = None

@api.post("/waitlist")
async def waitlist_add(body: WaitlistIn, user: dict = Depends(get_user)):
    doc = {"id": new_id(), "product_id": body.product_id, "size": body.size,
           "phone": body.phone, "name": body.name or "Cliente",
           "created_at": now_iso(), "notified_at": None, "created_by": user.get("name")}
    await db.waitlist.insert_one(doc)
    return clean(doc)

@api.post("/public/waitlist")
async def public_waitlist_add(body: WaitlistIn):
    doc = {"id": new_id(), "product_id": body.product_id, "size": body.size,
           "phone": body.phone, "name": body.name or "Cliente",
           "created_at": now_iso(), "notified_at": None, "created_by": "boutique"}
    await db.waitlist.insert_one(doc)
    return {"ok": True}

@api.get("/waitlist")
async def waitlist_list(user: dict = Depends(get_user), product_id: Optional[str] = None):
    f = {"notified_at": None}
    if product_id: f["product_id"] = product_id
    rows = await db.waitlist.find(f).sort("created_at", -1).to_list(500)
    # Enrich with product info
    pids = list({r.get("product_id") for r in rows})
    prods = {p["id"]: p for p in await db.products.find({"id": {"$in": pids}}).to_list(500)}
    for r in rows:
        p = prods.get(r.get("product_id"))
        if p: r["product_name"] = p.get("name"); r["product_image"] = p.get("image")
    return clean(rows)

@api.delete("/waitlist/{wid}")
async def waitlist_remove(wid: str, user: dict = Depends(get_user)):
    await db.waitlist.update_one({"id": wid}, {"$set": {"notified_at": now_iso(), "notified_by": user.get("name")}})
    return {"ok": True}

@api.post("/ai/parse-order")
async def ai_parse_order(body: Dict[str, Any], user: dict = Depends(get_user)):
    """Parse a pasted WhatsApp order message into structured cart items + customer hints."""
    text = (body.get("text") or "").strip()
    if not text: raise HTTPException(400, "Texte requis")
    # Load available products catalog (name + sizes + colors + id)
    all_prods = await db.products.find({}).to_list(1000)
    cat_lines = [f"- id={p['id']} | {p['name']} | marque={p.get('brand','')} | cat={p.get('category','')} | couleurs={','.join(p.get('colors',[]))} | tailles={','.join(p.get('sizes',[]))} | prix={p.get('price',0)}" for p in all_prods[:200]]
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        system = ("Tu es un parseur de commandes WhatsApp pour la boutique 'Chez Dina' (Abidjan). "
                  "Depuis le message client, tu extrais STRICTEMENT en JSON : "
                  "{\"items\":[{\"product_id\":\"...\",\"name\":\"...\",\"size\":\"...\",\"color\":\"...\",\"qty\":1}], "
                  "\"customer_hint\":{\"name\":\"...\",\"phone\":\"...\",\"zone\":\"...\",\"address\":\"...\"}, \"confidence\":0.0}. "
                  "Fais correspondre chaque article à un product_id du catalogue ci-dessous. Si pas sûr, laisse product_id vide. "
                  f"Catalogue:\n" + "\n".join(cat_lines[:150]))
        chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY",""), session_id=f"dina-parse-{user['id']}", system_message=system).with_model("anthropic","claude-sonnet-4-5-20250929")
        reply = await chat.send_message(UserMessage(text=f"Message cliente :\n{text}\n\nRéponds UNIQUEMENT par le JSON, sans texte avant/après."))
        import json, re
        raw = str(reply).strip()
        # Extract JSON block
        m = re.search(r'\{[\s\S]*\}', raw)
        if m: raw = m.group(0)
        data = json.loads(raw)
        # Enrich items with price/image from catalog
        pmap = {p["id"]: p for p in all_prods}
        for it in data.get("items", []):
            pid = it.get("product_id")
            if pid and pid in pmap:
                p = pmap[pid]
                it["price"] = p.get("price", 0)
                it["image"] = p.get("image")
                if not it.get("name"): it["name"] = p.get("name")
        return data
    except Exception as e:
        logger.exception("parse_order")
        return {"items": [], "customer_hint": {}, "confidence": 0.0, "error": "AI indisponible"}

@api.get("/pos/pdf-receipt/{oid}")
async def pos_pdf_data(oid: str, user: dict = Depends(get_user)):
    """Return receipt data for client-side PDF generation."""
    o = await db.orders.find_one({"id": oid})
    if not o: raise HTTPException(404)
    biz = await db.business.find_one({"id":"main"}) or {}
    return {"order": clean(o), "business": clean(biz)}

@api.get("/products/kpis")
async def product_kpis(user: dict = Depends(get_user)):
    """Returns global KPIs for the Products tab."""
    all_p = await db.products.find({}).to_list(2000)
    def st(p):
        if p.get("status"): return p["status"]
        return "actif"
    actifs = sum(1 for p in all_p if st(p) == "actif" and (p.get("stock",0) or 0) > 0)
    inactifs = sum(1 for p in all_p if st(p) in ("inactif","archive"))
    draft = sum(1 for p in all_p if st(p) == "brouillon")
    waitlist = sum(1 for p in all_p if st(p) == "liste_attente")
    rupture = sum(1 for p in all_p if (p.get("stock",0) or 0) <= 0 and st(p) not in ("inactif","archive","brouillon"))
    low = sum(1 for p in all_p if 0 < (p.get("stock",0) or 0) < 5)
    val_cost = sum((p.get("stock",0) or 0) * (p.get("cost",0) or 0) for p in all_p)
    val_price = sum((p.get("stock",0) or 0) * (p.get("price",0) or 0) for p in all_p)
    margins = [((p["price"]-p["cost"])/p["price"]*100) for p in all_p if p.get("price",0) > 0 and p.get("cost",0) > 0]
    avg_margin = sum(margins)/len(margins) if margins else 0
    return {"actifs":actifs,"inactifs":inactifs,"brouillon":draft,"liste_attente":waitlist,"rupture":rupture,"stock_bas":low,"valeur_cout":int(val_cost),"valeur_vente":int(val_price),"marge_moyenne":round(avg_margin,1),"total":len(all_p)}

@api.get("/products/sales-30d")
async def products_sales_30d(user: dict = Depends(get_user)):
    """Return a dict {product_id: units_sold_last_30d}."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "status":{"$ne":"annulee"}}).to_list(5000)
    sales: Dict[str,int] = {}
    for o in orders:
        for it in o.get("items",[]):
            sales[it["product_id"]] = sales.get(it["product_id"],0) + int(it.get("qty",0))
    return sales

@api.post("/products/bulk-status")
async def products_bulk_status(body: Dict[str,Any], user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    ids = body.get("ids") or []
    status = body.get("status")
    if not ids or not status: raise HTTPException(400, "ids et status requis")
    await db.products.update_many({"id": {"$in": ids}}, {"$set": {"status": status, "updated_at": now_iso()}})
    return {"ok": True, "count": len(ids)}

@api.post("/products/bulk-promo")
async def products_bulk_promo(body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    ids = body.get("ids") or []
    pct = int(body.get("discount_pct", 0))
    if not ids or pct <= 0 or pct > 90: raise HTTPException(400, "ids et discount_pct (1-90) requis")
    for pid in ids:
        p = await db.products.find_one({"id": pid})
        if p:
            new_price = int(p.get("price",0) * (100-pct)/100)
            await db.products.update_one({"id": pid}, {"$set": {"price_old": p.get("price"), "price": new_price, "promo_pct": pct, "updated_at": now_iso()}})
    return {"ok": True, "count": len(ids)}

@api.get("/products/{pid}/history")

# ---------- Favorites (per customer) ----------
@api.get("/public/account/favorites")
async def account_favorites(c: dict = Depends(get_customer)):
    cust = await db.customers.find_one({"id": c["id"]})
    ids = (cust or {}).get("favorites") or []
    products = await db.products.find({"id": {"$in": ids}}).to_list(500)
    return clean(products)

@api.post("/public/account/favorites/toggle")
async def account_fav_toggle(body: Dict[str, Any], c: dict = Depends(get_customer)):
    pid = body.get("product_id")
    if not pid: raise HTTPException(400, "product_id requis")
    cust = await db.customers.find_one({"id": c["id"]})
    favs = set((cust or {}).get("favorites") or [])
    if pid in favs: favs.remove(pid); state = "removed"
    else: favs.add(pid); state = "added"
    await db.customers.update_one({"id": c["id"]}, {"$set": {"favorites": list(favs)}})
    return {"ok": True, "state": state, "favorites": list(favs)}

@api.post("/public/account/favorites/merge")
async def account_fav_merge(body: Dict[str, Any], c: dict = Depends(get_customer)):
    """Merge guest favorites (from localStorage) into the account on login."""
    guest_ids = body.get("product_ids") or []
    cust = await db.customers.find_one({"id": c["id"]})
    existing = set((cust or {}).get("favorites") or [])
    merged = list(existing | set(guest_ids))
    await db.customers.update_one({"id": c["id"]}, {"$set": {"favorites": merged}})
    return {"ok": True, "count": len(merged), "favorites": merged}

# ---------- Waitlist notify helper (auto on restock) ----------
async def _notify_waitlist(product_id: str, size: Optional[str] = None):
    f = {"product_id": product_id, "notified_at": None}
    if size: f["size"] = size
    rows = await db.waitlist.find(f).to_list(200)
    p = await db.products.find_one({"id": product_id})
    if not p: return
    link = f"https://chezdina.ci/boutique/product/{product_id}"
    for w in rows:
        phone = w.get("phone") or ""
        pd = "".join(c for c in phone if c.isdigit())
        if not pd: continue
        msg = f"Bonjour {w.get('name','')} 💕\nBonne nouvelle, le produit {p.get('name')} est de retour en stock{' (taille '+w['size']+')' if w.get('size') else ''} ! Commandez vite : {link}"
        await db.whatsapp_outbox.insert_one({
            "id": new_id(), "phone": phone, "phone_digits": pd,
            "message": msg, "link": f"https://wa.me/{pd}?text={_url_quote(msg)}",
            "kind": "waitlist_restock", "product_id": product_id,
            "sent": False, "created_at": now_iso(),
        })
        await db.waitlist.update_one({"id": w["id"]}, {"$set": {"notified_at": now_iso(), "notified_by": "auto-restock"}})
    return len(rows)

async def product_history(pid: str, user: dict = Depends(get_user)):
    """Return a product's sales timeline + stock movements + waitlist entries."""
    orders = await db.orders.find({"items.product_id": pid, "status":{"$ne":"annulee"}}).sort("created_at",-1).to_list(500)
    sales = []
    for o in orders:
        for it in o.get("items",[]):
            if it["product_id"] == pid:
                sales.append({"date": o["created_at"], "qty": it["qty"], "price": it["price"], "size": it.get("size"), "color": it.get("color"), "order_code": o.get("code")})
    waitlist = await db.waitlist.find({"product_id": pid}).sort("created_at",-1).to_list(100)
    return {"sales": sales[:200], "sales_total": sum(s["qty"] for s in sales), "sales_revenue": sum(s["qty"]*s["price"] for s in sales), "waitlist": clean(waitlist)}

@api.patch("/brands/{bid}")
async def update_brand(bid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("_id",None); body.pop("id",None)
    body["updated_at"] = now_iso()
    old = await db.brands.find_one({"id": bid})
    if not old: raise HTTPException(404, "Marque introuvable")
    if body.get("name") and old.get("name") and old["name"] != body["name"]:
        await db.products.update_many({"brand": old["name"]}, {"$set": {"brand": body["name"]}})
    await db.brands.update_one({"id": bid}, {"$set": body})
    return {"ok": True}




@api.get("/public/pages")
async def public_pages():
    rows = await db.cms_pages.find({"enabled": True}).to_list(50)
    if not rows:
        return DEFAULT_PAGES
    return clean(rows)

@api.get("/public/pages/{slug}")
async def public_page(slug: str):
    p = await db.cms_pages.find_one({"slug": slug})
    if not p:
        p = next((x for x in DEFAULT_PAGES if x["slug"] == slug), None)
        if not p: raise HTTPException(404)
    return clean(p)

@api.get("/pages")
async def list_pages(user: dict = Depends(get_user)):
    rows = await db.cms_pages.find({}).to_list(100)
    if not rows:
        for p in DEFAULT_PAGES:
            await db.cms_pages.insert_one({**p, "id": new_id(), "created_at": now_iso()})
        rows = await db.cms_pages.find({}).to_list(100)
    return clean(rows)

@api.post("/pages")
async def create_page(body: CmsPageIn, user: dict = Depends(require_role("admin","manager"))):
    doc = body.model_dump(); doc.update({"id": new_id(), "created_at": now_iso()})
    await db.cms_pages.insert_one(doc)
    return clean(doc)

@api.patch("/pages/{slug}")
async def update_page(slug: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("_id", None); body.pop("id", None)
    body["updated_at"] = now_iso()
    await db.cms_pages.update_one({"slug": slug}, {"$set": body}, upsert=True)
    return {"ok": True}

@api.delete("/pages/{slug}")
async def delete_page(slug: str, user: dict = Depends(require_role("admin"))):
    await db.cms_pages.delete_one({"slug": slug})
    return {"ok": True}

# ---------- Brands & Categories ----------
@api.get("/brands")
async def list_brands(user: dict = Depends(get_user)):
    # Derive from distinct product.brand + stored overrides
    distinct = await db.products.distinct("brand")
    stored = {b["name"]: b for b in await db.brands.find({}).to_list(200)}
    out = []
    for name in sorted(set(distinct) | set(stored.keys())):
        cnt = await db.products.count_documents({"brand": name})
        s = stored.get(name, {})
        out.append({"id": s.get("id") or new_id(), "name": name, "product_count": cnt, "note": s.get("note","")})
    return out

@api.post("/brands")
async def create_brand(body: SimpleNameIn, user: dict = Depends(require_role("admin","manager"))):
    doc = {"id": new_id(), "name": body.name, "note": body.note or "", "created_at": now_iso()}
    await db.brands.insert_one(doc)
    return clean(doc)

@api.delete("/brands/{bid}")
async def delete_brand(bid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.brands.delete_one({"id": bid})
    return {"ok": True}

@api.get("/categories")
async def list_categories(user: dict = Depends(get_user)):
    distinct = await db.products.distinct("category")
    stored = {c["name"]: c for c in await db.categories.find({}).to_list(200)}
    out = []
    for name in sorted(set(distinct) | set(stored.keys())):
        cnt = await db.products.count_documents({"category": name})
        s = stored.get(name, {})
        out.append({"id": s.get("id") or new_id(), "name": name, "product_count": cnt, "note": s.get("note","")})
    return out

@api.post("/categories")
async def create_category(body: SimpleNameIn, user: dict = Depends(require_role("admin","manager"))):
    doc = {"id": new_id(), "name": body.name, "note": body.note or "", "created_at": now_iso()}
    await db.categories.insert_one(doc)
    return clean(doc)

@api.delete("/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}

# ---------- Cash sessions (open/close) ----------
@api.get("/cash-sessions")
async def list_cash_sessions(user: dict = Depends(get_user)):
    rows = await db.cash_sessions.find({}).sort("opened_at", -1).to_list(50)
    return clean(rows)

@api.post("/cash-sessions/open")
async def open_cash_session(body: CashSessionOpenIn, user: dict = Depends(get_user)):
    exists = await db.cash_sessions.find_one({"closed": False})
    if exists: raise HTTPException(400, "Une session de caisse est déjà ouverte")
    doc = {"id": new_id(), "opened_at": now_iso(), "opened_by": user.get("name"),
           "opening_cash": float(body.opening_cash), "closed": False, "note": body.note or ""}
    await db.cash_sessions.insert_one(doc)
    return clean(doc)

@api.post("/cash-sessions/{sid}/close")
async def close_cash_session(sid: str, body: CashSessionCloseIn, user: dict = Depends(get_user)):
    approver = await db.users.find_one({"attendance_code": body.pin.strip(), "role": {"$in": ["admin","manager"]}, "active": True})
    if not approver: raise HTTPException(403, "PIN gérante invalide")
    s = await db.cash_sessions.find_one({"id": sid})
    if not s: raise HTTPException(404)
    # Compute cash in/out during session
    start = s["opened_at"]
    movements = await db.cash_movements.find({"created_at": {"$gte": start}}).to_list(500)
    ins = sum(m["amount"] for m in movements if m["type"] == "in")
    outs = sum(m["amount"] for m in movements if m["type"] == "out")
    cash_sales = sum(o.get("total",0) for o in await db.orders.find({
        "created_at": {"$gte": start},
        "payment_method": "cash",
        "status": {"$ne": "annulee"},
    }).to_list(2000))
    expected = s["opening_cash"] + cash_sales + ins - outs
    ecart = body.closing_cash - expected
    upd = {"closed": True, "closed_at": now_iso(), "closed_by": user.get("name"),
           "approved_by": approver.get("name"),
           "closing_cash": body.closing_cash, "cash_sales": cash_sales,
           "ins": ins, "outs": outs, "expected": expected, "ecart": ecart,
           "close_note": body.note or ""}
    await db.cash_sessions.update_one({"id": sid}, {"$set": upd})
    return {"ok": True, "summary": upd}

# ---------- Encaissements (par mode de paiement) ----------
@api.get("/encaissements")
async def encaissements(user: dict = Depends(get_user), days: int = 7):
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = await db.orders.find({"created_at": {"$gte": cutoff}, "status": {"$ne": "annulee"}}).to_list(3000)
    by_method: Dict[str, Dict[str, Any]] = {}
    daily: Dict[str, float] = {}
    for o in rows:
        m = o.get("payment_method", "cash")
        total = o.get("total", 0)
        by_method.setdefault(m, {"method": m, "count": 0, "total": 0})
        by_method[m]["count"] += 1; by_method[m]["total"] += total
        day = o.get("created_at", "")[:10]
        daily[day] = daily.get(day, 0) + total
    return {
        "by_method": list(by_method.values()),
        "daily": [{"date": d, "total": v} for d, v in sorted(daily.items())],
        "total": sum(x["total"] for x in by_method.values()),
        "count": sum(x["count"] for x in by_method.values()),
    }

# ---------- Compte de résultat ----------
@api.get("/profit-loss")
async def profit_loss(user: dict = Depends(get_user), days: int = 30):
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "status": {"$ne": "annulee"}}).to_list(5000)
    expenses = await db.expenses.find({"created_at": {"$gte": cutoff}}).to_list(1000)
    revenue = sum(o.get("total", 0) for o in orders)
    cogs = 0
    for o in orders:
        for it in o.get("items", []):
            p = await db.products.find_one({"id": it.get("product_id")})
            if p: cogs += it.get("qty", 0) * (p.get("cost", 0) or 0)
    gross_margin = revenue - cogs
    by_cat: Dict[str, float] = {}
    for e in expenses:
        c = e.get("category", "Autre")
        by_cat[c] = by_cat.get(c, 0) + e.get("amount", 0)
    total_expenses = sum(by_cat.values())
    net = gross_margin - total_expenses
    return {
        "period_days": days,
        "revenue": revenue, "cogs": cogs, "gross_margin": gross_margin,
        "gross_margin_pct": round(gross_margin / revenue * 100, 1) if revenue else 0,
        "expenses_total": total_expenses, "expenses_by_cat": [{"category": k, "amount": v} for k, v in sorted(by_cat.items(), key=lambda x: -x[1])],
        "net": net,
        "net_margin_pct": round(net / revenue * 100, 1) if revenue else 0,
    }

# ---------- Integrations (settings) ----------
@api.get("/integrations")
async def get_integrations(user: dict = Depends(require_role("admin","manager"))):
    s = await db.site_settings.find_one({"id": "main"}) or {}
    integ = s.get("integrations") or {}
    out = dict(integ)
    if out.get("whatsapp_meta_token"):
        out["whatsapp_meta_token"] = "****" + out["whatsapp_meta_token"][-4:]
    return out

@api.patch("/integrations")
async def update_integrations(body: IntegrationsIn, user: dict = Depends(require_role("admin","manager"))):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.site_settings.update_one(
        {"id": "main"},
        {"$set": {"id": "main", "integrations": data, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}

# ---------- Business settings ----------
@api.get("/business")
async def get_business(user: dict = Depends(get_user)):
    b = await db.business.find_one({"id":"main"})
    return clean(b or {"name":"Chez Dina","phone":"+225 07 77 92 61 79","address":"Cocody, Abidjan","tiktok":"@dinoush04","whatsapp":"2250777926179","currency":"XOF"})

@api.patch("/business")
async def update_business(body: Dict[str,Any], user: dict = Depends(require_role("admin"))):
    body.pop("_id",None)
    await db.business.update_one({"id":"main"}, {"$set":{**body,"id":"main","updated_at":now_iso()}}, upsert=True)
    return {"ok": True}

# ---------- Public storefront ----------
@api.get("/public/products")
async def public_products(q: Optional[str] = None, category: Optional[str] = None):
    f = {"visibility": {"$ne":"store"}}
    if q: f["name"] = {"$regex": q, "$options": "i"}
    if category and category != "all": f["category"] = category
    return clean(await db.products.find(f).to_list(500))

@api.get("/public/product/{pid}")
async def public_product(pid: str):
    p = await db.products.find_one({"id": pid})
    if not p: raise HTTPException(404)
    return clean(p)

@api.post("/public/orders")
async def public_create_order(body: OrderIn):
    sub = sum(it.qty * it.price for it in body.items)
    total = sub + body.delivery_fee - body.discount
    code = gen_code()
    doc = {"id": new_id(), "code": code, "items": [it.model_dump() for it in body.items],
           "customer": body.customer, "channel": body.channel or "boutique", "payment_method": body.payment_method,
           "delivery_zone": body.delivery_zone, "delivery_fee": body.delivery_fee, "discount": body.discount,
           "note": body.note, "mode": body.mode or "delivery", "store_id":"store-cocody",
           "subtotal": sub, "total": total, "status":"nouvelle", "payment_status":"en_attente",
           "created_at": now_iso(), "timeline":[{"status":"nouvelle","at":now_iso(),"by":"boutique en ligne"}]}
    for it in body.items:
        await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.qty}})
        if it.size:
            await db.products.update_one({"id": it.product_id}, {"$inc": {f"stock_by_size.{it.size}": -it.qty}})
    if body.customer and body.customer.get("id"):
        await db.customers.update_one({"id": body.customer["id"]}, {"$set":{"last_order_at": now_iso()}, "$inc":{"loyalty_points": int(total/500)}})
    await db.orders.insert_one(doc)
    return {"code": code, "id": doc["id"]}

@api.get("/public/order/{code}")
async def public_order_fetch(code: str):
    o = await db.orders.find_one({"code": code})
    if not o: raise HTTPException(404, "Introuvable")
    cust = o.get("customer") or {}
    return {
        "code": o.get("code"), "status": o.get("status"),
        "items": o.get("items", []),
        "customer": {"name": cust.get("name") if isinstance(cust, dict) else None},
        "rider_name": o.get("rider_name"),
        "delivered_at": o.get("delivered_at") or (o.get("created_at") if o.get("status")=="livree" else None),
    }

@api.post("/public/rate/{code}")
async def public_rate(code: str, body: Dict[str, Any]):
    o = await db.orders.find_one({"code": code})
    if not o: raise HTTPException(404, "Introuvable")
    rating = int(body.get("rating") or 0)
    rider_rating = int(body.get("rider_rating") or rating)
    comment = (body.get("comment") or "").strip()
    recommend = body.get("recommend")
    if not (1 <= rating <= 5): raise HTTPException(400, "Note invalide")
    cust = o.get("customer") or {}
    doc = {
        "id": new_id(), "order_id": o["id"], "order_code": code,
        "customer_name": cust.get("name") if isinstance(cust, dict) else None,
        "rating": rating, "rider_rating": rider_rating,
        "rider_id": o.get("rider_id"), "rider_name": o.get("rider_name"),
        "comment": comment, "recommend": recommend,
        "created_at": now_iso(),
    }
    await db.order_ratings.insert_one(doc)
    await db.orders.update_one({"id": o["id"]}, {"$set": {"rating": rating, "rider_rating": rider_rating, "rated_at": now_iso()}})
    return {"ok": True}

# ---------- Share receipt / cart ----------
@api.post("/share/order")
async def share_order(body: Dict[str,Any], user: dict = Depends(get_user)):
    oid = body.get("order_id")
    o = await db.orders.find_one({"id": oid})
    if not o: raise HTTPException(404)
    return {"link": f"/suivi/{o['code']}", "whatsapp_text": f"Bonjour {o.get('customer',{}).get('name','')}, voici votre reçu Chez Dina: {o['code']}"}

# ---------- AI Ask Dina ----------
async def _ai_tool_sales(period_days: int = 7) -> str:
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=period_days)).isoformat()
    prev_cutoff = (datetime.now(timezone.utc) - timedelta(days=period_days*2)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "status": {"$in":["livree","confirmee","prete","en_livraison"]}}).to_list(5000)
    prev = await db.orders.find({"created_at": {"$gte": prev_cutoff, "$lt": cutoff}, "status": {"$in":["livree","confirmee","prete","en_livraison"]}}).to_list(5000)
    rev = sum(o.get("total",0) for o in orders); prev_rev = sum(o.get("total",0) for o in prev)
    cnt = len(orders); prev_cnt = len(prev)
    pct = ((rev - prev_rev) / prev_rev * 100) if prev_rev else 0
    label = {1:"aujourd'hui",7:"cette semaine",30:"ce mois",90:"ce trimestre"}.get(period_days, f"ces {period_days} jours")
    return f"**CA {label}** : {rev:,.0f} FCFA sur {cnt} commandes. {('↗' if pct>=0 else '↘')} {pct:+.1f}% vs période précédente ({prev_rev:,.0f} FCFA, {prev_cnt} cmd).".replace(",", " ")

async def _ai_tool_top_products(period_days: int = 30, limit: int = 5) -> str:
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=period_days)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}}).to_list(5000)
    tops: Dict[str, Dict[str,float]] = {}
    for o in orders:
        for it in o.get("items",[]):
            key = it["name"]
            d = tops.setdefault(key, {"qty":0,"rev":0})
            d["qty"] += it.get("qty",0); d["rev"] += it.get("qty",0)*it.get("price",0)
    best = sorted(tops.items(), key=lambda x:-x[1]["rev"])[:limit]
    if not best: return "Aucune vente sur la période."
    lines = [f"**Top {limit} produits** ({period_days}j) :"] + [f"{i+1}. {n} — {int(d['qty'])} vendus · {d['rev']:,.0f} FCFA".replace(",", " ") for i,(n,d) in enumerate(best)]
    return "\n".join(lines)

async def _ai_tool_stock_alerts() -> str:
    low = await db.products.find({"stock": {"$lt": 5}}).sort("stock", 1).to_list(20)
    if not low: return "Aucune rupture ni stock bas détecté. ✓"
    lines = [f"**{len(low)} produits en stock faible**:"] + [f"• {p['name']} · {p['stock']} restant(s) · SKU {p.get('sku','?')}" for p in low[:10]]
    if len(low) > 10: lines.append(f"… et {len(low)-10} autres")
    return "\n".join(lines)

async def _ai_tool_inactive_customers(days: int = 30) -> str:
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    recent_orders = await db.orders.find({"created_at": {"$gte": cutoff}}).to_list(5000)
    active_ids = {o.get("customer",{}).get("id") for o in recent_orders if o.get("customer",{}).get("id")}
    all_customers = await db.customers.find({}).to_list(2000)
    inactive = [c for c in all_customers if c["id"] not in active_ids and c.get("total_spent",0) > 0]
    if not inactive: return "Aucune cliente inactive avec historique."
    inactive.sort(key=lambda c:-c.get("total_spent",0))
    lines = [f"**{len(inactive)} clientes inactives** (>{days}j sans commande) :"] + [f"• {c['name']} · {c.get('phone','')} · {c.get('total_spent',0):,.0f} FCFA cumulés".replace(",", " ") for c in inactive[:8]]
    return "\n".join(lines)

async def _ai_tool_rider_perf(period_days: int = 30) -> str:
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=period_days)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "rider_id": {"$exists": True, "$ne": None}}).to_list(5000)
    by_rider: Dict[str, Dict[str,int]] = {}
    for o in orders:
        rid = o.get("rider_id") or "unknown"
        d = by_rider.setdefault(rid, {"total":0,"livree":0,"annulee":0,"echouee":0,"name":o.get("rider_name","?")})
        d["total"] += 1
        d[o.get("status","")] = d.get(o.get("status",""),0) + 1
    if not by_rider: return "Aucune commande affectée à un livreur sur la période."
    rows = sorted(by_rider.items(), key=lambda x:-x[1].get("annulee",0))[:5]
    lines = ["**Performance des livreurs** (annulations décroissantes) :"]
    for rid, d in rows:
        rate = (d.get("annulee",0)/d["total"]*100) if d["total"] else 0
        lines.append(f"• {d['name']} · {d['total']} courses · ✓ {d.get('livree',0)} livrées · ✗ {d.get('annulee',0)} annulées ({rate:.0f}%)")
    return "\n".join(lines)

async def _ai_tool_daily_summary(user: dict) -> str:
    today = await _ai_tool_sales(1)
    week = await _ai_tool_sales(7)
    alerts = await _ai_tool_stock_alerts()
    return f"**Résumé — Chez Dina**\n\n{today}\n\n{week}\n\n{alerts}"

def _match_tool(q: str) -> Optional[str]:
    q = q.lower().strip()
    if any(w in q for w in ["résumé", "resume", "brief", "point du jour", "bilan"]): return "summary"
    if any(w in q for w in ["rupture", "stock bas", "stock faible", "va tomber", "ruptures"]): return "stock"
    if any(w in q for w in ["inactif", "inactive", "pas commandé", "n'a pas commandé", "clientes perdues", "win-back"]): return "inactive"
    if any(w in q for w in ["livreur", "livreurs"]) and any(w in q for w in ["annul", "performance", "classement"]): return "rider"
    if any(w in q for w in ["top", "meilleur", "best seller", "best-seller", "produits qui marchent", "rentable"]): return "top"
    if any(w in q for w in ["ca", "chiffre d'affaires", "chiffre affaires", "vente", "ventes"]): return "sales"
    return None

@api.post("/ai/ask")
async def ask_dina(body: AskIn, user: dict = Depends(get_user)):
    q = body.question
    # 1) Try structured tool call first (never invents numbers)
    tool = _match_tool(q)
    try:
        if tool == "sales":
            days = 30 if any(w in q.lower() for w in ["mois","30"]) else 7 if "semaine" in q.lower() else 1 if any(w in q.lower() for w in ["aujourd","jour"]) else 7
            return {"answer": await _ai_tool_sales(days), "source": "tool:sales"}
        if tool == "top": return {"answer": await _ai_tool_top_products(), "source": "tool:top_products"}
        if tool == "stock": return {"answer": await _ai_tool_stock_alerts(), "source": "tool:stock_alerts"}
        if tool == "inactive": return {"answer": await _ai_tool_inactive_customers(), "source": "tool:inactive_customers"}
        if tool == "rider": return {"answer": await _ai_tool_rider_perf(), "source": "tool:rider_perf"}
        if tool == "summary": return {"answer": await _ai_tool_daily_summary(user), "source": "tool:summary"}
    except Exception:
        logger.exception("AI tool")
    # 2) Fallback: LLM with real context
    products_cnt = await db.products.count_documents({})
    customers_cnt = await db.customers.count_documents({})
    recent = await db.orders.find({}).sort("created_at", -1).to_list(100)
    rev = sum(o.get("total",0) for o in recent)
    tops: Dict[str,int] = {}
    for o in recent:
        for it in o.get("items",[]): tops[it["name"]] = tops.get(it["name"],0) + it["qty"]
    best = sorted(tops.items(), key=lambda x:-x[1])[:5]
    ctx = f"Chez Dina (Abidjan). Produits: {products_cnt}. Clientes: {customers_cnt}. CA récent (100 cmd): {rev:,} FCFA. Top: {', '.join(f'{n} ({q})' for n,q in best)}."
    page_ctx = f" Page actuelle : {body.page}." if getattr(body, 'page', None) else ""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY",""), session_id=f"dina-{user['id']}", system_message=f"Tu es 'Dina IA', l'assistante de Chez Dina à Abidjan. Réponds TOUJOURS en français, bref, chiffré, actionnable. Jamais d'erreur technique brute.{page_ctx} Données: {ctx}").with_model("anthropic","claude-sonnet-4-5-20250929")
        reply = await chat.send_message(UserMessage(text=q))
        return {"answer": str(reply), "source": "llm"}
    except Exception:
        logger.exception("AI")
        return {"answer": f"Je n'arrive pas à récupérer la réponse IA pour le moment. Voici un résumé local : CA récent ≈ {rev:,} FCFA, top produits : {', '.join(n for n,_ in best) or '—'}. Réessayez dans un instant.".replace(",", " "), "error": True, "source": "fallback"}

# ---------- Seed ----------
IVORIAN = ["Aminata Koné","Fatou Traoré","Mariam Diallo","Awa Ouattara","Rokia Bamba","Sarah Yao","Christelle Brou","Nadège Kouassi","Fatim Cissé","Hawa Touré","Grace N'Guessan","Linda Zoro","Priscille Konan","Chantal Adou","Mireille Gnamien","Audrey Diomandé","Esther Soro","Céline Kouadio","Rachel Toto","Diane Assi","Mélanie Boni","Judith Kipré","Léa Yapo","Olivia Konate","Carine Bakayoko"]
CATEGORIES = ["Chaussures","Robes","Hauts","Jupes","Pantalons","Ensembles","Sacs","Accessoires"]
BRANDS = ["Dina Signature","Zara","Mango","Shein","H&M","Ivoire Chic","Afrik Luxe","Elegance CI"]
COLORS = ["Noir","Blanc","Rouge","Beige","Doré","Marine","Rose poudré","Camel","Vert émeraude"]
SHOE_SIZES = ["36","37","38","39","40","41","42"]
CLOTH_SIZES = ["XS","S","M","L","XL","XXL"]
ZONES = [("Cocody",1500),("Riviera",2000),("Angré",2000),("Plateau",1000),("Marcory",1500),("Zone 4",1500),("Treichville",1500),("Koumassi",2000),("Yopougon",2500),("Abobo",3000),("Adjamé",1500),("Port-Bouët",2500),("Bingerville",3000),("Songon",3500),("Grand-Bassam",5000)]
IMG_POOL = {
  "Chaussures": ["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800","https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=800","https://images.unsplash.com/photo-1596703263926-eb0762ee17e4?w=800","https://images.unsplash.com/photo-1573100925118-870b8efc799c?w=800","https://images.unsplash.com/photo-1562183241-b937e95585b6?w=800","https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800","https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800","https://images.unsplash.com/photo-1631985561086-91ca9b4b65f3?w=800"],
  "Robes": ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800","https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=800","https://images.unsplash.com/photo-1583846783214-7229a91b20ed?w=800","https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800","https://images.unsplash.com/photo-1551803091-e20673f15770?w=800","https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800","https://images.unsplash.com/photo-1623609163859-ca93c959b98a?w=800","https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800"],
  "Hauts": ["https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800","https://images.unsplash.com/photo-1554568218-0f1715e72254?w=800","https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=800","https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=800","https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=800","https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800"],
  "Jupes": ["https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800","https://images.unsplash.com/photo-1577900232427-18219b9166a0?w=800","https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800","https://images.unsplash.com/photo-1551163943-3f6a855d1153?w=800","https://images.unsplash.com/photo-1548624313-0396c75f8dca?w=800"],
  "Pantalons": ["https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=800","https://images.unsplash.com/photo-1548883354-94bcfe321cbb?w=800","https://images.unsplash.com/photo-1594938328870-9623159c8c99?w=800","https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800","https://images.unsplash.com/photo-1552902019-ebcd97aa9aa0?w=800"],
  "Ensembles": ["https://images.unsplash.com/photo-1764265149928-9b29e483fe8d?w=800","https://images.unsplash.com/photo-1709809081557-78f803ce93a0?w=800","https://images.unsplash.com/photo-1613968988915-1309a52d8e8e?w=800","https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=800","https://images.unsplash.com/photo-1583846112692-5a7bdcedc67d?w=800"],
  "Sacs": ["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800","https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800","https://images.unsplash.com/photo-1591561954555-607968c989ab?w=800","https://images.unsplash.com/photo-1559563458-527698bf5295?w=800","https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?w=800","https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800"],
  "Accessoires": ["https://images.unsplash.com/photo-1611923134239-b9be5bfe39e7?w=800","https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800","https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800","https://images.unsplash.com/photo-1620625515032-6ed0c1790c75?w=800","https://images.unsplash.com/photo-1573551565102-52d7bdd4e5cf?w=800"],
}

async def seed_if_empty():
    # Users
    if await db.users.count_documents({}) == 0:
        base = [
            ("aouattaraesca@gmail.com","Admin123!","1234","Aïcha Ouattara","admin"),
            ("manager.cocody@dinastore.ci","Manager123!","2222","Fatou Konaté","manager"),
            ("agent1@dinastore.ci","Agent123!","3333","Grace N'Guessan","sales"),
            ("stock@dinastore.ci","Stock123!","4444","Jean-Marc Soro","stock_keeper"),
            ("rider1@dinastore.ci","Rider123!","5555","Kouamé Serge","rider"),
            ("rider2@dinastore.ci","Rider123!","5556","Yao Franck","rider"),
            ("rider3@dinastore.ci","Rider123!","5557","Diomandé Issouf","rider"),
        ]
        docs = []
        for email, pw, pin, name, role in base:
            docs.append({"id": new_id(), "email": email, "password_hash": hash_pw(pw), "pin_hash": hash_pw(pin), "attendance_code": pin, "name": name, "role": role,
                         "phone": f"+225 07 {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}",
                         "store_id":"store-cocody", "active": True, "created_at": now_iso()})
        await db.users.insert_many(docs)
    # Stores
    if await db.stores.count_documents({}) == 0:
        await db.stores.insert_one({"id":"store-cocody","name":"Chez Dina Cocody","address":"Cocody Angré 7e Tranche","phone":"+225 07 77 92 61 79","main":True,"created_at":now_iso()})
    # Zones
    if await db.zones.count_documents({}) == 0:
        await db.zones.insert_many([{"id": new_id(), "name": n, "fee": f, "created_at": now_iso()} for n,f in ZONES])
    # Business
    if await db.business.count_documents({}) == 0:
        await db.business.insert_one({"id":"main","name":"Chez Dina","phone":"+225 07 77 92 61 79","address":"Cocody Angré 7e, Abidjan","tiktok":"@dinoush04","whatsapp":"2250777926179","currency":"XOF","created_at":now_iso()})
    # Products
    if await db.products.count_documents({}) == 0:
        products = []
        for i in range(120):
            cat = random.choice(CATEGORIES)
            sizes = SHOE_SIZES if cat == "Chaussures" else (CLOTH_SIZES if cat in ("Robes","Hauts","Jupes","Pantalons","Ensembles") else [])
            price = random.choice([5000,7500,9500,12500,15000,18500,22000,27500,32500,38000,45000,55000,65000,75000,85000])
            cost = int(price * random.uniform(0.4,0.65))
            ps = random.sample(sizes, min(len(sizes), random.randint(3,6))) if sizes else []
            pc = random.sample(COLORS, random.randint(2,4))
            sbs = {s: random.randint(0,8) for s in ps} if ps else {}
            total_stk = sum(sbs.values()) if sbs else random.randint(5,30)
            products.append({"id": new_id(), "name": f"{cat} {random.choice(['Lagune','Baobab','Riviera','Palm','Akwaba','Doumbé','Zenith','Soleil','Harmattan'])} {random.randint(1,99)}",
                             "category": cat, "brand": random.choice(BRANDS), "price": price, "cost": cost,
                             "description": f"Pièce {cat.lower()} tendance. Matière premium.",
                             "image": random.choice(IMG_POOL[cat]), "images": random.sample(IMG_POOL[cat], min(len(IMG_POOL[cat]), random.randint(3,5))),
                             "sizes": ps, "colors": pc, "stock_by_size": sbs, "stock": total_stk,
                             "store_id":"store-cocody", "visibility":"both",
                             "sku": f"DN-{10000+i}", "barcode": f"590{random.randint(1000000000,9999999999)}",
                             "rating_avg": 0, "rating_count": 0, "created_at": now_iso()})
        await db.products.insert_many(products)
    # Customers
    if await db.customers.count_documents({}) == 0:
        custs = []
        for i, n in enumerate((IVORIAN * 12)[:300]):
            dayago = random.randint(0, 180)
            last_order = (datetime.now(timezone.utc) - timedelta(days=random.randint(1, dayago+1))).isoformat() if random.random() > 0.3 else None
            custs.append({"id": new_id(), "name": n,
                          "phone": f"+225 07 {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}",
                          "email": f"{n.split()[0].lower()}{i}@gmail.com" if random.random() > 0.5 else None,
                          "shoe_size": random.choice(SHOE_SIZES), "clothing_size": random.choice(CLOTH_SIZES),
                          "wallet": random.choice([0,0,0,2500,5000,10000]), "loyalty_points": random.randint(0,1500),
                          "tier": random.choice(["Bronze","Bronze","Bronze","Silver","Silver","Gold"]),
                          "referral_code": f"DINA-{1000+i}", "status":"active",
                          "access_code": str(100000 + i),
                          "last_order_at": last_order,
                          "created_at": (datetime.now(timezone.utc) - timedelta(days=dayago)).isoformat()})
        await db.customers.insert_many(custs)
    # Suppliers
    if await db.suppliers.count_documents({}) == 0:
        await db.suppliers.insert_many([
            {"id":new_id(),"name":"Istanbul Fashion Hub","country":"TR","phone":"+90 212 555 11 22","balance":0,"created_at":now_iso()},
            {"id":new_id(),"name":"Guangzhou Textile","country":"CN","phone":"+86 20 1234 5678","balance":450000,"created_at":now_iso()},
            {"id":new_id(),"name":"Dubai Luxe Trading","country":"AE","phone":"+971 4 234 5678","balance":0,"created_at":now_iso()},
            {"id":new_id(),"name":"Afrik Textiles Abidjan","country":"CI","phone":"+225 27 22 00 11 22","balance":120000,"created_at":now_iso()},
        ])
    # Promotions
    if await db.promotions.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        await db.promotions.insert_many([
            {"id":new_id(),"code":"BIENVENUE10","type":"percent","value":10,"active":True,"uses":45,"starts_at":(now-timedelta(days=90)).isoformat(),"ends_at":(now+timedelta(days=180)).isoformat(),"channel":"all","flash":False,"min_order":0,"usage_limit":0,"created_at":now_iso()},
            {"id":new_id(),"code":"FLASH20","type":"percent","value":20,"active":True,"uses":12,"starts_at":now.isoformat(),"ends_at":(now+timedelta(days=3)).isoformat(),"channel":"boutique","flash":True,"min_order":15000,"usage_limit":100,"created_at":now_iso()},
            {"id":new_id(),"code":"LIVRAISON","type":"free_delivery","value":0,"active":True,"uses":78,"starts_at":(now-timedelta(days=30)).isoformat(),"ends_at":(now+timedelta(days=60)).isoformat(),"channel":"all","flash":False,"min_order":25000,"usage_limit":0,"created_at":now_iso()},
        ])
    # Expenses
    if await db.expenses.count_documents({}) == 0:
        cats = ["Loyer","CIE","SODECI","Internet","Salaires","Carburant livreurs","Emballage","Publicité"]
        exps = []
        for m in range(6):
            for c in cats:
                exps.append({"id": new_id(), "category": c,
                             "amount": random.choice([25000,45000,75000,120000,250000,350000,500000]) if c in ("Loyer","Salaires") else random.choice([5000,15000,25000,45000,65000]),
                             "note": f"{c} - mois M-{m}", "store_id":"store-cocody", "payment_method":"cash",
                             "created_at": (datetime.now(timezone.utc)-timedelta(days=30*m+random.randint(0,25))).isoformat(),
                             "created_by":"Aïcha Ouattara"})
        await db.expenses.insert_many(exps)
    # Orders
    if await db.orders.count_documents({}) == 0:
        prods = await db.products.find({}).to_list(500)
        custs = await db.customers.find({}).to_list(500)
        users = await db.users.find({"role":{"$in":["sales","manager","admin"]}}).to_list(50)
        riders = await db.users.find({"role":"rider"}).to_list(50)
        orders = []
        for i in range(300):
            items = []
            for _ in range(random.randint(1,4)):
                p = random.choice(prods)
                items.append({"product_id":p["id"],"name":p["name"],"size":random.choice(p.get("sizes") or [None]),"color":random.choice(p.get("colors") or [None]),"qty":random.randint(1,2),"price":p["price"],"image":p.get("image")})
            sub = sum(it["qty"]*it["price"] for it in items)
            channel = random.choice(["store","boutique","whatsapp","instagram","manual","tiktok"])
            mode = random.choice(["store","delivery","delivery","pickup"])
            z = random.choice(ZONES) if mode == "delivery" else None
            fee = z[1] if z else 0
            disc = random.choice([0,0,0,500,1000])
            total = sub + fee - disc
            c = random.choice(custs)
            status_pool = ["livree","livree","livree","livree","en_livraison","prete","nouvelle","confirmee","retournee","assignee","annulee","echouee"]
            st = "livree" if mode == "store" else random.choice(status_pool)
            created = (datetime.now(timezone.utc) - timedelta(days=random.randint(0,180), hours=random.randint(0,23))).isoformat()
            r = random.choice(riders) if mode == "delivery" and st in ("assignee","en_livraison","livree","echouee","annulee") else None
            orders.append({"id": new_id(), "code": f"DN-{created[2:4]}{created[5:7]}{created[8:10]}-{1000+i}",
                           "items": items, "customer": {"id":c["id"],"name":c["name"],"phone":c["phone"]},
                           "channel": channel, "payment_method": random.choice(["cash","wave","cod","cash"]),
                           "delivery_zone": z[0] if z else None, "delivery_fee": fee, "discount": disc, "note":"",
                           "mode": mode, "store_id":"store-cocody",
                           "subtotal": sub, "total": total, "status": st,
                           "payment_status":"paye" if st=="livree" else random.choice(["en_attente","paye"]),
                           "created_at": created, "created_by": random.choice(users)["name"] if users else "système",
                           "rider_id": r["id"] if r else None, "rider_name": r["name"] if r else None,
                           "timeline":[{"status":"nouvelle","at":created,"by":"système"}]})
        await db.orders.insert_many(orders)
    # Reviews (approved)
    if await db.reviews.count_documents({}) == 0:
        prods = await db.products.find({}).limit(60).to_list(60)
        revs = []
        for p in prods:
            for _ in range(random.randint(0,4)):
                revs.append({"id": new_id(), "product_id": p["id"], "rating": random.randint(3,5),
                             "comment": random.choice(["Super qualité, livré rapidement !","Parfaite, j'adore.","Taille un peu petit sinon top","Ça m'a plu, merci Dina !","Belle finition, à recommander","Conforme à la photo"]),
                             "customer_name": random.choice(IVORIAN).split()[0], "status":"approved",
                             "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1,120))).isoformat()})
        if revs:
            await db.reviews.insert_many(revs)
            # Update products
            for p in prods:
                rs = [r for r in revs if r["product_id"] == p["id"]]
                if rs:
                    avg = round(sum(r["rating"] for r in rs)/len(rs), 1)
                    await db.products.update_one({"id": p["id"]}, {"$set": {"rating_avg": avg, "rating_count": len(rs)}})
    # Abandoned carts
    if await db.abandoned_carts.count_documents({}) == 0:
        prods = await db.products.find({}).limit(10).to_list(10)
        for i in range(6):
            await db.abandoned_carts.insert_one({"id": new_id(), "customer_name": random.choice(IVORIAN), "customer_phone": f"+225 07 {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}", "items":[{"name": random.choice(prods)["name"], "qty": 1}], "value": random.choice([15000,25000,45000]), "recovered": False, "created_at":(datetime.now(timezone.utc)-timedelta(hours=random.randint(2,48))).isoformat()})

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.orders.create_index("code")
    await db.products.create_index("sku")
    await seed_if_empty()
    logger.info("Dina API ready")

@api.post("/seed")
async def reseed(force: bool = False, user: dict = Depends(require_role("admin"))):
    if force:
        for coll in ["products","orders","reviews","customers","promotions","expenses","delivery_sessions","abandoned_carts","stock_alerts","zones","suppliers","purchase_orders","invoices","attendance","business","site_settings","stores","users"]:
            await db[coll].delete_many({})
    await seed_if_empty()
    return {"ok": True}

@api.get("/")
async def root(): return {"name":"Chez Dina API","v":"2.0"}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["*"])

@app.on_event("shutdown")
async def shutdown(): client.close()
