import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

/* Who is logged in, shared with every page (filled in by AuthProvider.tsx).
   A "session" is Supabase's proof that this browser is logged in; the
   library keeps it in the browser and renews it by itself. */

export interface AuthState {
  /** The login, or null when logged out */
  session: Session | null
  /** True only at the start, while the saved login is being checked */
  loading: boolean
}

export const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
