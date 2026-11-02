import { useState, useMemo } from 'react'
import type { ResearchReportResponse } from '../lib/api'
import { clearReportHistory, deleteSavedReport, getSavedReports } from '../lib/api'
import { downloadReportMarkdown } from '../lib/formatters'
import type { View } from '../lib/types'
import { EmptyState } from '../components/ui/EmptyState'
import { ReportContent } from '../components/ui/ReportContent'

export function HistoryView({ onNavigate }: { onNavigate?: (view: View) => void }) {
  const [reports, setReports] = useState<ResearchReportResponse[]>(() => getSavedReports())
  const [selectedReportId, setSelectedReportId] = useState<string | null>(() => {
    const list = getSavedReports()
    return list[0]?.report_id ?? null
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'single_document' | 'two_document_comparison'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  const [reportToDelete, setReportToDelete] = useState<ResearchReportResponse | null>(null)
  const [showClearModal, setShowClearModal] = useState(false)
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null)

  const selectedReport = useMemo(() => {
    return reports.find((r) => r.report_id === selectedReportId) ?? null
  }, [reports, selectedReportId])

  const filteredReports = useMemo(() => {
    return reports
      .filter((r) => {
        if (typeFilter !== 'all' && r.report_type !== typeFilter) return false
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        const matchesDoc = r.source_documents.some((d) => d.filename.toLowerCase().includes(q))
        const matchesId = r.report_id.toLowerCase().includes(q)
        const matchesMethod = r.methodology?.summary?.toLowerCase().includes(q)
        const matchesMetrics = r.source_documents.some((d) =>
          d.metrics.some((m) => m.metric_name.toLowerCase().includes(q)),
        )
        return matchesDoc || matchesId || matchesMethod || matchesMetrics
      })
      .sort((a, b) => {
        const timeA = new Date(a.generated_at).getTime()
        const timeB = new Date(b.generated_at).getTime()
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
      })
  }, [reports, searchQuery, typeFilter, sortOrder])

  function handleDeleteConfirm(id: string) {
    deleteSavedReport(id)
    const updated = getSavedReports()
    setReports(updated)
    setReportToDelete(null)
    if (selectedReportId === id) {
      setSelectedReportId(updated[0]?.report_id ?? null)
    }
  }

  function handleClearAllConfirm() {
    clearReportHistory()
    setReports([])
    setSelectedReportId(null)
    setShowClearModal(false)
  }

  function handleExportBackup() {
    if (!reports.length) return
    const blob = new Blob([JSON.stringify(reports, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finsight-research-history-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCopySummary(report: ResearchReportResponse) {
    const docNames = report.source_documents.map((d) => d.filename).join(' vs ')
    const metricsCount = report.source_documents.reduce((acc, d) => acc + d.metrics.length, 0)
    const summaryText = `FinSight AI Research Report\nDocument(s): ${docNames}\nType: ${
      report.report_type === 'single_document' ? 'Single Document' : 'Two Document Comparison'
    }\nGenerated: ${new Date(report.generated_at).toLocaleString()}\nTotal Metrics: ${metricsCount}\nRisk Observations: ${
      report.risk_observations.length
    }\nReport ID: ${report.report_id}`

    try {
      await navigator.clipboard.writeText(summaryText)
      setCopiedNotification('Report summary copied to clipboard!')
      setTimeout(() => setCopiedNotification(null), 2500)
    } catch {
      setCopiedNotification('Could not access clipboard.')
      setTimeout(() => setCopiedNotification(null), 2500)
    }
  }

  function formatRelativeDate(iso: string): string {
    try {
      const date = new Date(iso)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffMins < 2) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24 && date.getDate() === now.getDate()) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      }
      if (diffDays === 1) {
        return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return iso
    }
  }

  return (
    <section className="page-stack">
      {/* Toast Notification */}
      {copiedNotification && (
        <div className="history-toast-notification" role="status">
          <span>✓</span> {copiedNotification}
        </div>
      )}

      {/* Top Header */}
      <div className="page-intro">
        <div>
          <p className="section-kicker">Saved Research Archive</p>
          <h2>Report History</h2>
        </div>
        <div className="history-header-actions">
          <span className="count-badge">{reports.length} saved</span>
          {reports.length > 0 && (
            <>
              <button
                type="button"
                className="secondary-button history-action-btn"
                onClick={handleExportBackup}
                title="Download JSON backup of all generated reports"
              >
                Export Archive
              </button>
              <button
                type="button"
                className="danger-button history-action-btn"
                onClick={() => setShowClearModal(true)}
              >
                Clear History
              </button>
            </>
          )}
        </div>
      </div>

      {reports.length === 0 ? (
        <section className="panel history-empty-panel">
          <div className="history-empty-illustration">📑</div>
          <EmptyState
            title="No Saved Research Reports"
            body="When you generate single document or two-document comparative research reports in the Reports tab, they will automatically be preserved in this workspace."
          />
          {onNavigate && (
            <div className="history-empty-action">
              <button
                type="button"
                className="primary-button"
                onClick={() => onNavigate('reports')}
              >
                Go to Reports
              </button>
            </div>
          )}
        </section>
      ) : (
        <div className="history-workspace-layout">
          {/* Master List Column */}
          <section
            className={`panel history-sidebar-panel ${
              mobileView === 'detail' ? 'history-hidden-on-mobile' : ''
            }`}
          >
            <div className="history-controls-bar">
              {/* Search Bar */}
              <div className="history-search-wrap">
                <input
                  type="text"
                  placeholder="Search by filename or metric..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="history-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="history-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Tabs & Sort */}
              <div className="history-filters-row">
                <div className="history-filter-pills">
                  <button
                    type="button"
                    className={`history-filter-pill ${typeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('all')}
                  >
                    All ({reports.length})
                  </button>
                  <button
                    type="button"
                    className={`history-filter-pill ${typeFilter === 'single_document' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('single_document')}
                  >
                    Single ({reports.filter((r) => r.report_type === 'single_document').length})
                  </button>
                  <button
                    type="button"
                    className={`history-filter-pill ${typeFilter === 'two_document_comparison' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('two_document_comparison')}
                  >
                    Comparison ({reports.filter((r) => r.report_type === 'two_document_comparison').length})
                  </button>
                </div>

                <div className="history-sort-wrap">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                    className="history-sort-select"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Filtered Report Cards List */}
            {filteredReports.length === 0 ? (
              <div className="history-no-matches">
                <p>No reports match your search query.</p>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setSearchQuery('')
                    setTypeFilter('all')
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="history-cards-list">
                {filteredReports.map((rep) => {
                  const isSelected = rep.report_id === selectedReportId
                  const isComparison = rep.report_type === 'two_document_comparison'
                  const sourceNames = rep.source_documents.map((d) => d.filename).join(' vs ')
                  const metricsCount = rep.source_documents.reduce((acc, d) => acc + d.metrics.length, 0)
                  const riskCount = rep.risk_observations.length
                  const hasHighRisk = rep.risk_observations.some((o) => o.severity === 'high')

                  return (
                    <article
                      key={rep.report_id}
                      className={`history-card-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedReportId(rep.report_id)
                        setMobileView('detail')
                      }}
                    >
                      <div className="history-card-header">
                        <div className="history-card-type-row">
                          <span
                            className={`history-type-chip ${
                              isComparison ? 'type-comparison' : 'type-single'
                            }`}
                          >
                            {isComparison ? 'Comparison' : 'Single Report'}
                          </span>
                          <span className="history-card-time">{formatRelativeDate(rep.generated_at)}</span>
                        </div>

                        <button
                          type="button"
                          className="history-card-delete-btn"
                          title="Delete report"
                          onClick={(e) => {
                            e.stopPropagation()
                            setReportToDelete(rep)
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>

                      <h3 className="history-card-filename" title={sourceNames}>
                        {sourceNames}
                      </h3>

                      <div className="history-card-badges">
                        <span className="history-metric-count">
                          {metricsCount} {metricsCount === 1 ? 'metric' : 'metrics'}
                        </span>

                        {riskCount > 0 ? (
                          <span className={`history-risk-badge ${hasHighRisk ? 'risk-high' : 'risk-medium'}`}>
                            {hasHighRisk ? '⚠️ ' : '⚡ '}
                            {riskCount} {riskCount === 1 ? 'Risk observation' : 'Risk observations'}
                          </span>
                        ) : (
                          <span className="history-risk-badge risk-clean">✓ 0 Risk flags</span>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {/* Report Detail Column */}
          <section
            className={`history-detail-column ${
              mobileView === 'list' ? 'history-hidden-on-mobile' : ''
            }`}
          >
            {/* Mobile Back Button */}
            <div className="history-mobile-back-bar">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setMobileView('list')}
              >
                ← Back to Saved Reports
              </button>
            </div>

            {selectedReport ? (
              <div className="history-detail-container">
                {/* Dedicated Action Bar for Selected Report */}
                <div className="history-viewer-toolbar panel">
                  <div className="history-viewer-meta">
                    <span className="history-meta-doc-type">
                      {selectedReport.report_type === 'single_document' ? 'Single Document' : 'Two Document Comparison'}
                    </span>
                    <span className="history-meta-id" title={selectedReport.report_id}>
                      ID: {selectedReport.report_id.slice(0, 8)}…
                    </span>
                    <span className="history-meta-timestamp">
                      {new Date(selectedReport.generated_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="history-viewer-buttons">
                    <button
                      type="button"
                      className="secondary-button history-tool-btn"
                      onClick={() => void handleCopySummary(selectedReport)}
                      title="Copy summary information to clipboard"
                    >
                      Copy Summary
                    </button>
                    <button
                      type="button"
                      className="secondary-button history-tool-btn"
                      onClick={() => downloadReportMarkdown(selectedReport)}
                      title="Download as GitHub Flavored Markdown"
                    >
                      Markdown
                    </button>
                    <button
                      type="button"
                      className="primary-button history-tool-btn"
                      onClick={() => window.print()}
                      title="Print or save as PDF"
                    >
                      Print / PDF
                    </button>
                  </div>
                </div>

                <ReportContent report={selectedReport} />
              </div>
            ) : (
              <section className="panel history-no-selection">
                <EmptyState
                  title="Select a Report"
                  body="Choose a generated report from the archive on the left to inspect detailed financial metrics, risk observations, comparison diffs, and export options."
                />
              </section>
            )}
          </section>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {reportToDelete && (
        <div className="modal-backdrop" role="presentation" onClick={() => setReportToDelete(null)}>
          <div
            className="history-dialog-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="section-kicker">Confirm Deletion</p>
                <h2 id="delete-dialog-title">Delete Saved Report?</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setReportToDelete(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="history-dialog-body">
              Are you sure you want to remove the report for{' '}
              <strong>{reportToDelete.source_documents.map((d) => d.filename).join(' vs ')}</strong> from your
              browser history? This action cannot be undone.
            </p>
            <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setReportToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => handleDeleteConfirm(reportToDelete.report_id)}
              >
                Delete Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowClearModal(false)}>
          <div
            className="history-dialog-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="section-kicker">Danger Zone</p>
                <h2 id="clear-dialog-title">Clear All Report History?</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowClearModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="history-dialog-body">
              This will permanently delete all <strong>{reports.length}</strong> research reports saved in your
              local browser history. You may want to click <strong>Export Archive</strong> first to save a JSON backup.
            </p>
            <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowClearModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={handleClearAllConfirm}
              >
                Clear All Reports
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
