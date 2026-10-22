import os

from pydantic_settings import BaseSettings
from typing import Optional


class Setting(BaseSettings):
    ADMIN_USERNAME: str
    ADMIN_PASSWORD: str
    URLPATH: str = "dashboard"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    DOC: bool = False
    SSL_KEYFILE: Optional[str] = None
    SSL_CERTFILE: Optional[str] = None
    JWT_SECRET_KEY: str
    JWT_ACCESS_TOKEN_EXPIRES: int = 86400  # in seconds
    # Optional so a deploy without this set in .env can't crash the whole app on
    # startup — an unset key just means the bot endpoints stay locked (see
    # verify_bot_api_key), everything else keeps working normally.
    BOT_API_KEY: str = ""
    # Seconds between quick checks of Marzban for users made outside Nexra
    # (see services/marzban/sync.py); 0 turns the sync off altogether. Every
    # six hours by default, to keep the load on Marzban down; lower it (600 is
    # still light: one page of the newest users) to charge new users sooner.
    MARZBAN_SYNC_INTERVAL: int = 21600
    # Seconds between full reads of every user, which catch edits, usage
    # resets and deletions made outside Nexra.
    MARZBAN_FULL_SYNC_INTERVAL: int = 21600

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env")


config = Setting()