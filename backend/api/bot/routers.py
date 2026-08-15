from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.schema.output import ResponseModel, AdminOutput
from backend.schema._input import BotTopupInput, BotChangePasswordInput
from backend.db import crud
from backend.db.engin import get_db
from backend.auth.auth import verify_bot_api_key
from backend.utils.logger import logger

router = APIRouter(prefix="/bot", tags=["Bot"])


@router.get("/admin/{telegram_id}", description="Look up an admin by their linked Telegram ID")
async def get_admin_by_telegram_id(
    telegram_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(verify_bot_api_key),
):
    admin = crud.get_admin_by_telegram_id(db, telegram_id)
    if not admin:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "success": False,
                "message": "No admin is linked to this Telegram account",
            },
        )
    return ResponseModel(
        success=True,
        message="Admin retrieved successfully",
        data=AdminOutput.from_orm(admin),
    )


@router.post("/admin/topup", description="Increase an admin's traffic balance")
async def topup_admin_traffic(
    payload: BotTopupInput,
    db: Session = Depends(get_db),
    _: None = Depends(verify_bot_api_key),
):
    admin = crud.get_admin_by_telegram_id(db, payload.telegram_id)
    if not admin:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "success": False,
                "message": "No admin is linked to this Telegram account",
            },
        )

    added_bytes = int(payload.added_gb * 1024**3)
    crud.increase_admin_traffic(db, admin, added_bytes)
    logger.info(
        f"Bot top-up: admin {admin.username} (telegram_id={payload.telegram_id}) "
        f"credited {payload.added_gb} GB"
    )
    return ResponseModel(
        success=True,
        message="Traffic increased successfully",
        data={
            "telegram_id": payload.telegram_id,
            "added_gb": payload.added_gb,
            "new_traffic_bytes": admin.traffic,
        },
    )


@router.post(
    "/admin/change-password",
    description="Update the Nexra-side copy of an admin's Marzban password",
)
async def change_admin_marzban_password(
    payload: BotChangePasswordInput,
    db: Session = Depends(get_db),
    _: None = Depends(verify_bot_api_key),
):
    admin = crud.get_admin_by_telegram_id(db, payload.telegram_id)
    if not admin:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "success": False,
                "message": "No admin is linked to this Telegram account",
            },
        )

    crud.update_marzban_password(db, admin, payload.new_password)
    logger.info(
        f"Bot password change: admin {admin.username} (telegram_id={payload.telegram_id}) "
        f"updated their Marzban password via the bot"
    )
    return ResponseModel(
        success=True,
        message="Password updated successfully",
        data={"telegram_id": payload.telegram_id, "username": admin.username},
    )
