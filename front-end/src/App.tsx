import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthSession } from './lib/authContext'
import './App.css'
import {
  API_BASE_URL,
  askDocumentQuestion,
  compareDocuments,
  deleteDocument,
  generateReport,
  getDocuments,
  getDocumentText,
  getFinancialData,
  getHealth,
  getRiskAnalysis,
  saveReportToHistory,
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
import { getErrorMessage } from './lib/formatters'
import { navigation, type RequestState, type View } from './lib/types'
import { ComparisonView } from './views/ComparisonView'
import { DashboardView } from './views/DashboardView'
import { DocumentsView } from './views/DocumentsView'
import { FinancialsView } from './views/FinancialsView'
import { HistoryView } from './views/HistoryView'
import { LandingPage } from './views/LandingPage'
import { ReportsView } from './views/ReportsView'
import { ResearchView } from './views/ResearchView'
import { RiskView } from './views/RiskView'
import { SettingsView } from './views/SettingsView'

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
      <LandingPage
        onLogin={async () => {
          setLoginFailed(false)
          try {
            await loginWithRedirect()
          } catch (err: unknown) {
            console.error('Auth0 loginWithRedirect failed:', err)
            setLoginFailed(true)
          }
        }}
        loginFailed={loginFailed}
        error={error}
      />
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
      const generated = await generateReport(selectedId, secondId || undefined)
      setReport(generated)
      saveReportToHistory(generated)
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
          <img src="/logo.png" alt="FinSight AI Logo" className="brand-mark-img" />
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

        {activeView === 'history' && <HistoryView />}

        {activeView === 'settings' && (
          <SettingsView userLabel={userLabel} apiBaseUrl={API_BASE_URL} />
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

export default App
