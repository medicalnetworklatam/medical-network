/* Tests for automatic links in Comunidad and the state chat
   (src/lib/linkParts.ts, used by src/lib/linkify.tsx).

   Run with:  npm test
   It needs no database and no internet. It ends with
   "ALL LINK TESTS PASSED", or lists what failed.

   Each case gives a text and what should come out: plain parts as
   strings, links as ['link', text], plus the address the link opens when
   the browser's parser tidies it (a "/" added after a bare host).
   bare('kammer.de') is a link to "https://" + the address.

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

/** An address without http(s)://: the text as written, the link to
    "https://" + the address */
function bare(address: string): Want {
  return ['link', address, new URL('https://' + address).href]
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
check('a space ends the address', 'https://a b.com', [['link', 'https://a'], ' ', bare('b.com')])
check('HTML stays text', '<a href="https://a.com">x</a>', ['<a href="', ['link', 'https://a.com'], '">x</a>'])

/* ===========================================================================
   Addresses starting with "www."
   =========================================================================== */

check('www. address', 'www.medicalnetworklatam.com', [bare('www.medicalnetworklatam.com')])
check('www. href', 'www.example.com', [['link', 'www.example.com', 'https://www.example.com/']])
check('www. with any ending', 'www.example.io', [bare('www.example.io')])
check('www. with a path', 'Mira www.kammer.de/approbation?x=1#a.', ['Mira ', bare('www.kammer.de/approbation?x=1#a'), '.'])
check('www. in capitals keeps its text', 'WWW.Example.Com', [['link', 'WWW.Example.Com', 'https://www.example.com/']])
check('www. in brackets', '(www.example.com)', ['(', bare('www.example.com'), ')'])
check('www. alone, no dot after', 'www.ejemplo', ['www.ejemplo'])
check('www. glued to a word', 'xwww.a.io', ['xwww.a.io'])

/* ===========================================================================
   Bare domains with an ending from the list
   =========================================================================== */

for (const ending of ['com', 'org', 'net', 'info', 'eu', 'de', 'at', 'ch', 'es', 'ec', 'pe', 'co',
  'mx', 'ar', 'cl', 'bo', 've', 'uy', 'py', 'gob', 'gov', 'edu']) {
  check('ending .' + ending, 'ejemplo.' + ending, [bare('ejemplo.' + ending)])
}
check('bare domain href', 'kammer.de', [['link', 'kammer.de', 'https://kammer.de/']])
check('three parts', 'ministerio.gob.ec', [bare('ministerio.gob.ec')])
check('four parts', 'a.b.example.com', [bare('a.b.example.com')])
check('with a path and query', 'example.com/ruta?x=1', [bare('example.com/ruta?x=1')])
check('with a port', 'example.com:8443/x', [bare('example.com:8443/x')])
check('a hyphen inside', 'Ver bundes-aerztekammer.de hoy', ['Ver ', bare('bundes-aerztekammer.de'), ' hoy'])
check('accented host', 'münchen.de', [['link', 'münchen.de', 'https://xn--mnchen-3ya.de/']])
check('full stop after', 'Escribe en kammer.de.', ['Escribe en ', bare('kammer.de'), '.'])
check('question mark after', '¿Conoces kammer.de?', ['¿Conoces ', bare('kammer.de'), '?'])
check('comma after a path', 'example.com/ruta, luego', [bare('example.com/ruta'), ', luego'])
check('colon after', 'Web: kammer.de: ahí', ['Web: ', bare('kammer.de'), ': ahí'])
check('in brackets with a full stop', '(ver kammer.de).', ['(ver ', bare('kammer.de'), ').'])
check('its own brackets stay', 'es.wikipedia.org/wiki/A_(b)', [bare('es.wikipedia.org/wiki/A_(b)')])
check('Spanish quotes', '«kammer.de»', ['«', bare('kammer.de'), '»'])
check('after a line break', 'Hola\nkammer.de', ['Hola\n', bare('kammer.de')])
check('next to an http one', 'kammer.de y https://a.com', [bare('kammer.de'), ' y ', ['link', 'https://a.com']])
check('with http:// stays as written', 'http://kammer.de', [['link', 'http://kammer.de', 'http://kammer.de/']])

/* ===========================================================================
   Words with dots that stay plain text
   =========================================================================== */

check('p.ej.', 'p.ej. esto', ['p.ej. esto'])
check('Dr.Med', 'Dr.Med García', ['Dr.Med García'])
check('Node.js', 'Uso Node.js', ['Uso Node.js'])
check('informe.final', 'informe.final', ['informe.final'])
check('3.5', 'nota 3.5', ['nota 3.5'])
check('version numbers', 'v1.2.3', ['v1.2.3'])
check('EE.UU.', 'EE.UU. y S.A.', ['EE.UU. y S.A.'])
check('ending not on the list', 'ejemplo.museum ejemplo.io', ['ejemplo.museum ejemplo.io'])
check('ending in capitals (a missing space)', 'en Alemania.De hecho', ['en Alemania.De hecho'])
check('domain in capitals', 'EJEMPLO.COM', ['EJEMPLO.COM'])
check('longer ending', 'example.comercial', ['example.comercial'])
check('glued after the ending', 'example.com-x example.com_x', ['example.com-x example.com_x'])
check('after a slash', 'ruta/example.com', ['ruta/example.com'])
check('a domain whose first part is a word', 'fin.example.com', [bare('fin.example.com')])
check('after a comma, no space', 'hola,kammer.de', ['hola,kammer.de'])
check('ftp:// with a bare domain inside', 'ftp://a.com/file', ['ftp://a.com/file'])

/* ===========================================================================
   Emails are never links
   =========================================================================== */

check('an email', 'name@example.com', ['name@example.com'])
check('an email with dots before @', 'maria.es@gmail.com', ['maria.es@gmail.com'])
check('an email at the end of a sentence', 'Escribe a info@kammer.de.', ['Escribe a info@kammer.de.'])
check('an email with www.', 'hola@www.example.com', ['hola@www.example.com'])
check('mailto: with a domain', 'mailto:hola@ministerio.gob.ec', ['mailto:hola@ministerio.gob.ec'])
check('an email next to a link', 'info@kammer.de o kammer.de', ['info@kammer.de o ', bare('kammer.de')])

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
check('bare: @ in the path is fine', 'example.com/@usuario', [bare('example.com/@usuario')])
check('bare: name before the host', 'medicalnetworklatam.com@other.com', ['medicalnetworklatam.com@other.com'])
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
