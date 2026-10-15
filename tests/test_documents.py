from __future__ import annotations

import asyncio
from io import BytesIO
from pathlib import Path
from collections.abc import Generator

from fastapi import UploadFile
from fastapi.testclient import TestClient
import pytest
from pypdf import PdfWriter
from pypdf.generic import (
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
)

from backend.api import app
from backend.config import Settings, settings
from backend.document_service import DocumentProcessingError, process_document
from backend.document_registry import DocumentRegistry, document_registry

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_documents() -> Generator[None, None, None]:
    document_registry.clear()
    yield
    document_registry.clear()


def make_text_pdf(text: str = "Revenue increased to 100.", pages: int = 1) -> bytes:
    writer = PdfWriter()
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )

    for _ in range(pages):
        page = writer.add_blank_page(width=300, height=300)
        resources = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
        )
        page[NameObject("/Resources")] = resources
        content = DecodedStreamObject()
        escaped_text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        content.set_data(f"BT /F1 12 Tf 20 250 Td ({escaped_text}) Tj ET".encode())
        page[NameObject("/Contents")] = content

    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def make_blank_pdf(pages: int = 1) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=300, height=300)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_upload_extracts_text_and_returns_stable_schema() -> None:
    response = client.post(
        "/documents/upload",
        files={"file": ("report.pdf", make_text_pdf(), "application/pdf")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert set(payload) == {
        "document_id",
        "filename",
        "page_count",
        "extracted_character_count",
        "extraction_status",
        "extracted_text",
    }
    assert payload["filename"] == "report.pdf"
    assert payload["page_count"] == 1
    assert payload["extracted_character_count"] == len(payload["extracted_text"])
    assert payload["extraction_status"] == "completed"
    assert "Revenue increased" in payload["extracted_text"]


def test_upload_rejects_empty_file_with_structured_error() -> None:
    response = client.post(
        "/documents/upload",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Uploaded file is empty."}


def test_upload_rejects_non_pdf_content() -> None:
    response = client.post(
        "/documents/upload",
        files={"file": ("report.pdf", b"not a pdf", "application/pdf")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Uploaded file is not a valid PDF."}


def test_upload_rejects_malformed_pdf() -> None:
    response = client.post(
        "/documents/upload",
        files={"file": ("broken.pdf", b"%PDF-1.7\nmissing cross reference", "application/pdf")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Uploaded file is not a valid PDF."}


def test_upload_rejects_oversized_file() -> None:
    response = client.post(
        "/documents/upload",
        files={
            "file": (
                "large.pdf",
                b"x" * (settings.max_upload_size_bytes + 1),
                "application/pdf",
            )
        },
    )

    assert response.status_code == 413
    assert response.json() == {
        "detail": "Uploaded file exceeds the 10 MiB limit."
    }


def test_early_request_limit_returns_cors_readable_413() -> None:
    response = client.post(
        "/documents/upload",
        content=b"x" * (settings.max_upload_request_size_bytes + 1),
        headers={"Origin": "http://127.0.0.1:5173"},
    )

    assert response.status_code == 413
    assert response.json()["detail"]
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_upload_rejects_pdf_without_extractable_text() -> None:
    response = client.post(
        "/documents/upload",
        files={"file": ("scan.pdf", make_blank_pdf(), "application/pdf")},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "PDF contains no extractable text. Scanned-image OCR is not supported."
    }


def test_upload_rejects_pdf_above_page_limit() -> None:
    response = client.post(
        "/documents/upload",
        files={"file": ("many-pages.pdf", make_blank_pdf(pages=101), "application/pdf")},
    )

    assert response.status_code == 413
    assert response.json() == {"detail": "PDF exceeds the 100-page limit."}


def test_text_limit_is_enforced_before_returning_text(monkeypatch) -> None:
    import backend.document_service as document_service

    created_paths: list[Path] = []
    original = document_service.tempfile.NamedTemporaryFile

    def tracked_named_temporary_file(*args, **kwargs):
        temporary_file = original(*args, **kwargs)
        created_paths.append(Path(temporary_file.name))
        return temporary_file

    monkeypatch.setattr(document_service.tempfile, "NamedTemporaryFile", tracked_named_temporary_file)
    upload = UploadFile(file=BytesIO(make_text_pdf("A" * 50)), filename="report.pdf")
    upload_handle = upload.file
    config = Settings(max_extracted_characters=10)

    with pytest.raises(DocumentProcessingError, match="character limit"):
        asyncio.run(process_document(upload, config))

    assert upload_handle.closed
    assert created_paths and all(not path.exists() for path in created_paths)


def test_temporary_upload_file_is_cleaned_up(monkeypatch) -> None:
    import backend.document_service as document_service

    created_paths: list[Path] = []
    original = document_service.tempfile.NamedTemporaryFile

    def tracked_named_temporary_file(*args, **kwargs):
        temporary_file = original(*args, **kwargs)
        created_paths.append(Path(temporary_file.name))
        return temporary_file

    monkeypatch.setattr(
        document_service.tempfile,
        "NamedTemporaryFile",
        tracked_named_temporary_file,
    )

    response = client.post(
        "/documents/upload",
        files={"file": ("report.pdf", make_text_pdf(), "application/pdf")},
    )

    assert response.status_code == 201
    assert created_paths
    assert all(not path.exists() for path in created_paths)


def test_parser_failure_closes_upload_and_removes_temporary_file(monkeypatch) -> None:
    import backend.document_service as document_service

    created_paths: list[Path] = []
    original = document_service.tempfile.NamedTemporaryFile

    def tracked_named_temporary_file(*args, **kwargs):
        temporary_file = original(*args, **kwargs)
        created_paths.append(Path(temporary_file.name))
        return temporary_file

    monkeypatch.setattr(document_service.tempfile, "NamedTemporaryFile", tracked_named_temporary_file)
    upload = UploadFile(file=BytesIO(b"not a PDF"), filename="malformed.pdf")
    upload_handle = upload.file

    with pytest.raises(DocumentProcessingError, match="not a valid PDF"):
        asyncio.run(process_document(upload))

    assert upload_handle.closed
    assert created_paths and all(not path.exists() for path in created_paths)


def test_original_parser_error_is_not_masked_by_upload_close_error(monkeypatch) -> None:
    import backend.document_service as document_service

    created_paths: list[Path] = []
    original = document_service.tempfile.NamedTemporaryFile

    def tracked_named_temporary_file(*args, **kwargs):
        temporary_file = original(*args, **kwargs)
        created_paths.append(Path(temporary_file.name))
        return temporary_file

    class CloseFailingUpload(UploadFile):
        async def close(self) -> None:
            await super().close()
            raise OSError("synthetic close failure")

    monkeypatch.setattr(document_service.tempfile, "NamedTemporaryFile", tracked_named_temporary_file)
    upload = CloseFailingUpload(file=BytesIO(b"not a PDF"), filename="malformed.pdf")

    with pytest.raises(DocumentProcessingError, match="not a valid PDF"):
        asyncio.run(process_document(upload))

    assert created_paths and all(not path.exists() for path in created_paths)


def test_size_rejection_closes_upload_and_removes_temporary_file(monkeypatch) -> None:
    import backend.document_service as document_service

    created_paths: list[Path] = []
    original = document_service.tempfile.NamedTemporaryFile

    def tracked_named_temporary_file(*args, **kwargs):
        temporary_file = original(*args, **kwargs)
        created_paths.append(Path(temporary_file.name))
        return temporary_file

    monkeypatch.setattr(document_service.tempfile, "NamedTemporaryFile", tracked_named_temporary_file)
    upload = UploadFile(file=BytesIO(b"oversized"), filename="large.pdf")
    upload_handle = upload.file
    config = Settings(max_upload_size_bytes=4, upload_chunk_size_bytes=2)

    with pytest.raises(DocumentProcessingError, match="Uploaded file exceeds"):
        asyncio.run(process_document(upload, config))

    assert upload_handle.closed
    assert created_paths and all(not path.exists() for path in created_paths)


def test_page_limit_rejection_closes_upload_and_removes_temporary_file(monkeypatch) -> None:
    import backend.document_service as document_service

    created_paths: list[Path] = []
    original = document_service.tempfile.NamedTemporaryFile

    def tracked_named_temporary_file(*args, **kwargs):
        temporary_file = original(*args, **kwargs)
        created_paths.append(Path(temporary_file.name))
        return temporary_file

    monkeypatch.setattr(document_service.tempfile, "NamedTemporaryFile", tracked_named_temporary_file)
    upload = UploadFile(file=BytesIO(make_blank_pdf(pages=2)), filename="many.pdf")
    upload_handle = upload.file

    with pytest.raises(DocumentProcessingError, match="1-page limit"):
        asyncio.run(process_document(upload, Settings(max_document_pages=1)))

    assert upload_handle.closed
    assert created_paths and all(not path.exists() for path in created_paths)


def test_cancelled_upload_closes_handle_and_removes_temporary_file(monkeypatch) -> None:
    import backend.document_service as document_service

    created_paths: list[Path] = []
    original = document_service.tempfile.NamedTemporaryFile
    read_started: asyncio.Event

    def tracked_named_temporary_file(*args, **kwargs):
        temporary_file = original(*args, **kwargs)
        created_paths.append(Path(temporary_file.name))
        return temporary_file

    class BlockingUpload(UploadFile):
        async def read(self, size: int = -1) -> bytes:
            read_started.set()
            await asyncio.Future()

    monkeypatch.setattr(document_service.tempfile, "NamedTemporaryFile", tracked_named_temporary_file)
    upload = BlockingUpload(file=BytesIO(b"synthetic"), filename="pending.pdf")
    upload_handle = upload.file

    async def cancel_processing() -> None:
        nonlocal read_started
        read_started = asyncio.Event()
        task = asyncio.create_task(process_document(upload))
        await read_started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(cancel_processing())

    assert upload_handle.closed
    assert created_paths and all(not path.exists() for path in created_paths)


def test_health_endpoint_regression() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "finsight-ai"}


def upload_document(filename: str, text: str) -> dict[str, object]:
    response = client.post(
        "/documents/upload",
        files={"file": (filename, make_text_pdf(text), "application/pdf")},
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.parametrize(
    ("limited_registry", "second_text", "expected_status"),
    [
        (DocumentRegistry(max_documents=1, max_total_extracted_text_bytes=1000), "Second", 429),
        (DocumentRegistry(max_documents=5, max_total_extracted_text_bytes=5), "X", 413),
    ],
)
def test_upload_capacity_rejection_is_structured_and_cleans_temporary_file(
    monkeypatch,
    limited_registry: DocumentRegistry,
    second_text: str,
    expected_status: int,
) -> None:
    import backend.api as api_module
    import backend.document_service as document_service

    created_paths: list[Path] = []
    original = document_service.tempfile.NamedTemporaryFile

    def tracked_named_temporary_file(*args, **kwargs):
        temporary_file = original(*args, **kwargs)
        created_paths.append(Path(temporary_file.name))
        return temporary_file

    monkeypatch.setattr(api_module, "document_registry", limited_registry)
    monkeypatch.setattr(document_service.tempfile, "NamedTemporaryFile", tracked_named_temporary_file)

    first_response = client.post(
        "/documents/upload",
        files={"file": ("first.pdf", make_text_pdf("First"), "application/pdf")},
    )
    assert first_response.status_code == 201
    first_id = first_response.json()["document_id"]

    rejected_response = client.post(
        "/documents/upload",
        files={"file": ("second.pdf", make_text_pdf(second_text), "application/pdf")},
    )

    assert rejected_response.status_code == expected_status
    assert rejected_response.json()["detail"]
    assert [document.document_id for document in limited_registry.list()] == [first_id]
    assert created_paths and all(not path.exists() for path in created_paths)


def test_list_documents_is_empty_before_uploads() -> None:
    response = client.get("/documents")

    assert response.status_code == 200
    assert response.json() == []


def test_list_documents_returns_metadata_without_extracted_text() -> None:
    first = upload_document("first.pdf", "First document")
    second = upload_document("second.pdf", "Second document")

    response = client.get("/documents")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 2
    assert {item["document_id"] for item in payload} == {
        first["document_id"],
        second["document_id"],
    }
    assert all(set(item) == {
        "document_id",
        "filename",
        "page_count",
        "extracted_character_count",
        "extraction_status",
    } for item in payload)
    assert all("extracted_text" not in item for item in payload)


def test_get_document_returns_metadata() -> None:
    uploaded = upload_document("report.pdf", "Metadata document")

    response = client.get(f"/documents/{uploaded['document_id']}")

    assert response.status_code == 200
    assert response.json() == {
        "document_id": uploaded["document_id"],
        "filename": "report.pdf",
        "page_count": 1,
        "extracted_character_count": len("Metadata document"),
        "extraction_status": "completed",
    }


def test_get_document_text_returns_text_and_metadata() -> None:
    uploaded = upload_document("report.pdf", "Text document")

    response = client.get(f"/documents/{uploaded['document_id']}/text")

    assert response.status_code == 200
    assert response.json()["extracted_text"] == "Text document"
    assert response.json()["document_id"] == uploaded["document_id"]


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/documents/not-a-uuid"),
        ("get", "/documents/not-a-uuid/text"),
        ("delete", "/documents/not-a-uuid"),
    ],
)
def test_unknown_document_returns_structured_404(method: str, path: str) -> None:
    response = getattr(client, method)(path)

    assert response.status_code == 404
    assert response.json() == {"detail": "Document not found."}


def test_delete_document_removes_it_from_registry() -> None:
    uploaded = upload_document("report.pdf", "Delete document")
    document_id = uploaded["document_id"]

    response = client.delete(f"/documents/{document_id}")

    assert response.status_code == 200
    assert response.json() == {"document_id": document_id, "deleted": True}
    assert client.get("/documents").json() == []
    assert client.get(f"/documents/{document_id}").status_code == 404
    assert client.get(f"/documents/{document_id}/text").status_code == 404
    assert client.delete(f"/documents/{document_id}").status_code == 404


@pytest.mark.parametrize(
    ("registry", "second_text", "expected_status"),
    [
        (DocumentRegistry(max_documents=1, max_total_extracted_text_bytes=10_000), "Second", 429),
        (DocumentRegistry(max_documents=5, max_total_extracted_text_bytes=5), "X", 413),
    ],
)
def test_upload_capacity_rejection_is_structured_and_cleans_temporary_file(
    monkeypatch,
    registry: DocumentRegistry,
    second_text: str,
    expected_status: int,
) -> None:
    import backend.api as api_module
    import backend.document_service as document_service

    created_paths: list[Path] = []
    original = document_service.tempfile.NamedTemporaryFile

    def tracked_named_temporary_file(*args, **kwargs):
        temporary_file = original(*args, **kwargs)
        created_paths.append(Path(temporary_file.name))
        return temporary_file

    monkeypatch.setattr(api_module, "document_registry", registry)
    monkeypatch.setattr(document_service.tempfile, "NamedTemporaryFile", tracked_named_temporary_file)

    first_response = client.post(
        "/documents/upload",
        files={"file": ("first.pdf", make_text_pdf("First"), "application/pdf")},
    )
    assert first_response.status_code == 201
    first_document_id = first_response.json()["document_id"]

    rejected_response = client.post(
        "/documents/upload",
        files={"file": ("second.pdf", make_text_pdf(second_text), "application/pdf")},
    )

    assert rejected_response.status_code == expected_status
    assert rejected_response.json()["detail"]
    assert [document.document_id for document in registry.list()] == [first_document_id]
    assert created_paths and all(not path.exists() for path in created_paths)
