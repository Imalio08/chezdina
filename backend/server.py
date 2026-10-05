from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os, logging, uuid, random, asyncio, secrets, hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, BackgroundTasks
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
import bcrypt, jwt

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
logger = logging.getLogger("dina")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Dina Store API")
api = APIRouter(prefix="/api")

JWT_SECRET = os.environ.get("JWT_SECRET", "dina-dev-secret")
JWT_ALG = "HS256"

def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def verify_pw(p: str, h: str) -> bool:
    try: return bcrypt.checkpw(p.encode(), h.encode())
    except Exception: return False
def make_token(uid: str, role: str, minutes: int = 60*24*7) -> str:
    return jwt.encode({"sub": uid, "role": role, "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes), "type": "access"}, JWT_SECRET, algorithm=JWT_ALG)

def new_id() -> str: return str(uuid.uuid4())
def now_iso() -> str: return datetime.now(timezone.utc).isoformat()
def clean(d: Any) -> Any:
    if isinstance(d, list): return [clean(x) for x in d]
    if isinstance(d, dict): return {k: clean(v) for k, v in d.items() if k != "_id"}
    return d

async def get_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "): token = h[7:]
    if not token: raise HTTPException(401, "Non authentifié")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception: raise HTTPException(401, "Session expirée")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user: raise HTTPException(401, "Utilisateur introuvable")
    user.pop("_id", None); user.pop("password_hash", None); user.pop("pin_hash", None)
    return user

def require_role(*roles):
    async def dep(user: dict = Depends(get_user)):
        if user.get("role") not in roles and user.get("role") != "admin":
            raise HTTPException(403, "Accès refusé")
        return user
    return dep

# ---------- Models ----------
class LoginIn(BaseModel):
    email: str
    password: str
class PinIn(BaseModel):
    pin: str
class ProductIn(BaseModel):
    name: str; category: str; brand: str; price: int; cost: int = 0
    description: str = ""; image: str = ""; sizes: List[str] = []; colors: List[str] = []
    stock: int = 0; store_id: Optional[str] = None; sku: Optional[str] = None
class OrderItem(BaseModel):
    product_id: str; name: str; size: Optional[str] = None; color: Optional[str] = None
    qty: int = 1; price: int; image: Optional[str] = None
class OrderIn(BaseModel):
    items: List[OrderItem]
    customer: Optional[Dict[str, Any]] = None
    channel: str = "store"
    payment_method: str = "cash"
    delivery_zone: Optional[str] = None
    delivery_fee: int = 0
    discount: int = 0
    note: str = ""
    mode: str = "store"  # store | delivery | pickup
    store_id: Optional[str] = None
class CustomerIn(BaseModel):
    name: str; phone: str; email: Optional[str] = None; birthday: Optional[str] = None
    shoe_size: Optional[str] = None; clothing_size: Optional[str] = None; notes: Optional[str] = None
class ExpenseIn(BaseModel):
    category: str; amount: int; note: str = ""; store_id: Optional[str] = None; payment_method: str = "cash"
class SupplierIn(BaseModel):
    name: str; country: str = "CI"; phone: str = ""; email: Optional[str] = None; balance: int = 0
class PromoIn(BaseModel):
    code: str; type: str = "percent"; value: int = 10; active: bool = True
class AttendanceIn(BaseModel):
    code: str
class AskIn(BaseModel):
    question: str
class DeliveryUpdateIn(BaseModel):
    status: str; note: Optional[str] = None

# ---------- Auth ----------
@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    u = await db.users.find_one({"email": email})
    if not u or not verify_pw(body.password, u.get("password_hash","")):
        raise HTTPException(401, "Identifiants incorrects")
    token = make_token(u["id"], u["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=60*60*24*7, path="/")
    u.pop("_id", None); u.pop("password_hash", None); u.pop("pin_hash", None)
    return {"user": u, "token": token}

@api.post("/auth/login-pin")
async def login_pin(body: PinIn, response: Response):
    pin = body.pin.strip()
    # find any user with matching pin (for shared tablet)
    async for u in db.users.find({}):
        if verify_pw(pin, u.get("pin_hash","")):
            token = make_token(u["id"], u["role"])
            response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=60*60*24*7, path="/")
            u.pop("_id", None); u.pop("password_hash", None); u.pop("pin_hash", None)
            return {"user": u, "token": token}
    raise HTTPException(401, "PIN invalide")

@api.get("/auth/me")
async def me(user: dict = Depends(get_user)):
    return user

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

# ---------- Core data ----------
@api.get("/stores")
async def stores(user: dict = Depends(get_user)):
    return clean(await db.stores.find({}).to_list(100))

@api.get("/products")
async def products(user: dict = Depends(get_user), store_id: Optional[str] = None, q: Optional[str] = None):
    f = {}
    if store_id and store_id != "all": f["store_id"] = store_id
    if q: f["name"] = {"$regex": q, "$options": "i"}
    return clean(await db.products.find(f).to_list(500))

@api.post("/products")
async def create_product(body: ProductIn, user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso(), "sku": body.sku or f"DN-{random.randint(10000,99999)}"})
    await db.products.insert_one(doc)
    return clean(doc)

@api.patch("/products/{pid}")
async def update_product(pid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    body.pop("id", None); body.pop("_id", None)
    await db.products.update_one({"id": pid}, {"$set": body})
    return {"ok": True}

@api.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(require_role("admin","manager"))):
    await db.products.delete_one({"id": pid})
    return {"ok": True}

@api.get("/customers")
async def customers(user: dict = Depends(get_user), q: Optional[str] = None):
    f = {}
    if q: f["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": q, "$options": "i"}}]
    return clean(await db.customers.find(f).sort("created_at", -1).to_list(500))

