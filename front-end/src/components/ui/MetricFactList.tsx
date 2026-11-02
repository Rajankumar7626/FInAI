import type { FinancialDataResponse } from '../../lib/api'
import { formatValue } from '../../lib/formatters'

export function MetricFactList({ metrics }: { metrics: FinancialDataResponse['metrics'] }) {
  return (
    <div className="metric-fact-list">
      {metrics.length ? (
        metrics.map((metric) => (
          <div className="metric-fact" key={metric.metric_name}>
            <strong>{metric.metric_name.replaceAll('_', ' ')}</strong>
            <span>{formatValue(metric.value, metric.currency, metric.unit)}</span>
            <small>{metric.reporting_period ?? 'Period unavailable'}</small>
          </div>
        ))
      ) : (
        <p className="muted-copy">No supported metrics were extracted.</p>
      )}
    </div>
  )
}
