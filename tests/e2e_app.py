"""Test-only ASGI entry point with a synthetic principal for browser journeys."""

from __future__ import annotations

from backend.api import app
from backend.auth import Principal, get_current_principal


def playwright_principal() -> Principal:
    return Principal(subject="playwright|synthetic-user")


app.dependency_overrides[get_current_principal] = playwright_principal
