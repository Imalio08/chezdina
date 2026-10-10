"""
PWA router — dynamic manifest + resized install icons generated from the
merchant logo saved in site_settings. When the owner uploads a logo via
Settings → Identité, these endpoints immediately serve matching 192 / 512 /
maskable PNG icons without requiring a redeploy.

Endpoints:
 - GET /api/public/manifest.webmanifest — JSON manifest with icons pointing to
   the resized endpoints and the merchant's name / theme color.
 - GET /api/public/pwa-icon/{size} — PNG icon (192, 512, or 512-maskable).
"""
import base64
import io
from typing import Optional

from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse

from deps import db

router = APIRouter(prefix="/api", tags=["pwa"])

VALID_SIZES = {"192", "512", "512-maskable"}
THEME_COLOR_DEFAULT = "#b02a2a"
BG_COLOR_DEFAULT = "#fff5f5"


def _decode_data_url(data_url: str) -> Optional[bytes]:
    """Return raw bytes of a data: URL, or None if not decodable."""
    try:
        if not isinstance(data_url, str):
            return None
        if data_url.startswith("data:"):
            _, b64 = data_url.split(",", 1)
            return base64.b64decode(b64)
        return None
    except Exception:
        return None


def _render_initials_png(initials: str, size: int, bg: str, fg: str, maskable: bool) -> bytes:
    """Fallback icon: rounded square with centered 2-letter initials."""
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Safe area for maskable icons (keep core content in central 80%)
    pad = int(size * 0.1) if maskable else 0
    rect = (pad, pad, size - pad, size - pad)
    radius = int(size * 0.22) if not maskable else 0
    if maskable:
        d.rectangle(rect, fill=bg)
    else:
        d.rounded_rectangle(rect, radius=radius, fill=bg)
    text = (initials or "CD")[:2].upper()
    # Pick a font size that fits
    font_size = int(size * 0.45)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()
    tb = d.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    d.text(((size - tw) / 2 - tb[0], (size - th) / 2 - tb[1]), text, fill=fg, font=font)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _resize_logo_png(raw: bytes, size: int, bg: str, maskable: bool) -> bytes:
    """Resize the uploaded logo to a square PNG. For maskable, keep a safe area."""
    from PIL import Image
    try:
        src = Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception:
        return _render_initials_png("CD", size, bg, "#b02a2a", maskable)
    canvas = Image.new("RGBA", (size, size), bg if maskable else (255, 255, 255, 0))
    # Target box (90% for maskable to respect safe zone, 95% otherwise)
    scale = 0.8 if maskable else 0.95
    inner = int(size * scale)
    w, h = src.size
    ratio = min(inner / w, inner / h)
    nw, nh = max(1, int(w * ratio)), max(1, int(h * ratio))
    resized = src.resize((nw, nh), Image.LANCZOS)
    ox = (size - nw) // 2
    oy = (size - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    if not maskable:
        # Rounded square mask
        from PIL import ImageDraw
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=int(size * 0.22), fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(canvas, (0, 0), mask)
        canvas = out
    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return buf.getvalue()


async def _load_settings() -> dict:
    s = await db.site_settings.find_one({"id": "main"}) or {}
    b = await db.business.find_one({"id": "main"}) or {}
    rider_cms = (s.get("rider_cms") or {})
    return {
        "name": s.get("name") or b.get("name") or "Chez Dina",
        "logo": s.get("logo") or "",
        "theme_color": s.get("theme_color") or THEME_COLOR_DEFAULT,
        "bg_color": s.get("bg_color") or BG_COLOR_DEFAULT,
        "rider_logo": rider_cms.get("logo") or s.get("logo") or "",
        "rider_primary": rider_cms.get("primary_color") or THEME_COLOR_DEFAULT,
        "rider_accent": rider_cms.get("accent_color") or BG_COLOR_DEFAULT,
    }


@router.get("/public/manifest.webmanifest")
async def dynamic_manifest():
    cfg = await _load_settings()
    name = cfg["name"]
    short = (name.split(" ")[0] if " " in name else name)[:12] or "Dina"
    manifest = {
        "name": name,
        "short_name": short,
        "description": f"{name} — chaussures & sacs femme à Abidjan",
        "start_url": "/boutique",
        "id": "/boutique",
        "scope": "/",
        "display": "standalone",
        "orientation": "portrait",
        "theme_color": cfg["theme_color"],
        "background_color": cfg["bg_color"],
        "icons": [
            {"src": "/api/public/pwa-icon/192",          "sizes": "192x192", "type": "image/png"},
            {"src": "/api/public/pwa-icon/512",          "sizes": "512x512", "type": "image/png"},
            {"src": "/api/public/pwa-icon/512-maskable", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    return JSONResponse(
        manifest,
        media_type="application/manifest+json",
        headers={"Cache-Control": "public, max-age=60"},
    )


@router.get("/public/manifest-rider.webmanifest")
async def dynamic_rider_manifest():
    """Separate PWA for livreurs: launches /rider on install, uses rider_cms logo."""
    cfg = await _load_settings()
    name = cfg["name"]
    short_full = f"{name} Livreur"
    short = (short_full[:12]) or "Livreur"
    manifest = {
        "name": f"{name} — Livreur",
        "short_name": short,
        "description": "Application des livreurs — courses, carte, pointage",
        "start_url": "/rider",
        "id": "/rider",
        "scope": "/",
        "display": "standalone",
        "orientation": "portrait",
        "theme_color": cfg["rider_primary"],
        "background_color": cfg["rider_accent"],
        "icons": [
            {"src": "/api/public/pwa-icon-rider/192",          "sizes": "192x192", "type": "image/png"},
            {"src": "/api/public/pwa-icon-rider/512",          "sizes": "512x512", "type": "image/png"},
            {"src": "/api/public/pwa-icon-rider/512-maskable", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    return JSONResponse(
        manifest,
        media_type="application/manifest+json",
        headers={"Cache-Control": "public, max-age=60"},
    )


@router.get("/public/pwa-icon/{size}")
async def pwa_icon(size: str):
    if size not in VALID_SIZES:
        return Response(status_code=404)
    maskable = size.endswith("-maskable")
    px = 512 if size.startswith("512") else 192
    cfg = await _load_settings()
    logo_bytes = _decode_data_url(cfg["logo"])
    if logo_bytes:
        png = _resize_logo_png(logo_bytes, px, cfg["bg_color"], maskable)
    else:
        initials = "".join(w[0] for w in (cfg["name"] or "CD").split(" ") if w)[:2] or "CD"
        png = _render_initials_png(initials, px, cfg["theme_color"], "#ffffff", maskable)
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=60"},
    )


@router.get("/public/pwa-icon-rider/{size}")
async def pwa_icon_rider(size: str):
    if size not in VALID_SIZES:
        return Response(status_code=404)
    maskable = size.endswith("-maskable")
    px = 512 if size.startswith("512") else 192
    cfg = await _load_settings()
    logo_bytes = _decode_data_url(cfg["rider_logo"])
    if logo_bytes:
        png = _resize_logo_png(logo_bytes, px, cfg["rider_accent"], maskable)
    else:
        initials = "".join(w[0] for w in (cfg["name"] or "CD").split(" ") if w)[:2] or "LV"
        png = _render_initials_png(initials, px, cfg["rider_primary"], "#ffffff", maskable)
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=60"},
    )
