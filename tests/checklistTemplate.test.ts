/* Tests for the checklist template script (scripts/checklistTemplate.ts):
   the file name, the checks on the JSON, the placeholders, removing
   {nota_personal}, the envelope order, the cards that are left out, and
   the SQL it writes (safe quoting, archiving only steps with a
   source_code, never deleting).

   It uses a made-up template (tests/fixtures/sl-dentista_ue.json), never
   the owner's real one, and no client data.

   Run with:  npm test
   It needs no database, no internet and no browser. It ends with
   "ALL CHECKLIST TEMPLATE TESTS PASSED", or lists what failed.

   Node.js 22 runs this TypeScript file directly. */

import { readFileSync } from 'node:fs'
import {
  checkTemplate, cleanCards, placeholderProblems, removeNotaPersonal, sobreNumber, sqlText, targetFromFileName, toSql,
  type ImportPlan,
} from '../scripts/checklistTemplate.ts'

let passed = 0
const failures: string[] = []

function check(name: string, got: unknown, want: unknown): void {
  const [a, e] = [JSON.stringify(got), JSON.stringify(want)]
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    got      ${a}`)
}

const FILE = 'sl-dentista_ue.json'
const raw = readFileSync(new URL('./fixtures/sl-dentista_ue.json', import.meta.url), 'utf8')
/** A fresh copy of the made-up template, to change in one test */
const fresh = (): any => JSON.parse(raw)

/** The problems for a changed copy of the template */
function problemsOf(change: (t: any) => void, fileName = FILE): string[] {
  const t = fresh()
  change(t)
  return checkTemplate(t, fileName).problems
}
function hasProblem(name: string, change: (t: any) => void, part: string, fileName = FILE): void {
  const problems = problemsOf(change, fileName)
  const found = problems.some((p) => p.includes(part))
  if (found && checkTemplate((() => { const t = fresh(); change(t); return t })(), fileName).plan === null) passed++
  else failures.push(`${name}\n    expected a problem containing "${part}"\n    got      ${JSON.stringify(problems)}`)
}

/* ---------- File name ---------- */
check('file name: state and route', targetFromFileName('bw-medico_drittstaat.json'),
  { state: 'bw', route: 'medico_drittstaat', fileName: 'bw-medico_drittstaat.json' })
check('file name: all four routes', ['medico_drittstaat', 'medico_ue', 'dentista_drittstaat', 'dentista_ue']
  .map((r) => typeof targetFromFileName(`by-${r}.json`) === 'object'), [true, true, true, true])
check('file name: unknown state', typeof targetFromFileName('xx-medico_ue.json'), 'string')
check('file name: unknown route', typeof targetFromFileName('bw-kp.json'), 'string')
check('file name: wrong shape', typeof targetFromFileName('Cousins claude prompt 2.json'), 'string')
check('file name: not .json', typeof targetFromFileName('bw-medico_ue.txt'), 'string')

/* ---------- Placeholders ---------- */
check('placeholder: {pais} in a step', placeholderProblems('Vives en {pais}.', 'step'), [])
check('placeholder: {genero} anywhere', placeholderProblems('{genero:médico|médica}', 'other'), [])
check('placeholder: {nota_personal} in a step', placeholderProblems('x ({nota_personal})', 'step'), [])
check('placeholder: {nombre} and {perfil} on the cover', placeholderProblems('{nombre} · {perfil}', 'cover'), [])
check('placeholder: unknown', placeholderProblems('En {ciudad}', 'step').length, 1)
check('placeholder: {genero} with one form', placeholderProblems('{genero:médico}', 'step').length, 1)
check('placeholder: {genero} with three forms', placeholderProblems('{genero:a|b|c}', 'step').length, 1)
check('placeholder: {nombre} in a step', placeholderProblems('Hola {nombre}', 'step').length, 1)
check('placeholder: {perfil} in a card', placeholderProblems('{perfil}', 'other').length, 1)
check('placeholder: {nota_personal} in a card', placeholderProblems('({nota_personal})', 'other').length, 1)
check('placeholder: a lone brace', placeholderProblems('Precio {pais', 'step').length, 1)
check('placeholder: a closing brace', placeholderProblems('fin }', 'step').length, 1)
check('placeholder: no placeholders', placeholderProblems('Texto normal, sin nada.', 'other'), [])

/* ---------- {nota_personal} ---------- */
check('nota: inside a sentence', removeNotaPersonal('Tu universidad ({nota_personal})'), { text: 'Tu universidad' })
check('nota: before the full stop', removeNotaPersonal('Vives en BW ({nota_personal}).'), { text: 'Vives en BW.' })
check('nota: the whole text', removeNotaPersonal('{nota_personal}'), { text: null })
check('nota: the whole text with spaces', removeNotaPersonal('  {nota_personal} '), { text: null })
check('nota: none', removeNotaPersonal('Nada que quitar.'), { text: 'Nada que quitar.' })
check('nota: elsewhere is a problem', 'problem' in removeNotaPersonal('Ver {nota_personal} aquí'), true)

/* ---------- The envelope ---------- */
check('sobre: "A · Antrag"', sobreNumber('A · Antrag'), 'Antrag')
check('sobre: "4 (si aplica)"', sobreNumber('4 (si aplica)'), '4')
check('sobre: "12 (puede ir después)"', sobreNumber('12 (puede ir después)'), '12')
check('sobre: "7"', sobreNumber('7'), '7')

/* ---------- The made-up template, whole ---------- */
const { plan, problems } = checkTemplate(fresh(), FILE)
check('template: no problems', problems, [])
const p = plan as ImportPlan
const item = (code: string) => p.items.find((i) => i.sourceCode === code)!

check('template: state and route from the file name', [p.target.state, p.target.route], ['sl', 'dentista_ue'])
check('template: readable codes', p.items.map((i) => i.code),
  ['sl-dentista_ue-x1', 'sl-dentista_ue-x2', 'sl-dentista_ue-x_3', 'sl-dentista_ue-x4', 'sl-dentista_ue-x5'])
check('template: order on screen = order in pasos', p.items.map((i) => i.sortOrder), [1, 2, 3, 4, 5])
check('template: blocks', p.items.map((i) => i.block), [1, 1, 2, 3, 5])
check('template: meta kept', [p.template.title, p.template.rulesLabel, p.template.generatedOn],
  ['Plantilla de prueba · Saarland · Dentista · título de la UE', 'Reglas de prueba', '2026-01-15'])
check('template: the generator rules are not kept', JSON.stringify(p.template).includes('Regla del generador'), false)
check('template: block titles in order', p.template.blocks.map((b) => b.titulo),
  ['Bloque uno', 'Bloque dos', 'Bloque tres', 'Bloque cuatro', 'Bloque cinco'])
check('template: cover keeps {nombre} and {perfil}', (p.template.cover as any).titulo, 'Expediente de {nombre}')

check('step: {pais} stays', item('x1').title, 'Un papel inventado de {pais}')
check('step: {genero} stays', item('x1').body, 'Copia simple. Estás {genero:listo|lista} cuando lo tengas.')
check('step: inline nota removed (donde)', item('x1').donde, 'Una oficina inventada')
check('step: inline nota removed (aviso)', item('x1').aviso, 'Al llegar vives en el Saarland.')
check('step: aviso of only {nota_personal} is empty', item('x_3').aviso, null)
check('step: "no aplica" by default, with its reason', [item('x2').naDefault, item('x2').naReason],
  [true, 'No aplica salvo el caso raro.'])
check('step: reason kept when it applies by default', [item('x4').naDefault, item('x4').naReason],
  [false, 'Solo si ejerciste en los últimos tres años.'])
check('step: no reason stays empty', item('x5').naReason, null)
check('step: official number as text', [item('x4').officialNumber, item('x5').officialNumber], ['Antrag', '—'])
check('step: place in the envelope', p.items.map((i) => i.sobreOrder), [2, 3, null, 1, null])
check('step: caduca kept', item('x_3').caduca, "Vale 3 meses desde que 'llega'.")

/* ---------- Cards ---------- */
const cards = p.template.cards as any
check('cards: aviso_guardado left out', 'aviso_guardado' in cards, false)
check('cards: mis_dudas without the WhatsApp parts', Object.keys(cards.mis_dudas), ['titulo', 'ayuda', 'marcador_vacio'])
check('cards: filas become a list, in the JSON\'s order', cards.autoridad_y_costos.filas.map((f: any) => f.etiqueta),
  ['Zeta', 'Bundesland', 'Ruta', 'Alfa'])
check('cards: a fila keeps its value', cards.autoridad_y_costos.filas[1], { etiqueta: 'Bundesland', valor: 'Saarland' })
check('cards: the other cards stay', Object.keys(cards).sort(),
  ['autoridad_y_costos', 'leyenda', 'mis_dudas', 'pie', 'sobre'])
check('cards: the envelope list stays', cards.sobre.orden, ['A · Antrag', '1', '2 (si aplica)'])
check('cards: cleanCards leaves the input alone', (() => {
  const input: any = { aviso_guardado: 'x', pie: 'y' }
  cleanCards(input)
  return Object.keys(input)
})(), ['aviso_guardado', 'pie'])

/* ---------- Problems that stop the script ---------- */
hasProblem('stop: block 6', (t) => { t.pasos[0].bloque = 6 }, 'bloque must be a whole number from 1 to 5')
hasProblem('stop: block 0', (t) => { t.pasos[0].bloque = 0 }, 'bloque must be a whole number from 1 to 5')
hasProblem('stop: block as text', (t) => { t.pasos[0].bloque = '1' }, 'bloque must be a whole number from 1 to 5')
hasProblem('stop: a missing field', (t) => { delete t.pasos[1].plazo }, 'the field "plazo" is missing')
hasProblem('stop: an unknown field', (t) => { t.pasos[1].color = 'rojo' }, 'unknown field "color"')
hasProblem('stop: an empty title', (t) => { t.pasos[1].titulo = '  ' }, 'titulo must be a text')
hasProblem('stop: a code twice', (t) => { t.pasos[1].codigo = 'x1' }, 'appears more than once')
hasProblem('stop: a code with capitals', (t) => { t.pasos[1].codigo = 'X2' }, 'codigo must use only')
hasProblem('stop: a code with a hyphen', (t) => { t.pasos[1].codigo = 'x-2' }, 'codigo must use only')
hasProblem('stop: an unknown placeholder', (t) => { t.pasos[0].descripcion = 'En {ciudad}.' }, 'unknown placeholder "{ciudad}"')
hasProblem('stop: {nombre} in a step', (t) => { t.pasos[0].titulo = 'Hola {nombre}' }, 'only allowed on the cover')
hasProblem('stop: a placeholder in a card', (t) => { t.tarjetas.pie = 'Ver {ciudad}' }, 'unknown placeholder')
hasProblem('stop: {nota_personal} elsewhere', (t) => { t.pasos[0].descripcion = 'Ver {nota_personal} aquí.' }, 'may only appear')
hasProblem('stop: a title of only {nota_personal}', (t) => { t.pasos[0].titulo = '{nota_personal}' }, "can't be only {nota_personal}")
hasProblem('stop: "no aplica" without a reason', (t) => { t.pasos[1].motivo_no_aplica = null }, 'needs motivo_no_aplica')
hasProblem('stop: no_aplica_estado as text', (t) => { t.pasos[1].no_aplica_estado = 'sí' }, 'must be true or false')
hasProblem('stop: a block missing', (t) => { t.bloques.splice(3, 1) }, 'Block 4 is missing')
hasProblem('stop: a block twice', (t) => { t.bloques[4].bloque = 1 }, 'appears twice in bloques')
hasProblem('stop: an envelope entry with no step', (t) => { t.tarjetas.sobre.orden.push('9') }, 'matches 0 steps')
hasProblem('stop: a step twice in the envelope', (t) => { t.tarjetas.sobre.orden.push('1 (otra vez)') }, 'appears twice in tarjetas.sobre.orden')
hasProblem('stop: a number in a card', (t) => { t.tarjetas.pie = 42 }, 'only texts are allowed here')
hasProblem('stop: a control character', (t) => { t.pasos[0].descripcion = 'Hola\u0000' }, 'control character')
hasProblem('stop: a wrong date', (t) => { t.meta.generada = '2026-02-30' }, 'meta.generada must be a date')
hasProblem('stop: no meta.plantilla', (t) => { delete t.meta.plantilla }, 'meta.plantilla must be a text')
hasProblem('stop: an unknown top-level field', (t) => { t.extra = {} }, 'Unknown top-level field "extra"')
hasProblem('stop: wrong file name', () => {}, 'is not one of the four routes', 'sl-kp.json')
check('stop: every problem is listed, not only the first',
  problemsOf((t) => { t.pasos[0].bloque = 9; t.pasos[1].codigo = 'x1' }).length >= 2, true)
check('stop: not an object', checkTemplate([], FILE).plan, null)

/* ---------- SQL ---------- */
check('sqlText: a quote is doubled', sqlText("it's"), "'it''s'")
check('sqlText: $$ stays as it is', sqlText('a $$ b'), "'a $$ b'")
check('sqlText: a backslash stays as it is', sqlText('C:\\x'), "'C:\\x'")
check('sqlText: null', sqlText(null), 'null')
check('sqlText: NUL is refused', (() => { try { sqlText('a\u0000'); return 'no error' } catch { return 'error' } })(), 'error')

const sql = toSql(p)

/** Reads the SQL the way Postgres does, as far as quoting goes: plain
    code, -- comments, 'quoted texts' ('' inside is one quote) and
    $tag$ ... $tag$ blocks. Returns the texts inside the quotes, the plain
    code (everything outside quotes and comments), and whether every quote
    and block was closed. */
function readSql(s: string): { texts: string[]; code: string; closed: boolean } {
  const texts: string[] = []
  let code = ''
  let i = 0
  while (i < s.length) {
    if (s.startsWith('--', i)) {
      const end = s.indexOf('\n', i)
      i = end === -1 ? s.length : end
    } else if (s[i] === "'") {
      let text = ''
      i++
      for (;;) {
        if (i >= s.length) return { texts, code, closed: false }
        if (s[i] === "'" && s[i + 1] === "'") { text += "'"; i += 2 }
        else if (s[i] === "'") { i++; break }
        else { text += s[i]; i++ }
      }
      texts.push(text)
      code += ' <text> '
    } else if (s[i] === '$') {
      const m = /^\$([a-z_]*)\$/.exec(s.slice(i))
      if (!m) { code += s[i]; i++; continue }
      const end = s.indexOf(m[0], i + m[0].length)
      if (end === -1) return { texts, code, closed: false }
      code += ' <block> '
      // the block's own body is plain code too (the DO block)
      const inner = readSql(s.slice(i + m[0].length, end))
      if (!inner.closed) return { texts, code, closed: false }
      texts.push(...inner.texts)
      code += inner.code
      i = end + m[0].length
    } else { code += s[i]; i++ }
  }
  return { texts, code, closed: true }
}

const read = readSql(sql)
const tricky = fresh().pasos[2]
check('sql: every quote and block is closed', read.closed, true)
check('sql: the title with \' and $$ is one text, unchanged', read.texts.includes(tricky.titulo), true)
check('sql: the description with \', $$, -- and \\ is one text, unchanged', read.texts.includes(tricky.descripcion), true)
check('sql: caduca with quotes is one text, unchanged', read.texts.includes(tricky.caduca), true)
check('sql: nothing from the texts leaks into the code', ['drop table', 'O\'Higgins', 'Amt', 'tag$'].some((w) => read.code.includes(w)), false)
check('sql: the only $ blocks are the script\'s own', [...sql.matchAll(/^\$[a-z_]*\$/gm)].map((m) => m[0]), ['$check$'])
check('sql: the cards are one text that is valid JSON', (() => {
  const t = read.texts.find((x) => x.startsWith('{"leyenda"') || x.includes('"autoridad_y_costos"'))
  return t !== undefined && JSON.parse(t).autoridad_y_costos.filas.length === 4
})(), true)
check('sql: one transaction', [sql.includes('\nbegin;\n'), sql.includes('\ncommit;\n')], [true, true])
check('sql: backslashes are plain', sql.includes('set local standard_conforming_strings = on;'), true)
check('sql: never deletes', /\bdelete\b/i.test(read.code), false)
check('sql: never truncates or drops', /\b(truncate|drop)\b/i.test(read.code), false)
check('sql: updates existing steps in place', read.code.includes('on conflict (code) do update set'), true)
check('sql: archives only this state + route, only items with a source_code',
  /update public\.checklist_items\s+set archived = true\s+where state =\s*<text>\s+and route =\s*<text>\s+and source_code is not null\s+and not archived\s+and code not in/.test(read.code), true)
check('sql: the archive list holds every step\'s code', ['sl-dentista_ue-x1', 'sl-dentista_ue-x_3', 'sl-dentista_ue-x5']
  .every((c) => read.texts.includes(c)), true)
check('sql: a step that comes back is un-archived', sql.includes('archived        = false;'), true)
check('sql: stops if migration 7 is missing', sql.includes("raise exception 'Apply migration 7 first"), true)
check('sql: refuses an unknown route', (() => {
  try { toSql({ ...p, target: { ...p.target, route: "x'; drop table public.routes; --" } }); return 'no error' } catch { return 'error' }
})(), 'error')
check('sql: refuses an unknown state', (() => {
  try { toSql({ ...p, target: { ...p.target, state: 'zz' } }); return 'no error' } catch { return 'error' }
})(), 'error')
check('sql: refuses an odd file name', (() => {
  try { toSql({ ...p, target: { ...p.target, fileName: 'x\nselect 1;.json' } }); return 'no error' } catch { return 'error' }
})(), 'error')

/* ---------- Result ---------- */
if (failures.length > 0) {
  console.error(`${failures.length} checklist template test(s) FAILED (${passed} passed):\n`)
  for (const f of failures) console.error(`  - ${f}\n`)
  process.exit(1)
}
console.log(`ALL CHECKLIST TEMPLATE TESTS PASSED (${passed} checks)`)
