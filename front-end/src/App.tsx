import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthSession } from './lib/authContext'
import './App.css'
import {
  ApiError,
  askDocumentQuestion,
  compareDocuments,
  deleteDocument,
  generateReport,
  getDocuments,
  getDocumentText,
  getFinancialData,
  getHealth,
  getRiskAnalysis,
  setApiAuthentication,
  type ComparisonResponse,
  type DocumentMetadata,
  type DocumentText,
  type FinancialDataResponse,
  type ResearchQuestionResponse,
  type ResearchReportResponse,
  type RiskAnalysisResponse,
  uploadDocument,
} from './lib/api'

type View = 'dashboard' | 'documents' | 'financials' | 'research' | 'risk' | 'comparison' | 'reports'
type RequestState = 'idle' | 'loading' | 'success' | 'error'

const navigation: { id: View; label: string; short: string }[] = [
  { id: 'dashboard', label: 'Dashboard', short: 'DB' },
  { id: 'documents', label: 'Documents', short: 'DOC' },
  { id: 'financials', label: 'Financials', short: 'FIN' },
  { id: 'research', label: 'Research Q&A', short: 'Q&A' },
  { id: 'risk', label: 'Risk analysis', short: 'RISK' },
  { id: 'comparison', label: 'Comparison', short: 'CMP' },
  { id: 'reports', label: 'Reports', short: 'RPT' },
]

function App() {
  const {
    isLoading,
    isAuthenticated,
    user,
    error,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuthSession()

  const [loginFailed, setLoginFailed] = useState(false)

  if (isLoading) {
    return (
      <main className="auth-screen">
        <p role="status">Checking sign-in…</p>
      </main>
    )
  }

  if (!isAuthenticated || !user?.sub) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <p className="section-kicker">FinSight AI</p>
          <h1>Sign in to your workspace</h1>
          <p>Your documents and analysis are available only to your account.</p>

          {(error || loginFailed) && (
            <div className="notice error" role="alert">
              {error?.message ? `Sign-in error: ${error.message}` : 'Sign-in could not be completed. Please try again.'}
            </div>
          )}

          <button
            type="button"
            className="primary-button"
            onClick={async () => {
              setLoginFailed(false)
              try {
                await loginWithRedirect()
              } catch (err: unknown) {
                console.error('Auth0 loginWithRedirect failed:', err)
                setLoginFailed(true)
              }
            }}
          >
            Sign in
          </button>
        </section>
      </main>
    )
  }

  return (
    <Workspace
      key={user.sub}
      userLabel={user.name ?? user.email ?? 'Signed in'}
      getAccessTokenSilently={getAccessTokenSilently}
      logout={logout}
    />
  )
}

