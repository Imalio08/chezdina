"""Health & meta — first slice extracted from server.py (P5 Refactor).
Owns: GET /api/, GET /api/health. All other endpoints remain in server.py until migrated.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["meta"])

@router.get("/health")
async def health():
    return {"ok": True, "service": "chez-dina", "v": "2.0"}
