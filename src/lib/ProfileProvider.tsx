import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase.ts'
import { useAuth } from './auth.ts'
import { dataErrorMessage } from './dataErrors.ts'
import { PROFILE_COLUMNS, ProfileContext, type Profile, type ProfileState } from './profile.ts'

/* What the last request found, and for which user. Results are only shown
   while that same user is logged in: after "Cerrar sesión", or when someone
   else logs in, the old profile is never shown again, not even for a moment. */
interface Loaded {
  userId: string
  status: 'ready' | 'missing' | 'error'
  profile: Profile | null
  error: string
}

/** Loads the logged-in user's own profile once and shares it with every page.
    Must sit inside AuthProvider. Uses the same publishable-key connection as
    the logins; the database's RLS only lets a client read their own row. */
export default function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  // Renewing the login gives a new session object, but the same user ID:
  // only a different user (or logging out) loads again.
  const userId = session?.user.id ?? null
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // Counts requests, so an older answer arriving late can't replace a newer one
  const requestNo = useRef(0)

  const load = useCallback(async (id: string): Promise<boolean> => {
    if (!supabase) return false
    const mine = ++requestNo.current
    let next: Loaded
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', id) // admins may read every profile: ask for our own only
        .maybeSingle<Profile>()
      if (error) next = { userId: id, status: 'error', profile: null, error: dataErrorMessage(error) }
      else if (!data) next = { userId: id, status: 'missing', profile: null, error: '' }
      else next = { userId: id, status: 'ready', profile: data, error: '' }
    } catch (err) {
      next = { userId: id, status: 'error', profile: null, error: dataErrorMessage(err) }
    }
    if (mine === requestNo.current) {
      // A failed reload keeps the profile we already have
      setLoaded((prev) =>
        next.status === 'error' && prev?.userId === id && prev.status === 'ready' ? prev : next,
      )
    }
    return next.status === 'ready'
  }, [])

  // Logged out, or someone else logged in: forget the previous person's
  // profile right away (React's "adjust state while rendering" pattern)
  const [shownFor, setShownFor] = useState(userId)
  if (shownFor !== userId) {
    setShownFor(userId)
    setLoaded(null)
  }

  useEffect(() => {
    if (userId) void load(userId)
    else requestNo.current++ // ignore any answer still on its way
  }, [userId, load])

  const value = useMemo<ProfileState>(() => {
    const reload = () => (userId ? load(userId) : Promise.resolve(false))
    const replace = (profile: Profile) => {
      if (!userId) return
      requestNo.current++
      setLoaded({ userId, status: 'ready', profile, error: '' })
    }
    if (!userId || !supabase) return { status: 'none', profile: null, error: '', reload, replace }
    // Nothing loaded yet for THIS user (the previous person's data is never used)
    if (!loaded || loaded.userId !== userId) {
      return { status: 'loading', profile: null, error: '', reload, replace }
    }
    return { status: loaded.status, profile: loaded.profile, error: loaded.error, reload, replace }
  }, [userId, loaded, load])

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
