"""AI magic wand for product photos (Gemini Nano Banana): background ideas + extra visuals. Never replaces the real photo."""
import asyncio
import base64
import io
import json
import os
import re
from typing import Any, Dict

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request

from deps import new_id, require_role

load_dotenv()
router = APIRouter(prefix="/api", tags=["ai-visuals"])
MODEL = "gemini-3.1-flash-image-preview"
DEFAULT_IDEAS = [
    {"title": "Studio blanc", "prompt": "on a seamless pure white studio background with a soft natural shadow, e-commerce packshot"},
    {"title": "Marbre clair", "prompt": "placed on a light beige marble surface with soft daylight, elegant boutique style"},
    {"title": "Couleur assortie", "prompt": "on a smooth pastel background whose colour complements the product, minimal and modern"},
    {"title": "Mise en scène", "prompt": "in a chic lifestyle scene in an Abidjan boutique interior, warm light, shallow depth of field"},
]


async def _b64(src: str, request: Request) -> str:
    if src.startswith("data:"):
        return src.split(",", 1)[1]
    if src.startswith("/"):
        origin = f"{request.headers.get('x-forwarded-proto', request.url.scheme)}://{request.headers.get('x-forwarded-host', request.headers.get('host'))}"
        src = origin + src
    if not src.startswith("http"):
        raise HTTPException(400, "Photo introuvable")
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as cl:
        r = await cl.get(src)
    if r.status_code != 200:
        raise HTTPException(400, "Photo introuvable")
    return base64.b64encode(r.content).decode()


def _chat(sid: str):
    from emergentintegrations.llm.chat import LlmChat
    return LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=sid, system_message="You are a product photographer for a women's shoes and bags boutique.").with_model("gemini", MODEL)


@router.post("/products/ai/analyze")
async def ai_analyze(body: Dict[str, Any], request: Request, user: dict = Depends(require_role("admin", "manager", "community_manager"))):
    from emergentintegrations.llm.chat import UserMessage, ImageContent
    img = await _b64(str(body.get("image") or ""), request)
    ask = ("Look at this product photo. Reply ONLY with JSON: {\"product\":\"short French description\",\"ideas\":[{\"title\":\"short French title (2-3 words)\",\"prompt\":\"English background/scene description\"}]} "
           "with 4 background ideas adapted to this product (colour, style) and 2 alternative visuals (e.g. close-up detail, styled flat lay).")
    try:
        chat = _chat(f"ai-analyze-{new_id()}").with_params(modalities=["text"])
        txt = await chat.send_message(UserMessage(text=ask, file_contents=[ImageContent(img)]))
        m = re.search(r"\{.*\}", str(txt), re.S)
        data = json.loads(m.group(0)) if m else {}
        ideas = [i for i in (data.get("ideas") or []) if i.get("title") and i.get("prompt")][:6]
        return {"product": data.get("product") or "", "ideas": ideas or DEFAULT_IDEAS}
    except Exception:
        return {"product": "", "ideas": DEFAULT_IDEAS}


def _to_jpeg(raw: bytes) -> str:
    from PIL import Image
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    im.thumbnail((1200, 1200))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=82)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


@router.post("/products/ai/generate")
async def ai_generate(body: Dict[str, Any], request: Request, user: dict = Depends(require_role("admin", "manager", "community_manager"))):
    from emergentintegrations.llm.chat import UserMessage, ImageContent
    img = await _b64(str(body.get("image") or ""), request)
    prompt = str(body.get("prompt") or DEFAULT_IDEAS[0]["prompt"])[:600]
    text = (f"Keep the exact same product from this photo (same shape, colour, details, no changes to the product itself) and show it {prompt}. "
            "Photorealistic, square format, no text, no logo, no people's faces.")
    try:
        chat = _chat(f"ai-gen-{new_id()}").with_params(modalities=["image", "text"])
        _, images = await asyncio.wait_for(chat.send_message_multimodal_response(UserMessage(text=text, file_contents=[ImageContent(img)])), timeout=110)
    except Exception:
        raise HTTPException(502, "Le visuel n'a pas pu être créé · réessayez")
    if not images:
        raise HTTPException(502, "Aucun visuel proposé · essayez une autre idée")
    return {"image": _to_jpeg(base64.b64decode(images[0]["data"]))}