@api.post("/customers")
async def create_customer(body: CustomerIn, user: dict = Depends(get_user)):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso(), "wallet": 0, "loyalty_points": 0, "referral_code": f"DINA-{random.randint(1000,9999)}", "tier": "Bronze"})
    await db.customers.insert_one(doc)
    return clean(doc)

@api.get("/orders")
async def orders(user: dict = Depends(get_user), status: Optional[str] = None, store_id: Optional[str] = None, channel: Optional[str] = None):
    f = {}
    if status: f["status"] = status
    if store_id and store_id != "all": f["store_id"] = store_id
    if channel: f["channel"] = channel
    return clean(await db.orders.find(f).sort("created_at", -1).to_list(500))

def gen_order_code():
    return f"DN-{datetime.now().strftime('%y%m%d')}-{random.randint(1000,9999)}"

@api.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(get_user)):
    subtotal = sum(it.qty * it.price for it in body.items)
    total = subtotal + body.delivery_fee - body.discount
    doc = {
        "id": new_id(), "code": gen_order_code(), "items": [it.model_dump() for it in body.items],
        "customer": body.customer, "channel": body.channel, "payment_method": body.payment_method,
        "delivery_zone": body.delivery_zone, "delivery_fee": body.delivery_fee, "discount": body.discount,
        "note": body.note, "mode": body.mode, "store_id": body.store_id or "store-cocody",
        "subtotal": subtotal, "total": total, "status": "nouvelle" if body.mode != "store" else "livree",
        "payment_status": "paye" if body.payment_method in ("cash","wave") and body.mode == "store" else "en_attente",
        "created_at": now_iso(), "created_by": user.get("name"), "timeline": [{"status": "nouvelle", "at": now_iso(), "by": user.get("name","système")}]
    }
    # Stock decrement (simple)
    for it in body.items:
        await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.qty}})
    await db.orders.insert_one(doc)
    return clean(doc)

@api.patch("/orders/{oid}/status")
async def update_order_status(oid: str, body: DeliveryUpdateIn, user: dict = Depends(get_user)):
    o = await db.orders.find_one({"id": oid})
    if not o: raise HTTPException(404)
    tl = o.get("timeline", []); tl.append({"status": body.status, "at": now_iso(), "by": user.get("name")})
    await db.orders.update_one({"id": oid}, {"$set": {"status": body.status, "timeline": tl}})
    return {"ok": True}

@api.get("/orders/track/{code}")
async def track(code: str):
    o = await db.orders.find_one({"code": code})
    if not o: raise HTTPException(404, "Commande introuvable")
    return clean(o)

# ---------- Deliveries ----------
@api.get("/deliveries")
async def deliveries(user: dict = Depends(get_user)):
    f = {"mode": "delivery"}
    if user.get("role") == "rider": f["rider_id"] = user["id"]
    return clean(await db.orders.find(f).sort("created_at", -1).to_list(200))

