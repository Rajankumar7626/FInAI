import type { DocumentMetadata, ResearchQuestionResponse } from '../lib/api'
import type { RequestState } from '../lib/types'
import { Limitations } from '../components/ui/Limitations'
import { MetricFactList } from '../components/ui/MetricFactList'

export function ResearchView({
  documents,
  selectedId,
  onSelect,
  researchQuery,
  onQueryChange,
  onAsk,
  response,
  state,
  message,
}: {
  documents: DocumentMetadata[]
  selectedId: string | null
  onSelect: (id: string) => void
  researchQuery: string
  onQueryChange: (q: string) => void
  onAsk: (q?: string) => void
  response: ResearchQuestionResponse | null
  state: RequestState
  message: string
}) {
  const selectedDoc = documents.find((d) => d.document_id === selectedId)
  const suggestions = [
    'What was the total revenue?',
    'What is the net income or profit?',
    'What are the debt and borrowings?',
    'What are the financial risks or red flags?',
    'What are the total assets and liabilities?',
  ]

  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="section-kicker">Evidence-backed inquiry</p>
          <h2>Financial Research Agent</h2>
        </div>
        <span className="context-label">{selectedDoc?.filename ?? 'No document selected'}</span>
      </div>

      <section className="panel qa-controls">
        <label>
          <span>Target Document</span>
          <select value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value)}>
            <option value="">Choose a report to inspect</option>
            {documents.map((item) => (
              <option key={item.document_id} value={item.document_id}>
                {item.filename}
              </option>
            ))}
          </select>
        </label>

        <form
          className="qa-input-row"
          onSubmit={(e) => {
            e.preventDefault()
            onAsk()
          }}
        >
          <input
            type="text"
            placeholder="Ask a question about financial metrics, risks, or performance..."
            value={researchQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            disabled={!selectedId || state === 'loading'}
          />
          <button
            type="submit"
            className="primary-button"
            disabled={!selectedId || !researchQuery.trim() || state === 'loading'}
          >
            {state === 'loading' ? 'Analyzing...' : 'Ask Agent'}
          </button>
        </form>

        <div className="prompt-chips">
          <span>Quick prompts:</span>
          {suggestions.map((prompt) => (
            <button
              type="button"
              key={prompt}
              className="prompt-chip"
              disabled={!selectedId || state === 'loading'}
              onClick={() => {
                onQueryChange(prompt)
                onAsk(prompt)
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      {state === 'loading' && <div className="panel loading-block">{message}</div>}
      {state === 'error' && <div className="notice error">{message}</div>}

      {response && (
        <article className="qa-response-card">
          <div className="qa-header">
            <div>
              <p className="section-kicker">Research Synthesis</p>
              <h3>{response.question}</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span
                className="qa-status-chip"
                style={{
                  background: response.analysis_mode === 'gemini_ai' ? '#e3f2fd' : '#f0f4f2',
                  color: response.analysis_mode === 'gemini_ai' ? '#0d47a1' : '#2d4b3e',
                }}
              >
                {response.analysis_mode === 'gemini_ai' ? '🤖 Gemini AI' : '⚡ Offline Engine'}
              </span>
              <span className={`qa-status-chip ${response.status}`}>
                {response.status === 'answered' ? 'Evidence Verified' : 'Insufficient Disclosures'}
              </span>
            </div>
          </div>

          <p className="qa-answer">{response.answer}</p>

          {response.relevant_metrics.length > 0 && (
            <div style={{ marginTop: '16px', marginBottom: '16px' }}>
              <p className="section-kicker">Extracted Metric Facts</p>
              <MetricFactList metrics={response.relevant_metrics} />
            </div>
          )}

          {response.citations.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p className="section-kicker">Source Evidence Citations</p>
              <div className="citation-list">
                {response.citations.map((cite, idx) => (
                  <div className="citation-card" key={idx}>
                    <p>"{cite.excerpt}"</p>
                    <div className="citation-meta">
                      <span>Relevance: {Math.round(cite.relevance_score * 100)}%</span>
                      {cite.matched_term && <span>Matched: {cite.matched_term}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {response.limitations.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <Limitations items={response.limitations} />
            </div>
          )}
        </article>
      )}
    </section>
  )
}
