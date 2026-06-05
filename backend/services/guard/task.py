from typing import Any

from sqlalchemy.orm import Session

from backend.schema._input import ClientInput, ClientUpdateInput
from backend.services.guard import APIService
from backend.db import crud
from backend.utils.logger import logger


class AdminTaskService:
    def __init__(self, admin_username: str, db: Session):
        self.admin_username = admin_username
        self.db = db

        self.admin = crud.get_admin_by_username(
            db,
            username=admin_username
        )

        panel = crud.get_panel_by_name(
            db,
            name=self.admin.panel
        )

        self.api_service = APIService(
            url=panel.url,
            token=panel.token if panel.token else ""
        )

    async def get_all_users(self) -> Any:
        try:
            clients = await self.api_service.get_clients()

            result = []

            for client in clients:
                result.append({
                    "id": client["id"],
                    "email": client["username"],
                    "username": client["username"],
                    "enable": client["is_active"],
                    "isOnline": client["is_online"],
                    "is_online": client["is_online"],
                    "totalGB": client["limit_usage"],
                    "usedData": client["current_usage"],
                    "expiryTime": client["limit_expire"] *1000,
                    "subId": client.get("link"),
                })
            return result

        except Exception as e:
            logger.error(
                f"Error retrieving users for admin "
                f"{self.admin_username}: {str(e)}"
            )

            return []

        except Exception as e:
            logger.error(
                f"Error retrieving users for admin "
                f"{self.admin_username}: {str(e)}"
            )

            return []

    async def get_client_by_email(self, email: str):
        try:
            client = await self.api_service.get_client_by_email(email)
            return client

        except Exception as e:
            logger.error(
                f"Error retrieving client by email "
                f"{email}: {str(e)}"
            )
            return False

    async def add_client_to_panel(
        self,
        client: ClientInput
    ) -> bool:
        try:
            result = await self.api_service.add_client(
                client,
            )

            logger.info(
                f"Client {client.email} added "
                f"to panel by admin "
                f"{self.admin_username}"
            )
            
            return result

        except Exception as e:
            logger.error(
                f"Failed to add client "
                f"{client.email} by admin "
                f"{self.admin_username}: {str(e)}"
            )

            return False

    async def update_client_in_panel(
        self,
        usename: str,
        client_data: ClientUpdateInput
    ) -> bool:
        try:
            result = await self.api_service.update_client(
                usename,
                client_data
            )

            return result

        except Exception as e:
            logger.error(
                f"Failed to update client "
                f"{client_data.email} by admin "
                f"{self.admin_username}: {str(e)}"
            )

            return False

    async def reset_client_usage(
        self,
        username: str
    ) -> bool:
        try:
            await self.api_service.reset_client_usage(
                username
            )

            return True

        except Exception as e:
            logger.error(
                f"Failed to reset usage for client "
                f"{username} by admin "
                f"{self.admin_username}: {str(e)}"
            )

            return False

    async def delete_client_from_panel(
        self,
        username: str
    ) -> bool:
        try:
            await self.api_service.delete_client(
                username
            )

            return True

        except Exception as e:
            logger.error(
                f"Failed to delete client "
                f"{username} by admin "
                f"{self.admin_username}: {str(e)}"
            )

            return False

        except Exception as e:
            logger.error(
                f"Failed to get client email by uuid "
                f"{uuid}: {str(e)}"
            )

            return None

    async def get_client_email_by_uuid(
            self,
            id: str
        ) -> str | None:
        try:
            clients = await self.get_all_users()

            for client in clients:
                if client["id"] == int(id):
                    return client["username"]

            return None

        except Exception as e:
            logger.error(
                f"Failed to get client email by uuid "
                f"{uuid}: {str(e)}"
            )

            return None

    def enable_client(
        self,
        username: str
    ) -> bool:
        try:
            result = self.api_service.enable_client(
                username
            )

            return result

        except Exception as e:
            logger.error(
                f"Failed to enable client "
                f"{username} by admin "
                f"{self.admin_username}: {str(e)}"
            )

            return False

    def disable_client(
        self,
        username: str
    ) -> bool:
        try:
            result = self.api_service.disable_client(
                username
            )

            return result

        except Exception as e:
            logger.error(
                f"Failed to disable client "
                f"{username} by admin "
                f"{self.admin_username}: {str(e)}"
            )

            return False