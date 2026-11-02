import type { DocumentMetadata, ResearchReportResponse } from '../lib/api'
import type { RequestState } from '../lib/types'
import { ReportContent } from '../components/ui/ReportContent'

export function ReportsView({
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
