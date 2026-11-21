/* Tests for the checklist placeholders (src/lib/placeholders.ts): {pais},
   {nombre}, {perfil} and the neutral rule for {genero:x|y}.

   Run with:  npm test
   It needs no database and no internet. Every text below is made up here.
   It ends with "ALL PLACEHOLDER TESTS PASSED", or lists what failed.

   Node.js 22 runs this TypeScript file directly. */

import { fillPlaceholders, neutralGender } from '../src/lib/placeholders.ts'

let passed = 0
const failures: string[] = []

function check(name: string, got: unknown, want: unknown): void {
  const [a, e] = [JSON.stringify(got), JSON.stringify(want)]
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    got      ${a}`)
}

/* ---------- {pais} ---------- */
check('{pais} with a country',
  fillPlaceholders('Pide el certificado en {pais}.', { pais: 'Perú' }),
  'Pide el certificado en Perú.')
check('{pais} without a country: "tu país"',
  fillPlaceholders('Pide el certificado en {pais}.', { pais: null }),
  'Pide el certificado en tu país.')
check('{pais} with only spaces: "tu país"',
  fillPlaceholders('Habilitación en {pais}', { pais: '   ' }),
  'Habilitación en tu país')
check('{pais} with no values at all: "tu país"',
  fillPlaceholders('Vives en {pais}.'),
  'Vives en tu país.')
check('{pais} twice',
  fillPlaceholders('De {pais} a Alemania, y de vuelta a {pais}.', { pais: 'Chile' }),
  'De Chile a Alemania, y de vuelta a Chile.')

/* ---------- {genero:x|y}: the neutral rule ---------- */
check('médico|médica → médico/a', neutralGender('médico', 'médica'), 'médico/a')
check('habilitado|habilitada → habilitado/a', neutralGender('habilitado', 'habilitada'), 'habilitado/a')
check('listo|lista → listo/a', neutralGender('listo', 'lista'), 'listo/a')
check('Médico|Médica → Médico/a', neutralGender('Médico', 'Médica'), 'Médico/a')
check('Arzt|Ärztin → Arzt/Ärztin', neutralGender('Arzt', 'Ärztin'), 'Arzt/Ärztin')
check('the same word twice stays one word', neutralGender('colega', 'colega'), 'colega')
check('different stems are shown in full', neutralGender('el', 'la'), 'el/la')
check('in a text: médico/a',
  fillPlaceholders('Como {genero:médico|médica} con título de fuera.'),
  'Como médico/a con título de fuera.')
check('in a text: habilitado/a',
  fillPlaceholders('Ya estás {genero:habilitado|habilitada} para ejercer.'),
  'Ya estás habilitado/a para ejercer.')
check('in a text: listo/a',
  fillPlaceholders('Cuando estés {genero:listo|lista}, manda el sobre.'),
  'Cuando estés listo/a, manda el sobre.')
check('in a text: Médico/a at the start',
  fillPlaceholders('{genero:Médico|Médica} · título de prueba'),
  'Médico/a · título de prueba')
check('in a text: Arzt/Ärztin',
  fillPlaceholders('Approbation als {genero:Arzt|Ärztin}.'),
  'Approbation als Arzt/Ärztin.')

/* ---------- {nombre} and {perfil} ---------- */
check('{nombre}: first name + last names',
  fillPlaceholders('Expediente de {nombre}', { nombre: 'Lucía Fernanda Rojas Vega' }),
  'Expediente de Lucía Fernanda Rojas Vega')
check('{perfil} filled: the line and its " · " stay',
  fillPlaceholders('{perfil} · Los papeles que pide la autoridad.', { perfil: 'Médica · Título de Bolivia (2019)' }),
  'Médica · Título de Bolivia (2019) · Los papeles que pide la autoridad.')
check('{perfil} empty: the " · " after it goes too',
  fillPlaceholders('{perfil} · Los papeles que pide la autoridad.', { perfil: '' }),
  'Los papeles que pide la autoridad.')
check('{perfil} missing (null): the " · " after it goes too',
  fillPlaceholders('{perfil} · Los papeles que pide la autoridad.', { perfil: null }),
  'Los papeles que pide la autoridad.')
check('{perfil} only spaces counts as empty',
  fillPlaceholders('{perfil} · Texto.', { perfil: '  ' }),
  'Texto.')
check('{perfil} empty with nothing after it',
  fillPlaceholders('Encabezado: {perfil}', { perfil: null }),
  'Encabezado: ')
check('{perfil} with other placeholders',
  fillPlaceholders('{perfil} · Para {genero:médico|médica} de {pais}.', { perfil: 'Vive en Quito', pais: 'Ecuador' }),
  'Vive en Quito · Para médico/a de Ecuador.')

/* ---------- Text without placeholders ---------- */
check('no placeholders: unchanged',
  fillPlaceholders('Copia simple del pasaporte. NO sirve un visado.', { pais: 'Perú', nombre: 'Ana', perfil: 'x' }),
  'Copia simple del pasaporte. NO sirve un visado.')
check('empty text stays empty', fillPlaceholders('', { pais: 'Perú' }), '')
check('unknown placeholders are left as written',
  fillPlaceholders('Texto {otro} y {genero:solo}.', { pais: 'Perú' }),
  'Texto {otro} y {genero:solo}.')
check('HTML-looking text stays plain text',
  fillPlaceholders('<b>{pais}</b>', { pais: '<i>Perú</i>' }),
  '<b><i>Perú</i></b>')

/* =========================================================================== */

if (failures.length) {
  console.error(`${failures.length} FAILED, ${passed} passed\n`)
  for (const failure of failures) console.error('FAIL: ' + failure + '\n')
  process.exitCode = 1
} else {
  console.log(`ALL PLACEHOLDER TESTS PASSED (${passed} checks)`)
}
