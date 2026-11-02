import type { FinancialDataResponse } from '../../lib/api'
import { formatValue } from '../../lib/formatters'

export function MetricFactList({
  metrics,
  compact = false,
}: {
  metrics: FinancialDataResponse['metrics']
  compact?: boolean
}) {
  if (!metrics.length) {
    return <p className="muted-copy">No supported metrics were extracted.</p>
  }

  if (compact) {
    return (
      <div className="metric-fact-list">
        {metrics.map((metric) => (
          <div className="metric-fact" key={metric.metric_name}>
            <div className="metric-fact-top">
              <strong>{metric.metric_name.replaceAll('_', ' ')}</strong>
              <span className="metric-fact-period">
                {metric.reporting_period ? `FY ${metric.reporting_period}` : 'Period unavailable'}
              </span>
            </div>
            <span className="metric-fact-value">{formatValue(metric.value, metric.currency, metric.unit)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="metric-registry-table-wrapper">
      <table className="metric-registry-table">
        <thead>
          <tr>
            <th>Line Item Metric</th>
            <th className="align-right">Disclosed Amount</th>
            <th className="align-center">Period</th>
            <th>Source Context & Evidence</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={`${metric.metric_name}-${metric.reporting_period ?? 'no-period'}`}>
              <td className="metric-table-name">
                <strong>{metric.metric_name.replaceAll('_', ' ')}</strong>
              </td>
              <td className="metric-table-val align-right">
                <code>{formatValue(metric.value, metric.currency, metric.unit)}</code>
              </td>
              <td className="align-center">
                <span className={`registry-period-badge ${metric.reporting_period ? 'has-period' : 'no-period'}`}>
                  {metric.reporting_period ?? 'Disclosed'}
                </span>
              </td>
              <td className="metric-table-evidence">
                <div className="evidence-cell-text" title={metric.source_context}>
                  {metric.source_context}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