@api.patch("/deliveries/{oid}/assign")
async def assign_delivery(oid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin","manager"))):
    rider_id = body.get("rider_id"); rider_name = body.get("rider_name")
    o = await db.orders.find_one({"id": oid})
    tl = o.get("timeline", []); tl.append({"status": "assignee", "at": now_iso(), "by": user.get("name"), "note": f"→ {rider_name}"})
    await db.orders.update_one({"id": oid}, {"$set": {"rider_id": rider_id, "rider_name": rider_name, "status": "assignee", "timeline": tl}})
    return {"ok": True}

# ---------- Expenses ----------
@api.get("/expenses")
async def expenses(user: dict = Depends(get_user)):
    return clean(await db.expenses.find({}).sort("created_at", -1).to_list(500))

@api.post("/expenses")
async def create_expense(body: ExpenseIn, user: dict = Depends(get_user)):
    doc = body.model_dump(); doc.update({"id": new_id(), "created_at": now_iso(), "created_by": user.get("name")})
    await db.expenses.insert_one(doc)
    return clean(doc)

# ---------- Suppliers / Purchase Orders ----------
@api.get("/suppliers")
async def suppliers(user: dict = Depends(get_user)):
    return clean(await db.suppliers.find({}).to_list(100))

@api.post("/suppliers")
async def create_supplier(body: SupplierIn, user: dict = Depends(require_role("admin","manager","stock_keeper"))):
    doc = body.model_dump(); doc.update({"id": new_id(), "created_at": now_iso()})
    await db.suppliers.insert_one(doc)
    return clean(doc)

@api.get("/purchase-orders")
async def purchase_orders(user: dict = Depends(get_user)):
    return clean(await db.purchase_orders.find({}).sort("created_at", -1).to_list(200))

# ---------- Promotions ----------
@api.get("/promotions")
async def promos(user: dict = Depends(get_user)):
    return clean(await db.promotions.find({}).to_list(100))
@api.post("/promotions")
async def create_promo(body: PromoIn, user: dict = Depends(require_role("admin","manager"))):
    doc = body.model_dump(); doc.update({"id": new_id(), "created_at": now_iso(), "uses": 0})
    await db.promotions.insert_one(doc)
    return clean(doc)

# ---------- Invoices ----------
@api.get("/invoices")
async def invoices(user: dict = Depends(get_user)):
    return clean(await db.invoices.find({}).sort("created_at", -1).to_list(200))

# ---------- Team ----------
@api.get("/team")
async def team(user: dict = Depends(get_user)):
    rows = await db.users.find({}, {"password_hash":0,"pin_hash":0}).to_list(200)
    return clean(rows)

@api.get("/attendance")
async def attendance(user: dict = Depends(get_user)):
    return clean(await db.attendance.find({}).sort("at", -1).to_list(200))

@api.post("/attendance/punch")
async def punch(body: AttendanceIn):
    # match by last 4 digits of phone as attendance code
    u = await db.users.find_one({"attendance_code": body.code})
    if not u: raise HTTPException(404, "Code inconnu")
    doc = {"id": new_id(), "user_id": u["id"], "user_name": u["name"], "role": u["role"], "at": now_iso(), "type": "in"}
    await db.attendance.insert_one(doc)
    return {"ok": True, "user": u["name"]}

# ---------- Dashboard & Stats ----------
@api.get("/dashboard/kpis")
async def kpis(user: dict = Depends(get_user), store_id: Optional[str] = None):
    f = {}
    if store_id and store_id != "all": f["store_id"] = store_id
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    month_start = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    orders_all = await db.orders.find(f).to_list(2000)
    rev_today = sum(o.get("total",0) for o in orders_all if o.get("created_at","") >= today_start)
    rev_week = sum(o.get("total",0) for o in orders_all if o.get("created_at","") >= week_start)
    rev_month = sum(o.get("total",0) for o in orders_all if o.get("created_at","") >= month_start)
    items_sold = sum(sum(it.get("qty",0) for it in o.get("items",[])) for o in orders_all if o.get("created_at","") >= month_start)
    customers_new = await db.customers.count_documents({"created_at": {"$gte": month_start}})
    low_stock = await db.products.count_documents({"stock": {"$lt": 5}})
    pending_orders = await db.orders.count_documents({"status": {"$in": ["nouvelle","confirmee","en_preparation","prete","assignee","en_livraison"]}})
    # sales by day (last 14 days)
    series = {}
    for i in range(14):
        d = (datetime.now(timezone.utc) - timedelta(days=13-i)).strftime("%Y-%m-%d")
        series[d] = 0
    for o in orders_all:
        d = o.get("created_at","")[:10]
        if d in series: series[d] += o.get("total",0)
    sales_series = [{"date": k[5:], "value": v} for k, v in series.items()]
    # top products
    counts: Dict[str, Dict[str, Any]] = {}
    for o in orders_all:
        for it in o.get("items", []):
            key = it["product_id"]
            if key not in counts: counts[key] = {"name": it["name"], "qty": 0, "revenue": 0, "image": it.get("image")}
            counts[key]["qty"] += it["qty"]; counts[key]["revenue"] += it["qty"]*it["price"]
    top = sorted(counts.values(), key=lambda x: x["qty"], reverse=True)[:5]
    # channel split
    channels: Dict[str, int] = {}
    for o in orders_all:
        channels[o.get("channel","store")] = channels.get(o.get("channel","store"),0) + o.get("total",0)
    return {
        "rev_today": rev_today, "rev_week": rev_week, "rev_month": rev_month,
        "items_sold": items_sold, "customers_new": customers_new, "low_stock": low_stock,
        "pending_orders": pending_orders, "sales_series": sales_series, "top_products": top,
        "channels": [{"name": k, "value": v} for k, v in channels.items()],
        "orders_count": len(orders_all),
        "avg_basket": int(sum(o.get("total",0) for o in orders_all) / max(1, len(orders_all))),
    }

# ---------- Site CMS ----------
@api.get("/public/site")
async def public_site():
    s = await db.site_settings.find_one({"id": "main"})
    return clean(s or {})

@api.patch("/site")
async def update_site(body: Dict[str, Any], user: dict = Depends(require_role("admin","manager"))):
    body.pop("_id", None)
    await db.site_settings.update_one({"id": "main"}, {"$set": {**body, "id": "main", "updated_at": now_iso()}}, upsert=True)
    return {"ok": True}

# ---------- Public storefront ----------
@api.get("/public/products")
async def public_products(q: Optional[str] = None, category: Optional[str] = None):
    f = {"visibility": {"$ne": "store"}}
    if q: f["name"] = {"$regex": q, "$options": "i"}
    if category and category != "all": f["category"] = category
    return clean(await db.products.find(f).to_list(500))

@api.get("/public/product/{pid}")
async def public_product(pid: str):
    p = await db.products.find_one({"id": pid})
    if not p: raise HTTPException(404)
    return clean(p)

@api.post("/public/orders")
async def public_order(body: OrderIn):
    subtotal = sum(it.qty * it.price for it in body.items)
    total = subtotal + body.delivery_fee - body.discount
    code = gen_order_code()
    doc = {
        "id": new_id(), "code": code, "items": [it.model_dump() for it in body.items],
        "customer": body.customer, "channel": body.channel or "boutique", "payment_method": body.payment_method,
        "delivery_zone": body.delivery_zone, "delivery_fee": body.delivery_fee, "discount": body.discount,
        "note": body.note, "mode": body.mode or "delivery", "store_id": "store-cocody",
        "subtotal": subtotal, "total": total, "status": "nouvelle",
        "payment_status": "en_attente", "created_at": now_iso(),
        "timeline": [{"status": "nouvelle", "at": now_iso(), "by": "boutique en ligne"}]
    }
    for it in body.items:
        await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.qty}})
    await db.orders.insert_one(doc)
    return {"code": code, "id": doc["id"]}

