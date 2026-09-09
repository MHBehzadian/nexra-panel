from datetime import datetime
from secrets import token_hex
from sqlalchemy.orm import Session

from backend.db.model import Admins, Panels, News, SanaeiUsers, Servers
from backend.schema._input import AdminInput, AdminUpdateInput, PanelInput
from backend.auth.hash import hash_password


def get_all_admins(db: Session):
    return db.query(Admins).all()


def add_admin(db: Session, admin_input: AdminInput) -> None:
    try:
        hashed_pwd = hash_password(password=admin_input.password)
    except Exception as e:
        raise e

    admin = Admins(
        username=admin_input.username,
        hashed_password=hashed_pwd,
        is_active=admin_input.is_active,
        panel=admin_input.panel,
        inbound_id=admin_input.inbound_id,
        inbound_flow=admin_input.flow,
        marzban_inbounds=admin_input.marzban_inbounds,
        marzban_password=admin_input.marzban_password,
        traffic=admin_input.traffic,
        initial_traffic=admin_input.traffic,
        update_return_traffic=admin_input.update_return_traffic,
        delete_return_traffic=admin_input.delete_return_traffic,
        expiry_date=admin_input.expiry_date,
        telegram_id=admin_input.telegram_id,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)


def get_admin_by_username(db: Session, username: str):
    return db.query(Admins).filter(Admins.username == username).first()


def get_admin_by_telegram_id(db: Session, telegram_id: int):
    return db.query(Admins).filter(Admins.telegram_id == telegram_id).first()


def get_admins_by_telegram_id(db: Session, telegram_id: int) -> list[Admins]:
    """Every admin (panel) owned by this Telegram account — one person can own several."""
    return db.query(Admins).filter(Admins.telegram_id == telegram_id).all()


def get_owned_admin(db: Session, telegram_id: int, username: str):
    """One specific panel, but only if this Telegram account actually owns it.

    Matching on both columns is what stops a caller from naming someone else's
    panel and having it charged or re-passworded.
    """
    return (
        db.query(Admins)
        .filter(Admins.telegram_id == telegram_id, Admins.username == username)
        .first()
    )


def change_admin_status(db: Session, admin_id: int) -> bool:
    admin = db.query(Admins).filter(Admins.id == admin_id).first()
    if admin:
        admin.is_active = not admin.is_active
        db.commit()
        return True
    return False


def update_admin_values(
    db: Session, admin_id: int, admin_input: AdminUpdateInput
) -> bool:
    admin = db.query(Admins).filter(Admins.id == admin_id).first()
    new_password = (
        hash_password(admin_input.password)
        if admin_input.password
        else admin.hashed_password
    )
    if admin:
        admin.username = admin_input.username
        admin.hashed_password = new_password
        admin.is_active = admin_input.is_active
        admin.panel = admin_input.panel
        admin.inbound_id = admin_input.inbound_id
        admin.inbound_flow = admin_input.flow
        admin.marzban_inbounds = admin_input.marzban_inbounds
        admin.marzban_password = admin_input.marzban_password
        admin.traffic = admin_input.traffic
        admin.initial_traffic = admin_input.traffic
        admin.update_return_traffic = admin_input.update_return_traffic
        admin.delete_return_traffic = admin_input.delete_return_traffic
        admin.expiry_date = admin_input.expiry_date
        admin.telegram_id = admin_input.telegram_id
        db.commit()
        return True
    return False


def remove_admin(db: Session, admin_id: int) -> bool:
    admin = db.query(Admins).filter(Admins.id == admin_id).first()
    if admin:
        db.delete(admin)
        db.commit()
        return True
    return False


def reduce_admin_traffic(db: Session, admin: Admins, used_traffic) -> None:
    admin.traffic -= used_traffic
    db.commit()


def increase_admin_traffic(db: Session, admin: Admins, added_traffic) -> None:
    admin.traffic += added_traffic
    db.commit()


def grant_admin_traffic(db: Session, admin: Admins, added_traffic) -> None:
    """Grant NEW quota to an admin (e.g. a paid top-up via the bot).

    Unlike increase_admin_traffic (used by limit_handler.py to refund traffic a
    user already had but didn't use — where initial_traffic must NOT move), this
    also raises initial_traffic, since the admin's total granted quota actually
    went up and the panel's Remaining/Initial display should reflect that.
    """
    admin.traffic += added_traffic
    admin.initial_traffic += added_traffic
    db.commit()


def update_marzban_password(db: Session, admin: Admins, new_password: str) -> None:
    """Set both passwords an admin has, keeping them in step.

    An admin has two: `hashed_password` logs them into Nexra itself, and
    `marzban_password` is the credential Nexra presents to Marzban on their
    behalf. The panel's own edit form always sets both together, so changing
    only one here left the admin unable to log into Nexra with their new
    password even though Marzban had accepted it.
    """
    admin.marzban_password = new_password
    admin.hashed_password = hash_password(new_password)
    db.commit()


def get_all_panels(db: Session):
    return db.query(Panels).all()


def get_panel_by_name(db: Session, name: str) -> Panels | None:
    return db.query(Panels).filter(Panels.name == name).first()


