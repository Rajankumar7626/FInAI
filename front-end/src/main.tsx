import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.tsx'
import { Auth0SessionBridge } from './lib/session'
import { TestSessionProvider } from './lib/e2eSession'

const root = createRoot(document.getElementById('root')!)
const domain = (import.meta.env.VITE_AUTH0_DOMAIN ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '')
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID ?? ''
const audience = import.meta.env.VITE_AUTH0_AUDIENCE ?? ''

root.render(
  <StrictMode>
    {import.meta.env.MODE === 'e2e' ? (
      <TestSessionProvider><App /></TestSessionProvider>
    ) : domain && clientId && audience ? (
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        cacheLocation="memory"
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience,
          scope: 'openid profile email',
        }}
      >
        <Auth0SessionBridge><App /></Auth0SessionBridge>
      </Auth0Provider>
    ) : (
      <main className="auth-screen">
        <section className="auth-card">
          <p className="section-kicker">FinSight AI</p>
          <h1>Authentication setup required</h1>
          <p>Configure VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE to sign in.</p>
        </section>
      </main>
    )}
  </StrictMode>,
)
