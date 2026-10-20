"""Keeps each Marzban admin's traffic in step with what is really on Marzban.

Nexra used to charge an admin only for the changes made through Nexra, so a
user created in Marzban itself, or by a sales bot logged in as the admin, cost
nothing. Now every admin has a ledger (MarzbanUsers) of the users Nexra has
charged them for, and any difference between it and Marzban is settled with
the same rules the Nexra handlers always used:

    new user            charge its data limit
    data limit changed  AdminLimiter.apply_update (committed = max(limit, used))
    usage reset         charge what had been used, up to the limit
    user gone           refund what was left unused (if delete_return_traffic)

The handlers settle the user they touch right before and after changing it
(refresh), and a background loop (marzban_sync_loop) settles everything else.
Charges outside Nexra are made even when the admin has no traffic left, so the
balance can go negative.

An admin's first sync only adopts the users already there, without charging:
they were either paid for through Nexra or made before this existed.
"""

import asyncio
from datetime import datetime

from sqlalchemy.orm import Session

from backend.config import config
from backend.db import crud
from backend.db.engin import sessionLocal
from backend.db.model import MarzbanUsers
from backend.services.limit_handler import AdminLimiter
from backend.services.marzban.api import APIService
from backend.utils.logger import logger

GB = 1024**3

# Counts the handlers' ledger writes per admin. The sync reads Marzban off the
# event loop, and a handler that settles a user meanwhile makes that read
# stale; the sync sees the count move and leaves the admin to its next pass.
_writes: dict[str, int] = {}


def _state(user: dict) -> tuple[int, int]:
    return int(user.get("data_limit") or 0), int(user.get("used_traffic") or 0)


def _owned_by(user: dict, admin_username: str) -> bool:
    # Older Marzban leaves the admin out of a user; then the user is taken as
    # belonging to whoever was able to read it.
    if "admin" not in user:
        return True
    return (user.get("admin") or {}).get("username") == admin_username


def settle(
    db: Session,
    limiter: AdminLimiter,
    owner: str,
    username: str,
    user: dict | None,
    row: MarzbanUsers | None,
) -> None:
    """Bring one ledger row in line with the user as Marzban has it now
    (None: no longer there for this admin), charging or refunding the
    difference. The caller commits."""
    if user is None:
        if row is not None:
            db.delete(row)
            limiter.increase_usage(max(row.data_limit - row.used_traffic, 0))
        return

    limit, used = _state(user)
    if row is None:
        db.add(MarzbanUsers(owner=owner, username=username, data_limit=limit, used_traffic=used))
        limiter.charge(limit)
        return

    old_limit, old_used = row.data_limit, row.used_traffic
    if (limit, used) == (old_limit, old_used):
        return
    # The row is updated before charging: the limiter commits, and a charge
    # committed beside a stale row would be charged again on the next pass.
    row.data_limit, row.used_traffic = limit, used
    if used < old_used:
        # Only a reset lowers used traffic; what had been used is free again.
        limiter.charge(min(old_used, old_limit))
    if limit != old_limit:
        limiter.apply_update(old_limit, limit, used)


async def refresh(
    db: Session, admin_username: str, api: APIService, username: str, before_change: bool = False
) -> None:
    """Settle one user as `api` (the admin's own Marzban login) sees it now.

    Handlers call this before a change (before_change=True), so the ledger
    starts from Marzban's current state, and after it, to charge for the
    change. If Marzban can't be read the ledger is left alone and the next
    sync settles the user instead.
    """
    try:
        user = await api.find_user(username)
    except Exception as exc:
        logger.warning(f"Marzban ledger: could not read {username} for {admin_username}: {exc}")
        return
    if user is not None and not _owned_by(user, admin_username):
        user = None

    _writes[admin_username] = _writes.get(admin_username, 0) + 1
    row = crud.get_marzban_ledger_row(db, admin_username, username)
    if before_change and row is None and user is not None:
        admin = crud.get_admin_by_username(db, admin_username)
        if admin.marzban_synced_at is None:
            # Not synced yet, so this user predates the ledger (the first sync
            # would adopt it free too); it isn't new.
            limit, used = _state(user)
            db.add(MarzbanUsers(owner=admin_username, username=username, data_limit=limit, used_traffic=used))
            db.commit()
            return
    settle(db, AdminLimiter(db, admin_username), admin_username, username, user, row)
    db.commit()


