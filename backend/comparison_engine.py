from __future__ import annotations

import math
from dataclasses import dataclass

from backend.schemas import (
    ComparisonResponse,
    ComparedMetric,
    FinancialDataResponse,
    FinancialMetric,
)


METRIC_DISPLAY_NAMES = {
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
SUPPORTED_METRIC_NAMES = tuple(METRIC_DISPLAY_NAMES)


@dataclass(frozen=True)
class MetricPair:
    first: FinancialMetric | None
    second: FinancialMetric | None
    first_ambiguous: bool = False
    second_ambiguous: bool = False


def compare_financial_data(
    first: FinancialDataResponse,
    second: FinancialDataResponse,
) -> ComparisonResponse:
    metrics: list[ComparedMetric] = []
    limitations: list[str] = []
    first_metrics = _index_metrics(first)
    second_metrics = _index_metrics(second)

    for metric_name in SUPPORTED_METRIC_NAMES:
        compared = _compare_metric(
            metric_name,
            MetricPair(
                first=first_metrics[metric_name].metric,
                second=second_metrics[metric_name].metric,
                first_ambiguous=first_metrics[metric_name].ambiguous,
                second_ambiguous=second_metrics[metric_name].ambiguous,
            ),
        )
        metrics.append(compared)
        if compared.limitation:
            limitations.append(f"{compared.display_name}: {compared.limitation}")

    return ComparisonResponse(
        first_document_id=first.document_id,
        second_document_id=second.document_id,
        metrics=metrics,
        limitations=limitations,
    )


@dataclass(frozen=True)
class IndexedMetric:
    metric: FinancialMetric | None
    ambiguous: bool


def _index_metrics(data: FinancialDataResponse) -> dict[str, IndexedMetric]:
    grouped: dict[str, list[FinancialMetric]] = {
        name: [] for name in SUPPORTED_METRIC_NAMES
    }
    for metric in data.metrics:
        grouped[metric.metric_name].append(metric)
    return {
        name: IndexedMetric(
            metric=values[0] if len(values) == 1 else None,
            ambiguous=len(values) > 1,
        )
        for name, values in grouped.items()
    }


def _compare_metric(metric_name: str, pair: MetricPair) -> ComparedMetric:
    first = pair.first
    second = pair.second
    base = _metric_fields(metric_name, first, second)

    if pair.first_ambiguous or pair.second_ambiguous:
        return ComparedMetric(
            **base,
            comparison_status="unavailable",
            limitation="Comparison withheld because one or both reports had multiple extracted values.",
        )
    if first is None or second is None:
        missing_from = []
        if first is None:
            missing_from.append("first")
        if second is None:
            missing_from.append("second")
        return ComparedMetric(
            **base,
            comparison_status="unavailable",
            limitation=f"Metric was unavailable in the {' and '.join(missing_from)} report.",
        )

    incompatibility = _incompatibility_reason(first, second)
    if incompatibility:
        return ComparedMetric(
            **base,
            comparison_status="incomparable",
            limitation=incompatibility,
        )

    absolute_difference = second.value - first.value
    if not math.isfinite(absolute_difference):
        return ComparedMetric(
            **base,
            comparison_status="incomparable",
            limitation=(
                "Comparison withheld because the absolute difference exceeded "
                "the finite numeric range."
            ),
        )

    percentage_change = None
    limitation = None
    if first.value == 0:
        limitation = "Percentage change was not calculated because the first value is zero."
    else:
        calculated_percentage = absolute_difference / first.value * 100
        if math.isfinite(calculated_percentage):
            percentage_change = calculated_percentage
        else:
            limitation = (
                "Percentage change was omitted because the result exceeded "
                "the finite numeric range."
            )

    return ComparedMetric(
        **base,
        currency=first.currency,
        unit=first.unit,
        reporting_period=first.reporting_period,
        absolute_difference=absolute_difference,
        percentage_change=percentage_change,
        comparison_status="comparable",
        limitation=limitation,
    )


def _metric_fields(
    metric_name: str,
    first: FinancialMetric | None,
    second: FinancialMetric | None,
) -> dict[str, object]:
    return {
        "metric_name": metric_name,
        "display_name": METRIC_DISPLAY_NAMES[metric_name],
        "first_value": first.value if first else None,
        "second_value": second.value if second else None,
        "first_evidence": first.source_context if first else None,
        "second_evidence": second.source_context if second else None,
        "first_currency": first.currency if first else None,
        "second_currency": second.currency if second else None,
        "first_unit": first.unit if first else None,
        "second_unit": second.unit if second else None,
        "first_reporting_period": first.reporting_period if first else None,
        "second_reporting_period": second.reporting_period if second else None,
    }


def _incompatibility_reason(first: FinancialMetric, second: FinancialMetric) -> str | None:
    if first.currency is None or second.currency is None:
        return "Comparison withheld because currency is missing from one or both reports."
    if first.currency != second.currency:
        return "Comparison withheld because currencies are incompatible."
    if first.unit is None or second.unit is None:
        return "Comparison withheld because unit is missing from one or both reports."
    if first.unit != second.unit:
        return "Comparison withheld because units are incompatible."
    if first.reporting_period is None or second.reporting_period is None:
        return "Comparison withheld because reporting period is unknown in one or both reports."
    if first.reporting_period != second.reporting_period:
        return "Comparison withheld because reporting periods differ."
    return None