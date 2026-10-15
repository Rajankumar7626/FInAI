from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from backend.comparison_engine import SUPPORTED_METRIC_NAMES, compare_financial_data
from backend.document_registry import DocumentRecord
from backend.financial_extraction import extract_financial_data
from backend.risk_engine import analyze_financial_risk
from backend.schemas import (
    ComparisonResponse,
    FinancialDataResponse,
    ReportMethodology,
    ReportSourceDocument,
    ResearchReportResponse,
)


REPORT_METHODOLOGY = ReportMethodology(
    summary=(
        "This report combines deterministic PDF text extraction, rule-based risk "
        "indicators, and optional period-matched metric comparison."
    ),
    steps=[
        "Read the registered extracted text without modifying the source document.",
        "Extract supported financial metrics with their source evidence.",
        "Evaluate deterministic risk rules against each document's extracted metrics.",
        "Compare two documents only when currencies, units, and periods are compatible.",
    ],
)


def generate_research_report(
    first_document: DocumentRecord,
    second_document: DocumentRecord | None = None,
) -> ResearchReportResponse:
    first_data = extract_financial_data(
        first_document.document_id,
        first_document.extracted_text,
    )
    second_data = (
        extract_financial_data(
            second_document.document_id,
            second_document.extracted_text,
        )
        if second_document is not None
        else None
    )

    source_documents = [_source_document(first_document, first_data)]
    first_risk = analyze_financial_risk(first_data)
    risk_observations = list(first_risk.observations)
    limitations = list(first_risk.limitations)
    missing_information = _missing_information(first_document.filename, first_data)

    comparison: ComparisonResponse | None = None
    report_type: str = "single_document"
    if second_document is not None and second_data is not None:
        source_documents.append(_source_document(second_document, second_data))
        second_risk = analyze_financial_risk(second_data)
        risk_observations.extend(second_risk.observations)
        limitations.extend(second_risk.limitations)
        missing_information.extend(
            _missing_information(second_document.filename, second_data)
        )
        comparison = compare_financial_data(first_data, second_data)
        limitations.extend(comparison.limitations)
        report_type = "two_document_comparison"

    return ResearchReportResponse(
        report_id=str(uuid4()),
        generated_at=datetime.now(timezone.utc),
        report_type=report_type,
        source_documents=source_documents,
        risk_observations=risk_observations,
        comparison=comparison,
        missing_information=missing_information,
        limitations=_deduplicate(limitations),
        methodology=REPORT_METHODOLOGY.model_copy(deep=True),
    )


def _source_document(
    document: DocumentRecord,
    data: FinancialDataResponse,
) -> ReportSourceDocument:
    return ReportSourceDocument(
        document_id=document.document_id,
        filename=document.filename,
        metrics=data.metrics,
    )


def _missing_information(filename: str, data: FinancialDataResponse) -> list[str]:
    present = {metric.metric_name for metric in data.metrics}
    return [
        f"{name} was not extracted from {filename}."
        for name in SUPPORTED_METRIC_NAMES
        if name not in present
    ]


def _deduplicate(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))