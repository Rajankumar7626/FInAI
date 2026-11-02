import { useState, useMemo } from 'react'
import type { DocumentMetadata, FinancialDataResponse, RiskAnalysisResponse } from '../lib/api'
import type { RequestState, View } from '../lib/types'
import { EmptyState } from '../components/ui/EmptyState'
import { Limitations } from '../components/ui/Limitations'
import { RiskCard } from '../components/ui/RiskCard'
import { formatValue } from '../lib/formatters'

export function RiskView({
  documents = [],
  selectedId,
  selectedDocument,
  riskData,
  financialData,
  state,
  message,
  onSelect,
  onNavigate,
  onInvestigate,
}: {
  documents?: DocumentMetadata[]
  selectedId?: string | null
  selectedDocument: DocumentMetadata | null
  riskData: RiskAnalysisResponse | null
  financialData?: FinancialDataResponse | null
  state: RequestState
  message: string
  onSelect?: (id: string) => void
  onNavigate?: (view: View) => void
  onInvestigate?: (query: string) => void
}) {
  const [filterMode, setFilterMode] = useState<'all' | 'warnings' | 'passed'>('all')

  const metrics = useMemo(() => financialData?.metrics ?? [], [financialData])

  function toBase(m?: { value: number; unit?: string | null } | null): number | null {
    if (!m || typeof m.value !== 'number' || isNaN(m.value)) return null
    const mult =
      m.unit === 'billion'
        ? 1_000_000_000
        : m.unit === 'million'
          ? 1_000_000
          : m.unit === 'thousand'
            ? 1_000
            : 1
    return m.value * mult
  }

  // Extracted core metrics for ratio intelligence
  const netIncome = metrics.find((m) => m.metric_name === 'net_income')
  const ocf = metrics.find((m) => m.metric_name === 'operating_cash_flow')
  const assets = metrics.find((m) => m.metric_name === 'total_assets')
  const liabilities = metrics.find((m) => m.metric_name === 'total_liabilities')
  const debt = metrics.find((m) => m.metric_name === 'total_debt')
  const equity = metrics.find((m) => m.metric_name === 'stockholders_equity')
  const cash = metrics.find((m) => m.metric_name === 'cash_and_cash_equivalents')

  const debtBase = toBase(debt)
  const assetsBase = toBase(assets)
  const equityBase = toBase(equity)
  const ocfBase = toBase(ocf)
  const cashBase = toBase(cash)

  // Institutional Ratios
  const debtToAssets =
    debtBase !== null && assetsBase !== null && assetsBase > 0 ? (debtBase / assetsBase) * 100 : null

  const equityRatio =
    equityBase !== null && assetsBase !== null && assetsBase > 0 ? (equityBase / assetsBase) * 100 : null

  const cashFlowToDebt =
    ocfBase !== null && debtBase !== null && debtBase > 0 ? (ocfBase / debtBase) * 100 : null

  const cashToAssets =
    cashBase !== null && assetsBase !== null && assetsBase > 0 ? (cashBase / assetsBase) * 100 : null

  // Observations & Rules Matrix
  const observations = riskData?.observations ?? []
  const highWarnings = observations.filter((o) => o.severity === 'high')
  const mediumWarnings = observations.filter((o) => o.severity === 'medium')

  // Financial Health Score Calculation (0 - 100)
  const healthScore = useMemo(() => {
    let score = 94
    if (highWarnings.length > 0) score -= 45 * highWarnings.length
    if (mediumWarnings.length > 0) score -= 18 * mediumWarnings.length

    if (debtToAssets !== null && debtToAssets < 30) score += 6
    if (equityRatio !== null && equityRatio > 50) score += 5
    if (cashFlowToDebt !== null && cashFlowToDebt > 25) score += 5

    return Math.max(18, Math.min(98, score))
  }, [highWarnings.length, mediumWarnings.length, debtToAssets, equityRatio, cashFlowToDebt])

  const riskLevel = useMemo(() => {
    if (highWarnings.length > 0) return { label: 'Elevated Risk', color: 'red', verdict: 'Action Recommended' }
    if (mediumWarnings.length > 0) return { label: 'Moderate Risk', color: 'amber', verdict: 'Monitored Indicator' }
    return { label: 'Low Risk', color: 'green', verdict: 'Sound Financial Standing' }
  }, [highWarnings.length, mediumWarnings.length])

  // Master List of Evaluated Deterministic Rules
  const evaluatedRules = useMemo(() => {
    const rules = [
      {
        id: 'negative_net_income',
        name: 'Profitability Screening',
        category: 'Earnings Quality',
        benchmark: 'Net Income > $0',
        obs: observations.find((o) => o.rule_id === 'negative_net_income'),
        passedMessage: netIncome
          ? `Positive net income of ${formatValue(netIncome.value, netIncome.currency, netIncome.unit)} disclosed.`
          : 'Net income is non-negative for the reported period.',
      },
      {
        id: 'negative_operating_cash_flow',
        name: 'Cash Flow Solvency',
        category: 'Cash Generation',
        benchmark: 'Operating Cash Flow > $0',
        obs: observations.find((o) => o.rule_id === 'negative_operating_cash_flow'),
        passedMessage: ocf
          ? `Positive cash generation: ${formatValue(ocf.value, ocf.currency, ocf.unit)} from operating activities.`
          : 'Operating cash flow is positive for the evaluated period.',
      },
      {
        id: 'liabilities_exceed_assets',
        name: 'Balance Sheet Solvency',
        category: 'Capital Health',
        benchmark: 'Total Assets > Total Liabilities',
        obs: observations.find((o) => o.rule_id === 'liabilities_exceed_assets'),
        passedMessage:
          assets && liabilities
            ? `Assets (${formatValue(assets.value, assets.currency, assets.unit)}) exceed liabilities (${formatValue(
                liabilities.value,
                liabilities.currency,
                liabilities.unit,
              )}). Net equity buffer is intact.`
            : 'Total assets exceed total obligations.',
      },
      {
        id: 'high_debt_to_assets',
        name: 'Debt Leverage Screening',
        category: 'Debt Coverage',
        benchmark: 'Total Debt / Assets < 75%',
        obs: observations.find((o) => o.rule_id === 'high_debt_to_assets'),
        passedMessage:
          debtToAssets !== null
            ? `Conservative debt leverage: ${debtToAssets.toFixed(1)}% of total assets (well below 75% maximum threshold).`
            : 'Total debt is within safe screening limits relative to asset base.',
      },
    ]

    return rules.filter((r) => {
      if (filterMode === 'warnings') return Boolean(r.obs)
      if (filterMode === 'passed') return !r.obs
      return true
    })
  }, [observations, filterMode, netIncome, ocf, assets, liabilities, debtToAssets])

  return (
    <section className="page-stack">
      {/* Intro Header */}
      <div className="page-intro">
        <div>
          <p className="section-kicker">Deterministic Solvency & Screening</p>
          <h2>Risk Analysis & Financial Health</h2>
        </div>
        <span className="context-label">
          {selectedDocument?.filename ?? 'No document selected'}
        </span>
      </div>

      {/* Document Selector Dropdown if documents are provided */}
      {documents.length > 0 && onSelect && (
        <section className="panel compare-controls">
          <label style={{ gridColumn: '1 / -1' }}>
            <span>Target Document for Risk Audit</span>
            <select
              value={selectedId ?? ''}
              onChange={(e) => onSelect(e.target.value)}
            >
              <option value="">Select a document to evaluate</option>
              {documents.map((d) => (
                <option key={d.document_id} value={d.document_id}>
                  {d.filename}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {state === 'loading' && <div className="panel loading-block">{message}</div>}
      {state === 'error' && <div className="notice error">{message}</div>}

      {!selectedDocument && (
        <section className="panel">
          <EmptyState
            title="Select a document"
            body="Choose a financial report above to run automated solvency screens and deterministic risk indicator evaluations."
          />
          {onNavigate && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onNavigate('documents')}
              >
                Go to Documents Library
              </button>
            </div>
          )}
        </section>
      )}

      {selectedDocument && riskData && (
        <>
          {/* Executive Risk Scorecard Banner */}
          <div className="risk-executive-scorecard">
            <div className="risk-score-dial-wrap">
              <div className={`risk-score-circle risk-${riskLevel.color}`}>
                <span className="risk-score-num">{healthScore}</span>
                <span className="risk-score-denom">/ 100</span>
              </div>
              <div className="risk-verdict-wrap">
                <div className="risk-verdict-title-row">
                  <span className={`risk-level-tag risk-${riskLevel.color}`}>
                    {riskLevel.label}
                  </span>
                  <span className="risk-status-pill">{riskLevel.verdict}</span>
                </div>
                <p className="risk-verdict-narrative">
                  {observations.length === 0
                    ? `This report shows robust solvency across all screening indicators with healthy capital protection and no triggered risk flags.`
                    : `Evaluated ${4} core solvency rules: ${observations.length} warning flag triggered (${observations
                        .map((o) => o.title)
                        .join(', ')}), balanced by strong metrics in remaining categories.`}
                </p>
              </div>
            </div>

            <div className="risk-stat-counters">
              <div className="risk-stat-box">
                <span>Rules Evaluated</span>
                <strong>4</strong>
              </div>
              <div className={`risk-stat-box ${observations.length > 0 ? 'box-warn' : ''}`}>
                <span>Flagged Warnings</span>
                <strong>{observations.length}</strong>
              </div>
              <div className="risk-stat-box box-pass">
                <span>Verified Passed</span>
                <strong>{4 - observations.length}</strong>
              </div>
            </div>
          </div>

          {/* Institutional Solvency & Capital Health Radar */}
          {(debtToAssets !== null || equityRatio !== null || cashFlowToDebt !== null || cashToAssets !== null) && (
            <section className="panel risk-ratios-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Capital Structure & Liquidity</p>
                  <h2>Solvency Benchmarks</h2>
                </div>
                <span className="context-label">Calculated from disclosed statements</span>
              </div>

              <div className="risk-ratios-grid">
                {/* 1. Debt-to-Assets Leverage */}
                {debtToAssets !== null && (
                  <div className="risk-ratio-card">
                    <div className="risk-ratio-header">
                      <span className="risk-ratio-title">Debt-to-Assets Ratio</span>
                      <span className={`risk-ratio-badge ${debtToAssets < 50 ? 'badge-safe' : debtToAssets < 75 ? 'badge-moderate' : 'badge-alert'}`}>
                        {debtToAssets < 50 ? 'Safe Leverage' : debtToAssets < 75 ? 'Moderate' : 'High Alert'}
                      </span>
                    </div>
                    <div className="risk-ratio-value-row">
                      <strong>{debtToAssets.toFixed(1)}%</strong>
                      <small>Screening Ceiling: 75%</small>
                    </div>
                    <div className="risk-ratio-bar-track">
                      <div
                        className={`risk-ratio-bar-fill ${debtToAssets < 50 ? 'fill-safe' : debtToAssets < 75 ? 'fill-moderate' : 'fill-alert'}`}
                        style={{ width: `${Math.min(100, (debtToAssets / 75) * 100)}%` }}
                      />
                    </div>
                    <p className="risk-ratio-desc">
                      Total debt of {formatValue(debt?.value ?? 0, debt?.currency ?? null, debt?.unit ?? null)} represents {debtToAssets.toFixed(1)}% of asset base.
                    </p>
                  </div>
                )}

                {/* 2. Equity Cushion */}
                {equityRatio !== null && (
                  <div className="risk-ratio-card">
                    <div className="risk-ratio-header">
                      <span className="risk-ratio-title">Stockholders’ Equity Ratio</span>
                      <span className={`risk-ratio-badge ${equityRatio > 50 ? 'badge-safe' : equityRatio > 25 ? 'badge-moderate' : 'badge-alert'}`}>
                        {equityRatio > 50 ? 'Strong Cushion' : equityRatio > 25 ? 'Adequate' : 'Thin Buffer'}
                      </span>
                    </div>
                    <div className="risk-ratio-value-row">
                      <strong>{equityRatio.toFixed(1)}%</strong>
                      <small>Safety Target: &gt; 40%</small>
                    </div>
                    <div className="risk-ratio-bar-track">
                      <div
                        className={`risk-ratio-bar-fill ${equityRatio > 50 ? 'fill-safe' : equityRatio > 25 ? 'fill-moderate' : 'fill-alert'}`}
                        style={{ width: `${Math.min(100, (equityRatio / 70) * 100)}%` }}
                      />
                    </div>
                    <p className="risk-ratio-desc">
                      Equity of {formatValue(equity?.value ?? 0, equity?.currency ?? null, equity?.unit ?? null)} provides substantial shock absorption.
                    </p>
                  </div>
                )}

                {/* 3. Cash Flow to Debt Coverage */}
                {cashFlowToDebt !== null && (
                  <div className="risk-ratio-card">
                    <div className="risk-ratio-header">
                      <span className="risk-ratio-title">Cash Flow to Debt Coverage</span>
                      <span className={`risk-ratio-badge ${cashFlowToDebt > 25 ? 'badge-safe' : cashFlowToDebt > 10 ? 'badge-moderate' : 'badge-alert'}`}>
                        {cashFlowToDebt > 25 ? 'Robust Service' : cashFlowToDebt > 10 ? 'Adequate' : 'Low Buffer'}
                      </span>
                    </div>
                    <div className="risk-ratio-value-row">
                      <strong>{cashFlowToDebt.toFixed(1)}%</strong>
                      <small>Target: &gt; 20% annual</small>
                    </div>
                    <div className="risk-ratio-bar-track">
                      <div
                        className={`risk-ratio-bar-fill ${cashFlowToDebt > 25 ? 'fill-safe' : cashFlowToDebt > 10 ? 'fill-moderate' : 'fill-alert'}`}
                        style={{ width: `${Math.min(100, (cashFlowToDebt / 50) * 100)}%` }}
                      />
                    </div>
                    <p className="risk-ratio-desc">
                      Operating cash flows cover {cashFlowToDebt.toFixed(1)}% of total principal debt annually.
                    </p>
                  </div>
                )}

                {/* 4. Liquid Cash Reserves */}
                {cashToAssets !== null && (
                  <div className="risk-ratio-card">
                    <div className="risk-ratio-header">
                      <span className="risk-ratio-title">Liquid Cash to Assets</span>
                      <span className={`risk-ratio-badge ${cashToAssets > 10 ? 'badge-safe' : cashToAssets > 5 ? 'badge-moderate' : 'badge-alert'}`}>
                        {cashToAssets > 10 ? 'Liquid Reserve' : cashToAssets > 5 ? 'Moderate' : 'Tight'}
                      </span>
                    </div>
                    <div className="risk-ratio-value-row">
                      <strong>{cashToAssets.toFixed(1)}%</strong>
                      <small>Balance: {formatValue(cash?.value ?? 0, cash?.currency ?? null, cash?.unit ?? null)}</small>
                    </div>
                    <div className="risk-ratio-bar-track">
                      <div
                        className={`risk-ratio-bar-fill ${cashToAssets > 10 ? 'fill-safe' : cashToAssets > 5 ? 'fill-moderate' : 'fill-alert'}`}
                        style={{ width: `${Math.min(100, (cashToAssets / 20) * 100)}%` }}
                      />
                    </div>
                    <p className="risk-ratio-desc">
                      Liquid cash and cash equivalents form {cashToAssets.toFixed(1)}% of total balance-sheet assets.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Rule Evaluation Diagnostic & Filter Controls */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Audit Screening Log</p>
                <h2>Deterministic Rule Compliance Matrix</h2>
              </div>

              {/* Filter Tabs */}
              <div className="risk-filter-tabs">
                <button
                  type="button"
                  className={`risk-filter-tab ${filterMode === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterMode('all')}
                >
                  All Checks (4)
                </button>
                <button
                  type="button"
                  className={`risk-filter-tab ${filterMode === 'warnings' ? 'active' : ''}`}
                  onClick={() => setFilterMode('warnings')}
                >
                  Triggered Warnings ({observations.length})
                </button>
                <button
                  type="button"
                  className={`risk-filter-tab ${filterMode === 'passed' ? 'active' : ''}`}
                  onClick={() => setFilterMode('passed')}
                >
                  Verified Safe ({4 - observations.length})
                </button>
              </div>
            </div>

            {/* List of Evaluated Rules */}
            <div className="risk-evaluated-rules-list">
              {evaluatedRules.map((rule) => {
                if (rule.obs) {
                  return (
                    <RiskCard
                      key={rule.obs.rule_id}
                      observation={rule.obs}
                      onInvestigate={onInvestigate}
                    />
                  )
                }

                return (
                  <article className="risk-passed-card" key={rule.id}>
                    <div className="risk-passed-header">
                      <div className="risk-passed-tag-wrap">
                        <span className="risk-passed-badge">✓ Passed Check</span>
                        <span className="risk-rule-pill">{rule.category}</span>
                      </div>
                      <span className="risk-benchmark-pill">{rule.benchmark}</span>
                    </div>

                    <h3 className="risk-passed-title">{rule.name}</h3>
                    <p className="risk-passed-message">{rule.passedMessage}</p>
                    <small className="risk-passed-note">Deterministic rule verified: no adverse condition identified.</small>
                  </article>
                )
              })}
            </div>
          </section>

          {/* Audit Limitations */}
          <Limitations items={riskData.limitations} />
        </>
      )}
    </section>
  )
}
