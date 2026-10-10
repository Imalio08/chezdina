"""Instance sync: copy the full database from one deployment (e.g. preview) into another (e.g. production)."""
import gzip
import secrets
from datetime import datetime, timezone, timedelta

import httpx
from bson import json_util
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from deps import db, new_id, now_iso, require_role

router = APIRouter(prefix="/api")
SKIP = {"sync_tokens", "sync_history"}


@router.post("/admin/sync/export-token")
async def create_export_token(user: dict = Depends(require_role("admin"))):
    token = secrets.token_urlsafe(24)
    exp = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    await db.sync_tokens.insert_one({"token": token, "expires_at": exp, "created_by": user.get("name"), "created_at": now_iso()})
    return {"token": token, "expires_at": exp}


@router.get("/admin/sync/export")
async def export_dump(request: Request, token: str = ""):
    token = request.headers.get("X-Sync-Token") or token
    t = await db.sync_tokens.find_one({"token": token}) if token else None
    if not t or t["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(403, "Code d'export invalide ou expiré")
    dump = {}
    for name in await db.list_collection_names():
        if name not in SKIP:
            dump[name] = await db[name].find({}).to_list(None)
    return Response(gzip.compress(json_util.dumps(dump).encode()), media_type="application/gzip")


@router.post("/admin/sync/import")
async def import_dump(body: dict, user: dict = Depends(require_role("admin"))):
    src = str(body.get("source_url") or "").strip().rstrip("/")
    token = str(body.get("token") or "").strip()
    me = await db.users.find_one({"id": user["id"]})
    if not me or me.get("attendance_code") != str(body.get("pin") or "").strip():
        raise HTTPException(403, "PIN admin invalide")
    if not src.startswith("https://") or not token:
        raise HTTPException(400, "Adresse source (https://…) et code requis")
    try:
        async with httpx.AsyncClient(timeout=120) as cli:
            r = await cli.get(f"{src}/api/admin/sync/export", headers={"X-Sync-Token": token})
    except httpx.HTTPError:
        raise HTTPException(502, "Source injoignable")
    if r.status_code != 200:
        raise HTTPException(400, f"Export refusé par la source ({r.status_code})")
    try:
        dump = json_util.loads(gzip.decompress(r.content).decode())
    except Exception:
        raise HTTPException(400, "Fichier d'export illisible")
    if not dump.get("products") or not dump.get("users"):
        raise HTTPException(400, "Export incomplet (produits ou comptes manquants)")
    counts = {}
    for name, docs in dump.items():
        if name in SKIP:
            continue
        await db[name].delete_many({})
        if docs:
            await db[name].insert_many(docs)
        counts[name] = len(docs)
    for name in await db.list_collection_names():
        if name not in dump and name not in SKIP:
            await db[name].delete_many({})
    await db.sync_history.insert_one({"id": new_id(), "at": now_iso(), "by": user.get("name"), "source": src, "counts": counts})
    return {"ok": True, "collections": len(counts), "counts": counts}
