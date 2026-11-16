"""File-based panel settings stored in the persisted data volume.

Keeps runtime-configurable options (login branding + Telegram backup) in a
small JSON file next to the database, so no DB migration is required.
"""

import os
import json
import threading

DATA_DIR = os.environ.get("WALPANEL_DATA_DIR", "/app/data")
SETTINGS_PATH = os.path.join(DATA_DIR, "settings.json")
LOGO_PATH = os.path.join(DATA_DIR, "logo")

_lock = threading.Lock()

DEFAULTS = {
    "login_title": "Nexra Panel",
    "telegram_bot_token": "",
    "telegram_chat_id": "",
    "backup_enabled": False,
    "backup_interval_hours": 6,
    # Where monitoring agents send their heartbeats. Empty means "whatever
    # domain the panel is open on", which is wrong when one of the panel's
    # domains is routable from the monitored servers and another isn't.
    "agent_base_url": "",
    # Names admins see for Marzban nodes on their Analytics page, in place of
    # the names set in Marzban: {panel id: {node key: name}}, where the node
    # key is Marzban's node id, or "master" for the main server.
    "node_names": {},
}


def _read() -> dict:
    data = dict(DEFAULTS)
    try:
        if os.path.exists(SETTINGS_PATH):
            with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
                stored = json.load(f) or {}
            for key in DEFAULTS:
                if key in stored:
                    data[key] = stored[key]
    except Exception:
        pass
    return data


def get_settings() -> dict:
    data = _read()
    data["has_logo"] = os.path.exists(LOGO_PATH)
    return data


def update_settings(patch: dict) -> dict:
    with _lock:
        data = _read()
        for key in DEFAULTS:
            if key in patch and patch[key] is not None:
                data[key] = patch[key]
        os.makedirs(DATA_DIR, exist_ok=True)
        tmp = SETTINGS_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, SETTINGS_PATH)
    return get_settings()


def get_node_names() -> dict[str, dict[str, str]]:
    names = _read().get("node_names")
    return dict(names) if isinstance(names, dict) else {}


def set_panel_node_names(panel_id: int, names: dict[str, str]) -> dict[str, str]:
    """Replace one panel's node names. Blank names are dropped, which puts
    the node's Marzban name back."""
    cleaned = {
        str(key): str(name).strip()[:64]
        for key, name in names.items()
        if isinstance(name, str) and name.strip()
    }
    all_names = get_node_names()
    all_names[str(panel_id)] = cleaned
    if not cleaned:
        all_names.pop(str(panel_id), None)
    update_settings({"node_names": all_names})
    return cleaned


def get_public_branding() -> dict:
    data = _read()
    return {
        "login_title": data.get("login_title") or "Nexra Panel",
        "has_logo": os.path.exists(LOGO_PATH),
    }


def save_logo(content: bytes) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(LOGO_PATH, "wb") as f:
        f.write(content)


def get_logo_path():
    return LOGO_PATH if os.path.exists(LOGO_PATH) else None


def logo_media_type() -> str:
    path = get_logo_path()
    if not path:
        return "application/octet-stream"
    try:
        with open(path, "rb") as f:
            head = f.read(16)
    except Exception:
        return "image/png"
    if head.startswith(b"\x89PNG"):
        return "image/png"
    if head.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if head.startswith(b"GIF8"):
        return "image/gif"
    if head[:4] == b"RIFF" and b"WEBP" in head:
        return "image/webp"
    if head.startswith(b"<svg") or head.startswith(b"<?xml"):
        return "image/svg+xml"
    return "image/png"
