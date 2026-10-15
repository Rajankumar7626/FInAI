import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthSession } from './lib/authContext'
import './App.css'
import {
  ApiError,
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
  type ResearchReportResponse,
  type RiskAnalysisResponse,
  uploadDocument,
} from './lib/api'

type View = 'dashboard' | 'documents' | 'risk' | 'comparison' | 'reports'
type RequestState = 'idle' | 'loading' | 'success' | 'error'

const navigation: { id: View; label: string; short: string }[] = [
  { id: 'dashboard', label: 'Dashboard', short: 'DB' },
  { id: 'documents', label: 'Documents', short: 'DOC' },
  { id: 'risk', label: 'Risk analysis', short: 'RISK' },
  { id: 'comparison', label: 'Comparison', short: 'CMP' },
  { id: 'reports', label: 'Reports', short: 'RPT' },
]

function App() {
  const { isLoading, isAuthenticated, user, error, loginWithRedirect, logout, getAccessTokenSilently } = useAuthSession()
  const [loginFailed, setLoginFailed] = useState(false)

  if (isLoading) {
    return <main className="auth-screen"><p role="status">Checking sign-in…</p></main>
  }

  if (!isAuthenticated || !user?.sub) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <p className="section-kicker">FinSight AI</p>
          <h1>Sign in to your workspace</h1>
          <p>Your documents and analysis are available only to your account.</p>
          {(error || loginFailed) && <div className="notice error" role="alert">Sign-in could not be completed. Please try again.</div>}
          <button type="button" className="primary-button" onClick={() => {
            setLoginFailed(false)
            void loginWithRedirect().catch(() => setLoginFailed(true))
          }}>
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
  const [healthMessage, setHealthMessage] = useState('Connecting to the local analysis API...')
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

  const clearUserData = useCallback(() => {
    setDocuments([])
    setSelectedId(null)
    setSecondId('')
    setSelectedText(null)
    setFinancialData(null)
    setRiskData(null)
    setComparison(null)
    setReport(null)
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
    () => documents.find((document) => document.document_id === selectedId) ?? null,
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
      setDocumentMessage(nextDocuments.length ? `${nextDocuments.length} document${nextDocuments.length === 1 ? '' : 's'} in workspace.` : 'No documents uploaded yet.')
    } catch (error) {
      setDocumentState('error')
      setDocumentMessage(getErrorMessage(error))
    }
  }, [])

  const checkHealth = useCallback(async () => {
    setHealthState('loading')
    setHealthMessage('Connecting to the local analysis API...')
    try {
      const health = await getHealth()
      setHealthState('success')
      setHealthMessage(`${health.service} is responding normally.`)
    } catch (error) {
      setHealthState('error')
      setHealthMessage(getErrorMessage(error))
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
    if (!selectedId) {
      return
    }

    let cancelled = false
    Promise.all([getFinancialData(selectedId), getRiskAnalysis(selectedId)])
      .then(([facts, risks]) => {
        if (cancelled) return
        setFinancialData(facts)
        setRiskData(risks)
        setAnalysisState('success')
        setAnalysisMessage('Analysis refreshed from the registered document text.')
      })
      .catch((error) => {
        if (cancelled) return
        setAnalysisState('error')
        setAnalysisMessage(getErrorMessage(error))
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
    } catch (error) {
      setUploadState('error')
      setUploadMessage(getErrorMessage(error))
    }
  }

  async function handleDelete() {
    if (!selectedDocument) return
    if (!window.confirm(`Delete ${selectedDocument.filename} from this session?`)) return
    try {
      await deleteDocument(selectedDocument.document_id)
      setSelectedText(null)
      setFinancialData(null)
      setRiskData(null)
      setComparison(null)
      setReport(null)
      await refreshDocuments()
    } catch (error) {
      setDocumentState('error')
      setDocumentMessage(getErrorMessage(error))
    }
  }

  async function viewExtractedText() {
    if (!selectedId) return
    setTextOpen(true)
    try {
      setSelectedText(await getDocumentText(selectedId))
    } catch (error) {
      setAnalysisState('error')
      setAnalysisMessage(getErrorMessage(error))
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
    } catch (error) {
      setAnalysisState('error')
      setAnalysisMessage(getErrorMessage(error))
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
      setAnalysisMessage('Research report generated from current session data.')
    } catch (error) {
      setAnalysisState('error')
      setAnalysisMessage(getErrorMessage(error))
    }
  }

  const canCompare = Boolean(selectedId && secondId && selectedId !== secondId)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">F</div>
          <div><strong>FinSight</strong><span>Research workspace</span></div>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          <span className="nav-heading">Workspace</span>
          {navigation.map((item) => <button type="button" key={item.id} className={`nav-item ${activeView === item.id ? 'active' : ''}`} onClick={() => setActiveView(item.id)}><span className="nav-code">{item.short}</span>{item.label}</button>)}
        </nav>
        <div className="sidebar-footer">
          <div className={`connection-dot ${healthState}`} />
          <div><span>API connection</span><strong>{healthState === 'success' ? 'Online' : healthState === 'loading' ? 'Checking' : 'Offline'}</strong></div>
          <button type="button" className="text-button" onClick={() => void checkHealth()}>Retry</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="section-kicker">Financial intelligence / {userLabel}</p><h1>{navigation.find((item) => item.id === activeView)?.label}</h1></div>
          <button type="button" className="text-button" onClick={handleLogout}>Log out</button>
          <label className="upload-button"><span>{uploadState === 'loading' ? 'Uploading...' : 'Upload PDF'}</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => void handleUpload(event.target.files?.[0])} disabled={uploadState === 'loading'} /></label>
        </header>
        {uploadMessage && <div className={`notice ${uploadState}`} role="status">{uploadMessage}</div>}
        {healthState === 'error' && <div className="notice error" role="alert">{healthMessage}</div>}

        {activeView === 'dashboard' && <DashboardView documents={documents} documentState={documentState} documentMessage={documentMessage} selectedDocument={selectedDocument} financialData={financialData} analysisState={analysisState} analysisMessage={analysisMessage} onSelect={selectDocument} onNavigate={setActiveView} onViewText={() => void viewExtractedText()} onDelete={() => void handleDelete()} />}
        {activeView === 'documents' && <DocumentsView documents={documents} documentState={documentState} documentMessage={documentMessage} selectedId={selectedId} financialData={financialData} onSelect={selectDocument} onViewText={() => void viewExtractedText()} onDelete={() => void handleDelete()} />}
        {activeView === 'risk' && <RiskView riskData={riskData} selectedDocument={selectedDocument} state={analysisState} message={analysisMessage} />}
        {activeView === 'comparison' && <ComparisonView documents={documents} selectedId={selectedId} secondId={secondId} comparison={comparison} canCompare={canCompare} onSecondChange={setSecondId} onCompare={() => void runComparison()} state={analysisState} message={analysisMessage} />}
        {activeView === 'reports' && <ReportsView documents={documents} selectedId={selectedId} secondId={secondId} report={report} onSecondChange={setSecondId} onGenerate={() => void runReport()} state={analysisState} message={analysisMessage} />}
      </main>

      {textOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTextOpen(false) }}><section className="text-modal" role="dialog" aria-modal="true" aria-labelledby="text-modal-title"><div className="modal-header"><div><p className="section-kicker">Source document</p><h2 id="text-modal-title">Extracted text</h2></div><button type="button" className="icon-button" aria-label="Close extracted text" onClick={() => setTextOpen(false)}>Close</button></div>{selectedText ? <pre>{selectedText.extracted_text}</pre> : <div className="loading-block">Loading source text...</div>}</section></div>}
    </div>
  )
}

