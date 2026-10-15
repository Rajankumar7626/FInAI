from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from backend.api import app
from backend.document_registry import document_registry
from tests.test_documents import make_text_pdf

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_documents() -> Generator[None, None, None]:
    document_registry.clear()
    yield
    document_registry.clear()


def upload_document(text: str, filename: str) -> str:
    response = client.post(
        "/documents/upload",
        files={"file": (filename, make_text_pdf(text), "application/pdf")},
    )
    assert response.status_code == 201
    return response.json()["document_id"]


def test_single_document_report_preserves_source_risk_and_missing_information() -> None:
    document_id = upload_document(
        "Revenue for 2024: USD 100 million\nNet income: (USD 10 million)",
        "annual-report.pdf",
    )

    response = client.post(
        "/reports/generate",
        json={"first_document_id": document_id},
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {
        "report_id",
        "generated_at",
        "report_type",
        "source_documents",
        "risk_observations",
        "comparison",
        "missing_information",
        "limitations",
        "methodology",
    }
    assert payload["report_type"] == "single_document"
    assert payload["comparison"] is None
    assert payload["source_documents"] == [
        {
            "document_id": document_id,
            "filename": "annual-report.pdf",
            "metrics": [
                {
                    "metric_name": "revenue",
                    "value": 100.0,
                    "original_reported_text": "USD 100 million",
                    "currency": "USD",
                    "unit": "million",
                    "reporting_period": "2024",
                    "source_context": "Revenue for 2024: USD 100 million",
                    "extraction_method": "deterministic_label_value_rule",
                },
                {
                    "metric_name": "net_income",
                    "value": -10.0,
                    "original_reported_text": "(USD 10 million)",
                    "currency": "USD",
                    "unit": "million",
                    "reporting_period": None,
                    "source_context": "Net income: (USD 10 million)",
                    "extraction_method": "deterministic_label_value_rule",
                },
            ],
        }
    ]
    assert {item["rule_id"] for item in payload["risk_observations"]} == {
        "negative_net_income"
    }
    assert any("total_assets" in item for item in payload["missing_information"])
    assert payload["methodology"]["steps"]
    assert payload["report_id"]
    assert payload["generated_at"]


def test_two_document_report_includes_comparison_and_both_sources() -> None:
    first_id = upload_document("Revenue for 2024: USD 100 million", "first.pdf")
    second_id = upload_document("Revenue for 2024: USD 150 million", "second.pdf")

    response = client.post(
        "/reports/generate",
        json={"first_document_id": first_id, "second_document_id": second_id},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["report_type"] == "two_document_comparison"
    assert [item["document_id"] for item in payload["source_documents"]] == [
        first_id,
        second_id,
    ]
    assert payload["comparison"]["first_document_id"] == first_id
    revenue = next(
        item for item in payload["comparison"]["metrics"] if item["metric_name"] == "revenue"
    )
    assert revenue["absolute_difference"] == 50.0
    assert revenue["percentage_change"] == 50.0
    assert revenue["first_evidence"] == "Revenue for 2024: USD 100 million"
    assert revenue["second_evidence"] == "Revenue for 2024: USD 150 million"


def test_two_document_report_preserves_comparison_limitations() -> None:
    first_id = upload_document("Revenue for 2023: USD 100 million", "first.pdf")
    second_id = upload_document("Revenue for 2024: USD 150 million", "second.pdf")

    response = client.post(
        "/reports/generate",
        json={"first_document_id": first_id, "second_document_id": second_id},
    )

    assert response.status_code == 200
    revenue = next(
        item
        for item in response.json()["comparison"]["metrics"]
        if item["metric_name"] == "revenue"
    )
    assert revenue["comparison_status"] == "incomparable"
    assert revenue["absolute_difference"] is None
    assert any("reporting periods differ" in item for item in response.json()["limitations"])


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"first_document_id": "missing", "unexpected": "field"},
    ],
)
def test_report_endpoint_rejects_invalid_request_body(body: dict[str, str]) -> None:
    response = client.post("/reports/generate", json=body)

    assert response.status_code == 422
    assert response.json() == {"detail": "Validation error"}


def test_report_endpoint_returns_404_for_unknown_first_document() -> None:
    response = client.post(
        "/reports/generate",
        json={"first_document_id": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "First document was not found."}


def test_report_endpoint_returns_404_for_unknown_second_document() -> None:
    first_id = upload_document("Revenue for 2024: USD 100 million", "first.pdf")

    response = client.post(
        "/reports/generate",
        json={
            "first_document_id": first_id,
            "second_document_id": "11111111-1111-1111-1111-111111111111",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Second document was not found."}
