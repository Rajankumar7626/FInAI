from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
import pytest

import backend.auth as auth
from backend.api import app
from backend.auth import Principal, get_current_principal
from backend.config import Settings
from backend.document_registry import document_registry
from tests.test_documents import make_text_pdf


client = TestClient(app)
AUTH_ISSUER = "https://finsight-test.auth0.com/"
AUTH_AUDIENCE = "https://api.finsight-test.local"


@pytest.fixture(autouse=True)
def use_real_authentication() -> Generator[None, None, None]:
    existing_override = app.dependency_overrides.pop(get_current_principal, None)
    document_registry.clear()
    yield
    document_registry.clear()
    if existing_override is not None:
        app.dependency_overrides[get_current_principal] = existing_override


@pytest.fixture
def signing_keys(monkeypatch: pytest.MonkeyPatch) -> dict[str, object]:
    private_a = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_b = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_keys = {"key-a": private_a.public_key(), "key-b": private_b.public_key()}

    class FakeJwksClient:
        def get_signing_key_from_jwt(self, token: str) -> SimpleNamespace:
            kid = jwt.get_unverified_header(token)["kid"]
            return SimpleNamespace(key=public_keys[kid])

    monkeypatch.setattr(auth, "_jwks_client", lambda _: FakeJwksClient())
    monkeypatch.setattr(
        auth,
        "settings",
        Settings(auth0_domain="finsight-test.auth0.com", auth0_audience=AUTH_AUDIENCE),
    )
    return {"key-a": private_a, "key-b": private_b}