function DashboardView(props: { documents: DocumentMetadata[]; documentState: RequestState; documentMessage: string; selectedDocument: DocumentMetadata | null; financialData: FinancialDataResponse | null; analysisState: RequestState; analysisMessage: string; onSelect: (id: string) => void; onNavigate: (view: View) => void; onViewText: () => void; onDelete: () => void }) {
  return <><section className="hero-band"><div><p className="section-kicker">Evidence-first analysis</p><h2>Turn financial reports into a reviewable workspace.</h2><p>Upload a text-based PDF, inspect extracted facts, and move from source evidence to deterministic risk and comparison outputs.</p></div><div className="hero-stamp"><span>SESSION</span><strong>LOCAL</strong><small>No permanent storage</small></div></section><section className="summary-grid" aria-label="Workspace summary"><SummaryCard label="Documents" value={String(props.documents.length)} detail={props.documentMessage} /><SummaryCard label="Selected report" value={props.selectedDocument ? '1' : '0'} detail={props.selectedDocument?.filename ?? 'Choose a document to begin'} /><SummaryCard label="Analysis state" value={props.analysisState === 'success' ? 'Ready' : props.analysisState === 'loading' ? 'Working' : 'Idle'} detail={props.analysisMessage} /></section><section className="workspace-grid"><DocumentList documents={props.documents} documentState={props.documentState} documentMessage={props.documentMessage} selectedId={props.selectedDocument?.document_id} onSelect={props.onSelect} /><SelectedDocumentPanel selectedDocument={props.selectedDocument} financialData={props.financialData} onViewText={props.onViewText} onDelete={props.onDelete} onNavigate={props.onNavigate} /></section></>
}

