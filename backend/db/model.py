from datetime import datetime
from .engin import Base
from sqlalchemy import Column, DateTime, Integer, String, Boolean, BigInteger, Float, ForeignKey, UniqueConstraint


class Admins(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    panel = Column(String, nullable=False)
    inbound_id = Column(String, nullable=True)
    marzban_inbounds = Column(String, nullable=True)
    marzban_password = Column(String, nullable=True)
    traffic = Column(BigInteger, default=0)
    initial_traffic = Column(BigInteger, default=0, nullable=True)
    update_return_traffic = Column(Boolean, default=False)
    delete_return_traffic = Column(Boolean, default=False)
    expiry_date = Column(DateTime, nullable=True)
    inbound_flow = Column(String, nullable=True)
    # Not unique: one person can own several reseller panels (see c7b1d4e88a25).
    telegram_id = Column(BigInteger, nullable=True, index=True)
    # When the Marzban ledger first took in this admin's users (see
    # services/marzban/sync.py). Null means the next sync adopts whatever is
    # on Marzban as already paid for, without charging.
    marzban_synced_at = Column(DateTime, nullable=True)
    # Set by the top-up bot when it locks this panel ("unpaid" for an unpaid
    # weekly invoice, "manual" for a lock the superadmin placed), cleared when
    # it gives the panel back. A lock works by changing the password, so without
    # this the admin is only ever told "wrong password" and never why.
    suspended_reason = Column(String, nullable=True)
    # Set when a reseller made this panel from the bot for a colleague of
    # theirs: the panel it was made from (its traffic came out of that one).
    # Not a foreign key (see a7d3e9b1c4f2): a deleted parent just leaves a stale id.
    parent_id = Column(Integer, nullable=True, index=True)
    # A panel the reseller hands on under their own name: the panel UI shows
    # nothing of Nexra — no name or logo, no Finance or Support links, no
    # announcements — so its admin has no way back to us around the reseller.
    white_label = Column(Boolean, default=False, nullable=False, server_default="0")


class Panels(Base):
    __tablename__ = "panels"

    id = Column(Integer, primary_key=True, index=True)
    panel_type = Column(String, nullable=False)
    name = Column(String, unique=True, index=True, nullable=False)
    url = Column(String, nullable=False)
    sub_url = Column(String, nullable=True)
    username = Column(String, nullable=False)
    password = Column(String, nullable=False)
    token = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)


class News(Base):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.date)

class SanaeiUsers(Base):
    __tablename__ = "sanaei_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    owner = Column(String, nullable=False)

class MarzbanUsers(Base):
    """What Nexra last saw of one Marzban user and has charged its owner for.

    Marzban users can be created and edited outside Nexra (in Marzban itself,
    or by a sales bot logged in as the admin), so the admin's traffic is kept
    by comparing Marzban against this ledger rather than by counting only the
    changes made through Nexra.
    """

    __tablename__ = "marzban_users"
    __table_args__ = (UniqueConstraint("owner", "username"),)

    id = Column(Integer, primary_key=True, index=True)
    # The Nexra admin's username (the same name the user has on Marzban as its admin).
    owner = Column(String, nullable=False, index=True)
    username = Column(String, nullable=False)
    data_limit = Column(BigInteger, default=0, nullable=False)
    used_traffic = Column(BigInteger, default=0, nullable=False)


class GuardUsers(Base):
    __tablename__ = "guard_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    owner = Column(String, nullable=False)


class Servers(Base):
    """A server monitored by the lightweight Nexra agent. Not tied to a
    Marzban Panel - any box that runs the agent can be added here."""

    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Display order in the dashboard list, user-reorderable. New servers are
    # appended after the current maximum.
    sort_order = Column(Integer, default=0, nullable=False)

    # Populated by the agent's heartbeat; null until the first one arrives.
    last_seen_at = Column(DateTime, nullable=True)
    cpu_percent = Column(Float, nullable=True)
    cpu_cores = Column(Integer, nullable=True)
    ram_used = Column(BigInteger, nullable=True)
    ram_total = Column(BigInteger, nullable=True)
    swap_used = Column(BigInteger, nullable=True)
    swap_total = Column(BigInteger, nullable=True)
    disk_used = Column(BigInteger, nullable=True)
    disk_total = Column(BigInteger, nullable=True)

    # Set by the reboot endpoint, cleared once the agent acts on it and
    # confirms in its next heartbeat after restart.
    reboot_requested = Column(Boolean, default=False)

class TelegramBots(Base):
    """A Nexra sales bot (nexrabot, the Go MirzaBot) this panel manages.

    The panel talks to the bot's management API (/api/v1) with one of two keys:
    owner_key is only ever used for the superadmin, manager_key for the admin
    the bot is assigned to. The bot itself refuses panel (server) changes for
    the manager key, so an admin can run the shop but never touch servers.
    """

    __tablename__ = "telegram_bots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    # Base address of the bot, e.g. https://bot7.example.com (no /api/v1)
    url = Column(String, nullable=False)
    owner_key = Column(String, nullable=False)
    manager_key = Column(String, nullable=False)
    # The admin who runs this bot; null means only the superadmin sees it.
    admin_id = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True, index=True)
    bot_username = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdminUsageHourly(Base):
    """How much traffic one admin's Marzban users used in one hour.

    Filled from the Marzban sync, which already reads every user's used
    traffic: the growth since the ledger's last reading is added to the hour
    it was seen in, so this costs Marzban no extra requests. `hour` is the
    start of a local hour (see ANALYTICS_UTC_OFFSET_MINUTES), stored as naive
    UTC like every other timestamp here.
    """

    __tablename__ = "admin_usage_hourly"
    __table_args__ = (UniqueConstraint("admin_id", "hour"),)

    id = Column(Integer, primary_key=True)
    admin_id = Column(Integer, nullable=False, index=True)
    hour = Column(DateTime, nullable=False, index=True)
    used = Column(BigInteger, default=0, nullable=False)


class AdminTrafficLog(Base):
    """Every change to an admin's balance made by selling: a charge for a new
    user, a raised limit or a reset (positive), or a refund for a deleted or
    lowered user (negative). Grants and top-ups are not sales and stay out.
    The analytics page averages it into a daily sales rate."""

    __tablename__ = "admin_traffic_log"

    id = Column(Integer, primary_key=True)
    admin_id = Column(Integer, nullable=False, index=True)
    amount = Column(BigInteger, nullable=False)
    # "charge", "refund", or "backfill": sales from before this log existed,
    # read once from the users' creation dates on Marzban (see
    # services/marzban/sync.py). A "backfill" row of 0 marks that it ran.
    kind = Column(String, nullable=False, default="charge")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
