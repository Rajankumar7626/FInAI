import type { ReactNode } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { AuthSessionContext } from './authContext'

export type AuthSession = {
  isLoading: boolean
  isAuthenticated: boolean
  user?: { sub?: string; name?: string; email?: string }
  error?: Error
  loginWithRedirect: () => Promise<void>
  logout: (options?: { logoutParams?: { returnTo?: string } }) => void | Promise<void>
  getAccessTokenSilently: () => Promise<string>
}

export function AuthSessionProvider({ session, children }: { session: AuthSession; children: ReactNode }) {
  return <AuthSessionContext.Provider value={session}>{children}</AuthSessionContext.Provider>
}

export function Auth0SessionBridge({ children }: { children: ReactNode }) {
  const auth = useAuth0()
  const session: AuthSession = {
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    error: auth.error,
    loginWithRedirect: async () => { await auth.loginWithRedirect() },
    logout: (options) => auth.logout(options),
    getAccessTokenSilently: async () => {
      const token = await auth.getAccessTokenSilently()
      if (typeof token !== 'string') throw new Error('No API access token was returned.')
      return token
    },
  }

  return <AuthSessionProvider session={session}>{children}</AuthSessionProvider>
}
