import os
from abc import ABC, abstractmethod

from app.core.config import settings


class StorageService(ABC):
    @abstractmethod
    def save_file(self, user_id: int, stored_filename: str, contents: bytes) -> str:
        pass

    @abstractmethod
    def get_file_path(self, user_id: int, stored_filename: str) -> str:
        pass


class LocalStorageService(StorageService):
    def save_file(self, user_id: int, stored_filename: str, contents: bytes) -> str:
        user_dir = os.path.join(settings.UPLOAD_DIR, str(user_id))
        os.makedirs(user_dir, exist_ok=True)
        stored_path = os.path.join(user_dir, stored_filename)
        with open(stored_path, "wb") as f:
            f.write(contents)
        return stored_path

    def get_file_path(self, user_id: int, stored_filename: str) -> str:
        user_dir = os.path.join(settings.UPLOAD_DIR, str(user_id))
        return os.path.join(user_dir, stored_filename)


def get_storage_service() -> StorageService:
    return LocalStorageService()
