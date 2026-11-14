import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase.ts'
import { AuthContext, type AuthState } from './auth.ts'

/** Listens to Supabase and tells every page who is logged in. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    loading: supabase !== null, // without the configuration there's nothing to wait for
  })

  useEffect(() => {
    if (!supabase) return
    // Fires once at the start (INITIAL_SESSION) and on every login, logout
    // and renewal, also from other tabs of the same site.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
