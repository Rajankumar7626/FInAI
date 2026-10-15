from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.api import app
from backend.document_registry import document_registry
from backend.financial_extraction import extract_financial_data
from backend.risk_engine import HIGH_DEBT_TO_ASSETS_THRESHOLD, analyze_financial_risk
from backend.schemas import FinancialDataResponse, FinancialMetric, RiskObservation
from tests.test_documents import make_text_pdf

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_documents() -> Generator[None, None, None]:
    document_registry.clear()
    yield
    document_registry.clear()


def metric(
    metric_name: str,
    value: float,
    *,
    currency: str | None = "USD",
    unit: str | None = "million",
    reporting_period: str | None = "2024",
) -> FinancialMetric:
    labels = {
        "net_income": "Net income",
        "operating_cash_flow": "Operating cash flow",
        "total_assets": "Total assets",
        "total_liabilities": "Total liabilities",
        "total_debt": "Total debt",
        "revenue": "Revenue",
    }
    label = labels[metric_name]
    amount = f"{value:g}"
    return FinancialMetric(
        metric_name=metric_name,
        value=value,
        original_reported_text=amount,
        currency=currency,
        unit=unit,
        reporting_period=reporting_period,
        source_context=f"{label}: {amount}",
        extraction_method="deterministic_label_value_rule",
    )


def data(*metrics: FinancialMetric) -> FinancialDataResponse:
    return FinancialDataResponse(document_id="document-1", metrics=list(metrics))


def test_negative_income_and_cash_flow_trigger_observations() -> None:
    result = analyze_financial_risk(
        data(metric("net_income", -10.0), metric("operating_cash_flow", -5.0))
    )

    observations = {observation.rule_id: observation for observation in result.observations}
    assert set(observations) == {"negative_net_income", "negative_operating_cash_flow"}
    assert observations["negative_net_income"].severity == "medium"
    assert observations["negative_net_income"].evidence == ["Net income: -10"]
    assert observations["negative_net_income"].relevant_metrics[0].value == -10.0


def test_liabilities_exceed_assets_triggers_only_for_comparable_values() -> None:
    result = analyze_financial_risk(
        data(metric("total_assets", 100.0), metric("total_liabilities", 125.0))
    )

    observations = {observation.rule_id: observation for observation in result.observations}
    assert "liabilities_exceed_assets" in observations
    assert observations["liabilities_exceed_assets"].severity == "high"
    assert len(observations["liabilities_exceed_assets"].evidence) == 2


def test_incompatible_comparisons_do_not_trigger_and_are_explained() -> None:
    result = analyze_financial_risk(
        data(
            metric("total_assets", 100.0, currency="USD"),
            metric("total_liabilities", 125.0, currency="EUR"),
            metric("total_debt", 90.0, reporting_period="2023"),
        )
    )

    assert result.observations == []
    assert any("Liabilities-to-assets comparison was withheld" in item for item in result.limitations)
    assert any("Debt-to-assets comparison was withheld" in item for item in result.limitations)


def test_high_debt_to_assets_uses_documented_threshold() -> None:
    result = analyze_financial_risk(
        data(metric("total_assets", 100.0), metric("total_debt", 76.0))
    )

    observations = {observation.rule_id: observation for observation in result.observations}
    assert HIGH_DEBT_TO_ASSETS_THRESHOLD == 0.75
    assert "high_debt_to_assets" in observations
    assert "75% screening threshold" in observations["high_debt_to_assets"].explanation


def test_debt_below_threshold_does_not_trigger() -> None:
    result = analyze_financial_risk(
        data(metric("total_assets", 100.0), metric("total_debt", 75.0))
    )

    assert "high_debt_to_assets" not in {
        observation.rule_id for observation in result.observations
    }


def test_missing_metrics_are_limitations_not_risk_observations() -> None:
    result = analyze_financial_risk(data(metric("revenue", 100.0)))

    assert result.observations == []
    missing_limitations = [item for item in result.limitations if "Missing key metrics" in item]
    assert len(missing_limitations) == 1
    assert "net_income" in missing_limitations[0]
    assert "total_assets" in missing_limitations[0]


def test_multiple_values_for_one_metric_are_withheld() -> None:
    result = analyze_financial_risk(
        data(metric("net_income", -10.0), metric("net_income", 20.0))
    )

    assert result.observations == []
    assert any("multiple extracted values" in item for item in result.limitations)


def test_risk_observation_requires_evidence_and_metrics() -> None:
    with pytest.raises(ValidationError):
        RiskObservation(
            rule_id="negative_net_income",
            title="Negative net income",
            severity="medium",
            explanation="Incomplete observation",
            relevant_metrics=[],
            evidence=[],
            limitation="Insufficient evidence",
        )


def test_risk_endpoint_returns_stable_schema_and_evidence() -> None:
    text = """Net income: ($10 million)
Operating cash flow: ($5 million)
Total assets for 2024: USD 100 million
Total liabilities for 2024: USD 125 million
"""
    upload = client.post(
        "/documents/upload",
        files={"file": ("risk-report.pdf", make_text_pdf(text), "application/pdf")},
    )
    assert upload.status_code == 201

    response = client.post(f"/documents/{upload.json()['document_id']}/risk-analysis")

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"document_id", "observations", "limitations"}
    assert {item["rule_id"] for item in payload["observations"]} == {
        "negative_net_income",
        "negative_operating_cash_flow",
        "liabilities_exceed_assets",
    }
    assert all(item["evidence"] for item in payload["observations"])


def test_risk_endpoint_returns_404_for_unknown_document() -> None:
    response = client.post(
        "/documents/00000000-0000-0000-0000-000000000000/risk-analysis"
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Document not found."}


def test_extraction_result_remains_compatible() -> None:
    result = extract_financial_data("document-2", "Net income: ($10 million)")

    assert result.metrics[0].value == -10.0
    assert result.metrics[0].source_context == "Net income: ($10 million)"
