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


@router.get("/public/share/invitation/{code}", response_class=HTMLResponse)
async def share_invitation(code: str, request: Request):
    from routers.wallet import find_marraine, settings
    ref = await find_marraine(code)
    biz = await db.business.find_one({}) or {}
    name = biz.get("name") or "Chez Dina"
    bonus = _money((await settings()).get("referral_bonus_filleul") or 0)
    first = ((ref or {}).get("name") or "").split(" ")[0] or "Une amie"
    prod = await db.products.find_one({"image": {"$nin": [None, ""]}, "visibility": {"$ne": "store"}, "stock": {"$gt": 0}}, sort=[("sold_count", -1)])
    origin = f"{request.headers.get('x-forwarded-proto', request.url.scheme)}://{request.headers.get('x-forwarded-host', request.headers.get('host'))}"
    img = (prod or {}).get("image") or "/icons/icon-512.png"
    image = img if img.startswith("http") else f"{origin}{img if img.startswith('/') else '/' + img}"
    target = f"{origin}/invitation/{E(code)}"
    title = f"{first} vous invite chez {name}"
    desc = f"Créez votre compte avec le code {code.upper()} et recevez {bonus} sur votre première commande."
    page = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{E(title)}</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="{E(name)}"><meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}"><meta property="og:image" content="{E(image)}"><meta property="og:url" content="{target}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{E(title)}"><meta name="twitter:description" content="{E(desc)}"><meta name="twitter:image" content="{E(image)}">
<meta http-equiv="refresh" content="0;url={target}"></head><body><script>location.replace("{target}")</script><a href="{target}">{E(title)}</a></body></html>"""
    return HTMLResponse(page)
