import { createContext, useContext } from 'react'

/* The logged-in user's own profile (a row of the "profiles" table), loaded
   once after login and shared with every page (filled in by
   ProfileProvider.tsx, which sits inside AuthProvider). */

export interface Profile {
  /** Nombre(s); null or '' until the name step is done */
  first_name: string | null
  /** Apellidos */
  last_names: string | null
  /** The one Bundesland, as the map's short code ("by", "th"…), or null */
  main_state: string | null
  plan: 'free' | 'paid'
  is_admin: boolean
}

/** The columns the website asks for (never the email or anything else) */
export const PROFILE_COLUMNS = 'first_name, last_names, main_state, plan, is_admin'

export type ProfileStatus =
  | 'none'     // logged out
  | 'loading'  // first load after login
  | 'ready'    // profile is there
  | 'missing'  // logged in, but the database has no profile row
  | 'error'    // the request failed (see `error`)

export interface ProfileState {
  status: ProfileStatus
  /** Only filled in when status is 'ready' */
  profile: Profile | null
  /** Spanish message when status is 'error' */
  error: string
  /** Asks the database again. Keeps the current profile while it waits.
      Resolves to true when the profile was loaded. */
  reload: () => Promise<boolean>
  /** Stores a profile the page just got back from a save */
  replace: (profile: Profile) => void
}

export const ProfileContext = createContext<ProfileState>({
  status: 'none',
  profile: null,
  error: '',
  reload: async () => false,
  replace: () => {},
})

export function useProfile(): ProfileState {
  return useContext(ProfileContext)
}

/** True when the name step still has to be done */
export function needsName(profile: Profile): boolean {
  return !profile.first_name?.trim()
}

/** The name other members see on community posts. Same rule as the
    database (migration 2, set_community_post_author): first word of the
    first name + first letter of the last names in capitals + ".".
    "María Fernanda" + "García López" -> "María G." */
export function authorName(firstName: string, lastNames: string): string {
  const firstWord = firstName.trim().split(/\s+/)[0]
  const initial = Array.from(lastNames.trim())[0]?.toUpperCase()
  if (!firstWord) return 'Miembro'
  if (!initial) return firstWord
  return firstWord + ' ' + initial + '.'
}
