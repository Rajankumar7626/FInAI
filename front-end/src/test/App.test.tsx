import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getHealth: vi.fn(),
  getDocuments: vi.fn(),
  getDocumentText: vi.fn(),
  deleteDocument: vi.fn(),
  uploadDocument: vi.fn(),
  getFinancialData: vi.fn(),
  getRiskAnalysis: vi.fn(),
  compareDocuments: vi.fn(),
  generateReport: vi.fn(),
  setApiAuthentication: vi.fn(),
}))
const authState = vi.hoisted(() => ({
  isLoading: false,
  isAuthenticated: true,
  user: { sub: 'test|dashboard-user', name: 'Test User' },
  error: undefined as Error | undefined,
  loginWithRedirect: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn(),
  getAccessTokenSilently: vi.fn().mockResolvedValue('synthetic-access-token'),
}))

vi.mock('../lib/api', () => ({
  ...api,
  ApiError: class ApiError extends Error {},
}))

vi.mock('../lib/authContext', () => ({
  useAuthSession: () => authState,
}))

import App from '../App'

const firstDocument = {
  document_id: '11111111-1111-1111-1111-111111111111',
  filename: 'first-report.pdf',
  page_count: 1,
  extracted_character_count: 120,
  extraction_status: 'completed',
}
const secondDocument = { ...firstDocument, document_id: '22222222-2222-2222-2222-222222222222', filename: 'second-report.pdf' }
type TestDocument = typeof firstDocument
const financialData = {
  document_id: firstDocument.document_id,
  metrics: [{
    metric_name: 'revenue',
    value: 100,
    original_reported_text: 'USD 100 million',
    currency: 'USD' as const,
    unit: 'million' as const,
    reporting_period: '2024',
    source_context: 'Revenue for 2024: USD 100 million',
    extraction_method: 'deterministic_label_value_rule',
  }],
}
const emptyRisk = { document_id: firstDocument.document_id, observations: [], limitations: [] }

function reportFixture() {
  return {
    report_id: 'report-1',
    generated_at: '2026-10-14T12:00:00Z',
    report_type: 'single_document' as const,
    source_documents: [{ document_id: firstDocument.document_id, filename: firstDocument.filename, metrics: financialData.metrics }],
    risk_observations: [],
    comparison: null,
    missing_information: [],
    limitations: [],
    methodology: { summary: 'Deterministic report', steps: ['Read source'] },
  }
}

function setupApi(documents: TestDocument[] = []) {
  api.getHealth.mockResolvedValue({ status: 'ok', service: 'finsight-ai' })
  api.getDocuments.mockResolvedValue(documents)
  api.getFinancialData.mockResolvedValue(financialData)
  api.getRiskAnalysis.mockResolvedValue(emptyRisk)
  api.getDocumentText.mockResolvedValue({ ...firstDocument, extracted_text: 'Revenue for 2024: USD 100 million' })
  api.deleteDocument.mockResolvedValue({ document_id: firstDocument.document_id, deleted: true })
  api.compareDocuments.mockResolvedValue({ first_document_id: firstDocument.document_id, second_document_id: secondDocument.document_id, metrics: [], limitations: [] })
  api.generateReport.mockResolvedValue(reportFixture())
}

