import { useState } from 'react'
import '../LandingPage.css'

const CURRENT_YEAR = new Date().getFullYear()

interface LandingPageProps {
  onLogin: () => void | Promise<void>
  loginFailed?: boolean
  error?: Error | null
}

export function LandingPage({ onLogin, loginFailed, error }: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<'qa' | 'financials' | 'comparison'>('qa')

  return (
    <div className="landing-page-wrap">
      <div className="landing-canvas">
        {/* Navigation Bar */}
        <header className="landing-nav">
          <div className="landing-brand">
            <img src="/logo.png" alt="FinSight AI Logo" className="landing-brand-img" />
            <span className="landing-brand-text">FinSight AI</span>
          </div>

          <nav>
            <ul className="landing-nav-links">
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <a href="#research">Research Agent</a>
              </li>
              <li>
                <a href="#comparison">Comparison</a>
              </li>
              <li>
                <a
                  href="https://github.com/Rajankumar7626/FInAI"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </nav>

          <div className="landing-nav-actions">
            <span className="landing-status-pill">
              <span className="landing-status-dot" />
              API Online
            </span>

            {/* Standard "Sign in" button required by test suite */}
            <button
              type="button"
              className="landing-ghost-btn"
              onClick={onLogin}
            >
              Sign in
            </button>

            <button
              type="button"
              className="landing-primary-btn"
              onClick={onLogin}
            >
              Launch Workspace →
            </button>
          </div>
        </header>

        {/* Auth Error Banner if login redirect failed */}
        {(error || loginFailed) && (
          <div
            className="notice error"
            role="alert"
            style={{ margin: '16px 36px 0', borderRadius: '10px' }}
          >
            {error?.message
              ? `Sign-in error: ${error.message}`
              : 'Sign-in could not be completed. Please try again.'}
          </div>
        )}

        {/* Hero Section */}
        <section className="landing-hero">
          <div className="landing-badge">
            <span>✨ EVIDENCE-FIRST FINANCIAL RESEARCH WORKSPACE</span>
          </div>

          <h1 className="landing-hero-title">
            Elevate Your Financial Research
          </h1>

          <p className="landing-hero-desc">
            Turn complex SEC filings, annual reports, and earnings PDFs into
            verified, reviewable intelligence in seconds. Zero hallucinations.
            100% citation-grounded.
          </p>

          <button
            type="button"
            className="landing-hero-cta"
            onClick={onLogin}
          >
            Sign Up &amp; Analyze →
          </button>
        </section>

        {/* Liquid 3D Wave Visual Centerpiece with Floating Glass Cards */}
        <div className="landing-visual-wrap">
          <div className="liquid-orb-bg" />
          <div className="liquid-wave-mesh" />

          {/* Floating Card Left: Revenue Extraction */}
          <div className="floating-glass-card card-left">
            <div className="glass-card-header">
              <span className="glass-card-tag">Extracted Metric</span>
              <span className="glass-card-icon">↗</span>
            </div>
            <div className="glass-card-metric">USD 94.9B</div>
            <div className="glass-card-subtext">
              <span>Total Revenue</span>
              <strong style={{ color: '#34d399' }}>+6.1% YoY</strong>
            </div>
            <small
              style={{
                display: 'block',
                marginTop: '6px',
                fontSize: '0.65rem',
                color: '#94a3b8',
              }}
            >
              Verified in 10-K disclosures (p. 42)
            </small>
          </div>

          {/* Floating Card Right: Risk Audit */}
          <div className="floating-glass-card card-right">
            <div className="glass-card-header">
              <span className="glass-card-tag">Risk Observability</span>
              <span className="glass-card-icon">⚡</span>
            </div>
            <div className="glass-card-metric">98.4%</div>
            <div className="glass-card-subtext">
              <span>Audit Confidence</span>
              <span style={{ color: '#75d2a5' }}>Rule R-001</span>
            </div>
            <div className="glass-progress-bar">
              <div
                className="glass-progress-fill"
                style={{ width: '98.4%' }}
              />
            </div>
          </div>

          {/* Floating Card Bottom Center: Hybrid Engine */}
          <div className="floating-glass-card card-bottom-center">
            <div className="glass-card-header">
              <span className="glass-card-tag">Hybrid Engine</span>
              <span
                style={{
                  fontSize: '0.65rem',
                  color: '#34d399',
                  fontWeight: 700,
                }}
              >
                ● ACTIVE
              </span>
            </div>
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '2px',
              }}
            >
              Gemini 1.5 Flash + Offline Fallback
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Deterministic lexical extraction when offline
            </div>
          </div>
        </div>

        {/* Feature Grid Section */}
        <section className="landing-features-section" id="features">
          <div className="landing-section-intro">
            <p
              style={{
                fontSize: '0.75rem',
                color: '#75d2a5',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              Institutional-Grade Intelligence
            </p>
            <h2>Built for Serious Financial Review</h2>
            <p>
              Traditional LLMs invent numbers. FinSight AI enforces strict
              lexical anchoring, deterministic risk calculations, and complete
              citation auditability.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-badge">🎯</div>
              <h3>Zero-Hallucination Facts</h3>
              <p>
                Metrics are extracted with exact numeric verification, unit
                parsing, and reporting period normalization directly from PDF
                text.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-badge">🤖</div>
              <h3>Research Q&amp;A Agent</h3>
              <p>
                Ask natural financial questions. Responses are grounded in
                document paragraphs with exact page-level evidence citations.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-badge">📊</div>
              <h3>Dual-Report Comparison</h3>
              <p>
                Compare two financial quarters or fiscal years. Automatically
                computes period-over-period differences with visual benchmark
                bars.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-badge">🔒</div>
              <h3>Enterprise Security</h3>
              <p>
                Serverless Neon PostgreSQL with per-tenant isolation, Auth0
                RS256 JWT validation, and zero cross-account data exposure.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Workspace Mockup Preview */}
        <section className="interactive-preview-section" id="research">
          <div className="landing-section-intro" style={{ marginBottom: '28px' }}>
            <p
              style={{
                fontSize: '0.75rem',
                color: '#34d399',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Interactive Experience
            </p>
            <h2>Preview the Research Workspace</h2>
          </div>

          <div className="preview-browser-frame">
            <div className="browser-header-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
              <span className="browser-url-pill">
                https://finsight-ai.app/workspace/AAPL-2024-Q3.pdf
              </span>
            </div>

            <div style={{ padding: '16px 24px 0', display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className={`prompt-chip ${activeTab === 'qa' ? 'active' : ''}`}
                onClick={() => setActiveTab('qa')}
              >
                Q&amp;A Research Agent
              </button>
              <button
                type="button"
                className={`prompt-chip ${activeTab === 'financials' ? 'active' : ''}`}
                onClick={() => setActiveTab('financials')}
              >
                Financial Statements
              </button>
              <button
                type="button"
                className={`prompt-chip ${activeTab === 'comparison' ? 'active' : ''}`}
                onClick={() => setActiveTab('comparison')}
              >
                Comparative Benchmarks
              </button>
            </div>

            <div className="browser-content">
              {activeTab === 'qa' && (
                <>
                  <div className="mockup-main">
                    <span className="mockup-badge">Evidence Verified</span>
                    <h4 className="mockup-question">
                      What was the total revenue and operating profit margin for
                      the period?
                    </h4>
                    <p className="mockup-answer">
                      Total net sales reached USD 94,930 million for the quarter
                      ended September 28, 2024, representing a 6.1% increase
                      from USD 89,498 million in the prior year quarter. Operating
                      income was reported at USD 29,591 million, yielding an
                      operating margin of 31.2%.
                    </p>
                    <div className="mockup-citation">
                      "Total net sales for the three months ended September 28,
                      2024 increased by $5,432 million or 6% compared to the
                      three months ended September 30, 2023..." [Item 1,
                      Condensed Financial Statements, p. 28]
                    </div>
                  </div>

                  <div className="mockup-side">
                    <div className="mockup-metric-card">
                      <div className="mockup-metric-name">Revenue</div>
                      <div className="mockup-metric-val">USD 94.93 B</div>
                    </div>
                    <div className="mockup-metric-card">
                      <div className="mockup-metric-name">Operating Income</div>
                      <div className="mockup-metric-val">USD 29.59 B</div>
                    </div>
                    <div className="mockup-metric-card">
                      <div className="mockup-metric-name">Net Income</div>
                      <div className="mockup-metric-val">USD 14.74 B</div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'financials' && (
                <div className="mockup-main" style={{ gridColumn: '1 / -1' }}>
                  <span className="mockup-badge">Income Statement Disclosures</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginTop: '14px' }}>
                    <div className="mockup-metric-card">
                      <div className="mockup-metric-name">Total Revenue</div>
                      <div className="mockup-metric-val">USD 94,930 M</div>
                      <small style={{ color: '#94a3b8' }}>Period: 2024 Q3</small>
                    </div>
                    <div className="mockup-metric-card">
                      <div className="mockup-metric-name">Operating Profit</div>
                      <div className="mockup-metric-val">USD 29,591 M</div>
                      <small style={{ color: '#94a3b8' }}>Margin: 31.2%</small>
                    </div>
                    <div className="mockup-metric-card">
                      <div className="mockup-metric-name">Cash &amp; Equivalents</div>
                      <div className="mockup-metric-val">USD 29,942 M</div>
                      <small style={{ color: '#94a3b8' }}>Liquid Assets</small>
                    </div>
                    <div className="mockup-metric-card">
                      <div className="mockup-metric-name">Total Debt</div>
                      <div className="mockup-metric-val">USD 106,629 M</div>
                      <small style={{ color: '#94a3b8' }}>Term Debt + Paper</small>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'comparison' && (
                <div className="mockup-main" style={{ gridColumn: '1 / -1' }}>
                  <span className="mockup-badge">Two-Document Comparison</span>
                  <h4 className="mockup-question" style={{ marginTop: '10px' }}>
                    Q3 2024 vs Q3 2023 Variance Analysis
                  </h4>
                  <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                      <span>Revenue</span>
                      <strong>$89.5B ➔ $94.9B (<span style={{ color: '#34d399' }}>+6.1%</span>)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                      <span>Operating Income</span>
                      <strong>$26.9B ➔ $29.6B (<span style={{ color: '#34d399' }}>+9.7%</span>)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                      <span>Earnings Per Share</span>
                      <strong>$1.46 ➔ $1.64 (<span style={{ color: '#34d399' }}>+12.3%</span>)</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Numbers Strip */}
        <div className="landing-metrics-strip">
          <div className="strip-item">
            <strong>100%</strong>
            <span>Grounded Evidence</span>
          </div>
          <div className="strip-item">
            <strong>0%</strong>
            <span>Hallucinated Facts</span>
          </div>
          <div className="strip-item">
            <strong>&lt; 250ms</strong>
            <span>Metric Parsing</span>
          </div>
          <div className="strip-item">
            <strong>Hybrid</strong>
            <span>Gemini + Offline Engine</span>
          </div>
        </div>

        {/* Final Call to Action */}
        <section className="landing-final-cta">
          <h2>Ready to transform financial research?</h2>
          <p>
            Upload your first financial statement PDF and experience zero-hallucination, reviewable intelligence today.
          </p>
          <button
            type="button"
            className="landing-primary-btn"
            style={{ fontSize: '1rem', padding: '14px 34px' }}
            onClick={onLogin}
          >
            Launch Free Workspace →
          </button>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div>
            © {CURRENT_YEAR} FinSight AI. Built for evidence-first financial research.
          </div>
          <div className="landing-footer-links">
            <a
              href="https://github.com/Rajankumar7626/FInAI"
              target="_blank"
              rel="noreferrer"
            >
              GitHub Repository
            </a>
            <a href="#features">Architecture</a>
            <a
              href="https://finsight-ai-api-6kc7.onrender.com/health"
              target="_blank"
              rel="noreferrer"
            >
              API Status
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