def access_token(
    private_key: object,
    *,
    kid: str = "key-a",
    subject: str = "auth0|user-a",
    audience: str = AUTH_AUDIENCE,
    issuer: str = AUTH_ISSUER,
    expires: datetime | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "iss": issuer,
        "aud": audience,
        "sub": subject,
        "iat": now - timedelta(seconds=1),
        "exp": expires or now + timedelta(minutes=5),
    }
    return jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": kid})


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def upload(
    token: str,
    filename: str,
    text: str,
    *,
    requested_owner: str | None = None,
) -> dict[str, object]:
    response = client.post(
        "/documents/upload",
        headers=auth_header(token),
        data={"owner_id": requested_owner} if requested_owner is not None else None,
        files={"file": (filename, make_text_pdf(text), "application/pdf")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_health_is_public_but_document_endpoints_require_credentials() -> None:
    assert client.get("/health").status_code == 200
    document_id = "00000000-0000-0000-0000-000000000001"
    documents_without_auth = client.get("/documents")
    unauthenticated_requests = (
        documents_without_auth,
        client.post(
            "/documents/upload",
            files={"file": ("report.pdf", make_text_pdf(), "application/pdf")},
        ),
        client.get(f"/documents/{document_id}"),
        client.get(f"/documents/{document_id}/text"),
        client.post(f"/documents/{document_id}/financial-data"),
        client.post(f"/documents/{document_id}/risk-analysis"),
        client.post(
            "/documents/compare",
            json={"first_document_id": document_id, "second_document_id": document_id},
        ),
        client.post("/reports/generate", json={"first_document_id": document_id}),
        client.delete(f"/documents/{document_id}"),
    )
    assert [response.status_code for response in unauthenticated_requests] == [401] * 9
    assert documents_without_auth.headers["www-authenticate"] == "Bearer"


def test_rejects_invalid_signature_expired_wrong_audience_and_wrong_issuer(signing_keys) -> None:
    private_a = signing_keys["key-a"]
    private_b = signing_keys["key-b"]
    valid = access_token(private_a)
    invalid_signature = access_token(private_b, kid="key-a")
    expired = access_token(private_a, expires=datetime.now(timezone.utc) - timedelta(minutes=1))
    wrong_audience = access_token(private_a, audience="https://another-api.local")
    wrong_issuer = access_token(private_a, issuer="https://another-tenant.auth0.com/")
    valid_claims = jwt.decode(valid, options={"verify_signature": False})
    missing_subject_claims = dict(valid_claims)
    del missing_subject_claims["sub"]
    missing_subject = jwt.encode(
        missing_subject_claims,
        private_a,
        algorithm="RS256",
        headers={"kid": "key-a"},
    )

    for token in (
        invalid_signature,
        expired,
        wrong_audience,
        wrong_issuer,
        missing_subject,
        "not-a-jwt",
    ):
        response = client.get("/documents", headers=auth_header(token))
        assert response.status_code == 401

    assert client.get("/documents", headers=auth_header(valid)).status_code == 200


def test_presented_token_is_not_accepted_when_provider_configuration_is_missing(
    signing_keys,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth, "settings", Settings())
    token = access_token(signing_keys["key-a"])
    response = client.get("/documents", headers=auth_header(token))
    assert response.status_code == 503
    assert "AUTH0_DOMAIN and AUTH0_AUDIENCE" in response.json()["detail"]


def test_users_can_upload_and_read_only_their_own_documents(signing_keys) -> None:
    token_a = access_token(signing_keys["key-a"], subject="auth0|user-a")
    token_b = access_token(signing_keys["key-a"], subject="auth0|user-b")
    document_a = upload(
        token_a,
        "a.pdf",
        "User A private revenue: USD 100 million",
        requested_owner="auth0|user-b",
    )
    document_b = upload(token_b, "b.pdf", "User B private revenue: USD 200 million")
    assert "owner_id" not in document_a

    listed_a = client.get(
        "/documents",
        headers={**auth_header(token_a), "X-User-ID": "auth0|user-b"},
    ).json()
    assert [item["document_id"] for item in listed_a] == [document_a["document_id"]]
    assert client.get(f"/documents/{document_a['document_id']}", headers=auth_header(token_a)).status_code == 200
    assert "User A private" in client.get(
        f"/documents/{document_a['document_id']}/text", headers=auth_header(token_a)
    ).json()["extracted_text"]
    financial_data = client.post(
        f"/documents/{document_a['document_id']}/financial-data", headers=auth_header(token_a)
    )
    risk_data = client.post(
        f"/documents/{document_a['document_id']}/risk-analysis", headers=auth_header(token_a)
    )
    assert financial_data.status_code == risk_data.status_code == 200

    document_a2 = upload(token_a, "a-second.pdf", "Revenue for 2024: USD 150 million")
    comparison = client.post(
        "/documents/compare",
        headers=auth_header(token_a),
        json={"first_document_id": document_a["document_id"], "second_document_id": document_a2["document_id"]},
    )
    report = client.post(
        "/reports/generate",
        headers=auth_header(token_a),
        json={"first_document_id": document_a["document_id"], "second_document_id": document_a2["document_id"]},
    )
    assert comparison.status_code == report.status_code == 200
    assert client.delete(
        f"/documents/{document_a2['document_id']}", headers=auth_header(token_a)
    ).status_code == 200

    for endpoint in (
        f"/documents/{document_b['document_id']}",
        f"/documents/{document_b['document_id']}/text",
    ):
        response = client.get(endpoint, headers=auth_header(token_a))
        assert response.status_code == 404
        assert response.json() == {"detail": "Document not found."}

    assert client.get("/documents", headers=auth_header(token_b)).json()[0]["document_id"] == document_b["document_id"]


def test_nonowners_cannot_analyze_compare_report_or_delete(signing_keys) -> None:
    token_a = access_token(signing_keys["key-a"], subject="auth0|user-a")
    token_b = access_token(signing_keys["key-a"], subject="auth0|user-b")
    owned = upload(token_a, "owned.pdf", "Revenue for 2024: USD 100 million")
    foreign = upload(token_b, "foreign.pdf", "Revenue for 2024: USD 999 million")
    foreign_id = foreign["document_id"]

    for path in (f"/documents/{foreign_id}/financial-data", f"/documents/{foreign_id}/risk-analysis"):
        response = client.post(path, headers=auth_header(token_a))
        assert response.status_code == 404
        assert "foreign.pdf" not in response.text

    compare = client.post(
        "/documents/compare",
        headers=auth_header(token_a),
        json={"first_document_id": owned["document_id"], "second_document_id": foreign_id},
    )
    report = client.post(
        "/reports/generate",
        headers=auth_header(token_a),
        json={"first_document_id": owned["document_id"], "second_document_id": foreign_id},
    )
    assert compare.status_code == report.status_code == 404
    assert "999 million" not in compare.text + report.text
    assert "foreign.pdf" not in compare.text + report.text

    delete = client.delete(f"/documents/{foreign_id}", headers=auth_header(token_a))
    assert delete.status_code == 404
    assert client.get(f"/documents/{foreign_id}", headers=auth_header(token_b)).status_code == 200


def test_unknown_and_nonowned_ids_use_same_not_found_response(signing_keys) -> None:
    token_a = access_token(signing_keys["key-a"], subject="auth0|user-a")
    token_b = access_token(signing_keys["key-a"], subject="auth0|user-b")
    foreign = upload(token_b, "foreign.pdf", "Private text")

    owned_but_foreign = client.get(
        f"/documents/{foreign['document_id']}", headers=auth_header(token_a)
    )
    unknown = client.get(
        "/documents/00000000-0000-0000-0000-000000000001", headers=auth_header(token_a)
    )
    assert owned_but_foreign.status_code == unknown.status_code == 404
    assert owned_but_foreign.json() == unknown.json() == {"detail": "Document not found."}
