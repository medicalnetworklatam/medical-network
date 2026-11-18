/* Tests for automatic links in Comunidad and the state chat
   (src/lib/linkParts.ts, used by src/lib/linkify.tsx).

   Run with:  npm test
   It needs no database and no internet. It ends with
   "ALL LINK TESTS PASSED", or lists what failed.

   Each case gives a text and what should come out: plain parts as
   strings, links as ['link', text], plus the address the link opens when
   the browser's parser tidies it (a "/" added after a bare host).

   Node.js 22 runs this TypeScript file directly. */

import { linkParts } from '../src/lib/linkParts.ts'

let passed = 0
const failures: string[] = []

type Want = string | ['link', string] | ['link', string, string]

function check(name: string, text: string, want: Want[]): void {
  const got = linkParts(text).map((p): Want => (p.href ? ['link', p.text, p.href] : p.text))
  // Fill in the expected href: the same address, unless the case gives one
  const expected = want.map((w): Want =>
    typeof w === 'string' || w.length === 3 ? w : ['link', w[1], new URL(w[1]).href],
  )
  const [a, e] = [JSON.stringify(got), JSON.stringify(expected)]
  if (a === e) passed++
  else failures.push(`${name}\n    text     ${JSON.stringify(text)}\n    expected ${e}\n    got      ${a}`)
  // Joining the parts must always give back the text exactly
  const joined = linkParts(text).map((p) => p.text).join('')
  if (joined === text) passed++
  else failures.push(`${name}: the parts don't add up to the text\n    got ${JSON.stringify(joined)}`)
}

/* ===========================================================================
   Plain addresses
   =========================================================================== */

check('nothing to link', 'Hola a todos', ['Hola a todos'])
check('empty text', '', [])
check('just an address', 'https://medicalnetworklatam.com', [['link', 'https://medicalnetworklatam.com']])
check('http too', 'http://example.com/a', [['link', 'http://example.com/a']])
check('in the middle', 'Mira https://a.com/x hoy', ['Mira ', ['link', 'https://a.com/x'], ' hoy'])
check('two addresses', 'https://a.com y https://b.com', [['link', 'https://a.com'], ' y ', ['link', 'https://b.com']])
check('query string and fragment', 'Ver https://a.com/p?x=1&y=2#parte',
  ['Ver ', ['link', 'https://a.com/p?x=1&y=2#parte']])
check('upper case scheme', 'HTTPS://A.COM/Path', [['link', 'HTTPS://A.COM/Path', 'https://a.com/Path']])
check('line breaks around it', 'Hola\nhttps://a.com\nchao', ['Hola\n', ['link', 'https://a.com'], '\nchao'])
check('a port', 'https://a.com:8443/x', [['link', 'https://a.com:8443/x']])
check('accented letters in the path', 'https://de.wikipedia.org/wiki/Düsseldorf',
  [['link', 'https://de.wikipedia.org/wiki/Düsseldorf', 'https://de.wikipedia.org/wiki/D%C3%BCsseldorf']])

/* ===========================================================================
   Punctuation and brackets at the end
   =========================================================================== */

check('full stop after', 'Mira https://a.com.', ['Mira ', ['link', 'https://a.com'], '.'])
check('comma after', 'https://a.com, luego', [['link', 'https://a.com'], ', luego'])
check('question mark after', '¿Viste https://a.com/x?', ['¿Viste ', ['link', 'https://a.com/x'], '?'])
check('several marks after', 'https://a.com/x!?', [['link', 'https://a.com/x'], '!?'])
check('; and : after', 'https://a.com; https://b.com:', [['link', 'https://a.com'], '; ', ['link', 'https://b.com'], ':'])
check('query ending in ?', 'https://a.com/?q=1?', [['link', 'https://a.com/?q=1'], '?'])
check('in brackets', '(ver https://a.com/x)', ['(ver ', ['link', 'https://a.com/x'], ')'])
check('in brackets with a full stop', '(https://a.com).', ['(', ['link', 'https://a.com'], ').'])
check('its own brackets stay', 'https://es.wikipedia.org/wiki/Approbation_(Medizin)',
  [['link', 'https://es.wikipedia.org/wiki/Approbation_(Medizin)']])
check('its own brackets, then a closing one', '(https://a.com/b_(c))',
  ['(', ['link', 'https://a.com/b_(c)'], ')'])
check('square brackets', '[https://a.com]', ['[', ['link', 'https://a.com'], ']'])
check('curly brackets', '{https://a.com}', ['{', ['link', 'https://a.com'], '}'])
check('Spanish quotes', '«https://a.com»', ['«', ['link', 'https://a.com'], '»'])
check('straight quotes', '"https://a.com"', ['"', ['link', 'https://a.com'], '"'])
check('angle brackets', '<https://a.com>', ['<', ['link', 'https://a.com'], '>'])

/* ===========================================================================
   What never becomes a link
   =========================================================================== */

check('www. alone', 'www.medicalnetworklatam.com', ['www.medicalnetworklatam.com'])
check('javascript:', 'javascript:alert(1)', ['javascript:alert(1)'])
check('javascript: with //', 'javascript://a.com/%0Aalert(1)', ['javascript://a.com/%0Aalert(1)'])
check('mailto:', 'mailto:hola@a.com', ['mailto:hola@a.com'])
check('ftp:', 'ftp://a.com/file', ['ftp://a.com/file'])
check('data:', 'data:text/html,<b>x</b>', ['data:text/html,<b>x</b>'])
check('glued to a word', 'xhttps://a.com', ['xhttps://a.com'])
check('glued, then a real one', 'xhttps://a.com https://b.com', ['xhttps://a.com ', ['link', 'https://b.com']])
check('scheme with nothing after', 'https://', ['https://'])
check('scheme and a full stop', 'https://.', ['https://.'])
check('no host, only a path', 'https:///path', ['https:///path'])
check('a space ends the address', 'https://a b.com', [['link', 'https://a'], ' b.com'])
check('HTML stays text', '<a href="https://a.com">x</a>', ['<a href="', ['link', 'https://a.com'], '">x</a>'])

/* ===========================================================================
   A user name or password before the host: plain text
   (https://medicalnetworklatam.com@other.com really goes to other.com)
   =========================================================================== */

check('name before the host', 'https://medicalnetworklatam.com@other.com',
  ['https://medicalnetworklatam.com@other.com'])
check('name and password', 'https://user:pass@a.com/x', ['https://user:pass@a.com/x'])
check('only an @', 'https://@a.com', ['https://@a.com'])
check('@ with a path after', 'Entra en https://mnl.com@evil.com/login.', ['Entra en https://mnl.com@evil.com/login.'])
check('@ in the path is fine', 'https://a.com/@usuario', [['link', 'https://a.com/@usuario']])
check('@ in the query is fine', 'https://a.com/?mail=x@y.com', [['link', 'https://a.com/?mail=x@y.com']])
check('@ after a backslash stays in the path', 'https://a.com\\@b.com',
  [['link', 'https://a.com\\@b.com', 'https://a.com/@b.com']])
check('a plain one after a refused one', 'https://a@b.com y https://c.com',
  ['https://a@b.com y ', ['link', 'https://c.com']])

/* =========================================================================== */

if (failures.length) {
  console.error(`${failures.length} FAILED, ${passed} passed\n`)
  for (const failure of failures) console.error('FAIL: ' + failure + '\n')
  process.exitCode = 1
} else {
  console.log(`ALL LINK TESTS PASSED (${passed} checks)`)
}
