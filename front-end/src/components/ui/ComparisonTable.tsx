import { useState } from 'react'
import type { ComparisonResponse, ComparedMetric } from '../../lib/api'
import { formatSigned, formatValue } from '../../lib/formatters'
import { Limitations } from './Limitations'

function getUnitMultiplier(unit: string | null): number {
  if (unit === 'billion') return 1_000_000_000
  if (unit === 'million') return 1_000_000
  if (unit === 'thousand') return 1_000
  return 1
}

function convertToUSD(val: number, cur: string | null, unit: string | null, inrPerUsd: number): number {
  const absUnits = val * getUnitMultiplier(unit)
  if (cur === 'INR') return absUnits / (inrPerUsd || 85.0)
  if (cur === 'EUR') return absUnits * 1.08
  if (cur === 'GBP') return absUnits * 1.30
  return absUnits
}

export function ComparisonTable({
  comparison,
  firstName = 'Report A',
  secondName = 'Report B',
}: {
  comparison: ComparisonResponse
  firstName?: string
  secondName?: string
}) {
  const [filter, setFilter] = useState<'all' | 'comparable' | 'incomparable' | 'unavailable'>('all')
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [fxEnabled, setFxEnabled] = useState(false)
  const [fxRate, setFxRate] = useState(85.0)

  const firstCurrencies = Array.from(new Set(comparison.metrics.map((m) => m.first_currency).filter(Boolean)))
  const secondCurrencies = Array.from(new Set(comparison.metrics.map((m) => m.second_currency).filter(Boolean)))
  const firstPeriods = Array.from(new Set(comparison.metrics.map((m) => m.first_reporting_period).filter(Boolean)))
  const secondPeriods = Array.from(new Set(comparison.metrics.map((m) => m.second_reporting_period).filter(Boolean)))

  const hasCrossCurrency = firstCurrencies.some(
    (c) => secondCurrencies.length > 0 && !secondCurrencies.includes(c),
  )

  const toggleRow = (metricName: string) => {
    setExpandedRows((prev) => ({ ...prev, [metricName]: !prev[metricName] }))
  }

  const counts = {
    all: comparison.metrics.length,
    comparable: comparison.metrics.filter((m) => m.comparison_status === 'comparable').length,
    incomparable: comparison.metrics.filter((m) => m.comparison_status === 'incomparable').length,
    unavailable: comparison.metrics.filter((m) => m.comparison_status === 'unavailable').length,
  }

  const filteredMetrics = comparison.metrics.filter((m) => {
    if (filter === 'all') return true
    return m.comparison_status === filter
  })

  return (
    <section className="panel comparison-panel">
      <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <p className="section-kicker">Period-matched review</p>
          <h2 style={{ margin: '4px 0 0' }}>Comparison results</h2>
        </div>

        {/* Filter Pills */}
        <div className="comparison-filter-bar">
          <button
            type="button"
            className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            className={`filter-pill comparable ${filter === 'comparable' ? 'active' : ''}`}
            onClick={() => setFilter('comparable')}
          >
            Comparable ({counts.comparable})
          </button>
          <button
            type="button"
            className={`filter-pill incomparable ${filter === 'incomparable' ? 'active' : ''}`}
            onClick={() => setFilter('incomparable')}
          >
            Incomparable ({counts.incomparable})
          </button>
          <button
            type="button"
            className={`filter-pill unavailable ${filter === 'unavailable' ? 'active' : ''}`}
            onClick={() => setFilter('unavailable')}
          >
            Unavailable ({counts.unavailable})
          </button>
        </div>
      </div>

      {/* Cross-Currency FX Normalization Toolbar */}
      {hasCrossCurrency && (
        <div className="fx-normalization-card">
          <div className="fx-header">
            <div className="fx-title-block">
              <span className="fx-tag">Currency Mismatch Detected</span>
              <strong>Cross-Border Currency Normalization (FX)</strong>
              <p>
                First report reports in <strong>{firstCurrencies.join(', ') || 'N/A'}</strong>; second report reports in{' '}
                <strong>{secondCurrencies.join(', ') || 'N/A'}</strong>. Direct comparison is withheld under GAAP rules.
                Enable FX Normalization to benchmark relative performance side-by-side.
              </p>
            </div>
            <div className="fx-controls">
              <label className="fx-toggle-label">
                <input
                  type="checkbox"
                  checked={fxEnabled}
                  onChange={(e) => setFxEnabled(e.target.checked)}
                />
                <span>Enable FX Benchmarking</span>
              </label>

              {fxEnabled && (
                <div className="fx-rate-input-wrap">
                  <span className="fx-rate-label">1 USD =</span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    className="fx-rate-input"
                    value={fxRate}
                    onChange={(e) => setFxRate(parseFloat(e.target.value) || 1)}
                  />
                  <span className="fx-rate-unit">INR</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comparison Grid Column Headers */}
      <div className="comparison-table-header-row">
        <div className="comp-col-name">Financial Metric</div>
        <div className="comp-col-doc first">
          <span className="doc-col-title" title={firstName}>{firstName}</span>
          <span className="doc-col-badge">
            {firstCurrencies.join('/') || 'No cur'} · {firstPeriods.join('/') || 'No period'}
          </span>
        </div>
        <div className="comp-col-variance">Variance (B − A)</div>
        <div className="comp-col-doc second">
          <span className="doc-col-title" title={secondName}>{secondName}</span>
          <span className="doc-col-badge">
            {secondCurrencies.join('/') || 'No cur'} · {secondPeriods.join('/') || 'No period'}
          </span>
        </div>
      </div>

      <div className="comparison-list">
        {filteredMetrics.map((metric: ComparedMetric) => {
          const isExpanded = !!expandedRows[metric.metric_name]

          // Native formatted values
          const firstCur = metric.first_currency ?? metric.currency
          const firstUnit = metric.first_unit ?? metric.unit
          const secondCur = metric.second_currency ?? metric.currency
          const secondUnit = metric.second_unit ?? metric.unit

          const firstValFormatted = formatValue(metric.first_value, firstCur, firstUnit)
          const secondValFormatted = formatValue(metric.second_value, secondCur, secondUnit)

          // FX Normalization calculation if enabled
          let normalizedFirstUsd: number | null = null
          let normalizedSecondUsd: number | null = null
          let normalizedDiff: number | null = null
          let normalizedPct: number | null = null

          if (fxEnabled && metric.first_value !== null && metric.second_value !== null) {
            normalizedFirstUsd = convertToUSD(metric.first_value, firstCur, firstUnit, fxRate)
            normalizedSecondUsd = convertToUSD(metric.second_value, secondCur, secondUnit, fxRate)
            normalizedDiff = normalizedSecondUsd - normalizedFirstUsd
            if (normalizedFirstUsd !== 0) {
              normalizedPct = (normalizedDiff / Math.abs(normalizedFirstUsd)) * 100
            }
          }

          return (
            <article
              className={`comparison-row ${metric.comparison_status} ${isExpanded ? 'expanded' : ''}`}
              key={metric.metric_name}
              onClick={() => toggleRow(metric.metric_name)}
              style={{ cursor: 'pointer' }}
            >
              <div className="comparison-row-main">
                <div className="comparison-name">
                  <strong>{metric.display_name}</strong>
                  <div className="comparison-badge-group">
                    <span className={`status-badge ${metric.comparison_status}`}>
                      {metric.comparison_status}
                    </span>
                    <span className="expand-indicator">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                <div className="comparison-values-grid">
                  {/* First Document Value */}
                  <div className="val-block first-doc">
                    <span className="val-figure">{firstValFormatted}</span>
                    {fxEnabled && normalizedFirstUsd !== null && firstCur !== 'USD' && (
                      <span className="normalized-subval">
                        ≈ USD {(normalizedFirstUsd / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M
                      </span>
                    )}
                    <span className="period-tag">{metric.first_reporting_period ?? 'Unknown period'}</span>
                  </div>

                  {/* Variance / Difference */}
                  <div className="val-block variance-col">
                    {metric.comparison_status === 'comparable' && (
                      <>
                        <span className="difference">
                          {metric.absolute_difference === null ? '—' : formatSigned(metric.absolute_difference)}
                        </span>
                        <span className="pct-badge">
                          {metric.percentage_change !== null ? `${formatSigned(metric.percentage_change)}%` : '—'}
                        </span>
                      </>
                    )}

                    {metric.comparison_status === 'incomparable' && !fxEnabled && (
                      <span className="difference-muted" title={metric.limitation ?? ''}>
                        —
                      </span>
                    )}

                    {metric.comparison_status === 'incomparable' && fxEnabled && normalizedDiff !== null && (
                      <div className="normalized-variance-block">
                        <span className={`difference ${normalizedDiff >= 0 ? 'pos' : 'neg'}`}>
                          {formatSigned(normalizedDiff / 1_000_000)}M USD
                        </span>
                        {normalizedPct !== null && (
                          <span className={`pct-badge ${normalizedPct >= 0 ? 'pos' : 'neg'}`}>
                            {formatSigned(normalizedPct)}% (norm.)
                          </span>
                        )}
                      </div>
                    )}

                    {metric.comparison_status === 'unavailable' && (
                      <span className="difference-muted">—</span>
                    )}
                  </div>

                  {/* Second Document Value */}
                  <div className="val-block second-doc">
                    <span className="val-figure">{secondValFormatted}</span>
                    {fxEnabled && normalizedSecondUsd !== null && secondCur !== 'USD' && (
                      <span className="normalized-subval">
                        ≈ USD {(normalizedSecondUsd / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M
                      </span>
                    )}
                    <span className="period-tag">{metric.second_reporting_period ?? 'Unknown period'}</span>
                  </div>
                </div>
              </div>

              {/* Subtitle / Limitation notice */}
              <div className="comparison-meta-bar">
                <small className="period-span">
                  {metric.first_reporting_period ?? 'Unknown period'} →{' '}
                  {metric.second_reporting_period ?? 'Unknown period'}
                </small>
                {metric.limitation && (
                  <small className="limitation-badge">
                    {metric.limitation}
                  </small>
                )}
              </div>

              {/* Expandable Audit Provenance */}
              {isExpanded && (
                <div className="comparison-evidence-drawer" onClick={(e) => e.stopPropagation()}>
                  <div className="evidence-col">
                    <span className="evidence-source-tag">Source: {firstName}</span>
                    {metric.first_evidence ? (
                      <blockquote className="evidence-quote">"{metric.first_evidence}"</blockquote>
                    ) : (
                      <p className="evidence-missing">Metric not disclosed in this report.</p>
                    )}
                  </div>
                  <div className="evidence-col">
                    <span className="evidence-source-tag">Source: {secondName}</span>
                    {metric.second_evidence ? (
                      <blockquote className="evidence-quote">"{metric.second_evidence}"</blockquote>
                    ) : (
                      <p className="evidence-missing">Metric not disclosed in this report.</p>
                    )}
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <Limitations items={comparison.limitations} />
    </section>
  )
}
