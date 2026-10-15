from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import QueuePool

from backend.config import settings


class Base(DeclarativeBase):
    pass


class DocumentORM(Base):
    __tablename__ = "documents"

    document_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    page_count: Mapped[int] = mapped_column(nullable=False)
    extracted_character_count: Mapped[int] = mapped_column(nullable=False)
    extraction_status: Mapped[str] = mapped_column(String(64), nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), default="application/pdf", nullable=False)
    pdf_bytes: Mapped[bytes | None] = mapped_column(nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


def _engine_for_url(database_url: str | None = None):
    url = (database_url or settings.database_url).strip()
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
        return create_engine(
            url,
            echo=settings.database_echo,
            future=True,
            connect_args=connect_args,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=10,
        )
    return create_engine(url, echo=settings.database_echo, future=True, connect_args=connect_args)


engine = _engine_for_url()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


def ensure_schema(database_url_or_engine: str | object | None = None) -> None:
    if hasattr(database_url_or_engine, "connect"):
        engine = database_url_or_engine
    else:
        url = (database_url_or_engine or settings.database_url).strip()
        if not url.startswith("sqlite"):
            return
        engine = _engine_for_url(url)
    Base.metadata.create_all(bind=engine)


def get_db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
