import { isAuthError, isAuthRetryableFetchError, isAuthSessionMissingError } from '@supabase/supabase-js'

/* Turns Supabase's login errors into clear Spanish for the screens.
   Supabase gives each error a fixed `code` (like "invalid_credentials");
   the list is in node_modules/@supabase/auth-js/dist/module/lib/error-codes.d.ts. */

const LINK_EXPIRED = 'Este enlace ha caducado o ya se usó. Pide uno nuevo.'
const SESSION_ENDED = 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
const TOO_MANY = 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
const NO_CONNECTION = 'No se pudo conectar con el servidor. Revisa tu conexión a internet y vuelve a intentarlo.'

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'El correo o la contraseña no son correctos.',
  email_not_confirmed: 'Tu cuenta todavía no está activada. Abre el enlace de invitación que te enviamos por correo.',
  user_banned: 'Esta cuenta está bloqueada. Escríbenos si crees que es un error.',
  email_address_invalid: 'Revisa la dirección de correo.',
  validation_failed: 'Revisa los datos e inténtalo de nuevo.',

  otp_expired: LINK_EXPIRED,
  flow_state_expired: LINK_EXPIRED,
  flow_state_not_found: LINK_EXPIRED,
  invite_not_found: LINK_EXPIRED,

  same_password: 'La nueva contraseña tiene que ser distinta de la anterior.',
  weak_password: 'La contraseña es demasiado débil. Usa al menos 8 caracteres.',
  reauthentication_needed: 'Por seguridad, pide un enlace nuevo para cambiar tu contraseña.',

  over_request_rate_limit: TOO_MANY,
  over_email_send_rate_limit: TOO_MANY,

  session_not_found: SESSION_ENDED,
  session_expired: SESSION_ENDED,
  refresh_token_not_found: SESSION_ENDED,
  refresh_token_already_used: SESSION_ENDED,

  request_timeout: NO_CONNECTION,
}

export function authErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return NO_CONNECTION
  if (isAuthSessionMissingError(error)) return SESSION_ENDED
  if (isAuthError(error)) {
    if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]
    if (error.status === 0) return NO_CONNECTION
    if (error.status === 429) return TOO_MANY
  }
  // fetch() itself failing (no internet) shows up as a TypeError
  if (error instanceof TypeError) return NO_CONNECTION
  return 'Algo salió mal. Inténtalo de nuevo en unos minutos.'
}

export const MISSING_CONFIG =
  'Falta la configuración del servidor, así que no se puede iniciar sesión por ahora.'
