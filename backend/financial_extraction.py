from __future__ import annotations

import math
import re
from dataclasses import dataclass

from backend.schemas import FinancialDataResponse, FinancialMetric


@dataclass(frozen=True)
class MetricDefinition:
    name: str
    aliases: tuple[str, ...]


# Universal GAAP / IFRS financial line item definitions
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
    MetricDefinition(
        "investing_cash_flow",
        (
            "net cash used in investing activities",
            "net cash provided by investing activities",
            "cash flows used in investing activities",
            "cash flows from investing activities",
            "investing activities",
        ),
    ),
    MetricDefinition(
        "financing_cash_flow",
        (
            "net cash provided by (used in) financing activities",
            "net cash provided by financing activities",
            "net cash used in financing activities",
            "cash flows provided by financing activities",
            "cash flows used in financing activities",
            "financing activities",
        ),
    ),
    MetricDefinition(
        "capital_expenditures",
        (
            "purchases of property and equipment",
            "purchases of and prepayments for property and equipment",
            "capital expenditures",
            "additions to property and equipment",
            "purchase of property, plant and equipment",
        ),
    ),
    MetricDefinition(
        "stockholders_equity",
        (
            "total stockholders' equity",
            "total stockholders’ equity",
            "total shareholders' equity",
            "total shareholders’ equity",
            "total equity",
            "stockholders' equity",
            "stockholders’ equity",
            "shareholders' equity",
        ),
    ),
)

NUMBER_PATTERN = re.compile(
    r"(?<![\w,])(?P<opening>\()?\s*"
    r"(?P<currency>\$|€|£|₹|■|USD|EUR|GBP|INR)?\s*"
    r"(?P<number>(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)"
    r"\s*(?P<unit>million|millions|billion|billions|thousand|thousands|%|percent)?"
    r"\s*(?P<closing>\))?(?![\w,])",
    re.IGNORECASE,
)
YEAR_PATTERN = re.compile(r"(?:(?<=\D)|^)(?:19|20)\d{2}(?=\D|$)")

CURRENCY_SYMBOLS = {
    "€": "EUR",
    "£": "GBP",
    "₹": "INR",
    "INR": "INR",
    "■": "INR",
    "USD": "USD",
    "EUR": "EUR",
    "GBP": "GBP",
}
UNIT_NAMES = {
    "million": "million",
    "millions": "million",
    "billion": "billion",
    "billions": "billion",
    "thousand": "thousand",
    "thousands": "thousand",
}
UNSUPPORTED_CURRENCY_PATTERN = re.compile(r"\b(?!EPS\b)[A-Z]{3}\s*(?=\d)")
UNSUPPORTED_UNIT_PATTERN = re.compile(r"\b(?:trillion|crore|crores|lakh|lakhs)\b", re.IGNORECASE)

TABLE_SCALE_PATTERNS = {
    "thousand": re.compile(r"\(\s*(?:in|\$|usd|eur|gbp|inr|[■₹]\s+in)?\s*thousands\b", re.IGNORECASE),
    "million": re.compile(r"\(\s*(?:in|\$|usd|eur|gbp|inr|[■₹]\s+in)?\s*millions\b", re.IGNORECASE),
    "billion": re.compile(r"\(\s*(?:in|\$|usd|eur|gbp|inr|[■₹]\s+in)?\s*billions\b", re.IGNORECASE),
}