function Workspace({
  userLabel,
  getAccessTokenSilently,
  logout,
}: {
  userLabel: string
  getAccessTokenSilently: () => Promise<string>
  logout: (options?: { logoutParams?: { returnTo?: string } }) => void | Promise<void>
}) {
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [secondId, setSecondId] = useState('')
  const [healthState, setHealthState] = useState<RequestState>('loading')
  const [healthMessage, setHealthMessage] = useState('Connecting to the analysis API...')
  const [documentState, setDocumentState] = useState<RequestState>('loading')
  const [documentMessage, setDocumentMessage] = useState('Loading document workspace...')
  const [selectedText, setSelectedText] = useState<DocumentText | null>(null)
  const [financialData, setFinancialData] = useState<FinancialDataResponse | null>(null)
  const [riskData, setRiskData] = useState<RiskAnalysisResponse | null>(null)
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
  const [report, setReport] = useState<ResearchReportResponse | null>(null)
  const [analysisState, setAnalysisState] = useState<RequestState>('idle')
  const [analysisMessage, setAnalysisMessage] = useState('Select a document to inspect its extracted facts.')
  const [textOpen, setTextOpen] = useState(false)
  const [uploadState, setUploadState] = useState<RequestState>('idle')
  const [uploadMessage, setUploadMessage] = useState('')

  // Research Q&A state
  const [researchQuery, setResearchQuery] = useState('')
  const [researchResponse, setResearchResponse] = useState<ResearchQuestionResponse | null>(null)
  const [researchState, setResearchState] = useState<RequestState>('idle')
  const [researchMessage, setResearchMessage] = useState('Ask any financial question about the selected report.')

  const clearUserData = useCallback(() => {
    setDocuments([])
    setSelectedId(null)
    setSecondId('')
    setSelectedText(null)
    setFinancialData(null)
    setRiskData(null)
    setComparison(null)
    setReport(null)
    setResearchResponse(null)
    setResearchQuery('')
    setTextOpen(false)
    setUploadState('idle')
    setUploadMessage('')
    setDocumentState('idle')
    setDocumentMessage('')
    setAnalysisState('idle')
    setAnalysisMessage('')
  }, [])

  const handleLogout = useCallback(() => {
    setApiAuthentication(null)
    clearUserData()
    void logout({ logoutParams: { returnTo: window.location.origin } })
  }, [clearUserData, logout])

  useEffect(() => {
    setApiAuthentication(
      () => getAccessTokenSilently(),
      handleLogout,
    )
    return () => setApiAuthentication(null)
  }, [getAccessTokenSilently, handleLogout])

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.document_id === selectedId) ?? null,
    [documents, selectedId],
  )

  const refreshDocuments = useCallback(async (preferredId?: string) => {
    setDocumentState('loading')
    setDocumentMessage('Loading document workspace...')
    try {
      const nextDocuments = await getDocuments()
      setDocuments(nextDocuments)
      setSelectedId((currentSelectedId) => {
        if (preferredId && nextDocuments.some((item) => item.document_id === preferredId)) return preferredId
        if (currentSelectedId && nextDocuments.some((item) => item.document_id === currentSelectedId)) return currentSelectedId
        return nextDocuments[0]?.document_id ?? null
      })
      setSecondId((current) => current && nextDocuments.some((item) => item.document_id === current) ? current : '')
      setDocumentState('success')
      setDocumentMessage(
        nextDocuments.length
          ? `${nextDocuments.length} document${nextDocuments.length === 1 ? '' : 's'} in workspace.`
          : 'No documents uploaded yet.',
      )
    } catch (err) {
      setDocumentState('error')
      setDocumentMessage(getErrorMessage(err))
    }
  }, [])

  const checkHealth = useCallback(async () => {
    setHealthState('loading')
    setHealthMessage('Connecting to the analysis API...')
    try {
      const health = await getHealth()
      setHealthState('success')
      setHealthMessage(`${health.service} is responding normally.`)
    } catch (err) {
      setHealthState('error')
      setHealthMessage(getErrorMessage(err))
    }
  }, [])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (!active) return
      void checkHealth()
      void refreshDocuments()
    })
    return () => {
      active = false
    }
  }, [checkHealth, refreshDocuments])

  useEffect(() => {
    if (!selectedId) return

    let cancelled = false
    Promise.all([getFinancialData(selectedId), getRiskAnalysis(selectedId)])
      .then(([facts, risks]) => {
        if (cancelled) return
        setFinancialData(facts)
        setRiskData(risks)
        setAnalysisState('success')
        setAnalysisMessage('Analysis refreshed from the registered document text.')
      })
      .catch((err) => {
        if (cancelled) return
        setAnalysisState('error')
        setAnalysisMessage(getErrorMessage(err))
      })

    return () => {
      cancelled = true
    }
  }, [selectedId])

  function selectDocument(documentId: string) {
    setSelectedId(documentId)
    setFinancialData(null)
    setRiskData(null)
    setSelectedText(null)
    setComparison(null)
    setReport(null)
    setResearchResponse(null)
    setAnalysisState('loading')
    setAnalysisMessage('Extracting financial facts and evaluating deterministic indicators...')
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadState('error')
      setUploadMessage('Please choose a PDF file.')
      return
    }
    setUploadState('loading')
    setUploadMessage('Uploading and extracting text...')
    try {
      const uploaded = await uploadDocument(file)
      await refreshDocuments(uploaded.document_id)
      selectDocument(uploaded.document_id)
      setUploadState('success')
      setUploadMessage(`${uploaded.filename} is ready for analysis.`)
      setActiveView('documents')
    } catch (err) {
      setUploadState('error')
      setUploadMessage(getErrorMessage(err))
    }
  }

  async function handleDelete() {
    if (!selectedDocument) return
    if (!window.confirm(`Delete ${selectedDocument.filename} from this workspace?`)) return
    try {
      await deleteDocument(selectedDocument.document_id)
      setSelectedText(null)
      setFinancialData(null)
      setRiskData(null)
      setComparison(null)
      setReport(null)
      setResearchResponse(null)
      await refreshDocuments()
    } catch (err) {
      setDocumentState('error')
      setDocumentMessage(getErrorMessage(err))
    }
  }

  async function viewExtractedText() {
    if (!selectedId) return
    setTextOpen(true)
    try {
      setSelectedText(await getDocumentText(selectedId))
    } catch (err) {
      setAnalysisState('error')
      setAnalysisMessage(getErrorMessage(err))
    }
  }

  async function handleAskQuestion(customQuery?: string) {
    const q = customQuery ?? researchQuery
    if (!selectedId || !q.trim()) return
    setResearchState('loading')
    setResearchMessage('Analyzing document disclosures and verifying citations...')
    try {
      const res = await askDocumentQuestion(selectedId, q.trim())
      setResearchResponse(res)
      setResearchState('success')
      setResearchMessage(
        res.status === 'answered'
          ? 'Answer generated with grounded citations.'
          : 'Insufficient evidence in document disclosures.',
      )
    } catch (err) {
      setResearchState('error')
      setResearchMessage(getErrorMessage(err))
    }
  }

  async function runComparison() {
    if (!selectedId || !secondId || selectedId === secondId) return
    setAnalysisState('loading')
    setAnalysisMessage('Comparing compatible extracted metrics...')
    try {
      setComparison(await compareDocuments(selectedId, secondId))
      setActiveView('comparison')
      setAnalysisState('success')
      setAnalysisMessage('Comparison complete. Limitations are shown alongside each result.')
    } catch (err) {
      setAnalysisState('error')
      setAnalysisMessage(getErrorMessage(err))
    }
  }

  async function runReport() {
    if (!selectedId) return
    setAnalysisState('loading')
    setAnalysisMessage('Assembling source facts, risk observations, and limitations...')
    try {
      setReport(await generateReport(selectedId, secondId || undefined))
      setActiveView('reports')
      setAnalysisState('success')
      setAnalysisMessage('Research report generated from workspace data.')
    } catch (err) {
      setAnalysisState('error')
      setAnalysisMessage(getErrorMessage(err))
    }
  }

  const canCompare = Boolean(selectedId && secondId && selectedId !== secondId)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">F</div>
          <div>
            <strong>FinSight</strong>
            <span>Research workspace</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <span className="nav-heading">Workspace</span>
          {navigation.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => setActiveView(item.id)}
            >
              <span className="nav-code">{item.short}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className={`connection-dot ${healthState}`} />
          <div>
            <span>API connection</span>
            <strong>
              {healthState === 'success'
                ? 'Online'
                : healthState === 'loading'
                  ? 'Checking'
                  : 'Offline'}
            </strong>
          </div>
          <button type="button" className="text-button" onClick={() => void checkHealth()}>
            Retry
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="section-kicker">Financial intelligence / {userLabel}</p>
            <h1>{navigation.find((item) => item.id === activeView)?.label}</h1>
          </div>

          <button type="button" className="text-button" onClick={handleLogout}>
            Log out
          </button>

          <label className="upload-button">
            <span>{uploadState === 'loading' ? 'Uploading...' : 'Upload PDF'}</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => void handleUpload(event.target.files?.[0])}
              disabled={uploadState === 'loading'}
            />
          </label>
        </header>

        {uploadMessage && (
          <div className={`notice ${uploadState}`} role="status">
            {uploadMessage}
          </div>
        )}

        {healthState === 'error' && (
          <div className="notice error" role="alert">
            {healthMessage}
          </div>
        )}

        {activeView === 'dashboard' && (
          <DashboardView
            documents={documents}
            documentState={documentState}
            documentMessage={documentMessage}
            selectedDocument={selectedDocument}
            financialData={financialData}
            analysisState={analysisState}
            analysisMessage={analysisMessage}
            onSelect={selectDocument}
            onNavigate={setActiveView}
            onUpload={(file) => void handleUpload(file)}
            onViewText={() => void viewExtractedText()}
            onDelete={() => void handleDelete()}
          />
        )}

        {activeView === 'documents' && (
          <DocumentsView
            documents={documents}
            documentState={documentState}
            documentMessage={documentMessage}
            selectedId={selectedId}
            financialData={financialData}
            onSelect={selectDocument}
            onUpload={(file) => void handleUpload(file)}
            onViewText={() => void viewExtractedText()}
            onDelete={() => void handleDelete()}
          />
        )}

        {activeView === 'financials' && (
          <FinancialsView
            documents={documents}
            selectedId={selectedId}
            selectedDocument={selectedDocument}
            financialData={financialData}
            onSelect={selectDocument}
            state={analysisState}
            message={analysisMessage}
          />
        )}

        {activeView === 'research' && (
          <ResearchView
            documents={documents}
            selectedId={selectedId}
            onSelect={selectDocument}
            researchQuery={researchQuery}
            onQueryChange={setResearchQuery}
            onAsk={handleAskQuestion}
            response={researchResponse}
            state={researchState}
            message={researchMessage}
          />
        )}

        {activeView === 'risk' && (
          <RiskView
            riskData={riskData}
            selectedDocument={selectedDocument}
            state={analysisState}
            message={analysisMessage}
          />
        )}

        {activeView === 'comparison' && (
          <ComparisonView
            documents={documents}
            selectedId={selectedId}
            secondId={secondId}
            comparison={comparison}
            canCompare={canCompare}
            onSecondChange={setSecondId}
            onCompare={() => void runComparison()}
            state={analysisState}
            message={analysisMessage}
          />
        )}

        {activeView === 'reports' && (
          <ReportsView
            documents={documents}
            selectedId={selectedId}
            secondId={secondId}
            report={report}
            onSecondChange={setSecondId}
            onGenerate={() => void runReport()}
            state={analysisState}
            message={analysisMessage}
          />
        )}
      </main>

      {textOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTextOpen(false)
          }}
        >
          <section
            className="text-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="text-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="section-kicker">Source document</p>
                <h2 id="text-modal-title">Extracted text</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close extracted text"
                onClick={() => setTextOpen(false)}
              >
                Close
              </button>
            </div>
            {selectedText ? (
              <pre>{selectedText.extracted_text}</pre>
            ) : (
              <div className="loading-block">Loading source text...</div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function DragDropUploadZone({
  onUpload,
  loading,
}: {
  onUpload: (file: File) => void
  loading: boolean
}) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      className={`dropzone-container ${isDragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) onUpload(file)
      }}
      onClick={() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/pdf,.pdf'
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) onUpload(file)
        }
        input.click()
      }}
    >
      <strong>{loading ? 'Processing Document...' : 'Drag & Drop Financial PDF Here'}</strong>
      <p>or click to browse from your device (10 MiB limit, text-based PDF)</p>
    </div>
  )
}

function DashboardView(props: {
  documents: DocumentMetadata[]
  documentState: RequestState
  documentMessage: string
  selectedDocument: DocumentMetadata | null
  financialData: FinancialDataResponse | null
  analysisState: RequestState
  analysisMessage: string
  onSelect: (id: string) => void
  onNavigate: (view: View) => void
  onUpload: (file: File) => void
  onViewText: () => void
  onDelete: () => void
}) {
  return (
    <>
      <section className="hero-band">
        <div>
          <p className="section-kicker">Evidence-first analysis</p>
          <h2>Turn financial reports into a reviewable workspace.</h2>
          <p>
            Upload a text-based PDF, inspect extracted facts, ask research questions, and evaluate deterministic risk and comparison indicators.
          </p>
        </div>

        <div className="hero-stamp">
          <span>STORAGE</span>
          <strong>POSTGRESQL</strong>
          <small>Persistent & Secured</small>
        </div>
      </section>

      <DragDropUploadZone onUpload={props.onUpload} loading={props.analysisState === 'loading'} />

      <section className="summary-grid" aria-label="Workspace summary">
        <SummaryCard
          label="Documents"
          value={String(props.documents.length)}
          detail={props.documentMessage}
        />
        <SummaryCard
          label="Selected report"
          value={props.selectedDocument ? '1' : '0'}
          detail={props.selectedDocument?.filename ?? 'Choose a document to begin'}
        />
        <SummaryCard
          label="Analysis state"
          value={
            props.analysisState === 'success'
              ? 'Ready'
              : props.analysisState === 'loading'
                ? 'Working'
                : 'Idle'
          }
          detail={props.analysisMessage}
        />
      </section>

      <section className="workspace-grid">
        <DocumentList
          documents={props.documents}
          documentState={props.documentState}
          documentMessage={props.documentMessage}
          selectedId={props.selectedDocument?.document_id}
          onSelect={props.onSelect}
        />
        <SelectedDocumentPanel
          selectedDocument={props.selectedDocument}
          financialData={props.financialData}
          onViewText={props.onViewText}
          onDelete={props.onDelete}
          onNavigate={props.onNavigate}
        />
      </section>
    </>
  )
}

function DocumentsView(props: {
  documents: DocumentMetadata[]
  documentState: RequestState
  documentMessage: string
  selectedId: string | null
  financialData: FinancialDataResponse | null
  onSelect: (id: string) => void
  onUpload: (file: File) => void
  onViewText: () => void
  onDelete: () => void
}) {
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="section-kicker">Database registry</p>
          <h2>Uploaded documents</h2>
        </div>
        <span className="count-badge">{props.documents.length} active</span>
      </div>

      <DragDropUploadZone onUpload={props.onUpload} loading={props.documentState === 'loading'} />

      <DocumentList
        documents={props.documents}
        documentState={props.documentState}
        documentMessage={props.documentMessage}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
      />

      <SelectedDocumentPanel
        selectedDocument={
          props.documents.find((item) => item.document_id === props.selectedId) ?? null
        }
        financialData={props.financialData}
        onViewText={props.onViewText}
        onDelete={props.onDelete}
      />
    </section>
  )
}

function FinancialsView({
  documents,
  selectedId,
  selectedDocument,
  financialData,
  onSelect,
  state,
  message,
}: {
  documents: DocumentMetadata[]
  selectedId: string | null
  selectedDocument: DocumentMetadata | null
  financialData: FinancialDataResponse | null
  onSelect: (id: string) => void
  state: RequestState
  message: string
}) {
  const metrics = financialData?.metrics ?? []
  const incomeMetrics = metrics.filter((m) =>
    ['revenue', 'net_income', 'operating_profit', 'earnings_per_share'].includes(m.metric_name),
  )
  const balanceSheetMetrics = metrics.filter((m) =>
    ['total_assets', 'total_liabilities', 'total_debt', 'cash_and_cash_equivalents'].includes(m.metric_name),
  )
  const cashFlowMetrics = metrics.filter((m) =>
    ['operating_cash_flow'].includes(m.metric_name),
  )

  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="section-kicker">Financial Disclosures</p>
          <h2>Financial Statements & Metrics</h2>
        </div>
        <span className="context-label">{selectedDocument?.filename ?? 'No document selected'}</span>
      </div>

      <section className="panel compare-controls">
        <label style={{ gridColumn: '1 / -1' }}>
          <span>Select Document</span>
          <select value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value)}>
            <option value="">Choose a document</option>
            {documents.map((d) => (
              <option key={d.document_id} value={d.document_id}>
                {d.filename}
              </option>
            ))}
          </select>
        </label>
      </section>

      {state === 'loading' && <div className="panel loading-block">{message}</div>}
      {state === 'error' && <div className="notice error">{message}</div>}

      {!selectedDocument && (
        <section className="panel">
          <EmptyState
            title="No report selected"
            body="Select a document from above to view its structured financial statements."
          />
        </section>
      )}

      {selectedDocument && financialData && (
        <>
          <div className="financials-statements-grid">
            <div className="statement-card">
              <h3>Income Statement</h3>
              {incomeMetrics.length ? (
                incomeMetrics.map((m) => (
                  <div className="statement-metric-row" key={m.metric_name}>
                    <div>
                      <div className="statement-metric-name">{m.metric_name.replace(/_/g, ' ')}</div>
                      <div className="statement-context">"{m.source_context}"</div>
                    </div>
                    <div className="statement-metric-val">{formatValue(m.value, m.currency, m.unit)}</div>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No income statement figures extracted.</p>
              )}
            </div>

            <div className="statement-card">
              <h3>Balance Sheet</h3>
              {balanceSheetMetrics.length ? (
                balanceSheetMetrics.map((m) => (
                  <div className="statement-metric-row" key={m.metric_name}>
                    <div>
                      <div className="statement-metric-name">{m.metric_name.replace(/_/g, ' ')}</div>
                      <div className="statement-context">"{m.source_context}"</div>
                    </div>
                    <div className="statement-metric-val">{formatValue(m.value, m.currency, m.unit)}</div>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No balance sheet figures extracted.</p>
              )}
            </div>

            <div className="statement-card">
              <h3>Cash Flow & Liquidity</h3>
              {cashFlowMetrics.length ? (
                cashFlowMetrics.map((m) => (
                  <div className="statement-metric-row" key={m.metric_name}>
                    <div>
                      <div className="statement-metric-name">{m.metric_name.replace(/_/g, ' ')}</div>
                      <div className="statement-context">"{m.source_context}"</div>
                    </div>
                    <div className="statement-metric-val">{formatValue(m.value, m.currency, m.unit)}</div>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No cash flow figures extracted.</p>
              )}
            </div>
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Complete Registry</p>
                <h2>All Disclosed Facts ({metrics.length})</h2>
              </div>
            </div>
            <MetricFactList metrics={metrics} />
          </section>
        </>
      )}
    </section>
  )
}

function ResearchView({
  documents,
  selectedId,
  onSelect,
  researchQuery,
  onQueryChange,
  onAsk,
  response,
  state,
  message,
}: {
  documents: DocumentMetadata[]
  selectedId: string | null
  onSelect: (id: string) => void
  researchQuery: string
  onQueryChange: (q: string) => void
  onAsk: (q?: string) => void
  response: ResearchQuestionResponse | null
  state: RequestState
  message: string
}) {
  const selectedDoc = documents.find((d) => d.document_id === selectedId)
  const suggestions = [
    'What was the total revenue?',
    'What is the net income or profit?',
    'What are the debt and borrowings?',
    'What are the financial risks or red flags?',
    'What are the total assets and liabilities?',
  ]

  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="section-kicker">Evidence-backed inquiry</p>
          <h2>Financial Research Agent</h2>
        </div>
        <span className="context-label">{selectedDoc?.filename ?? 'No document selected'}</span>
      </div>

      <section className="panel qa-controls">
        <label>
          <span>Target Document</span>
          <select value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value)}>
            <option value="">Choose a report to inspect</option>
            {documents.map((item) => (
              <option key={item.document_id} value={item.document_id}>
                {item.filename}
              </option>
            ))}
          </select>
        </label>

        <form
          className="qa-input-row"
          onSubmit={(e) => {
            e.preventDefault()
            onAsk()
          }}
        >
          <input
            type="text"
            placeholder="Ask a question about financial metrics, risks, or performance..."
            value={researchQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            disabled={!selectedId || state === 'loading'}
          />
          <button
            type="submit"
            className="primary-button"
            disabled={!selectedId || !researchQuery.trim() || state === 'loading'}
          >
            {state === 'loading' ? 'Analyzing...' : 'Ask Agent'}
          </button>
        </form>

        <div className="prompt-chips">
          <span>Quick prompts:</span>
          {suggestions.map((prompt) => (
            <button
              type="button"
              key={prompt}
              className="prompt-chip"
              disabled={!selectedId || state === 'loading'}
              onClick={() => {
                onQueryChange(prompt)
                onAsk(prompt)
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      {state === 'loading' && <div className="panel loading-block">{message}</div>}
      {state === 'error' && <div className="notice error">{message}</div>}

      {response && (
        <article className="qa-response-card">
          <div className="qa-header">
            <div>
              <p className="section-kicker">Research Synthesis</p>
              <h3>{response.question}</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span
                className="qa-status-chip"
                style={{
                  background: response.analysis_mode === 'gemini_ai' ? '#e3f2fd' : '#f0f4f2',
                  color: response.analysis_mode === 'gemini_ai' ? '#0d47a1' : '#2d4b3e',
                }}
              >
                {response.analysis_mode === 'gemini_ai' ? '🤖 Gemini AI' : '⚡ Offline Engine'}
              </span>
              <span className={`qa-status-chip ${response.status}`}>
                {response.status === 'answered' ? 'Evidence Verified' : 'Insufficient Disclosures'}
              </span>
            </div>
          </div>

          <p className="qa-answer">{response.answer}</p>

          {response.relevant_metrics.length > 0 && (
            <div style={{ marginTop: '16px', marginBottom: '16px' }}>
              <p className="section-kicker">Extracted Metric Facts</p>
              <MetricFactList metrics={response.relevant_metrics} />
            </div>
          )}

          {response.citations.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p className="section-kicker">Source Evidence Citations</p>
              <div className="citation-list">
                {response.citations.map((cite, idx) => (
                  <div className="citation-card" key={idx}>
                    <p>"{cite.excerpt}"</p>
                    <div className="citation-meta">
                      <span>Relevance: {Math.round(cite.relevance_score * 100)}%</span>
                      {cite.matched_term && <span>Matched: {cite.matched_term}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {response.limitations.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <Limitations items={response.limitations} />
            </div>
          )}
        </article>
      )}
    </section>
  )
}

function DocumentList({
  documents,
  documentState,
  documentMessage,
  selectedId,
  onSelect,
}: {
  documents: DocumentMetadata[]
  documentState: RequestState
  documentMessage: string
  selectedId?: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="panel document-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Source library</p>
          <h2>Documents</h2>
        </div>
        <span className="count-badge">{documents.length}</span>
      </div>

      {documentState === 'loading' && <div className="loading-block">{documentMessage}</div>}

      {documentState !== 'loading' && documents.length === 0 && (
        <EmptyState
          title="No reports yet"
          body="Upload a PDF to create the first source in this workspace."
        />
      )}

      <div className="document-list">
        {documents.map((doc) => (
          <button
            type="button"
            className={`document-row ${selectedId === doc.document_id ? 'selected' : ''}`}
            key={doc.document_id}
            onClick={() => onSelect(doc.document_id)}
          >
            <span className="file-token">PDF</span>
            <span className="document-row-main">
              <strong>{doc.filename}</strong>
              <small>
                {doc.page_count} page{doc.page_count === 1 ? '' : 's'} /{' '}
                {doc.extracted_character_count.toLocaleString()} characters
              </small>
            </span>
            <span className="row-arrow">Open</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function SelectedDocumentPanel({
  selectedDocument,
  financialData,
  onViewText,
  onDelete,
  onNavigate,
}: {
  selectedDocument?: DocumentMetadata | null
  financialData?: FinancialDataResponse | null
  onViewText: () => void
  onDelete: () => void
  onNavigate?: (view: View) => void
}) {
  if (!selectedDocument) {
    return (
      <section className="panel detail-panel">
        <EmptyState
          title="Select a document"
          body="Choose a source from the library to inspect metrics, ask questions, and evaluate risk indicators."
        />
      </section>
    )
  }

  return (
    <section className="panel detail-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Selected source</p>
          <h2>{selectedDocument.filename}</h2>
        </div>
        <span className="status-chip">{selectedDocument.extraction_status}</span>
      </div>

      <div className="detail-facts">
        <div>
          <span>Pages</span>
          <strong>{selectedDocument.page_count}</strong>
        </div>
        <div>
          <span>Characters</span>
          <strong>{selectedDocument.extracted_character_count.toLocaleString()}</strong>
        </div>
      </div>

      <p className="muted-copy">
        Extracted metrics and analysis are persisted in your encrypted PostgreSQL database.
      </p>

      {financialData && <MetricFactList metrics={financialData.metrics.slice(0, 4)} />}

      {!financialData && (
        <div className="loading-block">Loading extracted metrics...</div>
      )}

      <div className="action-row">
        <button type="button" className="secondary-button" onClick={onViewText}>
          View extracted text
        </button>
        <button type="button" className="danger-button" onClick={onDelete}>
          Delete document
        </button>
      </div>

      {onNavigate && (
        <div className="action-row secondary-actions">
          <button type="button" className="link-button" onClick={() => onNavigate('financials')}>
            View all financials
          </button>
          <button type="button" className="link-button" onClick={() => onNavigate('research')}>
            Ask Research Agent
          </button>
          <button type="button" className="link-button" onClick={() => onNavigate('risk')}>
            Open risk analysis
          </button>
          <button type="button" className="link-button" onClick={() => onNavigate('reports')}>
            Generate report
          </button>
        </div>
      )}
    </section>
  )
}

function RiskView({
  riskData,
  selectedDocument,
  state,
  message,
}: {
  riskData: RiskAnalysisResponse | null
  selectedDocument: DocumentMetadata | null
  state: RequestState
  message: string
}) {
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="section-kicker">Rule-based review</p>
          <h2>Risk analysis</h2>
        </div>
        <span className="context-label">
          {selectedDocument?.filename ?? 'No document selected'}
        </span>
      </div>

      {state === 'loading' && <div className="panel loading-block">{message}</div>}
      {state === 'error' && <div className="notice error">{message}</div>}

      {riskData && (
        <>
          <div className="risk-grid">
            {riskData.observations.length ? (
              riskData.observations.map((observation) => (
                <RiskCard key={observation.rule_id} observation={observation} />
              ))
            ) : (
              <div className="panel">
                <EmptyState
                  title="No triggered indicators"
                  body="No supported risk rule triggered for the selected document."
                />
              </div>
            )}
          </div>

          <Limitations items={riskData.limitations} />
        </>
      )}
    </section>
  )
}

function ComparisonVisualChart({
  comparison,
  firstName,
  secondName,
}: {
  comparison: ComparisonResponse
  firstName: string
  secondName: string
}) {
  const comparableMetrics = comparison.metrics.filter(
    (m) => m.comparison_status === 'comparable' && m.first_value !== null && m.second_value !== null,
  )

  if (!comparableMetrics.length) return null

  return (
    <div className="visual-comparison-card">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Visual Comparison</p>
          <h2>Relative Metric Benchmarks</h2>
        </div>
        <div style={{ display: 'flex', gap: '14px', fontSize: '.72rem', fontWeight: 700 }}>
          <span style={{ color: '#3b82f6' }}>● {firstName}</span>
          <span style={{ color: '#10b981' }}>● {secondName}</span>
        </div>
      </div>

      <div className="chart-grid">
        {comparableMetrics.map((metric) => {
          const val1 = Math.abs(metric.first_value ?? 0)
          const val2 = Math.abs(metric.second_value ?? 0)
          const maxVal = Math.max(val1, val2) || 1
          const pct1 = Math.round((val1 / maxVal) * 100)
          const pct2 = Math.round((val2 / maxVal) * 100)

          return (
            <div className="chart-metric-row" key={metric.metric_name}>
              <div className="chart-metric-header">
                <span>{metric.display_name}</span>
                {metric.percentage_change !== null && (
                  <span style={{ color: metric.percentage_change >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatSigned(metric.percentage_change)}%
                  </span>
                )}
              </div>

              <div className="chart-bars-wrap">
                <div className="chart-bar-item">
                  <span className="chart-bar-label">{firstName}</span>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill first" style={{ width: `${pct1}%` }} />
                  </div>
                  <span className="chart-bar-val">{formatValue(metric.first_value, metric.currency, metric.unit)}</span>
                </div>

                <div className="chart-bar-item">
                  <span className="chart-bar-label">{secondName}</span>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill second" style={{ width: `${pct2}%` }} />
                  </div>
                  <span className="chart-bar-val">{formatValue(metric.second_value, metric.currency, metric.unit)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ComparisonView({
  documents,
  selectedId,
  secondId,
  comparison,
  canCompare,
  onSecondChange,
  onCompare,
  state,
  message,
}: {
  documents: DocumentMetadata[]
  selectedId: string | null
  secondId: string
  comparison: ComparisonResponse | null
  canCompare: boolean
  onSecondChange: (id: string) => void
  onCompare: () => void
  state: RequestState
  message: string
}) {
  const firstDoc = documents.find((d) => d.document_id === selectedId)
  const secondDoc = documents.find((d) => d.document_id === secondId)

  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="section-kicker">Period-matched review</p>
          <h2>Compare reports</h2>
        </div>
        <span className="context-label">Second minus first</span>
      </div>

      <section className="panel compare-controls">
        <label>
          <span>First report</span>
          <select value={selectedId ?? ''} disabled>
            <option value="">Select a document</option>
            {documents.map((item) => (
              <option key={item.document_id} value={item.document_id}>
                {item.filename}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Second report</span>
          <select value={secondId} onChange={(event) => onSecondChange(event.target.value)}>
            <option value="">Select a document</option>
            {documents
              .filter((item) => item.document_id !== selectedId)
              .map((item) => (
                <option key={item.document_id} value={item.document_id}>
                  {item.filename}
                </option>
              ))}
          </select>
        </label>

        <button
          type="button"
          className="primary-button"
          disabled={!canCompare || state === 'loading'}
          onClick={onCompare}
        >
          Run comparison
        </button>
      </section>

      {state === 'loading' && <div className="panel loading-block">{message}</div>}
      {state === 'error' && <div className="notice error">{message}</div>}

      {comparison && (
        <>
          <ComparisonVisualChart
            comparison={comparison}
            firstName={firstDoc?.filename ?? 'Report A'}
            secondName={secondDoc?.filename ?? 'Report B'}
          />
          <ComparisonTable comparison={comparison} />
        </>
      )}
    </section>
  )
}

function ReportsView({
  documents,
  selectedId,
  secondId,
  report,
  onSecondChange,
  onGenerate,
  state,
  message,
}: {
  documents: DocumentMetadata[]
  selectedId: string | null
  secondId: string
  report: ResearchReportResponse | null
  onSecondChange: (id: string) => void
  onGenerate: () => void
  state: RequestState
  message: string
}) {
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="section-kicker">Evidence-backed synthesis</p>
          <h2>Research reports</h2>
        </div>
        <span className="context-label">Deterministic output</span>
      </div>

      <section className="panel compare-controls report-controls">
        <label>
          <span>Optional comparison report</span>
          <select value={secondId} onChange={(event) => onSecondChange(event.target.value)}>
            <option value="">Single document report</option>
            {documents
              .filter((item) => item.document_id !== selectedId)
              .map((item) => (
                <option key={item.document_id} value={item.document_id}>
                  {item.filename}
                </option>
              ))}
          </select>
        </label>

        <button
          type="button"
          className="primary-button"
          disabled={!selectedId || state === 'loading'}
          onClick={onGenerate}
        >
          Generate report
        </button>
      </section>

      {state === 'loading' && <div className="panel loading-block">{message}</div>}
      {state === 'error' && <div className="notice error">{message}</div>}

      {report && <ReportContent report={report} />}
    </section>
  )
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function MetricFactList({ metrics }: { metrics: FinancialDataResponse['metrics'] }) {
  return (
    <div className="metric-fact-list">
      {metrics.length ? (
        metrics.map((metric) => (
          <div className="metric-fact" key={metric.metric_name}>
            <strong>{metric.metric_name.replaceAll('_', ' ')}</strong>
            <span>{formatValue(metric.value, metric.currency, metric.unit)}</span>
            <small>{metric.reporting_period ?? 'Period unavailable'}</small>
          </div>
        ))
      ) : (
        <p className="muted-copy">No supported metrics were extracted.</p>
      )}
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

function Limitations({ items }: { items: string[] }) {
  return (
    <section className="panel limitations">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Context</p>
          <h2>Limitations</h2>
        </div>
      </div>

      {items.length ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted-copy">No limitations were returned.</p>
      )}
    </section>
  )
}

function RiskCard({
  observation,
}: {
  observation: RiskAnalysisResponse['observations'][number]
}) {
  return (
    <article className="risk-card">
      <div className="risk-card-top">
        <span className={`severity ${observation.severity}`}>{observation.severity}</span>
        <span className="rule-id">{observation.rule_id}</span>
      </div>

      <h3>{observation.title}</h3>
      <p>{observation.explanation}</p>

      <div className="evidence-box">
        <span>Evidence</span>
        {observation.evidence.map((item) => (
          <blockquote key={item}>{item}</blockquote>
        ))}
      </div>

      <small>{observation.limitation}</small>
    </article>
  )
}

function ComparisonTable({ comparison }: { comparison: ComparisonResponse }) {
  return (
    <section className="panel comparison-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Metric review</p>
          <h2>Comparison results</h2>
        </div>
      </div>

      <div className="comparison-list">
        {comparison.metrics.map((metric) => (
          <article className={`comparison-row ${metric.comparison_status}`} key={metric.metric_name}>
            <div className="comparison-name">
              <strong>{metric.display_name}</strong>
              <span>{metric.comparison_status}</span>
            </div>

            <div className="comparison-values">
              <span>{formatValue(metric.first_value, metric.currency, metric.unit)}</span>
              <span className="difference">
                {metric.absolute_difference === null ? '—' : formatSigned(metric.absolute_difference)}
              </span>
              <span>{formatValue(metric.second_value, metric.currency, metric.unit)}</span>
            </div>

            <div className="comparison-meta">
              <small>
                {metric.first_reporting_period ?? 'Unknown period'} to{' '}
                {metric.second_reporting_period ?? 'Unknown period'}
              </small>
              <small>
                {metric.percentage_change === null
                  ? metric.limitation ?? 'No percentage returned'
                  : `${formatSigned(metric.percentage_change)}%`}
              </small>
            </div>
          </article>
        ))}
      </div>

      <Limitations items={comparison.limitations} />
    </section>
  )
}

function downloadReportMarkdown(report: ResearchReportResponse) {
  let md = `# FinSight AI - Research Report\n`
  md += `**Report ID:** ${report.report_id} | **Generated:** ${new Date(report.generated_at).toLocaleString()}\n`
  md += `**Type:** ${report.report_type === 'single_document' ? 'Single Document Analysis' : 'Two Document Comparison'}\n\n`
  md += `## 1. Source Document Metrics\n`
  report.source_documents.forEach((doc) => {
    md += `### ${doc.filename}\n`
    if (doc.metrics.length) {
      doc.metrics.forEach((m) => {
        md += `- **${m.metric_name.replace(/_/g, ' ').toUpperCase()}**: ${formatValue(m.value, m.currency, m.unit)} (${m.reporting_period ?? 'N/A'})\n  Context: "${m.source_context}"\n`
      })
    } else {
      md += `No supported metrics extracted.\n`
    }
  })
  if (report.risk_observations.length) {
    md += `\n## 2. Risk Observations\n`
    report.risk_observations.forEach((obs) => {
      md += `### [${obs.severity.toUpperCase()}] ${obs.title} (${obs.rule_id})\n${obs.explanation}\n`
      obs.evidence.forEach((e) => {
        md += `> Evidence: ${e}\n`
      })
    })
  }
  if (report.limitations.length) {
    md += `\n## 3. Disclosures & Limitations\n`
    report.limitations.forEach((lim) => {
      md += `- ${lim}\n`
    })
  }
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finsight-report-${report.report_id.slice(0, 8)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function ReportContent({ report }: { report: ResearchReportResponse }) {
  return (
    <div className="report-stack">
      <section className="report-heading panel">
        <div>
          <p className="section-kicker">
            {report.report_type === 'single_document'
              ? 'Single document'
              : 'Two document comparison'}
          </p>
          <h2>Research report</h2>
          <p className="muted-copy">
            Generated {new Date(report.generated_at).toLocaleString()} / {report.report_id}
          </p>
        </div>

        <div className="export-bar">
          <button
            type="button"
            className="secondary-button"
            onClick={() => downloadReportMarkdown(report)}
          >
            Export as Markdown
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </section>

      <section className="report-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Source facts</p>
              <h2>Extracted metrics</h2>
            </div>
          </div>

          {report.source_documents.map((source) => (
            <div className="report-source" key={source.document_id}>
              <h3>{source.filename}</h3>

              {source.metrics.length ? (
                source.metrics.map((metric) => (
                  <div
                    className="report-metric"
                    key={`${source.document_id}-${metric.metric_name}`}
                  >
                    <strong>{metric.metric_name.replaceAll('_', ' ')}</strong>
                    <span>{formatValue(metric.value, metric.currency, metric.unit)}</span>
                    <small>{metric.source_context}</small>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No supported metrics were extracted.</p>
              )}
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Observations</p>
              <h2>Risk review</h2>
            </div>
          </div>

          {report.risk_observations.length ? (
            report.risk_observations.map((item) => (
              <RiskCard key={`${item.rule_id}-${item.evidence[0]}`} observation={item} />
            ))
          ) : (
            <EmptyState
              title="No triggered indicators"
              body="The deterministic risk rules returned no observations."
            />
          )}
        </div>
      </section>

      {report.comparison && <ComparisonTable comparison={report.comparison} />}

      <section className="report-grid">
        <Limitations items={report.missing_information} />

        <section className="panel methodology">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Method</p>
              <h2>{report.methodology.summary}</h2>
            </div>
          </div>

          <ol>
            {report.methodology.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </section>

      <Limitations items={report.limitations} />
    </div>
  )
}

function formatValue(
  value: number | null,
  currency: string | null,
  unit: string | null,
) {
  if (value === null) return 'Unavailable'

  return `${currency ? `${currency} ` : ''}${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}${unit ? ` ${unit}` : ''}`
}

function formatSigned(value: number) {
  return `${value > 0 ? '+' : ''}${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your sign-in session expired. Please sign in again.'
  }

  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'The request could not be completed.'
}

export default App
