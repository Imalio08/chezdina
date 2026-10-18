"""Employee onboarding file: HR document templates (versioned), e-signature (drawn + PIN), signed PDFs, scans, departure report."""
import base64
import hashlib
import html
import io
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from deps import db, get_user, require_role, new_id, now_iso, clean, verify_pw
from routers.privacy import client_ip, device_id, revoke_sessions

router = APIRouter(prefix="/api", tags=["onboarding"])
ABJ = ZoneInfo("Africa/Abidjan")
P = "[à compléter par le propriétaire]"
SEED = [
    ("contrat", "Clauses du contrat de travail", 0, f"Entre Chez Dina, représentée par {P}, et l'employé(e) désigné(e) ci-dessous.\n\n1. Poste et missions : {P}\n2. Date de début et période d'essai : {P}\n3. Horaires de travail : {P}\n4. Rémunération : {P}\n5. Congés : {P}\n6. Fin du contrat et préavis : {P}"),
    ("confidentialite", "Engagement de confidentialité et de protection des données", 12, "Je m'engage à :\n- ne jamais copier, photographier, exporter ni transmettre les données des clientes (noms, numéros, adresses, commandes) en dehors des outils Chez Dina ;\n- ne contacter les clientes que pour les besoins de leur commande, via les outils prévus ;\n- ne pas conserver de données clientes sur mon téléphone personnel ;\n- signaler immédiatement toute perte d'appareil ou fuite de données au propriétaire.\n\nCet engagement reste valable après la fin de mon contrat. Tout manquement peut entraîner des sanctions disciplinaires et des poursuites."),
    ("charte", "Charte d'utilisation des outils", 12, "- Mes codes d'accès (mot de passe, PIN) sont personnels : je ne les partage avec personne.\n- J'utilise la console et l'application livreur uniquement pour mon travail.\n- Toute action est enregistrée à mon nom.\n- Je me déconnecte des appareils partagés à la fin de mon service.\n- Le matériel confié reste la propriété de Chez Dina."),
    ("fiche_poste", "Fiche de poste", 0, f"Intitulé du poste : {P}\nResponsable : {P}\nMissions principales : {P}\nIndicateurs suivis : {P}"),
    ("remise_materiel", "Procès-verbal de remise de matériel", 0, f"Matériel remis à l'employé(e) :\n- {P}\n\nÉtat du matériel : {P}\nL'employé(e) s'engage à restituer ce matériel en bon état à la fin de son contrat."),
]
_gate: Dict[str, Any] = {}


def _strip(t: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "\n", t or "")).strip()


async def _ensure_seed() -> None:
    if await db.doc_templates.count_documents({}):
        return
    for kind, title, months, body in SEED:
        await db.doc_templates.insert_one({"id": new_id(), "kind": kind, "title": title, "validity_months": months, "active": True,
                                           "current": 1, "versions": [{"v": 1, "body": body, "at": now_iso(), "by": "Modèle de départ"}], "created_at": now_iso()})


def _status(d: Dict[str, Any]) -> str:
    if d.get("status") == "signed" and d.get("expires_at") and d["expires_at"] < now_iso():
        return "expired"
    return d.get("status", "pending")


async def onboarding_blocked(user: Dict[str, Any]) -> bool:
    """True while the employee has a document to sign (pending or expired)."""
    if user.get("role") == "admin":
        return False
    c = _gate.get(user["id"])
    if c and time.time() - c[0] < 30:
        return c[1]
    n = await db.employee_docs.count_documents({"user_id": user["id"], "$or": [
        {"status": "pending"}, {"status": "signed", "expires_at": {"$nin": [None, ""], "$lt": now_iso()}}]})
    _gate[user["id"]] = (time.time(), n > 0)
    return n > 0


def _reset(uid: str) -> None:
    _gate.pop(uid, None)


async def _notify_user(uid: str, title: str, msg: str) -> None:
    from routers.notify import notify
    u = await db.users.find_one({"id": uid}, {"role": 1}) or {}
    kind = "rider" if u.get("role") == "rider" else "staff"
    await notify(kind, uid, title, msg, "/riders" if kind == "rider" else "/console", "onboarding", None, f"onb:{uid}:{now_iso()[:16]}")


