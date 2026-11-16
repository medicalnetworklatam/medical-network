/* Tests for "return to the page they wanted" after logging in
   (src/lib/safePath.ts).

   Run with:  npm test
   It needs no database and no internet. It ends with
   "ALL SAFE PATH TESTS PASSED", or lists what failed.

   safeInternalPath() must only ever give back an address on this same site,
   or null. Every crafted address below must come out as null, so nobody can
   build a login link that sends people to another website afterwards.

   Node.js 22 runs this TypeScript file directly. */

import { safeInternalPath } from '../src/lib/safePath.ts'

let passed = 0
const failures: string[] = []

function same(name: string, actual: unknown, expected: unknown): void {
  const [a, e] = [JSON.stringify(actual), JSON.stringify(expected)]
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    got      ${a}`)
}

/* ===========================================================================
   Addresses on this site: accepted
   =========================================================================== */

same('a page', safeInternalPath('/novedades'), '/novedades')
same('a page with ?query and #part', safeInternalPath('/novedades?x=1#y'), '/novedades?x=1#y')
same('a deeper page', safeInternalPath('/admin/novedades'), '/admin/novedades')
same('"/../" inside the site is tidied up', safeInternalPath('/comunidad/../novedades'), '/novedades')
same('an encoded slash stays one path', safeInternalPath('/%2Fevil.com'), '/%2Fevil.com')

/* ===========================================================================
   Crafted addresses that would leave the site: refused
   =========================================================================== */

same('//evil.com', safeInternalPath('//evil.com'), null)
same('///evil.com', safeInternalPath('///evil.com'), null)
same('/\\evil.com (backslash)', safeInternalPath('/\\evil.com'), null)
same('\\\\evil.com (two backslashes)', safeInternalPath('\\\\evil.com'), null)
same('https://evil.com', safeInternalPath('https://evil.com'), null)
same('http://evil.com', safeInternalPath('http://evil.com'), null)
same('javascript: address', safeInternalPath('javascript:alert(1)'), null)
same('evil.com without a slash', safeInternalPath('evil.com'), null)

// Addresses that only become "//evil.com" once "/./" or "/../" is tidied up
same('/.//evil.com', safeInternalPath('/.//evil.com'), null)
same('/..//evil.com', safeInternalPath('/..//evil.com'), null)
same('/././/evil.com', safeInternalPath('/././/evil.com'), null)
same('/novedades/..//evil.com', safeInternalPath('/novedades/..//evil.com'), null)
same('/%2e//evil.com (encoded dot)', safeInternalPath('/%2e//evil.com'), null)
same('/%2e%2e//evil.com (encoded dots)', safeInternalPath('/%2e%2e//evil.com'), null)
same('/%2E//evil.com (encoded dot, capital E)', safeInternalPath('/%2E//evil.com'), null)

// Spaces, tabs, line breaks and invisible control characters
same('a tab after the slash', safeInternalPath('/\t/evil.com'), null)
same('a line break after the slash', safeInternalPath('/\n/evil.com'), null)
same('a space', safeInternalPath('/ /evil.com'), null)
same('a control character', safeInternalPath('/\u0000/evil.com'), null)

/* ===========================================================================
   Other refusals
   =========================================================================== */

same('the login page (would be a loop)', safeInternalPath('/iniciar-sesion'), null)
same('the login page with a ?query', safeInternalPath('/iniciar-sesion?x=1'), null)
same('the forgot-password page', safeInternalPath('/recuperar-contrasena'), null)
same('the set-password page', safeInternalPath('/nueva-contrasena'), null)
same('empty text', safeInternalPath(''), null)
same('not text at all', safeInternalPath(undefined), null)
same('a number', safeInternalPath(42), null)

/* =========================================================================== */

if (failures.length) {
  console.error(`${failures.length} FAILED, ${passed} passed\n`)
  for (const failure of failures) console.error('FAIL: ' + failure + '\n')
  process.exitCode = 1
} else {
  console.log(`ALL SAFE PATH TESTS PASSED (${passed} checks)`)
}
