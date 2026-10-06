from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os, logging, uuid, random
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
@api.post("/public/customer-register")
async def cust_register(body: CustomerIn):
    if not body.password: raise HTTPException(400, "Mot de passe requis")
    existing = await db.customers.find_one({"$or":[{"phone": body.phone},{"email": body.email}]})
    if existing: raise HTTPException(400, "Compte existant")
    doc = body.model_dump(exclude={"password"})
    doc.update({"id": new_id(), "created_at": now_iso(), "wallet": 0, "loyalty_points": 0,
                "referral_code": f"DINA-{random.randint(1000,9999)}", "tier": "Bronze",
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
async def get_customer(cid: str, user: dict = Depends(get_user)):
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

@api.patch("/orders/{oid}/status")
async def update_order_status(oid: str, body: StatusIn, user: dict = Depends(get_user)):
    o = await db.orders.find_one({"id": oid})
    if not o: raise HTTPException(404)
    tl = o.get("timeline", []); tl.append({"status": body.status, "at": now_iso(), "by": user.get("name"), "reason": body.reason, "next_date": body.next_date})
    upd = {"status": body.status, "timeline": tl}
    if body.reason: upd["last_reason"] = body.reason
    if body.next_date: upd["rescheduled_for"] = body.next_date
    await db.orders.update_one({"id": oid}, {"$set": upd})
    return {"ok": True}

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
@api.get("/public/site")
async def public_site():
    s = await db.site_settings.find_one({"id":"main"})
    return clean(s or {})

@api.patch("/site")
async def update_site(body: Dict[str,Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("_id",None)
    await db.site_settings.update_one({"id":"main"}, {"$set":{**body,"id":"main","updated_at":now_iso()}}, upsert=True)
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
