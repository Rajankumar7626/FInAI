import type { DocumentMetadata, FinancialDataResponse } from '../lib/api'
import type { RequestState, View } from '../lib/types'
import { DocumentList } from '../components/documents/DocumentList'
import { SelectedDocumentPanel } from '../components/documents/SelectedDocumentPanel'
import { DragDropUploadZone } from '../components/ui/DragDropUploadZone'
import { SummaryCard } from '../components/ui/SummaryCard'

export function DashboardView(props: {
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
