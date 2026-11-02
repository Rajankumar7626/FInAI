import type { ComparisonResponse } from '../../lib/api'
import { formatSigned, formatValue } from '../../lib/formatters'

function getUnitMultiplier(unit: string | null): number {
  if (unit === 'billion') return 1_000_000_000
  if (unit === 'million') return 1_000_000
  if (unit === 'thousand') return 1_000
  return 1
}

function convertToUSD(val: number, cur: string | null, unit: string | null, inrPerUsd = 85.0): number {
  const absUnits = val * getUnitMultiplier(unit)
  if (cur === 'INR') return absUnits / inrPerUsd
  if (cur === 'EUR') return absUnits * 1.08
  if (cur === 'GBP') return absUnits * 1.30
  return absUnits
}

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

  const availableBoth = comparison.metrics.filter(
    (m) => m.first_value !== null && m.second_value !== null,
  )

  const isCrossCurrency = comparableMetrics.length === 0 && availableBoth.length > 0

  if (!comparableMetrics.length && !isCrossCurrency) return null

  // If directly comparable, use standard values; if cross-currency, use normalized USD values
  const displayMetrics = comparableMetrics.length > 0 ? comparableMetrics : availableBoth.slice(0, 6)

  return (
    <div className="visual-comparison-card">
      <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="section-kicker">Visual Comparison</p>
          <h2 style={{ margin: '4px 0 0' }}>
            {isCrossCurrency ? 'Normalized Benchmark Overview (USD Basis)' : 'Relative Metric Benchmarks'}
          </h2>
          {isCrossCurrency && (
            <p style={{ margin: '4px 0 0', fontSize: '.76rem', color: 'var(--muted)' }}>
              Cross-border comparison normalized to USD (1 USD ≈ 85 INR) for scale visualization.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '14px', fontSize: '.74rem', fontWeight: 700 }}>
          <span style={{ color: '#2563eb' }}>● {firstName}</span>
          <span style={{ color: '#059669' }}>● {secondName}</span>
        </div>
      </div>

      <div className="chart-grid">
        {displayMetrics.map((metric) => {
          const firstCur = metric.first_currency ?? metric.currency
          const firstUnit = metric.first_unit ?? metric.unit
          const secondCur = metric.second_currency ?? metric.currency
          const secondUnit = metric.second_unit ?? metric.unit

          let val1 = Math.abs(metric.first_value ?? 0)
          let val2 = Math.abs(metric.second_value ?? 0)

          if (isCrossCurrency) {
            val1 = convertToUSD(metric.first_value ?? 0, firstCur, firstUnit)
            val2 = convertToUSD(metric.second_value ?? 0, secondCur, secondUnit)
          }

          const maxVal = Math.max(val1, val2) || 1
          const pct1 = Math.min(100, Math.round((val1 / maxVal) * 100))
          const pct2 = Math.min(100, Math.round((val2 / maxVal) * 100))

          return (
            <div className="chart-metric-row" key={metric.metric_name}>
              <div className="chart-metric-header">
                <span>{metric.display_name}</span>
                {metric.percentage_change !== null ? (
                  <span style={{ color: metric.percentage_change >= 0 ? '#059669' : '#dc2626' }}>
                    {formatSigned(metric.percentage_change)}%
                  </span>
                ) : isCrossCurrency && val1 > 0 ? (
                  <span style={{ color: val2 >= val1 ? '#059669' : '#dc2626', fontSize: '.72rem' }}>
                    {formatSigned(((val2 - val1) / val1) * 100)}% (norm.)
                  </span>
                ) : null}
              </div>

              <div className="chart-bars-wrap">
                <div className="chart-bar-item">
                  <span className="chart-bar-label" title={firstName}>{firstName}</span>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill first" style={{ width: `${pct1}%`, background: '#2563eb' }} />
                  </div>
                  <span className="chart-bar-val">
                    {formatValue(metric.first_value, firstCur, firstUnit)}
                    {isCrossCurrency && firstCur !== 'USD' && (
                      <small style={{ color: 'var(--muted)', marginLeft: '4px' }}>
                        (≈${(val1 / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M)
                      </small>
                    )}
                  </span>
                </div>

                <div className="chart-bar-item">
                  <span className="chart-bar-label" title={secondName}>{secondName}</span>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill second" style={{ width: `${pct2}%`, background: '#059669' }} />
                  </div>
                  <span className="chart-bar-val">
                    {formatValue(metric.second_value, secondCur, secondUnit)}
                    {isCrossCurrency && secondCur !== 'USD' && (
                      <small style={{ color: 'var(--muted)', marginLeft: '4px' }}>
                        (≈${(val2 / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M)
                      </small>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
