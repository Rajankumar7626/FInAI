import type { ComparisonResponse } from '../../lib/api'
import { formatSigned, formatValue } from '../../lib/formatters'
import { Limitations } from './Limitations'

export function ComparisonTable({ comparison }: { comparison: ComparisonResponse }) {
  return (
    <section className="panel comparison-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Metric review</p>
          <h2>Comparison results</h2>
        </div>
      </div>

      <div className="comparison-list">
        {comparison.metrics.map((metric) => (
          <article className={`comparison-row ${metric.comparison_status}`} key={metric.metric_name}>
            <div className="comparison-name">
              <strong>{metric.display_name}</strong>
              <span>{metric.comparison_status}</span>
            </div>

            <div className="comparison-values">
              <span>{formatValue(metric.first_value, metric.currency, metric.unit)}</span>
              <span className="difference">
                {metric.absolute_difference === null ? '—' : formatSigned(metric.absolute_difference)}
              </span>
              <span>{formatValue(metric.second_value, metric.currency, metric.unit)}</span>
            </div>

            <div className="comparison-meta">
              <small>
                {metric.first_reporting_period ?? 'Unknown period'} to{' '}
                {metric.second_reporting_period ?? 'Unknown period'}
              </small>
              <small>
                {metric.percentage_change === null
                  ? metric.limitation ?? 'No percentage returned'
                  : `${formatSigned(metric.percentage_change)}%`}
              </small>
            </div>
          </article>
        ))}
      </div>

      <Limitations items={comparison.limitations} />
    </section>
  )
}