async def _read_marzban(
    admin_username: str,
    admin_password: str | None,
    panel_url: str,
    panel_username: str,
    panel_password: str,
    known: set[str],
) -> tuple[dict[str, dict], set[str]]:
    """The admin's users on Marzban, plus which of the `known` (ledger) users
    are really gone. Raises if Marzban can't be read in full."""
    api = APIService(panel_url, panel_username, panel_password)
    users = await api.list_users(admin=admin_username)
    if any("admin" not in user for user in users):
        # This Marzban doesn't say who owns a user, so ask as the admin.
        api = APIService(panel_url, admin_username, admin_password or "")
        users = await api.list_users()
    found = {u["username"]: u for u in users if u.get("username") and _owned_by(u, admin_username)}

    # A user missing from the list is looked up on its own before being taken
    # as deleted: one bad or shifting page must not refund (and then re-charge)
    # users that are still there.
    gone = set()
    for username in known - found.keys():
        user = await api.find_user(username)
        if user is None or not _owned_by(user, admin_username):
            gone.add(username)
        else:
            found[username] = user
    return found, gone


async def sync_admin(admin_username: str) -> None:
    db = sessionLocal()
    try:
        admin = crud.get_admin_by_username(db, admin_username)
        panel = crud.get_panel_by_name(db, admin.panel) if admin else None
        if not panel or panel.panel_type != "marzban" or not panel.is_active:
            return
        known = set(crud.get_marzban_ledger(db, admin_username))
        args = (admin_username, admin.marzban_password, panel.url, panel.username, panel.password, known)
    finally:
        db.close()

    writes = _writes.get(admin_username, 0)
    try:
        found, gone = await asyncio.to_thread(lambda: asyncio.run(_read_marzban(*args)))
    except Exception as exc:
        logger.warning(f"Marzban sync: could not read users of {admin_username}: {exc}")
        return
    if _writes.get(admin_username, 0) != writes:
        return

    db = sessionLocal()
    try:
        admin = crud.get_admin_by_username(db, admin_username)
        if admin is None:
            return
        ledger = crud.get_marzban_ledger(db, admin_username)

        if admin.marzban_synced_at is None:
            for username, user in found.items():
                limit, used = _state(user)
                row = ledger.get(username)
                if row is None:
                    db.add(MarzbanUsers(owner=admin_username, username=username, data_limit=limit, used_traffic=used))
                else:
                    row.data_limit, row.used_traffic = limit, used
            admin.marzban_synced_at = datetime.utcnow()
            db.commit()
            logger.info(f"Marzban sync: adopted {len(found)} existing users of {admin_username} without charging")
            return

        limiter = AdminLimiter(db, admin_username)
        before = admin.traffic
        for username, user in found.items():
            settle(db, limiter, admin_username, username, user, ledger.get(username))
        for username in gone:
            if username in ledger:
                settle(db, limiter, admin_username, username, None, ledger[username])
        db.commit()

        change = before - admin.traffic
        if change:
            verb = "charged" if change > 0 else "refunded"
            logger.info(
                f"Marzban sync: {admin_username} {verb} {abs(change) / GB:.2f} GB "
                f"for changes made outside Nexra, remaining {admin.traffic / GB:.2f} GB"
            )
    finally:
        db.close()


async def sync_all() -> None:
    db = sessionLocal()
    try:
        usernames = [admin.username for admin in crud.get_all_admins(db)]
    finally:
        db.close()
    for username in usernames:
        try:
            await sync_admin(username)
        except Exception as exc:
            logger.error(f"Marzban sync failed for {username}: {exc}")


async def marzban_sync_loop():
    if config.MARZBAN_SYNC_INTERVAL <= 0:
        return
    # Let the app finish starting before the first (and largest) read.
    await asyncio.sleep(10)
    while True:
        try:
            await sync_all()
        except Exception as exc:
            logger.error(f"Marzban sync error: {exc}")
        await asyncio.sleep(config.MARZBAN_SYNC_INTERVAL)
