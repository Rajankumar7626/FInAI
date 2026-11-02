import type { RiskAnalysisResponse } from '../../lib/api'
import { formatValue } from '../../lib/formatters'

export function RiskCard({
  observation,
  onInvestigate,
}: {
  observation: RiskAnalysisResponse['observations'][number]
  onInvestigate?: (query: string) => void
}) {
  const isHigh = observation.severity === 'high'

  const impactNotes: Record<string, string> = {
    negative_net_income:
      'Unprofitable operations during this fiscal period reduce retained earnings and may increase reliance on external debt or equity financing if sustained.',
    negative_operating_cash_flow:
      'Operating activities consumed cash rather than generating surplus liquidity. Highlights potential working capital strain.',
    liabilities_exceed_assets:
      'Critical solvency indicator: cumulative financial obligations exceed balance-sheet asset values, indicating negative stockholders’ equity.',
    high_debt_to_assets:
      'Elevated leverage increases vulnerability to interest expense burdens and limits debt capacity for strategic investments.',
  }

  const impact = impactNotes[observation.rule_id] ?? 'Requires balance sheet and operational monitoring.'

  return (
    <article className={`enhanced-risk-card ${isHigh ? 'severity-high' : 'severity-medium'}`}>
      <div className="risk-card-topbar">
        <div className="risk-badge-group">
          <span className={`risk-severity-badge ${observation.severity}`}>
            {isHigh ? '🚨 High Risk' : '⚠️ Warning'}
          </span>
          <span className="risk-rule-pill">{observation.rule_id.replace(/_/g, ' ')}</span>
        </div>

        {onInvestigate && (
          <button
            type="button"
            className="risk-investigate-btn"
            onClick={() => onInvestigate(`What caused the ${observation.title.toLowerCase()}?`)}
            title="Investigate this observation in the Financial Research Agent"
          >
            Investigate in Q&A →
          </button>
        )}
      </div>

      <h3 className="risk-card-title">{observation.title}</h3>
      <p className="risk-card-explanation">{observation.explanation}</p>

      {/* Financial Impact Note */}
      <div className="risk-impact-callout">
        <span className="risk-impact-tag">Potential Implication:</span>
        <span className="risk-impact-text">{impact}</span>
      </div>

      {/* Relevant Disclosed Metrics */}
      {observation.relevant_metrics.length > 0 && (
        <div className="risk-metrics-strip">
          {observation.relevant_metrics.map((m) => (
            <div className="risk-metric-chip" key={m.metric_name}>
              <span className="risk-metric-chip-name">{m.metric_name.replace(/_/g, ' ')}</span>
              <strong>{formatValue(m.value, m.currency, m.unit)}</strong>
              {m.reporting_period && <small>FY {m.reporting_period}</small>}
            </div>
          ))}
        </div>
      )}

      {/* Disclosed Evidence */}
      {observation.evidence.length > 0 && (
        <div className="evidence-box">
          <span>Verified Disclosed Evidence</span>
          {observation.evidence.map((item, idx) => (
            <blockquote key={`${item}-${idx}`}>{item}</blockquote>
          ))}
        </div>
      )}

      <div className="risk-card-footer">
        <small className="risk-limitation-note">{observation.limitation}</small>
      </div>
    </article>
  )
}
