import type { DocumentMetadata, FinancialDataResponse } from '../lib/api'
import type { RequestState } from '../lib/types'
import { DocumentList } from '../components/documents/DocumentList'
import { SelectedDocumentPanel } from '../components/documents/SelectedDocumentPanel'
import { DragDropUploadZone } from '../components/ui/DragDropUploadZone'

export function DocumentsView(props: {
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
