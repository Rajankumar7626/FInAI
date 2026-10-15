from __future__ import annotations

import re
import math
from dataclasses import dataclass

from backend.schemas import FinancialDataResponse, FinancialMetric


@dataclass(frozen=True)
class MetricDefinition:
    name: str
    aliases: tuple[str, ...]


METRIC_DEFINITIONS = (
    MetricDefinition("revenue", ("revenue",)),
    MetricDefinition("net_income", ("net income", "net profit")),
    MetricDefinition("operating_profit", ("operating profit", "operating income")),
    MetricDefinition("total_assets", ("total assets",)),
    MetricDefinition("total_liabilities", ("total liabilities",)),
    MetricDefinition("total_debt", ("total debt",)),
    MetricDefinition("cash_and_cash_equivalents", ("cash and cash equivalents",)),
    MetricDefinition("operating_cash_flow", ("operating cash flow",)),
    MetricDefinition("earnings_per_share", ("earnings per share", "eps")),
)

NUMBER_PATTERN = re.compile(
    r"(?<![\w,])(?P<opening>\()?\s*"
    r"(?P<currency>\$|€|£|USD|EUR|GBP)?\s*"
    r"(?P<number>(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)"
    r"\s*(?P<unit>million|millions|billion|billions|thousand|thousands|%|percent)?"
    r"\s*(?P<closing>\))?(?![\w,])",
    re.IGNORECASE,
)
YEAR_PATTERN = re.compile(r"\b(?:19|20)\d{2}\b")

CURRENCY_SYMBOLS = {"€": "EUR", "£": "GBP"}
UNIT_NAMES = {
    "million": "million",
    "millions": "million",
    "billion": "billion",
    "billions": "billion",
    "thousand": "thousand",
    "thousands": "thousand",
}
UNSUPPORTED_CURRENCY_PATTERN = re.compile(r"\b[A-Z]{3}\s*(?=\d)")
UNSUPPORTED_UNIT_PATTERN = re.compile(r"\b(?:trillion|crore|crores|lakh|lakhs)\b", re.IGNORECASE)


def extract_financial_data(document_id: str, text: str) -> FinancialDataResponse:
    lines = _normalize_lines(text)
    metrics: list[FinancialMetric] = []

    for line_index, line in enumerate(lines):
        definitions = _matching_definitions(line)
        if len(definitions) != 1:
            continue

        definition = definitions[0]
        candidates = _amount_candidates(line)
        source_context = line
        if not candidates and line_index + 1 < len(lines):
            if _contains_percentage(line):
                continue
            next_line = lines[line_index + 1]
            next_candidates = _amount_candidates(next_line)
            if len(next_candidates) == 1 and _is_standalone_amount_line(
                next_line,
                next_candidates[0],
            ):
                candidates = next_candidates
                source_context = f"{line} {next_line}"

        if len(candidates) != 1:
            continue

        candidate = candidates[0]
        reporting_periods = YEAR_PATTERN.findall(source_context)
        metrics.append(
            FinancialMetric(
                metric_name=definition.name,
                value=candidate.value,
                original_reported_text=candidate.original_text,
                currency=_resolve_currency(candidate, source_context),
                unit=candidate.unit,
                reporting_period=(
                    reporting_periods[0] if len(set(reporting_periods)) == 1 else None
                ),
                source_context=source_context,
                extraction_method="deterministic_label_value_rule",
            )
        )

    return FinancialDataResponse(document_id=document_id, metrics=metrics)


@dataclass(frozen=True)
class AmountCandidate:
    value: float
    original_text: str
    currency: str | None
    unit: str | None


def _normalize_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def _matching_definitions(line: str) -> list[MetricDefinition]:
    matches = []
    for definition in METRIC_DEFINITIONS:
        if any(
            re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", line, re.IGNORECASE)
            for alias in definition.aliases
        ):
            matches.append(definition)
    return matches


def _amount_candidates(line: str) -> list[AmountCandidate]:
    unsupported_currency = UNSUPPORTED_CURRENCY_PATTERN.search(line)
    if unsupported_currency and unsupported_currency.group(0).strip().upper() not in {
        "USD",
        "EUR",
        "GBP",
    }:
        return []
    if UNSUPPORTED_UNIT_PATTERN.search(line):
        return []

    candidates: list[AmountCandidate] = []
    for match in NUMBER_PATTERN.finditer(line):
        number_text = match.group("number")
        if len(number_text.replace(",", "")) == 4 and YEAR_PATTERN.fullmatch(
            number_text.replace(",", "")
        ):
            continue

        unit_text = (match.group("unit") or "").lower()
        if unit_text in {"%", "percent"}:
            continue

        value = float(number_text.replace(",", ""))
        if not math.isfinite(value):
            continue
        if match.group("opening") and match.group("closing"):
            value = -value

        currency_text = match.group("currency")
        currency = None
        if currency_text:
            currency_code = currency_text.upper()
            currency = CURRENCY_SYMBOLS.get(currency_code)
            if currency is None and currency_code in {"USD", "EUR", "GBP"}:
                currency = currency_code

        candidates.append(
            AmountCandidate(
                value=value,
                original_text=match.group(0).strip(),
                currency=currency,
                unit=UNIT_NAMES.get(unit_text),
            )
        )
    return candidates


def _contains_percentage(line: str) -> bool:
    return any(
        (match.group("unit") or "").lower() in {"%", "percent"}
        for match in NUMBER_PATTERN.finditer(line)
    )


def _is_standalone_amount_line(line: str, candidate: AmountCandidate) -> bool:
    remainder = line.replace(candidate.original_text, "", 1)
    return not any(character.isalnum() for character in remainder)


def _resolve_currency(candidate: AmountCandidate, source_context: str) -> str | None:
    if candidate.currency is not None:
        return candidate.currency
    if "$" in candidate.original_text and re.search(
        r"(?<!\w)USD(?!\w)",
        source_context,
        re.IGNORECASE,
    ):
        return "USD"
    return None