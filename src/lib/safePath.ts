/* "Return to the page they wanted" after logging in.

   Only an address on this same site is accepted: it must start with exactly
   one "/" (like "/novedades?x=1"). Full addresses ("https://..."), "//other.site"
   and "/\other.site" (some browsers read a backslash as a slash) are refused,
   so nobody can build a login link that sends people to another website
   afterwards (an "open redirect"). Anything refused gives null, and the
   caller uses its normal page instead. */

const LOGIN_PAGES = ['/iniciar-sesion', '/recuperar-contrasena', '/nueva-contrasena']

export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  // no backslashes, spaces or invisible control characters anywhere
  // eslint-disable-next-line no-control-regex
  if (/[\\\s\u0000-\u001f\u007f]/.test(value)) return null

  // Second check: the browser must agree that it stays on this site
  let url: URL
  try {
    url = new URL(value, 'https://example.invalid')
  } catch {
    return null
  }
  if (url.origin !== 'https://example.invalid') return null

  // Going "back" to a login screen would be a loop
  if (LOGIN_PAGES.includes(url.pathname)) return null

  return url.pathname + url.search + url.hash
}
