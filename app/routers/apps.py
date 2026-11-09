from fastapi import APIRouter, Depends

from app.auth import get_current_active_user
from app.models_db import User
from app.services.apps import list_apps

router = APIRouter(prefix="/api/apps", tags=["apps"])


@router.get("")
async def get_apps(current_user: User = Depends(get_current_active_user)):
    """Catálogo de apps para que el frontend pinte los accesos y las bienvenidas."""
    return {"apps": list_apps()}
