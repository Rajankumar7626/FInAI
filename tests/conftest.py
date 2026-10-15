from __future__ import annotations

import pytest

from backend.api import app
from backend.auth import Principal, get_current_principal


@pytest.fixture(autouse=True)
def authenticated_legacy_api_tests():
    """Keep existing feature tests focused while auth-specific tests exercise verification."""
    app.dependency_overrides[get_current_principal] = lambda: Principal("test|existing-suite")
    yield
    app.dependency_overrides.pop(get_current_principal, None)