# Universal accounting, statutory, and document structural exclusions
EXCLUDED_PATTERNS = (
    # Statutory, tax, and securities regulations (never corporate financial statement facts)
    re.compile(r"\bInternal Revenue\b", re.IGNORECASE),
    re.compile(r"\bIRS\b", re.IGNORECASE),
    re.compile(r"\bPillar\s+\d+\b", re.IGNORECASE),
    re.compile(r"\bForm\s+\d+\s*-\s*[A-Z]\b", re.IGNORECASE),
    re.compile(r"\b401\s*\(\s*k\s*\)", re.IGNORECASE),
    re.compile(r"\bRule\s+\d+[a-z]?-\d+\b", re.IGNORECASE),
    re.compile(r"\bSection\s+\d+\b", re.IGNORECASE),
    # Outline / Note / Section titles (e.g. "2. REVENUE", "12. NET INCOME (LOSS) PER SHARE")
    re.compile(r"^\s*(\d+\.|\bNote\s+\d+[:.]?)\s+[A-Z\s\(\)/-]+$", re.IGNORECASE),
    re.compile(r"^\s*\(\d+\)\s+See\s+.*Note\s+\d+", re.IGNORECASE),
    re.compile(r"^\s*\(\d+\)\s+[A-Z]", re.IGNORECASE),
    # Accounting line item disambiguation:
    # Cost of revenue is Cost of Goods Sold (COGS expense), distinct from Revenue
    re.compile(r"\b(costs?|expenses?|amortization)\s+of\s+revenues?\b", re.IGNORECASE),
    # Deferred revenue is a balance sheet liability, distinct from Revenue
    re.compile(r"\bdeferred\s+revenues?\b", re.IGNORECASE),
    # Total liabilities & equity is the balance sheet footing, distinct from Total Liabilities
    re.compile(r"\b(and|plus)\s+(stockholders|shareholders)[\'’]?\s+equity\b", re.IGNORECASE),
    # Weighted average shares is share count, distinct from Earnings Per Share ($/share)
    re.compile(r"\bweighted\s+average\s+(common\s+)?shares\b", re.IGNORECASE),
    # Proceeds / repayment of debt is a financing cash flow activity, distinct from Total Debt balance
    re.compile(r"\b(proceeds|issuance|repayment)\s+(from|of)\s+long-term\s+debt\b", re.IGNORECASE),
    # Cash flow net change and beginning balances, distinct from period-end Cash and cash equivalents
    re.compile(r"\b(net\s+change|net\s+increase|net\s+decrease)\s+in\s+cash\b", re.IGNORECASE),
    re.compile(r"\bcash\s+(and\s+cash\s+equivalents\s+)?at\s+(beginning|start)\s+of\b", re.IGNORECASE),
)


@dataclass(frozen=True)
class AmountCandidate:
    value: float
    original_text: str
    currency: str | None
    unit: str | None
    start_pos: int = 0


def _is_excluded(line: str) -> bool:
    return any(pattern.search(line) for pattern in EXCLUDED_PATTERNS)


def _normalize_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def _matching_definitions(line: str) -> list[tuple[MetricDefinition, re.Match[str]]]:
    matches: list[tuple[MetricDefinition, re.Match[str]]] = []
    for definition in METRIC_DEFINITIONS:
        earliest_match: re.Match[str] | None = None
        for alias in definition.aliases:
            m = re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", line, re.IGNORECASE)
            if m:
                if earliest_match is None or m.start() < earliest_match.start():
                    earliest_match = m
        if earliest_match is not None:
            matches.append((definition, earliest_match))
    return matches


