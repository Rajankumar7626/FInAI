from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.api import app
from backend.auth import Principal, get_current_principal
from backend.document_registry import DocumentRecord, document_registry
from backend.research_service import answer_financial_question

client = TestClient(app)

SAMPLE_TEXT = """
Acme Financial Corporation
Annual Report 2024

Financial Highlights:
Revenue: $500.00 million
Operating Profit: $120.00 million
Net Income: $80.00 million
Total Debt: $450.00 million
Cash and Cash Equivalents: $50.00 million

Management Discussion and Disclosures:
The company experienced increased leverage in 2024 due to strategic expansion borrowings.
Liquidity risk is monitored closely under capital adequacy guidelines.
"""


def test_answer_question_revenue():
    response = answer_financial_question("doc-1", SAMPLE_TEXT, "What was the company's revenue?")
    assert response.status == "answered"
    assert len(response.relevant_metrics) >= 1
    assert response.relevant_metrics[0].metric_name == "revenue"
    assert response.relevant_metrics[0].value == 500.0
    assert "Revenue: $500.00 million" in response.answer


def test_answer_question_risks():
    response = answer_financial_question("doc-1", SAMPLE_TEXT, "What are the financial risks or debt concerns?")
    assert response.status == "answered"
    assert "debt" in response.answer.lower() or "risk" in response.answer.lower()
    assert len(response.citations) > 0


def test_answer_question_insufficient_evidence():
    response = answer_financial_question("doc-1", SAMPLE_TEXT, "What is the target stock price for 2030?")
    assert response.status == "insufficient_evidence"
    assert "does not provide sufficient disclosures" in response.answer
    assert len(response.relevant_metrics) == 0


def test_api_ask_endpoint():
    test_owner = "auth0|research-test-user"
    doc_id = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"

    # Add document to registry
    document_registry.add(
        DocumentRecord(
            document_id=doc_id,
            filename="acme_2024.pdf",
            page_count=2,
            extracted_character_count=len(SAMPLE_TEXT),
            extraction_status="completed",
            extracted_text=SAMPLE_TEXT,
            owner_id=test_owner,
        )
    )

    try:
        app.dependency_overrides[get_current_principal] = lambda: Principal(subject=test_owner)

        resp = client.post(
            f"/documents/{doc_id}/ask",
            json={"question": "What is the net income for 2024?"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["document_id"] == doc_id
        assert data["status"] == "answered"
        assert any(m["metric_name"] == "net_income" for m in data["relevant_metrics"])

        # Test non-existent document
        not_found_resp = client.post(
            "/documents/00000000-0000-0000-0000-000000000000/ask",
            json={"question": "What is the revenue?"},
        )
        assert not_found_resp.status_code == 404

    finally:
        app.dependency_overrides.pop(get_current_principal, None)
        document_registry.delete_owned(doc_id, test_owner)