# ---------- AI Ask Dina ----------
@api.post("/ai/ask")
async def ask_dina(body: AskIn, user: dict = Depends(get_user)):
    # Pull a quick business context (role-filtered)
    products = await db.products.count_documents({})
    customers = await db.customers.count_documents({})
    orders = await db.orders.find({}).sort("created_at", -1).to_list(100)
    revenue = sum(o.get("total",0) for o in orders)
    top: Dict[str, int] = {}
    for o in orders:
        for it in o.get("items",[]): top[it["name"]] = top.get(it["name"],0) + it["qty"]
    best = sorted(top.items(), key=lambda x: x[1], reverse=True)[:5]
    context = f"Boutique: Dina Store (Abidjan). Produits: {products}. Clients: {customers}. CA récent (100 commandes): {revenue:,} FCFA. Top: {', '.join(f'{n} ({q})' for n,q in best)}."
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY",""), session_id=f"dina-{user['id']}", system_message=f"Tu es 'Dina Assist', l'assistante IA de Dina Store, une boutique de mode féminine à Abidjan. Réponds TOUJOURS en français, de façon concise, chiffrée et actionnable. Utilise ces données réelles: {context}").with_model("anthropic","claude-sonnet-4-5-20250929")
        reply = await chat.send_message(UserMessage(text=body.question))
        return {"answer": str(reply)}
    except Exception as e:
        logger.exception("AI error")
        return {"answer": f"Résumé rapide: CA récent ≈ {revenue:,} FCFA sur 100 commandes. Meilleurs produits: {', '.join(f'{n} ({q})' for n,q in best)}. (Mode local — vérifiez la clé EMERGENT_LLM_KEY : {e})"}

