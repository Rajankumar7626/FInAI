from __future__ import annotations

import tempfile
import sys
from pathlib import Path
from typing import Final
from uuid import uuid4

from fastapi import UploadFile
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from backend.config import Settings, settings


class DocumentProcessingError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


TEMP_FILE_SUFFIX: Final[str] = ".pdf"


async def process_document(
    upload: UploadFile,
    config: Settings = settings,
) -> dict[str, object]:
    original_filename = upload.filename or "unnamed.pdf"
    temporary_path: Path | None = None
    total_bytes = 0

    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            suffix=TEMP_FILE_SUFFIX,
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)

            while True:
                chunk = await upload.read(config.upload_chunk_size_bytes)
                if not chunk:
                    break

                total_bytes += len(chunk)
                if total_bytes > config.max_upload_size_bytes:
                    raise DocumentProcessingError(
                        413,
                        f"Uploaded file exceeds the {config.max_upload_size_bytes // (1024 * 1024)} MiB limit.",
                    )
                temporary_file.write(chunk)

        if total_bytes == 0:
            raise DocumentProcessingError(400, "Uploaded file is empty.")

        try:
            reader = PdfReader(str(temporary_path), strict=True)
        except (PdfReadError, OSError, ValueError):
            raise DocumentProcessingError(400, "Uploaded file is not a valid PDF.") from None

        if reader.is_encrypted:
            raise DocumentProcessingError(422, "Encrypted PDFs are not supported.")

        page_count = len(reader.pages)
        if page_count > config.max_document_pages:
            raise DocumentProcessingError(
                413,
                f"PDF exceeds the {config.max_document_pages}-page limit.",
            )

        text_parts: list[str] = []
        extracted_character_count = 0
        for page in reader.pages:
            try:
                page_text = page.extract_text() or ""
            except (PdfReadError, ValueError):
                raise DocumentProcessingError(
                    422,
                    "PDF text extraction failed.",
                ) from None

            extracted_character_count += len(page_text)
            if extracted_character_count > config.max_extracted_characters:
                raise DocumentProcessingError(
                    413,
                    f"Extracted text exceeds the {config.max_extracted_characters:,}-character limit.",
                )
            text_parts.append(page_text)

        extracted_text = "\n".join(text_parts).strip()
        if not extracted_text:
            raise DocumentProcessingError(
                422,
                "PDF contains no extractable text. Scanned-image OCR is not supported.",
            )

        return {
            "document_id": str(uuid4()),
            "filename": original_filename,
            "page_count": page_count,
            "extracted_character_count": len(extracted_text),
            "extraction_status": "completed",
            "extracted_text": extracted_text,
        }
    finally:
        active_exception = sys.exception()
        cleanup_error: BaseException | None = None
        try:
            await upload.close()
        except BaseException as exc:
            cleanup_error = exc
        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except BaseException as exc:
                if cleanup_error is None:
                    cleanup_error = exc
        if active_exception is None and cleanup_error is not None:
            raise cleanup_error
