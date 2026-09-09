"""Derives a server's connection status from its last heartbeat.

Not stored on the row itself - the agent pushes every ~10s, so "connected"
is just "we heard from it recently" computed on read.
"""

from datetime import datetime, timedelta

# The agent's own heartbeat interval is 10s; a couple of missed beats before
# flipping to disconnected avoids flapping on one slow/lost request.
HEARTBEAT_TIMEOUT = timedelta(seconds=25)
# How long a freshly-added server is shown as "connecting" (install script
# still running, agent not started yet) before it's treated as disconnected.
CONNECTING_GRACE = timedelta(minutes=5)


def server_status(server) -> str:
    now = datetime.utcnow()

    if server.last_seen_at is not None:
        return "connected" if now - server.last_seen_at <= HEARTBEAT_TIMEOUT else "disconnected"

    if server.created_at is not None and now - server.created_at <= CONNECTING_GRACE:
        return "connecting"

    return "disconnected"
