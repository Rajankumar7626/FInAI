export type View =
  | 'dashboard'
  | 'documents'
  | 'financials'
  | 'research'
  | 'risk'
  | 'comparison'
  | 'reports'
  | 'history'
  | 'settings'

export type RequestState = 'idle' | 'loading' | 'success' | 'error'

export interface NavItem {
  id: View
  label: string
  short: string
}

export const navigation: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', short: 'DB' },
  { id: 'documents', label: 'Documents', short: 'DOC' },
  { id: 'financials', label: 'Financials', short: 'FIN' },
  { id: 'research', label: 'Research Q&A', short: 'Q&A' },
  { id: 'risk', label: 'Risk analysis', short: 'RISK' },
  { id: 'comparison', label: 'Comparison', short: 'CMP' },
  { id: 'reports', label: 'Reports', short: 'RPT' },
  { id: 'history', label: 'Report History', short: 'HST' },
  { id: 'settings', label: 'Settings', short: 'CFG' },
]
