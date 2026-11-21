/* Tests for the letters in a community post's avatar (src/lib/initials.ts).

   Run with:  npm test
   It ends with "ALL INITIALS TESTS PASSED", or lists what failed.

   Node.js 22 runs this TypeScript file directly. */

import { initials } from '../src/lib/initials.ts'

let passed = 0
const failures: string[] = []

function same(name: string, actual: unknown, expected: unknown): void {
  const [a, e] = [JSON.stringify(actual), JSON.stringify(expected)]
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    got      ${a}`)
}

same('first name and initial', initials('José P.'), 'JP')
same('accents are kept', initials('Ángela Ó.'), 'ÁÓ')
same('first name only', initials('María'), 'M')
same('the database\'s "Miembro"', initials('Miembro'), 'M')
same('lowercase becomes uppercase', initials('josé p.'), 'JP')
same('extra spaces', initials('  Ana   G.  '), 'AG')
same('only the first two words', initials('Ana María G.'), 'AM')
same('a dot alone is skipped', initials('. Ana'), 'A')
same('Ñ stays Ñ', initials('ñandú R.'), 'ÑR')
same('an emoji is not a letter', initials('😀 Ana'), 'A')
same('no letters at all', initials('...'), '?')
same('empty', initials(''), '?')

if (failures.length) {
  console.error(`${failures.length} FAILED, ${passed} passed\n`)
  for (const failure of failures) console.error('FAIL: ' + failure + '\n')
  process.exitCode = 1
} else {
  console.log(`ALL INITIALS TESTS PASSED (${passed} checks)`)
}
