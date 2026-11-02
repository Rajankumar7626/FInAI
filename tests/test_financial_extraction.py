from __future__ import annotations

from collections.abc import Generator
import math

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.api import app
from backend.document_registry import document_registry
from backend.financial_extraction import extract_financial_data
from backend.schemas import FinancialMetric
from tests.test_documents import make_text_pdf

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_documents() -> Generator[None, None, None]:
    document_registry.clear()
    yield
    document_registry.clear()


def test_extracts_all_supported_metric_labels() -> None:
    text = """Revenue: $1,200 million
Net income: $240 million
Operating profit: $300 million
Total assets: $5,000 million
Total liabilities: $2,500 million
Total debt: $1,100 million
Cash and cash equivalents: $600 million
Operating cash flow: $350 million
Earnings per share (EPS): $4.25
"""

    result = extract_financial_data("document-1", text)

    assert {metric.metric_name for metric in result.metrics} == {
        "revenue",
        "net_income",
        "operating_profit",
        "total_assets",
        "total_liabilities",
        "total_debt",
        "cash_and_cash_equivalents",
        "operating_cash_flow",
        "earnings_per_share",
    }
    assert len(result.metrics) == 9


def test_parses_currency_units_decimals_negatives_and_reporting_period() -> None:
    result = extract_financial_data(
        "document-2",
        "Revenue for 2024: EUR 2,345.67 million\nNet income: ($123.45 thousand)",
    )

    metrics = {metric.metric_name: metric for metric in result.metrics}
    assert metrics["revenue"].value == 2345.67
    assert metrics["revenue"].currency == "EUR"
    assert metrics["revenue"].unit == "million"
    assert metrics["revenue"].reporting_period == "2024"
    assert metrics["net_income"].value == -123.45
    assert metrics["net_income"].unit == "thousand"
    assert metrics["net_income"].source_context == "Net income: ($123.45 thousand)"


def test_preserves_evidence_and_uses_following_value_line() -> None:
    result = extract_financial_data(
        "document-3",
        "Total assets for 2023\n$9,876 million",
    )

    metric = result.metrics[0]
    assert metric.metric_name == "total_assets"
    assert metric.value == 9876
    assert metric.source_context == "Total assets for 2023 $9,876 million"
    assert metric.original_reported_text == "$9,876 million"
    assert metric.extraction_method == "deterministic_label_value_rule"


def test_does_not_extract_page_number_as_metric_value() -> None:
    result = extract_financial_data("document-page", "Revenue\nPage 12")

    assert result.metrics == []


@pytest.mark.parametrize("malformed_amount", ["1,2,3", "12,34", "1,2345"])
def test_rejects_malformed_thousands_grouping(malformed_amount: str) -> None:
    result = extract_financial_data(
        "document-grouping",
        f"Revenue: USD {malformed_amount} million",
    )

    assert result.metrics == []


def test_preserves_valid_grouped_decimal_currency_and_unit() -> None:
    result = extract_financial_data(
        "document-valid-grouping",
        "Revenue: GBP 1,234.56 billion",
    )

    assert len(result.metrics) == 1
    metric = result.metrics[0]
    assert metric.value == 1234.56
    assert metric.currency == "GBP"
    assert metric.unit == "billion"
    assert metric.original_reported_text == "GBP 1,234.56 billion"


def test_preserves_standalone_valid_amount_line_after_metric_label() -> None:
    result = extract_financial_data(
        "document-valid-next-line",
        "Total assets\n1,234.56 million",
    )

    assert len(result.metrics) == 1
    assert result.metrics[0].value == 1234.56
    assert result.metrics[0].source_context == "Total assets 1,234.56 million"


def test_omits_missing_ambiguous_and_unrelated_values() -> None:
    result = extract_financial_data(
        "document-4",
        """Revenue: $100 $90
Net income: unavailable
Revenue growth: 12%
Page 12
Reporting year 2024
""",
    )

    assert result.metrics == []


def test_omits_unsupported_currency_and_unit_instead_of_inferencing() -> None:
    result = extract_financial_data(
        "document-5",
        "Revenue: CAD 100 million\nTotal debt: 1.2 trillion",
    )

    assert result.metrics == []


def test_does_not_invent_unknown_reporting_period() -> None:
    result = extract_financial_data("document-6", "Revenue: $100 million")

    assert result.metrics[0].reporting_period is None


@pytest.mark.parametrize(
    ("text", "expected_currency"),
    [
        ("Revenue: $100 million", None),
        ("Revenue: USD 100 million", "USD"),
        ("Revenue: EUR 100 million", "EUR"),
        ("Revenue: GBP 100 million", "GBP"),
        ("Revenue: 100 million", None),
    ],
)
def test_currency_is_only_set_when_explicitly_supported(
    text: str,
    expected_currency: str | None,
) -> None:
    result = extract_financial_data("document-currency", text)

    assert len(result.metrics) == 1
    metric = result.metrics[0]
    assert metric.currency == expected_currency
    assert metric.value == 100
    assert metric.unit == "million"
    assert metric.source_context == text


def test_dollar_symbol_uses_explicit_usd_in_evidence_context() -> None:
    result = extract_financial_data(
        "document-explicit-currency-context",
        "Revenue reported in USD: $100 million",
    )

    assert result.metrics[0].currency == "USD"


def valid_metric(**overrides: object) -> dict[str, object]:
    metric: dict[str, object] = {
        "metric_name": "revenue",
        "value": 100.0,
        "original_reported_text": "$100 million",
        "currency": "USD",
        "unit": "million",
        "reporting_period": "2024",
        "source_context": "Revenue for 2024: $100 million",
        "extraction_method": "deterministic_label_value_rule",
    }
    metric.update(overrides)
    return metric


