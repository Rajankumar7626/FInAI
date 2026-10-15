from __future__ import annotations

import math
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictFloat, model_validator


FinancialMetricName = Literal[
    "revenue",
    "net_income",
    "operating_profit",
    "total_assets",
    "total_liabilities",
    "total_debt",
    "cash_and_cash_equivalents",
    "operating_cash_flow",
    "earnings_per_share",
]


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(..., min_length=1)
    service: str = Field(..., min_length=1)


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detail: str = Field(..., min_length=1)


class DocumentUploadResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(..., min_length=1)
    filename: str = Field(..., min_length=1)
    page_count: int = Field(..., ge=1)
    extracted_character_count: int = Field(..., ge=1)
    extraction_status: str = Field(..., min_length=1)
    extracted_text: str = Field(..., min_length=1)


class DocumentMetadataResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(..., min_length=1)
    filename: str = Field(..., min_length=1)
    page_count: int = Field(..., ge=1)
    extracted_character_count: int = Field(..., ge=1)
    extraction_status: str = Field(..., min_length=1)


class DocumentTextResponse(DocumentMetadataResponse):
    extracted_text: str = Field(..., min_length=1)


class DocumentDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(..., min_length=1)
    deleted: bool


class FinancialMetric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_name: FinancialMetricName
    value: StrictFloat = Field(..., allow_inf_nan=False)
    original_reported_text: str = Field(..., min_length=1)
    currency: Literal["USD", "EUR", "GBP"] | None = None
    unit: Literal["thousand", "million", "billion"] | None = None
    reporting_period: str | None = Field(
        default=None,
        pattern=r"^(?:19|20)\d{2}$",
    )
    source_context: str = Field(..., min_length=1)
    extraction_method: str = Field(..., min_length=1)

    @model_validator(mode="after")
    def validate_evidence(self) -> "FinancialMetric":
        if self.original_reported_text not in self.source_context:
            raise ValueError("Source context must contain the original reported amount.")

        labels = {
            "revenue": ("revenue",),
            "net_income": ("net income", "net profit"),
            "operating_profit": ("operating profit", "operating income"),
            "total_assets": ("total assets",),
            "total_liabilities": ("total liabilities",),
            "total_debt": ("total debt",),
            "cash_and_cash_equivalents": ("cash and cash equivalents",),
            "operating_cash_flow": ("operating cash flow",),
            "earnings_per_share": ("earnings per share", "eps"),
        }
        if not any(
            re.search(rf"(?<!\w){re.escape(label)}(?!\w)", self.source_context, re.IGNORECASE)
            for label in labels[self.metric_name]
        ):
            raise ValueError("Source context must contain the extracted metric label.")
        if not math.isfinite(self.value):
            raise ValueError("Metric value must be finite.")
        return self


class FinancialDataResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(..., min_length=1)
    metrics: list[FinancialMetric]


class RiskMetricReference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_name: FinancialMetricName
    value: StrictFloat = Field(..., allow_inf_nan=False)
    currency: Literal["USD", "EUR", "GBP"] | None = None
    unit: Literal["thousand", "million", "billion"] | None = None
    reporting_period: str | None = Field(
        default=None,
        pattern=r"^(?:19|20)\d{2}$",
    )
    source_context: str = Field(..., min_length=1)


RiskRuleId = Literal[
    "negative_net_income",
    "negative_operating_cash_flow",
    "liabilities_exceed_assets",
    "high_debt_to_assets",
]
RiskSeverity = Literal["low", "medium", "high"]


class RiskObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rule_id: RiskRuleId
    title: str = Field(..., min_length=1)
    severity: RiskSeverity
    explanation: str = Field(..., min_length=1)
    relevant_metrics: list[RiskMetricReference] = Field(..., min_length=1)
    evidence: list[str] = Field(..., min_length=1)
    limitation: str = Field(..., min_length=1)


class RiskAnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(..., min_length=1)
    observations: list[RiskObservation]
    limitations: list[str]


ComparisonStatus = Literal["comparable", "unavailable", "incomparable"]


class ComparisonRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_document_id: str = Field(..., min_length=1)
    second_document_id: str = Field(..., min_length=1)


class ComparedMetric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_name: FinancialMetricName
    display_name: str = Field(..., min_length=1)
    first_value: StrictFloat | None = Field(default=None, allow_inf_nan=False)
    second_value: StrictFloat | None = Field(default=None, allow_inf_nan=False)
    first_evidence: str | None = None
    second_evidence: str | None = None
    absolute_difference: StrictFloat | None = Field(default=None, allow_inf_nan=False)
    percentage_change: StrictFloat | None = Field(default=None, allow_inf_nan=False)
    currency: Literal["USD", "EUR", "GBP"] | None = None
    unit: Literal["thousand", "million", "billion"] | None = None
    reporting_period: str | None = Field(
        default=None,
        pattern=r"^(?:19|20)\d{2}$",
    )
    first_currency: Literal["USD", "EUR", "GBP"] | None = None
    second_currency: Literal["USD", "EUR", "GBP"] | None = None
    first_unit: Literal["thousand", "million", "billion"] | None = None
    second_unit: Literal["thousand", "million", "billion"] | None = None
    first_reporting_period: str | None = Field(
        default=None,
        pattern=r"^(?:19|20)\d{2}$",
    )
    second_reporting_period: str | None = Field(
        default=None,
        pattern=r"^(?:19|20)\d{2}$",
    )
    comparison_status: ComparisonStatus
    limitation: str | None = None


class ComparisonResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_document_id: str = Field(..., min_length=1)
    second_document_id: str = Field(..., min_length=1)
    metrics: list[ComparedMetric]
    limitations: list[str]


class ReportGenerationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_document_id: str = Field(..., min_length=1)
    second_document_id: str | None = Field(default=None, min_length=1)


class ReportSourceDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(..., min_length=1)
    filename: str = Field(..., min_length=1)
    metrics: list[FinancialMetric]


class ReportMethodology(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(..., min_length=1)
    steps: list[str] = Field(..., min_length=1)


class ResearchReportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    report_id: str = Field(..., min_length=1)
    generated_at: datetime
    report_type: Literal["single_document", "two_document_comparison"]
    source_documents: list[ReportSourceDocument] = Field(..., min_length=1)
    risk_observations: list[RiskObservation]
    comparison: ComparisonResponse | None = None
    missing_information: list[str]
    limitations: list[str]
    methodology: ReportMethodology
