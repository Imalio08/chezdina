import html
import time
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse

from deps import db, get_customer, new_id, now_iso

router = APIRouter(prefix="/api", tags=["storefront-extras"])

E = html.escape


def _money(n) -> str:
    return f"{int(round(n or 0)):,}".replace(",", " ") + " FCFA"


def promo_fields(p: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise old price fields (compare_at / compare_at_price / price_old) into compare_at + promo_pct."""
    price = p.get("price") or 0
    old = max([v for v in (p.get("compare_at"), p.get("compare_at_price"), p.get("price_old")) if isinstance(v, (int, float))] or [0])
    if old > price > 0:
        p["compare_at"] = old
        p["promo_pct"] = round((1 - price / old) * 100)
    else:
        p["compare_at"] = None
        p["promo_pct"] = 0
    return p


async def _ensure_invoice(o: Dict[str, Any]) -> Dict[str, Any]:
    inv = await db.invoices.find_one({"order_id": o["id"]})
    if inv:
        return inv
    inv = {"id": new_id(), "number": f"INV-{int(time.time()) % 1000000}", "order_id": o["id"], "order_code": o.get("code"),
           "customer": o.get("customer"), "items": o.get("items"), "subtotal": o.get("subtotal"),
           "delivery_fee": o.get("delivery_fee", 0), "discount": o.get("discount", 0), "total": o.get("total"),
           "status": "payee" if o.get("payment_status") == "paye" else "a_payer", "created_at": now_iso(), "generated_by": "cliente"}
    await db.invoices.update_one({"order_id": o["id"]}, {"$setOnInsert": inv}, upsert=True)
    return await db.invoices.find_one({"order_id": o["id"]})


@router.get("/public/account/order/{code}/invoice", response_class=HTMLResponse)
async def customer_invoice(code: str, c: dict = Depends(get_customer)):
    o = await db.orders.find_one({"code": code, "customer.id": c["id"]})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    inv = await _ensure_invoice(o)
    biz = await db.business.find_one({}) or {}
    cust = inv.get("customer") or {}
    rows = "".join(
        f"<tr><td>{E(str(it.get('name', '')))}<div class='m'>{E(' · '.join(str(x) for x in (it.get('size'), it.get('color')) if x))}</div></td>"
        f"<td class='r'>{it.get('qty', 1)}</td><td class='r'>{_money(it.get('price'))}</td><td class='r'>{_money((it.get('price') or 0) * (it.get('qty') or 1))}</td></tr>"
        for it in inv.get("items") or [])
    paid = inv.get("status") == "payee" or o.get("payment_status") == "paye"
    disc = f"<tr><td>Remise</td><td class='r'>-{_money(inv.get('discount'))}</td></tr>" if inv.get("discount") else ""
    page = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Facture {E(str(inv.get('number')))} · {E(biz.get('name', 'Chez Dina'))}</title>
<style>body{{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1c1c;max-width:760px;margin:0 auto;padding:24px}}
h1{{color:#b02a2a;margin:0}}table{{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}}td,th{{padding:8px;border-bottom:1px solid #eee;text-align:left}}
.r{{text-align:right}}.m{{color:#888;font-size:12px}}.top{{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}}
.tot td{{border:0;padding:4px 8px}}.big td{{font-weight:700;font-size:16px;color:#b02a2a}}.b{{display:inline-block;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:600}}
button{{background:#b02a2a;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-size:15px;margin-top:20px}}@media print{{button{{display:none}}}}</style></head>
<body><div class="top"><div><h1>{E(biz.get('name', 'Chez Dina'))}</h1><div class="m">{E(biz.get('address', ''))}<br>{E(biz.get('phone', ''))}</div></div>
<div class="r"><b>FACTURE {E(str(inv.get('number')))}</b><div class="m">Commande {E(str(o.get('code')))}<br>{E(str(inv.get('created_at', ''))[:10])}</div>
<span class="b" style="background:{'#e6f4ec;color:#1f8a4c' if paid else '#fff4e0;color:#8a5a00'}">{'Payée' if paid else 'À payer'}</span></div></div>
<p><b>Cliente :</b> {E(str(cust.get('name', '')))} · {E(str(cust.get('phone', '')))}<br><span class="m">{E(str(o.get('delivery_address') or cust.get('address') or ''))}</span></p>
<table><thead><tr><th>Article</th><th class="r">Qté</th><th class="r">Prix</th><th class="r">Total</th></tr></thead><tbody>{rows}</tbody></table>
<table class="tot" style="width:auto;margin-left:auto"><tr><td>Sous-total</td><td class="r">{_money(inv.get('subtotal'))}</td></tr>
<tr><td>Livraison</td><td class="r">{_money(inv.get('delivery_fee'))}</td></tr>{disc}<tr class="big"><td>Total</td><td class="r">{_money(inv.get('total'))}</td></tr></table>
<p class="m">Merci pour votre achat.</p><button onclick="window.print()">Télécharger / imprimer (PDF)</button></body></html>"""
    return HTMLResponse(page)


_BOTS = ("facebookexternalhit", "facebot", "whatsapp", "twitterbot", "telegrambot", "linkedinbot", "slackbot", "discordbot", "skypeuripreview", "pinterest", "googlebot", "bingbot", "embedly", "vkshare", "snapchat", "viber")
_OG_CACHE: Dict[str, Any] = {}


async def _invite_data(code: str, request: Request):
    from routers.wallet import find_marraine, settings
    ref = await find_marraine(code)
    biz = await db.business.find_one({}) or {}
    name = biz.get("name") or "Chez Dina"
    bonus = _money((await settings()).get("referral_bonus_filleul") or 0)
    first = ((ref or {}).get("name") or "").split(" ")[0] or "Une amie"
    prod = await db.products.find_one({"image": {"$nin": [None, ""]}, "visibility": {"$ne": "store"}, "stock": {"$gt": 0}}, sort=[("sold_count", -1)])
    origin = f"{request.headers.get('x-forwarded-proto', request.url.scheme)}://{request.headers.get('x-forwarded-host', request.headers.get('host'))}"
    img = (prod or {}).get("image") or biz.get("logo") or "/icons/icon-512.png"
    src = img if img.startswith("http") or img.startswith("data:") else f"{origin}{img if img.startswith('/') else '/' + img}"
    return {"name": name, "bonus": bonus, "first": first, "origin": origin, "src": src}


def _render_og(d: Dict[str, Any], code: str, raw: bytes) -> bytes:
    """1200×630 card: product photo on the left, store name + referral offer on the right."""
    import io, os
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1200, 630
    card = Image.new("RGB", (W, H), (176, 42, 42))
    try:
        ph = Image.open(io.BytesIO(raw)).convert("RGB")
        r = max(560 / ph.width, H / ph.height)
        ph = ph.resize((int(ph.width * r), int(ph.height * r)))
        left, top = (ph.width - 560) // 2, (ph.height - H) // 2
        card.paste(ph.crop((left, top, left + 560, top + H)), (0, 0))
    except Exception:
        pass
    fd = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
    fb = lambda s: ImageFont.truetype(os.path.join(fd, "LiberationSans-Bold.ttf"), s)
    fr = lambda s: ImageFont.truetype(os.path.join(fd, "LiberationSans-Regular.ttf"), s)
    dr = ImageDraw.Draw(card)

    def wrap(text, font, width):
        out, line = [], ""
        for w in text.split():
            t = f"{line} {w}".strip()
            if dr.textlength(t, font=font) <= width: line = t
            else: out.append(line); line = w
        return out + [line] if line else out
    x, y = 610, 70
    dr.text((x, y), d["name"].upper(), font=fb(46), fill=(255, 255, 255)); y += 90
    for ln in wrap(f"{d['first']} vous offre", fr(40), 550):
        dr.text((x, y), ln, font=fr(40), fill=(255, 235, 235)); y += 50
    dr.text((x, y), d["bonus"], font=fb(84), fill=(255, 255, 255)); y += 110
    for ln in wrap("sur votre première commande", fr(36), 550):
        dr.text((x, y), ln, font=fr(36), fill=(255, 235, 235)); y += 46
    y += 30
    dr.rounded_rectangle((x, y, x + 520, y + 76), radius=38, fill=(255, 255, 255))
    dr.text((x + 30, y + 18), f"Code {code.upper()}", font=fb(36), fill=(176, 42, 42))
    buf = io.BytesIO(); card.save(buf, "JPEG", quality=85)
    return buf.getvalue()


@router.get("/public/share/invitation/{code}/image.jpg")
async def share_invitation_image(code: str, request: Request):
    from fastapi.responses import Response as R
    d = await _invite_data(code, request)
    key = f"{code}|{d['src']}|{d['bonus']}|{d['first']}|{d['name']}"
    hit = _OG_CACHE.get(key)
    if not hit:
        raw = b""
        try:
            import httpx, base64
            if d["src"].startswith("data:"):
                raw = base64.b64decode(d["src"].split(",", 1)[1])
            else:
                async with httpx.AsyncClient(timeout=8, follow_redirects=True) as cl:
                    raw = (await cl.get(d["src"])).content
        except Exception:
            pass
        hit = _render_og(d, code, raw)
        if len(_OG_CACHE) > 200: _OG_CACHE.clear()
        _OG_CACHE[key] = hit
    return R(content=hit, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/public/share/invitation/{code}", response_class=HTMLResponse)
async def share_invitation(code: str, request: Request):
    d = await _invite_data(code, request)
    name, origin = d["name"], d["origin"]
    share_url = f"{origin}/api/public/share/invitation/{E(code)}"
    image = f"{share_url}/image.jpg"
    target = f"{origin}/invitation/{E(code)}"
    title = f"{d['first']} vous invite chez {name}"
    desc = f"Créez votre compte avec le code {code.upper()} et recevez {d['bonus']} sur votre première commande."
    bot = any(b in (request.headers.get("user-agent") or "").lower() for b in _BOTS)
    redirect = "" if bot else f'<meta http-equiv="refresh" content="0;url={target}">'
    script = "" if bot else f'<script>location.replace("{target}")</script>'
    page = f"""<!doctype html><html lang="fr" prefix="og: https://ogp.me/ns#"><head><meta charset="utf-8"><title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="{E(name)}"><meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}"><meta property="og:url" content="{share_url}"><meta property="og:locale" content="fr_FR">
<meta property="og:image" content="{image}"><meta property="og:image:secure_url" content="{image}"><meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="{E(title)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{E(title)}"><meta name="twitter:description" content="{E(desc)}"><meta name="twitter:image" content="{image}">
{redirect}</head><body>{script}<a href="{target}">{E(title)}</a><p>{E(desc)}</p></body></html>"""
    return HTMLResponse(page, headers={"Cache-Control": "public, max-age=300"})