@pytest.mark.parametrize(
    "overrides",
    [
        {"metric_name": "unsupported_metric"},
        {"value": "100.0"},
        {"value": math.nan},
        {"currency": "CAD"},
        {"unit": "trillion"},
        {"reporting_period": "FY2024"},
        {"original_reported_text": "$999 million"},
        {"source_context": "Operating costs: $100 million"},
    ],
)
def test_financial_metric_rejects_invalid_values(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        FinancialMetric(**valid_metric(**overrides))


def upload_financial_document(text: str) -> dict[str, object]:
    response = client.post(
        "/documents/upload",
        files={"file": ("financial-report.pdf", make_text_pdf(text), "application/pdf")},
    )
    assert response.status_code == 201
    return response.json()


def test_financial_data_endpoint_returns_stable_response_schema() -> None:
    uploaded = upload_financial_document("Revenue: $1,250 million")

    response = client.post(f"/documents/{uploaded['document_id']}/financial-data")

    assert response.status_code == 200
    assert set(response.json()) == {"document_id", "metrics"}
    assert response.json()["document_id"] == uploaded["document_id"]
    assert response.json()["metrics"] == [
        {
            "metric_name": "revenue",
            "value": 1250.0,
            "original_reported_text": "$1,250 million",
            "currency": None,
            "unit": "million",
            "reporting_period": None,
            "source_context": "Revenue: $1,250 million",
            "extraction_method": "deterministic_label_value_rule",
        }
    ]


def test_financial_data_endpoint_returns_404_for_unknown_document() -> None:
    response = client.post(
        "/documents/00000000-0000-0000-0000-000000000000/financial-data"
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Document not found."}

def test_filters_sec_noise_and_extracts_primary_metrics() -> None:
    text = """Item 1. Business
2. REVENUE
The Company updated its presentation in this Annual Report on Form 10-K.
Minimum corporate tax of 15% for companies with global revenue above Pillar 2.
Under the Internal Revenue Code, employees may make contributions under the 401(k) Plan.
Recurring revenue (1) 94%
Upfront revenue (2) 6%
(1) Recurring revenue is comprised of recurring contracts.
(2) See Note 2, Revenue from Contracts with Customers.
We may estimate revenue related to contingent fees 26
12. NET INCOME (LOSS) PER SHARE
Total revenues: $219 million
Net loss was $0.6 million for the year ended December 31, 2025
Operating cash flow: $24.1 million
Total assets: $418.7 million
Total debt, net: $67.0 million
"""
    result = extract_financial_data("doc-clean", text)
    metrics_map = {m.metric_name: m for m in result.metrics}

    assert "revenue" in metrics_map
    assert metrics_map["revenue"].value == 219.0
    assert metrics_map["revenue"].unit == "million"

    assert "net_income" in metrics_map
    assert metrics_map["net_income"].value == -0.6
    assert metrics_map["net_income"].reporting_period == "2025"

    assert "operating_cash_flow" in metrics_map
    assert metrics_map["operating_cash_flow"].value == 24.1

    assert "total_assets" in metrics_map
    assert metrics_map["total_assets"].value == 418.7

    assert "total_debt" in metrics_map
    assert metrics_map["total_debt"].value == 67.0


def test_extracts_financial_statement_table_multi_column_data() -> None:
    text = """CONSOLIDATED BALANCE SHEETS
Cash and cash equivalents   $ 42,220     $ 90,594
Total assets   $ 418,697     $ 315,289
Total liabilities     147,675       69,252
"""
    result = extract_financial_data("doc-table", text)
    metrics_map = {m.metric_name: m for m in result.metrics}

    assert metrics_map["cash_and_cash_equivalents"].value == 42220.0
    assert metrics_map["total_assets"].value == 418697.0
    assert metrics_map["total_liabilities"].value == 147675.0


def test_extracts_new_gaap_cash_flow_and_equity_metrics() -> None:
    text = """
CONSOLIDATED STATEMENTS OF CASH FLOWS AND EQUITY (in thousands)
2025     2024
Purchases of property and equipment     (32,631 )     (17,155 )
Net cash used in investing activities     (137,361 )     (5,936 )
Net cash provided by financing activities     64,563       (11,233 )
Total stockholders’ equity     271,022       246,037
"""
    result = extract_financial_data("doc-gaap", text)
    metrics_map = {m.metric_name: m for m in result.metrics}

    assert "capital_expenditures" in metrics_map
    assert metrics_map["capital_expenditures"].value == -32631.0
    assert metrics_map["capital_expenditures"].unit == "thousand"
    assert metrics_map["capital_expenditures"].reporting_period == "2025"

    assert "investing_cash_flow" in metrics_map
    assert metrics_map["investing_cash_flow"].value == -137361.0
    assert metrics_map["investing_cash_flow"].unit == "thousand"
    assert metrics_map["investing_cash_flow"].reporting_period == "2025"

    assert "financing_cash_flow" in metrics_map
    assert metrics_map["financing_cash_flow"].value == 64563.0
    assert metrics_map["financing_cash_flow"].unit == "thousand"
    assert metrics_map["financing_cash_flow"].reporting_period == "2025"

    assert "stockholders_equity" in metrics_map
    assert metrics_map["stockholders_equity"].value == 271022.0
    assert metrics_map["stockholders_equity"].unit == "thousand"
    assert metrics_map["stockholders_equity"].reporting_period == "2025"
