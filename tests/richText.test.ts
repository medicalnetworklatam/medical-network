/* Tests for the marks in the home page's texts (src/lib/richText.ts):
   **highlighted words** and *German words*.

   Run with:  npm test
   It ends with "ALL RICH TEXT TESTS PASSED", or lists what failed.

   Node.js 22 runs this TypeScript file directly. */

import { parseRich, plainRich } from '../src/lib/richText.ts'
import { home, sections } from '../src/content/home.ts'

let passed = 0
const failures: string[] = []

function same(name: string, actual: unknown, expected: unknown): void {
  const [a, e] = [JSON.stringify(actual), JSON.stringify(expected)]
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    got      ${a}`)
}

const strong = (...children: unknown[]) => ({ kind: 'strong', children })
const de = (...children: unknown[]) => ({ kind: 'de', children })

same('plain text', parseRich('Hola'), ['Hola'])
same('empty', parseRich(''), [])
same('highlighted words', parseRich('Preguntas **frecuentes**'), ['Preguntas ', strong('frecuentes')])
same('a German word', parseRich('la *Approbation* en 2017'), ['la ', de('Approbation'), ' en 2017'])
same('German inside highlighted', parseRich('con **Ruta *Approbation***, un plan'),
  ['con ', strong('Ruta ', de('Approbation')), ', un plan'])
same('German first inside highlighted', parseRich('***Approbation* hoy**'),
  [strong(de('Approbation'), ' hoy')])
same('two German words', parseRich('(*Widerrufsrecht*). la *Widerrufsbelehrung*.'),
  ['(', de('Widerrufsrecht'), '). la ', de('Widerrufsbelehrung'), '.'])
same('ends with a question mark', parseRich('¿Quién es **tu guía?**'), ['¿Quién es ', strong('tu guía?')])
same('an unclosed German mark stays visible', parseRich('5 * 3'), ['5 * 3'])
same('an unclosed highlight stays visible', parseRich('**hola'), ['**hola'])
same('plain words', plainRich('Ruta *Approbation*'), 'Ruta Approbation')

// Every text in the content file reads without a stray "*" left over
function walk(value: unknown, path: string): void {
  if (typeof value === 'string') {
    same(`no stray "*" in ${path}`, plainRich(value).includes('*'), false)
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`))
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`)
  }
}
walk(home, 'home')
walk(sections, 'sections')

if (failures.length) {
  console.error(`${failures.length} RICH TEXT TEST(S) FAILED (${passed} passed):\n`)
  for (const f of failures) console.error('  ✗ ' + f + '\n')
  process.exit(1)
}
console.log(`ALL RICH TEXT TESTS PASSED (${passed} checks)`)
