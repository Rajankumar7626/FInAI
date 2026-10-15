from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from tempfile import gettempdir
from uuid import UUID, uuid4

from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from backend.config import settings
from backend.database import DocumentORM, _engine_for_url, ensure_schema


class DocumentCapacityError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


@dataclass(frozen=True)
class DocumentRecord:
    document_id: str
    filename: str
    page_count: int
    extracted_character_count: int
    extraction_status: str
    extracted_text: str
    owner_id: str


class DocumentRegistry:
    def __init__(
        self,
        max_documents: int = 25,
        max_total_extracted_text_bytes: int = 25 * 1024 * 1024,
        db_url: str | None = None,
    ) -> None:
        if max_documents < 1 or max_total_extracted_text_bytes < 1:
            raise ValueError("Document registry limits must be positive.")
        self._max_documents = max_documents
        self._max_total_extracted_text_bytes = max_total_extracted_text_bytes
        if db_url is None:
            sqlite_path = Path(gettempdir()) / f"finsight-registry-{uuid4().hex}.db"
            db_url = f"sqlite:///{sqlite_path}"
        self._engine = _engine_for_url(db_url)
        self._session_factory = sessionmaker(
            bind=self._engine,
            autoflush=False,
            expire_on_commit=False,
        )
        ensure_schema(self._engine)

    def add(self, document: DocumentRecord) -> None:
        document_text_bytes = len(document.extracted_text.encode("utf-8"))
        try:
            with self._session_factory() as session:
                if session.bind.dialect.name == "sqlite":
                    session.connection().exec_driver_sql("BEGIN IMMEDIATE")
                else:
                    session.begin()
                try:
                    existing = session.get(DocumentORM, document.document_id)
                    if existing is not None:
                        raise DocumentCapacityError(409, "Document ID is already registered.")
                    rows = session.execute(select(DocumentORM)).scalars().all()
                    if len(rows) >= self._max_documents:
                        raise DocumentCapacityError(
                            429,
                            f"Document registry is at its per-process limit of {self._max_documents} documents.",
                        )
                    registered_text_bytes = sum(
                        len(record.extracted_text.encode("utf-8")) for record in rows
                    )
                    if registered_text_bytes + document_text_bytes > self._max_total_extracted_text_bytes:
                        raise DocumentCapacityError(
                            413,
                            "Document registry has reached its per-process extracted-text capacity.",
                        )
                    session.add(
                        DocumentORM(
                            document_id=document.document_id,
                            owner_id=document.owner_id,
                            filename=document.filename,
                            page_count=document.page_count,
                            extracted_character_count=document.extracted_character_count,
                            extraction_status=document.extraction_status,
                            extracted_text=document.extracted_text,
                            content_type="application/pdf",
                            pdf_bytes=b"",
                        )
                    )
                    session.commit()
                except BaseException:
                    session.rollback()
                    raise
        except DocumentCapacityError:
            raise
        except SQLAlchemyError as exc:
            raise DocumentCapacityError(500, "Database registry is unavailable.") from exc

    def list(self) -> list[DocumentRecord]:
        try:
            with self._session_factory() as session:
                rows = session.execute(select(DocumentORM)).scalars().all()
                return [self._from_row(row) for row in rows]
        except SQLAlchemyError as exc:
            raise DocumentCapacityError(500, "Database registry is unavailable.") from exc

    def list_owned(self, owner_id: str) -> list[DocumentRecord]:
        try:
            with self._session_factory() as session:
                rows = session.execute(
                    select(DocumentORM).where(DocumentORM.owner_id == owner_id)
                ).scalars().all()
                return [self._from_row(row) for row in rows]
        except SQLAlchemyError as exc:
            raise DocumentCapacityError(500, "Database registry is unavailable.") from exc

    def get(self, document_id: str) -> DocumentRecord | None:
        normalized_id = self._normalize_id(document_id)
        if normalized_id is None:
            return None
        try:
            with self._session_factory() as session:
                row = session.get(DocumentORM, normalized_id)
                return None if row is None else self._from_row(row)
        except SQLAlchemyError as exc:
            raise DocumentCapacityError(500, "Database registry is unavailable.") from exc

    def get_owned(self, document_id: str, owner_id: str) -> DocumentRecord | None:
        normalized_id = self._normalize_id(document_id)
        if normalized_id is None:
            return None
        try:
            with self._session_factory() as session:
                row = session.get(DocumentORM, normalized_id)
                if row is None or row.owner_id != owner_id:
                    return None
                return self._from_row(row)
        except SQLAlchemyError as exc:
            raise DocumentCapacityError(500, "Database registry is unavailable.") from exc

    def delete(self, document_id: str) -> bool:
        normalized_id = self._normalize_id(document_id)
        if normalized_id is None:
            return False
        try:
            with self._session_factory() as session:
                with session.begin():
                    row = session.get(DocumentORM, normalized_id)
                    if row is None:
                        return False
                    session.delete(row)
                    return True
        except SQLAlchemyError as exc:
            raise DocumentCapacityError(500, "Database registry is unavailable.") from exc

    def delete_owned(self, document_id: str, owner_id: str) -> bool:
        normalized_id = self._normalize_id(document_id)
        if normalized_id is None:
            return False
        try:
            with self._session_factory() as session:
                with session.begin():
                    row = session.get(DocumentORM, normalized_id)
                    if row is None or row.owner_id != owner_id:
                        return False
                    session.delete(row)
                    return True
        except SQLAlchemyError as exc:
            raise DocumentCapacityError(500, "Database registry is unavailable.") from exc

    def clear(self) -> None:
        try:
            with self._session_factory() as session:
                with session.begin():
                    session.execute(delete(DocumentORM))
        except SQLAlchemyError as exc:
            raise DocumentCapacityError(500, "Database registry is unavailable.") from exc

    @staticmethod
    def _from_row(row: DocumentORM) -> DocumentRecord:
        return DocumentRecord(
            document_id=row.document_id,
            filename=row.filename,
            page_count=row.page_count,
            extracted_character_count=row.extracted_character_count,
            extraction_status=row.extraction_status,
            extracted_text=row.extracted_text,
            owner_id=row.owner_id,
        )

    @staticmethod
    def _normalize_id(document_id: str) -> str | None:
        try:
            return str(UUID(document_id))
        except (ValueError, AttributeError):
            return None


document_registry = DocumentRegistry(
    max_documents=settings.max_registered_documents,
    max_total_extracted_text_bytes=settings.max_total_extracted_text_bytes,
    db_url=settings.database_url,
)
