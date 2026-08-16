from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.schema.output import ResponseModel, AdminOutput
from backend.schema._input import BotTopupInput, BotChangePasswordInput
from backend.db import crud
from backend.db.engin import get_db
from backend.auth.auth import verify_bot_api_key
from backend.services.marzban.api import APIService as MarzbanAPI
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
    crud.grant_admin_traffic(db, admin, added_bytes)
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
    description="Change an admin's password directly in Marzban, then mirror it in Nexra",
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

    panel = crud.get_panel_by_name(db, admin.panel)
    if not panel or panel.panel_type != "marzban":
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": "This admin's panel is not a Marzban panel; the password can't be changed automatically",
            },
        )

    # panel.username/panel.password are the sudo Marzban credentials Nexra already
    # uses for platform-level calls (see AdminTaskService.api_service_for_main_tasks)
    # — only a sudo admin can change another admin's password in Marzban.
    sudo_api = MarzbanAPI(url=panel.url, username=panel.username, password=panel.password)
    try:
        marzban_status = await sudo_api.update_admin_password(admin.username, payload.new_password)
    except Exception as e:
        logger.error(f"Marzban password change failed for admin {admin.username}: {e}")
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"success": False, "message": f"Could not reach Marzban: {e}"},
        )

    if marzban_status != 200:
        logger.warning(
            f"Marzban rejected password change for admin {admin.username}: status {marzban_status}"
        )
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "success": False,
                "message": (
                    f"Marzban rejected the password change (status {marzban_status}). "
                    "Make sure this panel's stored Marzban credentials belong to a sudo admin."
                ),
            },
        )

    crud.update_marzban_password(db, admin, payload.new_password)
    logger.info(
        f"Bot password change: admin {admin.username} (telegram_id={payload.telegram_id}) "
        f"password updated in Marzban and Nexra"
    )
    return ResponseModel(
        success=True,
        message="Password updated successfully in Marzban and Nexra",
        data={"telegram_id": payload.telegram_id, "username": admin.username},
    )
