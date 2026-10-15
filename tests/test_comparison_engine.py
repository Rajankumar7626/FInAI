from __future__ import annotations

from collections.abc import Generator
import json
import math

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.api import app
from backend.comparison_engine import compare_financial_data
from backend.document_registry import document_registry
from backend.schemas import ComparedMetric, FinancialDataResponse, FinancialMetric
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
        "revenue": "Revenue",
        "net_income": "Net income",
        "operating_profit": "Operating profit",
        "total_assets": "Total assets",
        "total_liabilities": "Total liabilities",
        "total_debt": "Total debt",
        "cash_and_cash_equivalents": "Cash and cash equivalents",
        "operating_cash_flow": "Operating cash flow",
        "earnings_per_share": "Earnings per share",
    }
    amount = f"{value:g}"
    return FinancialMetric(
        metric_name=metric_name,
        value=value,
        original_reported_text=amount,
        currency=currency,
        unit=unit,
        reporting_period=reporting_period,
        source_context=f"{labels[metric_name]}: {amount}",
        extraction_method="deterministic_label_value_rule",
    )


def data(*metrics: FinancialMetric, document_id: str = "document") -> FinancialDataResponse:
    return FinancialDataResponse(document_id=document_id, metrics=list(metrics))


def test_compares_all_supported_common_metrics() -> None:
    names = (
        "revenue",
        "net_income",
        "operating_profit",
        "total_assets",
        "total_liabilities",
        "total_debt",
        "cash_and_cash_equivalents",
        "operating_cash_flow",
        "earnings_per_share",
    )
    first = data(*(metric(name, 100.0) for name in names), document_id="first")
    second = data(*(metric(name, 125.0) for name in names), document_id="second")

    result = compare_financial_data(first, second)

    assert result.first_document_id == "first"
    assert result.second_document_id == "second"
    assert len(result.metrics) == 9
    assert all(item.comparison_status == "comparable" for item in result.metrics)


def test_difference_is_second_minus_first_and_percentage_uses_first_baseline() -> None:
    result = compare_financial_data(
        data(metric("revenue", 100.0)),
        data(metric("revenue", 150.0)),
    )

    revenue = next(item for item in result.metrics if item.metric_name == "revenue")
    assert revenue.absolute_difference == 50.0
    assert revenue.percentage_change == 50.0
    assert revenue.first_evidence == "Revenue: 100"
    assert revenue.second_evidence == "Revenue: 150"


def test_negative_difference_is_preserved() -> None:
    result = compare_financial_data(
        data(metric("net_income", 20.0)),
        data(metric("net_income", 10.0)),
    )

    net_income = next(item for item in result.metrics if item.metric_name == "net_income")
    assert net_income.absolute_difference == -10.0
    assert net_income.percentage_change == -50.0


def test_zero_first_value_has_no_percentage_change() -> None:
    result = compare_financial_data(
        data(metric("revenue", 0.0)),
        data(metric("revenue", 50.0)),
    )

    revenue = next(item for item in result.metrics if item.metric_name == "revenue")
    assert revenue.comparison_status == "comparable"
    assert revenue.absolute_difference == 50.0
    assert revenue.percentage_change is None
    assert revenue.limitation is not None
    assert "first value is zero" in revenue.limitation


def test_extreme_finite_values_are_incomparable_without_non_finite_output() -> None:
    result = compare_financial_data(
        data(metric("revenue", -1.7e308)),
        data(metric("revenue", 1.7e308)),
    )

    revenue = next(item for item in result.metrics if item.metric_name == "revenue")
    assert revenue.comparison_status == "incomparable"
    assert revenue.absolute_difference is None
    assert revenue.percentage_change is None
    assert "finite numeric range" in (revenue.limitation or "")
    json.dumps(result.model_dump(mode="json"), allow_nan=False)


def test_percentage_overflow_preserves_finite_difference_and_explains_omission() -> None:
    result = compare_financial_data(
        data(metric("revenue", 1e-308)),
        data(metric("revenue", 1.0)),
    )

    revenue = next(item for item in result.metrics if item.metric_name == "revenue")
    assert revenue.comparison_status == "comparable"
    assert math.isfinite(revenue.absolute_difference)
    assert revenue.percentage_change is None
    assert "finite numeric range" in (revenue.limitation or "")
    json.dumps(result.model_dump(mode="json"), allow_nan=False)


