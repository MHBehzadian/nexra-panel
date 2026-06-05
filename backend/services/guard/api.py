import httpx

from secrets import token_hex
from backend.schema._input import ClientInput, ClientUpdateInput


class APIService:
    def __init__(self, url: str, token: str):
        self.url = url.rstrip("/")
        self.token = token

        self.client = httpx.AsyncClient(
            base_url=self.url,
            headers={
                "X-API-Key": self.token,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def close(self):
        await self.client.aclose()

    async def test_connection(self) -> bool:
        try:
            response = await self.client.get("/api/subscriptions/count")

            return response.status_code
        except Exception:
            return False

    async def get_clients(self):
        response = await self.client.get(
            "/api/subscriptions",
            params = {
            "page": 0,
            "size": 1000,
        }
        )

        response.raise_for_status()

        return response.json()

    async def get_client_by_username(
        self,
        username: str
    ):
        response = await self.client.get(
            f"/api/subscriptions/{username}"
        )

        response.raise_for_status()

        return response.json()

    async def add_client(
        self,
        client: ClientInput
    ):
        base = str(client.sub_id)
        payload = [
            {
            "username": client.email,
            "enabled": client.enable,
            "limit_usage": int(client.total),
            "limit_expire": int(client.expiry_time // 1000),
            "access_key": (base + token_hex(16))[:32],
            "service_ids": [1, 2],
        }
        ]

        response = await self.client.post(
            "/api/subscriptions",
            json=payload,
        )

        return response.status_code

    async def update_client(
        self,
        username: str,
        client: ClientUpdateInput
    ):
        payload = {
            "limit_usage": int(client.total),
            "limit_expire": int(client.expiry_time // 1000),
        }

        response = await self.client.put(
            f"/api/subscriptions/{username}",
            json=payload,
        )

        response.raise_for_status()

        return response.status_code

    async def delete_client(
        self,
        username: str
    ):
        response = await self.client.request(
            "DELETE",
            "/api/subscriptions",
            json={
                "usernames": [username]
            }
        )

        response.raise_for_status()

        try:
            return response.json()
        except Exception:
            return {"status_code": response.status_code}

    async def reset_client_usage(
        self,
        username: str
    ):
        response = await self.client.post(
            "/api/subscriptions/reset",
            json={
                "usernames": [username]
            }
        )

        response.raise_for_status()

        return response.json()

    async def enable_client(
        self,
        username: str
    ):
        response = await self.client.post(
            "/api/subscriptions/enable",
            json={
                "usernames": [username]
            }
        )

        response.raise_for_status()

        return response.json()

    async def disable_client(
        self,
        username: str
    ):
        response = await self.client.post(
            "/api/subscriptions/disable",
            json={
                "usernames": [username]
            }
        )

        response.raise_for_status()

        return response.json()

    async def revoke_client(
        self,
        username: str
    ):
        response = await self.client.post(
            "/api/subscriptions/revoke",
            json={
                "usernames": [username]
            }
        )

        response.raise_for_status()

        return response.json()