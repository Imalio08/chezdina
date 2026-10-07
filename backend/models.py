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
