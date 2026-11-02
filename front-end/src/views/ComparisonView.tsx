import type { ComparisonResponse, DocumentMetadata } from '../lib/api'
import type { RequestState } from '../lib/types'
import { ComparisonTable } from '../components/ui/ComparisonTable'
import { ComparisonVisualChart } from '../components/ui/ComparisonVisualChart'

export function ComparisonView({
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
  const firstName = firstDoc?.filename ?? 'First Report'
  const secondName = secondDoc?.filename ?? 'Second Report'

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
            firstName={firstName}
            secondName={secondName}
          />
          <ComparisonTable
            comparison={comparison}
            firstName={firstName}
            secondName={secondName}
          />
        </>
      )}
    </section>
  )
}
