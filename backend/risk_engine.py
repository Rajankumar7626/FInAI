from __future__ import annotations

from dataclasses import dataclass

from backend.schemas import (
    FinancialDataResponse,
    FinancialMetric,
    RiskAnalysisResponse,
    RiskMetricReference,
    RiskObservation,
)


HIGH_DEBT_TO_ASSETS_THRESHOLD = 0.75
KEY_METRICS = (
    "revenue",
    "net_income",
    "operating_cash_flow",
    "total_assets",
    "total_liabilities",
    "total_debt",
)
BASE_LIMITATION = (
    "These are deterministic indicators, not investment advice, a credit rating, "
    "or a substitute for professional financial analysis."
)


@dataclass(frozen=True)
class ComparablePair:
    first: FinancialMetric
    second: FinancialMetric


def analyze_financial_risk(data: FinancialDataResponse) -> RiskAnalysisResponse:
    observations: list[RiskObservation] = []
    limitations = [BASE_LIMITATION]

    metrics_by_name = _group_metrics(data.metrics)
    selected_metrics: dict[str, FinancialMetric] = {}
    for metric_name, metrics in metrics_by_name.items():
        if len(metrics) == 1:
            selected_metrics[metric_name] = metrics[0]
        else:
            limitations.append(
                f"Risk rules could not use {metric_name}: multiple extracted values were present."
            )

    net_income = selected_metrics.get("net_income")
    if net_income is not None and net_income.value < 0:
        observations.append(
            _observation(
                rule_id="negative_net_income",
                title="Negative net income",
                severity="medium",
                explanation=f"Net income was reported as {net_income.value:g}.",
                metrics=[net_income],
                limitation="A single reported period does not establish a persistent loss trend.",
            )
        )

    operating_cash_flow = selected_metrics.get("operating_cash_flow")
    if operating_cash_flow is not None and operating_cash_flow.value < 0:
        observations.append(
            _observation(
                rule_id="negative_operating_cash_flow",
                title="Negative operating cash flow",
                severity="medium",
                explanation=(
                    f"Operating cash flow was reported as {operating_cash_flow.value:g}."
                ),
                metrics=[operating_cash_flow],
                limitation="A single reported period does not establish a persistent cash-flow trend.",
            )
        )

    assets = selected_metrics.get("total_assets")
    liabilities = selected_metrics.get("total_liabilities")
    assets_liabilities = _comparable_pair(assets, liabilities)
    if assets is not None and liabilities is not None and assets_liabilities is None:
        limitations.append(
            "Liabilities-to-assets comparison was withheld because currency, unit, or reporting period did not match."
        )
    if assets_liabilities is not None and liabilities.value > assets.value:
        observations.append(
            _observation(
                rule_id="liabilities_exceed_assets",
                title="Liabilities exceed assets",
                severity="high",
                explanation=(
                    f"Total liabilities ({liabilities.value:g}) exceeded total assets "
                    f"({assets.value:g}) for the comparable reported period."
                ),
                metrics=[assets, liabilities],
                limitation="This is a balance-sheet indicator and does not by itself determine solvency.",
            )
        )

    debt = selected_metrics.get("total_debt")
    debt_assets = _comparable_pair(debt, assets)
    if debt is not None and assets is not None and debt_assets is None:
        limitations.append(
            "Debt-to-assets comparison was withheld because currency, unit, or reporting period did not match."
        )
    if debt_assets is not None and assets.value > 0:
        debt_ratio = debt.value / assets.value
        if debt_ratio > HIGH_DEBT_TO_ASSETS_THRESHOLD:
            observations.append(
                _observation(
                    rule_id="high_debt_to_assets",
                    title="Debt is high relative to assets",
                    severity="medium",
                    explanation=(
                        f"Total debt was {debt_ratio:.1%} of total assets, above the "
                        f"documented {HIGH_DEBT_TO_ASSETS_THRESHOLD:.0%} screening threshold."
                    ),
                    metrics=[debt, assets],
                    limitation=(
                        "The 75% threshold is a technical screening convention, not a universal "
                        "financial standard."
                    ),
                )
            )

    missing_metrics = [name for name in KEY_METRICS if name not in selected_metrics]
    if missing_metrics:
        limitations.append(
            "Missing key metrics limit this analysis: " + ", ".join(missing_metrics) + "."
        )

    return RiskAnalysisResponse(
        document_id=data.document_id,
        observations=observations,
        limitations=limitations,
    )


def _group_metrics(metrics: list[FinancialMetric]) -> dict[str, list[FinancialMetric]]:
    grouped: dict[str, list[FinancialMetric]] = {}
    for metric in metrics:
        grouped.setdefault(metric.metric_name, []).append(metric)
    return grouped


def _comparable_pair(
    first: FinancialMetric | None,
    second: FinancialMetric | None,
) -> ComparablePair | None:
    if first is None or second is None:
        return None
    if first.currency is None or second.currency is None:
        return None
    if first.unit is None or second.unit is None:
        return None
    if first.currency != second.currency or first.unit != second.unit:
        return None
    if first.reporting_period is None or second.reporting_period is None:
        return None
    if first.reporting_period != second.reporting_period:
        return None
    return ComparablePair(first=first, second=second)


def _observation(
    *,
    rule_id: str,
    title: str,
    severity: str,
    explanation: str,
    metrics: list[FinancialMetric],
    limitation: str,
) -> RiskObservation:
    return RiskObservation(
        rule_id=rule_id,
        title=title,
        severity=severity,
        explanation=explanation,
        relevant_metrics=[
            RiskMetricReference(
                metric_name=metric.metric_name,
                value=metric.value,
                currency=metric.currency,
                unit=metric.unit,
                reporting_period=metric.reporting_period,
                source_context=metric.source_context,
            )
            for metric in metrics
        ],
        evidence=[metric.source_context for metric in metrics],
        limitation=limitation,
    )