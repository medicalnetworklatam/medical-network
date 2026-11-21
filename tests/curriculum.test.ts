/* Tests for the CV and cover letter tool (src/lib/curriculum.ts, used by
   the page /curriculum).

   Run with:  npm test
   It needs no database and no internet. It ends with
   "ALL CURRICULUM TESTS PASSED", or lists what failed.

   Two things are checked:
   - the gap check: which months between the first period and today are
     not explained (overlaps, an open-ended period, a gap of one month,
     periods out of order…)
   - the produced text: EXACTLY the format of the owner's original tool
     (design-reference/curriculum-original.html), because the owner's
     Claude reads it. If one of these fails, the format changed.

   All data here is made up. "Today" is fixed (November 2026), so the
   tests give the same result on any day.

   Node.js 22 runs this TypeScript file directly. */

import { readFileSync } from 'node:fs'
import {
  TIPOS, aNum, analiza, cvText, deNum, emptyCv, meses, newPeriod, parseCv, storageKey,
  type CvData, type CvPeriod,
} from '../src/lib/curriculum.ts'

let passed = 0
const failures: string[] = []

function same(name: string, actual: unknown, expected: unknown): void {
  const [a, e] = [JSON.stringify(actual), JSON.stringify(expected)]
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    got      ${a}`)
}

/** A month as the gap check counts it: "2020-03" → its number */
function m(ym: string): number {
  const n = aNum(ym)
  if (n === null) throw new Error('not a month: ' + ym)
  return n
}

/** A period with only the fields a test cares about */
function per(desde: string, hasta: string, more: Partial<CvPeriod> = {}): CvPeriod {
  return { ...newPeriod(), desde, hasta, ...more }
}

const HOY = m('2026-11')

/* ===========================================================================
   Dates
   =========================================================================== */

same('aNum: March 2019', aNum('2019-03'), 2019 * 12 + 2)
same('aNum: empty', aNum(''), null)
same('aNum: not a month', aNum('03/2019'), null)
same('deNum: back to MM/YYYY', deNum(aNum('2019-03')!), '03/2019')
same('deNum: December', deNum(aNum('2020-12')!), '12/2020')
same('meses: one', meses(1), '1 mes')
same('meses: several', meses(4), '4 meses')
same('17 period types', TIPOS.length, 17)
same('a new period is "Estudios de medicina"', newPeriod().tipo, 'medicina')

/* ===========================================================================
   The gap check
   =========================================================================== */

{
  const r = analiza([], HOY)
  same('no periods: nothing to check', r, { vacio: true, sinFecha: 0 })
}
{
  const r = analiza([per('', '2020-01')], HOY)
  same('only a period without a start: nothing to check, 1 without date', r, { vacio: true, sinFecha: 1 })
}
{
  /* overlapping periods: the months they share count once, no gap */
  const r = analiza([per('2015-01', '2016-06'), per('2016-01', '2018-12')], m('2018-12'))
  same('overlaps: no gaps', !r.vacio && r.huecos, [])
  same('overlaps: starts at the earliest month', !r.vacio && deNum(r.ini), '01/2015')
  same('overlaps: one bar block per month', !r.vacio && r.tramos.length, 48)
  same('overlaps: every month covered', !r.vacio && r.tramos.every(Boolean), true)
}
{
  /* a period with no "Hasta" runs up to today */
  const r = analiza([per('2020-01', '')], HOY)
  same('open-ended: no gaps', !r.vacio && r.huecos, [])
  same('open-ended: up to this month', !r.vacio && r.tramos.length, HOY - m('2020-01') + 1)
}
{
  /* a gap of exactly one month (June 2020) */
  const r = analiza([per('2020-01', '2020-05'), per('2020-07', '')], HOY)
  same('one month: the gap', !r.vacio && r.huecos, [[m('2020-06'), m('2020-06')]])
  same('one month: shown in the bar', !r.vacio && r.tramos.filter((c) => !c).length, 1)
}
{
  /* the same periods entered the other way round: the same result */
  const inOrder = analiza([per('2014-03', '2018-02'), per('2018-05', '2019-12'), per('2020-01', '')], HOY)
  const outOfOrder = analiza([per('2020-01', ''), per('2014-03', '2018-02'), per('2018-05', '2019-12')], HOY)
  same('out of order: same result', outOfOrder, inOrder)
  same('out of order: the gap', !outOfOrder.vacio && outOfOrder.huecos, [[m('2018-03'), m('2018-04')]])
  same('out of order: starts at the earliest', !outOfOrder.vacio && deNum(outOfOrder.ini), '03/2014')
}
{
  /* "Desde" after "Hasta": turned round */
  const r = analiza([per('2021-05', '2021-01'), per('2021-06', '')], HOY)
  same('dates the wrong way round: no gap', !r.vacio && r.huecos, [])
  same('dates the wrong way round: starts at the earlier date', !r.vacio && deNum(r.ini), '01/2021')
}
{
  /* the last period ended before today: the months since are a gap */
  const r = analiza([per('2020-01', '2020-12')], m('2021-03'))
  same('ended before today: gap up to today', !r.vacio && r.huecos, [[m('2021-01'), m('2021-03')]])
}
{
  /* several gaps, oldest first; a period without a start is counted apart */
  const r = analiza([per('2019-01', '2019-03'), per('2019-05', '2019-06'), per('2019-09', ''), per('', '')], HOY)
  same('several gaps', !r.vacio && r.huecos, [[m('2019-04'), m('2019-04')], [m('2019-07'), m('2019-08')]])
  same('several gaps: 1 without a start date', r.sinFecha, 1)
}
{
  /* months after today don't count */
  const r = analiza([per('2026-01', '2027-06')], HOY)
  same('future months ignored', !r.vacio && r.tramos.length, 11)
}

/* ===========================================================================
   The produced text: exactly the original's format
   =========================================================================== */

{
  same('empty form: the whole text', cvText(emptyCv(), HOY), [
    '=== DATOS PARA MI CURRICULUM ALEMAN ===',
    'Nombre completo: ',
    'Fecha de nacimiento: ',
    'Lugar y pais de nacimiento: ',
    'Nacionalidad: ',
    'Direccion actual: ',
    'Correo: ',
    'Telefono: ',
    '',
    '=== MIS PERIODOS, DEL MAS ANTIGUO AL MAS RECIENTE ===',
    '(ninguno)',
    '',
    '=== CONTROL DE HUECOS ===',
    'Sin periodos cargados.',
    '',
    '=== PARA MI CARTA DE PRESENTACION ===',
    '1. Por que estudie medicina:',
    '(sin contestar)',
    '',
    '2. Por que Alemania:',
    '(sin contestar)',
    '',
    '3. Que especialidad y por que:',
    '(sin contestar)',
    '',
    '4. Que se hacer con las manos:',
    '(sin contestar)',
    '',
    '5. Que busco en el puesto y que aporto:',
    '(sin contestar)',
    '',
    '6. Desde cuando puedo empezar y mi nivel de aleman:',
    '(sin contestar)',
    '',
  ].join('\n'))
}

/* A filled-in form, made up. Periods entered out of order, one without a
   start date, one gap of one month (03/2020), an open-ended period. */
const ejemplo: CvData = {
  d: {
    nombre: 'Ana Prueba Ejemplo',
    nac: '01/02/1995',
    lugar: 'Cuenca, Ecuador',
    nacion: 'Ecuatoriana',
    dir: 'Calle Falsa 123, Cuenca, Ecuador',
    mail: 'ana@ejemplo.com',
    tel: '+593 00 000 0000',
  },
  per: [
    per('2019-09', '2020-02', { tipo: 'internado', titulo: 'Médica rural', donde: 'Centro de Salud Ejemplo', ciudad: 'Cuenca, Ecuador' }),
    per('2012-10', '2019-08', { tipo: 'medicina', titulo: 'Medicina', donde: 'Universidad Ejemplo', ciudad: 'Quito, Ecuador', detalle: 'Promoción 2019' }),
    per('2020-04', '', { tipo: 'medico' }),
    per('', '2011-06', { tipo: 'colegio', titulo: 'Bachillerato' }),
  ],
  c: {
    c1: '  Por vocación.\nMi madre es enfermera.  ',
    c2: '   ',
    c4: 'Suturas, guardias de urgencias.',
    c5: 'Un hospital universitario.',
    c6: 'Desde 2027, B2.',
  },
}

const textoEjemplo = cvText(ejemplo, HOY)
same('filled-in form: the whole text', textoEjemplo, [
  '=== DATOS PARA MI CURRICULUM ALEMAN ===',
  'Nombre completo: Ana Prueba Ejemplo',
  'Fecha de nacimiento: 01/02/1995',
  'Lugar y pais de nacimiento: Cuenca, Ecuador',
  'Nacionalidad: Ecuatoriana',
  'Direccion actual: Calle Falsa 123, Cuenca, Ecuador',
  'Correo: ana@ejemplo.com',
  'Telefono: +593 00 000 0000',
  '',
  '=== MIS PERIODOS, DEL MAS ANTIGUO AL MAS RECIENTE ===',
  '1) 10/2012 - 08/2019 | Estudios de medicina',
  '   Titulo o puesto: Medicina',
  '   Donde: Universidad Ejemplo',
  '   Ciudad y pais: Quito, Ecuador',
  '   Detalle: Promoción 2019',
  '2) 09/2019 - 02/2020 | Año práctico / internado / rural',
  '   Titulo o puesto: Médica rural',
  '   Donde: Centro de Salud Ejemplo',
  '   Ciudad y pais: Cuenca, Ecuador',
  '3) 04/2020 - actualidad | Trabajo como médico',
  '   Titulo o puesto: -',
  '   Donde: -',
  '   Ciudad y pais: -',
  '4) ?? - 06/2011 | Colegio / bachillerato',
  '   Titulo o puesto: Bachillerato',
  '   Donde: -',
  '   Ciudad y pais: -',
  '',
  '=== CONTROL DE HUECOS ===',
  'ATENCION: quedan meses sin explicar.',
  '  - 03/2020 (1 mes)',
  '',
  '=== PARA MI CARTA DE PRESENTACION ===',
  '1. Por que estudie medicina:',
  'Por vocación.\nMi madre es enfermera.',
  '',
  '2. Por que Alemania:',
  '', // only spaces: an empty line, as in the original (not "sin contestar")
  '',
  '3. Que especialidad y por que:',
  '(sin contestar)',
  '',
  '4. Que se hacer con las manos:',
  'Suturas, guardias de urgencias.',
  '',
  '5. Que busco en el puesto y que aporto:',
  'Un hospital universitario.',
  '',
  '6. Desde cuando puedo empezar y mi nivel de aleman:',
  'Desde 2027, B2.',
  '',
].join('\n'))

same('the text does not change the saved order', ejemplo.per[0].desde, '2019-09')

{
  /* several gaps, written with "a" and their length */
  const d: CvData = { d: {}, c: {}, per: [per('2018-01', '2018-02'), per('2018-04', '2018-04'), per('2018-09', '')] }
  const lines = cvText(d, HOY).split('\n')
  const i = lines.indexOf('=== CONTROL DE HUECOS ===')
  same('several gaps in the text', lines.slice(i, i + 4), [
    '=== CONTROL DE HUECOS ===',
    'ATENCION: quedan meses sin explicar.',
    '  - 03/2018 (1 mes)',
    '  - 05/2018 a 08/2018 (4 meses)',
  ])
}
{
  /* no gaps */
  const d: CvData = { d: {}, c: {}, per: [per('2013-03', '2020-02'), per('2020-03', '')] }
  const lines = cvText(d, HOY).split('\n')
  const i = lines.indexOf('=== CONTROL DE HUECOS ===')
  same('no gaps in the text', lines[i + 1], 'Sin huecos. Cubre desde 03/2013 hasta hoy.')
}
{
  /* an unknown period type is written as it is */
  const d: CvData = { d: {}, c: {}, per: [per('2020-01', '', { tipo: 'algo' }), per('2021-01', '', { tipo: '' })] }
  const lines = cvText(d, HOY).split('\n')
  same('unknown type', lines.includes('1) 01/2020 - actualidad | algo'), true)
  same('no type', lines.includes('2) 01/2021 - actualidad | Sin especificar'), true)
}

/* ===========================================================================
   "Ivan" became "el equipo MNL", on the page and in the text
   =========================================================================== */

same('no "Ivan" in the text', /ivan/i.test(textoEjemplo), false)
{
  const page = readFileSync(new URL('../src/pages/Curriculum.tsx', import.meta.url), 'utf8')
  same('no "Ivan" on the page', /\bivan\b/i.test(page), false)
  for (const words of [
    'Mandárselo al equipo MNL',
    'Preparar mi texto para el equipo MNL',
    'Copiado — pégaselo al equipo MNL por WhatsApp',
    'Cópialo entero y mándaselo al equipo MNL',
    'Selecciona el texto y cópialo a mano',
  ]) same('on the page: ' + words, page.includes(words), true)
}

/* ===========================================================================
   Saving on this device
   =========================================================================== */

same('one key per account', storageKey('user-a') !== storageKey('user-b'), true)
same('the key has the user ID', storageKey('1234').endsWith('1234'), true)
same('nothing saved: empty', parseCv(null), emptyCv())
same('broken saved value: empty', parseCv('{not json'), emptyCv())
same('saved value of the wrong kind: empty', parseCv('[1,2]').per, [])
{
  const back = parseCv(JSON.stringify(ejemplo))
  same('a saved draft comes back the same text', cvText(back, HOY), textoEjemplo)
  const odd = parseCv(JSON.stringify({ d: { nombre: 5 }, per: [null, { desde: '2020-01', tipo: 7 }], c: { c1: 'hola' } }))
  same('only text is read back', [odd.d.nombre, odd.per.length, odd.per[0].tipo, odd.c.c1], ['', 1, '', 'hola'])
}

/* ===========================================================================
   Result
   =========================================================================== */

if (failures.length) {
  console.error(`${failures.length} CURRICULUM TEST(S) FAILED:\n`)
  for (const f of failures) console.error('  ✗ ' + f + '\n')
  process.exit(1)
}
console.log(`ALL CURRICULUM TESTS PASSED (${passed} checks)`)
