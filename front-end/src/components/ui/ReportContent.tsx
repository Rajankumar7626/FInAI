import type { ResearchReportResponse } from '../../lib/api'
import { downloadReportMarkdown, formatValue } from '../../lib/formatters'
import { ComparisonTable } from './ComparisonTable'
import { EmptyState } from './EmptyState'
import { Limitations } from './Limitations'
import { RiskCard } from './RiskCard'

export function ReportContent({ report }: { report: ResearchReportResponse }) {
  return (
    <div className="report-stack">
      <section className="report-heading panel">
        <div>
          <p className="section-kicker">
            {report.report_type === 'single_document'
              ? 'Single document'
              : 'Two document comparison'}
          </p>
          <h2>Research report</h2>
          <p className="muted-copy">
            Generated {new Date(report.generated_at).toLocaleString()} / {report.report_id}
          </p>
        </div>

        <div className="export-bar">
          <button
            type="button"
            className="secondary-button"
            onClick={() => downloadReportMarkdown(report)}
          >
            Export as Markdown
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </section>

      <section className="report-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Source facts</p>
              <h2>Extracted metrics</h2>
            </div>
          </div>

          {report.source_documents.map((source) => (
            <div className="report-source" key={source.document_id}>
              <h3>{source.filename}</h3>

              {source.metrics.length ? (
                source.metrics.map((metric) => (
                  <div
                    className="report-metric"
                    key={`${source.document_id}-${metric.metric_name}`}
                  >
                    <strong>{metric.metric_name.replaceAll('_', ' ')}</strong>
                    <span>{formatValue(metric.value, metric.currency, metric.unit)}</span>
                    <small>{metric.source_context}</small>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No supported metrics were extracted.</p>
              )}
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Observations</p>
              <h2>Risk review</h2>
            </div>
          </div>

          {report.risk_observations.length ? (
            report.risk_observations.map((item) => (
              <RiskCard key={`${item.rule_id}-${item.evidence[0]}`} observation={item} />
            ))
          ) : (
            <EmptyState
              title="No triggered indicators"
              body="The deterministic risk rules returned no observations."
            />
          )}
        </div>
      </section>

      {report.comparison && <ComparisonTable comparison={report.comparison} />}

      <section className="report-grid">
        <Limitations items={report.missing_information} />

        <section className="panel methodology">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Method</p>
              <h2>{report.methodology.summary}</h2>
            </div>
          </div>

          <ol>
            {report.methodology.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </section>

      <Limitations items={report.limitations} />
    </div>
  )
}
