import type { ComparisonResponse } from '../../lib/api'
import { formatSigned, formatValue } from '../../lib/formatters'

export function ComparisonVisualChart({
  comparison,
  firstName,
  secondName,
}: {
  comparison: ComparisonResponse
  firstName: string
  secondName: string
}) {
  const comparableMetrics = comparison.metrics.filter(
    (m) => m.comparison_status === 'comparable' && m.first_value !== null && m.second_value !== null,
  )

  if (!comparableMetrics.length) return null

  return (
    <div className="visual-comparison-card">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Visual Comparison</p>
          <h2>Relative Metric Benchmarks</h2>
        </div>
        <div style={{ display: 'flex', gap: '14px', fontSize: '.72rem', fontWeight: 700 }}>
          <span style={{ color: '#3b82f6' }}>● {firstName}</span>
          <span style={{ color: '#10b981' }}>● {secondName}</span>
        </div>
      </div>

      <div className="chart-grid">
        {comparableMetrics.map((metric) => {
          const val1 = Math.abs(metric.first_value ?? 0)
          const val2 = Math.abs(metric.second_value ?? 0)
          const maxVal = Math.max(val1, val2) || 1
          const pct1 = Math.round((val1 / maxVal) * 100)
          const pct2 = Math.round((val2 / maxVal) * 100)

          return (
            <div className="chart-metric-row" key={metric.metric_name}>
              <div className="chart-metric-header">
                <span>{metric.display_name}</span>
                {metric.percentage_change !== null && (
                  <span style={{ color: metric.percentage_change >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatSigned(metric.percentage_change)}%
                  </span>
                )}
              </div>

              <div className="chart-bars-wrap">
                <div className="chart-bar-item">
                  <span className="chart-bar-label">{firstName}</span>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill first" style={{ width: `${pct1}%` }} />
                  </div>
                  <span className="chart-bar-val">{formatValue(metric.first_value, metric.currency, metric.unit)}</span>
                </div>

                <div className="chart-bar-item">
                  <span className="chart-bar-label">{secondName}</span>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill second" style={{ width: `${pct2}%` }} />
                  </div>
                  <span className="chart-bar-val">{formatValue(metric.second_value, metric.currency, metric.unit)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
