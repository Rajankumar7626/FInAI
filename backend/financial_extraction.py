from __future__ import annotations

import math
import re
from dataclasses import dataclass

from backend.schemas import FinancialDataResponse, FinancialMetric


@dataclass(frozen=True)
class MetricDefinition:
    name: str
    aliases: tuple[str, ...]


METRIC_DEFINITIONS = (
    MetricDefinition(
        "revenue",
        ("total revenues", "total revenue", "revenues", "revenue"),
    ),
    MetricDefinition(
        "net_income",
        ("net income (loss)", "net income", "net loss", "net profit"),
    ),
    MetricDefinition(
        "operating_profit",
        (
            "income (loss) from operations",
            "income from operations",
            "operating income",
            "operating profit",
        ),
    ),
    MetricDefinition("total_assets", ("total assets",)),
    MetricDefinition("total_liabilities", ("total liabilities",)),
    MetricDefinition(
        "total_debt",
        (
            "total debt, net",
            "total debt (principal amount)",
            "total debt",
            "long-term debt, net",
            "long-term debt",
        ),
    ),
    MetricDefinition(
        "cash_and_cash_equivalents",
        ("cash and cash equivalents",),
    ),
    MetricDefinition(
        "operating_cash_flow",
        (
            "net cash flows provided by operating activities",
            "net cash provided by operating activities",
            "cash flows provided by operating activities",
            "operating activities",
            "operating cash flow",
            "operating cash flows",
        ),
    ),
    MetricDefinition(
        "earnings_per_share",
        (
            "net income (loss) per share",
            "earnings per share",
            "diluted",
            "basic",
            "eps",
        ),
    ),
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

EXCLUDED_PATTERNS = (
    re.compile(r"\bInternal Revenue\b", re.IGNORECASE),
    re.compile(r"\bIRS\b", re.IGNORECASE),
    re.compile(r"\bPillar\s+\d+\b", re.IGNORECASE),
    re.compile(r"\bForm\s+\d+\s*-\s*[A-Z]\b", re.IGNORECASE),
    re.compile(r"\b401\s*\(\s*k\s*\)", re.IGNORECASE),
    re.compile(r"\bRule\s+\d+[a-z]?-\d+\b", re.IGNORECASE),
    re.compile(r"\bSection\s+\d+\b", re.IGNORECASE),
    re.compile(r"^\s*(\d+\.|\bNote\s+\d+[:.]?)\s+[A-Z\s\(\)/-]+$", re.IGNORECASE),
    re.compile(r"^\s*\(\d+\)\s+See\s+.*Note\s+\d+", re.IGNORECASE),
    re.compile(r"^\s*\(\d+\)\s+[A-Z]", re.IGNORECASE),
    re.compile(r"\b(costs?|expenses?|amortization)\s+of\s+revenues?\b", re.IGNORECASE),
    re.compile(r"\bdeferred\s+revenues?\b", re.IGNORECASE),
    re.compile(r"\b(and|plus)\s+(stockholders|shareholders)[\'’]?\s+equity\b", re.IGNORECASE),
    re.compile(r"\bweighted\s+average\s+(common\s+)?shares\b", re.IGNORECASE),
    re.compile(r"\b(proceeds|issuance|repayment)\s+(from|of)\s+long-term\s+debt\b", re.IGNORECASE),
)


@dataclass(frozen=True)
class AmountCandidate:
    value: float
    original_text: str
    currency: str | None
    unit: str | None


def _is_excluded(line: str) -> bool:
    return any(pattern.search(line) for pattern in EXCLUDED_PATTERNS)


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

    trailing_page_match = None
    if len(line) > 35 and re.search(r"([a-z\.\,\)]\s+)\d{1,3}\s*$", line):
        m = re.search(r"\b(\d{1,3})\s*$", line)
        if m:
            trailing_page_match = m.start()

    candidates: list[AmountCandidate] = []
    for match in NUMBER_PATTERN.finditer(line):
        if trailing_page_match is not None and match.start() >= trailing_page_match:
            continue

        number_text = match.group("number")
        if len(number_text.replace(",", "")) == 4 and YEAR_PATTERN.fullmatch(
            number_text.replace(",", "")
        ):
            continue

        unit_text = (match.group("unit") or "").lower()
        if unit_text in {"%", "percent"}:
            continue

        currency_text = match.group("currency")

        # Footnote/enumeration filter: e.g. (1), (2), (3) without currency, unit, or decimal
        if match.group("opening") and match.group("closing"):
            if (
                not currency_text
                and not unit_text
                and "." not in number_text
                and "," not in number_text
            ):
                try:
                    if int(number_text) <= 50:
                        continue
                except ValueError:
                    pass

        value = float(number_text.replace(",", ""))
        if not math.isfinite(value):
            continue
        if match.group("opening") and match.group("closing"):
            value = -value

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


def _metric_confidence_score(metric: FinancialMetric) -> float:
    score = 0.0
    if metric.unit is not None:
        score += 50.0
    if metric.currency is not None:
        score += 30.0
    if metric.reporting_period is not None:
        score += 20.0
        try:
            score += (int(metric.reporting_period) - 2000) * 2.0
        except ValueError:
            pass

    ctx_lower = metric.source_context.lower()
    if metric.metric_name == "revenue":
        if "total revenue" in ctx_lower:
            score += 40.0
        if any(
            seg in ctx_lower
            for seg in ["platform revenue", "volume-based", "recurring revenue"]
        ):
            score -= 25.0
    elif metric.metric_name == "operating_cash_flow":
        if "operating activities" in ctx_lower or "net cash provided by" in ctx_lower:
            score += 40.0
    elif metric.metric_name == "operating_profit":
        if "from operations" in ctx_lower:
            score += 40.0
    elif metric.metric_name == "total_debt":
        if "total debt, net" in ctx_lower:
            score += 40.0
    elif metric.metric_name == "cash_and_cash_equivalents":
        if "foreign subsidiaries" in ctx_lower or "restricted" in ctx_lower:
            score -= 35.0
        if (
            "we had cash and cash equivalents" in ctx_lower
            or "balance sheets" in ctx_lower
        ):
            score += 40.0
    elif metric.metric_name == "earnings_per_share":
        if "diluted" in ctx_lower:
            score += 30.0

    if (
        metric.unit is None
        and metric.currency is None
        and abs(metric.value) < 100
        and "." not in str(metric.value)
    ):
        score -= 100.0

    return score


def extract_financial_data(document_id: str, text: str) -> FinancialDataResponse:
    lines = _normalize_lines(text)
    raw_metrics: list[FinancialMetric] = []

    for line_index, line in enumerate(lines):
        if _is_excluded(line):
            continue

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

        selected_candidate: AmountCandidate | None = None
        if len(candidates) == 1:
            selected_candidate = candidates[0]
        elif len(candidates) > 1 and ":" not in line and (
            "$" in line
            or "," in candidates[0].original_text
            or "(" in candidates[0].original_text
        ):
            # Formatted table row with multi-column values (e.g. 2025, 2024, 2023)
            selected_candidate = candidates[0]

        if selected_candidate is None:
            continue

        candidate = selected_candidate
        # Handle explicit Net Loss or Operating Loss negation
        if candidate.value > 0 and re.search(
            r"\b(net\s+loss|loss\s+from\s+operations)\b",
            source_context,
            re.IGNORECASE,
        ):
            candidate = AmountCandidate(
                value=-candidate.value,
                original_text=candidate.original_text,
                currency=candidate.currency,
                unit=candidate.unit,
            )

        reporting_periods = YEAR_PATTERN.findall(source_context)
        reporting_period = None
        if len(set(reporting_periods)) == 1:
            reporting_period = reporting_periods[0]
        elif reporting_periods:
            reporting_period = str(max(int(y) for y in reporting_periods))

        raw_metrics.append(
            FinancialMetric(
                metric_name=definition.name,
                value=candidate.value,
                original_reported_text=candidate.original_text,
                currency=_resolve_currency(candidate, source_context),
                unit=candidate.unit,
                reporting_period=reporting_period,
                source_context=source_context,
                extraction_method="deterministic_label_value_rule",
            )
        )

    # Deduplicate metrics to retain the single highest-confidence authoritative metric for each metric_name
    grouped: dict[str, list[FinancialMetric]] = {}
    for metric in raw_metrics:
        grouped.setdefault(metric.metric_name, []).append(metric)

    deduplicated_metrics: list[FinancialMetric] = []
    for metric_name, candidates_list in grouped.items():
        if len(candidates_list) == 1:
            deduplicated_metrics.append(candidates_list[0])
        else:
            best = max(candidates_list, key=_metric_confidence_score)
            deduplicated_metrics.append(best)

    return FinancialDataResponse(document_id=document_id, metrics=deduplicated_metrics)
