from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest

from backend.config import Settings
from backend.document_registry import DocumentCapacityError, DocumentRecord, DocumentRegistry


def record(text: str) -> DocumentRecord:
    return DocumentRecord(
        document_id=str(uuid4()),
        filename="synthetic.pdf",
        page_count=1,
        extracted_character_count=len(text),
        extraction_status="completed",
        extracted_text=text,
        owner_id="test-owner",
    )


def test_upload_and_registry_limits_are_configurable(monkeypatch) -> None:
    monkeypatch.setenv("MAX_UPLOAD_SIZE_BYTES", "200")
    monkeypatch.setenv("UPLOAD_REQUEST_OVERHEAD_BYTES", "30")
    monkeypatch.setenv("MAX_REGISTERED_DOCUMENTS", "7")
    monkeypatch.setenv("MAX_TOTAL_EXTRACTED_TEXT_BYTES", "900")
    monkeypatch.setenv("MAX_CONCURRENT_UPLOADS", "3")
    monkeypatch.setenv("AUTH0_DOMAIN", "finsight-test.auth0.com")
    monkeypatch.setenv("AUTH0_AUDIENCE", "https://api.finsight-test.local")

    settings = Settings.from_env()

    assert settings.max_upload_size_bytes == 200
    assert settings.max_upload_request_size_bytes == 230
    assert settings.max_registered_documents == 7
    assert settings.max_total_extracted_text_bytes == 900
    assert settings.max_concurrent_uploads == 3
    assert settings.auth0_domain == "finsight-test.auth0.com"
    assert settings.auth0_audience == "https://api.finsight-test.local"
    assert Settings().max_concurrent_uploads == 10


def test_document_count_quota_rejects_without_evicting_existing_record() -> None:
    registry = DocumentRegistry(max_documents=1, max_total_extracted_text_bytes=100)
    existing = record("existing")
    rejected = record("new")
    registry.add(existing)

    with pytest.raises(DocumentCapacityError) as error:
        registry.add(rejected)

    assert error.value.status_code == 429
    assert registry.list() == [existing]
    assert registry.get(rejected.document_id) is None


def test_aggregate_quota_counts_utf8_bytes_and_does_not_partially_register() -> None:
    registry = DocumentRegistry(max_documents=5, max_total_extracted_text_bytes=4)
    existing = record("éé")
    rejected = record("x")
    registry.add(existing)

    with pytest.raises(DocumentCapacityError) as error:
        registry.add(rejected)

    assert error.value.status_code == 413
    assert len(existing.extracted_text.encode("utf-8")) == 4
    assert registry.list() == [existing]
    assert registry.get(rejected.document_id) is None


def test_concurrent_registrations_never_exceed_document_quota() -> None:
    registry = DocumentRegistry(max_documents=4, max_total_extracted_text_bytes=1000)
    start = Barrier(16)

    def attempt_registration(_: int) -> bool:
        document = record("synthetic text")
        start.wait()
        try:
            registry.add(document)
            return True
        except DocumentCapacityError:
            return False

    with ThreadPoolExecutor(max_workers=16) as executor:
        outcomes = list(executor.map(attempt_registration, range(16)))

    assert sum(outcomes) == 4
    assert len(registry.list()) == 4
