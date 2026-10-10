"""
Pydantic request/response schemas — shared across routers.

As the P5 Refactor progresses, more models move here. Keep classes grouped
by domain and keep the file flat (no sub-folders) to minimize import churn.
"""
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


# ---------- Staff auth ----------
class LoginIn(BaseModel):
    email: str
    password: str


class PinIn(BaseModel):
    pin: str


class UserIn(BaseModel):
    name: str
    email: str
    password: str
    role: str
    phone: str = ""
    pin: str = ""


# ---------- Customer auth / profile ----------
class CustomerIn(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    birthday: Optional[str] = None
    shoe_size: Optional[str] = None
    clothing_size: Optional[str] = None
    notes: Optional[str] = None
    status: str = "active"
    photo: Optional[str] = None
    password: Optional[str] = None


class CustomerLoginIn(BaseModel):
    identifier: str
    password: str


class CustomerLoginCodeIn(BaseModel):
    phone: str
    code: str


# ---------- Catalog ----------
class SimpleNameIn(BaseModel):
    name: str
    note: Optional[str] = None


class ProductIn(BaseModel):
    name: str
    category: str
    brand: str = "Dina"
    price: int
    cost: int = 0
    description: str = ""
    image: str = ""
    images: List[str] = []
    sizes: List[str] = []
    colors: List[str] = []
    stock_by_size: Dict[str, int] = {}
    stock: int = 0
    sku: Optional[str] = None
    visibility: str = "both"
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
    variants: List[Dict[str, Any]] = []
    videos: List[str] = []
    video_posters: List[str] = []


class CategoryIn(BaseModel):
    name: str
    parent_id: Optional[str] = None
    image: Optional[str] = None
    order: int = 0
    visible: bool = True
    note: Optional[str] = None


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


# ---------- Orders / POS / Cash sessions ----------
class OrderItem(BaseModel):
    product_id: str
    name: str
    size: Optional[str] = None
    color: Optional[str] = None
    qty: int = 1
    price: int
    image: Optional[str] = None


class OrderIn(BaseModel):
    items: List[OrderItem]
    customer: Optional[Dict[str, Any]] = None
    channel: str = "store"
    payment_method: str = "cash"
    delivery_zone: Optional[str] = None
    delivery_fee: int = 0
    discount: int = 0
    note: str = ""
    mode: str = "store"
    store_id: Optional[str] = None


class CashSessionOpenIn(BaseModel):
    opening_cash: float = 0
    note: Optional[str] = None
    manager_id: str
    session_date: str
    pin: str


class CashSessionCloseIn(BaseModel):
    closing_cash: float
    pin: str  # manager PIN required
    note: Optional[str] = None


class PinAuthIn(BaseModel):
    pin: str
    action: str  # discount | cancel | refund | reopen | other
    amount: Optional[float] = None


class CashMovementIn(BaseModel):
    type: str  # "in" | "out"
    amount: float
    reason: str  # label
    note: Optional[str] = None


class HoldIn(BaseModel):
    items: List[Dict[str, Any]]
    customer: Optional[Dict[str, Any]] = None
    note: Optional[str] = None
    expires_in_hours: Optional[int] = 24


# ---------- Riders / Deliveries ----------
class AssignIn(BaseModel):
    rider_id: str
    rider_name: str
    slot_id: Optional[str] = None


class SessionIn(BaseModel):
    rider_id: str
    rider_name: str
    date: Optional[str] = None


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
    heading: Optional[float] = None
    speed: Optional[float] = None
    battery_level: Optional[int] = Field(default=None, ge=0, le=100)
    battery_charging: Optional[bool] = None
