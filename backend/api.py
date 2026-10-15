from __future__ import annotations

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.auth import Principal, get_current_principal
from backend.comparison_engine import compare_financial_data
from backend.document_service import DocumentProcessingError, process_document
from backend.document_registry import DocumentCapacityError, DocumentRecord, document_registry
from backend.financial_extraction import extract_financial_data
from backend.risk_engine import analyze_financial_risk
from backend.report_service import generate_research_report
from backend.schemas import (
    DocumentDeleteResponse,
    DocumentMetadataResponse,
    DocumentTextResponse,
    DocumentUploadResponse,
    ComparisonRequest,
    ComparisonResponse,
    ErrorResponse,
    FinancialDataResponse,
    HealthResponse,
    RiskAnalysisResponse,
    ReportGenerationRequest,
    ResearchReportResponse,
)
from backend.upload_limits import UploadRequestSizeLimitMiddleware

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=settings.app_description,
    debug=settings.debug,
)

app.add_middleware(
    UploadRequestSizeLimitMiddleware,
    max_request_size_bytes=settings.max_upload_request_size_bytes,
    max_concurrent_uploads=settings.max_concurrent_uploads,
    spool_memory_size_bytes=settings.upload_chunk_size_bytes,
    replay_chunk_size_bytes=settings.upload_chunk_size_bytes,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(detail=exc.detail).model_dump(mode="json"),
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(detail="Validation error").model_dump(mode="json"),
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="finsight-ai")


@app.post("/documents/upload", response_model=DocumentUploadResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    principal: Principal = Depends(get_current_principal),
) -> DocumentUploadResponse:
    try:
        result = await process_document(file, settings)
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None
    response = DocumentUploadResponse.model_validate(result)
    try:
        document_registry.add(DocumentRecord(**response.model_dump(), owner_id=principal.subject))
    except DocumentCapacityError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None
    return response


@app.get("/documents", response_model=list[DocumentMetadataResponse])
def list_documents(
    principal: Principal = Depends(get_current_principal),
) -> list[DocumentMetadataResponse]:
    return [
        DocumentMetadataResponse.model_validate(document, from_attributes=True)
        for document in document_registry.list_owned(principal.subject)
    ]


@app.get("/documents/{document_id}", response_model=DocumentMetadataResponse)
def get_document(document_id: str, principal: Principal = Depends(get_current_principal)) -> DocumentMetadataResponse:
    document = document_registry.get_owned(document_id, principal.subject)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return DocumentMetadataResponse.model_validate(document, from_attributes=True)


@app.get("/documents/{document_id}/text", response_model=DocumentTextResponse)
def get_document_text(document_id: str, principal: Principal = Depends(get_current_principal)) -> DocumentTextResponse:
    document = document_registry.get_owned(document_id, principal.subject)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return DocumentTextResponse.model_validate(document, from_attributes=True)


@app.delete("/documents/{document_id}", response_model=DocumentDeleteResponse)
def delete_document(document_id: str, principal: Principal = Depends(get_current_principal)) -> DocumentDeleteResponse:
    if not document_registry.delete_owned(document_id, principal.subject):
        raise HTTPException(status_code=404, detail="Document not found.")
    return DocumentDeleteResponse(document_id=document_id, deleted=True)


@app.post(
    "/documents/{document_id}/financial-data",
    response_model=FinancialDataResponse,
)
def extract_document_financial_data(document_id: str, principal: Principal = Depends(get_current_principal)) -> FinancialDataResponse:
    document = document_registry.get_owned(document_id, principal.subject)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return extract_financial_data(document.document_id, document.extracted_text)


@app.post(
    "/documents/{document_id}/risk-analysis",
    response_model=RiskAnalysisResponse,
)
def analyze_document_risk(document_id: str, principal: Principal = Depends(get_current_principal)) -> RiskAnalysisResponse:
    document = document_registry.get_owned(document_id, principal.subject)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    financial_data = extract_financial_data(document.document_id, document.extracted_text)
    return analyze_financial_risk(financial_data)


@app.post("/documents/compare", response_model=ComparisonResponse)
def compare_documents(
    request: ComparisonRequest,
    principal: Principal = Depends(get_current_principal),
) -> ComparisonResponse:
    first_document = document_registry.get_owned(request.first_document_id, principal.subject)
    second_document = document_registry.get_owned(request.second_document_id, principal.subject)
    if first_document is None or second_document is None:
        raise HTTPException(status_code=404, detail="One or both documents were not found.")

    first_data = extract_financial_data(
        first_document.document_id,
        first_document.extracted_text,
    )
    second_data = extract_financial_data(
        second_document.document_id,
        second_document.extracted_text,
    )
    return compare_financial_data(first_data, second_data)


@app.post("/reports/generate", response_model=ResearchReportResponse)
def generate_report(
    request: ReportGenerationRequest,
    principal: Principal = Depends(get_current_principal),
) -> ResearchReportResponse:
    first_document = document_registry.get_owned(request.first_document_id, principal.subject)
    if first_document is None:
        raise HTTPException(status_code=404, detail="First document was not found.")

    second_document = None
    if request.second_document_id is not None:
        second_document = document_registry.get_owned(request.second_document_id, principal.subject)
        if second_document is None:
            raise HTTPException(status_code=404, detail="Second document was not found.")

    return generate_research_report(first_document, second_document)
