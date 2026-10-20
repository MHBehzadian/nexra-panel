from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from backend.auth.hash import verify_password
from backend.db.engin import get_db
from backend.db import crud
from backend.config import config
from backend.utils.logger import logger

router = APIRouter(tags=["Login"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"/api/login")


def create_access_token(data: dict):
    to_encode = data.copy()
    to_encode.update(
        {"exp": datetime.now() + timedelta(seconds=config.JWT_ACCESS_TOKEN_EXPIRES)}
    )
    encoded_jwt = jwt.encode(to_encode, config.JWT_SECRET_KEY, algorithm="HS256")
    return encoded_jwt


# Why a locked admin can't get in, keyed by the reason the bot locked them for.
# English like every other API message; the frontend translates them.
SUSPENDED_MESSAGES = {
    "unpaid": "Your panel is suspended because the weekly invoice was not paid. Pay it in the bot to restore access.",
}
SUSPENDED_DEFAULT_MESSAGE = "Your panel has been suspended. Contact support."


def suspended_message(reason: str) -> str:
    return SUSPENDED_MESSAGES.get(reason, SUSPENDED_DEFAULT_MESSAGE)


def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"success": False, "message": "Could not validate credentials"},
    )
    try:
        payload = jwt.decode(token, config.JWT_SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception

        # A lock changes the password, which does nothing to a session that is
        # already open — so it is checked here too, and a 401 sends the panel
        # back to the login page, where the reason is shown.
        if payload.get("role") == "admin":
            admin = crud.get_admin_by_username(db, username)
            if admin and admin.suspended_reason:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=suspended_message(admin.suspended_reason),
                )

        return {
            "username": username,
            "role": payload.get("role"),
            "panel": payload.get("panel"),
        }

    except JWTError:
        raise credentials_exception


def get_current_superadmin(admin: dict = Depends(get_current_admin)):
    """Verify that the current user is a superadmin"""
    if admin.get("role") != "superadmin":
        raise JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Access denied. Only superadmin can access this endpoint"},
        )
    return admin


def verify_bot_api_key(x_bot_api_key: str = Header(..., alias="X-Bot-Api-Key")):
    """Shared-secret auth for the top-up bot's service-to-service calls.

    If BOT_API_KEY isn't configured yet, the bot endpoints stay locked (403)
    rather than ever matching on an empty/unset value.
    """
    if not config.BOT_API_KEY or x_bot_api_key != config.BOT_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid bot API key")


@router.post("/login", description="Admin login")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    # Check for superadmin credentials
    if (
        form_data.username == config.ADMIN_USERNAME
        and form_data.password == config.ADMIN_PASSWORD
    ):
        logger.info(f"SuperAdmin login successful: {form_data.username}")
        access_token = create_access_token(
            data={
                "sub": form_data.username,
                "role": "superadmin",
                "panel": "main",
            }
        )
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "success": True,
                "message": "Login successful",
                "data": {"access_token": access_token, "token_type": "bearer"},
            },
        )

    # Check for regular admin credentials
    admin = crud.get_admin_by_username(db, form_data.username)
    # Checked before the password: the lock replaced it, so the admin is typing
    # the old one, and "incorrect password" would leave them guessing why.
    if admin and admin.suspended_reason:
        logger.warning(f"Login refused for suspended admin: {admin.username}")
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": suspended_message(admin.suspended_reason)},
        )
    if not admin or not verify_password(form_data.password, admin.hashed_password):
        logger.warning(f"Failed login attempt for username: {form_data.username}")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "message": "Incorrect username or password"},
        )

    logger.info(f"Admin login successful: {admin.username}")
    access_token = create_access_token(
        data={"sub": admin.username, "role": "admin", "panel": admin.panel}
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "message": "Login successful",
            "data": {"access_token": access_token, "token_type": "bearer"},
        },
    )
