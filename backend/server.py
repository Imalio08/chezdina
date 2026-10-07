from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os, logging, uuid, random, secrets, time
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
    # Real variants grid: list of {size, color, stock, enabled, price?} — only existing combos
    variants: List[Dict[str, Any]] = []
    # Videos (up to 2, MP4/MOV ≤ 60s ≤ 50MB) — base64 data URL or external URL
    videos: List[str] = []
    video_posters: List[str] = []
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
    label: str = ""
    type: str = "variable"  # "fixe" | "variable"
    paid_at: Optional[str] = None  # ISO date string
    receipt: Optional[str] = None  # base64 data URL (image/pdf)
    supplier: Optional[str] = None
class ExpenseCategoryIn(BaseModel):
    name: str
    type: str = "variable"  # "fixe" | "variable"
class SupplierIn(BaseModel):
    name: str
    trade_name: Optional[str] = None
    country: str = "CI"
    city: Optional[str] = None
    address: Optional[str] = None
    phone: str = ""
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo: Optional[str] = None
    manager_name: Optional[str] = None
    manager_role: Optional[str] = None
    manager_phone: Optional[str] = None
    manager_whatsapp: Optional[str] = None
    payment_terms: Optional[str] = None
    lead_time_days: int = 0
    categories: Optional[List[str]] = None
    documents: Optional[List[Dict[str, Any]]] = None
    balance: int = 0
    notes: str = ""
    status: str = "active"
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
    # Scope — which products the promo applies to
    scope: str = "all"  # all | products | category
    products: List[str] = []  # product_ids when scope=products OR for bogo/x_for_y target products
    category: Optional[str] = None  # when scope=category
    buy_qty: int = 2  # for bogo / x_for_y
    get_qty: int = 1
    get_discount_pct: int = 100  # 100 = free
class ZoneIn(BaseModel): name: str; fee: int
class ReviewIn(BaseModel):
    product_id: str; rating: int; comment: str = ""
    customer_name: str = "Cliente"; customer_phone: Optional[str] = None
class ReviewModerationIn(BaseModel):
    status: str
    reply: Optional[str] = None
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
    # Code format: prefix + random part length (default DINA-XXXX)
    referral_code_prefix: str = "DINA"
    referral_code_length: int = 4
    referral_validity_days: int = 90  # how long the referral reward stays valid
class ReferralApplyIn(BaseModel):
    code: str          # parrain's referral_code
    customer_id: str   # filleul (new customer)
class RolesPermissionsIn(BaseModel):
    matrix: Dict[str, Dict[str, bool]]  # {role: {permission_key: true/false}}
class AttendancePunchIn(BaseModel):
    code: str
    kind: str = "in"  # in | out
    selfie: Optional[str] = None  # base64 data URL, captured on kiosk tablet
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

@api.get("/customers/top")
async def customers_top(user: dict = Depends(get_user), limit: int = 20):
    """Top customers ranking by total_spent + loyalty_points. Public-friendly fields only."""
    rows = await db.customers.find({"status": {"$ne": "blacklist"}}, {"password_hash": 0}).to_list(5000)
    for r in rows:
        r["rank_score"] = (r.get("total_spent", 0) or 0) + (r.get("loyalty_points", 0) or 0) * 10
    rows.sort(key=lambda x: -x.get("rank_score", 0))
    top = []
    for i, r in enumerate(rows[:limit]):
        top.append({
            "rank": i + 1, "id": r.get("id"), "name": r.get("name"), "phone": r.get("phone"),
            "tier": r.get("tier"), "loyalty_points": r.get("loyalty_points", 0),
            "total_spent": r.get("total_spent", 0), "orders_count": r.get("orders_count", 0),
        })
    return top

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

# ---------- Pack 6: Customer access-code regeneration + first-login change ----------
@api.post("/customers/{cid}/regen-access-code")
async def regen_access_code(cid: str, user: dict = Depends(require_role("admin","manager"))):
    code = gen_access_code()
    await db.customers.update_one({"id": cid}, {"$set": {"access_code": code, "access_code_must_change": True, "access_code_generated_at": now_iso()}})
    c = await db.customers.find_one({"id": cid}, {"password_hash": 0})
    return {"ok": True, "access_code": code, "phone": c.get("phone"), "name": c.get("name")}

@api.post("/public/account/change-code")
async def change_code(body: Dict[str, Any], c: dict = Depends(get_customer)):
    old = (body.get("old_code") or "").strip()
    new = (body.get("new_code") or "").strip()
    if old and (c.get("access_code") or "").strip() != old:
        raise HTTPException(400, "Code actuel incorrect")
    if len(new) != 6 or not new.isdigit(): raise HTTPException(400, "Code à 6 chiffres requis")
    if new in ("123456","000000","111111","222222","333333","444444","555555","666666","777777","888888","999999","121212"):
        raise HTTPException(400, "Code trop simple")
    await db.customers.update_one({"id": c["id"]}, {"$set": {"access_code": new, "access_code_must_change": False, "access_code_changed_at": now_iso()}})
    return {"ok": True}

# ---------- Pack 8 Wave B: Customer account enrichment ----------
@api.post("/public/account/photo")
async def account_upload_photo(body: Dict[str,Any], c: dict = Depends(get_customer)):
    photo = body.get("photo")
    if not photo or not isinstance(photo, str): raise HTTPException(400, "photo (base64) requise")
    await db.customers.update_one({"id": c["id"]}, {"$set": {"photo": photo, "photo_updated_at": now_iso()}})
    return {"ok": True, "photo": photo}

@api.patch("/public/account/update")
async def account_update(body: Dict[str,Any], c: dict = Depends(get_customer)):
    allowed = {"name","email","birthday","shoe_size","clothing_size","notes","preferences","communication_prefs"}
    patch = {k: v for k,v in body.items() if k in allowed}
    if not patch: raise HTTPException(400, "Aucun champ")
    await db.customers.update_one({"id": c["id"]}, {"$set": patch})
    cust = await db.customers.find_one({"id": c["id"]}, {"password_hash": 0})
    return clean(cust)

@api.get("/public/account/addresses")
async def account_addresses_list(c: dict = Depends(get_customer)):
    cust = await db.customers.find_one({"id": c["id"]}) or {}
    return cust.get("addresses") or []

@api.post("/public/account/addresses")
async def account_addresses_add(body: Dict[str,Any], c: dict = Depends(get_customer)):
    cust = await db.customers.find_one({"id": c["id"]}) or {}
    addrs = cust.get("addresses") or []
    body["id"] = new_id(); body["created_at"] = now_iso()
    if body.get("default") or not addrs:
        for a in addrs: a["default"] = False
        body["default"] = True
    addrs.append(body)
    await db.customers.update_one({"id": c["id"]}, {"$set": {"addresses": addrs}})
    return {"ok": True, "addresses": addrs}

@api.patch("/public/account/addresses/{aid}")
async def account_addresses_update(aid: str, body: Dict[str,Any], c: dict = Depends(get_customer)):
    cust = await db.customers.find_one({"id": c["id"]}) or {}
    addrs = cust.get("addresses") or []
    for a in addrs:
        if a.get("id") == aid: a.update(body)
    if body.get("default"):
        for a in addrs: a["default"] = (a.get("id") == aid)
    await db.customers.update_one({"id": c["id"]}, {"$set": {"addresses": addrs}})
    return {"ok": True, "addresses": addrs}

@api.delete("/public/account/addresses/{aid}")
async def account_addresses_delete(aid: str, c: dict = Depends(get_customer)):
    cust = await db.customers.find_one({"id": c["id"]}) or {}
    addrs = [a for a in (cust.get("addresses") or []) if a.get("id") != aid]
    await db.customers.update_one({"id": c["id"]}, {"$set": {"addresses": addrs}})
    return {"ok": True, "addresses": addrs}

_IN_PROGRESS_STATUSES = ("nouvelle","confirmee","assignee","en_preparation","en_livraison","reportee")
_CANCELLED_STATUSES = ("annulee","retournee","refusee")

@api.get("/public/account/orders-split")
async def account_orders_split(c: dict = Depends(get_customer)):
    orders = await db.orders.find({"customer.id": c["id"]}).sort("created_at", -1).to_list(300)
    in_progress = [o for o in orders if o.get("status") in _IN_PROGRESS_STATUSES]
    delivered = [o for o in orders if o.get("status") == "livree"]
    cancelled = [o for o in orders if o.get("status") in _CANCELLED_STATUSES]
    return {
        "in_progress": clean(in_progress),
        "delivered": clean(delivered),
        "cancelled": clean(cancelled),
        "counts": {"in_progress": len(in_progress), "delivered": len(delivered), "cancelled": len(cancelled)},
    }

@api.get("/public/account/order/{code}")
async def account_order_detail(code: str, c: dict = Depends(get_customer)):
    o = await db.orders.find_one({"code": code, "customer.id": c["id"]})
    if not o: raise HTTPException(404, "Commande introuvable")
    rider = None
    if o.get("rider_id"):
        r = await db.users.find_one({"id": o.get("rider_id")}, {"password_hash":0, "pin_hash":0})
        if r:
            rider = {"id": r["id"], "name": r.get("name"), "first_name": (r.get("name") or "").split()[0],
                     "phone": r.get("phone"), "whatsapp": r.get("whatsapp") or r.get("phone"), "photo": r.get("photo")}
    return {"order": clean(o), "rider": rider}

@api.get("/public/account/recently-viewed")
async def account_recently_viewed(c: dict = Depends(get_customer), limit: int = 20):
    cust = await db.customers.find_one({"id": c["id"]}) or {}
    ids = [x["product_id"] for x in (cust.get("recently_viewed") or [])][:limit]
    if not ids: return []
    prods = await db.products.find({"id": {"$in": ids}}).to_list(len(ids))
    pmap = {p["id"]: p for p in prods}
    return clean([pmap[i] for i in ids if i in pmap])

@api.post("/public/account/recently-viewed")
async def account_recently_viewed_track(body: Dict[str,Any], c: dict = Depends(get_customer)):
    pid = body.get("product_id")
    if not pid: raise HTTPException(400, "product_id requis")
    cust = await db.customers.find_one({"id": c["id"]}) or {}
    recent = [x for x in (cust.get("recently_viewed") or []) if x.get("product_id") != pid]
    recent.insert(0, {"product_id": pid, "at": now_iso()})
    await db.customers.update_one({"id": c["id"]}, {"$set": {"recently_viewed": recent[:30]}})
    return {"ok": True}

@api.get("/public/account/reviews-pending")
async def account_reviews_pending(c: dict = Depends(get_customer)):
    orders = await db.orders.find({"customer.id": c["id"], "status": "livree"}).to_list(500)
    rated_pids = set()
    for r in await db.order_ratings.find({"customer_id": c["id"]}).to_list(500):
        for pid in (r.get("product_ids") or []): rated_pids.add(pid)
    pending = []
    seen = set()
    for o in orders:
        for it in o.get("items", []):
            pid = it.get("product_id")
            if pid and pid not in rated_pids and pid not in seen:
                seen.add(pid)
                pending.append({"product_id": pid, "name": it.get("name"), "image": it.get("image"),
                                "order_code": o.get("code"), "delivered_at": o.get("delivered_at") or o.get("created_at")})
    return pending[:50]

@api.post("/public/account/reviews")
async def account_submit_review(body: Dict[str,Any], c: dict = Depends(get_customer)):
    pid = body.get("product_id")
    rating = int(body.get("rating") or 0)
    comment = (body.get("comment") or "").strip()
    if not pid or not (1 <= rating <= 5): raise HTTPException(400, "Produit et note (1-5) requis")
    doc = {"id": new_id(), "product_id": pid, "customer_id": c["id"],
           "customer_name": c.get("name"), "rating": rating, "comment": comment,
           "approved": True, "hidden": False, "created_at": now_iso()}
    await db.reviews.insert_one(doc)
    # Update product rating
    rs = await db.reviews.find({"product_id": pid, "hidden": {"$ne": True}}).to_list(500)
    if rs:
        avg = sum(x["rating"] for x in rs) / len(rs)
        await db.products.update_one({"id": pid}, {"$set": {"rating_avg": round(avg,1), "rating_count": len(rs)}})
    await db.order_ratings.insert_one({"id": new_id(), "customer_id": c["id"],
                                       "product_ids": [pid], "rating": rating, "created_at": now_iso()})
    return {"ok": True}

@api.get("/public/account/vouchers")
async def account_vouchers(c: dict = Depends(get_customer)):
    rows = await db.vouchers.find({"customer_id": c["id"]}).sort("created_at", -1).to_list(100)
    return clean(rows)

# ---------- Rider live position (Wave B) ----------
@api.post("/rider/position")
async def rider_position(body: Dict[str,Any], user: dict = Depends(get_user)):
    if user.get("role") != "rider": raise HTTPException(403, "Livreur seulement")
    lat = body.get("lat"); lng = body.get("lng")
    if lat is None or lng is None: raise HTTPException(400, "lat/lng requis")
    doc = {"rider_id": user["id"], "rider_name": user.get("name"), "lat": float(lat), "lng": float(lng),
           "heading": body.get("heading"), "speed": body.get("speed"),
           "at": now_iso(), "order_id": body.get("order_id")}
    await db.rider_positions.update_one({"rider_id": user["id"]}, {"$set": doc}, upsert=True)
    return {"ok": True}

# Simple simulator cache
_SIM_POS: Dict[str, Dict[str,Any]] = {}

def _interp(a: float, b: float, t: float) -> float: return a + (b - a) * t

async def _simulated_rider_position(order: Dict[str,Any]) -> Optional[Dict[str,Any]]:
    """Compute a plausible rider position based on order age and delivery zone."""
    oid = order.get("id")
    # Start point: store Cocody
    start = (5.3765, -3.9915)
    # End point: zone centroids (fallback near Cocody)
    zone_centers = {"Cocody": (5.3600, -3.9800), "Yopougon": (5.3450, -4.0850),
                    "Plateau": (5.3200, -4.0190), "Treichville": (5.2900, -4.0160),
                    "Marcory": (5.3010, -3.9800), "Riviera": (5.3760, -3.9430),
                    "Angré": (5.4040, -3.9540), "Abobo": (5.4300, -4.0100),
                    "Adjamé": (5.3540, -4.0210), "Attécoubé": (5.3300, -4.0530)}
    end = None
    z = order.get("delivery_zone") or ""
    for k, v in zone_centers.items():
        if k.lower() in z.lower(): end = v; break
    if not end:
        end = (start[0] + 0.012, start[1] - 0.008)
    # Progress: based on time since en_livraison, 0..1 over ~15 minutes.
    # Fallback: use order.updated_at or created_at if the timeline event is missing.
    tl = order.get("timeline") or []
    enl = next((t for t in reversed(tl) if t.get("status") == "en_livraison"), None)
    start_iso = (enl or {}).get("at") or order.get("updated_at") or order.get("created_at")
    if not start_iso: return None
    try:
        start_at = datetime.fromisoformat(start_iso.replace("Z","+00:00"))
    except Exception:
        return None
    elapsed = (datetime.now(timezone.utc) - start_at).total_seconds()
    t = max(0.05, min(0.95, elapsed / (15 * 60)))
    return {"lat": _interp(start[0], end[0], t), "lng": _interp(start[1], end[1], t),
            "simulated": True, "progress": round(t * 100), "at": now_iso()}

@api.get("/public/order/{code}/rider-position")
async def public_rider_position(code: str):
    o = await db.orders.find_one({"code": code})
    if not o: raise HTTPException(404)
    if o.get("status") != "en_livraison":
        return {"active": False, "status": o.get("status")}
    pos = None
    if o.get("rider_id"):
        p = await db.rider_positions.find_one({"rider_id": o["rider_id"]})
        if p:
            try:
                age = (datetime.now(timezone.utc) - datetime.fromisoformat(p["at"].replace("Z","+00:00"))).total_seconds()
            except Exception:
                age = 999
            if age < 60:
                pos = {"lat": p["lat"], "lng": p["lng"], "simulated": False, "at": p.get("at")}
    if not pos:
        pos = await _simulated_rider_position(o)
    if not pos:
        return {"active": True, "position": None}
    rider = None
    if o.get("rider_id"):
        r = await db.users.find_one({"id": o.get("rider_id")}, {"password_hash":0,"pin_hash":0})
        if r:
            rider = {"id": r["id"], "name": r.get("name"), "first_name": (r.get("name") or "").split()[0],
                     "phone": r.get("phone"), "photo": r.get("photo")}
    # ETA: simple remaining %
    eta_min = max(1, round((100 - pos.get("progress", 50)) * 0.15))
    return {"active": True, "position": pos, "rider": rider, "eta_minutes": eta_min, "status": "en_livraison"}

# ---------- Customer thread helpers (reuse messaging) ----------
@api.get("/public/account/threads")
async def account_threads(c: dict = Depends(get_customer)):
    rows = await db.conversations.find({"participants.id": c["id"]}).sort("updated_at", -1).to_list(100)
    out = []
    for r in rows:
        parts = r.get("participants") or []
        other = next((p for p in parts if p.get("id") != c["id"]), {})
        last = (r.get("messages") or [{}])[-1] if r.get("messages") else None
        unread = sum(1 for m in (r.get("messages") or []) if c["id"] not in (m.get("read_by") or []))
        out.append({"id": r.get("id"), "kind": r.get("kind"), "order_id": r.get("order_id"),
                    "with": other, "last_message": last, "unread": unread, "updated_at": r.get("updated_at")})
    return clean(out)

@api.post("/public/account/thread/rider/{order_code}")
async def account_open_rider_thread(order_code: str, c: dict = Depends(get_customer)):
    o = await db.orders.find_one({"code": order_code, "customer.id": c["id"]})
    if not o: raise HTTPException(404, "Commande introuvable")
    rid = o.get("rider_id")
    if not rid: raise HTTPException(400, "Pas de livreur assigné")
    key = f"c:{c['id']}|r:{rid}"
    existing = await db.conversations.find_one({"key": key})
    if existing: return {"id": existing["id"]}
    r = await db.users.find_one({"id": rid}, {"password_hash":0, "pin_hash":0})
    conv = {"id": new_id(), "key": key, "kind": "cliente_livreur", "order_id": o["id"], "closed": False,
            "participants": [{"kind":"customer","id":c["id"],"name":c.get("name")},
                             {"kind":"rider","id":rid,"name":r.get("name") if r else "Livreur"}],
            "messages": [], "created_at": now_iso(), "updated_at": now_iso()}
    await db.conversations.insert_one(conv)
    return {"id": conv["id"]}

# ---------- Pack 6: In-app messaging ----------
async def _conv_key(parts: List[str]) -> str:
    return "|".join(sorted(parts))

@api.get("/messages/conversations")
async def list_conversations(user: dict = Depends(get_user), archived: bool = False):
    """List conversations where staff is a participant. ?archived=true shows archived only."""
    q = {"participants.kind": {"$in": ["store", "rider"]}}
    if archived:
        q["archived"] = True
    else:
        q["$or"] = [{"archived": {"$exists": False}}, {"archived": False}]
    rows = await db.conversations.find(q).sort([("pinned", -1), ("updated_at", -1)]).to_list(500)
    for r in rows:
        unread_me = sum(1 for m in (r.get("messages") or []) if not (m.get("read_by") or []) or user["id"] not in (m.get("read_by") or []))
        r["unread"] = unread_me
        r["last_message"] = (r.get("messages") or [{}])[-1] if r.get("messages") else None
    return clean(rows)

@api.post("/messages/open")
async def open_or_create_conv(body: Dict[str, Any], user: dict = Depends(get_user)):
    """Open or create a conversation with a rider or customer. Body: {rider_id?|customer_id?, kind?}"""
    cust_id = body.get("customer_id")
    rider_id = body.get("rider_id")
    if not cust_id and not rider_id: raise HTTPException(400, "customer_id ou rider_id requis")
    kind = body.get("kind") or ("boutique_livreur" if rider_id else "boutique_cliente")
    parts = [f"s:{user['id']}"]
    if cust_id: parts.append(f"c:{cust_id}")
    if rider_id: parts.append(f"r:{rider_id}")
    key = await _conv_key(parts)
    conv = await db.conversations.find_one({"key": key})
    if conv:
        if conv.get("archived"):
            await db.conversations.update_one({"id": conv["id"]}, {"$set": {"archived": False, "updated_at": now_iso()}})
        return {"id": conv["id"], "created": False}
    participants = [{"kind": "store", "id": user["id"], "name": user.get("name")}]
    if cust_id:
        cust = await db.customers.find_one({"id": cust_id})
        if cust: participants.append({"kind": "customer", "id": cust_id, "name": cust.get("name")})
    if rider_id:
        r = await db.users.find_one({"id": rider_id})
        if r: participants.append({"kind": "rider", "id": rider_id, "name": r.get("name")})
    conv = {"id": new_id(), "key": key, "kind": kind, "closed": False, "archived": False, "pinned": False,
            "participants": participants, "messages": [], "created_at": now_iso(), "updated_at": now_iso()}
    await db.conversations.insert_one(conv)
    return {"id": conv["id"], "created": True}

@api.patch("/messages/conversations/{conv_id}/archive")
async def toggle_archive(conv_id: str, body: Dict[str, Any] = None, user: dict = Depends(get_user)):
    c = await db.conversations.find_one({"id": conv_id})
    if not c: raise HTTPException(404)
    nxt = not bool(c.get("archived", False)) if (body is None or body.get("archived") is None) else bool(body.get("archived"))
    await db.conversations.update_one({"id": conv_id}, {"$set": {"archived": nxt, "updated_at": now_iso()}})
    return {"ok": True, "archived": nxt}

@api.patch("/messages/conversations/{conv_id}/pin")
async def toggle_pin(conv_id: str, body: Dict[str, Any] = None, user: dict = Depends(get_user)):
    c = await db.conversations.find_one({"id": conv_id})
    if not c: raise HTTPException(404)
    nxt = not bool(c.get("pinned", False)) if (body is None or body.get("pinned") is None) else bool(body.get("pinned"))
    await db.conversations.update_one({"id": conv_id}, {"$set": {"pinned": nxt, "updated_at": now_iso()}})
    return {"ok": True, "pinned": nxt}

@api.post("/messages/conversations/{conv_id}/react")
async def react_message(conv_id: str, body: Dict[str, Any], user: dict = Depends(get_user)):
    """Toggle an emoji reaction from `user` on message `message_id`."""
    msg_id = body.get("message_id")
    emoji = (body.get("emoji") or "").strip()
    if not msg_id or not emoji: raise HTTPException(400, "message_id et emoji requis")
    c = await db.conversations.find_one({"id": conv_id})
    if not c: raise HTTPException(404)
    msgs = c.get("messages") or []
    for m in msgs:
        if m.get("id") == msg_id:
            reacts = m.setdefault("reactions", {})
            uids = reacts.get(emoji, [])
            if user["id"] in uids:
                uids.remove(user["id"])
                if not uids: reacts.pop(emoji, None)
                else: reacts[emoji] = uids
            else:
                reacts[emoji] = uids + [user["id"]]
            break
    await db.conversations.update_one({"id": conv_id}, {"$set": {"messages": msgs, "updated_at": now_iso()}})
    return {"ok": True}

@api.get("/messages/conversations/{conv_id}")
async def get_conversation(conv_id: str, user: dict = Depends(get_user)):
    c = await db.conversations.find_one({"id": conv_id})
    if not c: raise HTTPException(404)
    msgs = c.get("messages") or []
    changed = False
    for m in msgs:
        if user["id"] not in (m.get("read_by") or []):
            m.setdefault("read_by", []).append(user["id"])
            changed = True
    if changed: await db.conversations.update_one({"id": conv_id}, {"$set": {"messages": msgs}})
    return clean(c)

@api.post("/messages/send")
async def send_message(body: Dict[str, Any], user: dict = Depends(get_user)):
    """Create or append to a conversation.
    Body: {customer_id?, rider_id?, order_id?, text, image?, attachments?: [{type,url,name,size,mime}], kind?}
    attachments[].type: 'image' | 'video' | 'file' | 'audio'
    """
    cust_id = body.get("customer_id")
    rider_id = body.get("rider_id")
    order_id = body.get("order_id")
    kind = body.get("kind", "boutique_cliente")
    parts = []
    if cust_id: parts.append(f"c:{cust_id}")
    if rider_id: parts.append(f"r:{rider_id}")
    if not cust_id and not rider_id: raise HTTPException(400, "customer_id ou rider_id requis")
    parts.append(f"s:{user['id']}")
    key = await _conv_key(parts)
    conv = await db.conversations.find_one({"key": key})
    msg = {"id": new_id(), "at": now_iso(), "from_id": user["id"], "from_name": user.get("name"),
           "from_kind": "store", "text": body.get("text",""), "image": body.get("image"),
           "attachments": body.get("attachments") or [], "reactions": {}, "read_by": [user["id"]]}
    if not conv:
        participants = [{"kind": "store", "id": user["id"], "name": user.get("name")}]
        if cust_id:
            cust = await db.customers.find_one({"id": cust_id})
            if cust: participants.append({"kind": "customer", "id": cust_id, "name": cust.get("name")})
        if rider_id:
            r = await db.users.find_one({"id": rider_id})
            if r: participants.append({"kind": "rider", "id": rider_id, "name": r.get("name")})
        conv = {"id": new_id(), "key": key, "kind": kind, "order_id": order_id, "closed": False, "archived": False, "pinned": False,
                "participants": participants, "messages": [msg], "created_at": now_iso(), "updated_at": now_iso()}
        await db.conversations.insert_one(conv)
    else:
        if conv.get("closed"): raise HTTPException(400, "Conversation fermée")
        await db.conversations.update_one({"id": conv["id"]}, {"$push": {"messages": msg}, "$set": {"updated_at": now_iso(), "archived": False}})
    return {"ok": True, "conversation_id": conv["id"], "message": msg}

@api.get("/public/account/messages")
async def customer_messages(c: dict = Depends(get_customer)):
    rows = await db.conversations.find({"participants.id": c["id"]}).sort("updated_at", -1).to_list(100)
    return clean(rows)

@api.post("/public/account/messages/send")
async def customer_send(body: Dict[str, Any], c: dict = Depends(get_customer)):
    conv_id = body.get("conversation_id")
    conv = await db.conversations.find_one({"id": conv_id, "participants.id": c["id"]})
    if not conv: raise HTTPException(404)
    if conv.get("closed"): raise HTTPException(400, "Conversation fermée")
    msg = {"id": new_id(), "at": now_iso(), "from_id": c["id"], "from_name": c.get("name"), "from_kind": "customer",
           "text": body.get("text",""), "image": body.get("image"), "read_by": [c["id"]]}
    await db.conversations.update_one({"id": conv_id}, {"$push": {"messages": msg}, "$set": {"updated_at": now_iso()}})
    return {"ok": True, "message": msg}

@api.get("/public/account/top-customers")
async def public_top_customers(limit: int = 10):
    """Public ranking for customer space — masks phone, keeps first name + rank."""
    rows = await db.customers.find({"status": {"$ne": "blacklist"}}, {"password_hash": 0}).to_list(5000)
    for r in rows:
        r["rank_score"] = (r.get("total_spent", 0) or 0) + (r.get("loyalty_points", 0) or 0) * 10
    rows.sort(key=lambda x: -x.get("rank_score", 0))
    out = []
    for i, r in enumerate(rows[:limit]):
        name = r.get("name", "")
        parts = name.split(" ")
        shown = parts[0] + (" " + parts[-1][0] + "." if len(parts) > 1 else "")
        out.append({
            "rank": i + 1,
            "name": shown,
            "tier": r.get("tier", "Bronze"),
            "loyalty_points": r.get("loyalty_points", 0),
        })
    return out

class SegmentAIIn(BaseModel):
    prompt: str
    name: Optional[str] = None

