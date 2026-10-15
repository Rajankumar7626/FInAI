from __future__ import annotations

import os
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from backend.database import Base
from backend.document_registry import DocumentCapacityError, DocumentRecord, DocumentRegistry


TEST_OWNERS = (
    "auth0|pg-user-a",
    "auth0|pg-user-b",
    "auth0|pg-user-c",
)
QUOTA_TEST_SCHEMA = "finai_integration_quota_test"


def _postgres_url() -> str | None:
    return os.getenv("TEST_DATABASE_URL", "").strip() or None


def _skip_if_postgres_unavailable(database_url: str) -> None:
    engine = create_engine(database_url, future=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - environment-dependent guard
        pytest.skip(f"PostgreSQL test database is not reachable with the configured TEST_DATABASE_URL: {exc}")


def _cleanup_test_documents(engine, *, require_empty: bool = False) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "DELETE FROM documents WHERE owner_id IN (:owner_a, :owner_b, :owner_c)"
            ),
            {"owner_a": TEST_OWNERS[0], "owner_b": TEST_OWNERS[1], "owner_c": TEST_OWNERS[2]},
        )
        if require_empty:
            remaining = conn.execute(text("SELECT COUNT(*) FROM documents")).scalar_one()
            if remaining:
                raise AssertionError(
                    f"The isolated PostgreSQL quota-test schema contains {remaining} non-suite document(s)."
                )


@pytest.fixture()
def postgres_registry():
    database_url = _postgres_url()
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is not configured; PostgreSQL integration test is disabled.")

    _skip_if_postgres_unavailable(database_url)
    engine = create_engine(database_url, future=True)
    registry = DocumentRegistry(max_documents=3, max_total_extracted_text_bytes=512_000, db_url=database_url)
    try:
        _cleanup_test_documents(engine)
        yield registry
    finally:
        _cleanup_test_documents(engine)
        engine.dispose()
        registry._engine.dispose()


@pytest.fixture()
def postgres_quota_registry():
    database_url = _postgres_url()
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is not configured; PostgreSQL integration test is disabled.")

    _skip_if_postgres_unavailable(database_url)
    admin_engine = create_engine(database_url, future=True)
    with admin_engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{QUOTA_TEST_SCHEMA}"'))

    parsed_url = make_url(database_url)
    quota_url = parsed_url.set(
        query={**parsed_url.query, "options": f"-csearch_path={QUOTA_TEST_SCHEMA}"}
    )
    quota_engine = create_engine(quota_url, future=True)
    Base.metadata.create_all(bind=quota_engine)
    registry = DocumentRegistry(
        max_documents=3,
        max_total_extracted_text_bytes=512_000,
        db_url=quota_url.render_as_string(hide_password=False),
    )
    try:
        _cleanup_test_documents(quota_engine, require_empty=True)
        yield registry
    finally:
        _cleanup_test_documents(quota_engine, require_empty=True)
        quota_engine.dispose()
        admin_engine.dispose()


@pytest.fixture()
def postgres_engine():
    database_url = _postgres_url()
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is not configured; PostgreSQL integration test is disabled.")
    _skip_if_postgres_unavailable(database_url)
    engine = create_engine(database_url, future=True)
    try:
        _cleanup_test_documents(engine)
        yield engine
    finally:
        _cleanup_test_documents(engine)
        engine.dispose()


def _record(prefix: str, text: str, owner: str = TEST_OWNERS[0]) -> DocumentRecord:
    return DocumentRecord(
        document_id=str(uuid4()),
        filename=f"{prefix}.pdf",
        page_count=1,
        extracted_character_count=len(text),
        extraction_status="completed",
        extracted_text=text,
        owner_id=owner,
    )


def test_postgres_migration_head_is_applied(postgres_engine):
    with postgres_engine.connect() as conn:
        result = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
    assert result, "PostgreSQL test database must have an Alembic version row."


def test_postgres_documents_persist_and_are_owner_scoped(postgres_registry):
    record_a = _record("a", "Revenue: USD 100 million", owner=TEST_OWNERS[0])
    record_b = _record("b", "Revenue: USD 200 million", owner=TEST_OWNERS[1])

    postgres_registry.add(record_a)
    postgres_registry.add(record_b)

    user_a_docs = postgres_registry.list_owned(TEST_OWNERS[0])
    user_b_docs = postgres_registry.list_owned(TEST_OWNERS[1])

    assert [item.document_id for item in user_a_docs] == [record_a.document_id]
    assert [item.document_id for item in user_b_docs] == [record_b.document_id]
    assert postgres_registry.get_owned(record_a.document_id, TEST_OWNERS[1]) is None
    assert postgres_registry.get_owned(record_b.document_id, TEST_OWNERS[0]) is None


def test_postgres_delete_and_quota_enforcement(postgres_quota_registry):
    assert postgres_quota_registry.list() == []
    first = _record("first", "Revenue: USD 100 million", owner=TEST_OWNERS[0])
    second = _record("second", "Revenue: USD 200 million", owner=TEST_OWNERS[0])
    third = _record("third", "Revenue: USD 300 million", owner=TEST_OWNERS[0])
    fourth = _record("fourth", "Revenue: USD 400 million", owner=TEST_OWNERS[0])

    postgres_quota_registry.add(first)
    postgres_quota_registry.add(second)
    postgres_quota_registry.add(third)

    with pytest.raises(DocumentCapacityError):
        postgres_quota_registry.add(fourth)

    assert postgres_quota_registry.delete_owned(first.document_id, TEST_OWNERS[0]) is True
    postgres_quota_registry.add(fourth)

    assert postgres_quota_registry.get_owned(first.document_id, TEST_OWNERS[0]) is None
    assert postgres_quota_registry.get_owned(fourth.document_id, TEST_OWNERS[0]).document_id == fourth.document_id
