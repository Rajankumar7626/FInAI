import type { DocumentMetadata, FinancialDataResponse, FinancialMetric } from '../lib/api'
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

  const incomeKeys = ['revenue', 'operating_profit', 'net_income', 'earnings_per_share']
  const balanceSheetKeys = [
    'cash_and_cash_equivalents',
    'total_assets',
    'total_liabilities',
    'total_debt',
    'stockholders_equity',
  ]
  const cashFlowKeys = [
    'operating_cash_flow',
    'capital_expenditures',
    'investing_cash_flow',
    'financing_cash_flow',
  ]

  const incomeMetrics = metrics.filter((m) => incomeKeys.includes(m.metric_name))
  const balanceSheetMetrics = metrics.filter((m) => balanceSheetKeys.includes(m.metric_name))
  const cashFlowMetrics = metrics.filter((m) => cashFlowKeys.includes(m.metric_name))

  // Key KPI metrics to highlight at the top
  const kpiOrder = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'net_income', label: 'Net Income' },
    { key: 'operating_profit', label: 'Operating Profit' },
    { key: 'operating_cash_flow', label: 'Operating Cash Flow' },
    { key: 'cash_and_cash_equivalents', label: 'Cash & Equivalents' },
    { key: 'stockholders_equity', label: "Stockholders' Equity" },
  ]
  const kpiList = kpiOrder
    .map((item) => ({ ...item, metric: metrics.find((m) => m.metric_name === item.key) }))
    .filter((item): item is { key: string; label: string; metric: FinancialMetric } => Boolean(item.metric))

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
          {kpiList.length > 0 && (
            <div className="financial-kpi-bar">
              {kpiList.map((item) => {
                const val = item.metric.value
                const isNegative = val < 0
                return (
                  <div className={`financial-kpi-card ${isNegative ? 'kpi-negative' : ''}`} key={item.key}>
                    <span className="kpi-label">{item.label}</span>
                    <div className="kpi-value">
                      {formatValue(item.metric.value, item.metric.currency, item.metric.unit)}
                    </div>
                    <span className="kpi-period">
                      {item.metric.reporting_period ? `FY ${item.metric.reporting_period}` : 'Reported value'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="financials-statements-grid">
            <div className="statement-card">
              <div className="statement-card-header">
                <h3>Income Statement</h3>
                <span className="statement-badge">{incomeMetrics.length} items</span>
              </div>
              {incomeMetrics.length ? (
                <div className="statement-metrics-list">
                  {incomeMetrics.map((m) => (
                    <div className="statement-metric-item" key={m.metric_name}>
                      <div className="statement-metric-header">
                        <div className="statement-metric-title-wrap">
                          <span className="statement-metric-name">{m.metric_name.replace(/_/g, ' ')}</span>
                          {m.reporting_period && (
                            <span className="metric-period-pill">{m.reporting_period}</span>
                          )}
                        </div>
                        <div className="statement-metric-val">
                          {formatValue(m.value, m.currency, m.unit)}
                        </div>
                      </div>
                      {m.source_context && (
                        <div className="statement-evidence-box">
                          <span className="evidence-quote-icon">“</span>
                          <span className="evidence-quote-text">{m.source_context}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">No income statement figures extracted.</p>
              )}
            </div>

            <div className="statement-card">
              <div className="statement-card-header">
                <h3>Balance Sheet</h3>
                <span className="statement-badge">{balanceSheetMetrics.length} items</span>
              </div>
              {balanceSheetMetrics.length ? (
                <div className="statement-metrics-list">
                  {balanceSheetMetrics.map((m) => (
                    <div className="statement-metric-item" key={m.metric_name}>
                      <div className="statement-metric-header">
                        <div className="statement-metric-title-wrap">
                          <span className="statement-metric-name">{m.metric_name.replace(/_/g, ' ')}</span>
                          {m.reporting_period && (
                            <span className="metric-period-pill">{m.reporting_period}</span>
                          )}
                        </div>
                        <div className="statement-metric-val">
                          {formatValue(m.value, m.currency, m.unit)}
                        </div>
                      </div>
                      {m.source_context && (
                        <div className="statement-evidence-box">
                          <span className="evidence-quote-icon">“</span>
                          <span className="evidence-quote-text">{m.source_context}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">No balance sheet figures extracted.</p>
              )}
            </div>

            <div className="statement-card">
              <div className="statement-card-header">
                <h3>Cash Flow & Liquidity</h3>
                <span className="statement-badge">{cashFlowMetrics.length} items</span>
              </div>
              {cashFlowMetrics.length ? (
                <div className="statement-metrics-list">
                  {cashFlowMetrics.map((m) => (
                    <div className="statement-metric-item" key={m.metric_name}>
                      <div className="statement-metric-header">
                        <div className="statement-metric-title-wrap">
                          <span className="statement-metric-name">{m.metric_name.replace(/_/g, ' ')}</span>
                          {m.reporting_period && (
                            <span className="metric-period-pill">{m.reporting_period}</span>
                          )}
                        </div>
                        <div className="statement-metric-val">
                          {formatValue(m.value, m.currency, m.unit)}
                        </div>
                      </div>
                      {m.source_context && (
                        <div className="statement-evidence-box">
                          <span className="evidence-quote-icon">“</span>
                          <span className="evidence-quote-text">{m.source_context}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">No cash flow figures extracted.</p>
              )}
            </div>
          </div>

          <section className="panel registry-panel">
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
