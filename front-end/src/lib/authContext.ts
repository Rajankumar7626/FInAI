import { createContext, useContext } from 'react'
import type { AuthSession } from './session'

export const AuthSessionContext = createContext<AuthSession | null>(null)

export function useAuthSession(): AuthSession {
  const session = useContext(AuthSessionContext)
  if (!session) throw new Error('Authentication provider is missing.')
  return session
}
