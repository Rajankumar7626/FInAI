import { useState, type ReactNode } from 'react'
import { AuthSessionProvider, type AuthSession } from './session'

export function TestSessionProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const session: AuthSession = {
    isLoading: false,
    isAuthenticated,
    user: isAuthenticated ? { sub: 'playwright|synthetic-user', name: 'Test User' } : undefined,
    loginWithRedirect: async () => setIsAuthenticated(true),
    logout: async () => setIsAuthenticated(false),
    getAccessTokenSilently: async () => '',
  }

  return <AuthSessionProvider session={session}>{children}</AuthSessionProvider>
}