function DocumentsView(props: { documents: DocumentMetadata[]; documentState: RequestState; documentMessage: string; selectedId: string | null; financialData: FinancialDataResponse | null; onSelect: (id: string) => void; onViewText: () => void; onDelete: () => void }) {
  return <section className="page-stack"><div className="page-intro"><div><p className="section-kicker">Session registry</p><h2>Uploaded documents</h2></div><span className="count-badge">{props.documents.length} active</span></div><DocumentList documents={props.documents} documentState={props.documentState} documentMessage={props.documentMessage} selectedId={props.selectedId} onSelect={props.onSelect} /><SelectedDocumentPanel selectedDocument={props.documents.find((item) => item.document_id === props.selectedId) ?? null} financialData={props.financialData} onViewText={props.onViewText} onDelete={props.onDelete} /></section>
}

function DocumentList({ documents, documentState, documentMessage, selectedId, onSelect }: { documents: DocumentMetadata[]; documentState: RequestState; documentMessage: string; selectedId?: string | null; onSelect: (id: string) => void }) {
  return <section className="panel document-panel"><div className="panel-heading"><div><p className="section-kicker">Source library</p><h2>Documents</h2></div><span className="count-badge">{documents.length}</span></div>{documentState === 'loading' && <div className="loading-block">{documentMessage}</div>}{documentState !== 'loading' && documents.length === 0 && <EmptyState title="No reports yet" body="Upload a PDF to create the first source in this workspace." />}<div className="document-list">{documents.map((document) => <button type="button" className={`document-row ${selectedId === document.document_id ? 'selected' : ''}`} key={document.document_id} onClick={() => onSelect(document.document_id)}><span className="file-token">PDF</span><span className="document-row-main"><strong>{document.filename}</strong><small>{document.page_count} page{document.page_count === 1 ? '' : 's'} / {document.extracted_character_count.toLocaleString()} characters</small></span><span className="row-arrow">Open</span></button>)}</div></section>
}

function SelectedDocumentPanel({ selectedDocument, financialData, onViewText, onDelete, onNavigate }: { selectedDocument?: DocumentMetadata | null; financialData?: FinancialDataResponse | null; onViewText: () => void; onDelete: () => void; onNavigate?: (view: View) => void }) {
  if (!selectedDocument) return <section className="panel detail-panel"><EmptyState title="Select a document" body="Choose a source from the library to inspect metrics and deterministic risk indicators." /></section>
  return <section className="panel detail-panel"><div className="panel-heading"><div><p className="section-kicker">Selected source</p><h2>{selectedDocument.filename}</h2></div><span className="status-chip">{selectedDocument.extraction_status}</span></div><div className="detail-facts"><div><span>Pages</span><strong>{selectedDocument.page_count}</strong></div><div><span>Characters</span><strong>{selectedDocument.extracted_character_count.toLocaleString()}</strong></div></div><p className="muted-copy">This session keeps extracted content in memory only. Use the source text action when you need to verify a metric.</p>{financialData && <MetricFactList metrics={financialData.metrics.slice(0, 4)} />}{!financialData && <div className="loading-block">Loading extracted metrics...</div>}<div className="action-row"><button type="button" className="secondary-button" onClick={onViewText}>View extracted text</button><button type="button" className="danger-button" onClick={onDelete}>Delete document</button></div>{onNavigate && <div className="action-row secondary-actions"><button type="button" className="link-button" onClick={() => onNavigate('risk')}>Open risk analysis</button><button type="button" className="link-button" onClick={() => onNavigate('reports')}>Generate report</button></div>}</section>
}

