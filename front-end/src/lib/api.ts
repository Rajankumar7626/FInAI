export type HealthResponse = {
  status: string
  service: string
}

export type DocumentMetadata = {
  document_id: string
  filename: string
  page_count: number
  extracted_character_count: number
  extraction_status: string
}

export type DocumentText = DocumentMetadata & {
  extracted_text: string
}

export type FinancialMetric = {
  metric_name: string
  value: number
  original_reported_text: string
  currency: 'USD' | 'EUR' | 'GBP' | null
  unit: 'thousand' | 'million' | 'billion' | null
  reporting_period: string | null
  source_context: string
  extraction_method: string
}

export type FinancialDataResponse = {
  document_id: string
  metrics: FinancialMetric[]
}

export type RiskMetricReference = {
  metric_name: string
  value: number
  currency: 'USD' | 'EUR' | 'GBP' | null
  unit: 'thousand' | 'million' | 'billion' | null
  reporting_period: string | null
  source_context: string
}

export type RiskObservation = {
  rule_id: string
  title: string
  severity: 'low' | 'medium' | 'high'
  explanation: string
  relevant_metrics: RiskMetricReference[]
  evidence: string[]
  limitation: string
}

export type RiskAnalysisResponse = {
  document_id: string
  observations: RiskObservation[]
  limitations: string[]
}

export type ComparedMetric = {
  metric_name: string
  display_name: string
  first_value: number | null
  second_value: number | null
  first_evidence: string | null
  second_evidence: string | null
  absolute_difference: number | null
  percentage_change: number | null
  currency: 'USD' | 'EUR' | 'GBP' | null
  unit: 'thousand' | 'million' | 'billion' | null
  reporting_period: string | null
  first_currency: 'USD' | 'EUR' | 'GBP' | null
  second_currency: 'USD' | 'EUR' | 'GBP' | null
  first_unit: 'thousand' | 'million' | 'billion' | null
  second_unit: 'thousand' | 'million' | 'billion' | null
  first_reporting_period: string | null
  second_reporting_period: string | null
  comparison_status: 'comparable' | 'unavailable' | 'incomparable'
  limitation: string | null
}

export type ComparisonResponse = {
  first_document_id: string
  second_document_id: string
  metrics: ComparedMetric[]
  limitations: string[]
}

export type ReportSourceDocument = {
  document_id: string
  filename: string
  metrics: FinancialMetric[]
}

export type ResearchReportResponse = {
  report_id: string
  generated_at: string
  report_type: 'single_document' | 'two_document_comparison'
  source_documents: ReportSourceDocument[]
  risk_observations: RiskObservation[]
  comparison: ComparisonResponse | null
  missing_information: string[]
  limitations: string[]
  methodology: {
    summary: string
    steps: string[]
  }
}

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
let accessTokenProvider: (() => Promise<string>) | null = null
let unauthorizedHandler: (() => void) | null = null

export function setApiAuthentication(
  tokenProvider: (() => Promise<string>) | null,
  onUnauthorized: (() => void) | null = null,
) {
  accessTokenProvider = tokenProvider
  unauthorizedHandler = onUnauthorized
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  const token = path === '/health' || !accessTokenProvider
    ? null
    : await accessTokenProvider().catch(() => {
      unauthorizedHandler?.()
      throw new ApiError('Your sign-in session has expired. Please sign in again.', 401)
    })

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError('The backend is unavailable. Check that the API server is running.', 0)
  }

  const payload = (await response.json().catch(() => null)) as { detail?: string } | T | null
  if (!response.ok) {
    if (response.status === 401) unauthorizedHandler?.()
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? payload.detail
      : undefined
    throw new ApiError(detail ?? `Request failed with status ${response.status}.`, response.status)
  }

  return payload as T
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

export function getDocuments(): Promise<DocumentMetadata[]> {
  return request<DocumentMetadata[]>('/documents')
}

export function getDocumentText(documentId: string): Promise<DocumentText> {
  return request<DocumentText>(`/documents/${documentId}/text`)
}

export function deleteDocument(documentId: string): Promise<{ document_id: string; deleted: boolean }> {
  return request(`/documents/${documentId}`, { method: 'DELETE' })
}

export function uploadDocument(file: File): Promise<DocumentText> {
  const formData = new FormData()
  formData.append('file', file)
  return request<DocumentText>('/documents/upload', {
    method: 'POST',
    body: formData,
  })
}

export function getFinancialData(documentId: string): Promise<FinancialDataResponse> {
  return request<FinancialDataResponse>(`/documents/${documentId}/financial-data`, {
    method: 'POST',
  })
}

export function getRiskAnalysis(documentId: string): Promise<RiskAnalysisResponse> {
  return request<RiskAnalysisResponse>(`/documents/${documentId}/risk-analysis`, {
    method: 'POST',
  })
}

export function compareDocuments(
  firstDocumentId: string,
  secondDocumentId: string,
): Promise<ComparisonResponse> {
  return request<ComparisonResponse>('/documents/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_document_id: firstDocumentId,
      second_document_id: secondDocumentId,
    }),
  })
}

export function generateReport(
  firstDocumentId: string,
  secondDocumentId?: string,
): Promise<ResearchReportResponse> {
  return request<ResearchReportResponse>('/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_document_id: firstDocumentId,
      ...(secondDocumentId ? { second_document_id: secondDocumentId } : {}),
    }),
  })
}
