from fastapi.testclient import TestClient

from backend.api import app
from backend.config import Settings

client = TestClient(app)


def test_health_endpoint_returns_success_payload() -> None:
    response = client.get('/health')

    assert response.status_code == 200
    assert response.json() == {'status': 'ok', 'service': 'finsight-ai'}


def test_health_endpoint_has_expected_shape() -> None:
    response = client.get('/health')

    payload = response.json()
    assert set(payload.keys()) == {'status', 'service'}
    assert isinstance(payload['status'], str)
    assert isinstance(payload['service'], str)


def test_unknown_route_returns_standard_error_payload() -> None:
    response = client.get('/missing-route')

    assert response.status_code == 404
    assert response.json() == {'detail': 'Not Found'}


def test_settings_reads_cors_origins_from_environment(monkeypatch) -> None:
    monkeypatch.setenv('CORS_ORIGINS', 'http://example.com, http://localhost:3000')

    settings = Settings.from_env()

    assert settings.cors_origins == ['http://example.com', 'http://localhost:3000']
