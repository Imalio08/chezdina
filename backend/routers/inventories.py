"""Regular inventories: owner-scheduled plans with reminders (daily cron), submission for owner validation, rejection."""
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from deps import db, get_user, require_role, new_id, now_iso, clean

router = APIRouter(prefix="/api", tags=["inventories"])
ABJ = ZoneInfo("Africa/Abidjan")
FREQ = {"weekly": 7, "biweekly": 14, "monthly": 30, "quarterly": 91}


async def notify_counters(title: str, msg: str) -> None:
    from routers.notify import notify
    async for u in db.users.find({"role": {"$in": ["admin", "manager", "stock_keeper"]}, "active": {"$ne": False}}, {"id": 1}):
        await notify("staff", u["id"], title, msg, "/console/stock?tab=inventories", "stock", None, f"inv:{title}:{u['id']}:{now_iso()[:13]}")


def _today() -> str:
    return datetime.now(ABJ).date().isoformat()


@router.get("/stock/inventory-plans")
async def list_plans(user: dict = Depends(require_role("admin", "manager", "stock_keeper"))):
    return clean(await db.inventory_plans.find({}).sort("next_due", 1).to_list(100))


@router.post("/stock/inventory-plans")
async def create_plan(body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    days = FREQ.get(body.get("frequency")) or int(body.get("every_days") or 0)
    if days < 1:
        raise HTTPException(400, "Fréquence invalide")
    if not (body.get("name") or "").strip():
        raise HTTPException(400, "Nom obligatoire")
    doc = {"id": new_id(), "name": body["name"].strip(), "frequency": body.get("frequency") or "custom", "every_days": days,
           "scope": body.get("scope") or {"type": "all"}, "next_due": body.get("next_due") or _today(),
           "remind_days_before": int(body.get("remind_days_before") or 1), "active": True, "created_by": user.get("name"), "created_at": now_iso()}
    await db.inventory_plans.insert_one(doc)
    return clean(doc)


@router.patch("/stock/inventory-plans/{pid}")
async def update_plan(pid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    upd = {k: body[k] for k in ("name", "scope", "next_due", "remind_days_before", "active") if k in body}
    if body.get("frequency"):
        upd.update(frequency=body["frequency"], every_days=FREQ.get(body["frequency"]) or int(body.get("every_days") or 7))
    await db.inventory_plans.update_one({"id": pid}, {"$set": upd})
    return {"ok": True}


@router.delete("/stock/inventory-plans/{pid}")
async def delete_plan(pid: str, user: dict = Depends(require_role("admin"))):
    await db.inventory_plans.delete_one({"id": pid})
    return {"ok": True}


async def run_plans() -> Dict[str, int]:
    """Opens due inventories and sends reminders. Idempotent per plan/day."""
    from server import _inventory_lines
    today = _today()
    opened = reminded = 0
    async for p in db.inventory_plans.find({"active": True}):
        due = p.get("next_due") or today
        if due <= today:
            if not await db.inventories.find_one({"plan_id": p["id"], "due": due}):
                lines = await _inventory_lines(p.get("scope") or {"type": "all"}, [])
                if lines:
                    await db.inventories.insert_one({"id": new_id(), "created_at": now_iso(), "created_by": "Planification", "kind": "planifie",
                                                     "scope": p.get("scope"), "status": "open", "name": f"{p['name']} · {datetime.fromisoformat(due).strftime('%d/%m/%Y')}",
                                                     "lines": lines, "plan_id": p["id"], "due": due})
                    opened += 1
                    await notify_counters("Inventaire planifié à faire aujourd'hui", f"{p['name']} · {len(lines)} lignes à compter.")
            nxt = datetime.fromisoformat(due).date()
            while nxt.isoformat() <= today:
                nxt += timedelta(days=int(p.get("every_days") or 7))
            await db.inventory_plans.update_one({"id": p["id"]}, {"$set": {"next_due": nxt.isoformat(), "last_run": today}})
        else:
            rem = (datetime.fromisoformat(due).date() - timedelta(days=int(p.get("remind_days_before") or 0))).isoformat()
            if rem <= today and p.get("reminded_for") != due:
                await notify_counters("Rappel · inventaire planifié", f"{p['name']} prévu le {datetime.fromisoformat(due).strftime('%d/%m/%Y')}.")
                await db.inventory_plans.update_one({"id": p["id"]}, {"$set": {"reminded_for": due}})
                reminded += 1
    async for inv in db.inventories.find({"status": "open", "kind": {"$in": ["planifie", "surprise"]}, "created_at": {"$lt": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}}, {"name": 1, "id": 1}):
        await notify_counters("Inventaire en retard", f"{inv.get('name')} n'est pas encore soumis.")
        reminded += 1
    return {"opened": opened, "reminded": reminded}


@router.post("/stock/inventory-plans/run")
async def run_now(user: dict = Depends(require_role("admin"))):
    return await run_plans()


@router.post("/cron/inventories")
async def cron_inventories(request: Request, bg: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("authorization", "")
    if not secret or not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(401, "Unauthorized")
    run_id = request.headers.get("x-webhook-id") or ""
    if run_id and await db.cron_runs.find_one({"run_id": run_id}):
        return {"ok": True, "duplicate": True}
    await db.cron_runs.insert_one({"run_id": run_id, "name": "inventories", "at": now_iso()})
    bg.add_task(run_plans)
    return {"ok": True}


@router.post("/stock/inventories/{iid}/submit")
async def submit(iid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager", "stock_keeper"))):
    inv = await db.inventories.find_one({"id": iid})
    if not inv or inv.get("status") != "open":
        raise HTTPException(400, "Inventaire non ouvert")
    lines = inv.get("lines") or []
    missing = sum(1 for ln in lines if ln.get("qty_counted") is None)
    if missing:
        raise HTTPException(400, f"{missing} ligne(s) non comptée(s)")
    for ln in lines:
        ln["gap"] = int(ln["qty_counted"]) - int(ln.get("qty_expected") or 0)
        ln["gap_value"] = ln["gap"] * float(ln.get("unit_cost") or 0)
    await db.inventories.update_one({"id": iid}, {"$set": {"status": "submitted", "lines": lines, "submitted_at": now_iso(), "submitted_by": user.get("name"),
                                                           "submitted_by_id": user["id"], "submit_note": (body.get("note") or "")[:500],
                                                           "gap_count": sum(1 for ln in lines if ln["gap"]), "gap_value": sum(ln["gap_value"] for ln in lines)}})
    from routers.notify import notify
    async for a in db.users.find({"role": "admin"}, {"id": 1}):
        await notify("staff", a["id"], "Inventaire à valider", f"{inv.get('name')} soumis par {user.get('name')}.", "/console/stock?tab=inventories", "stock", None, f"invsub:{iid}")
    return {"ok": True}


@router.post("/stock/inventories/{iid}/reject")
async def reject(iid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    reason = (body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(400, "Motif obligatoire")
    inv = await db.inventories.find_one({"id": iid, "status": "submitted"})
    if not inv:
        raise HTTPException(400, "Inventaire non soumis")
    await db.inventories.update_one({"id": iid}, {"$set": {"status": "open", "owner_comment": reason, "rejected_at": now_iso(), "rejected_by": user.get("name")},
                                                  "$push": {"history": {"at": now_iso(), "action": "recompter", "by": user.get("name"), "reason": reason}}})
    if inv.get("submitted_by_id"):
        from routers.notify import notify
        await notify("staff", inv["submitted_by_id"], "Inventaire à recompter", f"{inv.get('name')} · motif : {reason}", "/console/stock?tab=inventories", "stock", None, f"invrej:{iid}:{now_iso()[:16]}")
    return {"ok": True}