function RiskView({ riskData, selectedDocument, state, message }: { riskData: RiskAnalysisResponse | null; selectedDocument: DocumentMetadata | null; state: RequestState; message: string }) {
  return <section className="page-stack"><div className="page-intro"><div><p className="section-kicker">Rule-based review</p><h2>Risk analysis</h2></div><span className="context-label">{selectedDocument?.filename ?? 'No document selected'}</span></div>{state === 'loading' && <div className="panel loading-block">{message}</div>}{state === 'error' && <div className="notice error">{message}</div>}{riskData && <><div className="risk-grid">{riskData.observations.length ? riskData.observations.map((observation) => <RiskCard key={observation.rule_id} observation={observation} />) : <div className="panel"><EmptyState title="No triggered indicators" body="No supported risk rule triggered for the selected document." /></div>}</div><Limitations items={riskData.limitations} /></>}</section>
}

function ComparisonView({ documents, selectedId, secondId, comparison, canCompare, onSecondChange, onCompare, state, message }: { documents: DocumentMetadata[]; selectedId: string | null; secondId: string; comparison: ComparisonResponse | null; canCompare: boolean; onSecondChange: (id: string) => void; onCompare: () => void; state: RequestState; message: string }) {
  return <section className="page-stack"><div className="page-intro"><div><p className="section-kicker">Period-matched review</p><h2>Compare reports</h2></div><span className="context-label">Second minus first</span></div><section className="panel compare-controls"><label><span>First report</span><select value={selectedId ?? ''} disabled><option value="">Select a document</option>{documents.map((item) => <option key={item.document_id} value={item.document_id}>{item.filename}</option>)}</select></label><label><span>Second report</span><select value={secondId} onChange={(event) => onSecondChange(event.target.value)}><option value="">Select a document</option>{documents.filter((item) => item.document_id !== selectedId).map((item) => <option key={item.document_id} value={item.document_id}>{item.filename}</option>)}</select></label><button type="button" className="primary-button" disabled={!canCompare || state === 'loading'} onClick={onCompare}>Run comparison</button></section>{state === 'loading' && <div className="panel loading-block">{message}</div>}{state === 'error' && <div className="notice error">{message}</div>}{comparison && <ComparisonTable comparison={comparison} />}</section>
}