def add_panel(db: Session, panel_input: PanelInput) -> None:
    panel = Panels(
        panel_type=panel_input.panel_type,
        name=panel_input.name,
        url=panel_input.url,
        sub_url=panel_input.sub_url,
        username=panel_input.username,
        password=panel_input.password,
        token=panel_input.token,
        is_active=panel_input.is_active,
    )
    db.add(panel)
    db.commit()
    db.refresh(panel)


def update_panel_values(db: Session, panel_id: int, panel_input: PanelInput) -> bool:
    panel = db.query(Panels).filter(Panels.id == panel_id).first()
    if panel:
        panel.panel_type = panel_input.panel_type
        panel.name = panel_input.name
        panel.url = panel_input.url
        panel.sub_url = panel_input.sub_url
        panel.username = panel_input.username
        panel.password = panel_input.password
        panel.token = panel_input.token
        db.commit()
        return True
    return False


def remove_panel(db: Session, panel_id: int) -> bool:
    panel = db.query(Panels).filter(Panels.id == panel_id).first()
    if panel:
        db.delete(panel)
        db.commit()
        return True
    return False


def get_panel_by_id(db: Session, panel_id: int):
    return db.query(Panels).filter(Panels.id == panel_id).first()


def change_panel_status(db: Session, panel_id: int) -> bool:
    panel = db.query(Panels).filter(Panels.id == panel_id).first()
    if panel:
        panel.is_active = not panel.is_active
        db.commit()
        return True
    return False


def get_all_servers(db: Session):
    return db.query(Servers).order_by(Servers.name).all()


def get_server_by_id(db: Session, server_id: int) -> Servers | None:
    return db.query(Servers).filter(Servers.id == server_id).first()


def get_server_by_token(db: Session, token: str) -> Servers | None:
    return db.query(Servers).filter(Servers.token == token).first()


def add_server(db: Session, name: str) -> Servers:
    server = Servers(name=name, token=token_hex(24))
    db.add(server)
    db.commit()
    db.refresh(server)
    return server


def rename_server(db: Session, server_id: int, name: str) -> bool:
    server = get_server_by_id(db, server_id)
    if server:
        server.name = name
        db.commit()
        return True
    return False


def remove_server(db: Session, server_id: int) -> bool:
    server = get_server_by_id(db, server_id)
    if server:
        db.delete(server)
        db.commit()
        return True
    return False


def request_server_reboot(db: Session, server_id: int) -> bool:
    server = get_server_by_id(db, server_id)
    if server:
        server.reboot_requested = True
        db.commit()
        return True
    return False


def record_server_heartbeat(db: Session, server: Servers, metrics: dict) -> bool:
    """Applies one agent heartbeat and returns whether a reboot is pending
    (and clears it - the agent is expected to act on it right away)."""
    server.last_seen_at = datetime.utcnow()
    server.cpu_percent = metrics.get("cpu_percent")
    server.cpu_cores = metrics.get("cpu_cores")
    server.ram_used = metrics.get("ram_used")
    server.ram_total = metrics.get("ram_total")
    server.swap_used = metrics.get("swap_used")
    server.swap_total = metrics.get("swap_total")
    server.disk_used = metrics.get("disk_used")
    server.disk_total = metrics.get("disk_total")

    reboot_pending = bool(server.reboot_requested)
    if reboot_pending:
        server.reboot_requested = False

    db.commit()
    return reboot_pending


def get_news(db: Session):
    return db.query(News).all()


def add_news(db: Session, message: str | None) -> News:
    news = News(message=message, created_at=datetime.utcnow())
    db.add(news)
    db.commit()
    db.refresh(news)
    return news


def delete_news(db: Session, id: int) -> None:
    from backend.utils.banners import delete_banner

    news = db.query(News).filter(News.id == id).first()
    if news:
        db.delete(news)
        db.commit()
        delete_banner(id)


def add_user_in_sanaei_table(db: Session, username: str, owner: str) -> None:
    sanaei = SanaeiUsers(username=username, owner=owner)
    db.add(sanaei)
    db.commit()
    db.refresh(sanaei)


def remove_user_from_sanaei_table(db: Session, username: str) -> None:
    sanaei_user = db.query(SanaeiUsers).filter(SanaeiUsers.username == username).first()
    if sanaei_user:
        db.delete(sanaei_user)
        db.commit()


def get_user_from_sanaei_table(db: Session, username: str) -> SanaeiUsers | None:
    return db.query(SanaeiUsers).filter(SanaeiUsers.username == username).first()


def get_all_users_from_sanaei_table(db: Session) -> list[SanaeiUsers] | None:
    return db.query(SanaeiUsers).all()

def add_user_in_guard_table(db: Session, username: str, owner: str) -> None:
    user = SanaeiUsers(username=username, owner=owner)
    db.add(user)
    db.commit()
    db.refresh(user)

def remove_user_from_guard_table(db: Session, username: str) -> None:
    user = db.query(SanaeiUsers).filter(SanaeiUsers.username == username).first()
    if user:
        db.delete(user)
        db.commit()

def get_user_from_guard_table(db:Session):
    return db.query(SanaeiUsers).all()