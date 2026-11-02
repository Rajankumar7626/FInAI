import type { DocumentMetadata, RiskAnalysisResponse } from '../lib/api'
import type { RequestState } from '../lib/types'
import { EmptyState } from '../components/ui/EmptyState'
import { Limitations } from '../components/ui/Limitations'
import { RiskCard } from '../components/ui/RiskCard'

export function RiskView({
  riskData,
  selectedDocument,
  state,
  message,
}: {
  riskData: RiskAnalysisResponse | null
  selectedDocument: DocumentMetadata | null
  state: RequestState
  message: string
}) {
  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="section-kicker">Rule-based review</p>
          <h2>Risk analysis</h2>
        </div>
        <span className="context-label">
          {selectedDocument?.filename ?? 'No document selected'}
        </span>
      </div>

      {state === 'loading' && <div className="panel loading-block">{message}</div>}
      {state === 'error' && <div className="notice error">{message}</div>}

      {riskData && (
        <>
          <div className="risk-grid">
            {riskData.observations.length ? (
              riskData.observations.map((observation) => (
                <RiskCard key={observation.rule_id} observation={observation} />
              ))
            ) : (
              <div className="panel">
                <EmptyState
                  title="No triggered indicators"
                  body="No supported risk rule triggered for the selected document."
                />
              </div>
            )}
          </div>

          <Limitations items={riskData.limitations} />
        </>
      )}
    </section>
  )
}