# ---------- Seed ----------
IVORIAN_NAMES = ["Aminata Koné","Fatou Traoré","Mariam Diallo","Awa Ouattara","Rokia Bamba","Sarah Yao","Christelle Brou","Nadège Kouassi","Fatim Cissé","Hawa Touré","Grace N'Guessan","Linda Zoro","Priscille Konan","Chantal Adou","Mireille Gnamien","Audrey Diomandé","Esther Soro","Céline Kouadio","Rachel Toto","Diane Assi","Mélanie Boni","Judith Kipré","Léa Yapo","Olivia Konate","Carine Bakayoko","Laure Angaman","Perle Gbagbo","Valérie Djédjé","Samira Bakary","Yasmine Doumbia"]
CATEGORIES = ["Chaussures","Robes","Hauts","Jupes","Pantalons","Ensembles","Sacs","Accessoires"]
BRANDS = ["Dina Signature","Zara","Mango","Shein","H&M","Ivoire Chic","Afrik Luxe","Elegance CI","Palm Beach","Riviera Style"]
COLORS = ["Noir","Blanc","Rouge","Beige","Doré","Marine","Rose poudré","Camel","Vert émeraude","Marron"]
SHOE_SIZES = ["36","37","38","39","40","41","42"]
CLOTH_SIZES = ["XS","S","M","L","XL","XXL"]
ZONES = ["Cocody","Riviera","Angré","Plateau","Marcory","Zone 4","Treichville","Koumassi","Yopougon","Abobo","Adjamé","Port-Bouët","Bingerville","Songon","Grand-Bassam"]
IMG_POOL = {
  "Chaussures": [
    "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800",
    "https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=800",
    "https://images.unsplash.com/photo-1596703263926-eb0762ee17e4?w=800",
    "https://images.unsplash.com/photo-1573100925118-870b8efc799c?w=800",
    "https://images.unsplash.com/photo-1562183241-b937e95585b6?w=800",
    "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800",
    "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800",
    "https://images.unsplash.com/photo-1631985561086-91ca9b4b65f3?w=800",
  ],
  "Robes": [
    "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800",
    "https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=800",
    "https://images.unsplash.com/photo-1583846783214-7229a91b20ed?w=800",
    "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800",
    "https://images.unsplash.com/photo-1551803091-e20673f15770?w=800",
    "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800",
    "https://images.unsplash.com/photo-1623609163859-ca93c959b98a?w=800",
    "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800",
  ],
  "Hauts": [
    "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800",
    "https://images.unsplash.com/photo-1554568218-0f1715e72254?w=800",
    "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=800",
    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=800",
    "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=800",
    "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800",
  ],
  "Jupes": [
    "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800",
    "https://images.unsplash.com/photo-1577900232427-18219b9166a0?w=800",
    "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800",
    "https://images.unsplash.com/photo-1551163943-3f6a855d1153?w=800",
    "https://images.unsplash.com/photo-1548624313-0396c75f8dca?w=800",
  ],
  "Pantalons": [
    "https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=800",
    "https://images.unsplash.com/photo-1548883354-94bcfe321cbb?w=800",
    "https://images.unsplash.com/photo-1594938328870-9623159c8c99?w=800",
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800",
    "https://images.unsplash.com/photo-1552902019-ebcd97aa9aa0?w=800",
  ],
  "Ensembles": [
    "https://images.unsplash.com/photo-1764265149928-9b29e483fe8d?w=800",
    "https://images.unsplash.com/photo-1709809081557-78f803ce93a0?w=800",
    "https://images.unsplash.com/photo-1613968988915-1309a52d8e8e?w=800",
    "https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=800",
    "https://images.unsplash.com/photo-1583846112692-5a7bdcedc67d?w=800",
  ],
  "Sacs": [
    "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800",
    "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800",
    "https://images.unsplash.com/photo-1591561954555-607968c989ab?w=800",
    "https://images.unsplash.com/photo-1559563458-527698bf5295?w=800",
    "https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?w=800",
    "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800",
    "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800",
    "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800",
  ],
  "Accessoires": [
    "https://images.unsplash.com/photo-1611923134239-b9be5bfe39e7?w=800",
    "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800",
    "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800",
    "https://images.unsplash.com/photo-1620625515032-6ed0c1790c75?w=800",
    "https://images.unsplash.com/photo-1573551565102-52d7bdd4e5cf?w=800",
    "https://images.unsplash.com/photo-1618436917352-cd3d11ea4d15?w=800",
  ],
}