def _amount_candidates(line: str) -> list[AmountCandidate]:
    unsupported_currency = UNSUPPORTED_CURRENCY_PATTERN.search(line)
    if unsupported_currency and unsupported_currency.group(0).strip().upper() not in {
        "USD",
        "EUR",
        "GBP",
        "INR",
    }:
        return []
    if UNSUPPORTED_UNIT_PATTERN.search(line):
        return []

    # Page number artifact detection:
    # Trailing lone integer at the end of a prose sentence without currency or unit
    trailing_page_match = None
    if re.search(r"[a-z\.\,\)]\s+\d{1,3}\s*$", line):
        m = re.search(r"\b(\d{1,3})\s*$", line)
        if m:
            trailing_page_match = m.start()

    candidates: list[AmountCandidate] = []
    for match in NUMBER_PATTERN.finditer(line):
        currency_text = match.group("currency")
        unit_text = (match.group("unit") or "").lower()

        # If this number is an unformatted trailing page number at the end of a sentence, skip it
        if trailing_page_match is not None and match.start() >= trailing_page_match:
            if not currency_text and not unit_text:
                continue

        number_text = match.group("number")
        if len(number_text.replace(",", "")) == 4 and YEAR_PATTERN.fullmatch(
            number_text.replace(",", "")
        ):
            continue

        if unit_text in {"%", "percent"}:
            continue

        # Footnote / list enumerator detection:
        # Standalone 1 or 2 digit integer in parentheses with no currency, no unit, and no formatting (e.g. (1), (2))
        if match.group("opening") and match.group("closing"):
            is_accounting_negative = bool(
                currency_text
                or unit_text
                or "." in number_text
                or "," in number_text
                or len(number_text) >= 3
            )
            if not is_accounting_negative:
                continue

        value = float(number_text.replace(",", ""))
        if not math.isfinite(value):
            continue
        if match.group("opening") and match.group("closing"):
            value = -value

        currency = None
        if currency_text:
            currency_code = currency_text.upper()
            currency = CURRENCY_SYMBOLS.get(currency_code) or CURRENCY_SYMBOLS.get(currency_text)
            if currency is None and currency_code in {"USD", "EUR", "GBP", "INR"}:
                currency = currency_code

        candidates.append(
            AmountCandidate(
                value=value,
                original_text=match.group(0).strip(),
                currency=currency,
                unit=UNIT_NAMES.get(unit_text),
                start_pos=match.start(),
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


def _detect_document_currency(text: str) -> str | None:
    """Detects document-level reporting currency from standard corporate disclosure headers."""
    cur_match = re.search(
        r"(?:Currency|Reporting\s+Currency)\s*[:\n\r\-]*\s*([A-Za-z]{3}|\$|€|£|₹|■)",
        text[:10000],
        re.IGNORECASE,
    )
    if cur_match:
        code = cur_match.group(1).upper()
        if code in CURRENCY_SYMBOLS:
            return CURRENCY_SYMBOLS[code]
        if code in {"USD", "EUR", "GBP", "INR"}:
            return code
    if re.search(r"\b(?:u\.s\.\s+dollars?|dollars\s+in\s+(?:thousands|millions|billions))\b|\(dollars\s+in", text, re.IGNORECASE):
        return "USD"
    if re.search(r"\b(?:in\s+euros?|euros\s+in\s+(?:thousands|millions|billions))\b|\(euros\s+in", text, re.IGNORECASE):
        return "EUR"
    if re.search(r"\b(?:in\s+pounds?|pounds\s+in\s+(?:thousands|millions|billions))\b|\(pounds\s+in", text, re.IGNORECASE):
        return "GBP"
    if re.search(r"\b(?:in\s+rupees?|rupees\s+in\s+(?:thousands|millions|billions|crores?|lakhs?))\b|\(rupees\s+in", text, re.IGNORECASE):
        return "INR"
    return None


def _detect_document_focal_period(text: str) -> str | None:
    """Detects focal reporting fiscal year from standard cover/header disclosure."""
    match = re.search(
        r"(?:Current\s+Period|Fiscal\s+Year|Year\s+Ended)\s*[:\n\r\-]*\s*(?:FY\s*)?((?:19|20)\d{2})",
        text[:5000],
        re.IGNORECASE,
    )
    if match:
        return match.group(1)
    match = re.search(
        r"(?:year|period)\s+ended\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+((?:19|20)\d{2})",
        text[:5000],
        re.IGNORECASE,
    )
    if match:
        return match.group(1)
    return None


def _detect_document_unit(text: str) -> str | None:
    """Detects document-level primary unit scale from header metadata."""
    match = re.search(
        r"(?:Primary\s+Unit|Reporting\s+Unit|Scale)\s*[:\n\r\-]*\s*(?:[^\w\n\r]*\s*)?(million|billion|thousand)",
        text[:5000],
        re.IGNORECASE,
    )
    if match:
        return match.group(1).lower()
    return None


def _resolve_currency(
    candidate: AmountCandidate,
    source_context: str,
    doc_currency: str | None = None,
) -> str | None:
    if candidate.currency is not None:
        return candidate.currency
    if re.search(r"(?<!\w)USD(?!\w)", source_context, re.IGNORECASE):
        return "USD"
    if re.search(r"(?<!\w)EUR(?!\w)|€", source_context, re.IGNORECASE):
        return "EUR"
    if re.search(r"(?<!\w)GBP(?!\w)|£", source_context, re.IGNORECASE):
        return "GBP"
    if re.search(r"(?<!\w)INR(?!\w)|[₹■]", source_context, re.IGNORECASE):
        return "INR"
    if doc_currency is not None:
        if "$" in candidate.original_text or "$" in source_context:
            if doc_currency == "USD":
                return "USD"
        elif any(sym in candidate.original_text or sym in source_context for sym in ("■", "₹")):
            if doc_currency == "INR":
                return "INR"
        else:
            return doc_currency
    return None


def _metric_confidence_score(metric: FinancialMetric) -> float:
    """
    Pure logical confidence score based on universal accounting hierarchy:
    - Primary financial statement line items (Consolidated / Total) rank higher than sub-categories.
    - Explicit financial units and currency rank higher than bare numbers.
    - Explicit reporting periods rank higher than unstated periods, prioritizing focal fiscal years.
    - Unrestricted headline figures rank higher than restricted/footnote accounts.
    """
    score = 0.0

    # Explicit measurement units
    if metric.unit is not None:
        score += 40.0
    if metric.currency is not None:
        score += 30.0
    if metric.reporting_period is not None:
        score += 20.0
        try:
            score += (int(metric.reporting_period) - 2000) * 50.0
        except ValueError:
            pass

    ctx_lower = metric.source_context.lower()

    # Consolidated / Total accounting priority
    if "total" in ctx_lower or "consolidated" in ctx_lower:
        score += 25.0

    if metric.metric_name == "revenue":
        if re.search(r"\b(total\s+revenues?|net\s+sales|net\s+revenues?)\b", ctx_lower):
            score += 35.0
    elif metric.metric_name == "operating_cash_flow":
        if re.search(r"\b(operating\s+activities|cash\s+flows?\s+provided\s+by)\b", ctx_lower):
            score += 30.0
    elif metric.metric_name == "operating_profit":
        if re.search(r"\b(from\s+operations|operating\s+income|operating\s+profit)\b", ctx_lower):
            score += 30.0
    elif metric.metric_name == "total_debt":
        if re.search(r"\btotal\s+debt\b", ctx_lower):
            score += 30.0
    elif metric.metric_name == "cash_and_cash_equivalents":
        if re.search(r"\b(restricted|subsidiaries|escrow)\b", ctx_lower):
            score -= 30.0
    elif metric.metric_name == "earnings_per_share":
        if "diluted" in ctx_lower:
            score += 20.0
    elif metric.metric_name == "investing_cash_flow":
        if re.search(r"\b(net\s+cash\s+used\s+in\s+investing|investing\s+activities)\b", ctx_lower):
            score += 30.0
    elif metric.metric_name == "financing_cash_flow":
        if re.search(r"\b(financing\s+activities|net\s+cash\s+provided\s+by.*financing)\b", ctx_lower):
            score += 30.0
    elif metric.metric_name == "capital_expenditures":
        if re.search(r"\b(purchases\s+of\s+property\s+and\s+equipment|capital\s+expenditures)\b", ctx_lower):
            score += 30.0
    elif metric.metric_name == "stockholders_equity":
        if re.search(r"\btotal\s+(stockholders|shareholders)[\'’]?\s+equity\b", ctx_lower):
            score += 35.0

    # Reject non-financial bare integer artifacts
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
    doc_currency = _detect_document_currency(text)
    doc_focal_period = _detect_document_focal_period(text)
    doc_unit = _detect_document_unit(text)

    raw_metrics: list[FinancialMetric] = []
    active_table_scale: str | None = None
    active_column_years: list[str] | None = None

    for line_index, line in enumerate(lines):
        # Update active table statement scale if a scale marker is encountered
        for scale_name, scale_pattern in TABLE_SCALE_PATTERNS.items():
            if scale_pattern.search(line):
                active_table_scale = scale_name
                break

        # Track column year headers (single line with 2+ years, or consecutive single-year header lines)
        years = YEAR_PATTERN.findall(line)
        if len(years) >= 2 and len(re.findall(r"[a-zA-Z]", line)) <= 25:
            active_column_years = years
        elif (
            len(years) == 1
            and not _matching_definitions(line)
            and line_index + 1 < len(lines)
        ):
            next_line_years = YEAR_PATTERN.findall(lines[line_index + 1])
            if (
                len(next_line_years) == 1
                and not _matching_definitions(lines[line_index + 1])
                and len(re.findall(r"[a-zA-Z]", line)) <= 15
                and len(re.findall(r"[a-zA-Z]", lines[line_index + 1])) <= 15
            ):
                active_column_years = [years[0], next_line_years[0]]

        if _is_excluded(line):
            continue

        definition_matches = _matching_definitions(line)
        if len(definition_matches) != 1:
            continue

        definition, label_match = definition_matches[0]
        all_candidates = _amount_candidates(line)

        # In natural language and financial statements, the disclosed value appears AFTER the label
        candidates = [c for c in all_candidates if c.start_pos >= label_match.start()]
        source_context = line

        # If metric label was on its own line in a vertical table structure, assemble following table row lines
        if not candidates and line_index + 1 < len(lines):
            if _contains_percentage(line):
                continue
            block = [line]
            for offset in range(1, 4):
                if line_index + offset < len(lines):
                    next_l = lines[line_index + offset]
                    if _matching_definitions(next_l) or _is_excluded(next_l):
                        break
                    block.append(next_l)
            combined = " ".join(block)
            combined_cands = _amount_candidates(combined)
            if combined_cands:
                candidates = combined_cands
                source_context = combined

        if not candidates:
            continue

        selected_candidate: AmountCandidate | None = None
        is_table_row = False
        if len(candidates) == 1:
            selected_candidate = candidates[0]
            if (
                not line.rstrip().endswith(".")
                and (active_table_scale is not None or active_column_years is not None)
                and ("$" in source_context or "■" in source_context or "₹" in source_context or "," in selected_candidate.original_text)
            ):
                is_table_row = True
        elif len(candidates) > 1 and ":" not in line and (
            "$" in source_context
            or "■" in source_context
            or "₹" in source_context
            or "," in candidates[0].original_text
            or "(" in candidates[0].original_text
        ):
            # Financial statement table row: first column represents the focal (most recent) fiscal period
            selected_candidate = candidates[0]
            is_table_row = True

        if selected_candidate is None:
            continue

        candidate = selected_candidate

        # Unit resolution: explicit unit -> source context unit -> table scale -> document default unit
        cand_unit = candidate.unit
        if cand_unit is None and definition.name != "earnings_per_share":
            for u in ("million", "billion", "thousand"):
                if re.search(r"\b" + u + r"s?\b", source_context, re.IGNORECASE):
                    cand_unit = u
                    break
            if cand_unit is None and is_table_row and active_table_scale is not None:
                cand_unit = active_table_scale
            if cand_unit is None and doc_unit is not None:
                cand_unit = doc_unit

        candidate = AmountCandidate(
            value=candidate.value,
            original_text=candidate.original_text,
            currency=candidate.currency,
            unit=cand_unit,
            start_pos=candidate.start_pos,
        )

        # Handle explicit Net Loss, Operating Loss, or Cash Outflow ("cash used in") negation
        if candidate.value > 0 and re.search(
            r"\b(net\s+loss|loss\s+from\s+operations|cash\s+used\s+in)\b",
            source_context,
            re.IGNORECASE,
        ):
            candidate = AmountCandidate(
                value=-candidate.value,
                original_text=candidate.original_text,
                currency=candidate.currency,
                unit=candidate.unit,
                start_pos=candidate.start_pos,
            )

        reporting_periods = YEAR_PATTERN.findall(source_context)
        reporting_period = None
        if len(set(reporting_periods)) == 1:
            reporting_period = reporting_periods[0]
        elif reporting_periods:
            reporting_period = str(max(int(y) for y in reporting_periods))
        elif is_table_row and active_column_years:
            reporting_period = active_column_years[0]
        elif doc_focal_period is not None:
            reporting_period = doc_focal_period

        raw_metrics.append(
            FinancialMetric(
                metric_name=definition.name,
                value=candidate.value,
                original_reported_text=candidate.original_text,
                currency=_resolve_currency(candidate, source_context, doc_currency),
                unit=candidate.unit,
                reporting_period=reporting_period,
                source_context=source_context,
                extraction_method="deterministic_label_value_rule",
            )
        )

    # Deduplicate metrics by selecting the highest-confidence authoritative metric for each metric name
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