# ---------- Templates (owner) ----------
@router.get("/onboarding/templates")
async def list_templates(user: dict = Depends(require_role("admin"))):
    await _ensure_seed()
    rows = await db.doc_templates.find({}).sort("created_at", 1).to_list(100)
    for r in rows:
        r["body"] = next((v["body"] for v in r["versions"] if v["v"] == r["current"]), "")
        r["signed_count"] = await db.employee_docs.count_documents({"template_id": r["id"], "status": "signed", "version": r["current"]})
        r["outdated_count"] = len(await db.employee_docs.distinct("user_id", {"template_id": r["id"], "status": {"$in": ["signed", "pending"]}, "version": {"$lt": r["current"]}}))
    return clean(rows)


@router.post("/onboarding/templates")
async def create_template(body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    if not (body.get("title") or "").strip() or not (body.get("body") or "").strip():
        raise HTTPException(400, "Titre et texte obligatoires")
    doc = {"id": new_id(), "kind": body.get("kind") or "autre", "title": body["title"].strip(), "validity_months": int(body.get("validity_months") or 0),
           "active": True, "current": 1, "versions": [{"v": 1, "body": body["body"], "at": now_iso(), "by": user.get("name")}], "created_at": now_iso()}
    await db.doc_templates.insert_one(doc)
    return clean(doc)


@router.patch("/onboarding/templates/{tid}")
async def update_template(tid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    t = await db.doc_templates.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Modèle introuvable")
    upd: Dict[str, Any] = {k: body[k] for k in ("title", "active") if k in body}
    if "validity_months" in body:
        upd["validity_months"] = int(body["validity_months"] or 0)
    ops: Dict[str, Any] = {"$set": upd} if upd else {}
    cur = next((v["body"] for v in t["versions"] if v["v"] == t["current"]), "")
    if body.get("body") is not None and body["body"].strip() and body["body"] != cur:
        nv = t["current"] + 1
        ops.setdefault("$set", {})["current"] = nv
        ops["$push"] = {"versions": {"v": nv, "body": body["body"], "at": now_iso(), "by": user.get("name"), "note": body.get("note") or ""}}
    if ops:
        await db.doc_templates.update_one({"id": tid}, ops)
    return {"ok": True}


async def _assign(uid: str, t: Dict[str, Any], by: str) -> Optional[Dict[str, Any]]:
    if await db.employee_docs.find_one({"user_id": uid, "template_id": t["id"], "version": t["current"], "status": {"$in": ["pending", "signed"]}}):
        return None
    await db.employee_docs.update_many({"user_id": uid, "template_id": t["id"], "status": "pending"}, {"$set": {"status": "superseded"}})
    body = next(v["body"] for v in t["versions"] if v["v"] == t["current"])
    doc = {"id": new_id(), "user_id": uid, "template_id": t["id"], "kind": t.get("kind"), "title": t["title"], "version": t["current"],
           "body": body, "validity_months": t.get("validity_months") or 0, "status": "pending", "assigned_at": now_iso(), "assigned_by": by}
    await db.employee_docs.insert_one(doc)
    _reset(uid)
    return doc


@router.post("/onboarding/templates/{tid}/request-resign")
async def request_resign(tid: str, user: dict = Depends(require_role("admin"))):
    t = await db.doc_templates.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Modèle introuvable")
    uids = await db.employee_docs.distinct("user_id", {"template_id": tid, "status": {"$in": ["signed", "pending"]}, "version": {"$lt": t["current"]}})
    n = 0
    for uid in uids:
        if await _assign(uid, t, user.get("name")):
            n += 1
            await _notify_user(uid, "Nouvelle version à signer", f"« {t['title']} » a été mis à jour · merci de le relire et le signer.")
    return {"ok": True, "requested": n}


# ---------- Employee file (owner, or the employee for himself) ----------
def _own_or_admin(user: Dict[str, Any], uid: str) -> None:
    if user.get("role") != "admin" and user["id"] != uid:
        raise HTTPException(403, "Dossier réservé au propriétaire")


@router.get("/onboarding/overview")
async def overview(user: dict = Depends(require_role("admin"))):
    out: Dict[str, Dict[str, int]] = {}
    for d in await db.employee_docs.find({"status": {"$in": ["pending", "signed"]}}, {"user_id": 1, "status": 1, "expires_at": 1}).to_list(5000):
        s = out.setdefault(d["user_id"], {"signed": 0, "pending": 0, "expired": 0})
        s[_status(d)] += 1
    return out


@router.get("/onboarding/employees/{uid}")
async def employee_file(uid: str, user: dict = Depends(get_user)):
    _own_or_admin(user, uid)
    docs = await db.employee_docs.find({"user_id": uid}, {"signature": 0, "body": 0}).sort("assigned_at", -1).to_list(200)
    for d in docs:
        d["status"] = _status(d)
    files = await db.onboarding_files.find({"user_id": uid}, {"data": 0}).sort("at", -1).to_list(200)
    u = await db.users.find_one({"id": uid}, {"departure": 1, "active": 1, "name": 1}) or {}
    return {"docs": clean(docs), "files": clean(files), "departure": u.get("departure"), "active": u.get("active", True)}


@router.post("/onboarding/employees/{uid}/assign")
async def assign(uid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    n = 0
    for tid in body.get("template_ids") or []:
        t = await db.doc_templates.find_one({"id": tid, "active": True})
        if t and await _assign(uid, t, user.get("name")):
            n += 1
    if n:
        await _notify_user(uid, "Documents à signer", f"{n} document(s) à lire et signer avant d'accéder à vos outils.")
    return {"ok": True, "assigned": n}


@router.post("/onboarding/employees/{uid}/remind")
async def remind(uid: str, user: dict = Depends(require_role("admin"))):
    n = await db.employee_docs.count_documents({"user_id": uid, "status": "pending"})
    exp = [d for d in await db.employee_docs.find({"user_id": uid, "status": "signed"}, {"expires_at": 1}).to_list(200) if _status(d) == "expired"]
    if not n and not exp:
        raise HTTPException(400, "Aucun document en attente")
    await _notify_user(uid, "Rappel · documents à signer", f"{n + len(exp)} document(s) attendent votre signature.")
    return {"ok": True}


@router.post("/onboarding/remind-all")
async def remind_all(user: dict = Depends(require_role("admin"))):
    uids = set(await db.employee_docs.distinct("user_id", {"status": "pending"}))
    for d in await db.employee_docs.find({"status": "signed", "expires_at": {"$nin": [None, ""], "$lt": now_iso()}}, {"user_id": 1}).to_list(2000):
        uids.add(d["user_id"])
    for uid in uids:
        await _notify_user(uid, "Rappel · documents à signer", "Des documents attendent votre signature.")
    return {"ok": True, "reminded": len(uids)}


def _decode_file(data_url: str, limit_mb: int = 8) -> tuple:
    m = re.match(r"^data:([\w/+.-]+);base64,(.+)$", data_url or "", re.S)
    if not m:
        raise HTTPException(400, "Fichier invalide")
    raw = base64.b64decode(m.group(2))
    if len(raw) > limit_mb * 1024 * 1024:
        raise HTTPException(400, f"Fichier trop lourd (max {limit_mb} Mo)")
    return m.group(1), raw


async def _store_file(uid: str, kind: str, name: str, mime: str, raw: bytes, doc_id: Optional[str] = None, by: str = "") -> str:
    fid = new_id()
    await db.onboarding_files.insert_one({"id": fid, "user_id": uid, "kind": kind, "doc_id": doc_id, "name": name, "mime": mime,
                                          "size": len(raw), "data": base64.b64encode(raw).decode(), "by": by, "at": now_iso()})
    return fid


@router.post("/onboarding/employees/{uid}/scan")
async def upload_scan(uid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    mime, raw = _decode_file(body.get("file"))
    title = (body.get("title") or "Document papier signé").strip()[:120]
    fid = await _store_file(uid, "scan", body.get("name") or title, mime, raw, body.get("doc_id"), user.get("name"))
    if body.get("doc_id"):
        d = await db.employee_docs.find_one({"id": body["doc_id"], "user_id": uid})
        if d and d.get("status") == "pending":
            months = d.get("validity_months") or 0
            exp = (datetime.now(timezone.utc) + timedelta(days=30 * months)).isoformat() if months else None
            await db.employee_docs.update_one({"id": d["id"]}, {"$set": {"status": "signed", "signed_at": now_iso(), "expires_at": exp,
                                                                         "method": "papier", "scan_file_id": fid, "pdf_file_id": fid}})
            _reset(uid)
    return {"ok": True, "id": fid}


@router.get("/onboarding/files/{fid}")
async def get_file(fid: str, user: dict = Depends(get_user)):
    f = await db.onboarding_files.find_one({"id": fid})
    if not f:
        raise HTTPException(404, "Fichier introuvable")
    _own_or_admin(user, f["user_id"])
    return Response(base64.b64decode(f["data"]), media_type=f.get("mime") or "application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{re.sub(r"[^A-Za-z0-9._-]+", "_", f.get("name") or "document")}"'})


# ---------- Signing (the employee) ----------
@router.get("/onboarding/me")
async def my_docs(user: dict = Depends(get_user)):
    docs = await db.employee_docs.find({"user_id": user["id"], "status": {"$in": ["pending", "signed"]}}, {"signature": 0}).sort("assigned_at", 1).to_list(100)
    for d in docs:
        d["status"] = _status(d)
    return {"to_sign": clean([d for d in docs if d["status"] != "signed"]), "signed": clean([{k: v for k, v in d.items() if k != "body"} for d in docs if d["status"] == "signed"])}


def _pdf(title: str, lines: List[tuple], body: str, signatures: List[tuple]) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, Image
    buf = io.BytesIO()
    st = getSampleStyleSheet()
    story = [Paragraph("Chez Dina", st["Title"]), Paragraph(html.escape(title), st["Heading2"]), Spacer(1, 4 * mm)]
    for para in (body or "").split("\n"):
        story.append(Paragraph(html.escape(para) or "&nbsp;", st["BodyText"]))
    story.append(Spacer(1, 6 * mm))
    t = Table([[Paragraph(f"<b>{html.escape(k)}</b>", st["BodyText"]), Paragraph(html.escape(str(v or "—")), st["BodyText"])] for k, v in lines], colWidths=[50 * mm, 120 * mm])
    t.setStyle([("GRID", (0, 0), (-1, -1), 0.3, "#999999"), ("VALIGN", (0, 0), (-1, -1), "TOP")])
    story.append(t)
    for label, data_url in signatures:
        if not data_url:
            continue
        story += [Spacer(1, 4 * mm), Paragraph(f"<b>{html.escape(label)}</b>", st["BodyText"])]
        story.append(Image(io.BytesIO(base64.b64decode(data_url.split(",", 1)[1])), width=60 * mm, height=25 * mm))
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm, title=title).build(story)
    return buf.getvalue()


def _local(ts: str) -> str:
    return datetime.fromisoformat(ts).astimezone(ABJ).strftime("%d/%m/%Y à %H:%M:%S (heure d'Abidjan)")


@router.post("/onboarding/me/sign/{doc_id}")
async def sign(doc_id: str, body: Dict[str, Any], request: Request, user: dict = Depends(get_user)):
    d = await db.employee_docs.find_one({"id": doc_id, "user_id": user["id"]})
    if not d or _status(d) == "signed":
        raise HTTPException(404, "Document introuvable ou déjà signé")
    if not body.get("accepted"):
        raise HTTPException(400, "Cochez « J'ai lu et j'accepte »")
    sig = body.get("signature") or ""
    if not sig.startswith("data:image/png;base64,") or len(sig) < 1500:
        raise HTTPException(400, "Signature manquante · signez dans le cadre")
    full = await db.users.find_one({"id": user["id"]}, {"pin_hash": 1})
    if not verify_pw(str(body.get("pin") or "").strip(), (full or {}).get("pin_hash", "")):
        raise HTTPException(400, "Code PIN incorrect")
    at = now_iso()
    ip, ua = client_ip(request), (request.headers.get("user-agent") or "")[:200]
    dev = (body.get("device") or "")[:120] or ua
    months = d.get("validity_months") or 0
    exp = (datetime.now(timezone.utc) + timedelta(days=30 * months)).isoformat() if months else None
    digest = hashlib.sha256((d.get("body") or "").encode()).hexdigest()
    pdf = _pdf(f"{d['title']} · version {d['version']}", [
        ("Employé(e)", user.get("name")), ("Rôle", user.get("role")), ("Lu et accepté", "Oui · case « J'ai lu et j'accepte » cochée"),
        ("Signé le", _local(at)), ("Confirmation", "Code PIN personnel vérifié"), ("Appareil", dev), ("Adresse IP", ip),
        ("Empreinte du texte (SHA-256)", digest), ("Valable jusqu'au", _local(exp) if exp else "Sans date d'expiration")],
        d.get("body") or "", [("Signature de l'employé(e)", sig)])
    fid = await _store_file(user["id"], "signed", f"{d['title']} v{d['version']} - {user.get('name')}.pdf", "application/pdf", pdf, doc_id, user.get("name"))
    await db.employee_docs.update_one({"id": doc_id}, {"$set": {"status": "signed", "signed_at": at, "expires_at": exp, "method": "electronique",
                                                                "signature": sig, "ip": ip, "user_agent": ua, "device": dev, "device_id": device_id(request),
                                                                "text_sha256": digest, "pdf_file_id": fid}})
    await db.employee_docs.update_many({"user_id": user["id"], "template_id": d["template_id"], "status": "signed", "id": {"$ne": doc_id}}, {"$set": {"status": "superseded"}})
    _reset(user["id"])
    remaining = await onboarding_blocked(user)
    if not remaining:
        from routers.notify import notify
        async for a in db.users.find({"role": "admin"}, {"id": 1}):
            await notify("staff", a["id"], "Documents signés", f"{user.get('name')} a signé tous ses documents.", "/console/equipe", "onboarding", None, f"onbdone:{user['id']}:{at[:16]}")
    return {"ok": True, "remaining": remaining, "pdf_file_id": fid}


# ---------- Departure ----------
@router.post("/onboarding/employees/{uid}/departure")
async def departure(uid: str, body: Dict[str, Any], request: Request, user: dict = Depends(require_role("admin"))):
    emp = await db.users.find_one({"id": uid}, {"name": 1, "role": 1})
    if not emp:
        raise HTTPException(404, "Employé introuvable")
    if emp.get("role") == "admin":
        raise HTTPException(400, "Impossible pour le compte propriétaire")
    checks = {"equipment_returned": "Matériel restitué", "access_deactivated": "Accès désactivés", "data_deleted": "Données supprimées des appareils personnels"}
    missing = [lbl for k, lbl in checks.items() if not body.get(k)]
    if missing:
        raise HTTPException(400, "À cocher : " + ", ".join(missing))
    osig = body.get("owner_signature") or ""
    if not osig.startswith("data:image/png;base64,") or len(osig) < 1500:
        raise HTTPException(400, "Signature du propriétaire requise")
    esig = body.get("employee_signature") or ""
    at = now_iso()
    await revoke_sessions(uid, True)
    pdf = _pdf(f"Procès-verbal de départ · {emp.get('name')}", [
        ("Employé(e)", emp.get("name")), ("Date de départ", body.get("date") or at[:10]),
        *[(lbl, "Oui") for lbl in checks.values()], ("Matériel restitué (détail)", body.get("equipment") or ""),
        ("Observations", body.get("notes") or ""), ("Établi par", user.get("name")), ("Établi le", _local(at)), ("Adresse IP", client_ip(request))],
        "", [("Signature du propriétaire", osig), ("Signature de l'employé(e)", esig if esig.startswith("data:image/png") and len(esig) >= 1500 else "")])
    fid = await _store_file(uid, "exit", f"PV de départ - {emp.get('name')}.pdf", "application/pdf", pdf, None, user.get("name"))
    dep = {"at": at, "date": body.get("date") or at[:10], "by": user.get("name"), "pdf_file_id": fid, "notes": body.get("notes") or "",
           "equipment": body.get("equipment") or "", "employee_signed": bool(esig)}
    await db.users.update_one({"id": uid}, {"$set": {"departure": dep}})
    await db.audit_log.insert_one({"id": new_id(), "action": "user.departure", "target": uid, "by": user.get("name"), "at": at})
    return {"ok": True, "departure": dep}