async def seed_if_empty():
    # Users
    if await db.users.count_documents({}) == 0:
        base = [
            ("aouattaraesca@gmail.com","Admin123!","1234","Aïcha Ouattara","admin"),
            ("manager.cocody@dinastore.ci","Manager123!","2222","Fatou Konaté","manager"),
            ("manager.marcory@dinastore.ci","Manager123!","2223","Mireille Yao","manager"),
            ("agent1@dinastore.ci","Agent123!","3333","Grace N'Guessan","sales"),
            ("agent2@dinastore.ci","Agent123!","3334","Linda Zoro","sales"),
            ("stock@dinastore.ci","Stock123!","4444","Jean-Marc Soro","stock_keeper"),
            ("rider1@dinastore.ci","Rider123!","5555","Kouamé Serge","rider"),
            ("rider2@dinastore.ci","Rider123!","5556","Yao Franck","rider"),
            ("rider3@dinastore.ci","Rider123!","5557","Diomandé Issouf","rider"),
            ("rider4@dinastore.ci","Rider123!","5558","Bamba Oumar","rider"),
        ]
        docs = []
        for email, pw, pin, name, role in base:
            docs.append({"id": new_id(), "email": email, "password_hash": hash_pw(pw), "pin_hash": hash_pw(pin), "attendance_code": pin, "name": name, "role": role, "phone": f"+225 07 {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}", "store_id": "store-cocody" if role != "rider" else None, "active": True, "created_at": now_iso()})
        await db.users.insert_many(docs)
        logger.info(f"Seeded {len(docs)} users")

    # Stores
    if await db.stores.count_documents({}) == 0:
        await db.stores.insert_many([
            {"id":"store-cocody","name":"Dina Store Cocody","address":"Cocody Angré 7ème Tranche","phone":"+225 27 22 44 55 66","main":True,"created_at":now_iso()},
            {"id":"store-marcory","name":"Dina Store Marcory","address":"Marcory Zone 4C","phone":"+225 27 21 25 36 47","main":False,"created_at":now_iso()},
        ])

    # Products
    if await db.products.count_documents({}) == 0:
        products = []
        for i in range(120):
            cat = random.choice(CATEGORIES)
            sizes = SHOE_SIZES if cat == "Chaussures" else (CLOTH_SIZES if cat in ("Robes","Hauts","Jupes","Pantalons","Ensembles") else [])
            price = random.choice([5000,7500,9500,12500,15000,18500,22000,27500,32500,38000,45000,55000,65000,75000,85000])
            cost = int(price * random.uniform(0.4,0.65))
            products.append({
                "id": new_id(), "name": f"{cat} {random.choice(['Lagune','Baobab','Attiéké','Riviera','Palm','Akwaba','Doumbé','Zenith','Soleil','Harmattan'])} {random.randint(1,99)}",
                "category": cat, "brand": random.choice(BRANDS), "price": price, "cost": cost,
                "description": f"Pièce {cat.lower()} tendance, idéale pour la saison. Matière premium.",
                "image": random.choice(IMG_POOL[cat]),
                "images": random.sample(IMG_POOL[cat], min(len(IMG_POOL[cat]), random.randint(3,5))), "sizes": random.sample(sizes, min(len(sizes), random.randint(3,6))) if sizes else [],
                "colors": random.sample(COLORS, random.randint(2,4)),
                "stock": random.randint(0, 45), "store_id": random.choice(["store-cocody","store-marcory"]),
                "visibility": "both", "sku": f"DN-{10000+i}", "barcode": f"590{random.randint(1000000000,9999999999)}",
                "created_at": now_iso()
            })
        await db.products.insert_many(products)

    # Customers
    if await db.customers.count_documents({}) == 0:
        custs = []
        for i, n in enumerate((IVORIAN_NAMES * 10)[:300]):
            custs.append({
                "id": new_id(), "name": n, "phone": f"+225 07 {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}",
                "email": None, "shoe_size": random.choice(SHOE_SIZES), "clothing_size": random.choice(CLOTH_SIZES),
                "birthday": None, "wallet": random.choice([0,0,0,2500,5000,10000]), "loyalty_points": random.randint(0, 1500),
                "tier": random.choice(["Bronze","Bronze","Bronze","Silver","Silver","Gold"]), "referral_code": f"DINA-{1000+i}",
                "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0,180))).isoformat(),
            })
        await db.customers.insert_many(custs)

    # Suppliers
    if await db.suppliers.count_documents({}) == 0:
        await db.suppliers.insert_many([
            {"id":new_id(),"name":"Istanbul Fashion Hub","country":"TR","phone":"+90 212 555 11 22","balance":0,"created_at":now_iso()},
            {"id":new_id(),"name":"Guangzhou Textile","country":"CN","phone":"+86 20 1234 5678","balance":450000,"created_at":now_iso()},
            {"id":new_id(),"name":"Dubai Luxe Trading","country":"AE","phone":"+971 4 234 5678","balance":0,"created_at":now_iso()},
            {"id":new_id(),"name":"Afrik Textiles Abidjan","country":"CI","phone":"+225 27 22 00 11 22","balance":120000,"created_at":now_iso()},
            {"id":new_id(),"name":"Marrakech Souk","country":"MA","phone":"+212 524 44 55 66","balance":0,"created_at":now_iso()},
        ])

    # Promotions
    if await db.promotions.count_documents({}) == 0:
        await db.promotions.insert_many([
            {"id":new_id(),"code":"BIENVENUE10","type":"percent","value":10,"active":True,"uses":45,"created_at":now_iso()},
            {"id":new_id(),"code":"FLASH20","type":"percent","value":20,"active":True,"uses":12,"created_at":now_iso()},
            {"id":new_id(),"code":"LIVRAISON","type":"free_delivery","value":0,"active":True,"uses":78,"created_at":now_iso()},
        ])

    # Expenses (6 months)
    if await db.expenses.count_documents({}) == 0:
        cats = ["Loyer","CIE","SODECI","Internet","Salaires","Carburant livreurs","Emballage","Publicité"]
        exps = []
        for m in range(6):
            for c in cats:
                exps.append({
                    "id": new_id(), "category": c, "amount": random.choice([25000,45000,75000,120000,250000,350000,500000]) if c in ("Loyer","Salaires") else random.choice([5000,15000,25000,45000,65000]),
                    "note": f"{c} - mois M-{m}", "store_id": random.choice(["store-cocody","store-marcory"]),
                    "payment_method": "cash", "created_at": (datetime.now(timezone.utc) - timedelta(days=30*m+random.randint(0,25))).isoformat(),
                    "created_by": "Aïcha Ouattara",
                })
        await db.expenses.insert_many(exps)

    # Orders & deliveries
    if await db.orders.count_documents({}) == 0:
        prods = await db.products.find({}).to_list(500)
        custs = await db.customers.find({}).to_list(500)
        users = await db.users.find({"role":{"$in":["sales","manager","admin"]}}).to_list(50)
        riders = await db.users.find({"role":"rider"}).to_list(50)
        orders = []
        for i in range(260):
            items_count = random.randint(1,4)
            items = []
            for _ in range(items_count):
                p = random.choice(prods)
                items.append({"product_id": p["id"], "name": p["name"], "size": random.choice(p.get("sizes") or [None]), "color": random.choice(p.get("colors") or [None]), "qty": random.randint(1,2), "price": p["price"], "image": p.get("image")})
            subtotal = sum(it["qty"]*it["price"] for it in items)
            channel = random.choice(["store","boutique","whatsapp","instagram","manual","tiktok"])
            mode = random.choice(["store","delivery","delivery","pickup"])
            zone = random.choice(ZONES) if mode == "delivery" else None
            fee = random.choice([1000,1500,2000,2500,3000]) if mode == "delivery" else 0
            discount = random.choice([0,0,0,0,500,1000,2000])
            total = subtotal + fee - discount
            cust = random.choice(custs)
            status_pool = ["livree","livree","livree","livree","en_livraison","prete","nouvelle","confirmee","retournee","assignee"]
            status = "livree" if mode == "store" else random.choice(status_pool)
            created = (datetime.now(timezone.utc) - timedelta(days=random.randint(0,180), hours=random.randint(0,23))).isoformat()
            rider = random.choice(riders) if mode == "delivery" and status in ("assignee","en_livraison","livree") else None
            orders.append({
                "id": new_id(), "code": f"DN-{created[2:4]}{created[5:7]}{created[8:10]}-{1000+i}",
                "items": items, "customer": {"id": cust["id"], "name": cust["name"], "phone": cust["phone"]},
                "channel": channel, "payment_method": random.choice(["cash","wave","cod","cash"]),
                "delivery_zone": zone, "delivery_fee": fee, "discount": discount, "note": "",
                "mode": mode, "store_id": random.choice(["store-cocody","store-marcory"]),
                "subtotal": subtotal, "total": total, "status": status,
                "payment_status": "paye" if status in ("livree",) else random.choice(["en_attente","paye"]),
                "created_at": created, "created_by": random.choice(users)["name"] if users else "système",
                "rider_id": rider["id"] if rider else None, "rider_name": rider["name"] if rider else None,
                "timeline": [{"status": "nouvelle", "at": created, "by": "système"}],
            })
        await db.orders.insert_many(orders)

    # Invoices
    if await db.invoices.count_documents({}) == 0:
        orders = await db.orders.find({"status":"livree"}).limit(40).to_list(40)
        inv = []
        for i, o in enumerate(orders):
            inv.append({"id": new_id(), "number": f"FACT-2025-{1000+i}", "order_code": o["code"], "customer": o.get("customer"), "total": o["total"], "status": "paye", "created_at": o["created_at"]})
        if inv: await db.invoices.insert_many(inv)

    # Purchase orders
    if await db.purchase_orders.count_documents({}) == 0:
        sups = await db.suppliers.find({}).to_list(10)
        pos = []
        for i in range(8):
            s = random.choice(sups)
            pos.append({"id": new_id(), "number": f"BC-{2025}-{100+i}", "supplier_id": s["id"], "supplier_name": s["name"], "total": random.choice([450000,780000,1250000,2300000]), "status": random.choice(["recu","en_transit","en_attente"]), "created_at": (datetime.now(timezone.utc)-timedelta(days=random.randint(5,180))).isoformat()})
        await db.purchase_orders.insert_many(pos)

    # Attendance
    if await db.attendance.count_documents({}) == 0:
        emps = await db.users.find({"role":{"$ne":"admin"}}).to_list(50)
        att = []
        for d in range(30):
            for u in emps:
                if random.random() < 0.85:
                    hour = random.randint(8, 10); minute = random.randint(0, 59)
                    at = (datetime.now(timezone.utc) - timedelta(days=d)).replace(hour=hour, minute=minute).isoformat()
                    att.append({"id": new_id(), "user_id": u["id"], "user_name": u["name"], "role": u["role"], "at": at, "type": "in", "late": hour >= 9 and minute > 10})
        if att: await db.attendance.insert_many(att)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.orders.create_index("code")
    await db.products.create_index("sku")
    await seed_if_empty()
    logger.info("Dina Store API ready.")

@api.post("/seed")
async def reseed(force: bool = False, user: dict = Depends(require_role("admin"))):
    if force:
        await db.products.delete_many({})
        await db.orders.delete_many({})
    await seed_if_empty()
    return {"ok": True}

@api.get("/")
async def root():
    return {"name": "Dina Store API", "version": "1.0"}

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
