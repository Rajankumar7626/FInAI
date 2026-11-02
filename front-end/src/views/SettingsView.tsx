import { useEffect, useState } from 'react'
import type { SystemStatusResponse } from '../lib/api'
import { getStoredGeminiApiKey, getSystemStatus, setStoredGeminiApiKey } from '../lib/api'

export function SettingsView({
  userLabel,
  apiBaseUrl,
}: {
  userLabel: string
  apiBaseUrl: string
}) {
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredGeminiApiKey())
  const [showKey, setShowKey] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [preferredCurrency, setPreferredCurrency] = useState(() => {
    return localStorage.getItem('finsight_pref_currency') ?? 'USD'
  })

  useEffect(() => {
    let cancelled = false
    getSystemStatus()
      .then((data) => {
        if (!cancelled) setSystemStatus(data)
      })
      .catch(() => {
        if (!cancelled) setSystemStatus(null)
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleSaveKey() {
    setStoredGeminiApiKey(apiKeyInput)
    setSaveMessage('Gemini API Key successfully updated in local storage.')
    setTimeout(() => setSaveMessage(null), 3000)
  }

  function handleClearKey() {
    setApiKeyInput('')
    setStoredGeminiApiKey('')
    setSaveMessage('Custom Gemini API Key removed. FinSight AI will use default server key or offline fallback.')
    setTimeout(() => setSaveMessage(null), 3000)
  }

  function handleCurrencyChange(curr: string) {
    setPreferredCurrency(curr)
    localStorage.setItem('finsight_pref_currency', curr)
  }

  const hasKeyConfigured = Boolean(apiKeyInput.trim() || systemStatus?.gemini_configured)

  return (
    <section className="page-stack">
      <div className="page-intro">
        <div>
          <p className="section-kicker">Preferences & Diagnostics</p>
          <h2>System Settings</h2>
        </div>
        <span className="context-label">Client & Cloud Config</span>
      </div>

      {saveMessage && (
        <div className="notice success" role="status">
          {saveMessage}
        </div>
      )}

      <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Gemini AI & Offline Engine Section */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Analysis Engine</p>
              <h2>AI & Offline Engine</h2>
            </div>
            <span
              className="status-chip"
              style={{
                background: hasKeyConfigured ? '#e0f2fe' : '#f0fdf4',
                color: hasKeyConfigured ? '#0369a1' : '#15803d',
              }}
            >
              {hasKeyConfigured ? '🤖 Gemini 1.5 Flash' : '⚡ Deterministic Offline'}
            </span>
          </div>

          <p className="muted-copy" style={{ marginBottom: '16px' }}>
            FinSight AI operates in a hybrid architecture. When an API key is available, queries are synthesized via Gemini 1.5 Flash grounded strictly in document disclosures. Without a key or when offline, deterministic lexical & metric extraction runs seamlessly.
          </p>

          <label style={{ display: 'block', marginBottom: '12px' }}>
            <span style={{ display: 'block', fontSize: '.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Custom Gemini API Key (Optional)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '.85rem',
                }}
              />
              <button
                type="button"
                className="secondary-button"
                style={{ padding: '8px 12px' }}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <small style={{ color: '#6b7280', display: 'block', marginTop: '4px' }}>
              Stored only inside your browser local storage. Never shared across accounts.
            </small>
          </label>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="primary-button" onClick={handleSaveKey}>
              Save Key
            </button>
            {apiKeyInput && (
              <button type="button" className="secondary-button" onClick={handleClearKey}>
                Remove Custom Key
              </button>
            )}
          </div>
        </section>

        {/* Infrastructure & Connectivity Section */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Cloud Infrastructure</p>
              <h2>Environment & Services</h2>
            </div>
            <span className="status-chip">
              {statusLoading ? 'Checking...' : systemStatus ? 'Active' : 'Offline'}
            </span>
          </div>

          <div className="detail-facts" style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <span>Authenticated User</span>
              <strong style={{ fontSize: '.85rem' }}>{userLabel}</strong>
            </div>
            <div>
              <span>API Gateway</span>
              <strong style={{ fontSize: '.85rem' }}>{apiBaseUrl ? new URL(apiBaseUrl).hostname : '127.0.0.1'}</strong>
            </div>
            <div>
              <span>Database Engine</span>
              <strong style={{ fontSize: '.85rem' }}>Neon PostgreSQL</strong>
            </div>
            <div>
              <span>Server Model</span>
              <strong style={{ fontSize: '.85rem' }}>{systemStatus?.gemini_model ?? 'gemini-1.5-flash'}</strong>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
            <span style={{ display: 'block', fontSize: '.8rem', fontWeight: 600, marginBottom: '6px' }}>
              Preferred Display Currency
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['USD', 'EUR', 'GBP', 'INR'].map((curr) => (
                <button
                  type="button"
                  key={curr}
                  className={`prompt-chip ${preferredCurrency === curr ? 'active' : ''}`}
                  style={{
                    fontWeight: preferredCurrency === curr ? 700 : 500,
                    borderColor: preferredCurrency === curr ? '#00875a' : undefined,
                    background: preferredCurrency === curr ? '#e8f5e9' : undefined,
                  }}
                  onClick={() => handleCurrencyChange(curr)}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
