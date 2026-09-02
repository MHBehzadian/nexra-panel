import time
import json
import requests
from datetime import datetime, timedelta, timezone

from backend.schema._input import ClientInput, ClientUpdateInput


class APIService:
    # Marzban fires a Telegram alert on every admin login, so tokens are reused
    # until they age out. Keyed per (url, username): the previous single-slot
    # cache never recorded the username it belonged to, so its guard could never
    # match and every single API call logged in again.
    _token_cache: dict[tuple[str, str], tuple[str, float]] = {}
    _token_ttl = 300
    # Without this a stalled Marzban holds the panel's request open until nginx
    # gives up and serves a 504.
    _request_timeout = 15

    def __init__(
        self, url: str, username: str, password: str, inbounds: dict | str | None = None
    ):
        self.url = url if url.endswith("/") else url + "/"
        self.username = username
        self.password = password
        self.token: str | None = None
        self.session = requests.Session()
        self.headers: dict[str, str] | None = None

        if isinstance(inbounds, str):
            try:
                self.inbounds = json.loads(inbounds)
            except (json.JSONDecodeError, TypeError):
                self.inbounds = {}
        else:
            self.inbounds = inbounds or {}

    async def _login(self):
        now = time.time()
        key = (self.url, self.username)

        cached = APIService._token_cache.get(key)
        if cached and now - cached[1] < APIService._token_ttl:
            self.token = cached[0]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            return

        token = (
            requests.post(
                f"{self.url}api/admin/token",
                data={
                    "username": self.username,
                    "password": self.password,
                },
                timeout=self._request_timeout,
            )
            .json()
            .get("access_token")
        )

        # A failed login must not be cached, or the panel would keep replaying
        # the failure for the whole TTL.
        if token:
            APIService._token_cache[key] = (token, now)

        self.token = token
        self.headers = {"Authorization": f"Bearer {self.token}"}

    async def test_connection(self) -> bool:
        try:
            token = (
                requests.post(
                    f"{self.url}api/admin/token",
                    data={
                        "username": self.username,
                        "password": self.password,
                    },
                )
                .json()
                .get("access_token")
            )
            return True if token else False
        except Exception:
            return False

    async def get_users(self):
        await self._login()
        url = f"{self.url}api/users"
        response = self.session.get(url, headers=self.headers).json()
        return response

    async def get_user(self, username: str) -> dict | bool:
        await self._login()
        user = self.session.get(
            f"{self.url}api/user/{username}",
            headers=self.headers,
        ).json()
        return user

    async def get_inbounds(self) -> dict:
        await self._login()
        url = f"{self.url}api/inbounds"

        response = self.session.get(url, headers=self.headers)

        # Transform to list of tags for each protocol
        inbounds = response.json()
        for protocol in inbounds:
            inbounds[protocol] = [item["tag"] for item in inbounds[protocol]]

        return inbounds

    async def create_user(self, user: ClientInput) -> int:
        await self._login()
        proxies = {k: {} for k in self.inbounds}
        expire_ts = user.expiry_time // 1000 if user.expiry_time else 0
        data_limit = int(user.total) if user.total is not None else 0

        data = {
            "username": user.email,
            "status": "active",
            "expire": expire_ts,
            "data_limit": data_limit,
            "data_limit_reset_strategy": "no_reset",
            "inbounds": self.inbounds,
            "proxies": proxies,
            "note": "",
            "on_hold_expire_duration": 0,
            "on_hold_timeout": None,
        }

        response = self.session.post(
            f"{self.url}api/user",
            headers=self.headers,
            json=data,
        )
        return response.status_code

    async def update_user(self, username: str, user_data: ClientUpdateInput) -> int:
        await self._login()
        expire_ts = user_data.expiry_time // 1000 if user_data.expiry_time else 0
        data_limit = int(user_data.total) if user_data.total is not None else 0

        update_data = {
            "status": "active" if user_data.enable else "disabled",
            "data_limit": data_limit,
            "expire": expire_ts,
            "data_limit_reset_strategy": "no_reset",
            "proxies": {},
            "inbounds": {},
            "note": "",
        }

        response = self.session.put(
            f"{self.url}api/user/{username}",
            headers=self.headers,
            json=update_data,
        )
        return response.status_code

    async def reset_user_traffic(self, username: str) -> int:
        await self._login()
        response = self.session.post(
            f"{self.url}api/user/{username}/reset",
            headers=self.headers,
        )
        return response.status_code

    async def delete_user(self, username: str) -> int:
        await self._login()
        response = self.session.delete(
            f"{self.url}api/user/{username}",
            headers=self.headers,
        )
        return response.status_code

    async def update_admin_password(self, admin_username: str, new_password: str) -> int:
        """Change another Marzban admin's password. Requires this APIService to be
        logged in as a sudo admin (self.username/self.password) — Marzban rejects
        this call from a non-sudo admin, even one modifying its own account.

        Marzban's AdminModify body requires `is_sudo`, so a password-only payload
        is rejected with 422. The admin's current record is read first and its
        flags echoed back unchanged: guessing `is_sudo` here would silently
        promote or demote the account being edited.
        """
        await self._login()

        current = next(
            (a for a in await self.get_admins() if a.get("username") == admin_username), None
        )
        if current is None:
            return 404

        payload = {"password": new_password, "is_sudo": bool(current.get("is_sudo"))}
        for field in ("telegram_id", "discord_webhook"):
            if current.get(field) is not None:
                payload[field] = current[field]

        response = self.session.put(
            f"{self.url}api/admin/{admin_username}",
            headers=self.headers,
            json=payload,
        )
        return response.status_code

    async def get_system_stats(self) -> dict:
        """Marzban's own /api/system snapshot: user counts, lifetime bandwidth
        and the CPU/RAM of the host Marzban itself runs on."""
        await self._login()
        response = self.session.get(
            f"{self.url}api/system",
            headers=self.headers,
            timeout=self._request_timeout,
        )
        if response.status_code != 200:
            return {}
        return response.json()

    async def get_nodes_usage(self, start: str, end: str) -> list[dict]:
        """Per-node traffic for a window. Marzban wants naive ISO timestamps."""
        await self._login()
        response = self.session.get(
            f"{self.url}api/nodes/usage",
            headers=self.headers,
            params={"start": start, "end": end},
            timeout=self._request_timeout,
        )
        if response.status_code != 200:
            return []
        return response.json().get("usages", [])

    async def get_nodes_status(self) -> list[dict]:
        """Connection status for every configured remote node - does not
        include the master itself, which api/nodes/usage reports separately
        with a null node_id. Read-only, GET /api/nodes."""
        await self._login()
        response = self.session.get(
            f"{self.url}api/nodes",
            headers=self.headers,
            timeout=self._request_timeout,
        )
        if response.status_code != 200:
            return []

        nodes = response.json()
        if not isinstance(nodes, list):
            return []

        return [
            {
                "id": node.get("id"),
                "name": node.get("name"),
                # connected / connecting / error / disabled, per Marzban's enum.
                "status": node.get("status"),
                "message": node.get("message"),
            }
            for node in nodes
            if isinstance(node, dict)
        ]

    async def count_online_users(self, window_seconds: int = 180) -> int:
        """Count users seen within the window.

        Marzban has no online counter, and pulling every user is expensive: the
        response carries each user's proxies, inbounds and subscription links,
        which on a large panel is many megabytes. So this asks for the most
        recently seen users first and stops at the first one outside the
        window, which normally reads a page or two instead of the whole list.

        Marzban rejects the sort field on some builds; that falls back to
        paging in natural order and scanning everything, still bounded by
        max_pages so a huge panel cannot stall the request forever.
        """
        await self._login()

        cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
        page_size = 200
        max_pages = 40
        online = 0
        sorted_by_seen = True

        page = 0
        pages_read = 0

        while pages_read < max_pages:
            params = {"offset": page * page_size, "limit": page_size}
            if sorted_by_seen:
                params["sort"] = "-online_at"

            response = self.session.get(
                f"{self.url}api/users",
                headers=self.headers,
                params=params,
                timeout=self._request_timeout,
            )

            if response.status_code != 200:
                if sorted_by_seen and page == 0:
                    # Most likely the sort field is unsupported here. Retry the
                    # very same page unsorted; nothing is counted yet, so the
                    # fallback cannot double count. A later failure just
                    # returns what has been counted so far.
                    sorted_by_seen = False
                    continue
                return online

            pages_read += 1

            users = response.json().get("users", [])
            if not users:
                break

            for user in users:
                stamp = self._parse_online_at(user.get("online_at"))
                if stamp is None:
                    continue
                if stamp >= cutoff:
                    online += 1
                elif sorted_by_seen:
                    # Newest first, so everything after this is older too.
                    return online

            if len(users) < page_size:
                break

            page += 1

        return online

    @staticmethod
    def _parse_online_at(seen) -> datetime | None:
        if not seen:
            return None
        try:
            stamp = datetime.fromisoformat(str(seen).replace("Z", "+00:00"))
        except ValueError:
            return None
        # Marzban reports naive UTC; attach the timezone before comparing.
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone.utc)
        return stamp

    async def get_admins(self) -> list[dict]:
        """List every admin as Marzban itself has them recorded (username,
        telegram_id, is_sudo, ...). Requires sudo credentials."""
        await self._login()
        response = self.session.get(
            f"{self.url}api/admins",
            headers=self.headers,
            timeout=self._request_timeout,
        )
        if response.status_code != 200:
            return []
        return response.json()

    async def create_admin(
        self, username: str, password: str, telegram_id: int | None = None
    ) -> tuple[int, str]:
        """Create a non-sudo admin in Marzban. Requires sudo credentials.

        Returns (status_code, detail) so the caller can report Marzban's own
        reason — most often a duplicate username — instead of a bare number.
        """
        await self._login()
        payload = {"username": username, "password": password, "is_sudo": False}
        if telegram_id:
            payload["telegram_id"] = telegram_id

        response = self.session.post(
            f"{self.url}api/admin", headers=self.headers, json=payload
        )
        detail = ""
        if response.status_code != 200:
            try:
                detail = str(response.json().get("detail", response.text))
            except Exception:
                detail = response.text
        return response.status_code, detail
