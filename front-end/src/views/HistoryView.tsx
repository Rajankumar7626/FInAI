import { useState } from 'react'
import type { ResearchReportResponse } from '../lib/api'
import { clearReportHistory, deleteSavedReport, getSavedReports } from '../lib/api'
import { EmptyState } from '../components/ui/EmptyState'
import { ReportContent } from '../components/ui/ReportContent'

export function HistoryView() {
  const [reports, setReports] = useState<ResearchReportResponse[]>(() => getSavedReports())
  const [selectedReportId, setSelectedReportId] = useState<string | null>(() => {
    const list = getSavedReports()
    return list[0]?.report_id ?? null
  })

  const selectedReport = reports.find((r) => r.report_id === selectedReportId) ?? null

  function handleDelete(id: string) {
    deleteSavedReport(id)
    const updated = getSavedReports()
    setReports(updated)
    if (selectedReportId === id) {
      setSelectedReportId(updated[0]?.report_id ?? null)
    }
  }

  function handleClearAll() {
    if (!window.confirm('Clear all saved research reports from browser history?')) return
    clearReportHistory()
    setReports([])
    setSelectedReportId(null)
  }

  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="section-kicker">Saved Research</p>
          <h2>Report History</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="count-badge">{reports.length} saved</span>
          {reports.length > 0 && (
            <button
              type="button"
              className="text-button"
              style={{ fontSize: '.75rem', color: '#ef4444' }}
              onClick={handleClearAll}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {reports.length === 0 ? (
        <section className="panel">
          <EmptyState
            title="No saved reports"
            body="When you generate single or comparative research reports in the Reports tab, they will automatically be preserved here."
          />
        </section>
      ) : (
        <div className="workspace-grid" style={{ alignItems: 'start' }}>
          <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Saved Archive</p>
                <h2>All Generated Reports</h2>
              </div>
            </div>

            <div className="document-list">
              {reports.map((rep) => {
                const isSelected = rep.report_id === selectedReportId
                const sourceNames = rep.source_documents.map((d) => d.filename).join(' vs ')

                return (
                  <div
                    key={rep.report_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected ? 'var(--bg-active, #f0f7f4)' : 'var(--bg-subtle, #f9fafb)',
                      border: isSelected ? '1px solid var(--border-active, #00875a)' : '1px solid var(--border-subtle, #e5e7eb)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      gap: '8px',
                    }}
                    onClick={() => setSelectedReportId(rep.report_id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '.65rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: rep.report_type === 'single_document' ? '#e0f2fe' : '#fef3c7',
                            color: rep.report_type === 'single_document' ? '#0369a1' : '#b45309',
                          }}
                        >
                          {rep.report_type === 'single_document' ? 'Single' : 'Comparative'}
                        </span>
                        <small style={{ color: '#6b7280' }}>
                          {new Date(rep.generated_at).toLocaleDateString()}
                        </small>
                      </div>
                      <strong style={{ fontSize: '.85rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sourceNames}
                      </strong>
                    </div>

                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        fontSize: '.85rem',
                      }}
                      title="Delete report"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(rep.report_id)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            {selectedReport ? (
              <ReportContent report={selectedReport} />
            ) : (
              <section className="panel">
                <EmptyState
                  title="Select a report"
                  body="Choose a report from the archive on the left to review its facts, observations, and download options."
                />
              </section>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
