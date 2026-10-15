from __future__ import annotations

import os
from dataclasses import dataclass, field


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "FinSight AI"
    app_version: str = "0.1.0"
    app_description: str = "Minimal backend foundation for FinSight AI."
    debug: bool = False
    host: str = "127.0.0.1"
    port: int = 8000
    max_upload_size_bytes: int = 10 * 1024 * 1024
    upload_chunk_size_bytes: int = 64 * 1024
    upload_request_overhead_bytes: int = 256 * 1024
    max_concurrent_uploads: int = 10
    max_document_pages: int = 100
    max_extracted_characters: int = 1_000_000
    max_registered_documents: int = 25
    max_total_extracted_text_bytes: int = 25 * 1024 * 1024
    auth0_domain: str = ""
    auth0_audience: str = ""
    database_url: str = "sqlite:///./finsight_local.db"
    database_echo: bool = False
    cors_origins: list[str] = field(
        default_factory=lambda: [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:4173",
            "http://localhost:4173",
        ]
    )

    @classmethod
    def from_env(cls) -> "Settings":
        configured_origins = _split_csv(os.getenv("CORS_ORIGINS"))
        debug_value = os.getenv("APP_DEBUG", "false").strip().lower()
        port_value = os.getenv("BACKEND_PORT", "8000").strip()

        def positive_int(name: str, default: int) -> int:
            value = os.getenv(name, str(default)).strip()
            return int(value) if value.isdigit() and int(value) > 0 else default

        return cls(
            app_name=os.getenv("APP_NAME", "FinSight AI"),
            app_version=os.getenv("APP_VERSION", "0.1.0"),
            app_description=os.getenv(
                "APP_DESCRIPTION",
                "Minimal backend foundation for FinSight AI.",
            ),
            debug=debug_value in {"1", "true", "yes", "on"},
            host=os.getenv("BACKEND_HOST", "127.0.0.1"),
            port=int(port_value) if port_value.isdigit() else 8000,
            max_upload_size_bytes=positive_int(
                "MAX_UPLOAD_SIZE_BYTES",
                10 * 1024 * 1024,
            ),
            upload_chunk_size_bytes=positive_int("UPLOAD_CHUNK_SIZE_BYTES", 64 * 1024),
            upload_request_overhead_bytes=positive_int(
                "UPLOAD_REQUEST_OVERHEAD_BYTES",
                256 * 1024,
            ),
            max_concurrent_uploads=positive_int("MAX_CONCURRENT_UPLOADS", 10),
            max_document_pages=positive_int("MAX_DOCUMENT_PAGES", 100),
            max_extracted_characters=positive_int(
                "MAX_EXTRACTED_CHARACTERS",
                1_000_000,
            ),
            max_registered_documents=positive_int("MAX_REGISTERED_DOCUMENTS", 25),
            max_total_extracted_text_bytes=positive_int(
                "MAX_TOTAL_EXTRACTED_TEXT_BYTES",
                25 * 1024 * 1024,
            ),
            auth0_domain=os.getenv("AUTH0_DOMAIN", "").strip().removeprefix("https://").rstrip("/"),
            auth0_audience=os.getenv("AUTH0_AUDIENCE", "").strip(),
            database_url=os.getenv("DATABASE_URL", "sqlite:///./finsight_local.db").strip(),
            database_echo=os.getenv("DATABASE_ECHO", "false").strip().lower() in {"1", "true", "yes", "on"},
            cors_origins=configured_origins or cls().cors_origins,
        )

    @property
    def max_upload_request_size_bytes(self) -> int:
        return self.max_upload_size_bytes + self.upload_request_overhead_bytes


settings = Settings.from_env()
