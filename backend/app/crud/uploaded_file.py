from sqlalchemy.orm import Session

from app.models.uploaded_file import UploadedFile


def create_uploaded_file(
    db: Session,
    owner_id: int,
    original_filename: str,
    stored_filename: str,
    file_type: str,
    row_count: int | None,
    column_count: int | None,
    columns_preview: str | None,
) -> UploadedFile:
    db_file = UploadedFile(
        owner_id=owner_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_type=file_type,
        row_count=row_count,
        column_count=column_count,
        columns_preview=columns_preview,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file


def list_files_for_user(db: Session, owner_id: int) -> list[UploadedFile]:
    return (
        db.query(UploadedFile)
        .filter(UploadedFile.owner_id == owner_id)
        .order_by(UploadedFile.uploaded_at.desc())
        .all()
    )


def get_file_for_user(db: Session, owner_id: int, file_id: int) -> UploadedFile | None:
    return (
        db.query(UploadedFile)
        .filter(UploadedFile.owner_id == owner_id, UploadedFile.id == file_id)
        .first()
    )
