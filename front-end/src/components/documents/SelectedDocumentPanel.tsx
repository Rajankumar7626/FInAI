import type { DocumentMetadata, FinancialDataResponse } from '../../lib/api'
import type { View } from '../../lib/types'
import { EmptyState } from '../ui/EmptyState'
import { MetricFactList } from '../ui/MetricFactList'

export function SelectedDocumentPanel({
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