@api.post("/segments/ai")
async def segments_from_ai(body: SegmentAIIn, user: dict = Depends(require_role("admin","manager"))):
    """Build an auto-segment from a natural-language description using Claude Sonnet (Emergent LLM)."""
    import json as _json
    system = (
        "Tu es un assistant qui transforme une description française en règles de segment client pour la boutique Chez Dina.\n"
        "Renvoie UNIQUEMENT un JSON valide, sans texte, aucune explication, avec ces clés optionnelles :\n"
        "{\"name\":string, \"description\":string, \"rules\":{\"zone\":string?, \"tier\":\"Bronze|Silver|Gold|Platine\"?, "
        "\"total_spent_min\":int?, \"last_order_days_max\":int?, \"category\":string?, \"size\":string?, "
        "\"source\":string?, \"status\":string?, \"orders_min\":int?}}.\n"
        "Les règles sont CUMULATIVES (ET logique). Ignore les critères inconnus. Si demande vide ou impossible : {\"error\":\"...\"}."
    )
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY",""), session_id=f"dina-seg-ai-{user['id']}-{new_id()[:6]}", system_message=system).with_model("anthropic","claude-sonnet-4-5-20250929")
        resp = await chat.send_message(UserMessage(text=body.prompt))
        txt = (resp or "").strip()
        if txt.startswith("```"):
            txt = txt.strip("`").replace("json\n","",1).strip()
        parsed = _json.loads(txt)
    except Exception as e:
        raise HTTPException(400, f"Analyse IA impossible : {str(e)[:140]}")
    if "error" in parsed:
        raise HTTPException(400, parsed["error"])
    rules = parsed.get("rules") or {}
    doc = {
        "id": new_id(),
        "name": body.name or parsed.get("name") or "Segment IA",
        "description": parsed.get("description") or body.prompt[:120],
        "kind": "auto",
        "rules": rules,
        "customer_ids": [],
        "excluded_ids": [],
        "created_at": now_iso(),
        "created_by": user.get("name"),
        "source": "ai",
        "ai_prompt": body.prompt,
    }
    await db.customer_segments_v2.insert_one(doc)
    doc["count"] = len(await _resolve_segment_ids(doc))
    return clean(doc)

@api.post("/messages/broadcast")
async def broadcast(body: Dict[str, Any], user: dict = Depends(require_role("admin","manager"))):
    """Broadcast to customers (segment or list) or riders. Creates one conversation per target."""
    target = body.get("target", "all")  # all | segment:ID | ids
    text = body.get("text", "")
    image = body.get("image")
    valid_until = body.get("valid_until")
    ids: List[str] = []
    if target == "all":
        async for c in db.customers.find({"status": "active"}, {"id": 1}): ids.append(c["id"])
    elif isinstance(target, list):
        ids = target
    elif isinstance(target, str) and target.startswith("segment:"):
        seg = await db.customer_segments.find_one({"id": target.split(":",1)[1]})
        ids = (seg or {}).get("customer_ids") or []
    count = 0
    for cid in ids:
        await send_message({"customer_id": cid, "text": text, "image": image, "kind": "boutique_cliente"}, user)
        count += 1
    return {"ok": True, "count": count, "valid_until": valid_until}

# Auto-close customer↔rider convos when order status becomes "livree"
async def _close_rider_customer_convs(order_id: str):
    await db.conversations.update_many({"order_id": order_id, "kind": "cliente_livreur"}, {"$set": {"closed": True, "closed_at": now_iso()}})

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

@api.post("/deliveries/suggest-split")
async def suggest_split(body: Dict[str, Any], user: dict = Depends(require_role("admin","manager"))):
    """Propose a zone-based + load-balanced split of unassigned orders among active riders.
    Body: { order_ids: [...], rider_ids: [...] }  (optional, defaults to all ready + all riders)
    Returns: { suggestions: [{ rider_id, rider_name, orders: [oid,...], total_load, zones:[...] }], unassigned:[oid,...] }
    """
    requested_oids = body.get("order_ids") or []
    requested_rids = body.get("rider_ids") or []
    # Load candidates
    order_filter = {"id": {"$in": requested_oids}} if requested_oids else {"mode": "delivery", "status": {"$in": ["prete","confirmee"]}, "rider_id": {"$in": [None, ""]}}
    orders = await db.orders.find(order_filter).to_list(500)
    rider_filter = {"id": {"$in": requested_rids}} if requested_rids else {"role": "rider", "active": {"$ne": False}}
    riders = await db.users.find(rider_filter).to_list(200)
    if not riders:
        return {"suggestions": [], "unassigned": [o["id"] for o in orders], "message": "Aucun livreur actif"}
    # Load current rider load (orders assigned today, not delivered)
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    load = {r["id"]: 0 for r in riders}
    cur = await db.orders.find({"rider_id": {"$in": [r["id"] for r in riders]}, "created_at": {"$regex": f"^{today}"}, "status": {"$nin": ["livree","annulee","echouee"]}}).to_list(500)
    for o in cur: load[o.get("rider_id")] = load.get(o.get("rider_id"), 0) + 1
    # Group orders by zone, then round-robin to least-loaded rider — bias same rider for same zone
    by_zone: Dict[str, List[dict]] = {}
    for o in orders:
        z = o.get("delivery_zone") or "—"
        by_zone.setdefault(z, []).append(o)
    suggestions = {r["id"]: {"rider_id": r["id"], "rider_name": r.get("name"), "orders": [], "zones": set(), "total_load": load.get(r["id"], 0)} for r in riders}
    zone_rider: Dict[str, str] = {}
    for z, zorders in by_zone.items():
        for o in zorders:
            # Prefer rider already handling this zone, else least-loaded
            if z in zone_rider:
                rid = zone_rider[z]
            else:
                rid = min(suggestions.keys(), key=lambda k: suggestions[k]["total_load"])
                zone_rider[z] = rid
            suggestions[rid]["orders"].append(o["id"])
            suggestions[rid]["zones"].add(z)
            suggestions[rid]["total_load"] += 1
    out = [{"rider_id": s["rider_id"], "rider_name": s["rider_name"], "orders": s["orders"], "zones": sorted(list(s["zones"])), "total_load": s["total_load"]} for s in suggestions.values() if s["orders"]]
    return {"suggestions": out, "unassigned": []}

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

# ---------- Pack 9: Manuel d'utilisation ----------
MANUAL_MODULES_SEED = [
    {"number": 1, "title": "Prise en main", "icon": "LogIn", "description": "Connexion, pointage, interface, recherche et thème",
     "roles": ["admin","manager","sales","rider","stock"], "path_hints": ["/console","/login"],
     "sections": [
         {"id":"s1","heading":"Se connecter","blocks":[
             {"type":"text","content":"Chaque employée dispose de son propre compte avec email et mot de passe. En plus, un code PIN à 4 chiffres sert à valider les actions sensibles (remises, remboursements)."},
             {"type":"steps","items":["Allez sur /login","Saisissez votre email professionnel","Tapez votre mot de passe","Cliquez sur Se connecter"]},
             {"type":"callout","variant":"info","text":"Si vous oubliez votre mot de passe, demandez à la gérante de le réinitialiser depuis Équipe > Employés."},
         ]},
         {"id":"s2","heading":"Pointer son arrivée","blocks":[
             {"type":"text","content":"Chaque vendeuse pointe son arrivée et son départ depuis la page Pointage. Un geofencing vérifie que vous êtes bien à la boutique."},
             {"type":"steps","items":["Ouvrez Équipe > Pointage","Autorisez la géolocalisation","Cliquez sur Pointer l'arrivée","À la fin, cliquez sur Pointer la sortie"]},
             {"type":"callout","variant":"tip","text":"Vous pouvez consulter votre historique de pointages dans l'onglet Mes présences."},
         ]},
         {"id":"s3","heading":"Comprendre l'interface","blocks":[
             {"type":"text","content":"Le menu latéral regroupe toutes vos pages par thème. En haut à droite : notifications, mode sombre, création rapide, et une barre de recherche globale."},
             {"type":"list","items":["Clic sur le logo = retour Tableau de bord","Icône cloche = notifications non lues","Soleil/lune = basculer thème clair/sombre","Barre de recherche = clientes, produits, commandes"]},
         ]},
         {"id":"s4","heading":"Rechercher partout","blocks":[
             {"type":"text","content":"La barre de recherche en haut de chaque page cherche à travers clientes, produits et commandes en même temps. Tapez simplement un nom, un numéro ou un code."},
             {"type":"callout","variant":"tip","text":"Astuce : commencez par 3 lettres et laissez les suggestions apparaître."},
         ]},
     ]},
    {"number": 2, "title": "Comprendre Chez Dina", "icon": "BookOpen", "description": "Vocabulaire : produit, variante, statuts, session de caisse, réconciliation",
     "roles": ["admin","manager","sales","rider","stock"], "path_hints": [],
     "sections": [
         {"id":"s1","heading":"Vocabulaire essentiel","blocks":[
             {"type":"statuses","items":[
                 {"name":"Produit","desc":"Un article (ex. Robe wax rouge)"},
                 {"name":"Variante","desc":"Une déclinaison du produit (taille M, couleur rouge, SKU unique)"},
                 {"name":"Commande","desc":"Un panier validé par une cliente, qui va suivre un parcours"},
                 {"name":"Session de caisse","desc":"Une période de travail d'une vendeuse avec fond de caisse"},
                 {"name":"Journée de livraison","desc":"Lot de commandes attribuées à un livreur pour une journée"},
                 {"name":"Réconciliation","desc":"Rapprochement entre encaissé et versé à la banque en fin de journée"},
             ]},
         ]},
         {"id":"s2","heading":"Les statuts d'une commande","blocks":[
             {"type":"statuses","items":[
                 {"name":"Nouvelle","desc":"Reçue sur le site, non confirmée"},
                 {"name":"Confirmée","desc":"Validée par la gérante, stock réservé"},
                 {"name":"Assignée","desc":"Attribuée à un livreur"},
                 {"name":"En préparation","desc":"Articles emballés"},
                 {"name":"En livraison","desc":"Chez le livreur, en route"},
                 {"name":"Livrée","desc":"Remise à la cliente, payée"},
                 {"name":"Reportée","desc":"Cliente injoignable, à relivrer"},
                 {"name":"Annulée / Retournée","desc":"Vente ratée ou produit retourné"},
             ]},
         ]},
     ]},
    {"number": 3, "title": "Caisse et ventes en boutique", "icon": "ShoppingCart", "description": "Encaisser une vente, appliquer une remise, imprimer un reçu",
     "roles": ["admin","manager","sales"], "path_hints": ["/console/pos"],
     "sections": [
         {"id":"s1","heading":"Encaisser une vente","blocks":[
             {"type":"text","content":"La Caisse (POS) est l'écran principal des vendeuses. On y scanne ou cherche des produits, on choisit la cliente, et on encaisse."},
             {"type":"steps","items":["Ouvrez Caisse","Scannez le code-barres ou tapez le nom du produit","Choisissez la variante (taille, couleur)","Sélectionnez la cliente ou créez-la","Cliquez sur Encaisser","Choisissez le mode de paiement et validez"]},
             {"type":"callout","variant":"warning","text":"Une remise supérieure à la limite (défaut 20%) demande le PIN de la gérante."},
         ]},
         {"id":"s2","heading":"Ouvrir et clôturer la caisse","blocks":[
             {"type":"text","content":"Chaque vendeuse ouvre sa session de caisse en arrivant, et la clôture en partant."},
             {"type":"steps","items":["Caisse > Ouvrir ma session","Saisissez le fond de caisse (ex. 10 000 FCFA)","Faites vos ventes de la journée","À la fin, cliquez sur Clôturer","Comptez les espèces et saisissez le montant","Validez — l'écart est calculé automatiquement"]},
         ]},
     ]},
    {"number": 4, "title": "Commandes et préparation", "icon": "Receipt", "description": "Confirmer, scanner, imprimer fiches colis",
     "roles": ["admin","manager","sales","stock"], "path_hints": ["/console/commandes"],
     "sections": [
         {"id":"s1","heading":"Confirmer une commande web","blocks":[
             {"type":"steps","items":["Ouvrez Commandes","Filtrez par 'Nouvelle'","Vérifiez la disponibilité des articles","Appelez la cliente pour confirmer","Cliquez sur Confirmer"]},
         ]},
         {"id":"s2","heading":"Préparer un colis","blocks":[
             {"type":"text","content":"Après confirmation, scannez chaque article pour éviter les erreurs."},
             {"type":"steps","items":["Ouvrez la commande","Scannez chaque article (ou cochez)","Emballez et collez la fiche colis","Marquez En préparation"]},
         ]},
     ]},
    {"number": 5, "title": "Livraison", "icon": "Truck", "description": "Journées, affectation aux livreurs, preuve, réconciliation",
     "roles": ["admin","manager","rider"], "path_hints": ["/console/livraisons","/rider"],
     "sections": [
         {"id":"s1","heading":"Créer une journée de livraison","blocks":[
             {"type":"steps","items":["Livraisons > Nouvelle journée","Choisissez la date et le livreur","Glissez les commandes à livrer","Validez la tournée"]},
         ]},
         {"id":"s2","heading":"Preuve de livraison","blocks":[
             {"type":"text","content":"À la remise, le livreur prend une photo (ou signature) et saisit un code à 4 chiffres communiqué à la cliente."},
             {"type":"callout","variant":"warning","text":"Au-dessus du seuil configuré (défaut 50 000 FCFA), le PIN de la gérante est aussi requis."},
         ]},
     ]},
    {"number": 6, "title": "Produits, marques et catégories", "icon": "Package", "description": "Créer un produit, gérer les variantes et le stock initial",
     "roles": ["admin","manager","stock"], "path_hints": ["/console/produits","/console/marques","/console/categories"],
     "sections":[
         {"id":"s1","heading":"Créer un produit","blocks":[
             {"type":"steps","items":["Produits > Nouveau produit","Remplissez nom, catégorie, prix","Ajoutez les variantes (taille × couleur)","Téléversez les photos","Enregistrez"]},
             {"type":"callout","variant":"tip","text":"Utilisez l'IA (bouton magique) pour générer la description à partir du nom et de quelques détails."},
         ]},
     ]},
    {"number": 7, "title": "Fournisseurs et approvisionnements", "icon": "Building2", "description": "Commande fournisseur en Kanban, réception",
     "roles": ["admin","manager","stock"], "path_hints": ["/console/fournisseurs","/console/achats"],
     "sections":[
         {"id":"s1","heading":"Passer une commande d'approvisionnement","blocks":[
             {"type":"steps","items":["Approvisionnements > Nouvelle commande","Choisissez le fournisseur","Ajoutez les articles et quantités","Validez — passe en 'Commandée'"]},
         ]},
         {"id":"s2","heading":"Réceptionner la marchandise","blocks":[
             {"type":"text","content":"Déplacez la commande en 'Reçue' dans le Kanban. Les quantités sont ajoutées au stock automatiquement."},
         ]},
     ]},
    {"number": 8, "title": "Stock et inventaires", "icon": "Boxes", "description": "Suivre, ajuster, inventorier",
     "roles": ["admin","manager","stock"], "path_hints":["/console/stock"],
     "sections":[
         {"id":"s1","heading":"Faire un inventaire","blocks":[
             {"type":"steps","items":["Stock > Nouvel inventaire","Imprimez la feuille de comptage","Comptez article par article","Saisissez les écarts","Validez — les ajustements sont enregistrés"]},
         ]},
     ]},
    {"number": 9, "title": "Clientes, messagerie, campagnes", "icon": "Users", "description": "Fiches clientes 360°, messages, segments",
     "roles": ["admin","manager","sales"], "path_hints":["/console/clients","/console/messagerie","/console/segments"],
     "sections":[
         {"id":"s1","heading":"La fiche cliente 360°","blocks":[
             {"type":"text","content":"Chaque fiche cliente regroupe 14 onglets : commandes, favoris, messages, avis, fidélité, parrainage, porte-monnaie, adresses, préférences, notes, etc."},
         ]},
         {"id":"s2","heading":"Lancer une campagne WhatsApp","blocks":[
             {"type":"steps","items":["Segments > Nouveau segment","Définissez les critères (ex. inactives 30j)","Prévisualisez les destinataires","Créez une campagne liée","Rédigez le message et envoyez"]},
         ]},
     ]},
    {"number": 10, "title": "Promotions, fidélité, parrainage", "icon": "Megaphone", "description": "Codes promo, points, bons d'achat",
     "roles": ["admin","manager","sales"], "path_hints":["/console/promotions","/console/fidelite","/console/parrainage"],
     "sections":[
         {"id":"s1","heading":"Créer un code promo","blocks":[
             {"type":"steps","items":["Promotions > Nouveau","Choisissez type (% ou fixe)","Définissez la période","Limitez par produits/catégories (optionnel)","Activez"]},
         ]},
     ]},
    {"number": 11, "title": "Sessions de caisse et versements", "icon": "ClipboardList", "description": "Ouvrir, fermer, verser à la banque",
     "roles": ["admin","manager"], "path_hints":["/console/sessions-caisse"],
     "sections":[
         {"id":"s1","heading":"Verser à la banque","blocks":[
             {"type":"steps","items":["Sessions de caisse > Session clôturée","Cliquez sur Nouveau versement","Saisissez le montant et le mode (banque/mobile money)","Téléversez le reçu","Validez"]},
         ]},
     ]},
    {"number": 12, "title": "Statistiques et finances", "icon": "BarChart3", "description": "12 onglets stats, dépenses, compte de résultat",
     "roles": ["admin","manager"], "path_hints":["/console/statistiques","/console/finances"],
     "sections":[
         {"id":"s1","heading":"Lire son compte de résultat","blocks":[
             {"type":"text","content":"Le compte de résultat affiche : CA − coût des marchandises = marge brute, moins les dépenses = résultat d'exploitation."},
             {"type":"callout","variant":"tip","text":"Comparez chaque mois à N-1 pour voir vos progrès."},
         ]},
     ]},
    {"number": 13, "title": "Site vitrine", "icon": "Globe", "description": "Apparence, accueil, pages, SEO, aperçu",
     "roles": ["admin","manager"], "path_hints":["/console/site"],
     "sections":[
         {"id":"s1","heading":"Changer l'apparence du site","blocks":[
             {"type":"steps","items":["Site vitrine > Apparence","Choisissez vos couleurs (ou un preset)","Sélectionnez la police","Enregistrez — rechargez /boutique pour voir"]},
         ]},
         {"id":"s2","heading":"Éditer l'accueil","blocks":[
             {"type":"text","content":"L'accueil est composé de sections modulaires : hero mosaïque, bons plans, catégories, ventes flash. Ajoutez vos images (upload uniquement)."},
         ]},
     ]},
    {"number": 14, "title": "Équipe, rôles et pointage", "icon": "UserCog", "description": "Employés, droits, horaires, présences",
     "roles": ["admin","manager"], "path_hints":["/console/equipe","/console/roles","/console/pointage"],
     "sections":[
         {"id":"s1","heading":"Créer une employée","blocks":[
             {"type":"steps","items":["Équipe > Nouvel employé","Nom, email, téléphone, rôle","Générez un mot de passe temporaire","L'employée changera son PIN à la 1re connexion"]},
         ]},
     ]},
    {"number": 15, "title": "Paramètres et intégrations", "icon": "Settings", "description": "Identité, coordonnées, paiements, notifications",
     "roles": ["admin","manager"], "path_hints":["/console/parametres"],
     "sections":[
         {"id":"s1","heading":"Mettre à jour le logo partout","blocks":[
             {"type":"text","content":"Le logo chargé dans Paramètres > Identité se propage automatiquement : console, site, espace livreur, reçus, factures et fiches colis."},
         ]},
     ]},
    {"number": 16, "title": "Espace livreur (téléphone)", "icon": "Smartphone", "description": "App livreur : journée, remise, preuve, score",
     "roles": ["admin","manager","rider"], "path_hints":["/rider"],
     "sections":[
         {"id":"s1","heading":"Démarrer ma journée","blocks":[
             {"type":"steps","items":["Ouvrez /rider sur votre téléphone","Connectez-vous avec votre PIN à 4 chiffres","Autorisez la géolocalisation","Consultez vos commandes du jour"]},
         ]},
         {"id":"s2","heading":"Livrer et marquer livré","blocks":[
             {"type":"steps","items":["Cliquez sur une commande","Appelez la cliente avant d'arriver","Sur place, prenez une photo de preuve","Demandez le code à 4 chiffres à la cliente","Validez — la commande passe Livrée"]},
             {"type":"callout","variant":"info","text":"Votre score dépend de la ponctualité, du zéro annulation, de la note cliente et de la preuve de livraison."},
         ]},
     ]},
]

async def seed_manual_modules():
    if await db.manual_modules.count_documents({}) >= len(MANUAL_MODULES_SEED): return
    for m in MANUAL_MODULES_SEED:
        existing = await db.manual_modules.find_one({"number": m["number"]})
        if not existing:
            doc = {**m, "id": new_id(), "created_at": now_iso()}
            await db.manual_modules.insert_one(doc)

@api.get("/manual/modules")
async def manual_modules(user: dict = Depends(get_user), role: Optional[str] = None):
    f: Dict[str, Any] = {}
    if role: f["roles"] = role
    rows = await db.manual_modules.find(f).sort("number", 1).to_list(100)
    # Attach user progress
    prog = await db.manual_progress.find_one({"user_id": user["id"]}) or {}
    read_set = set(prog.get("read_sections", []))
    for m in rows:
        total = sum(1 for _ in m.get("sections") or [])
        done = sum(1 for s in m.get("sections") or [] if f"{m['number']}:{s['id']}" in read_set)
        m["progress"] = {"total": total, "done": done}
    return clean(rows)

@api.get("/manual/modules/{number}")
async def manual_module(number: int, user: dict = Depends(get_user)):
    m = await db.manual_modules.find_one({"number": number})
    if not m: raise HTTPException(404)
    prog = await db.manual_progress.find_one({"user_id": user["id"]}) or {}
    read_set = set(prog.get("read_sections", []))
    for s in m.get("sections") or []:
        s["read"] = f"{number}:{s['id']}" in read_set
    return clean(m)

