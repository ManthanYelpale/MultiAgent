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

    @abstractmethod
    def delete_file(self, user_id: int, stored_filename: str) -> bool:
        pass


class LocalStorageService(StorageService):
    def _user_dir(self, user_id: int) -> str:
        return os.path.join(settings.UPLOAD_DIR, str(user_id))

    def save_file(self, user_id: int, stored_filename: str, contents: bytes) -> str:
        user_dir = self._user_dir(user_id)
        os.makedirs(user_dir, exist_ok=True)
        stored_path = os.path.join(user_dir, stored_filename)
        with open(stored_path, "wb") as f:
            f.write(contents)
        return stored_path

    def get_file_path(self, user_id: int, stored_filename: str) -> str:
        return os.path.join(self._user_dir(user_id), stored_filename)

    def delete_file(self, user_id: int, stored_filename: str) -> bool:
        # Contain the delete within the user's own directory: never let a crafted
        # stored_filename escape via traversal.
        user_dir = os.path.realpath(self._user_dir(user_id))
        target = os.path.realpath(os.path.join(user_dir, stored_filename))
        if os.path.commonpath([user_dir, target]) != user_dir:
            return False
        if os.path.isfile(target):
            os.remove(target)
            return True
        return False


def get_storage_service() -> StorageService:
    return LocalStorageService()