function ReportsView({ documents, selectedId, secondId, report, onSecondChange, onGenerate, state, message }: { documents: DocumentMetadata[]; selectedId: string | null; secondId: string; report: ResearchReportResponse | null; onSecondChange: (id: string) => void; onGenerate: () => void; state: RequestState; message: string }) {
  return <section className="page-stack"><div className="page-intro"><div><p className="section-kicker">Evidence-backed synthesis</p><h2>Research reports</h2></div><span className="context-label">Deterministic output</span></div><section className="panel compare-controls report-controls"><label><span>Optional comparison report</span><select value={secondId} onChange={(event) => onSecondChange(event.target.value)}><option value="">Single document report</option>{documents.filter((item) => item.document_id !== selectedId).map((item) => <option key={item.document_id} value={item.document_id}>{item.filename}</option>)}</select></label><button type="button" className="primary-button" disabled={!selectedId || state === 'loading'} onClick={onGenerate}>Generate report</button></section>{state === 'loading' && <div className="panel loading-block">{message}</div>}{state === 'error' && <div className="notice error">{message}</div>}{report && <ReportContent report={report} />}</section>
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="summary-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }
function MetricFactList({ metrics }: { metrics: FinancialDataResponse['metrics'] }) { return <div className="metric-fact-list">{metrics.length ? metrics.map((metric) => <div className="metric-fact" key={metric.metric_name}><strong>{metric.metric_name.replaceAll('_', ' ')}</strong><span>{formatValue(metric.value, metric.currency, metric.unit)}</span><small>{metric.reporting_period ?? 'Period unavailable'}</small></div>) : <p className="muted-copy">No supported metrics were extracted.</p>}</div> }
function EmptyState({ title, body }: { title: string; body: string }) { return <div className="empty-state"><strong>{title}</strong><p>{body}</p></div> }
function Limitations({ items }: { items: string[] }) { return <section className="panel limitations"><div className="panel-heading"><div><p className="section-kicker">Context</p><h2>Limitations</h2></div></div>{items.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="muted-copy">No limitations were returned.</p>}</section> }
function RiskCard({ observation }: { observation: RiskAnalysisResponse['observations'][number] }) { return <article className="risk-card"><div className="risk-card-top"><span className={`severity ${observation.severity}`}>{observation.severity}</span><span className="rule-id">{observation.rule_id}</span></div><h3>{observation.title}</h3><p>{observation.explanation}</p><div className="evidence-box"><span>Evidence</span>{observation.evidence.map((item) => <blockquote key={item}>{item}</blockquote>)}</div><small>{observation.limitation}</small></article> }
function ComparisonTable({ comparison }: { comparison: ComparisonResponse }) { return <section className="panel comparison-panel"><div className="panel-heading"><div><p className="section-kicker">Metric review</p><h2>Comparison results</h2></div></div><div className="comparison-list">{comparison.metrics.map((metric) => <article className={`comparison-row ${metric.comparison_status}`} key={metric.metric_name}><div className="comparison-name"><strong>{metric.display_name}</strong><span>{metric.comparison_status}</span></div><div className="comparison-values"><span>{formatValue(metric.first_value, metric.currency, metric.unit)}</span><span className="difference">{metric.absolute_difference === null ? '—' : formatSigned(metric.absolute_difference)}</span><span>{formatValue(metric.second_value, metric.currency, metric.unit)}</span></div><div className="comparison-meta"><small>{metric.first_reporting_period ?? 'Unknown period'} to {metric.second_reporting_period ?? 'Unknown period'}</small><small>{metric.percentage_change === null ? metric.limitation ?? 'No percentage returned' : `${formatSigned(metric.percentage_change)}%`}</small></div></article>)}</div><Limitations items={comparison.limitations} /></section> }
function ReportContent({ report }: { report: ResearchReportResponse }) { return <div className="report-stack"><section className="report-heading panel"><div><p className="section-kicker">{report.report_type === 'single_document' ? 'Single document' : 'Two document comparison'}</p><h2>Research report</h2><p className="muted-copy">Generated {new Date(report.generated_at).toLocaleString()} / {report.report_id}</p></div></section><section className="report-grid"><div className="panel"><div className="panel-heading"><div><p className="section-kicker">Source facts</p><h2>Extracted metrics</h2></div></div>{report.source_documents.map((source) => <div className="report-source" key={source.document_id}><h3>{source.filename}</h3>{source.metrics.length ? source.metrics.map((metric) => <div className="report-metric" key={`${source.document_id}-${metric.metric_name}`}><strong>{metric.metric_name.replaceAll('_', ' ')}</strong><span>{formatValue(metric.value, metric.currency, metric.unit)}</span><small>{metric.source_context}</small></div>) : <p className="muted-copy">No supported metrics were extracted.</p>}</div>)}</div><div className="panel"><div className="panel-heading"><div><p className="section-kicker">Observations</p><h2>Risk review</h2></div></div>{report.risk_observations.length ? report.risk_observations.map((item) => <RiskCard key={`${item.rule_id}-${item.evidence[0]}`} observation={item} />) : <EmptyState title="No triggered indicators" body="The deterministic risk rules returned no observations." />}</div></section>{report.comparison && <ComparisonTable comparison={report.comparison} />}<section className="report-grid"><Limitations items={report.missing_information} /><section className="panel methodology"><div className="panel-heading"><div><p className="section-kicker">Method</p><h2>{report.methodology.summary}</h2></div></div><ol>{report.methodology.steps.map((step) => <li key={step}>{step}</li>)}</ol></section></section><Limitations items={report.limitations} /></div> }
function formatValue(value: number | null, currency: string | null, unit: string | null) { if (value === null) return 'Unavailable'; return `${currency ? `${currency} ` : ''}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}` }
function formatSigned(value: number) { return `${value > 0 ? '+' : ''}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` }
function getErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return 'Your sign-in session expired. Please sign in again.'
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'The request could not be completed.'
}

export default App
