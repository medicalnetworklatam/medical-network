/* Tests for Mi expediente's own sums (src/lib/expediente.ts): one step's
   "aplica" / "no aplica", reason and note; the milestone bar per block;
   "Ahora mismo"; the counter's trimming; and reading the template's cards.
   A tick on a "no aplica" step (template default or client layer) never
   counts (DECISIONS.md, 21 Nov 2026).

   Run with:  npm test
   It needs no database and no internet. Every row below is made up here.
   It ends with "ALL EXPEDIENTE TESTS PASSED", or lists what failed.

   Node.js 22 runs this TypeScript file directly. */

import {
  blockProgress, countChars, currentBlock, dbTrim, envelopeNote, pendingText, readBlocks, readCards, readCover, stepView,
} from '../src/lib/expediente.ts'

let passed = 0
const failures: string[] = []

function check(name: string, got: unknown, want: unknown): void {
  const [a, e] = [JSON.stringify(got), JSON.stringify(want)]
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    got      ${a}`)
}

/* ---------- One step ---------- */
const plain = { na_default: false, na_reason: null }
const naByDefault = { na_default: true, na_reason: 'Solo si cambiaste de nombre.' }

check('applies, not ticked', stepView(plain, undefined, false), { applies: true, done: false, reason: null, note: null })
check('applies, ticked', stepView(plain, undefined, true), { applies: true, done: true, reason: null, note: null })
check('template "no aplica": the template\'s reason, a tick doesn\'t count',
  stepView(naByDefault, undefined, true), { applies: false, done: false, reason: 'Solo si cambiaste de nombre.', note: null })
check('client layer "No aplica": its own reason wins, a tick doesn\'t count',
  stepView(naByDefault, { applies: false, reason: 'Ya lo entregaste en 2025.', note: null }, true),
  { applies: false, done: false, reason: 'Ya lo entregaste en 2025.', note: null })
check('client layer "No aplica" without a reason: the template\'s reason',
  stepView(naByDefault, { applies: false, reason: null, note: null }, false),
  { applies: false, done: false, reason: 'Solo si cambiaste de nombre.', note: null })
check('client layer "No aplica" on a step that applies by default',
  stepView(plain, { applies: false, reason: 'No hace falta en tu caso.', note: null }, true),
  { applies: false, done: false, reason: 'No hace falta en tu caso.', note: null })
check('client layer "Aplica" wins over the template, and the tick counts',
  stepView(naByDefault, { applies: true, reason: null, note: 'Tu nombre cambió al casarte.' }, true),
  { applies: true, done: true, reason: 'Solo si cambiaste de nombre.', note: 'Tu nombre cambió al casarte.' })
check('"Según la plantilla" (null) keeps the default',
  stepView(naByDefault, { applies: null, reason: null, note: null }, true),
  { applies: false, done: false, reason: 'Solo si cambiaste de nombre.', note: null })

/* ---------- Blocks ---------- */
const items = [
  { id: 'a', block: 1, na_default: false },
  { id: 'b', block: 1, na_default: false },
  { id: 'c', block: 1, na_default: true },   // "no aplica" by default
  { id: 'd', block: 2, na_default: false },
  { id: 'e', block: 3, na_default: false },
  { id: 'f', block: 5, na_default: false },
  { id: 'g', block: null, na_default: false }, // not from a template: in no block
]
const none = new Map<string, { applies: boolean | null }>()

check('nothing ticked', blockProgress(items, new Set(), none), [
  { block: 1, total: 2, done: 0 }, { block: 2, total: 1, done: 0 }, { block: 3, total: 1, done: 0 },
  { block: 4, total: 0, done: 0 }, { block: 5, total: 1, done: 0 },
])
check('a tick on a template "no aplica" step never counts in its block',
  blockProgress(items, new Set(['a', 'c']), none)[0], { block: 1, total: 2, done: 1 })
check('a tick on a client layer "No aplica" step never counts in its block',
  blockProgress(items, new Set(['a', 'b']), new Map([['b', { applies: false }]]))[0], { block: 1, total: 1, done: 1 })
check('client layer "Aplica" brings the step and its tick back',
  blockProgress(items, new Set(['c']), new Map([['c', { applies: true }]]))[0], { block: 1, total: 3, done: 1 })

check('"Ahora mismo": the first block with pending steps',
  currentBlock(blockProgress(items, new Set(['a', 'b']), none)), { block: 2, total: 1, done: 0 })
check('"Ahora mismo": a block with nothing that applies is skipped',
  currentBlock(blockProgress(items, new Set(['a', 'b', 'd', 'e']), none)), { block: 5, total: 1, done: 0 })
check('"Ahora mismo": block 1 is pending although only its "no aplica" step is ticked',
  currentBlock(blockProgress(items, new Set(['c', 'd']), none)), { block: 1, total: 2, done: 0 })
check('"Completo": every step that applies is done (null)',
  currentBlock(blockProgress(items, new Set(['a', 'b', 'd', 'e', 'f']), none)), null)
check('"Completo" even when a "no aplica" step is not ticked',
  currentBlock(blockProgress(items, new Set(['a', 'd', 'e', 'f']), new Map([['b', { applies: false }]]))), null)
check('pending: plural', pendingText(7), '7 pendientes')
check('pending: singular', pendingText(1), '1 pendiente')

/* ---------- The counter (same rule as the database) ---------- */
check('trims spaces, tabs and line breaks at both ends', dbTrim(' \t\r\nHola\n mundo \n\t'), 'Hola\n mundo')
check('keeps other kinds of space (the database keeps them too)', dbTrim(' Hola '), ' Hola ')
check('only spaces is empty', dbTrim('   \n  '), '')
check('an emoji counts as one character', countChars('ok 👍'), 4)
check('accents count as one character', countChars('médico'), 6)

/* ---------- Reading the template ---------- */
check('a cover with everything', readCover({
  eyebrow: 'Marca', titulo: 'Expediente de {nombre}', subtitulo: '{perfil} · Texto.',
  barra_de_avance: { titulo: 'Mi avance', hitos: ['Uno', 'Dos', 3, 'Cuatro'] },
}), { eyebrow: 'Marca', title: 'Expediente de {nombre}', subtitle: '{perfil} · Texto.', barTitle: 'Mi avance', milestones: ['Uno', 'Dos', 'Cuatro'] })
check('a broken cover gives empty texts', readCover('nonsense'), { eyebrow: '', title: '', subtitle: '', barTitle: '', milestones: [] })
check('blocks 1 to 5 in order, a missing one empty', readBlocks([
  { bloque: 2, titulo: 'Dos', subtitulo: 's2' }, { bloque: 1, titulo: 'Uno', subtitulo: 's1' },
]).map((b) => b.title), ['Uno', 'Dos', '', '', ''])
{
  const cards = readCards({
    leyenda: 'Leyenda.',
    autoridad_y_costos: { titulo: 'Costos', filas: [{ etiqueta: 'B', valor: '2' }, { etiqueta: 'A', valor: '1' }, 'x'] },
    errores_frecuentes: { titulo: 'Errores', puntos: [{ titulo: 'Uno.', texto: 'Texto.' }, null] },
    sobre: { titulo: 'Sobre', orden: ['A · Antrag', '4 (si aplica)', 5] },
  })
  check('authority rows keep the stored order', cards.authority?.rows, [{ label: 'B', value: '2' }, { label: 'A', value: '1' }])
  check('errors: odd entries left out', cards.errors?.points, [{ title: 'Uno.', text: 'Texto.' }])
  check('envelope order kept, odd entries as empty text', cards.envelope?.order, ['A · Antrag', '4 (si aplica)', ''])
  check('missing cards are null', [cards.reform, cards.sources], [null, null])
  check('a broken cards value gives nothing', readCards(null).envelope, null)
}
check('envelope note: "puede ir después"', envelopeNote('12 (puede ir después)'), 'puede ir después')
check('envelope note: none', envelopeNote('6'), '')

/* =========================================================================== */

if (failures.length) {
  console.error(`${failures.length} FAILED, ${passed} passed\n`)
  for (const failure of failures) console.error('FAIL: ' + failure + '\n')
  process.exitCode = 1
} else {
  console.log(`ALL EXPEDIENTE TESTS PASSED (${passed} checks)`)
}