def test_compared_metric_schema_rejects_non_finite_values() -> None:
    result = compare_financial_data(
        data(metric("revenue", 100.0)),
        data(metric("revenue", 150.0)),
    )
    revenue = next(item for item in result.metrics if item.metric_name == "revenue")
    invalid = revenue.model_dump()
    invalid["absolute_difference"] = math.inf

    with pytest.raises(ValidationError):
        ComparedMetric(**invalid)


@pytest.mark.parametrize(
    ("first_kwargs", "second_kwargs", "expected_text"),
    [
        ({"currency": "USD"}, {"currency": "EUR"}, "currencies are incompatible"),
        ({"unit": "million"}, {"unit": "billion"}, "units are incompatible"),
        ({"reporting_period": "2023"}, {"reporting_period": "2024"}, "reporting periods differ"),
        ({"reporting_period": None}, {"reporting_period": "2024"}, "reporting period is unknown"),
    ],
)

def test_incompatible_values_are_reported_without_differences(
    first_kwargs: dict[str, object],
    second_kwargs: dict[str, object],
    expected_text: str,
) -> None:
    result = compare_financial_data(
        data(metric("revenue", 100.0, **first_kwargs)),
        data(metric("revenue", 125.0, **second_kwargs)),
    )

    revenue = next(item for item in result.metrics if item.metric_name == "revenue")
    assert revenue.comparison_status == "incomparable"
    assert revenue.absolute_difference is None
    assert revenue.percentage_change is None
    assert revenue.limitation is not None
    assert expected_text in revenue.limitation


def test_missing_metrics_are_unavailable_and_preserve_available_evidence() -> None:
    result = compare_financial_data(
        data(metric("revenue", 100.0)),
        data(metric("net_income", 10.0)),
    )

    revenue = next(item for item in result.metrics if item.metric_name == "revenue")
    assert revenue.comparison_status == "unavailable"
    assert revenue.first_value == 100.0
    assert revenue.second_value is None
    assert revenue.first_evidence == "Revenue: 100"
    assert revenue.absolute_difference is None
    assert revenue.limitation is not None
    assert "second report" in revenue.limitation
    assert result.limitations


def test_unknown_currency_is_not_compared_as_usd() -> None:
    result = compare_financial_data(
        data(metric("revenue", 100.0, currency=None)),
        data(metric("revenue", 150.0, currency="USD")),
    )

    revenue = next(item for item in result.metrics if item.metric_name == "revenue")
    assert revenue.comparison_status == "incomparable"
    assert revenue.absolute_difference is None
    assert revenue.percentage_change is None
    assert "currency is missing" in (revenue.limitation or "")


def test_matching_explicit_currencies_remain_comparable() -> None:
    result = compare_financial_data(
        data(metric("revenue", 100.0, currency="EUR")),
        data(metric("revenue", 150.0, currency="EUR")),
    )

    revenue = next(item for item in result.metrics if item.metric_name == "revenue")
    assert revenue.comparison_status == "comparable"
    assert revenue.currency == "EUR"
    assert revenue.absolute_difference == 50.0
    assert revenue.percentage_change == 50.0


def upload_document(text: str, filename: str) -> str:
    response = client.post(
        "/documents/upload",
        files={"file": (filename, make_text_pdf(text), "application/pdf")},
    )
    assert response.status_code == 201
    return response.json()["document_id"]


def test_compare_endpoint_returns_stable_schema_and_uses_registered_text() -> None:
    first_id = upload_document("Revenue for 2024: USD 100 million", "first.pdf")
    second_id = upload_document("Revenue for 2024: USD 150 million", "second.pdf")

    response = client.post(
        "/documents/compare",
        json={"first_document_id": first_id, "second_document_id": second_id},
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {
        "first_document_id",
        "second_document_id",
        "metrics",
        "limitations",
    }
    revenue = next(item for item in payload["metrics"] if item["metric_name"] == "revenue")
    assert revenue["comparison_status"] == "comparable"
    assert revenue["absolute_difference"] == 50.0
    assert revenue["percentage_change"] == 50.0
    assert revenue["first_evidence"] == "Revenue for 2024: USD 100 million"
    assert revenue["second_evidence"] == "Revenue for 2024: USD 150 million"


def test_compare_endpoint_returns_404_for_unknown_document() -> None:
    response = client.post(
        "/documents/compare",
        json={
            "first_document_id": "00000000-0000-0000-0000-000000000000",
            "second_document_id": "11111111-1111-1111-1111-111111111111",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "One or both documents were not found."}


def test_compare_endpoint_rejects_invalid_request_body() -> None:
    response = client.post("/documents/compare", json={"first_document_id": "only-one"})

    assert response.status_code == 422
    assert response.json() == {"detail": "Validation error"}
