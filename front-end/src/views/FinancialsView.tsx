import type { DocumentMetadata, FinancialDataResponse } from '../lib/api'
import type { RequestState } from '../lib/types'
import { EmptyState } from '../components/ui/EmptyState'
import { MetricFactList } from '../components/ui/MetricFactList'
import { formatValue } from '../lib/formatters'

export function FinancialsView({
  documents,
  selectedId,
  selectedDocument,
  financialData,
  onSelect,
  state,
  message,
}: {
  documents: DocumentMetadata[]
  selectedId: string | null
  selectedDocument: DocumentMetadata | null
  financialData: FinancialDataResponse | null
  onSelect: (id: string) => void
  state: RequestState
  message: string
}) {
  const metrics = financialData?.metrics ?? []
  const incomeMetrics = metrics.filter((m) =>
    ['revenue', 'net_income', 'operating_profit', 'earnings_per_share'].includes(m.metric_name),
  )
  const balanceSheetMetrics = metrics.filter((m) =>
    ['total_assets', 'total_liabilities', 'total_debt', 'cash_and_cash_equivalents'].includes(m.metric_name),
  )
  const cashFlowMetrics = metrics.filter((m) =>
    ['operating_cash_flow'].includes(m.metric_name),
  )

  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="section-kicker">Financial Disclosures</p>
          <h2>Financial Statements & Metrics</h2>
        </div>
        <span className="context-label">{selectedDocument?.filename ?? 'No document selected'}</span>
      </div>

      <section className="panel compare-controls">
        <label style={{ gridColumn: '1 / -1' }}>
          <span>Select Document</span>
          <select value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value)}>
            <option value="">Choose a document</option>
            {documents.map((d) => (
              <option key={d.document_id} value={d.document_id}>
                {d.filename}
              </option>
            ))}
          </select>
        </label>
      </section>

      {state === 'loading' && <div className="panel loading-block">{message}</div>}
      {state === 'error' && <div className="notice error">{message}</div>}

      {!selectedDocument && (
        <section className="panel">
          <EmptyState
            title="No report selected"
            body="Select a document from above to view its structured financial statements."
          />
        </section>
      )}

      {selectedDocument && financialData && (
        <>
          <div className="financials-statements-grid">
            <div className="statement-card">
              <h3>Income Statement</h3>
              {incomeMetrics.length ? (
                incomeMetrics.map((m) => (
                  <div className="statement-metric-row" key={m.metric_name}>
                    <div>
                      <div className="statement-metric-name">{m.metric_name.replace(/_/g, ' ')}</div>
                      <div className="statement-context">"{m.source_context}"</div>
                    </div>
                    <div className="statement-metric-val">{formatValue(m.value, m.currency, m.unit)}</div>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No income statement figures extracted.</p>
              )}
            </div>

            <div className="statement-card">
              <h3>Balance Sheet</h3>
              {balanceSheetMetrics.length ? (
                balanceSheetMetrics.map((m) => (
                  <div className="statement-metric-row" key={m.metric_name}>
                    <div>
                      <div className="statement-metric-name">{m.metric_name.replace(/_/g, ' ')}</div>
                      <div className="statement-context">"{m.source_context}"</div>
                    </div>
                    <div className="statement-metric-val">{formatValue(m.value, m.currency, m.unit)}</div>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No balance sheet figures extracted.</p>
              )}
            </div>

            <div className="statement-card">
              <h3>Cash Flow & Liquidity</h3>
              {cashFlowMetrics.length ? (
                cashFlowMetrics.map((m) => (
                  <div className="statement-metric-row" key={m.metric_name}>
                    <div>
                      <div className="statement-metric-name">{m.metric_name.replace(/_/g, ' ')}</div>
                      <div className="statement-context">"{m.source_context}"</div>
                    </div>
                    <div className="statement-metric-val">{formatValue(m.value, m.currency, m.unit)}</div>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No cash flow figures extracted.</p>
              )}
            </div>
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Complete Registry</p>
                <h2>All Disclosed Facts ({metrics.length})</h2>
              </div>
            </div>
            <MetricFactList metrics={metrics} />
          </section>
        </>
      )}
    </section>
  )
}
