import { ApiError, type ResearchReportResponse } from './api'

export function formatValue(
  value: number | null,
  currency: string | null,
  unit: string | null,
): string {
  if (value === null) return 'Unavailable'

  return `${currency ? `${currency} ` : ''}${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}${unit ? ` ${unit}` : ''}`
}

export function formatSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your sign-in session expired. Please sign in again.'
  }

  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'The request could not be completed.'
}

export function downloadReportMarkdown(report: ResearchReportResponse): void {
  let md = `# FinSight AI - Research Report\n`
  md += `**Report ID:** ${report.report_id} | **Generated:** ${new Date(report.generated_at).toLocaleString()}\n`
  md += `**Type:** ${report.report_type === 'single_document' ? 'Single Document Analysis' : 'Two Document Comparison'}\n\n`
  md += `## 1. Source Document Metrics\n`
  report.source_documents.forEach((doc) => {
    md += `### ${doc.filename}\n`
    if (doc.metrics.length) {
      doc.metrics.forEach((m) => {
        md += `- **${m.metric_name.replace(/_/g, ' ').toUpperCase()}**: ${formatValue(m.value, m.currency, m.unit)} (${m.reporting_period ?? 'N/A'})\n  Context: "${m.source_context}"\n`
      })
    } else {
      md += `No supported metrics extracted.\n`
    }
  })
  if (report.risk_observations.length) {
    md += `\n## 2. Risk Observations\n`
    report.risk_observations.forEach((obs) => {
      md += `### [${obs.severity.toUpperCase()}] ${obs.title} (${obs.rule_id})\n${obs.explanation}\n`
      obs.evidence.forEach((e) => {
        md += `> Evidence: ${e}\n`
      })
    })
  }
  if (report.limitations.length) {
    md += `\n## 3. Disclosures & Limitations\n`
    report.limitations.forEach((lim) => {
      md += `- ${lim}\n`
    })
  }
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finsight-report-${report.report_id.slice(0, 8)}.md`
  a.click()
  URL.revokeObjectURL(url)
}
