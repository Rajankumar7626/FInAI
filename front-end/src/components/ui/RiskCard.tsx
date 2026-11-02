import type { RiskAnalysisResponse } from '../../lib/api'

export function RiskCard({
  observation,
}: {
  observation: RiskAnalysisResponse['observations'][number]
}) {
  return (
    <article className="risk-card">
      <div className="risk-card-top">
        <span className={`severity ${observation.severity}`}>{observation.severity}</span>
        <span className="rule-id">{observation.rule_id}</span>
      </div>

      <h3>{observation.title}</h3>
      <p>{observation.explanation}</p>

      <div className="evidence-box">
        <span>Evidence</span>
        {observation.evidence.map((item) => (
          <blockquote key={item}>{item}</blockquote>
        ))}
      </div>

      <small>{observation.limitation}</small>
    </article>
  )
}
