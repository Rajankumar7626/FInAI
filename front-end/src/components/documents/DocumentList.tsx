import type { DocumentMetadata } from '../../lib/api'
import type { RequestState } from '../../lib/types'
import { EmptyState } from '../ui/EmptyState'

export function DocumentList({
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