describe('FinSight dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.isLoading = false
    authState.isAuthenticated = true
    authState.user = { sub: 'test|dashboard-user', name: 'Test User' }
    authState.error = undefined
    authState.loginWithRedirect.mockResolvedValue(undefined)
    authState.getAccessTokenSilently.mockResolvedValue('synthetic-access-token')
    setupApi()
  })

  it('shows sign-in instead of loading user data when signed out', async () => {
    authState.isAuthenticated = false
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(authState.loginWithRedirect).toHaveBeenCalled()
    expect(api.getDocuments).not.toHaveBeenCalled()
  })

  it('shows a generic sign-in error if the identity provider redirect fails', async () => {
    authState.isAuthenticated = false
    authState.loginWithRedirect.mockRejectedValueOnce(new Error('synthetic provider failure'))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in could not be completed.')
    expect(screen.getByRole('alert')).not.toHaveTextContent('synthetic provider failure')
  })

  it('clears document and analysis state before logging out', async () => {
    setupApi([firstDocument])
    render(<App />)
    await screen.findByRole('button', { name: /first-report\.pdf/ })
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(screen.getByText('No reports yet')).toBeInTheDocument())
    expect(authState.logout).toHaveBeenCalled()
  })

  it('shows loading and then the connected empty workspace', async () => {
    api.getHealth.mockReturnValue(new Promise(() => undefined))
    render(<App />)
    expect(screen.getByText('Checking')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('No reports yet')).toBeInTheDocument())
    expect(api.getHealth).toHaveBeenCalled()
  })

  it('loads documents, selects one, and displays extracted metrics', async () => {
    setupApi([firstDocument])
    render(<App />)

    await waitFor(() => expect(screen.getByRole('button', { name: /first-report\.pdf/ })).toBeInTheDocument())
    expect(await screen.findByText('revenue')).toBeInTheDocument()
    expect(screen.getByText('USD 100 million')).toBeInTheDocument()
    expect(api.getFinancialData).toHaveBeenCalledWith(firstDocument.document_id)
    expect(api.getRiskAnalysis).toHaveBeenCalledWith(firstDocument.document_id)
  })

  it('shows upload success and upload failure without fake success', async () => {
    setupApi()
    api.uploadDocument.mockResolvedValue({ ...firstDocument, extracted_text: 'Revenue' })
    api.getDocuments.mockResolvedValueOnce([]).mockResolvedValueOnce([firstDocument])
    const { rerender } = render(<App />)
    await waitFor(() => expect(screen.getByText('No reports yet')).toBeInTheDocument())

    const input = screen.getByLabelText('Upload PDF')
    const file = new File(['pdf'], 'report.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('first-report.pdf is ready for analysis.')).toBeInTheDocument())

    api.uploadDocument.mockRejectedValueOnce(new Error('Upload rejected'))
    rerender(<App />)
    fireEvent.change(screen.getByLabelText('Upload PDF'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('Upload rejected')).toBeInTheDocument())
  })

  it('shows analysis errors instead of claiming results succeeded', async () => {
    setupApi([firstDocument])
    api.getFinancialData.mockRejectedValueOnce(new Error('Analysis unavailable'))
    api.getRiskAnalysis.mockRejectedValueOnce(new Error('Analysis unavailable'))
    render(<App />)

    await waitFor(() => expect(screen.getByText('Analysis unavailable')).toBeInTheDocument())
  })

  it('requires a second document before comparison and supports comparison', async () => {
    setupApi([firstDocument, secondDocument])
    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: /first-report\.pdf/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Comparison/ }))
    expect(screen.getByRole('button', { name: 'Run comparison' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Second report'), { target: { value: secondDocument.document_id } })
    expect(screen.getByRole('button', { name: 'Run comparison' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }))
    await waitFor(() => expect(api.compareDocuments).toHaveBeenCalledWith(firstDocument.document_id, secondDocument.document_id))
  })

  it('generates a report and exposes report failures', async () => {
    setupApi([firstDocument])
    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: /first-report\.pdf/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Reports/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }))
    await waitFor(() => expect(screen.getByText('Research report')).toBeInTheDocument())
    expect(api.generateReport).toHaveBeenCalledWith(firstDocument.document_id, undefined)

    api.generateReport.mockRejectedValueOnce(new Error('Report unavailable'))
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }))
    await waitFor(() => expect(screen.getByText('Report unavailable')).toBeInTheDocument())
  })

  it('confirms deletion and refreshes the document list', async () => {
    setupApi([firstDocument])
    api.getDocuments.mockResolvedValueOnce([firstDocument]).mockResolvedValueOnce([])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: /first-report\.pdf/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Documents/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete document' }))
    await waitFor(() => expect(api.deleteDocument).toHaveBeenCalledWith(firstDocument.document_id))
    await waitFor(() => expect(screen.getByText('No reports yet')).toBeInTheDocument())
  })
})