@api.patch("/manual/modules/{number}")
async def update_manual_module(number: int, body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("id", None); body.pop("_id", None); body.pop("number", None)
    body["updated_at"] = now_iso()
    r = await db.manual_modules.update_one({"number": number}, {"$set": body})
    if r.matched_count == 0: raise HTTPException(404)
    return {"ok": True}

@api.post("/manual/progress")
async def manual_mark_read(body: Dict[str,Any], user: dict = Depends(get_user)):
    key = f"{body.get('module_number')}:{body.get('section_id')}"
    if not body.get("section_id") or not body.get("module_number"): raise HTTPException(400)
    await db.manual_progress.update_one(
        {"user_id": user["id"]},
        {"$addToSet": {"read_sections": key}, "$set": {"updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}

@api.get("/manual/progress")
async def manual_progress_me(user: dict = Depends(get_user)):
    prog = await db.manual_progress.find_one({"user_id": user["id"]}) or {}
    return {"read_sections": prog.get("read_sections", [])}

@api.get("/manual/search")
async def manual_search(q: str, user: dict = Depends(get_user)):
    ql = (q or "").strip().lower()
    if len(ql) < 2: return []
    rows = await db.manual_modules.find({}).sort("number", 1).to_list(100)
    hits = []
    for m in rows:
        if ql in (m.get("title","") + " " + m.get("description","")).lower():
            hits.append({"module_number": m["number"], "title": m["title"], "match": "titre"})
        for s in m.get("sections") or []:
            parts = [s.get("heading","")]
            for b in (s.get("blocks") or []):
                if not isinstance(b, dict): continue
                parts.append(b.get("content","") or "")
                parts.append(b.get("text","") or "")
                parts.append(b.get("caption","") or "")
                for it in (b.get("items") or []):
                    if isinstance(it, str): parts.append(it)
                    elif isinstance(it, dict): parts.extend([it.get("name",""), it.get("desc","")])
            text = " ".join(parts).lower()
            if ql in text:
                hits.append({"module_number": m["number"], "title": m["title"], "section_id": s["id"], "heading": s.get("heading"), "match": "contenu"})
    return hits[:30]

@api.get("/manual/module-for-path")
async def manual_module_for_path(path: str, user: dict = Depends(get_user)):
    """Return the first module whose path_hints matches the given path (longest prefix wins)."""
    rows = await db.manual_modules.find({}).to_list(100)
    best = None; best_len = 0
    for m in rows:
        for h in (m.get("path_hints") or []):
            if path.startswith(h) and len(h) > best_len:
                best = m; best_len = len(h)
    return clean(best) if best else {}

@api.get("/expenses")
async def expenses(user: dict = Depends(get_user),
                   category: Optional[str] = None, type: Optional[str] = None,
                   q: Optional[str] = None, days: Optional[int] = None):
    f: Dict[str, Any] = {}
    if category: f["category"] = category
    if type: f["type"] = type
    if days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        # Filter by paid_at (actual expense date) with fallback to created_at for legacy rows
        f["$or"] = [{"paid_at": {"$gte": cutoff}}, {"paid_at": None, "created_at": {"$gte": cutoff}}]
    rows = await db.expenses.find(f).sort("created_at", -1).to_list(2000)
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in (r.get("label","") + " " + r.get("note","") + " " + r.get("category","")).lower()]
    return clean(rows)

@api.post("/expenses")
async def create_expense(body: ExpenseIn, user: dict = Depends(get_user)):
    doc = body.model_dump(); doc.update({"id": new_id(), "created_at": now_iso(), "created_by": user.get("name"), "store_id":"store-cocody"})
    if not doc.get("paid_at"): doc["paid_at"] = doc["created_at"]
    await db.expenses.insert_one(doc)
    return clean(doc)

@api.patch("/expenses/{eid}")
async def update_expense(eid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("id", None); body.pop("_id", None)
    await db.expenses.update_one({"id": eid}, {"$set": body})
    return {"ok": True}

@api.post("/expenses/{eid}/receipt")
async def upload_expense_receipt(eid: str, body: Dict[str,Any], user: dict = Depends(get_user)):
    receipt = body.get("receipt")
    if not receipt or not isinstance(receipt, str): raise HTTPException(400, "receipt (base64) requis")
    await db.expenses.update_one({"id": eid}, {"$set": {"receipt": receipt, "receipt_uploaded_at": now_iso()}})
    return {"ok": True}

@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.expenses.delete_one({"id": eid})
    return {"ok": True}

# ---------- Expense Categories ----------
@api.get("/expense-categories")
async def list_expense_categories(user: dict = Depends(get_user)):
    rows = await db.expense_categories.find({}).sort("name", 1).to_list(500)
    return clean(rows)

@api.post("/expense-categories")
async def create_expense_category(body: ExpenseCategoryIn, user: dict = Depends(require_role("admin","manager"))):
    existing = await db.expense_categories.find_one({"name": body.name})
    if existing: raise HTTPException(400, "Catégorie déjà existante")
    doc = {"id": new_id(), "name": body.name, "type": body.type, "created_at": now_iso()}
    await db.expense_categories.insert_one(doc)
    return clean(doc)

@api.patch("/expense-categories/{cid}")
async def update_expense_category(cid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("id", None); body.pop("_id", None)
    await db.expense_categories.update_one({"id": cid}, {"$set": body})
    return {"ok": True}

@api.delete("/expense-categories/{cid}")
async def delete_expense_category(cid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.expense_categories.delete_one({"id": cid})
    return {"ok": True}

@api.get("/suppliers")
async def suppliers(user: dict = Depends(get_user)):
    rows = await db.suppliers.find({}).to_list(500)
    # Owner-only fields are hidden for non-admin
    if user.get("role") != "admin":
        for r in rows:
            for k in ("phone","whatsapp","email","website","address","manager_name","manager_role","manager_phone","manager_whatsapp","payment_terms","documents","notes"):
                r.pop(k, None)
    return clean(rows)

@api.get("/suppliers/kpis")
async def suppliers_kpis(user: dict = Depends(get_user)):
    rows = await db.suppliers.find({}).to_list(500)
    actives = sum(1 for r in rows if r.get("status", "active") == "active")
    balance = sum(int(r.get("balance", 0) or 0) for r in rows)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    pos = await db.purchase_orders.find({"created_at": {"$gte": cutoff}}).to_list(500)
    purchased_30 = sum(int(p.get("total", 0) or 0) for p in pos)
    leads = [int(r.get("lead_time_days", 0) or 0) for r in rows if r.get("lead_time_days")]
    avg_lead = round(sum(leads) / len(leads), 1) if leads else 0
    return {"total": len(rows), "actives": actives, "purchased_30d": purchased_30, "balance": balance, "avg_lead_days": avg_lead}

@api.get("/suppliers/{sid}")
async def supplier_detail(sid: str, user: dict = Depends(get_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Accès réservé au propriétaire")
    s = await db.suppliers.find_one({"id": sid})
    if not s: raise HTTPException(404)
    # Products from this supplier
    products = await db.products.find({"supplier": s.get("name")}).to_list(500)
    # POs
    pos = await db.purchase_orders.find({"supplier_id": sid}).sort("created_at", -1).to_list(200)
    purchased_total = sum(int(p.get("total", 0) or 0) for p in pos)
    margins = [((p["price"] - p["cost"]) / p["price"] * 100) for p in products if p.get("price", 0) > 0 and p.get("cost", 0) > 0]
    return clean({
        **s,
        "products": products,
        "purchase_orders": pos,
        "stats": {
            "purchased_total": purchased_total,
            "balance": int(s.get("balance", 0) or 0),
            "avg_margin": round(sum(margins) / len(margins), 1) if margins else 0,
            "product_count": len(products),
            "po_count": len(pos),
        }
    })

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
    po = await db.purchase_orders.find_one({"id": pid})
    if po and po.get("status") in ("recu", "receptionne", "cloture"): raise HTTPException(400, "Un bon reçu/clôturé ne peut être supprimé")
    await db.purchase_orders.delete_one({"id": pid})
    return {"ok": True}

@api.get("/purchase-orders/kpis")
async def po_kpis(user: dict = Depends(get_user)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    all_po = await db.purchase_orders.find({}).to_list(500)
    this_month = [p for p in all_po if (p.get("created_at") or "") >= cutoff]
    total_this_month = sum(int(p.get("total", 0) or 0) for p in this_month)
    pending = sum(1 for p in all_po if p.get("status") in ("en_attente", "brouillon", "commande"))
    partial = sum(1 for p in all_po if p.get("status") == "recu_partiel")
    due = sum(int(p.get("balance_due", 0) or 0) for p in all_po)
    margins = []
    for p in all_po:
        for it in p.get("items", []):
            cost = float(it.get("unit_cost", 0) or 0)
            sell = float(it.get("sell_price", 0) or 0)
            if cost > 0 and sell > 0: margins.append((sell - cost) / sell * 100)
    avg_m = round(sum(margins) / len(margins), 1) if margins else 0
    return {"this_month": len(this_month), "total_month": total_this_month, "pending": pending, "partial": partial, "due": due, "avg_expected_margin": avg_m}

@api.get("/purchase-orders/{pid}")
async def po_detail(pid: str, user: dict = Depends(get_user)):
    po = await db.purchase_orders.find_one({"id": pid})
    if not po: raise HTTPException(404)
    return clean(po)

@api.patch("/purchase-orders/{pid}/edit-guard")
async def po_edit(pid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    po = await db.purchase_orders.find_one({"id": pid})
    if not po: raise HTTPException(404)
    if po.get("status") in ("recu", "receptionne", "cloture"):
        raise HTTPException(400, "Bon reçu — lecture seule")
    body.pop("id", None); body.pop("_id", None)
    body["updated_at"] = now_iso()
    await db.purchase_orders.update_one({"id": pid}, {"$set": body})
    return {"ok": True}

@api.post("/purchase-orders/{pid}/blind-receive")
async def po_blind_receive(pid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    """Blind reception: receiver enters counted qty WITHOUT seeing ordered qty.
    Gaps are flagged, awaiting owner validation before stock is actually incremented."""
    po = await db.purchase_orders.find_one({"id": pid})
    if not po: raise HTTPException(404)
    if po.get("status") in ("recu", "cloture"):
        raise HTTPException(400, "Déjà réceptionné")
    counts = body.get("counts") or []  # [{line_id, qty_counted, photo?}]
    photos = body.get("photos") or []
    signature = body.get("signature")
    items = po.get("items", []) or []
    gaps = []
    for i, it in enumerate(items):
        count_rec = next((c for c in counts if c.get("line_id") == i or c.get("product_id") == it.get("product_id")), {})
        qty_counted = int(count_rec.get("qty_counted", 0))
        qty_ordered = int(it.get("qty", 0))
        it["qty_counted"] = qty_counted
        it["qty_ordered"] = qty_ordered
        if qty_counted != qty_ordered:
            gaps.append({"product_name": it.get("product_name"), "size": it.get("size"), "ordered": qty_ordered, "counted": qty_counted, "gap": qty_counted - qty_ordered})
    has_gaps = len(gaps) > 0
    status = "recu_partiel" if has_gaps else "recu"
    await db.purchase_orders.update_one({"id": pid}, {"$set": {
        "status": status,
        "items": items,
        "reception": {
            "received_by": user.get("name"), "received_by_id": user.get("id"),
            "at": now_iso(), "photos": photos, "signature": signature,
            "gaps": gaps, "validated": not has_gaps,
        },
        "received_at": now_iso(),
    }})
    # If no gaps, directly increment stock
    if not has_gaps:
        for it in items:
            if it.get("product_id") and it.get("size"):
                await db.products.update_one({"id": it["product_id"]},
                    {"$inc": {f"stock_by_size.{it['size']}": int(it.get("qty_counted", 0)), "stock": int(it.get("qty_counted", 0))}})
    return {"ok": True, "status": status, "gaps": gaps}

@api.post("/purchase-orders/{pid}/validate-gaps")
async def po_validate_gaps(pid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    """Owner reviews gaps and validates. Stock is incremented using the counted quantities."""
    po = await db.purchase_orders.find_one({"id": pid})
    if not po: raise HTTPException(404)
    rec = po.get("reception") or {}
    if rec.get("validated"): raise HTTPException(400, "Déjà validé")
    for it in po.get("items", []):
        if it.get("product_id") and it.get("size"):
            qty = int(it.get("qty_counted", it.get("qty", 0)))
            await db.products.update_one({"id": it["product_id"]},
                {"$inc": {f"stock_by_size.{it['size']}": qty, "stock": qty}})
    note = body.get("note") or ""
    await db.purchase_orders.update_one({"id": pid}, {"$set": {
        "status": "recu", "reception.validated": True,
        "reception.validated_by": user.get("name"), "reception.validated_at": now_iso(),
        "reception.validation_note": note,
    }})
    return {"ok": True}

# ---------- Pack 5: Stock & inventories ----------
@api.get("/stock/kpis")
async def stock_kpis(user: dict = Depends(get_user)):
    products = await db.products.find({}).to_list(2000)
    total_stock_value = sum((p.get("stock",0) or 0) * (p.get("cost",0) or 0) for p in products)
    items_in_stock = sum((p.get("stock",0) or 0) for p in products)
    ruptures = sum(1 for p in products if (p.get("stock",0) or 0) <= 0)
    low = sum(1 for p in products if 0 < (p.get("stock",0) or 0) < 5)
    # Dormant: no sales in 60d
    cutoff60 = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff60}, "status":{"$ne":"annulee"}}).to_list(5000)
    sold_pids = set()
    for o in orders:
        for it in o.get("items", []):
            if it.get("product_id"): sold_pids.add(it["product_id"])
    dormant = sum(1 for p in products if p["id"] not in sold_pids and (p.get("stock",0) or 0) > 0)
    # Stock immobilisé (age > 60j depuis création produit, et aucune vente)
    cutoff_age = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    aged = sum(1 for p in products if (p.get("stock",0) or 0) > 0 and (p.get("created_at") or now_iso()) < cutoff_age and p["id"] not in sold_pids)
    # Écarts du mois
    cutoff30 = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    adj = await db.stock_adjustments.find({"created_at": {"$gte": cutoff30}}).to_list(500)
    ecarts = sum(abs(int(a.get("qty_delta", 0) or 0)) for a in adj)
    return {"value": int(total_stock_value), "items": int(items_in_stock), "ruptures": ruptures, "low": low, "dormant": dormant, "aged": aged, "ecarts_month": ecarts}

@api.get("/stock/aged")
async def stock_aged(user: dict = Depends(get_user), days: int = 60):
    """List products immobilized longer than `days` with no recent sale."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    products = await db.products.find({}).to_list(2000)
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "status":{"$ne":"annulee"}}).to_list(5000)
    sold = set()
    for o in orders:
        for it in o.get("items", []):
            if it.get("product_id"): sold.add(it["product_id"])
    rows = []
    now_dt = datetime.now(timezone.utc)
    for p in products:
        if (p.get("stock",0) or 0) <= 0: continue
        if p["id"] in sold: continue
        created = p.get("created_at") or now_iso()
        try:
            age_days = (now_dt - datetime.fromisoformat(created.replace("Z","+00:00"))).days
        except Exception:
            age_days = 0
        if age_days < days: continue
        rows.append({
            "id": p["id"], "name": p.get("name"), "sku": p.get("sku"), "image": p.get("image"),
            "stock": p.get("stock",0), "cost": p.get("cost",0),
            "value": (p.get("stock",0) or 0) * (p.get("cost",0) or 0),
            "age_days": age_days,
        })
    rows.sort(key=lambda r: -r["age_days"])
    return {"days_threshold": days, "count": len(rows), "items": rows[:200]}

@api.get("/stock/movements")
async def stock_movements(user: dict = Depends(get_user)):
    rows = await db.stock_adjustments.find({}).sort("created_at", -1).to_list(200)
    return clean(rows)

@api.get("/stock/adjustment-requests")
async def stock_adj_requests(user: dict = Depends(get_user)):
    rows = await db.stock_adjustment_requests.find({}).sort("created_at", -1).to_list(100)
    return clean(rows)

@api.post("/stock/adjustment-requests")
async def stock_adj_request(body: Dict[str,Any], user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    doc = {"id": new_id(), "created_at": now_iso(), "status": "pending",
           "requested_by": user.get("name"), "requested_by_id": user.get("id"),
           "product_id": body.get("product_id"),
           "product_name": body.get("product_name"),
           "size": body.get("size"),
           "qty_delta": int(body.get("qty_delta", 0)),
           "reason": body.get("reason", ""),
    }
    # Admin requests are auto-approved
    if user.get("role") == "admin":
        doc["status"] = "approved"
        doc["approved_by"] = user.get("name")
        doc["approved_at"] = now_iso()
        if doc.get("product_id") and doc.get("size"):
            await db.products.update_one({"id": doc["product_id"]},
                {"$inc": {f"stock_by_size.{doc['size']}": doc["qty_delta"], "stock": doc["qty_delta"]}})
    await db.stock_adjustment_requests.insert_one(doc)
    return clean(doc)

@api.post("/stock/adjustment-requests/{aid}/decide")
async def stock_adj_decide(aid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin"))):
    doc = await db.stock_adjustment_requests.find_one({"id": aid})
    if not doc: raise HTTPException(404)
    if doc.get("status") != "pending": raise HTTPException(400, "Déjà traité")
    decision = body.get("decision")  # "approve" | "reject"
    note = body.get("note", "")
    if decision == "approve":
        if doc.get("product_id") and doc.get("size"):
            await db.products.update_one({"id": doc["product_id"]},
                {"$inc": {f"stock_by_size.{doc['size']}": int(doc.get("qty_delta",0)), "stock": int(doc.get("qty_delta",0))}})
        await db.stock_adjustment_requests.update_one({"id": aid}, {"$set": {"status":"approved", "approved_by": user.get("name"), "approved_at": now_iso(), "decision_note": note}})
    else:
        await db.stock_adjustment_requests.update_one({"id": aid}, {"$set": {"status":"rejected", "rejected_by": user.get("name"), "rejected_at": now_iso(), "decision_note": note}})
    return {"ok": True}

@api.get("/stock/inventories")
async def inventories_list(user: dict = Depends(get_user)):
    rows = await db.inventories.find({}).sort("created_at", -1).to_list(50)
    # Hide ordered qty from non-admin on open inventories (blind count)
    if user.get("role") != "admin":
        for r in rows:
            if r.get("status") == "open":
                for ln in r.get("lines", []):
                    ln.pop("qty_expected", None)
    return clean(rows)

@api.post("/stock/inventories")
async def inventory_create(body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    pids = body.get("product_ids") or []
    products = await db.products.find({"id":{"$in": pids}} if pids else {}).to_list(500)
    lines = []
    for p in products:
        for size, qty in (p.get("stock_by_size") or {"":p.get("stock",0)}).items():
            lines.append({"product_id": p["id"], "product_name": p["name"], "sku": p.get("sku",""), "size": size, "qty_expected": int(qty or 0), "qty_counted": None})
    doc = {"id": new_id(), "created_at": now_iso(), "created_by": user.get("name"),
           "status": "open", "name": body.get("name", f"Inventaire {datetime.now().strftime('%d/%m/%Y')}"),
           "lines": lines}
    await db.inventories.insert_one(doc)
    return clean(doc)

@api.post("/stock/inventories/{iid}/count")
async def inventory_count(iid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    inv = await db.inventories.find_one({"id": iid})
    if not inv: raise HTTPException(404)
    if inv.get("status") != "open": raise HTTPException(400, "Clôturé")
    counts = body.get("counts") or []  # [{line_index, qty_counted}]
    lines = inv.get("lines", [])
    for c in counts:
        i = int(c.get("line_index", -1))
        if 0 <= i < len(lines):
            lines[i]["qty_counted"] = int(c.get("qty_counted", 0))
            lines[i]["counted_by"] = user.get("name")
    await db.inventories.update_one({"id": iid}, {"$set": {"lines": lines, "updated_at": now_iso()}})
    return {"ok": True}

@api.post("/stock/inventories/{iid}/close")
async def inventory_close(iid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin"))):
    inv = await db.inventories.find_one({"id": iid})
    if not inv: raise HTTPException(404)
    gaps = []
    for ln in inv.get("lines", []):
        if ln.get("qty_counted") is None: continue
        gap = int(ln["qty_counted"]) - int(ln.get("qty_expected", 0))
        if gap != 0:
            gaps.append({**ln, "gap": gap})
            # Apply as stock adjustment
            await db.stock_adjustments.insert_one({
                "id": new_id(), "created_at": now_iso(), "created_by": user.get("name"),
                "product_id": ln.get("product_id"), "size": ln.get("size"),
                "qty_delta": gap, "reason": f"Inventaire {inv.get('name','')}",
                "source": "inventory", "inventory_id": iid,
            })
            if ln.get("product_id") and ln.get("size"):
                await db.products.update_one({"id": ln["product_id"]},
                    {"$inc": {f"stock_by_size.{ln['size']}": gap, "stock": gap}})
    await db.inventories.update_one({"id": iid}, {"$set": {"status":"closed","closed_at": now_iso(), "closed_by": user.get("name"), "gaps": gaps, "note": body.get("note","")}})
    return {"ok": True, "gaps": gaps}

# ---------- Promotions ----------

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

# ---------- Pack 6B: Segments CRUD (manual/auto/hybrid) ----------
class SegmentIn(BaseModel):
    name: str
    kind: str = "manual"  # manual | auto | hybrid
    rules: Optional[Dict[str, Any]] = None  # {zone, tier, total_spent_min, last_order_days_max, category, size, source, status}
    customer_ids: Optional[List[str]] = None  # manual picks or hybrid additions
    excluded_ids: Optional[List[str]] = None  # hybrid removals
    description: Optional[str] = None

async def _resolve_segment_ids(seg: dict) -> List[str]:
    kind = seg.get("kind", "manual")
    if kind == "manual":
        return seg.get("customer_ids") or []
    rules = seg.get("rules") or {}
    flt: Dict[str, Any] = {"status": {"$ne": "blacklist"}}
    if rules.get("zone"): flt["zone"] = rules["zone"]
    if rules.get("tier"): flt["tier"] = rules["tier"]
    if rules.get("status"): flt["status"] = rules["status"]
    if rules.get("source"): flt["source"] = rules["source"]
    if rules.get("size"): flt["$or"] = [{"shoe_size": rules["size"]}, {"top_size": rules["size"]}, {"bottom_size": rules["size"]}]
    if rules.get("total_spent_min"): flt["total_spent"] = {"$gte": int(rules["total_spent_min"])}
    if rules.get("last_order_days_max"):
        cutoff = (datetime.now(timezone.utc) - timedelta(days=int(rules["last_order_days_max"]))).isoformat()
        flt["last_order_at"] = {"$gte": cutoff}
    ids = []
    async for c in db.customers.find(flt, {"id": 1, "category_history": 1}):
        cat = rules.get("category")
        if cat and cat not in (c.get("category_history") or []):
            # fallback: check if customer ordered this category
            matched = await db.orders.find_one({"customer.id": c["id"], "items.category": cat})
            if not matched: continue
        ids.append(c["id"])
    if kind == "hybrid":
        add = set(seg.get("customer_ids") or [])
        rem = set(seg.get("excluded_ids") or [])
        return list((set(ids) | add) - rem)
    return ids

@api.get("/segments")
async def segments_list(user: dict = Depends(get_user)):
    rows = await db.customer_segments_v2.find({}).sort("created_at", -1).to_list(200)
    for r in rows:
        r["count"] = len(await _resolve_segment_ids(r))
    return clean(rows)

@api.post("/segments")
async def segments_create(body: SegmentIn, user: dict = Depends(require_role("admin","manager"))):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso(), "created_by": user.get("name")})
    await db.customer_segments_v2.insert_one(doc)
    doc["count"] = len(await _resolve_segment_ids(doc))
    return clean(doc)

@api.patch("/segments/{sid}")
async def segments_update(sid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("id", None); body.pop("_id", None); body["updated_at"] = now_iso()
    await db.customer_segments_v2.update_one({"id": sid}, {"$set": body})
    return {"ok": True}

@api.delete("/segments/{sid}")
async def segments_delete(sid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.customer_segments_v2.delete_one({"id": sid})
    return {"ok": True}

@api.get("/segments/{sid}/customers")
async def segments_customers(sid: str, user: dict = Depends(get_user)):
    seg = await db.customer_segments_v2.find_one({"id": sid})
    if not seg: raise HTTPException(404)
    ids = await _resolve_segment_ids(seg)
    rows = await db.customers.find({"id": {"$in": ids}}, {"password_hash": 0}).to_list(2000)
    return clean(rows)

# ---------- Pack 6B: Campaigns (multi-channel with report) ----------
class CampaignIn(BaseModel):
    name: str
    channels: List[str] = []  # whatsapp | inapp
    target_type: str = "all"  # all | segments | ids
    segment_ids: Optional[List[str]] = None
    customer_ids: Optional[List[str]] = None
    text: str
    image: Optional[str] = None
    link: Optional[str] = None
    offer: Optional[Dict[str, Any]] = None  # {code, discount_pct|discount_amount, valid_from, valid_to}
    scheduled_at: Optional[str] = None

async def _resolve_campaign_customers(c: dict) -> List[str]:
    if c.get("target_type") == "all":
        ids = []
        async for cust in db.customers.find({"status": "active"}, {"id": 1}): ids.append(cust["id"])
        return ids
    if c.get("target_type") == "ids": return c.get("customer_ids") or []
    out: set = set()
    for sid in c.get("segment_ids") or []:
        seg = await db.customer_segments_v2.find_one({"id": sid})
        if seg: out.update(await _resolve_segment_ids(seg))
    return list(out)

@api.get("/campaigns")
async def campaigns_list(user: dict = Depends(get_user)):
    rows = await db.campaigns.find({}).sort("created_at", -1).to_list(200)
    return clean(rows)

@api.post("/campaigns")
async def campaigns_create(body: CampaignIn, user: dict = Depends(require_role("admin","manager"))):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso(), "created_by": user.get("name"), "status": "draft",
                "stats": {"targets": 0, "sent": 0, "delivered": 0, "read": 0, "clicked": 0, "orders": 0, "revenue": 0}})
    doc["stats"]["targets"] = len(await _resolve_campaign_customers(doc))
    await db.campaigns.insert_one(doc)
    return clean(doc)

@api.patch("/campaigns/{cid}")
async def campaigns_update(cid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("id", None); body.pop("_id", None); body["updated_at"] = now_iso()
    await db.campaigns.update_one({"id": cid}, {"$set": body})
    return {"ok": True}

@api.delete("/campaigns/{cid}")
async def campaigns_delete(cid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.campaigns.delete_one({"id": cid})
    return {"ok": True}

def _render_template(text: str, c: dict, offer: dict | None) -> str:
    out = (text or "").replace("{prenom}", (c.get("name") or "").split(" ")[0]).replace("{nom}", c.get("name") or "")
    if offer:
        out = out.replace("{code}", str(offer.get("code") or "")).replace("{reduction}", str(offer.get("discount_pct") or offer.get("discount_amount") or ""))
    return out

@api.post("/campaigns/{cid}/send")
async def campaigns_send(cid: str, body: Dict[str, Any] | None = None, user: dict = Depends(require_role("admin","manager"))):
    c = await db.campaigns.find_one({"id": cid})
    if not c: raise HTTPException(404)
    if c.get("status") == "sent": raise HTTPException(400, "Déjà envoyée")
    customer_ids = await _resolve_campaign_customers(c)
    channels = c.get("channels") or []
    sent_wa = sent_in = 0
    for cid2 in customer_ids:
        cust = await db.customers.find_one({"id": cid2})
        if not cust: continue
        msg = _render_template(c.get("text", ""), cust, c.get("offer"))
        if "whatsapp" in channels and cust.get("wa_consent", True):
            phone_digits = "".join(ch for ch in (cust.get("phone") or "") if ch.isdigit())
            if phone_digits:
                link = f"https://wa.me/{phone_digits}?text={_url_quote(msg)}"
                await db.whatsapp_outbox.insert_one({
                    "id": new_id(), "customer_id": cid2, "customer_name": cust.get("name"),
                    "phone": cust.get("phone"), "phone_digits": phone_digits,
                    "message": msg, "link": link, "kind": "campaign", "campaign_id": cid,
                    "sent": False, "created_at": now_iso(), "created_by": user.get("name"),
                }); sent_wa += 1
        if "inapp" in channels and cust.get("msg_consent", True):
            try:
                await send_message({"customer_id": cid2, "text": msg, "kind": "boutique_cliente"}, user)
                sent_in += 1
            except Exception:
                pass
    stats_update = {
        "status": "sent", "sent_at": now_iso(),
        "stats.sent": sent_wa + sent_in,
        "stats.sent_wa": sent_wa,
        "stats.sent_inapp": sent_in,
        "stats.delivered": sent_in,  # in-app delivery is instant
    }
    await db.campaigns.update_one({"id": cid}, {"$set": stats_update})
    return {"ok": True, "sent_wa": sent_wa, "sent_inapp": sent_in, "targets": len(customer_ids)}

@api.get("/campaigns/{cid}/report")
async def campaigns_report(cid: str, user: dict = Depends(get_user)):
    c = await db.campaigns.find_one({"id": cid})
    if not c: raise HTTPException(404)
    # Compute CA generated: orders by target customers after sent_at
    sent_at = c.get("sent_at")
    orders_count = 0; revenue = 0
    if sent_at:
        customer_ids = await _resolve_campaign_customers(c)
        orders = await db.orders.find({"customer.id": {"$in": customer_ids}, "created_at": {"$gte": sent_at}, "status": {"$ne": "annulee"}}).to_list(2000)
        orders_count = len(orders); revenue = sum(int(o.get("total", 0) or 0) for o in orders)
    stats = {**(c.get("stats") or {}), "orders": orders_count, "revenue": revenue}
    return {"campaign": clean(c), "stats": stats}

# ---------- Pack 6B: Promotion types (renamable by owner) ----------
DEFAULT_PROMO_TYPES = [
    {"id": "percent", "label": "Pourcentage (%)", "mechanic": "percent", "builtin": True},
    {"id": "fixed", "label": "Montant fixe (FCFA)", "mechanic": "fixed", "builtin": True},
    {"id": "special_price", "label": "Prix spécial", "mechanic": "special_price", "builtin": True},
    {"id": "bogo", "label": "2 pour 1", "mechanic": "bogo", "builtin": True},
    {"id": "x_for_y", "label": "X acheté Y offert", "mechanic": "x_for_y", "builtin": True},
    {"id": "free_delivery", "label": "Livraison gratuite", "mechanic": "free_delivery", "builtin": True},
    {"id": "gift", "label": "Cadeau offert", "mechanic": "gift", "builtin": True},
]

async def _seed_promo_types():
    cnt = await db.promo_types.count_documents({})
    if cnt == 0:
        await db.promo_types.insert_many([{**t, "created_at": now_iso()} for t in DEFAULT_PROMO_TYPES])

@api.get("/promo-types")
async def promo_types_list(user: dict = Depends(get_user)):
    await _seed_promo_types()
    rows = await db.promo_types.find({}).to_list(200)
    return clean(rows)

@api.post("/promo-types")
async def promo_types_create(body: Dict[str, Any], user: dict = Depends(require_role("admin","manager"))):
    label = (body.get("label") or "").strip()
    mechanic = body.get("mechanic") or "percent"
    if not label: raise HTTPException(400, "Label requis")
    doc = {"id": new_id(), "label": label, "mechanic": mechanic, "builtin": False, "created_at": now_iso()}
    await db.promo_types.insert_one(doc)
    return clean(doc)

@api.patch("/promo-types/{pid}")
async def promo_types_update(pid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager"))):
    """Owner can rename labels on any type (even builtin). Mechanic is locked for builtin."""
    pt = await db.promo_types.find_one({"id": pid})
    if not pt: raise HTTPException(404)
    patch = {}
    if "label" in body and body["label"].strip(): patch["label"] = body["label"].strip()
    if "mechanic" in body and not pt.get("builtin"): patch["mechanic"] = body["mechanic"]
    patch["updated_at"] = now_iso()
    await db.promo_types.update_one({"id": pid}, {"$set": patch})
    return {"ok": True}

@api.delete("/promo-types/{pid}")
async def promo_types_delete(pid: str, user: dict = Depends(require_role("admin","manager"))):
    pt = await db.promo_types.find_one({"id": pid})
    if not pt: raise HTTPException(404)
    if pt.get("builtin"): raise HTTPException(400, "Type intégré — ne peut être supprimé (renommez-le plutôt)")
    await db.promo_types.delete_one({"id": pid})
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
    cancelled = sum(1 for o in orders_curr if o.get("status")=="annulee")
    cancelled_prev = sum(1 for o in orders_prev if o.get("status")=="annulee")
    deferred = sum(1 for o in orders_curr if o.get("status")=="reportee")
    cancel_rate = round(cancelled * 100 / max(1, len(orders_curr)), 1)
    cancel_rate_prev = round(cancelled_prev * 100 / max(1, len(orders_prev)), 1)
    pending = await db.orders.count_documents({"status": {"$in": ["nouvelle","confirmee","en_preparation","prete","assignee","en_livraison"]}})
    low_stock = await db.products.count_documents({"stock": {"$lt": 5}})
    expenses_total = sum(x.get("amount",0) for x in expenses_curr)

    # Load all products once for cost lookup
    all_products = {p["id"]: p for p in await db.products.find({}).to_list(5000)}
    cogs = 0
    for o in orders_curr:
        for it in o.get("items", []):
            p = all_products.get(it.get("product_id")) or {}
            cogs += int(p.get("cost", 0) or 0) * int(it.get("qty", 0) or 0)
    gross_margin = rev - cogs
    gross_margin_prev = 0
    for o in orders_prev:
        for it in o.get("items", []):
            p = all_products.get(it.get("product_id")) or {}
            gross_margin_prev += int(it.get("qty",0)*it.get("price",0)) - int(p.get("cost",0))*int(it.get("qty",0))

    # Timeseries with status split
    from datetime import datetime, timedelta, timezone
    days = (datetime.fromisoformat(e.replace("Z","+00:00")) - datetime.fromisoformat(s.replace("Z","+00:00"))).days or 1
    buckets = min(days, 30)
    step = max(1, days // buckets)
    series = []
    for i in range(buckets):
        t0 = datetime.fromisoformat(s.replace("Z","+00:00")) + timedelta(days=i*step)
        t1 = t0 + timedelta(days=step)
        label = t0.strftime("%d/%m")
        in_bucket = [o for o in orders_curr if t0.isoformat() <= o.get("created_at","") < t1.isoformat()]
        rv = sum(o.get("total",0) for o in in_bucket)
        # Day-level status counts
        d_order = len(in_bucket)
        d_deliv = sum(1 for o in in_bucket if o.get("status") == "livree")
        d_can = sum(1 for o in in_bucket if o.get("status") == "annulee")
        d_def = sum(1 for o in in_bucket if o.get("status") == "reportee")
        # Margin for this bucket
        mgn = 0
        for o in in_bucket:
            for it in o.get("items", []):
                p = all_products.get(it.get("product_id")) or {}
                mgn += int(it.get("qty",0))*int(it.get("price",0)) - int(p.get("cost",0))*int(it.get("qty",0))
        series.append({"date": label, "revenue": rv, "margin": mgn, "orders": d_order,
                       "delivered": d_deliv, "cancelled": d_can, "deferred": d_def})

    # Top products
    counts: Dict[str, Dict[str,Any]] = {}
    for o in orders_curr:
        for it in o.get("items", []):
            k = it["product_id"]
            if k not in counts: counts[k] = {"id": k, "name": it["name"], "qty": 0, "revenue": 0, "image": it.get("image")}
            counts[k]["qty"] += it["qty"]; counts[k]["revenue"] += it["qty"]*it["price"]
    top = sorted(counts.values(), key=lambda x: x["qty"], reverse=True)[:10]

    # By category table (Row 3)
    cat_agg: Dict[str, Dict[str,Any]] = {}
    cat_prev: Dict[str, int] = {}
    for o in orders_curr:
        for it in o.get("items", []):
            p = all_products.get(it.get("product_id")) or {}
            cat = p.get("category") or it.get("category") or "—"
            e_rev = int(it.get("qty",0)) * int(it.get("price",0))
            e_cost = int(p.get("cost",0)) * int(it.get("qty",0))
            if cat not in cat_agg: cat_agg[cat] = {"category": cat, "revenue": 0, "orders_ids": set(), "items": 0, "margin": 0}
            cat_agg[cat]["revenue"] += e_rev
            cat_agg[cat]["orders_ids"].add(o["id"])
            cat_agg[cat]["items"] += int(it.get("qty",0))
            cat_agg[cat]["margin"] += e_rev - e_cost
    for o in orders_prev:
        for it in o.get("items", []):
            p = all_products.get(it.get("product_id")) or {}
            cat = p.get("category") or it.get("category") or "—"
            cat_prev[cat] = cat_prev.get(cat, 0) + int(it.get("qty",0)) * int(it.get("price",0))
    by_category = []
    for cat, data in cat_agg.items():
        orders_n = len(data["orders_ids"])
        rv_cat = data["revenue"]; rv_prev_cat = cat_prev.get(cat, 0)
        by_category.append({
            "category": cat, "revenue": rv_cat, "orders": orders_n, "items": data["items"],
            "avg_basket": int(rv_cat / max(1, orders_n)),
            "margin": data["margin"],
            "margin_pct": round(data["margin"] * 100 / max(1, rv_cat), 1),
            "delta_pct": delta_pct(rv_cat, rv_prev_cat),
        })
    by_category.sort(key=lambda x: x["revenue"], reverse=True)

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
        "generated_at": now_iso(),
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
        "cancel_rate": {"value": cancel_rate, "prev": cancel_rate_prev, "delta": delta_pct(cancel_rate, cancel_rate_prev),
                         "description": "Taux d'annulation = commandes annulées / total × 100."},
        "cancelled": {"value": cancelled, "prev": cancelled_prev, "delta": delta_pct(cancelled, cancelled_prev),
                      "description": "Commandes annulées sur la période."},
        "deferred": {"value": deferred, "prev": 0, "delta": 0, "description": "Commandes reportées."},
        "pending_orders": {"value": pending, "prev": pending, "delta": 0,
                           "description": "Commandes en cours de traitement (non livrées, non annulées)."},
        "low_stock": {"value": low_stock, "prev": low_stock, "delta": 0,
                      "description": "Produits avec moins de 5 unités en stock."},
        "expenses": {"value": expenses_total, "prev": 0, "delta": 0,
                     "description": "Total des dépenses enregistrées sur la période."},
        "margin": {"value": gross_margin, "prev": gross_margin_prev, "delta": delta_pct(gross_margin, gross_margin_prev),
                   "description": "Marge brute = CA - coût des marchandises vendues."},
        "sales_series": series,
        "top_products": top[:5],
        "channels": [{"name": k, "count": v["count"], "value": v["value"]} for k,v in channels.items()],
        "payments": [{"name": k, "value": v} for k,v in payments.items()],
        "by_category": by_category,
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

# ---------- Pack 7B: Statistiques (12 tabs) ----------

async def _period_orders(period: str):
    s, e, ps, pe = period_range(period)
    curr = await db.orders.find({"created_at": {"$gte": s, "$lte": e}}).to_list(10000)
    prev = await db.orders.find({"created_at": {"$gte": ps, "$lte": pe}}).to_list(10000)
    return curr, prev, s, e, ps, pe

def _split_by_status(orders):
    return {
        "orders": sum(o.get("total", 0) for o in orders),
        "delivered": sum(o.get("total", 0) for o in orders if o.get("status") == "livree"),
        "cancelled": sum(o.get("total", 0) for o in orders if o.get("status") == "annulee"),
        "deferred": sum(o.get("total", 0) for o in orders if o.get("status") == "reportee"),
    }

@api.get("/stats/sales")
async def stats_sales(user: dict = Depends(get_user), period: str = "30d"):
    curr, prev, s, e, _, _ = await _period_orders(period)
    split = _split_by_status(curr); split_prev = _split_by_status(prev)
    cancel_rate = round(sum(1 for o in curr if o.get("status")=="annulee") * 100 / max(1,len(curr)), 1)
    defer_rate = round(sum(1 for o in curr if o.get("status")=="reportee") * 100 / max(1,len(curr)), 1)
    heatmap = [[0]*24 for _ in range(7)]; by_dow = [0]*7; by_hour = [0]*24
    for o in curr:
        try:
            dt = datetime.fromisoformat(o["created_at"].replace("Z","+00:00"))
            heatmap[dt.weekday()][dt.hour] += int(o.get("total",0))
            by_dow[dt.weekday()] += int(o.get("total",0))
            by_hour[dt.hour] += int(o.get("total",0))
        except Exception: pass
    channels: Dict[str,int] = {}; payments: Dict[str,int] = {}
    for o in curr:
        channels[o.get("channel","store")] = channels.get(o.get("channel","store"),0) + int(o.get("total",0))
        payments[o.get("payment_method","cash")] = payments.get(o.get("payment_method","cash"),0) + int(o.get("total",0))
    sellers: Dict[str,Dict] = {}
    for o in curr:
        n = o.get("vendeuse") or o.get("sold_by") or "—"
        if n not in sellers: sellers[n] = {"name":n,"revenue":0,"orders":0}
        sellers[n]["revenue"] += int(o.get("total",0)); sellers[n]["orders"] += 1
    cancel_r: Dict[str,int] = {}; defer_r: Dict[str,int] = {}
    for o in curr:
        if o.get("status")=="annulee": cancel_r[o.get("cancel_reason") or "Non renseigné"] = cancel_r.get(o.get("cancel_reason") or "Non renseigné",0)+1
        if o.get("status")=="reportee": defer_r[o.get("defer_reason") or "Non renseigné"] = defer_r.get(o.get("defer_reason") or "Non renseigné",0)+1
    return {"split":split,"split_prev":split_prev,"cancel_rate":cancel_rate,"defer_rate":defer_rate,
            "heatmap":heatmap,"by_dow":[{"day":d,"value":v} for d,v in zip(["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"],by_dow)],
            "by_hour":[{"hour":f"{h:02d}h","value":v} for h,v in enumerate(by_hour)],
            "channels":[{"name":k,"value":v} for k,v in channels.items()],
            "payments":[{"name":k,"value":v} for k,v in payments.items()],
            "sellers":sorted(sellers.values(),key=lambda x:x["revenue"],reverse=True),
            "cancel_reasons":[{"reason":k,"count":v} for k,v in cancel_r.items()],
            "defer_reasons":[{"reason":k,"count":v} for k,v in defer_r.items()],
            "discounts":sum(int(o.get("discount",0) or 0) for o in curr),
            "avg_basket":int(split["orders"]/max(1,len(curr)))}

@api.get("/stats/products")
async def stats_products(user: dict = Depends(get_user), period: str = "30d", product_id: Optional[str] = None):
    curr, _, _, _, _, _ = await _period_orders(period)
    products = {p["id"]: p for p in await db.products.find({}).to_list(5000)}
    agg: Dict[str,Dict] = {}; sold = set()
    for o in curr:
        for it in o.get("items",[]):
            pid = it.get("product_id") or ""
            if not pid: continue
            sold.add(pid)
            if pid not in agg:
                p = products.get(pid, {})
                agg[pid] = {"id":pid,"name":it.get("name"),"image":it.get("image"),"category":p.get("category",""),"brand":p.get("brand",""),"qty":0,"revenue":0,"margin":0}
            agg[pid]["qty"] += int(it.get("qty",0))
            agg[pid]["revenue"] += int(it.get("qty",0))*int(it.get("price",0))
            cost = int((products.get(pid) or {}).get("cost",0))
            agg[pid]["margin"] += (int(it.get("price",0))-cost)*int(it.get("qty",0))
    never = [{"id":p["id"],"name":p["name"],"sku":p.get("sku"),"image":p.get("image"),"stock":p.get("stock",0)} for p in products.values() if p["id"] not in sold][:50]
    variant = None
    if product_id:
        pdata = products.get(product_id)
        if pdata:
            ss: Dict[str,int] = {}; cs: Dict[str,int] = {}; matrix: Dict[str,Dict[str,int]] = {}
            for o in curr:
                for it in o.get("items",[]):
                    if it.get("product_id") != product_id: continue
                    s_ = it.get("size","—"); c_ = it.get("color","—"); q = int(it.get("qty",0))
                    ss[s_] = ss.get(s_,0)+q; cs[c_] = cs.get(c_,0)+q
                    matrix.setdefault(s_,{}).setdefault(c_,0); matrix[s_][c_] += q
            variant = {"product":{"id":pdata["id"],"name":pdata.get("name"),"image":pdata.get("image")},
                       "sizes":pdata.get("sizes",[]),"colors":pdata.get("colors",[]),
                       "stock_by_size":pdata.get("stock_by_size",{}),
                       "sales_by_size":ss,"sales_by_color":cs,"matrix":matrix}
    return {"by_qty":sorted(agg.values(),key=lambda x:x["qty"],reverse=True)[:50],
            "by_revenue":sorted(agg.values(),key=lambda x:x["revenue"],reverse=True)[:50],
            "by_margin":sorted(agg.values(),key=lambda x:x["margin"],reverse=True)[:50],
            "never_sold":never,"variant":variant}

@api.get("/stats/categories")
async def stats_categories(user: dict = Depends(get_user), period: str = "30d"):
    curr, prev, _, _, _, _ = await _period_orders(period)
    products = {p["id"]: p for p in await db.products.find({}).to_list(5000)}
    def agg(orders):
        d: Dict[str,Dict] = {}
        for o in orders:
            for it in o.get("items",[]):
                p = products.get(it.get("product_id")) or {}
                cat = p.get("category") or it.get("category") or "—"
                if cat not in d: d[cat] = {"category":cat,"revenue":0,"orders":set(),"items":0,"margin":0,"top_sizes":{},"top_colors":{}}
                rev = int(it.get("qty",0))*int(it.get("price",0)); cost = int(p.get("cost",0))*int(it.get("qty",0))
                d[cat]["revenue"] += rev; d[cat]["orders"].add(o["id"]); d[cat]["items"] += int(it.get("qty",0)); d[cat]["margin"] += rev-cost
                s_=it.get("size","—"); c_=it.get("color","—")
                d[cat]["top_sizes"][s_] = d[cat]["top_sizes"].get(s_,0)+int(it.get("qty",0))
                d[cat]["top_colors"][c_] = d[cat]["top_colors"].get(c_,0)+int(it.get("qty",0))
        return d
    curr_agg = agg(curr); prev_agg = agg(prev); rows = []
    for cat, data in curr_agg.items():
        prev_rev = (prev_agg.get(cat,{}) or {}).get("revenue",0)
        rows.append({"category":cat,"revenue":data["revenue"],"orders":len(data["orders"]),"items":data["items"],
                     "avg_basket":int(data["revenue"]/max(1,len(data["orders"]))),"margin":data["margin"],
                     "margin_pct":round(data["margin"]*100/max(1,data["revenue"]),1),
                     "delta_pct":delta_pct(data["revenue"],prev_rev),
                     "top_sizes":sorted([{"size":k,"qty":v} for k,v in data["top_sizes"].items()],key=lambda x:x["qty"],reverse=True)[:5],
                     "top_colors":sorted([{"color":k,"qty":v} for k,v in data["top_colors"].items()],key=lambda x:x["qty"],reverse=True)[:5]})
    rows.sort(key=lambda x:x["revenue"],reverse=True)
    return {"rows":rows}

@api.get("/stats/stock-purchases")
async def stats_stock_purchases(user: dict = Depends(get_user), period: str = "30d"):
    products = await db.products.find({}).to_list(5000)
    stock_value = sum((p.get("stock",0) or 0)*(p.get("cost",0) or 0) for p in products)
    ruptures = sum(1 for p in products if (p.get("stock",0) or 0)==0)
    low = sum(1 for p in products if 0 < (p.get("stock",0) or 0) < 5)
    cutoff = (datetime.now(timezone.utc)-timedelta(days=60)).isoformat()
    orders60 = await db.orders.find({"created_at":{"$gte":cutoff}}).to_list(10000)
    sold = set()
    for o in orders60:
        for it in o.get("items",[]):
            if it.get("product_id"): sold.add(it["product_id"])
    dormant = [{"id":p["id"],"name":p["name"],"stock":p.get("stock",0)} for p in products if p["id"] not in sold and (p.get("stock",0) or 0)>0][:50]
    rev_60 = 0
    for o in orders60:
        for it in o.get("items",[]):
            pm = next((p for p in products if p["id"]==it.get("product_id")),None)
            if pm: rev_60 += int(pm.get("cost",0))*int(it.get("qty",0))
    rotation = round(rev_60/max(1,stock_value)*6,2) if stock_value else 0
    pos = await db.purchase_orders.find({}).to_list(500)
    sup_agg: Dict[str,Dict] = {}
    for p in pos:
        sid = p.get("supplier_id") or "—"; name = p.get("supplier_name") or "—"
        if sid not in sup_agg: sup_agg[sid] = {"supplier_id":sid,"name":name,"purchased":0,"pos":0,"avg_lead":0}
        sup_agg[sid]["purchased"] += int(p.get("total",0)); sup_agg[sid]["pos"] += 1
    for s in await db.suppliers.find({}).to_list(500):
        if s["id"] in sup_agg: sup_agg[s["id"]]["avg_lead"] = s.get("lead_time_days",0)
    return {"stock_value":int(stock_value),"ruptures":ruptures,"low":low,"rotation":rotation,
            "dormant":dormant,"suppliers":sorted(sup_agg.values(),key=lambda x:x["purchased"],reverse=True)}

@api.get("/stats/orders-delivery")
async def stats_orders_delivery(user: dict = Depends(get_user), period: str = "30d"):
    curr, _, _, _, _, _ = await _period_orders(period)
    by_status: Dict[str,int] = {}
    for o in curr:
        s_ = o.get("status","nouvelle"); by_status[s_] = by_status.get(s_,0)+1
    rider: Dict[str,Dict] = {}; zones: Dict[str,Dict] = {}
    for o in curr:
        rid = o.get("rider_id")
        if rid:
            if rid not in rider: rider[rid] = {"rider_id":rid,"name":o.get("rider_name") or rid,"deliveries":0,"delivered":0,"cancelled":0,"revenue":0}
            rider[rid]["deliveries"] += 1
            if o.get("status")=="livree": rider[rid]["delivered"] += 1; rider[rid]["revenue"] += int(o.get("total",0))
            if o.get("status")=="annulee": rider[rid]["cancelled"] += 1
        z = o.get("delivery_zone") or "—"
        if z not in zones: zones[z] = {"zone":z,"orders":0,"delivered":0,"cancelled":0,"revenue":0}
        zones[z]["orders"] += 1
        if o.get("status")=="livree": zones[z]["delivered"] += 1; zones[z]["revenue"] += int(o.get("total",0))
        if o.get("status")=="annulee": zones[z]["cancelled"] += 1
    cancel_r: Dict[str,int] = {}; defer_r: Dict[str,int] = {}
    for o in curr:
        if o.get("status")=="annulee": cancel_r[o.get("cancel_reason") or "Non renseigné"] = cancel_r.get(o.get("cancel_reason") or "Non renseigné",0)+1
        if o.get("status")=="reportee": defer_r[o.get("defer_reason") or "Non renseigné"] = defer_r.get(o.get("defer_reason") or "Non renseigné",0)+1
    return {"by_status":[{"status":k,"count":v} for k,v in by_status.items()],
            "riders":sorted(rider.values(),key=lambda x:x["delivered"],reverse=True),
            "zones":sorted(zones.values(),key=lambda x:x["revenue"],reverse=True),
            "cancel_reasons":[{"reason":k,"count":v} for k,v in cancel_r.items()],
            "defer_reasons":[{"reason":k,"count":v} for k,v in defer_r.items()],
            "fees_collected":sum(int(o.get("delivery_fee",0) or 0) for o in curr if o.get("status")=="livree")}

@api.get("/stats/customers")
async def stats_customers(user: dict = Depends(get_user), period: str = "30d"):
    s, e, _, _ = period_range(period)
    orders = await db.orders.find({"created_at":{"$gte":s,"$lte":e}}).to_list(10000)
    customers = await db.customers.find({"status":{"$ne":"blacklist"}},{"password_hash":0}).to_list(5000)
    new = sum(1 for c in customers if (c.get("created_at") or "")>=s)
    recurring = sum(1 for c in customers if (c.get("total_orders") or 0)>1)
    ltv = int(sum(c.get("total_spent",0) for c in customers)/max(1,len(customers)))
    freq = round(sum(c.get("total_orders",0) for c in customers)/max(1,len(customers)),2)
    best = sorted(customers,key=lambda c:c.get("total_spent",0),reverse=True)[:20]
    zones = {}; cats = {}; sizes = {}; channels = {}
    for c in best:
        z = (c.get("addresses",[]) or [{}])[0].get("zone") if c.get("addresses") else None
        if z: zones[z] = zones.get(z,0)+1
        if c.get("shoe_size"): sizes[c["shoe_size"]] = sizes.get(c["shoe_size"],0)+1
    for o in orders:
        cust = o.get("customer") or {}
        if cust.get("id") in {b["id"] for b in best}:
            ch = o.get("channel","store"); channels[ch] = channels.get(ch,0)+1
            for it in o.get("items",[]):
                cat = it.get("category") or "—"; cats[cat] = cats.get(cat,0)+1
    bp = {"top_zones":sorted([{"zone":k,"count":v} for k,v in zones.items()],key=lambda x:x["count"],reverse=True)[:5],
          "top_cats":sorted([{"cat":k,"count":v} for k,v in cats.items()],key=lambda x:x["count"],reverse=True)[:5],
          "top_sizes":sorted([{"size":k,"count":v} for k,v in sizes.items()],key=lambda x:x["count"],reverse=True)[:5],
          "top_channels":sorted([{"channel":k,"count":v} for k,v in channels.items()],key=lambda x:x["count"],reverse=True)[:5]}
    return {"new":new,"recurring":recurring,"ltv":ltv,"frequency":freq,"best_profile":bp,
            "best_customers":clean(best[:10]),
            "segments":[{"name":seg["name"],"kind":seg["kind"]} for seg in await db.customer_segments_v2.find({}).to_list(100)]}

@api.get("/stats/demand")
async def stats_demand(user: dict = Depends(get_user), period: str = "30d"):
    waitlist = await db.waitlist.find({}).to_list(500)
    agg: Dict[str,Dict] = {}
    for w in waitlist:
        key = (w.get("product_id") or "")+"|"+(w.get("size") or "")+"|"+(w.get("color") or "")
        if key not in agg: agg[key] = {"product_name":w.get("product_name"),"size":w.get("size"),"color":w.get("color"),"count":0}
        agg[key]["count"] += 1
    favs: Dict[str,int] = {}
    async for c in db.customers.find({},{"favorites":1}):
        for f in (c.get("favorites") or []): favs[f] = favs.get(f,0)+1
    return {"waitlist":sorted(agg.values(),key=lambda x:x["count"],reverse=True),
            "searches_no_result":[],
            "top_favorites":sorted([{"product_id":k,"count":v} for k,v in favs.items()],key=lambda x:x["count"],reverse=True)[:20]}

@api.get("/stats/marketing")
async def stats_marketing(user: dict = Depends(get_user), period: str = "30d"):
    s, e, _, _ = period_range(period)
    customers = await db.customers.find({"created_at":{"$gte":s,"$lte":e}}).to_list(5000)
    sources: Dict[str,int] = {}
    for c in customers: sources[c.get("source") or "Direct"] = sources.get(c.get("source") or "Direct",0)+1
    return {"promotions":[{"code":p.get("code"),"uses":p.get("uses",0),"type":p.get("type")} for p in await db.promotions.find({}).to_list(200)],
            "campaigns":[{"name":c.get("name"),"stats":c.get("stats",{})} for c in await db.campaigns.find({}).to_list(200)],
            "sources":sorted([{"source":k,"count":v} for k,v in sources.items()],key=lambda x:x["count"],reverse=True),
            "loyalty_enabled":True}

@api.get("/stats/site")
async def stats_site(user: dict = Depends(get_user), period: str = "30d"):
    s, e, _, _ = period_range(period)
    orders_site = await db.orders.find({"created_at":{"$gte":s,"$lte":e},"channel":{"$in":["site","web","boutique_en_ligne"]}}).to_list(5000)
    return {"orders":len(orders_site),"revenue":sum(int(o.get("total",0)) for o in orders_site),
            "abandoned":await db.abandoned_carts.count_documents({"created_at":{"$gte":s,"$lte":e}}),
            "note":"Les métriques visites/pages/durée nécessitent l'intégration d'un outil d'analytique."}

@api.get("/stats/encaissements")
async def stats_encaissements(user: dict = Depends(get_user), period: str = "30d"):
    s, e, _, _ = period_range(period)
    orders = await db.orders.find({"created_at":{"$gte":s,"$lte":e},"status":{"$ne":"annulee"}}).to_list(10000)
    by_method: Dict[str,int] = {}; by_source: Dict[str,int] = {}; by_day: Dict[str,int] = {}
    for o in orders:
        by_method[o.get("payment_method","cash")] = by_method.get(o.get("payment_method","cash"),0)+int(o.get("total",0))
        src = "Livraison" if o.get("status")=="livree" and o.get("delivery_fee") else ("Boutique" if o.get("channel")=="store" else "En ligne")
        by_source[src] = by_source.get(src,0)+int(o.get("total",0))
        day = (o.get("created_at") or "")[:10]
        by_day[day] = by_day.get(day,0)+int(o.get("total",0))
    return {"by_method":[{"name":k,"value":v} for k,v in by_method.items()],
            "by_source":[{"name":k,"value":v} for k,v in by_source.items()],
            "by_day":sorted([{"day":k,"value":v} for k,v in by_day.items()],key=lambda x:x["day"]),
            "total":sum(by_method.values())}

@api.get("/stats/team")
async def stats_team(user: dict = Depends(get_user), period: str = "30d"):
    s, e, _, _ = period_range(period)
    orders = await db.orders.find({"created_at":{"$gte":s,"$lte":e}}).to_list(10000)
    sellers: Dict[str,Dict] = {}
    for o in orders:
        n = o.get("vendeuse") or o.get("sold_by") or "—"
        if n not in sellers: sellers[n] = {"name":n,"revenue":0,"orders":0}
        sellers[n]["revenue"] += int(o.get("total",0)); sellers[n]["orders"] += 1
    att_by_user: Dict[str,Dict] = {}
    for a in await db.attendance.find({}).sort("date",-1).to_list(200):
        uid = a.get("user_id")
        if not uid: continue
        if uid not in att_by_user: att_by_user[uid] = {"name":a.get("user_name") or uid,"present":0,"late":0,"absent":0}
        if a.get("status")=="present": att_by_user[uid]["present"] += 1
        elif a.get("status")=="late": att_by_user[uid]["late"] += 1
        elif a.get("status")=="absent": att_by_user[uid]["absent"] += 1
    return {"sellers":sorted(sellers.values(),key=lambda x:x["revenue"],reverse=True),
            "attendance":list(att_by_user.values())}

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
    patch = {"status": body.status, "moderated_by": user.get("name"), "moderated_at": now_iso()}
    if body.reply is not None:
        patch["reply"] = body.reply
        patch["reply_by"] = user.get("name")
        patch["reply_at"] = now_iso()
    await db.reviews.update_one({"id": rid}, {"$set": patch})
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

# ---------- Attendance (kiosk, legacy) ----------
@api.get("/attendance/today-kiosk")
async def attendance_today_kiosk(user: dict = Depends(get_user)):
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
        "selfie": body.selfie or None,
    }
    await db.attendance.insert_one(doc)
    return {"ok": True, "name": u.get("name"), "role": u.get("role"), "kind": body.kind, "at": doc["at"], "has_selfie": bool(body.selfie)}

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
    source: Optional[str] = "console"  # console | site | pos | search

@api.post("/waitlist")
async def waitlist_add(body: WaitlistIn, user: dict = Depends(get_user)):
    doc = {"id": new_id(), "product_id": body.product_id, "size": body.size,
           "phone": body.phone, "name": body.name or "Cliente",
           "source": body.source or "console",
           "created_at": now_iso(), "notified_at": None, "created_by": user.get("name")}
    await db.waitlist.insert_one(doc)
    return clean(doc)

@api.post("/public/waitlist")
async def public_waitlist_add(body: WaitlistIn):
    doc = {"id": new_id(), "product_id": body.product_id, "size": body.size,
           "phone": body.phone, "name": body.name or "Cliente",
           "source": body.source or "site",
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

async def _notify_waitlist_restock_dummy():
    pass  # placeholder removed

@api.get("/products/{pid}/history")
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

# ---------- Fix pack 1 : demo data seeding (Super admin only) ----------
DEMO_TAG = "DEMO_PACK1"

@api.post("/admin/seed-demo")
async def seed_demo(user: dict = Depends(require_role("admin"))):
    """Populate realistic demo data across the platform (Fix pack 1)."""
    import random as rnd
    created = {"customers": 0, "orders": 0, "expenses": 0, "visits": 0, "waitlist": 0, "abandoned": 0, "suppliers": 0, "purchases": 0, "reviews": 0}
    # Suppliers (5)
    supp_names = ["Textile Afrik SARL", "Mode & Co Istanbul", "Chaussures Milano", "Accessoires Dakar", "Ivoire Fabric"]
    if await db.suppliers.count_documents({}) < 5:
        for s in supp_names:
            await db.suppliers.insert_one({"id": new_id(), "name": s, "contact": f"+225 07 {rnd.randint(10,99)} {rnd.randint(10,99)} {rnd.randint(10,99)} {rnd.randint(10,99)}", "email": f"{s.lower().replace(' ','.')[:20]}@fournisseur.ci", "demo_tag": DEMO_TAG, "created_at": now_iso()})
            created["suppliers"] += 1
    # Customers (target 300)
    first_names = ["Awa","Fatou","Aïcha","Kadidja","Mariame","Aminata","Rokhaya","Nafissa","Yasmine","Zahra","Sarah","Ines","Nadia","Léa","Chloé","Mélanie","Sophia","Carla","Diana","Lina","Rama","Khady","Mame","Astou","Oumou","Nabou","Djeïnaba","Hawa","Salimata","Binta"]
    last_names = ["Diallo","Traoré","Ouattara","Konaté","Sow","Sanogo","Keita","Touré","Cissé","Koné","Camara","Fofana","Diabaté","Barry","Bamba","Yao","Kouassi","Konan","Kacou","N'Guessan"]
    zones = ["Cocody","Riviera","Angré","Plateau","Marcory","Zone 4","Treichville","Koumassi","Yopougon","Abobo","Adjamé","Port-Bouët","Bingerville","Grand-Bassam"]
    existing_c = await db.customers.count_documents({})
    to_create = max(0, 300 - existing_c)
    for i in range(to_create):
        fn = rnd.choice(first_names); ln = rnd.choice(last_names)
        c = {"id": new_id(), "name": f"{fn} {ln}", "phone": f"+225 0{rnd.randint(1,7)} {rnd.randint(10,99)} {rnd.randint(10,99)} {rnd.randint(10,99)} {rnd.randint(10,99)}",
             "email": f"{fn.lower()}.{ln.lower()}{rnd.randint(10,99)}@mail.ci",
             "address": f"{rnd.choice(zones)} · {rnd.choice(['près de la pharmacie','derrière l école','en face du marché'])}",
             "zone": rnd.choice(zones), "shoe_size": rnd.choice(["36","37","38","39","40","41","42"]),
             "clothing_size": rnd.choice(["XS","S","M","L","XL","XXL"]),
             "loyalty_points": rnd.randint(0,2000), "wallet": rnd.randint(0,25000)*100,
             "tier": rnd.choice(["Bronze","Argent","Or","Diamant"]),
             "referral_code": f"DINA-{rnd.randint(1000,9999)}", "status":"active",
             "created_at": (datetime.now(timezone.utc) - timedelta(days=rnd.randint(1,180))).isoformat(),
             "last_order_at": (datetime.now(timezone.utc) - timedelta(days=rnd.randint(0,120))).isoformat() if rnd.random()>0.3 else None,
             "demo_tag": DEMO_TAG}
        await db.customers.insert_one(c); created["customers"] += 1
    # Orders over 6 months (target 400+)
    customers = await db.customers.find({}).to_list(500)
    products = await db.products.find({}).to_list(500)
    if customers and products and await db.orders.count_documents({}) < 400:
        statuses = ["livree","confirmee","en_preparation","prete","en_livraison","annulee","retournee","nouvelle"]
        payments = ["cash","wave","orange","mtn","moov","cod"]
        channels = ["online","store","whatsapp","instagram"]
        for i in range(300):
            cust = rnd.choice(customers); n_items = rnd.randint(1,4)
            picks = rnd.sample(products, min(n_items, len(products)))
            items = [{"product_id":p["id"],"name":p["name"],"size":(p.get("sizes") or [""])[0],"color":(p.get("colors") or [""])[0] if p.get("colors") else "","qty":rnd.randint(1,2),"price":p.get("price",10000),"image":p.get("image")} for p in picks]
            sub = sum(it["qty"]*it["price"] for it in items)
            fee = rnd.choice([0,1000,1500,2000,2500]) if rnd.random()>0.3 else 0
            disc = rnd.choice([0,0,0,1000,2000]) if rnd.random()>0.7 else 0
            total = sub + fee - disc
            created_at = (datetime.now(timezone.utc) - timedelta(days=rnd.randint(0,180), hours=rnd.randint(0,23))).isoformat()
            status = rnd.choices(statuses, weights=[60,15,8,5,5,5,1,1])[0]
            await db.orders.insert_one({"id": new_id(), "code": gen_code(), "items": items, "customer": {"id":cust["id"],"name":cust["name"],"phone":cust["phone"]},
                "channel": rnd.choice(channels), "payment_method": rnd.choice(payments), "mode": "delivery" if fee>0 else "store", "store_id":"store-cocody",
                "delivery_zone": cust.get("zone"), "delivery_fee": fee, "discount": disc, "subtotal": sub, "total": total,
                "status": status, "payment_status": "paye" if status in ("livree",) else "en_attente",
                "created_at": created_at, "created_by": "Système démo", "demo_tag": DEMO_TAG,
                "timeline":[{"status": status,"at": created_at,"by":"Système démo"}]})
            created["orders"] += 1
    # Expenses 6 months
    if await db.expenses.count_documents({}) < 50:
        cats = ["Loyer","Électricité","Eau","Internet","Marketing","Achats fournitures","Salaires","Transport","Déplacement","Entretien","Impôts","Divers"]
        for i in range(80):
            await db.expenses.insert_one({"id": new_id(), "label": f"{rnd.choice(cats)} · {rnd.choice(['janvier','février','mars','avril','mai','juin'])}",
                "amount": rnd.randint(5,250)*1000, "category": rnd.choice(cats), "paid_at": (datetime.now(timezone.utc)-timedelta(days=rnd.randint(0,180))).isoformat(),
                "note":"", "demo_tag": DEMO_TAG, "created_at": now_iso()})
            created["expenses"] += 1
    # Storefront visits (90 days)
    if await db.site_visits.count_documents({}) < 300:
        pages = ["/boutique","/boutique/catalog","/boutique/product/x","/boutique/bons-plans","/boutique/compte"]
        for i in range(500):
            await db.site_visits.insert_one({"id": new_id(), "page": rnd.choice(pages), "zone": rnd.choice(zones),
                "device": rnd.choice(["mobile","mobile","mobile","desktop","tablet"]),
                "at": (datetime.now(timezone.utc)-timedelta(days=rnd.randint(0,90), hours=rnd.randint(0,23))).isoformat(),
                "demo_tag": DEMO_TAG})
            created["visits"] += 1
    # Waitlist (20)
    if products and customers:
        for i in range(20):
            p = rnd.choice(products); c = rnd.choice(customers)
            await db.waitlist.insert_one({"id": new_id(), "product_id": p["id"], "size": rnd.choice(p.get("sizes") or [""]),
                "phone": c["phone"], "name": c["name"], "notified_at": None,
                "created_at": (datetime.now(timezone.utc)-timedelta(days=rnd.randint(0,30))).isoformat(),
                "demo_tag": DEMO_TAG})
            created["waitlist"] += 1
    # Abandoned carts (30)
    if customers and products:
        for i in range(30):
            c = rnd.choice(customers); picks = rnd.sample(products, 2)
            items = [{"product_id":p["id"],"name":p["name"],"qty":1,"price":p.get("price",10000),"image":p.get("image")} for p in picks]
            await db.abandoned_carts.insert_one({"id": new_id(), "customer": {"id":c["id"],"name":c["name"],"phone":c["phone"]},
                "items": items, "total": sum(it["qty"]*it["price"] for it in items),
                "created_at": (datetime.now(timezone.utc)-timedelta(hours=rnd.randint(1,72))).isoformat(),
                "recovered": False, "demo_tag": DEMO_TAG})
            created["abandoned"] += 1
    # Reviews (30)
    if products and customers:
        for i in range(30):
            p = rnd.choice(products); c = rnd.choice(customers)
            await db.reviews.insert_one({"id": new_id(), "product_id": p["id"], "customer_name": c["name"],
                "rating": rnd.choice([4,4,5,5,5,3]), "comment": rnd.choice(["Très satisfaite !","Taille bien, qualité au top","Belle couleur, livraison rapide","Un peu grand mais parfait","J'adore 💕"]),
                "status":"pending" if rnd.random()>0.6 else "approved",
                "created_at": (datetime.now(timezone.utc)-timedelta(days=rnd.randint(0,60))).isoformat(),
                "demo_tag": DEMO_TAG})
            created["reviews"] += 1
    return {"ok": True, "created": created, "message": "Données de démonstration ajoutées"}

@api.delete("/admin/demo-data")
async def delete_demo_data(user: dict = Depends(require_role("admin"))):
    """Super admin only: wipe only entries tagged DEMO_PACK1."""
    deleted = {}
    for coll in ["customers","orders","expenses","site_visits","waitlist","abandoned_carts","reviews","suppliers","purchases","delivery_days"]:
        r = await db[coll].delete_many({"demo_tag": DEMO_TAG})
        deleted[coll] = r.deleted_count
    return {"ok": True, "deleted": deleted}


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
    existing = await db.cms_pages.find_one({"slug": body.slug})
    if existing: raise HTTPException(409, "Slug déjà utilisé")
    doc = body.model_dump(); doc.update({"id": new_id(), "created_at": now_iso()})
    await db.cms_pages.insert_one(doc)
    return clean(doc)

@api.patch("/pages/{slug}")
async def update_page(slug: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager"))):
    existing = await db.cms_pages.find_one({"slug": slug})
    if not existing: raise HTTPException(404, "Page introuvable")
    body.pop("_id", None); body.pop("id", None)
    body["updated_at"] = now_iso()
    await db.cms_pages.update_one({"slug": slug}, {"$set": body})
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

# ---------- Pack 5: AI Product description & SEO ----------
class ProductDescIn(BaseModel):
    name: str
    brand: Optional[str] = ""
    category: Optional[str] = ""
    attributes: Optional[Dict[str, Any]] = None  # {material, occasion, heel_type, care, etc.}
    colors: Optional[List[str]] = None
    sizes: Optional[List[str]] = None
    photos: Optional[List[str]] = None
    tone: Optional[str] = "elegant"  # elegant | chic | casual | luxe | playful
    length: Optional[str] = "medium"  # short | medium | long

class ProductSeoIn(BaseModel):
    name: str
    brand: Optional[str] = ""
    category: Optional[str] = ""
    description: Optional[str] = ""
    price: Optional[int] = 0

def _slug(s: str) -> str:
    import re, unicodedata
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFKD", s).encode("ascii","ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+","-", s).strip("-")
    return s[:80]

@api.post("/ai/product-description")
async def ai_product_description(body: ProductDescIn, user: dict = Depends(get_user)):
    if not body.name: raise HTTPException(400, "Nom requis")
    attrs = body.attributes or {}
    attrs_s = ", ".join(f"{k}: {v}" for k, v in attrs.items() if v)
    tone_map = {
        "elegant": "élégant et vendeur, un peu luxueux",
        "chic": "chic parisien, intemporel",
        "casual": "simple, décontracté, chaleureux",
        "luxe": "très premium, mots raffinés",
        "playful": "fun, enjoué, émojis parcimonieux",
    }
    tone_desc = tone_map.get(body.tone or "elegant", tone_map["elegant"])
    length_map = {"short": "3 phrases + 4 bullet points", "medium": "4 phrases + 5 bullet points", "long": "5 phrases + 6 bullet points"}
    len_desc = length_map.get(body.length or "medium", length_map["medium"])
    system = ("Tu es rédacteur produit pour 'Chez Dina', boutique de mode féminine à Abidjan. "
              "Tu écris UNIQUEMENT en français, pour une cliente ivoirienne. "
              "Ne JAMAIS inventer de données commerciales (ventes, popularité, nombre de clientes). "
              "Interdit : prix, promotions, chiffres de vente, 'best-seller', 'populaire'. "
              f"Ton : {tone_desc}. Format : {len_desc}. "
              "Structure : d'abord un paragraphe descriptif, puis une liste de bullet points '- '.")
    user_msg = (f"Produit : {body.name}\n"
                f"Marque : {body.brand or '—'}\n"
                f"Catégorie : {body.category or '—'}\n"
                f"Attributs : {attrs_s or '—'}\n"
                f"Couleurs : {', '.join(body.colors or []) or '—'}\n"
                f"Tailles : {', '.join(body.sizes or []) or '—'}\n"
                f"Rédige la description.")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY",""), session_id=f"dina-desc-{user['id']}-{new_id()[:6]}", system_message=system).with_model("anthropic","claude-sonnet-4-5-20250929")
        reply = await chat.send_message(UserMessage(text=user_msg))
        return {"description": str(reply).strip()}
    except Exception:
        logger.exception("AI product desc")
        # Fallback template
        bullets = ["Matière confortable et tendance", "Taille conforme — voir guide des tailles", "Idéal pour une tenue de soirée ou cérémonie", "Entretien facile — lavage à la main recommandé"]
        fb = f"Découvrez {body.name}, une pièce signée {body.brand or 'Chez Dina'} qui incarne l'élégance moderne. Pensée pour la femme ivoirienne active, elle se porte aussi bien en journée qu'en soirée. Son coupe soignée met en valeur votre silhouette avec allure.\n\n" + "\n".join(f"- {b}" for b in bullets)
        return {"description": fb, "fallback": True}

@api.post("/ai/product-seo")
async def ai_product_seo(body: ProductSeoIn, user: dict = Depends(get_user)):
    if not body.name: raise HTTPException(400, "Nom requis")
    slug = _slug(f"{body.name}-{body.brand}" if body.brand else body.name)
    system = ("Tu es expert SEO pour boutique mode féminine Abidjan. Réponds UNIQUEMENT en JSON valide. "
              "Interdit : chiffres de vente, superlatifs comme 'meilleur'. En français, cliente ivoirienne.")
    user_msg = (f"Produit: {body.name} | Marque: {body.brand} | Catégorie: {body.category} | Prix: {body.price} FCFA.\n"
                f"Génère :\n"
                f"- seo_title (max 60 caractères, inclut nom + marque)\n"
                f"- seo_description (max 160 caractères, incitatif, inclut Abidjan ou Côte d'Ivoire)\n"
                f"Réponds strictement : {{\"seo_title\":\"...\",\"seo_description\":\"...\"}}")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY",""), session_id=f"dina-seo-{user['id']}-{new_id()[:6]}", system_message=system).with_model("anthropic","claude-sonnet-4-5-20250929")
        reply = await chat.send_message(UserMessage(text=user_msg))
        import json as _json, re as _re
        txt = str(reply)
        m = _re.search(r"\{.*?\}", txt, _re.DOTALL)
        obj = _json.loads(m.group(0)) if m else {}
        return {
            "seo_title": (obj.get("seo_title") or f"{body.name} - {body.brand or 'Chez Dina'}")[:60],
            "seo_description": (obj.get("seo_description") or f"Découvrez {body.name} chez Dina Abidjan. Livraison rapide, paiement à la livraison.")[:160],
            "slug": slug,
        }
    except Exception:
        logger.exception("AI SEO")
        return {
            "seo_title": f"{body.name} - {body.brand or 'Chez Dina'}"[:60],
            "seo_description": f"Découvrez {body.name} chez Dina à Abidjan. Livraison rapide dans toute la Côte d'Ivoire."[:160],
            "slug": slug,
            "fallback": True,
        }

# ---------- Pack 5: Brands enrichment ----------
@api.get("/brands/kpis")
async def brands_kpis(user: dict = Depends(get_user)):
    stored = await db.brands.find({}).to_list(500)
    distinct = await db.products.distinct("brand")
    names = sorted(set(distinct) | {b["name"] for b in stored if b.get("name")})
    active_names = {b["name"] for b in stored if b.get("status") != "inactive"} | set(distinct)
    total_products = await db.products.count_documents({})
    # CA 30d par marque
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "status":{"$ne":"annulee"}}).to_list(5000)
    ca_by_brand: Dict[str, int] = {}
    for o in orders:
        for it in o.get("items", []):
            b = it.get("brand") or ""
            if not b and it.get("product_id"):
                p = await db.products.find_one({"id": it["product_id"]})
                b = (p or {}).get("brand", "")
            if b: ca_by_brand[b] = ca_by_brand.get(b, 0) + int(it.get("qty",0)) * int(it.get("price",0))
    top_brand = max(ca_by_brand.items(), key=lambda x:x[1])[0] if ca_by_brand else ""
    # Marge moyenne par marque
    all_p = await db.products.find({}).to_list(2000)
    margins = []
    for p in all_p:
        if p.get("price",0) > 0 and p.get("cost",0) > 0:
            margins.append((p["price"] - p["cost"]) / p["price"] * 100)
    avg_m = round(sum(margins)/len(margins),1) if margins else 0
    return {
        "total": len(names),
        "actives": len(active_names),
        "avg_products": round(total_products / len(names), 1) if names else 0,
        "top_brand": top_brand,
        "top_brand_ca": ca_by_brand.get(top_brand, 0),
        "avg_margin": avg_m,
    }

# Enrich /brands with ca_30d + margin per brand
@api.get("/brands/full")
async def list_brands_full(user: dict = Depends(get_user)):
    distinct = await db.products.distinct("brand")
    stored = {b["name"]: b for b in await db.brands.find({}).to_list(500)}
    names = sorted(set(distinct) | set(stored.keys()))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "status":{"$ne":"annulee"}}).to_list(5000)
    ca_by_brand: Dict[str, int] = {}
    for o in orders:
        for it in o.get("items", []):
            b = it.get("brand") or ""
            if not b and it.get("product_id"):
                p = await db.products.find_one({"id": it["product_id"]})
                b = (p or {}).get("brand", "")
            if b: ca_by_brand[b] = ca_by_brand.get(b, 0) + int(it.get("qty",0)) * int(it.get("price",0))
    out = []
    for name in names:
        s = stored.get(name, {})
        products = await db.products.find({"brand": name}).to_list(500)
        margins = [((p["price"]-p["cost"])/p["price"]*100) for p in products if p.get("price",0) > 0 and p.get("cost",0) > 0]
        out.append({
            "id": s.get("id") or new_id(),
            "name": name,
            "logo": s.get("logo",""),
            "note": s.get("note",""),
            "status": s.get("status","active"),
            "product_count": len(products),
            "ca_30d": ca_by_brand.get(name, 0),
            "avg_margin": round(sum(margins)/len(margins),1) if margins else 0,
        })
    return out

@api.get("/brands/{bid}")
async def brand_detail(bid: str, user: dict = Depends(get_user)):
    b = await db.brands.find_one({"id": bid})
    if not b:
        # fallback: find by name among products (derived brand)
        b = {"id": bid, "name": bid, "note": "", "logo": "", "status":"active"}
    name = b.get("name")
    products = await db.products.find({"brand": name}).to_list(500)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "status":{"$ne":"annulee"}}).to_list(5000)
    ca_30 = 0
    for o in orders:
        for it in o.get("items", []):
            if it.get("brand") == name or any(p for p in products if p["id"] == it.get("product_id")):
                ca_30 += int(it.get("qty",0)) * int(it.get("price",0))
    margins = [((p["price"]-p["cost"])/p["price"]*100) for p in products if p.get("price",0) > 0 and p.get("cost",0) > 0]
    stock_value = sum((p.get("stock",0) or 0) * (p.get("price",0) or 0) for p in products)
    return clean({**b, "products": products, "stats": {
        "product_count": len(products),
        "ca_30d": ca_30,
        "avg_margin": round(sum(margins)/len(margins),1) if margins else 0,
        "stock_value": stock_value,
    }})

# ---------- Pack 5: Categories tree (parent_id + visible + image + order) ----------
class CategoryIn(BaseModel):
    name: str
    parent_id: Optional[str] = None
    image: Optional[str] = None
    order: int = 0
    visible: bool = True
    note: Optional[str] = None

@api.get("/categories/tree")
async def categories_tree(user: dict = Depends(get_user)):
    stored = await db.categories.find({}).to_list(500)
    distinct = await db.products.distinct("category")
    # Ensure a doc exists for every product-derived category (for counts)
    stored_names = {c["name"] for c in stored}
    extras = [{"id": new_id(), "name": n, "parent_id": None, "image":"","order":999,"visible":True,"note":""} for n in distinct if n and n not in stored_names]
    all_cats = stored + extras
    # product_count
    for c in all_cats:
        c["product_count"] = await db.products.count_documents({"category": c["name"]})
    # Build tree
    by_id = {c["id"]: {**c, "children": []} for c in all_cats}
    roots = []
    for c in all_cats:
        pid = c.get("parent_id")
        if pid and pid in by_id:
            by_id[pid]["children"].append(by_id[c["id"]])
        else:
            roots.append(by_id[c["id"]])
    roots.sort(key=lambda x: (x.get("order", 999), x["name"]))
    for r in roots:
        r["children"].sort(key=lambda x: (x.get("order", 999), x["name"]))
    return clean(roots)

@api.get("/categories/kpis")
async def categories_kpis(user: dict = Depends(get_user)):
    stored = await db.categories.find({}).to_list(500)
    distinct = await db.products.distinct("category")
    names = set([c["name"] for c in stored]) | set([n for n in distinct if n])
    with_parent = sum(1 for c in stored if c.get("parent_id"))
    # top category by sales 30d
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "status":{"$ne":"annulee"}}).to_list(5000)
    sales: Dict[str,int] = {}
    for o in orders:
        for it in o.get("items", []):
            cat = it.get("category") or ""
            if not cat and it.get("product_id"):
                p = await db.products.find_one({"id": it["product_id"]})
                cat = (p or {}).get("category","")
            if cat: sales[cat] = sales.get(cat, 0) + int(it.get("qty",0)) * int(it.get("price",0))
    top = max(sales.items(), key=lambda x:x[1])[0] if sales else ""
    return {"total": len(names), "sub": with_parent, "top": top, "top_ca": sales.get(top, 0)}

@api.patch("/categories/{cid}")
async def update_category(cid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("_id",None); body.pop("id",None)
    body["updated_at"] = now_iso()
    old = await db.categories.find_one({"id": cid})
    if not old:
        # upsert new record for a derived category
        body["id"] = cid
        await db.categories.insert_one(body)
    else:
        if body.get("name") and old.get("name") and old["name"] != body["name"]:
            await db.products.update_many({"category": old["name"]}, {"$set": {"category": body["name"]}})
        await db.categories.update_one({"id": cid}, {"$set": body})
    return {"ok": True}

# ---------- Pack 5: Collections ----------
class CollectionIn(BaseModel):
    name: str
    kind: str = "manual"  # manual | auto
    rules: Optional[Dict[str, Any]] = None  # for auto: {category, brand, price_max, tags}
    product_ids: Optional[List[str]] = None  # for manual
    banner: Optional[str] = None
    description: Optional[str] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    visible: bool = True

@api.get("/collections")
async def list_collections(user: dict = Depends(get_user)):
    cols = await db.collections.find({}).to_list(200)
    # Resolve products for each
    for c in cols:
        if c.get("kind") == "auto":
            rules = c.get("rules") or {}
            flt: Dict[str, Any] = {}
            if rules.get("category"): flt["category"] = rules["category"]
            if rules.get("brand"): flt["brand"] = rules["brand"]
            if rules.get("price_max"): flt["price"] = {"$lte": int(rules["price_max"])}
            c["product_count"] = await db.products.count_documents(flt) if flt else 0
        else:
            c["product_count"] = len(c.get("product_ids") or [])
    return clean(cols)

@api.post("/collections")
async def create_collection(body: CollectionIn, user: dict = Depends(require_role("admin","manager"))):
    doc = body.model_dump(); doc.update({"id": new_id(), "created_at": now_iso()})
    await db.collections.insert_one(doc)
    return clean(doc)

@api.patch("/collections/{cid}")
async def update_collection(cid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("_id",None); body.pop("id",None)
    body["updated_at"] = now_iso()
    await db.collections.update_one({"id": cid}, {"$set": body})
    return {"ok": True}

@api.delete("/collections/{cid}")
async def delete_collection(cid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.collections.delete_one({"id": cid})
    return {"ok": True}

@api.get("/collections/kpis")
async def collections_kpis(user: dict = Depends(get_user)):
    all_c = await db.collections.find({}).to_list(500)
    actives = sum(1 for c in all_c if c.get("visible", True))
    manual_products = sum(len(c.get("product_ids") or []) for c in all_c)
    return {"total": len(all_c), "actives": actives, "products": manual_products}

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

@api.get("/public/business")
async def get_public_business():
    """Public business info (name, tagline, whatsapp, address) used by the storefront footer."""
    b = await db.business.find_one({"id":"main"}) or {}
    return {
        "name": b.get("name") or "Chez Dina",
        "tagline": b.get("tagline") or "Mode féminine · Abidjan.",
        "whatsapp": b.get("whatsapp") or "+225 07 77 92 61 79",
        "phone": b.get("phone"),
        "address": b.get("address"),
        "tiktok": b.get("tiktok"),
    }

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

async def _search_manual(q: str, role: str) -> Optional[Dict[str, Any]]:
    """Search manual_modules for the top matching section. Returns {module, section, snippet, score}."""
    ql = (q or "").lower().strip()
    if not ql or len(ql) < 3: return None
    tokens = [t for t in ql.replace("?","").replace("!","").split() if len(t) > 2]
    if not tokens: return None
    f = {"roles": role} if role else {}
    modules = await db.manual_modules.find(f).to_list(100)
    best = None
    for m in modules:
        for sec in m.get("sections") or []:
            def _items_text(it):
                try:
                    return " ".join(
                        (x if isinstance(x, str) else (x.get("text") or x.get("content") or x.get("label") or ""))
                        for x in (it or [])
                    )
                except Exception:
                    return ""
            hay = (sec.get("heading","") + " " + " ".join(
                (b.get("content","") or b.get("text","") or _items_text(b.get("items",[])))
                for b in sec.get("blocks") or []
            )).lower()
            score = sum(hay.count(t) for t in tokens)
            if score > 0 and (not best or score > best["score"]):
                snippet = hay[:220]
                best = {"module_number": m["number"], "module_title": m["title"],
                        "section_id": sec.get("id"), "section_heading": sec.get("heading"),
                        "snippet": snippet, "score": score}
    return best

@api.post("/ai/ask")
async def ask_dina(body: AskIn, user: dict = Depends(get_user)):
    q = body.question
    # 0) Try manual first — "how-to" questions should get procedural answers
    is_howto = any(w in (q or "").lower() for w in ["comment","how","faire","créer","créé","modifier","supprimer","remboursement","remise","préparer","clôturer","imprimer","exporter","ajouter","retrouver","trouver","configurer"])
    if is_howto:
        hit = await _search_manual(q, user.get("role",""))
        if hit:
            # Load the full section for a cleaner answer
            m = await db.manual_modules.find_one({"number": hit["module_number"]})
            sec = next((s for s in (m or {}).get("sections") or [] if s.get("id") == hit["section_id"]), None)
            lines = [f"**Module {hit['module_number']} · {hit['module_title']}** — section « {hit['section_heading']} »:\n"]
            def _item_str(x):
                if isinstance(x, str): return x
                if isinstance(x, dict): return x.get("text") or x.get("content") or x.get("label") or ""
                return str(x)
            for b in (sec or {}).get("blocks") or []:
                if b.get("type") == "steps":
                    for i, s in enumerate(b.get("items") or [], 1):
                        lines.append(f"{i}. {_item_str(s)}")
                elif b.get("type") == "list":
                    for s in b.get("items") or []:
                        lines.append(f"• {_item_str(s)}")
                elif b.get("content"):
                    lines.append(b["content"])
                elif b.get("text"):
                    lines.append(b["text"])
            lines.append(f"\n👉 Voir dans le manuel : Module {hit['module_number']}, section « {hit['section_heading'] }»")
            return {"answer": "\n".join(lines), "source": "manual", "manual_hint": {
                "module_number": hit["module_number"], "section_id": hit["section_id"],
                "deep_link": f"/console/manuel/{hit['module_number']}#{hit['section_id']}"
            }}
        else:
            # Log unanswered how-to for the owner to complete the manual
            try:
                await db.manual_gaps.insert_one({"id": new_id(), "question": q, "asked_by": user.get("name"), "role": user.get("role"), "at": now_iso()})
            except Exception: pass
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

@api.post("/manual/reseed")
async def manual_reseed(user: dict = Depends(require_role("admin"))):
    """Rebuild manual_modules with the richer illustrated version (annotated screenshots, FAQ, glossary, A4 memos).
    Idempotent — overwrites existing docs by `number`.
    """
    RICH = [
        {"number": 1, "title": "Prise en main", "icon": "LogIn",
         "description": "Connexion, pointage à l'écran kiosk et navigation dans la console",
         "roles": ["admin","manager","sales","stock_keeper","rider"],
         "path_hints": ["/console", "/console/pointage"],
         "sections": [
            {"id": "s1-login", "heading": "Se connecter en 3 étapes",
             "blocks": [
                {"type": "steps", "items": [
                    "Ouvrez l'adresse de la console sur votre tablette ou votre ordinateur",
                    "Entrez votre email professionnel et votre mot de passe",
                    "Cliquez sur « Se connecter » — vous arrivez sur le tableau de bord",
                ]},
                {"type": "annotated", "screen": "dashboard",
                 "caption": "Après connexion vous voyez vos chiffres du jour en un coup d'œil",
                 "callouts": [
                    {"x": 25, "y": 10, "n": 1, "label": "Votre nom en haut à droite"},
                    {"x": 68, "y": 10, "n": 2, "label": "Choisir la période"},
                    {"x": 25, "y": 30, "n": 3, "w": 20, "h": 15, "label": "Vos KPI principaux"},
                 ]},
                {"type": "callout", "variant": "tip",
                 "text": "Si vous oubliez votre mot de passe, demandez à la propriétaire — elle peut le réinitialiser depuis Équipe."},
            ]},
            {"id": "s1-kiosk", "heading": "Pointer à l'arrivée et au départ (kiosk)",
             "blocks": [
                {"type": "text", "content": "Le pointage se fait depuis l'onglet « Pointage » sur la tablette boutique. Pas besoin de connexion complète : juste votre code PIN à 4 chiffres."},
                {"type": "steps", "items": [
                    "Ouvrez l'onglet Pointage (ou laissez-le ouvert en mode kiosk sur la tablette)",
                    "Choisissez « Arrivée » ou « Départ » (vert à l'arrivée, rouge au départ)",
                    "Tapez vos 4 chiffres sur le pavé — un selfie est pris automatiquement",
                    "Votre nom s'affiche en vert : c'est confirmé",
                ]},
                {"type": "callout", "variant": "info",
                 "text": "Si la caméra ne fonctionne pas, le pointage marche quand même, sans selfie — un badge rouge le signale."},
            ]},
            {"id": "s1-nav", "heading": "Trouver un module rapidement",
             "blocks": [
                {"type": "list", "items": [
                    "La barre de gauche regroupe tous vos modules par thème",
                    "La barre de recherche en haut cherche produits, clientes et commandes en même temps",
                    "Le bouton « Dina IA » en bas à droite répond à vos questions avec des étapes",
                ]},
                {"type": "faq", "items": [
                    {"q": "Je ne vois pas certaines pages, c'est normal ?", "a": "Oui — chaque rôle voit uniquement les pages qui le concernent. Demandez à la propriétaire si vous avez besoin d'un accès."},
                    {"q": "Puis-je ouvrir la console sur mon téléphone ?", "a": "Oui, tout est responsive. Pour un usage quotidien préférez une tablette ou un ordinateur."},
                ]},
            ]},
         ]},
        {"number": 2, "title": "Faire une vente à la caisse", "icon": "ShoppingCart",
         "description": "Encaisser une cliente en moins de 60 secondes",
         "roles": ["admin","manager","sales"],
         "path_hints": ["/console/pos"],
         "sections": [
            {"id": "s2-session", "heading": "Ouvrir sa session de caisse",
             "blocks": [
                {"type": "text", "content": "Chaque jour, avant la première vente, vous devez ouvrir une session en comptant le fond de caisse. Sinon la caisse reste bloquée."},
                {"type": "annotated", "screen": "cash_session",
                 "caption": "La session en cours doit toujours afficher votre nom et l'heure d'ouverture",
                 "callouts": [
                    {"x": 15, "y": 32, "n": 1, "label": "Fond initial à saisir"},
                    {"x": 50, "y": 65, "n": 2, "label": "Déclarer le versement à la propriétaire"},
                    {"x": 82, "y": 65, "n": 3, "label": "La propriétaire valide"},
                 ]},
                {"type": "steps", "items": [
                    "Comptez l'argent présent dans le tiroir",
                    "Ouvrez l'onglet Caisse — un panneau rouge vous demande d'ouvrir la session",
                    "Entrez le montant exact et cliquez « Ouvrir la session »",
                    "La caisse est débloquée, bonne journée !",
                ]},
            ]},
            {"id": "s2-sell", "heading": "Encaisser une vente",
             "blocks": [
                {"type": "annotated", "screen": "pos_cart",
                 "caption": "L'écran de caisse en 3 zones : panier, totaux, paiement",
                 "callouts": [
                    {"x": 20, "y": 8, "n": 1, "label": "Choisir la cliente"},
                    {"x": 35, "y": 35, "n": 2, "w": 45, "h": 25, "label": "Articles ajoutés"},
                    {"x": 70, "y": 25, "n": 3, "label": "Choisir le mode de paiement"},
                    {"x": 70, "y": 85, "n": 4, "label": "Encaisser"},
                 ]},
                {"type": "steps", "items": [
                    "Sélectionnez la cliente (ou créez-la en 1 clic si c'est sa première visite)",
                    "Scannez ou tapez les articles — le total se met à jour en direct",
                    "Appliquez une remise seulement si la propriétaire l'a autorisée",
                    "Choisissez le mode de paiement : Espèces, Wave, Orange Money, MTN, Mixte",
                    "Cliquez « Encaisser » — le reçu s'imprime et s'envoie par WhatsApp",
                ]},
                {"type": "callout", "variant": "warning",
                 "text": "Pas de remise sans accord de la propriétaire. Toute remise exceptionnelle doit être demandée via « À approuver »."},
            ]},
            {"id": "s2-close", "heading": "Clôturer la caisse et verser à la propriétaire",
             "blocks": [
                {"type": "steps", "items": [
                    "En fin de journée, cliquez « Clôturer » dans l'onglet Sessions de caisse",
                    "Comptez les espèces et saisissez le montant réel",
                    "Validez avec votre PIN gérante",
                    "Cliquez « Déclarer versement » et indiquez le montant remis à la propriétaire",
                    "La propriétaire valide ensuite — un écart éventuel apparaît automatiquement",
                ]},
                {"type": "video_placeholder", "title": "Clôturer sa caisse (30 s)",
                 "caption": "Vidéo d'exemple à venir — enregistrée dans la boutique"},
            ]},
            {"id": "s2-memo", "heading": "Mémo A4 Gérante",
             "blocks": [
                {"type": "memo", "role_label": "Gérante caisse",
                 "steps": [
                    "Avant l'ouverture : compter le fond, ouvrir la session",
                    "Pendant la journée : encaisser, imprimer les reçus, pas de remise sans accord",
                    "Avant la pause : vérifier le tiroir, noter les sorties exceptionnelles",
                    "Fin de journée : clôturer, compter, déclarer le versement, remettre à la propriétaire",
                 ]},
            ]},
         ]},
        {"number": 3, "title": "Préparer et expédier une commande", "icon": "Package",
         "description": "De la nouvelle commande à la livraison effective",
         "roles": ["admin","manager","sales","stock_keeper"],
         "path_hints": ["/console/commandes","/console/preparation","/console/livraisons"],
         "sections": [
            {"id": "s3-overview", "heading": "Lire les statuts d'une commande",
             "blocks": [
                {"type": "annotated", "screen": "orders_list",
                 "caption": "Les KPI colorés en haut donnent la photo du jour",
                 "callouts": [
                    {"x": 10, "y": 22, "n": 1, "label": "Nouvelles à traiter"},
                    {"x": 90, "y": 55, "n": 2, "label": "Icônes facture"},
                 ]},
                {"type": "statuses", "items": [
                    {"name": "Nouvelle", "desc": "À confirmer avec la cliente"},
                    {"name": "Confirmée", "desc": "Prête à préparer"},
                    {"name": "En préparation", "desc": "Articles réservés et scannés"},
                    {"name": "Prête", "desc": "Attend l'affectation à un livreur"},
                    {"name": "En livraison", "desc": "En route chez la cliente"},
                    {"name": "Livrée", "desc": "Preuve + code 4 chiffres validés"},
                ]},
            ]},
            {"id": "s3-prepare", "heading": "Préparer une commande en scannant chaque article",
             "blocks": [
                {"type": "annotated", "screen": "preparation_scan",
                 "caption": "Scannez les articles un par un — vert = OK, orange = override manuel",
                 "callouts": [
                    {"x": 40, "y": 20, "n": 1, "label": "Zone de scan"},
                    {"x": 72, "y": 18, "n": 2, "label": "Valider"},
                    {"x": 92, "y": 50, "n": 3, "label": "Override si étiquette illisible"},
                    {"x": 50, "y": 92, "n": 4, "label": "Marquer Prête"},
                 ]},
                {"type": "steps", "items": [
                    "Ouvrez l'onglet Préparation — choisissez la commande à préparer",
                    "Scannez chaque article avec la douchette (ou tapez le SKU + Entrée)",
                    "Un article scanné devient vert ; un article refusé reste à faire",
                    "Si l'étiquette est illisible, cliquez « Manuel » et choisissez un motif obligatoire",
                    "Quand tout est vert ou orange, cliquez « Marquer la commande comme Prête »",
                ]},
                {"type": "callout", "variant": "info",
                 "text": "Les overrides manuels sont tracés dans le journal d'audit : la propriétaire voit qui a confirmé quoi et pourquoi."},
            ]},
            {"id": "s3-deliver", "heading": "Affecter à un livreur et suivre en direct",
             "blocks": [
                {"type": "annotated", "screen": "delivery_day",
                 "caption": "L'onglet Suivi affiche la position des livreurs et les commandes du jour",
                 "callouts": [
                    {"x": 10, "y": 15, "n": 1, "label": "Journée du jour"},
                    {"x": 35, "y": 55, "n": 2, "label": "Position livreur"},
                    {"x": 60, "y": 45, "n": 3, "label": "Pins commandes colorés par statut"},
                 ]},
                {"type": "steps", "items": [
                    "Ouvrez Livraisons → votre journée du jour",
                    "Dans l'onglet Affectation, cochez les commandes prêtes à partir",
                    "Cliquez « Suggérer une répartition » pour grouper par zone, puis Appliquer",
                    "Allez dans l'onglet Suivi pour voir en direct les livreurs sur la carte",
                ]},
            ]},
         ]},
        {"number": 4, "title": "Pour aller plus loin", "icon": "GraduationCap",
         "description": "Glossaire, questions fréquentes et bonnes pratiques",
         "roles": ["admin","manager","sales","stock_keeper","rider"],
         "path_hints": ["/console/manuel"],
         "sections": [
            {"id": "s4-glossary", "heading": "Glossaire",
             "blocks": [
                {"type": "glossary", "items": [
                    {"term": "Session de caisse", "def": "Période ouverte par une gérante le matin et clôturée en fin de journée ; sert à tracer tous les mouvements d'espèces."},
                    {"term": "Réconciliation", "def": "Comparer les ventes attendues au contenu réel du tiroir et expliquer l'écart."},
                    {"term": "Variante", "def": "Combinaison taille × couleur réelle d'un produit. On ne crée que les combinaisons existantes."},
                    {"term": "Liste d'attente", "def": "Clientes qui ont demandé à être prévenues du retour d'un produit en rupture."},
                    {"term": "Approvisionnement", "def": "Commande passée à un fournisseur pour renouveler le stock."},
                    {"term": "Preuve de livraison", "def": "Photo + code à 4 chiffres fournis par la cliente que le livreur enregistre à la remise."},
                ]},
            ]},
            {"id": "s4-faq", "heading": "Questions fréquentes",
             "blocks": [
                {"type": "faq", "items": [
                    {"q": "Comment faire un remboursement ?", "a": "Dans Commandes, ouvrez la commande concernée et choisissez « Rembourser ». La propriétaire valide via la page « À approuver »."},
                    {"q": "Comment appliquer une remise exceptionnelle ?", "a": "Depuis la caisse, cliquez « Remise » et sélectionnez « Demande d'approbation ». La propriétaire reçoit la demande dans « À approuver »."},
                    {"q": "Je n'arrive pas à scanner un article, que faire ?", "a": "Dans l'écran Préparation, cliquez « Manuel » sur la ligne concernée et choisissez un motif. L'action est tracée."},
                    {"q": "Comment ajouter une nouvelle cliente ?", "a": "Depuis la caisse, cliquez sur la carte « Choisir la cliente » puis « + Nouvelle cliente ». Prénom, nom et téléphone suffisent."},
                    {"q": "Comment imprimer une facture ?", "a": "Dans Commandes, à droite de la ligne : icône PDF. Vous pouvez aussi l'envoyer par WhatsApp en 1 clic."},
                    {"q": "Comment pointer sans caméra ?", "a": "Pas de problème : le pointage marche sans selfie si la caméra est refusée — un badge rouge l'indique."},
                ]},
            ]},
            {"id": "s4-rider-memo", "heading": "Mémo A4 Livreur",
             "blocks": [
                {"type": "memo", "role_label": "Livreur",
                 "steps": [
                    "Pointer à l'arrivée au dépôt",
                    "Récupérer les commandes affectées — vérifier les fiches colis",
                    "Appeler chaque cliente avant d'arriver",
                    "À la livraison : photo + demander le code 4 chiffres",
                    "Encaisser (COD) et marquer Livrée dans l'application",
                    "Fin de tournée : pointer départ et verser l'argent au bureau",
                 ]},
            ]},
         ]},
        {"number": 5, "title": "Livraison détaillée", "icon": "Truck",
         "description": "Journées, livreurs, zones, affectation et suivi temps réel",
         "roles": ["admin","manager","sales"],
         "path_hints": ["/console/livraisons"],
         "sections": [
            {"id": "s5-day", "heading": "Piloter la journée de livraison",
             "blocks": [
                {"type": "text", "content": "Chaque matin, une « journée de livraison » est créée automatiquement. Elle regroupe toutes les commandes à livrer, les livreurs disponibles et les zones ciblées."},
                {"type": "annotated", "screen": "delivery_day",
                 "caption": "4 onglets : Affectation, Suivi carte, Réconciliation, Fiches colis",
                 "callouts": [
                    {"x": 10, "y": 10, "n": 1, "label": "Date & responsable"},
                    {"x": 20, "y": 22, "n": 2, "label": "Onglets de la journée"},
                    {"x": 55, "y": 60, "n": 3, "label": "Livreurs en direct"},
                    {"x": 75, "y": 55, "n": 4, "label": "Pins commandes par statut"},
                 ]},
                {"type": "steps", "items": [
                    "Ouvrez Livraisons → Journée du jour",
                    "Dans Affectation, cochez les commandes Prêtes à partir",
                    "Choisissez un livreur et une zone, puis cliquez « Affecter »",
                    "Allez dans Suivi pour voir la position des livreurs sur la carte",
                    "En fin de journée, l'onglet Réconciliation compare argent attendu vs reçu",
                ]},
            ]},
            {"id": "s5-riders", "heading": "Évaluer la performance des livreurs",
             "blocks": [
                {"type": "text", "content": "Chaque livreur a un score sur 100 calculé en temps réel : ponctualité (40%), zéro annulation (30%), note cliente (20%), preuve de livraison (10%)."},
                {"type": "annotated", "screen": "delivery_riders",
                 "caption": "Vue d'ensemble des livreurs — classement par score",
                 "callouts": [
                    {"x": 10, "y": 14, "n": 1, "label": "Score global sur 100"},
                    {"x": 72, "y": 24, "n": 2, "label": "Barre de score colorée"},
                    {"x": 72, "y": 38, "n": 3, "label": "Statut en ligne / hors ligne"},
                    {"x": 90, "y": 24, "n": 4, "label": "Note numérique"},
                 ]},
                {"type": "statuses", "items": [
                    {"name": "90-100 (vert)", "desc": "Livreur de confiance — primes et missions prioritaires"},
                    {"name": "70-89 (ambre)", "desc": "Correct — à encadrer et conseiller"},
                    {"name": "< 70 (rouge)", "desc": "Entretien avec la propriétaire requis"},
                ]},
                {"type": "callout", "variant": "tip",
                 "text": "Consultez l'historique calendrier d'un livreur pour voir ses jours de livraison et retards sur 30 jours."},
            ]},
            {"id": "s5-zones", "heading": "Configurer les zones et tarifs",
             "blocks": [
                {"type": "text", "content": "Les zones déterminent le tarif de livraison affiché sur la vitrine et à la caisse. Chaque zone a aussi un nombre de créneaux max par jour."},
                {"type": "annotated", "screen": "delivery_zones",
                 "caption": "Chaque zone est colorée et son tarif/créneau est édité en un clic",
                 "callouts": [
                    {"x": 25, "y": 22, "n": 1, "label": "Nom de la zone"},
                    {"x": 25, "y": 50, "n": 2, "label": "Tarif livraison"},
                    {"x": 50, "y": 36, "n": 3, "label": "Créneaux/jour"},
                    {"x": 78, "y": 50, "n": 4, "label": "Carte Abidjan colorée"},
                 ]},
                {"type": "steps", "items": [
                    "Livraisons > onglet Zones",
                    "Cliquez « + Nouvelle zone » ou éditez une zone existante",
                    "Saisissez nom, tarif FCFA, nombre de créneaux max/jour",
                    "Sauvegardez — la vitrine s'actualise aussitôt",
                ]},
            ]},
         ]},
        {"number": 6, "title": "Produits, variantes et vidéos", "icon": "Package",
         "description": "Catalogue, matrice taille×couleur, vidéos et stock initial",
         "roles": ["admin","manager","stock_keeper"],
         "path_hints": ["/console/produits"],
         "sections": [
            {"id": "s6-grid", "heading": "Parcourir le catalogue",
             "blocks": [
                {"type": "annotated", "screen": "products_grid",
                 "caption": "Chaque carte produit indique variantes, stock et prix",
                 "callouts": [
                    {"x": 85, "y": 10, "n": 1, "label": "Créer un produit"},
                    {"x": 10, "y": 20, "n": 2, "label": "Filtres par catégorie"},
                    {"x": 18, "y": 45, "n": 3, "label": "Carte produit"},
                    {"x": 42, "y": 85, "n": 4, "label": "Badge Stock / Rupture"},
                 ]},
                {"type": "list", "items": [
                    "Les filtres par catégorie (Robe, Haut, Sac…) sont en haut",
                    "Un pastille coche verte en haut à droite = produit visible sur la vitrine",
                    "Badge « Rupture » rouge si toutes les variantes sont à 0",
                ]},
            ]},
            {"id": "s6-variants", "heading": "Créer les variantes réelles (taille × couleur)",
             "blocks": [
                {"type": "text", "content": "Ne créez QUE les combinaisons qui existent vraiment. Une case vide « + » signifie que la variante n'est pas commercialisée. Évite les ruptures fantômes dans les statistiques."},
                {"type": "annotated", "screen": "product_variants",
                 "caption": "Matrice interactive : cliquez une case pour créer la variante",
                 "callouts": [
                    {"x": 8, "y": 32, "n": 1, "label": "Couleur réelle"},
                    {"x": 32, "y": 20, "n": 2, "label": "Tailles disponibles"},
                    {"x": 44, "y": 42, "n": 3, "label": "Stock par variante"},
                    {"x": 56, "y": 56, "n": 4, "label": "Rupture (stock faible)"},
                 ]},
                {"type": "steps", "items": [
                    "Ouvrez un produit → onglet Variantes",
                    "Dans la matrice, cliquez les cases que vous proposez (ex: Noir M, Rouge S)",
                    "Pour chaque variante créée, saisissez le stock initial",
                    "Enregistrez — la grille est tenue à jour par le POS et le site",
                ]},
                {"type": "callout", "variant": "warning",
                 "text": "N'ajoutez PAS une taille XXL si vous ne l'avez jamais eue : cela crée des ruptures artificielles."},
            ]},
            {"id": "s6-video", "heading": "Ajouter une vidéo produit",
             "blocks": [
                {"type": "text", "content": "Une courte vidéo (10-30 s) augmente le taux de conversion vitrine. Formats acceptés : MP4, WebM. Taille max 20 Mo."},
                {"type": "steps", "items": [
                    "Dans la fiche produit → onglet Médias",
                    "Section « Vidéo », cliquez « Charger un fichier »",
                    "Patientez la fin de l'upload — un aperçu s'affiche",
                    "La vidéo joue automatiquement muette sur la fiche vitrine",
                ]},
                {"type": "video_placeholder", "title": "Charger une vidéo (15 s)",
                 "caption": "Exemple tourné dans la boutique à venir"},
            ]},
         ]},
        {"number": 7, "title": "Fournisseurs & approvisionnements", "icon": "Building2",
         "description": "Créer un bon de commande fournisseur, réceptionner le stock",
         "roles": ["admin","manager","stock_keeper"],
         "path_hints": ["/console/fournisseurs","/console/approvisionnements"],
         "sections": [
            {"id": "s7-kanban", "heading": "Suivre vos commandes en Kanban",
             "blocks": [
                {"type": "annotated", "screen": "suppliers_po",
                 "caption": "4 colonnes qui suivent le cycle de vie d'une commande fournisseur",
                 "callouts": [
                    {"x": 12, "y": 10, "n": 1, "label": "Brouillon à envoyer"},
                    {"x": 36, "y": 10, "n": 2, "label": "Envoyée"},
                    {"x": 60, "y": 10, "n": 3, "label": "Réception partielle"},
                    {"x": 85, "y": 10, "n": 4, "label": "Soldée"},
                 ]},
                {"type": "statuses", "items": [
                    {"name": "Brouillon", "desc": "Vous préparez la commande sans l'envoyer"},
                    {"name": "Envoyée", "desc": "La fournisseuse a reçu la commande, en attente"},
                    {"name": "Partielle", "desc": "Vous avez reçu une partie du stock"},
                    {"name": "Réceptionnée", "desc": "Tout est en stock, dossier clos"},
                ]},
            ]},
            {"id": "s7-create", "heading": "Créer un bon de commande",
             "blocks": [
                {"type": "steps", "items": [
                    "Fournisseurs > choisir la fournisseuse ou en créer une",
                    "Nouveau bon de commande — ajouter les articles un par un",
                    "Pour chaque ligne : SKU, quantité, prix d'achat unitaire",
                    "Enregistrer en Brouillon ou cliquer « Envoyer » (passe en Envoyée)",
                ]},
                {"type": "callout", "variant": "info",
                 "text": "Le total du bon de commande vient alimenter le compte de résultat (coût marchandises) à la réception."},
            ]},
            {"id": "s7-receive", "heading": "Réceptionner la marchandise",
             "blocks": [
                {"type": "steps", "items": [
                    "Ouvrez le BC Envoyé — bouton « Réceptionner »",
                    "Pour chaque ligne, saisissez la quantité réellement reçue",
                    "Si tout n'est pas livré, le BC passe en Partielle",
                    "À la dernière livraison, le BC se solde automatiquement",
                ]},
            ]},
         ]},
        {"number": 8, "title": "Stock & inventaires", "icon": "Boxes",
         "description": "Suivre, ajuster et inventorier le stock boutique",
         "roles": ["admin","manager","stock_keeper"],
         "path_hints": ["/console/stock","/console/inventaires"],
         "sections": [
            {"id": "s8-overview", "heading": "Lire la liste de stock",
             "blocks": [
                {"type": "annotated", "screen": "stock_list",
                 "caption": "Les ruptures et stocks faibles sont colorés automatiquement",
                 "callouts": [
                    {"x": 25, "y": 14, "n": 1, "label": "KPI Ruptures"},
                    {"x": 45, "y": 14, "n": 2, "label": "KPI Stocks faibles"},
                    {"x": 52, "y": 45, "n": 3, "label": "Niveau par variante"},
                    {"x": 90, "y": 45, "n": 4, "label": "Action réappro"},
                 ]},
                {"type": "list", "items": [
                    "Chaque ligne = une variante (SKU + taille + couleur)",
                    "Seuil = niveau à partir duquel vous recevez une alerte",
                    "Bouton « Réapprovisionner » crée un pré-rempli de bon de commande fournisseur",
                ]},
            ]},
            {"id": "s8-adjust", "heading": "Ajuster le stock après casse ou perte",
             "blocks": [
                {"type": "steps", "items": [
                    "Stock > cliquez sur la variante à ajuster",
                    "Choisissez le motif : Casse, Perte, Vol, Erreur de saisie",
                    "Saisissez la quantité ajustée (positif ou négatif)",
                    "Validez — un audit est créé automatiquement avec votre nom",
                ]},
                {"type": "callout", "variant": "warning",
                 "text": "Un ajustement > 10 unités nécessite l'approbation de la propriétaire."},
            ]},
            {"id": "s8-inventory", "heading": "Faire un inventaire complet",
             "blocks": [
                {"type": "steps", "items": [
                    "Inventaires > Nouvel inventaire — choisir « Total » ou « Partiel »",
                    "Imprimez les fiches de comptage (une par rayon)",
                    "Saisissez les quantités comptées dans l'écran de rapprochement",
                    "Validez — les écarts sont enregistrés et expliqués",
                ]},
            ]},
         ]},
        {"number": 9, "title": "Clientes & segments", "icon": "Users",
         "description": "Fiches 360°, segments VIP/Fidèle/Nouvelle, messagerie WhatsApp",
         "roles": ["admin","manager","sales"],
         "path_hints": ["/console/clientes","/console/segments"],
         "sections": [
            {"id": "s9-list", "heading": "Comprendre les segments automatiques",
             "blocks": [
                {"type": "annotated", "screen": "customers_list",
                 "caption": "Chaque cliente est classée automatiquement selon ses achats",
                 "callouts": [
                    {"x": 10, "y": 14, "n": 1, "label": "KPI VIP"},
                    {"x": 45, "y": 32, "n": 2, "label": "Pastille segment"},
                    {"x": 65, "y": 32, "n": 3, "label": "Points fidélité"},
                    {"x": 88, "y": 32, "n": 4, "label": "WhatsApp direct"},
                 ]},
                {"type": "statuses", "items": [
                    {"name": "VIP (≥ 1000 pts)", "desc": "Clientes à forte valeur — offres exclusives"},
                    {"name": "Fidèle (≥ 300 pts)", "desc": "Clientes régulières — relance personnalisée"},
                    {"name": "Nouvelle (< 90 jours)", "desc": "Première impression décisive"},
                    {"name": "Inactive (> 180 jours)", "desc": "À réveiller avec un code promo ciblé"},
                ]},
            ]},
            {"id": "s9-profile", "heading": "Ouvrir une fiche cliente 360°",
             "blocks": [
                {"type": "list", "items": [
                    "Historique des commandes avec total par année",
                    "Panier moyen, nombre de produits préférés",
                    "Fils de messages WhatsApp intégré",
                    "Notes privées (bannière rouge visible par l'équipe uniquement)",
                ]},
                {"type": "callout", "variant": "info",
                 "text": "Les notes privées sont utiles pour mémoriser les préférences : tailles, couleurs favorites, allergies tissu."},
            ]},
            {"id": "s9-campaign", "heading": "Envoyer une campagne WhatsApp ciblée",
             "blocks": [
                {"type": "steps", "items": [
                    "Segments > choisir un segment (ex: VIP)",
                    "« Nouvelle campagne » — écrire le message en français",
                    "Ajouter une image produit en 1 clic si pertinent",
                    "Prévisualiser et envoyer — l'envoi est séquentiel pour éviter le spam",
                ]},
            ]},
         ]},
        {"number": 10, "title": "Promotions & fidélité", "icon": "Megaphone",
         "description": "Codes promo, points fidélité, programme de parrainage",
         "roles": ["admin","manager"],
         "path_hints": ["/console/promotions","/console/fidelite"],
         "sections": [
            {"id": "s10-codes", "heading": "Créer un code promo",
             "blocks": [
                {"type": "annotated", "screen": "promo_codes",
                 "caption": "Suivez les codes actifs et leur utilisation en direct",
                 "callouts": [
                    {"x": 10, "y": 20, "n": 1, "label": "Code à communiquer"},
                    {"x": 10, "y": 32, "n": 2, "label": "Montant / pourcentage"},
                    {"x": 45, "y": 52, "n": 3, "label": "Barre d'utilisation"},
                    {"x": 85, "y": 90, "n": 4, "label": "Nouveau code"},
                 ]},
                {"type": "steps", "items": [
                    "Promotions > Nouveau code",
                    "Code (ex: HARMATTAN20) — majuscules recommandées",
                    "Type : pourcentage ou montant fixe",
                    "Durée de validité et nombre max d'utilisations",
                    "Enregistrez — le code est utilisable aussitôt à la caisse et en ligne",
                ]},
            ]},
            {"id": "s10-loyalty", "heading": "Régler le programme fidélité",
             "blocks": [
                {"type": "text", "content": "Par défaut : 1 point gagné pour 1 000 FCFA dépensés, seuil VIP à 1 000 points. Ajustez selon votre stratégie."},
                {"type": "steps", "items": [
                    "Fidélité > Paramètres",
                    "Ajustez le ratio points / FCFA",
                    "Définissez les paliers Fidèle et VIP",
                    "Les points sont automatiquement attribués au check-out",
                ]},
            ]},
            {"id": "s10-referral", "heading": "Activer le parrainage",
             "blocks": [
                {"type": "steps", "items": [
                    "Fidélité > Parrainage > Activer",
                    "Choisir les récompenses : -10% marraine, -5% filleule",
                    "Chaque cliente a un code personnel visible dans son espace",
                    "Les primes sont créditées à la 1re commande de la filleule",
                ]},
                {"type": "callout", "variant": "tip",
                 "text": "Communiquez le programme par WhatsApp aux VIP — elles sont vos meilleures ambassadrices."},
            ]},
         ]},
        {"number": 11, "title": "Statistiques & finances", "icon": "BarChart3",
         "description": "12 onglets stats, dépenses, compte de résultat",
         "roles": ["admin","manager"],
         "path_hints": ["/console/statistiques","/console/finances"],
         "sections": [
            {"id": "s11-overview", "heading": "Les 12 onglets statistiques",
             "blocks": [
                {"type": "annotated", "screen": "stats_tabs",
                 "caption": "Chaque onglet apporte un angle différent — à consulter chaque semaine",
                 "callouts": [
                    {"x": 5, "y": 14, "n": 1, "label": "Résumé par défaut"},
                    {"x": 25, "y": 20, "n": 2, "label": "CA par semaine"},
                    {"x": 70, "y": 35, "n": 3, "label": "Top produits par marge"},
                    {"x": 55, "y": 85, "n": 4, "label": "Résultat net du mois"},
                 ]},
                {"type": "list", "items": [
                    "Résumé : KPI principaux + graphiques CA/marge",
                    "CA : par jour, semaine, mois, par canal, par vendeuse",
                    "Marge : par produit, par catégorie, par promotion",
                    "Produits : top ventes, rotation, taux de rupture",
                    "Clientes : nouveaux, VIP, taux de rétention",
                    "Livraison : délai moyen, taux d'échec, par zone",
                    "Dépenses : par poste, cash flow mensuel",
                ]},
            ]},
            {"id": "s11-pnl", "heading": "Lire le compte de résultat",
             "blocks": [
                {"type": "text", "content": "Chiffre d'affaires − coût marchandises = marge brute. Marge brute − dépenses d'exploitation = résultat net."},
                {"type": "callout", "variant": "tip",
                 "text": "Comparez chaque mois à N-1 (même mois année précédente) pour suivre votre progression."},
                {"type": "faq", "items": [
                    {"q": "Pourquoi mon CA ne correspond pas aux encaissements de caisse ?", "a": "Le CA comprend les ventes en ligne, pas seulement la caisse. Le détail est dans Statistiques > CA par canal."},
                    {"q": "Comment ajouter une dépense exceptionnelle ?", "a": "Finances > Dépenses > Nouveau. Dépenses > 50 000 FCFA requièrent l'approbation de la propriétaire."},
                ]},
            ]},
            {"id": "s11-memo", "heading": "Mémo Propriétaire — à relire chaque semaine",
             "blocks": [
                {"type": "memo", "role_label": "Propriétaire",
                 "steps": [
                    "Lundi matin : relire le compte de résultat de la semaine passée",
                    "Vérifier les 3 KPI : CA, marge brute, résultat net",
                    "Zoomer sur les TOP et FLOP produits (onglet Produits)",
                    "Contrôler les écarts caisse (Sessions de caisse > Écarts)",
                    "Approuver les demandes en attente dans À approuver",
                 ]},
            ]},
         ]},
        {"number": 12, "title": "Site vitrine & CMS", "icon": "Globe",
         "description": "Apparence, pages, horaires d'ouverture, SEO",
         "roles": ["admin","manager"],
         "path_hints": ["/console/site"],
         "sections": [
            {"id": "s12-pages", "heading": "Gérer les pages de la vitrine",
             "blocks": [
                {"type": "annotated", "screen": "cms_pages",
                 "caption": "Chaque page a un slug URL unique et un statut Publié / Brouillon",
                 "callouts": [
                    {"x": 20, "y": 20, "n": 1, "label": "Pages existantes"},
                    {"x": 32, "y": 42, "n": 2, "label": "Slug URL unique"},
                    {"x": 32, "y": 52, "n": 3, "label": "Statut publication"},
                    {"x": 68, "y": 65, "n": 4, "label": "Aperçu temps réel"},
                 ]},
                {"type": "steps", "items": [
                    "Site vitrine > Pages > Nouvelle page",
                    "Titre, slug (ex: /nouveautes), contenu riche",
                    "Choisir publication immédiate ou brouillon",
                    "L'aperçu se met à jour en direct dans le panneau de droite",
                ]},
                {"type": "callout", "variant": "warning",
                 "text": "Un slug déjà utilisé est refusé automatiquement — choisissez-en un unique (sans accents, sans espaces)."},
            ]},
            {"id": "s12-hours", "heading": "Horaires d'ouverture sur la vitrine",
             "blocks": [
                {"type": "text", "content": "Les horaires s'affichent en bas du site vitrine. Un indicateur « Ouvert / Fermé » calcule le statut en direct."},
                {"type": "steps", "items": [
                    "Paramètres > Horaires d'ouverture",
                    "Pour chaque jour : cocher Ouvert et saisir plages horaires",
                    "Enregistrer — la vitrine se recharge et affiche la plage",
                ]},
            ]},
            {"id": "s12-appearance", "heading": "Changer l'apparence (couleurs, polices)",
             "blocks": [
                {"type": "steps", "items": [
                    "Site vitrine > Apparence",
                    "Choisir un preset ou personnaliser couleurs",
                    "Sélectionner la police d'affichage et de corps",
                    "Enregistrer — rechargez /boutique pour voir",
                ]},
            ]},
         ]},
        {"number": 13, "title": "Pointage & géofencing", "icon": "Clock",
         "description": "Kiosk tablette, selfie, géofence boutique",
         "roles": ["admin","manager","sales","stock_keeper","rider"],
         "path_hints": ["/console/pointage"],
         "sections": [
            {"id": "s13-kiosk", "heading": "Utiliser le kiosk de pointage",
             "blocks": [
                {"type": "annotated", "screen": "attendance_kiosk",
                 "caption": "Tablette en libre service à l'entrée — PIN + selfie",
                 "callouts": [
                    {"x": 18, "y": 32, "n": 1, "label": "Choisir Arrivée"},
                    {"x": 32, "y": 32, "n": 2, "label": "Choisir Départ"},
                    {"x": 25, "y": 70, "n": 3, "label": "Pavé numérique PIN"},
                    {"x": 75, "y": 28, "n": 4, "label": "Présences en direct"},
                 ]},
                {"type": "steps", "items": [
                    "Ouvrir /console/pointage sur la tablette boutique (mode kiosk)",
                    "Choisir « Arrivée » (vert) ou « Départ » (rouge)",
                    "Taper les 4 chiffres du PIN personnel",
                    "La caméra prend un selfie — le pointage est validé en vert",
                ]},
            ]},
            {"id": "s13-geofence", "heading": "Géofence : pointer dans la boutique",
             "blocks": [
                {"type": "text", "content": "La boutique a un rayon GPS (50m par défaut). Si vous tentez de pointer hors de la zone, un badge « Hors zone » apparaît."},
                {"type": "callout", "variant": "info",
                 "text": "Les livreurs peuvent pointer leur départ en tournée depuis l'application mobile — leur géoloc est tracée."},
                {"type": "faq", "items": [
                    {"q": "Pas de caméra — ça marche quand même ?", "a": "Oui, le pointage est accepté sans selfie mais un badge rouge le signale à la propriétaire."},
                    {"q": "J'ai oublié de pointer le départ, que faire ?", "a": "Demandez à la gérante : elle peut corriger via Équipe > Présences avec un motif obligatoire."},
                ]},
            ]},
         ]},
        {"number": 14, "title": "Paramètres & intégrations", "icon": "Settings",
         "description": "Identité, horaires, paiements, notifications, webpush",
         "roles": ["admin"],
         "path_hints": ["/console/parametres"],
         "sections": [
            {"id": "s14-identity", "heading": "Logo, nom, baseline",
             "blocks": [
                {"type": "annotated", "screen": "settings_identity",
                 "caption": "Le logo est automatiquement propagé partout (console, vitrine, reçus)",
                 "callouts": [
                    {"x": 32, "y": 25, "n": 1, "label": "Logo chargeable"},
                    {"x": 60, "y": 22, "n": 2, "label": "Nom affiché"},
                    {"x": 32, "y": 42, "n": 3, "label": "Remplacer le logo"},
                    {"x": 32, "y": 65, "n": 4, "label": "Horaires d'ouverture"},
                 ]},
                {"type": "list", "items": [
                    "Logo PNG/SVG (fond transparent de préférence)",
                    "Nom et baseline sont montrés sur reçus et factures",
                    "Modification instantanée — rechargez pour voir",
                ]},
            ]},
            {"id": "s14-payments", "heading": "Configurer les moyens de paiement",
             "blocks": [
                {"type": "steps", "items": [
                    "Paramètres > Paiements",
                    "Activer Wave, Orange Money, MTN selon vos comptes",
                    "Saisir les numéros marchand pour chaque opérateur",
                    "La caisse affiche uniquement les modes activés",
                ]},
            ]},
            {"id": "s14-notifications", "heading": "Notifications web push",
             "blocks": [
                {"type": "text", "content": "Les notifications push permettent de recevoir une alerte sur votre ordinateur même si l'onglet est fermé (nouvelle commande, demande à approuver, livraison livrée)."},
                {"type": "steps", "items": [
                    "Paramètres > Notifications",
                    "Cliquez « Activer les notifications »",
                    "Autorisez le navigateur à envoyer des notifications",
                    "Choisissez les événements qui vous intéressent",
                ]},
            ]},
         ]},
        {"number": 15, "title": "Espace livreur", "icon": "Smartphone",
         "description": "Application mobile livreur : journée, preuves, score",
         "roles": ["admin","manager","rider"],
         "path_hints": ["/rider"],
         "sections": [
            {"id": "s15-start", "heading": "Démarrer ma journée (livreur)",
             "blocks": [
                {"type": "annotated", "screen": "rider_app",
                 "caption": "L'app livreur est optimisée pour téléphone — colonne unique, gros boutons",
                 "callouts": [
                    {"x": 50, "y": 20, "n": 1, "label": "Nom & journée"},
                    {"x": 50, "y": 30, "n": 2, "label": "3 KPI du jour"},
                    {"x": 50, "y": 50, "n": 3, "label": "Carte commande"},
                    {"x": 70, "y": 58, "n": 4, "label": "Boutons action"},
                 ]},
                {"type": "steps", "items": [
                    "Ouvrir /rider sur le téléphone (installer en app via « Ajouter à l'écran d'accueil »)",
                    "Se connecter avec PIN à 4 chiffres",
                    "Autoriser la géolocalisation",
                    "Consulter les commandes affectées de la journée",
                ]},
            ]},
            {"id": "s15-deliver", "heading": "Marquer une commande comme livrée",
             "blocks": [
                {"type": "steps", "items": [
                    "Taper sur une commande de la liste",
                    "Avant d'arriver : appeler la cliente (bouton Appeler)",
                    "Sur place : prendre une photo de preuve (bouton Preuve)",
                    "Demander à la cliente son code à 4 chiffres",
                    "Saisir le code — la commande passe en Livrée",
                ]},
                {"type": "callout", "variant": "warning",
                 "text": "Pas de code = pas de livraison validée. Si la cliente ne trouve pas son code, l'application en renvoie un par SMS en 1 clic."},
            ]},
            {"id": "s15-score", "heading": "Comprendre son score de livreur",
             "blocks": [
                {"type": "list", "items": [
                    "40% — Ponctualité (temps entre affectation et livraison)",
                    "30% — Zéro annulation (commandes refusées)",
                    "20% — Note moyenne des clientes",
                    "10% — Preuve de livraison (photo + code)",
                ]},
                {"type": "callout", "variant": "tip",
                 "text": "Votre score détermine votre place dans la file d'affectation — meilleur score = meilleures tournées."},
            ]},
         ]},
        {"number": 16, "title": "Approbations & audit", "icon": "ShieldCheck",
         "description": "Boîte à demandes, journal d'audit, traçabilité complète",
         "roles": ["admin","manager"],
         "path_hints": ["/console/approuver","/console/audit"],
         "sections": [
            {"id": "s16-inbox", "heading": "Boîte À approuver",
             "blocks": [
                {"type": "annotated", "screen": "approvals_inbox",
                 "caption": "Chaque demande est tracée — approuver / rejeter en 1 clic",
                 "callouts": [
                    {"x": 10, "y": 22, "n": 1, "label": "Type de demande"},
                    {"x": 30, "y": 22, "n": 2, "label": "Badge Urgent"},
                    {"x": 10, "y": 40, "n": 3, "label": "Demandeur & contexte"},
                    {"x": 75, "y": 32, "n": 4, "label": "Approuver / rejeter"},
                 ]},
                {"type": "statuses", "items": [
                    {"name": "Remise exceptionnelle", "desc": "Dépasser le plafond de remise autorisé"},
                    {"name": "Override préparation", "desc": "Valider manuellement un article non scanné"},
                    {"name": "Remboursement", "desc": "Rembourser une cliente"},
                    {"name": "Dépense exceptionnelle", "desc": "Dépense > 50 000 FCFA"},
                    {"name": "Ouverture caisse avec écart", "desc": "Fond initial différent de prévu"},
                ]},
            ]},
            {"id": "s16-audit", "heading": "Journal d'audit",
             "blocks": [
                {"type": "text", "content": "Toutes les actions sensibles sont tracées : qui, quand, quoi, pourquoi. Filtrable par utilisatrice et période."},
                {"type": "list", "items": [
                    "Qui : nom et rôle de l'utilisatrice",
                    "Quand : date et heure précises",
                    "Quoi : type d'action (remise, override, suppression…)",
                    "Pourquoi : motif obligatoire pour certaines actions",
                ]},
                {"type": "callout", "variant": "info",
                 "text": "Exportez le journal d'audit en CSV pour archivage ou analyse externe."},
            ]},
         ]},
    ]
    now = now_iso()
    for m in RICH:
        existing = await db.manual_modules.find_one({"number": m["number"]})
        if existing:
            await db.manual_modules.update_one({"number": m["number"]}, {"$set": {**m, "updated_at": now}})
        else:
            await db.manual_modules.insert_one({**m, "id": new_id(), "created_at": now})
    return {"ok": True, "updated": len(RICH)}

@api.get("/manual-gaps")
async def manual_gaps(user: dict = Depends(require_role("admin"))):
    rows = await db.manual_gaps.find({}).sort("at", -1).to_list(200)
    return clean(rows)

@api.post("/analytics/events")
async def track_event(body: Dict[str, Any]):
    doc = {
        "id": new_id(),
        "at": now_iso(),
        "name": body.get("name"),
        "visitor_id": body.get("visitor_id"),
        "session_id": body.get("session_id"),
        "page": body.get("page"),
        "product_id": body.get("product_id"),
        "value": body.get("value"),
        "source": body.get("source"),
        "utm_source": body.get("utm_source"),
        "utm_medium": body.get("utm_medium"),
        "utm_campaign": body.get("utm_campaign"),
        "device": body.get("device"),
        "consent": body.get("consent", False),
    }
    await db.events.insert_one(doc)
    return {"ok": True, "id": doc["id"]}

@api.get("/analytics/funnel")
async def analytics_funnel(user: dict = Depends(require_role("admin","manager")), days: int = 7):
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = await db.events.find({"at": {"$gte": cutoff}}).to_list(50000)
    def count(name): return sum(1 for r in rows if r.get("name") == name)
    visitors = len({r.get("visitor_id") for r in rows if r.get("visitor_id")})
    pv = count("page_view")
    pv_product = count("product_view")
    atc = count("add_to_cart")
    ck = count("checkout_started")
    ord_ = count("order_placed")
    conv = round((ord_ / visitors * 100), 2) if visitors else 0
    return {
        "visitors": visitors,
        "page_views": pv,
        "product_views": pv_product,
        "add_to_cart": atc,
        "checkout_started": ck,
        "order_placed": ord_,
        "conversion_rate": conv,
        "funnel": [
            {"step": "Visites uniques", "value": visitors},
            {"step": "Vues produit", "value": pv_product},
            {"step": "Ajout panier", "value": atc},
            {"step": "Début checkout", "value": ck},
            {"step": "Commande passée", "value": ord_},
        ],
        "days": days,
    }
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
    # Manual modules
    await seed_manual_modules()
    # Expense Categories (default list for Finances page)
    if await db.expense_categories.count_documents({}) == 0:
        DEFAULT_EXP_CATS = [
            ("Loyer", "fixe"), ("Électricité", "variable"), ("Eau", "variable"),
            ("Salaires", "fixe"), ("Transport", "variable"), ("Marketing", "variable"),
            ("Internet", "fixe"), ("Fournitures", "variable"), ("Taxes", "fixe"),
            ("Emballage", "variable"), ("Carburant livreurs", "variable"), ("Autre", "variable"),
        ]
        await db.expense_categories.insert_many([
            {"id": new_id(), "name": n, "type": t, "created_at": now_iso()} for n, t in DEFAULT_EXP_CATS
        ])

# ---------- Fix pack 2 : Roles & permissions, Approvals, Audit, Attendance ----------

ROLE_TEMPLATES = {
    "gerante": {"name":"Gérante","color":"#5867fd","description":"Gestion quotidienne de la boutique","permissions":{
        "pos.sell":"full","orders.read":"full","orders.update":"edit","orders.mark_delivered":"none","products.read":"read","products.edit":"none","products.cost":"none","purchases.read":"none","purchases.receive":"edit","stock.adjust_propose":"edit","stock.adjust_validate":"none","expenses.create":"none","expenses.request":"edit","cash.open_close":"full","cash.validate":"none","reconciliations":"edit","customers":"full","marketing":"full","deliveries.assign":"full","deliveries.update_status":"none","reports.read":"read","reports.margins":"none","suppliers.read":"none","settings":"none","team":"none"},
        "limits":{"discount_pct_max":10,"refund":False,"void_sale":False}},
    "livreur": {"name":"Livreur","color":"#e4991e","description":"Livraison et encaissement terrain","permissions":{
        "pos.sell":"none","orders.read":"read","orders.update":"none","orders.mark_delivered":"edit","products.read":"read","products.edit":"none","products.cost":"none","expenses.create":"none","expenses.request":"none","cash.open_close":"none","cash.validate":"none","reconciliations":"read","deliveries.update_status":"edit","settings":"none","team":"none"},
        "limits":{"discount_pct_max":0,"refund":False,"void_sale":False}},
    "caissiere": {"name":"Caissière","color":"#1f8a4c","description":"Encaissement au comptoir","permissions":{
        "pos.sell":"edit","orders.read":"read","orders.update":"none","orders.mark_delivered":"none","products.read":"read","products.cost":"none","customers":"edit","expenses.request":"edit","cash.open_close":"edit","cash.validate":"none","settings":"none","team":"none"},
        "limits":{"discount_pct_max":5,"refund":False,"void_sale":False}},
}

@api.get("/role-templates")
async def role_templates(user: dict = Depends(require_role("admin"))):
    return ROLE_TEMPLATES

@api.get("/roles")
async def list_roles(user: dict = Depends(require_role("admin"))):
    rows = await db.roles.find({}).to_list(100)
    users = await db.users.find({}, {"name":1,"role":1}).to_list(500)
    counts = {}
    for u in users: counts[u.get("role","")] = counts.get(u.get("role",""),0) + 1
    for r in rows: r["user_count"] = counts.get(r.get("key"), 0)
    pending = await db.approval_requests.count_documents({"status":"pending"})
    return {"roles": clean(rows), "pending_approvals": pending}

@api.post("/roles")
async def create_role(body: Dict[str,Any], user: dict = Depends(require_role("admin"))):
    key = (body.get("key") or body.get("name","").lower().replace(" ","_"))[:40]
    if key in ("admin","propriétaire","proprietaire"): raise HTTPException(400,"Clé réservée")
    doc = {"id": new_id(), "key": key, "name": body.get("name"), "color": body.get("color","#5867fd"),
           "description": body.get("description",""), "permissions": body.get("permissions") or {},
           "limits": body.get("limits") or {}, "builtin": False, "created_at": now_iso(), "created_by": user.get("name")}
    await db.roles.insert_one(doc)
    await db.audit_log.insert_one({"id":new_id(),"user_id":user.get("id"),"user_name":user.get("name"),"action":"role.create","entity_id":doc["id"],"after":{"name":body.get("name")},"at":now_iso()})
    return clean(doc)

@api.patch("/roles/{rid}")
async def update_role(rid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin"))):
    body.pop("_id",None); body.pop("id",None); body.pop("builtin",None); body["updated_at"] = now_iso()
    before = await db.roles.find_one({"id": rid})
    if not before: raise HTTPException(404)
    if before.get("builtin"): raise HTTPException(400, "Rôle intégré non modifiable")
    await db.roles.update_one({"id": rid}, {"$set": body})
    await db.audit_log.insert_one({"id":new_id(),"user_id":user.get("id"),"user_name":user.get("name"),"action":"role.update","entity_id":rid,"before":clean(before),"after":body,"at":now_iso()})
    return {"ok": True}

@api.delete("/roles/{rid}")
async def delete_role(rid: str, user: dict = Depends(require_role("admin"))):
    r = await db.roles.find_one({"id": rid})
    if not r: raise HTTPException(404)
    if r.get("builtin"): raise HTTPException(400, "Rôle intégré non supprimable")
    await db.roles.delete_one({"id": rid})
    await db.audit_log.insert_one({"id":new_id(),"user_id":user.get("id"),"user_name":user.get("name"),"action":"role.delete","entity_id":rid,"before":clean(r),"at":now_iso()})
    return {"ok": True}

# -------- Approval requests (demandes d'approbation) --------
@api.post("/approval-requests")
async def create_approval(body: Dict[str,Any], user: dict = Depends(get_user)):
    """Request owner's approval for a sensitive action (discount, refund, expense, price change, stock adjustment)."""
    doc = {"id": new_id(), "kind": body.get("kind"), "requested_by_id": user.get("id"), "requested_by_name": user.get("name"),
           "payload": body.get("payload") or {}, "reason": body.get("reason",""), "status":"pending",
           "created_at": now_iso(), "decision_at": None, "decision_by": None, "decision_note": None}
    await db.approval_requests.insert_one(doc)
    await db.notifications.insert_one({"id":new_id(),"type":"approval","title":f"Demande d'approbation · {body.get('kind')}","msg":f"{user.get('name')} · {body.get('reason','')[:60]}","color":"#e4991e","at":now_iso(),"link":"/console/roles?tab=approvals"})
    return clean(doc)

@api.get("/approval-requests")
async def list_approvals(user: dict = Depends(require_role("admin")), status: Optional[str] = None):
    f = {}
    if status: f["status"] = status
    rows = await db.approval_requests.find(f).sort("created_at",-1).to_list(500)
    return clean(rows)

@api.post("/approval-requests/{aid}/decide")
async def decide_approval(aid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin"))):
    decision = body.get("decision")  # "approved" | "rejected"
    if decision not in ("approved","rejected"): raise HTTPException(400)
    await db.approval_requests.update_one({"id": aid}, {"$set": {"status": decision, "decision_at": now_iso(), "decision_by": user.get("name"), "decision_note": body.get("note","")}})
    r = await db.approval_requests.find_one({"id": aid})
    await db.audit_log.insert_one({"id":new_id(),"user_id":user.get("id"),"user_name":user.get("name"),"action":f"approval.{decision}","entity_id":aid,"after":{"kind":r.get("kind")},"at":now_iso()})
    return clean(r)

# -------- Expense requests (Gérante submits, owner approves) --------
@api.post("/expense-requests")
async def create_expense_request(body: Dict[str,Any], user: dict = Depends(get_user)):
    doc = {"id": new_id(), "label": body.get("label"), "amount": int(body.get("amount",0)),
           "category": body.get("category","Divers"), "note": body.get("note",""),
           "receipt": body.get("receipt"), "requested_by_name": user.get("name"), "requested_by_id": user.get("id"),
           "status":"pending", "created_at": now_iso()}
    await db.expense_requests.insert_one(doc)
    await db.notifications.insert_one({"id":new_id(),"type":"expense_request","title":"Demande de dépense","msg":f"{user.get('name')} · {body.get('label')} · {int(body.get('amount',0))} FCFA","color":"#e4991e","at":now_iso(),"link":"/console/depenses"})
    return clean(doc)

@api.get("/expense-requests")
async def list_expense_requests(user: dict = Depends(require_role("admin")), status: Optional[str] = None):
    f = {}
    if status: f["status"] = status
    rows = await db.expense_requests.find(f).sort("created_at",-1).to_list(500)
    return clean(rows)

@api.post("/expense-requests/{eid}/decide")
async def decide_expense_request(eid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin"))):
    decision = body.get("decision")
    r = await db.expense_requests.find_one({"id": eid})
    if not r: raise HTTPException(404)
    await db.expense_requests.update_one({"id": eid}, {"$set": {"status": decision, "decision_at": now_iso(), "decision_by": user.get("name"), "decision_note": body.get("note","")}})
    if decision == "approved":
        exp = {"id": new_id(), "label": r.get("label"), "amount": r.get("amount"), "category": r.get("category"),
               "paid_at": now_iso(), "note": f"Validée par {user.get('name')} · demandée par {r.get('requested_by_name')}",
               "approved_from_request": eid, "receipt": r.get("receipt"), "created_at": now_iso()}
        await db.expenses.insert_one(exp)
    await db.audit_log.insert_one({"id":new_id(),"user_id":user.get("id"),"user_name":user.get("name"),"action":f"expense_request.{decision}","entity_id":eid,"at":now_iso()})
    return {"ok": True}

# -------- Audit log --------
@api.get("/audit-logs")
async def list_audit(user: dict = Depends(require_role("admin")), limit: int = 500, action: Optional[str] = None, user_id: Optional[str] = None):
    f = {}
    if action: f["action"] = {"$regex": action}
    if user_id: f["user_id"] = user_id
    rows = await db.audit_log.find(f).sort("at",-1).to_list(limit)
    return clean(rows)

# -------- Cash sessions handover & validation --------
@api.post("/cash-sessions/{sid}/declare-handover")
async def declare_handover(sid: str, body: Dict[str,Any], user: dict = Depends(get_user)):
    """Gérante declares the amount handed to the owner. Session awaits owner validation."""
    s = await db.cash_sessions.find_one({"id": sid})
    if not s: raise HTTPException(404)
    await db.cash_sessions.update_one({"id": sid}, {"$set": {
        "handover_amount": int(body.get("amount",0)), "handover_at": now_iso(), "handover_by": user.get("name"),
        "handover_note": body.get("note",""), "status": "pending_validation"
    }})
    await db.notifications.insert_one({"id":new_id(),"type":"handover","title":"Versement en attente","msg":f"{user.get('name')} a déposé {int(body.get('amount',0))} FCFA","color":"#5867fd","at":now_iso(),"link":"/console/sessions-caisse"})
    await db.audit_log.insert_one({"id":new_id(),"user_id":user.get("id"),"user_name":user.get("name"),"action":"cash.declare_handover","entity_id":sid,"after":{"amount":body.get("amount")},"at":now_iso()})
    return {"ok": True}

@api.post("/cash-sessions/{sid}/validate-handover")
async def validate_handover(sid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin"))):
    """Owner validates the handover; session becomes 'closed' or 'gap'."""
    s = await db.cash_sessions.find_one({"id": sid})
    if not s: raise HTTPException(404)
    expected = int(body.get("expected", s.get("handover_amount",0)))
    actual = int(body.get("actual", s.get("handover_amount",0)))
    gap = actual - expected
    status = "validated" if gap == 0 else "gap"
    await db.cash_sessions.update_one({"id": sid}, {"$set": {
        "validated_at": now_iso(), "validated_by": user.get("name"), "validation_gap": gap,
        "validation_note": body.get("note",""), "status": status, "closed_at": now_iso()
    }})
    # If gap, record it on the Gérante balance
    if gap != 0 and s.get("manager_id"):
        await db.manager_balance.insert_one({"id":new_id(),"manager_id":s.get("manager_id"),"session_id":sid,"amount":-gap,"reason":"Écart versement","at":now_iso()})
    await db.audit_log.insert_one({"id":new_id(),"user_id":user.get("id"),"user_name":user.get("name"),"action":"cash.validate_handover","entity_id":sid,"after":{"gap":gap,"status":status},"at":now_iso()})
    return {"ok": True, "gap": gap, "status": status}

@api.post("/cash-sessions/{sid}/reject-handover")
async def reject_handover(sid: str, body: Dict[str,Any], user: dict = Depends(require_role("admin"))):
    """Owner rejects the handover with a mandatory reason. Session reverts to open so the Gérante can re-declare."""
    s = await db.cash_sessions.find_one({"id": sid})
    if not s: raise HTTPException(404)
    reason = (body.get("reason") or "").strip()
    if not reason: raise HTTPException(400, "Motif de rejet obligatoire")
    await db.cash_sessions.update_one({"id": sid}, {"$set": {
        "status": "rejected",
        "rejected_at": now_iso(), "rejected_by": user.get("name"),
        "rejection_reason": reason,
        # Clear handover so the Gérante can submit again
        "handover_amount": None, "handover_at": None, "handover_by": None, "handover_note": None,
    }})
    # Notify Gérante
    await db.notifications.insert_one({
        "id": new_id(), "type": "handover_rejected",
        "title": "Versement rejeté",
        "msg": f"{user.get('name')} a rejeté votre versement : {reason}",
        "color": "#c62828", "at": now_iso(),
        "link": "/console/sessions-caisse",
        "target_user_id": s.get("opened_by_id"),
    })
    await db.audit_log.insert_one({"id":new_id(),"user_id":user.get("id"),"user_name":user.get("name"),"action":"cash.reject_handover","entity_id":sid,"after":{"reason":reason},"at":now_iso()})
    return {"ok": True, "reason": reason}

@api.get("/manager-balance/{mid}")
async def manager_balance(mid: str, user: dict = Depends(require_role("admin","manager"))):
    rows = await db.manager_balance.find({"manager_id": mid}).sort("at",-1).to_list(500)
    total = sum(r.get("amount",0) for r in rows)
    return {"balance": total, "entries": clean(rows)}

# -------- Attendance (check-in with selfie + GPS + geofence) --------
def _haversine_m(lat1, lon1, lat2, lon2):
    import math
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2-lat1); dl = math.radians(lon2-lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dl/2)**2
    return int(2*R*math.asin(math.sqrt(a)))

@api.get("/attendance/me")
async def attendance_me(user: dict = Depends(get_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    arr = await db.attendance.find_one({"user_id": user.get("id"), "day": today, "kind":"arrival"})
    dep = await db.attendance.find_one({"user_id": user.get("id"), "day": today, "kind":"departure"})
    return {"checked_in": bool(arr), "arrival": clean(arr), "departure": clean(dep)}

@api.post("/attendance/check-in")
async def check_in(body: Dict[str,Any], user: dict = Depends(get_user)):
    """kind: 'arrival' | 'departure'. Requires selfie (b64) and GPS if method='phone'."""
    kind = body.get("kind","arrival")
    method = body.get("method","phone")  # phone | tablet
    selfie = body.get("selfie")
    lat = body.get("lat"); lng = body.get("lng")
    if method == "phone" and not selfie:
        raise HTTPException(400, "Selfie requis (caméra avant)")
    biz = await db.business.find_one({"id":"main"}) or {}
    geo = biz.get("geofence") or {"lat": 5.360, "lng": -3.994, "radius_m": 150, "mandatory": False}
    distance = None; outside = False
    if lat is not None and lng is not None and geo.get("lat"):
        distance = _haversine_m(float(lat), float(lng), float(geo["lat"]), float(geo["lng"]))
        outside = distance > int(geo.get("radius_m", 150))
    if outside and geo.get("mandatory") and method == "phone":
        raise HTTPException(400, f"Pointage refusé : vous êtes à {distance} m de la boutique (max {geo.get('radius_m')} m)")
    today = datetime.now(timezone.utc).date().isoformat()
    now = datetime.now(timezone.utc)
    # Compute lateness vs role hours
    hours = (biz.get("working_hours") or {}).get(user.get("role","")) or {"open":"08:00","tolerance_min":10}
    late = False; late_min = 0
    if kind == "arrival":
        oh, om = (hours.get("open","08:00").split(":") + ["00"])[:2]
        open_dt = now.replace(hour=int(oh), minute=int(om), second=0, microsecond=0)
        tol = int(hours.get("tolerance_min",10))
        delta = int((now - open_dt).total_seconds()/60)
        if delta > tol: late = True; late_min = delta
    # Departure without reconciliation flag (riders)
    flags = []
    if outside: flags.append("hors_boutique")
    if kind == "departure" and user.get("role") == "rider":
        pending_recon = await db.delivery_sessions.count_documents({"rider_id": user.get("id"), "status": {"$ne": "reconciled"}})
        if pending_recon > 0:
            flags.append("depart_sans_reconciliation")
            await db.notifications.insert_one({"id":new_id(),"type":"attendance_alert","title":"Départ sans réconciliation","msg":f"{user.get('name')} a pointé le départ sans réconcilier ses livraisons","color":"#c62828","at":now_iso(),"link":"/console/livraisons"})
    doc = {"id": new_id(), "user_id": user.get("id"), "user_name": user.get("name"), "user_role": user.get("role"),
           "day": today, "kind": kind, "method": method, "at": now_iso(), "selfie": selfie,
           "lat": lat, "lng": lng, "distance_m": distance, "outside": outside,
           "late": late, "late_min": late_min, "flags": flags}
    await db.attendance.insert_one(doc)
    if outside:
        await db.notifications.insert_one({"id":new_id(),"type":"attendance_alert","title":"Pointage hors boutique","msg":f"{user.get('name')} à {distance} m","color":"#e4991e","at":now_iso(),"link":"/console/pointage"})
    return {"ok": True, "late": late, "late_min": late_min, "distance_m": distance, "outside": outside, "flags": flags, "at": doc["at"]}

@api.get("/attendance/today")
async def attendance_today(user: dict = Depends(require_role("admin","manager"))):
    today = datetime.now(timezone.utc).date().isoformat()
    rows = await db.attendance.find({"day": today}).sort("at",-1).to_list(200)
    all_employees = await db.users.find({"role": {"$in": ["manager","rider","caissiere","stock_keeper"]}, "active": True}).to_list(200)
    present_ids = {r["user_id"] for r in rows if r["kind"]=="arrival"}
    not_checked = [{"id":u["id"],"name":u["name"],"role":u["role"]} for u in all_employees if u["id"] not in present_ids]
    return {"today": clean(rows), "not_checked_in": not_checked, "present_count": len(present_ids), "total_employees": len(all_employees)}

@api.get("/attendance/calendar/{eid}")
async def attendance_calendar(eid: str, month: Optional[str] = None, user: dict = Depends(require_role("admin","manager"))):
    """Return per-day status for a given employee and month (YYYY-MM)."""
    now = datetime.now(timezone.utc)
    ym = month or now.strftime("%Y-%m")
    rows = await db.attendance.find({"user_id": eid, "day": {"$regex": f"^{ym}"}}).to_list(1000)
    days = {}
    for r in rows:
        d = days.setdefault(r["day"], {"arrival": None, "departure": None, "late": False, "late_min": 0, "flags": []})
        if r["kind"] == "arrival": d["arrival"] = r["at"]; d["late"] = r.get("late", False); d["late_min"] = r.get("late_min",0)
        if r["kind"] == "departure": d["departure"] = r["at"]
        d["flags"] = list(set(d["flags"] + (r.get("flags") or [])))
    return {"month": ym, "days": days}

@api.get("/attendance/stats/{eid}")
async def attendance_stats(eid: str, days: int = 30, user: dict = Depends(require_role("admin","manager"))):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    rows = await db.attendance.find({"user_id": eid, "day": {"$gte": cutoff}}).to_list(1000)
    worked_days = len({r["day"] for r in rows if r["kind"]=="arrival"})
    late_count = sum(1 for r in rows if r["kind"]=="arrival" and r.get("late"))
    total_late_min = sum(r.get("late_min",0) for r in rows)
    outside = sum(1 for r in rows if r.get("outside"))
    arrivals = [r for r in rows if r["kind"]=="arrival" and r.get("at")]
    avg_arrival_h = None
    if arrivals:
        total_min = sum((datetime.fromisoformat(r["at"].replace("Z","+00:00")).hour*60 + datetime.fromisoformat(r["at"].replace("Z","+00:00")).minute) for r in arrivals)
        avg = total_min // len(arrivals)
        avg_arrival_h = f"{avg//60:02d}:{avg%60:02d}"
    return {"worked_days": worked_days, "late_count": late_count, "late_min_total": total_late_min, "outside_count": outside,
            "punctuality_pct": round((worked_days-late_count)/max(1,worked_days)*100, 1), "avg_arrival": avg_arrival_h}

@api.patch("/business/geofence")
async def update_geofence(body: Dict[str,Any], user: dict = Depends(require_role("admin"))):
    """Set the store GPS, radius and mandatory flag."""
    geo = {"lat": float(body.get("lat") or 0), "lng": float(body.get("lng") or 0),
           "radius_m": int(body.get("radius_m", 150)), "mandatory": bool(body.get("mandatory", False))}
    await db.business.update_one({"id":"main"}, {"$set": {"geofence": geo}}, upsert=True)
    return {"ok": True, "geofence": geo}

@api.patch("/business/working-hours")
async def update_working_hours(body: Dict[str,Any], user: dict = Depends(require_role("admin"))):
    await db.business.update_one({"id":"main"}, {"$set": {"working_hours": body.get("working_hours") or {}}}, upsert=True)
    return {"ok": True}

# -------- Stock adjustment with approval --------
@api.post("/stock/adjustments")
async def stock_adjust(body: Dict[str,Any], user: dict = Depends(get_user)):
    """If user is admin, apply directly. Otherwise create approval request."""
    pid = body.get("product_id"); delta = int(body.get("delta",0)); reason = body.get("reason","")
    if not pid or delta == 0: raise HTTPException(400)
    if user.get("role") == "admin":
        await db.products.update_one({"id": pid}, {"$inc": {"stock": delta}})
        await db.stock_movements.insert_one({"id":new_id(),"product_id":pid,"delta":delta,"reason":reason,"by":user.get("name"),"at":now_iso()})
        await db.audit_log.insert_one({"id":new_id(),"user_id":user.get("id"),"user_name":user.get("name"),"action":"stock.adjust","entity_id":pid,"after":{"delta":delta,"reason":reason},"at":now_iso()})
        return {"ok": True, "applied": True}
    doc = {"id": new_id(), "kind": "stock_adjust", "requested_by_id": user.get("id"), "requested_by_name": user.get("name"),
           "payload": {"product_id": pid, "delta": delta}, "reason": reason, "status":"pending", "created_at": now_iso()}
    await db.approval_requests.insert_one(doc)
    return {"ok": True, "applied": False, "approval_request_id": doc["id"]}

# ---------- Fix pack 3 : Waitlist grouping, Out-of-catalog, Abandoned reminders, Invoices ----------

@api.get("/waitlist/grouped")
async def waitlist_grouped(user: dict = Depends(require_role("admin","manager"))):
    """Group pending waitlist entries by product + size + color with customer list."""
    rows = await db.waitlist.find({"notified_at": None}).to_list(1000)
    pids = list({r.get("product_id") for r in rows})
    prods = {p["id"]: p for p in await db.products.find({"id": {"$in": pids}}).to_list(500)}
    groups: Dict[str, Any] = {}
    for r in rows:
        pid = r.get("product_id"); s = r.get("size") or ""; co = r.get("color") or ""
        key = f"{pid}::{s}::{co}"
        g = groups.setdefault(key, {"product_id": pid, "product": prods.get(pid), "size": s, "color": co, "customers": []})
        g["customers"].append({"id": r.get("id"), "name": r.get("name"), "phone": r.get("phone"), "created_at": r.get("created_at")})
    out = sorted(groups.values(), key=lambda g: -len(g["customers"]))
    total_customers = sum(len(g["customers"]) for g in out)
    conv = await db.waitlist.count_documents({"notified_at": {"$ne": None}, "converted": True})
    notified = await db.waitlist.count_documents({"notified_at": {"$ne": None}})
    return {"groups": clean(out), "pending": len(rows), "products_affected": len(pids), "customers_total": total_customers, "conversion_pct": round(conv/max(1,notified)*100,1) if notified else 0}

@api.post("/waitlist/{wid}/notify")
async def waitlist_notify(wid: str, body: Dict[str, Any] = None, user: dict = Depends(require_role("admin","manager"))):
    w = await db.waitlist.find_one({"id": wid})
    if not w: raise HTTPException(404)
    body = body or {}
    # Log the outbound notification with its channel/message/offer details for traceability
    log = {
        "id": new_id(), "waitlist_id": wid, "product_id": w.get("product_id"),
        "customer_name": w.get("name"), "customer_phone": w.get("phone"),
        "channels": body.get("channels") or ["whatsapp"],
        "message": body.get("message") or "",
        "offer_type": body.get("offer_type") or "none",
        "offer_value": body.get("offer_value") or 0,
        "offer_custom": body.get("offer_custom"),
        "image": body.get("image"),
        "starts_at": body.get("starts_at") or now_iso(),
        "ends_at": body.get("ends_at"),
        "sent_at": now_iso(), "sent_by": user.get("name"),
    }
    await db.waitlist_notifications.insert_one(log)
    await db.waitlist.update_one({"id": wid}, {"$set": {"notified_at": now_iso(), "notified_by": user.get("name")}})
    return {"ok": True, "notification_id": log["id"]}

class OutOfCatalogIn(BaseModel):
    keyword: str
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None
    channel: str = "site"  # site | pos | search

@api.post("/public/out-of-catalog")
async def public_out_of_catalog(body: OutOfCatalogIn):
    doc = {"id": new_id(), "keyword": body.keyword.strip().lower(), "customer_phone": body.customer_phone,
           "customer_name": body.customer_name, "channel": body.channel, "created_at": now_iso()}
    await db.out_of_catalog.insert_one(doc)
    return {"ok": True}

@api.get("/out-of-catalog")
async def list_out_of_catalog(user: dict = Depends(require_role("admin","manager"))):
    rows = await db.out_of_catalog.find({}).sort("created_at",-1).to_list(500)
    buckets: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        k = r["keyword"]
        b = buckets.setdefault(k, {"keyword": k, "count": 0, "requests": []})
        b["count"] += 1
        if len(b["requests"]) < 20: b["requests"].append(clean(r))
    out = sorted(buckets.values(), key=lambda b: -b["count"])
    return {"keywords": out, "total": len(rows)}

@api.get("/abandoned-carts/{aid}")
async def abandoned_cart_detail(aid: str, user: dict = Depends(require_role("admin","manager"))):
    a = await db.abandoned_carts.find_one({"id": aid})
    if not a: raise HTTPException(404)
    # Enrich with customer stats
    cust_phone = (a.get("customer") or {}).get("phone") or a.get("customer_phone")
    stats = {"orders_count": 0, "total_spent": 0, "tier": None}
    if cust_phone:
        c = await db.customers.find_one({"phone": cust_phone})
        if c:
            orders = await db.orders.find({"customer.phone": cust_phone}).to_list(500)
            stats = {"orders_count": len(orders), "total_spent": sum(o.get("total",0) for o in orders),
                     "tier": c.get("tier"), "loyalty_points": c.get("loyalty_points",0)}
            a["customer_full"] = clean(c)
    a["customer_stats"] = stats
    # Previous reminders
    reminders = await db.cart_reminders.find({"cart_id": aid}).sort("sent_at",-1).to_list(50)
    a["reminders"] = clean(reminders)
    return clean(a)

class RelaunchOfferIn(BaseModel):
    cart_ids: List[str] = []  # empty = all abandoned in period
    offer_type: str = "none"  # none | pct | amount | special_price | free_delivery | gift
    value: Optional[float] = 0
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    code: Optional[str] = None
    channels: List[str] = ["whatsapp"]  # whatsapp | inapp | both
    message: str = ""
    period_from: Optional[str] = None
    period_to: Optional[str] = None

@api.post("/abandoned-carts/relaunch")
async def abandoned_relaunch(body: RelaunchOfferIn, user: dict = Depends(require_role("admin","manager"))):
    targets = []
    if body.cart_ids:
        targets = await db.abandoned_carts.find({"id": {"$in": body.cart_ids}}).to_list(500)
    elif body.period_from and body.period_to:
        targets = await db.abandoned_carts.find({"created_at": {"$gte": body.period_from, "$lte": body.period_to}, "recovered": {"$ne": True}}).to_list(1000)
    else:
        targets = await db.abandoned_carts.find({"recovered": {"$ne": True}}).to_list(500)
    code = body.code or (f"RELANCE-{int(time.time())%100000}" if body.offer_type != "none" else None)
    sent = 0
    for a in targets:
        phone = (a.get("customer") or {}).get("phone") or a.get("customer_phone") or ""
        name = (a.get("customer") or {}).get("name") or a.get("customer_name") or "Cliente"
        pd = "".join(c for c in phone if c.isdigit())
        if not pd: continue
        msg = (body.message
               .replace("{prénom}", name.split()[0])
               .replace("{produits}", ", ".join(it.get("name","") for it in a.get("items",[])))
               .replace("{code}", code or "")
               .replace("{date_fin}", (body.ends_at or "")[:10])
               .replace("{lien_panier}", f"https://chezdina.ci/boutique/panier"))
        if "whatsapp" in body.channels or "both" in body.channels:
            await db.whatsapp_outbox.insert_one({"id":new_id(),"phone":phone,"phone_digits":pd,"message":msg,
                "link":f"https://wa.me/{pd}?text={_url_quote(msg)}","kind":"cart_relaunch","cart_id":a["id"],
                "sent":False,"created_at":now_iso()})
        await db.cart_reminders.insert_one({"id":new_id(),"cart_id":a["id"],"channel":",".join(body.channels),
            "offer_type":body.offer_type,"value":body.value,"code":code,"message":msg,
            "sent_at":now_iso(),"sent_by":user.get("name")})
        await db.abandoned_carts.update_one({"id": a["id"]}, {"$set": {"status":"relance","last_reminder_at":now_iso()}})
        sent += 1
    return {"ok": True, "sent": sent, "code": code}

# Enforce order status transitions by role (Fix pack 3)
TERMINAL_STATUSES = {"livree","annulee","reportee","echouee"}
ROLE_ALLOWED_STATUSES = {
    "admin": None,  # any
    "manager": {"nouvelle","confirmee","en_preparation","prete","assignee"},
    "rider": {"en_livraison","livree","annulee","reportee","echouee"},
}

@api.patch("/orders/{oid}/status-v3")
async def update_order_status_v3(oid: str, body: Dict[str,Any], user: dict = Depends(get_user)):
    """Fix pack 3: role-enforced status transitions with scan check + auto invoice on delivery."""
    new_status = body.get("status")
    reason = body.get("reason","")
    o = await db.orders.find_one({"id": oid})
    if not o: raise HTTPException(404)
    role = user.get("role","")
    allowed = ROLE_ALLOWED_STATUSES.get(role)
    if allowed is not None and new_status not in allowed:
        # Allow admin override with reason; otherwise reject
        if role != "admin":
            raise HTTPException(403, f"Rôle {role} ne peut pas passer la commande en « {new_status} »")
        if new_status in TERMINAL_STATUSES and not reason:
            raise HTTPException(400, "Raison obligatoire pour cette action (override)")
    # Preparation control: 'prete' requires scanned items match
    if new_status == "prete":
        scanned = body.get("scanned_items") or []
        if scanned and len(scanned) < len(o.get("items",[])):
            raise HTTPException(400, f"Scan incomplet : {len(scanned)}/{len(o.get('items',[]))} articles")
    patch = {"status": new_status, "updated_at": now_iso()}
    if new_status == "livree": patch["delivered_at"] = now_iso(); patch["payment_status"] = "paye"
    if new_status == "annulee": patch["cancellation_reason"] = reason
    await db.orders.update_one({"id": oid}, {
        "$set": patch,
        "$push": {"timeline": {"status": new_status, "at": now_iso(), "by": user.get("name"), "reason": reason}}
    })
    await db.audit_log.insert_one({"id":new_id(),"user_id":user.get("id"),"user_name":user.get("name"),"action":f"order.status.{new_status}","entity_id":oid,"before":{"status":o.get("status")},"after":{"status":new_status,"reason":reason},"at":now_iso()})
    # Auto-generate invoice when delivered
    if new_status == "livree":
        await db.invoices.update_one({"order_id": oid}, {"$setOnInsert": {
            "id": new_id(), "number": f"INV-{int(time.time())%1000000}", "order_id": oid, "order_code": o.get("code"),
            "customer": o.get("customer"), "items": o.get("items"), "subtotal": o.get("subtotal"),
            "delivery_fee": o.get("delivery_fee",0), "discount": o.get("discount",0), "total": o.get("total"),
            "status": "payee" if o.get("payment_status") == "paye" or True else "a_payer",
            "created_at": now_iso(), "generated_by": "auto"
        }}, upsert=True)
    return {"ok": True}

@api.get("/orders/{oid}/invoice")
async def get_order_invoice(oid: str, user: dict = Depends(get_user)):
    inv = await db.invoices.find_one({"order_id": oid})
    if not inv:
        o = await db.orders.find_one({"id": oid})
        if not o: raise HTTPException(404)
        return {"invoice": None, "order_code": o.get("code")}
    return {"invoice": clean(inv)}

@api.post("/orders/{oid}/generate-invoice")
async def generate_invoice(oid: str, user: dict = Depends(require_role("admin","manager"))):
    o = await db.orders.find_one({"id": oid})
    if not o: raise HTTPException(404)
    existing = await db.invoices.find_one({"order_id": oid})
    if existing: return {"ok": True, "invoice": clean(existing), "already": True}
    inv = {"id": new_id(), "number": f"INV-{int(time.time())%1000000}", "order_id": oid, "order_code": o.get("code"),
           "customer": o.get("customer"), "items": o.get("items"), "subtotal": o.get("subtotal"),
           "delivery_fee": o.get("delivery_fee",0), "discount": o.get("discount",0), "total": o.get("total"),
           "status": "payee" if o.get("payment_status") == "paye" else "a_payer",
           "created_at": now_iso(), "generated_by": user.get("name")}
    await db.invoices.insert_one(inv)
    return {"ok": True, "invoice": clean(inv)}


async def _seed_demo_content_legacy():
    """Legacy seed block (orphaned by earlier insert) — kept for reference, not auto-called. Use /admin/seed-demo instead."""
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
    # Expense Categories (default list)
    if await db.expense_categories.count_documents({}) == 0:
        DEFAULT_CATS = [
            ("Loyer", "fixe"), ("Électricité", "variable"), ("Eau", "variable"),
            ("Salaires", "fixe"), ("Transport", "variable"), ("Marketing", "variable"),
            ("Internet", "fixe"), ("Fournitures", "variable"), ("Taxes", "fixe"),
            ("Emballage", "variable"), ("Carburant livreurs", "variable"), ("Autre", "variable"),
        ]
        await db.expense_categories.insert_many([
            {"id": new_id(), "name": n, "type": t, "created_at": now_iso()} for n, t in DEFAULT_CATS
        ])
    # Expenses
    if await db.expenses.count_documents({}) == 0:
        cats = ["Loyer","CIE","SODECI","Internet","Salaires","Carburant livreurs","Emballage","Publicité"]
        FIXED = {"Loyer","Internet","Salaires"}
        exps = []
        for m in range(6):
            for c in cats:
                created_at = (datetime.now(timezone.utc)-timedelta(days=30*m+random.randint(0,25))).isoformat()
                exps.append({"id": new_id(), "category": c, "label": f"{c} - mois M-{m}",
                             "amount": random.choice([25000,45000,75000,120000,250000,350000,500000]) if c in ("Loyer","Salaires") else random.choice([5000,15000,25000,45000,65000]),
                             "note": f"{c} - mois M-{m}", "store_id":"store-cocody", "payment_method":"cash",
                             "type": "fixe" if c in FIXED else "variable",
                             "paid_at": created_at,
                             "created_at": created_at,
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
# P5 Refactor scaffold — modular routers go here as domains get extracted from server.py.
from routers.meta import router as meta_router
app.include_router(meta_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["*"])

@app.on_event("shutdown")
async def shutdown(): client.close()
