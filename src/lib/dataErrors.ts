/* Turns database request errors into clear Spanish for the pages
   (like authErrors.ts does for the login screens).

   Supabase's database errors carry a `code`: either Postgres's own
   five-character code ("42501" = not allowed) or a PostgREST code
   ("PGRST301" = the login token is no longer valid). When the internet
   connection fails, there is no code and the message starts with the name of
   the browser's error ("TypeError: Failed to fetch"). */

export const NO_CONNECTION =
  'No se pudo conectar con el servidor. Revisa tu conexión a internet y vuelve a intentarlo.'

/** Postgres "insufficient_privilege": the database refused the change */
export const NOT_ALLOWED = '42501'

interface DbError {
  code?: string
  message?: string
}

export function dataErrorMessage(error: unknown): string {
  if (error instanceof TypeError) return NO_CONNECTION
  const e = (error ?? {}) as DbError
  if (!e.code && /^(TypeError|FetchError|AbortError)\b/.test(e.message ?? '')) return NO_CONNECTION
  if (e.code === 'PGRST301' || e.code === 'PGRST303') {
    return 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
  }
  return 'Algo salió mal. Inténtalo de nuevo en unos minutos.'
}
