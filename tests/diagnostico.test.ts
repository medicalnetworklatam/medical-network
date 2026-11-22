/* Tests for the owner's diagnostic (src/lib/diagnostico.ts and
   src/content/diagnostico.ts, used by the admin page /admin/diagnostico).

   Run with:  npm test
   It needs no database and no internet. It ends with
   "ALL DIAGNOSTICO TESTS PASSED", or lists what failed.

   The expected numbers and texts below are what the owner's ORIGINAL file
   gives for the same answers (checked on 22 Nov 2026 by running the
   original next to the port; the original is not in this repository). The
   owner's Claude reads these texts from the printed PDF, so if one of
   these fails after a change, a figure or a text in the report changed.

   "Today" is fixed (22 November 2026), so the dates are the same on any
   day. Node.js 22 runs this TypeScript file directly. */

import {
  BUNDESLAENDER, COSTOS, DEFAULTS, LAND, PLAZOS, PREGUNTAS, PUNTAJES, RITMO, nombreLand,
  type Respuestas,
} from '../src/content/diagnostico.ts'
import {
  analizar, cabecera, dentroFila, estadoFase, eur, mesesDesdeTexto, numeroFase, pasoMeses,
  presupuesto, rango, sumarMeses, textoScore, ticksEje, tonoScore, tramos,
} from '../src/lib/diagnostico.ts'
import { MAP_SHAPES } from '../src/estados/mapShapes.ts'

let passed = 0
const failures: string[] = []

function same(name: string, actual: unknown, expected: unknown): void {
  const [a, e] = [JSON.stringify(actual), JSON.stringify(expected)]
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    got      ${a}`)
}

const HOY = new Date(2026, 10, 22)

/** The defaults with some answers changed */
const con = (cambios: Partial<Respuestas>): Respuestas => ({ ...DEFAULTS, ...cambios })

/** The four header figures, in order */
const metricas = (a: Respuestas) => cabecera(a, analizar(a), HOY).metricas.map((m) => m.v)

/** The budget's lines paid from savings: "name = value" */
const capital = (a: Respuestas) => presupuesto(analizar(a).budget, 'media', null).capital.map((f) => f.l + ' = ' + f.valor)

/* ===========================================================================
   Formats: exactly the original's
   =========================================================================== */

same('eur: thousands with a dot', eur(11904), '11.904 €')
same('eur: zero', eur(0), '0 €')
same('eur: under a thousand', eur(420), '420 €')
same('rango: one number', rango(75, 75), '75 €')
same('rango: two numbers', rango(400, 430), '400 € – 430 €')
same('rango: thousands', rango(0, 2000), '0 € – 2.000 €')
same('sumarMeses: this month', sumarMeses(HOY, 0), 'noviembre 2026')
same('sumarMeses: into the next year', sumarMeses(HOY, 2), 'enero 2027')
same('sumarMeses: half months are rounded', sumarMeses(HOY, 1.5), 'enero 2027')
same('sumarMeses: 39 months', sumarMeses(HOY, 39), 'febrero 2030')
same('numeroFase', numeroFase(4), '04')
same('textoScore: 75 is Bien', textoScore(75), 'Bien')
same('textoScore: 74 is Atención', textoScore(74), 'Atención')
same('textoScore: 45 is Atención', textoScore(45), 'Atención')
same('textoScore: 44 is Crítico', textoScore(44), 'Crítico')
same('tonoScore: 100', tonoScore(100), 'bien')
same('ticks: up to 6 months, every month', ticksEje(5), [0, 1, 2, 3, 4, 5])
same('ticks: 39 months, every 4, ending on 39', ticksEje(39), [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 39])
same('a bar is at least 3% wide', dentroFila({ name: 'x', start: 0, end: 0.1 }, 39),
  { tipo: 'barra', tono: 'fase', left: 0, width: 3 })

/* ===========================================================================
   The content
   =========================================================================== */

same('16 Bundesländer', BUNDESLAENDER.length, 16)
same('every Bundesland is a state of the map', BUNDESLAENDER.every((c) => MAP_SHAPES.some((s) => s.id === c)), true)
same('German names, in the original order', BUNDESLAENDER.map(nombreLand), [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen',
  'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland',
  'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
])
same('the fees "a confirmar"',
  BUNDESLAENDER.flatMap((c) => [['FSP', LAND[c].fsp], ['KP', LAND[c].kp]].filter(([, t]) => !(t as { ok: boolean }).ok).map(([k]) => nombreLand(c) + ' ' + k)),
  ['Bayern KP', 'Rheinland-Pfalz KP', 'Saarland FSP', 'Saarland KP', 'Sachsen KP', 'Sachsen-Anhalt KP', 'Thüringen KP'])

/* Every answer the rules look up must be one of the question's answers,
   so a typo in a table can't silently fall back to a default */
{
  const ops = (k: keyof Respuestas): readonly string[] => {
    for (const g of PREGUNTAS) for (const c of g.campos) if (c.k === k && c.tipo !== 'texto') return c.ops
    return []
  }
  const dentro = (name: string, keys: string[], k: keyof Respuestas) =>
    same(name + ': every key is an answer', keys.filter((x) => !ops(k).includes(x)), [])
  dentro('RITMO', Object.keys(RITMO), 'horas')
  dentro('PLAZOS.aleman', Object.keys(PLAZOS.aleman), 'nivel')
  dentro('PLAZOS.documentos', Object.keys(PLAZOS.documentos), 'documentos')
  dentro('PLAZOS.fsp', Object.keys(PLAZOS.fsp), 'fsp')
  dentro('PLAZOS.kp', Object.keys(PLAZOS.kp), 'kp')
  dentro('COSTOS.cursoAleman', Object.keys(COSTOS.cursoAleman), 'nivel')
  dentro('PUNTAJES.nivel', Object.keys(PUNTAJES.nivel), 'nivel')
  dentro('PUNTAJES.documentos', Object.keys(PUNTAJES.documentos), 'documentos')
  dentro('PUNTAJES.tramite', Object.keys(PUNTAJES.tramite), 'solicitud')
  dentro('PUNTAJES.ritmo', Object.keys(PUNTAJES.ritmo), 'horas')
  const faltan: string[] = []
  for (const g of PREGUNTAS) for (const c of g.campos) {
    if (c.tipo !== 'texto' && !c.ops.includes(DEFAULTS[c.k])) faltan.push(c.k)
  }
  same('every starting answer is one of its answers', faltan, [])
}

/* ===========================================================================
   The defaults
   =========================================================================== */

{
  const a = con({})
  const r = analizar(a)
  same('defaults: phase 1, 22–39 months', [r.actual, r.totalMin, r.totalMax], [1, 22, 39])
  same('defaults: first salary in month 8–16', [r.ingresoMin, r.ingresoMax], [8, 16])
  same('defaults: overall score 33', r.overall, 33)
  same('defaults: area scores', r.califs.map((c) => c.score), [45, 40, 15, 20, 25, 50])
  same('defaults: header', cabecera(a, r, HOY), {
    nombre: 'Mi caso',
    sub: 'Especialista',
    metricas: [
      { k: 'Fase actual', v: '1. Documentación', hl: false },
      { k: 'Tiempo estimado restante', v: '22–39 meses', hl: false },
      { k: 'Primer sueldo aprox.', v: 'julio 2027 – marzo 2028', hl: true },
      { k: 'Approbation aprox.', v: 'septiembre 2028 – febrero 2030', hl: false },
    ],
    land: 'Nordrhein-Westfalen',
    pie: ': rango estimado 10–18 meses (barra "Gutachten → Bescheid"). Corre en paralelo y no retrasa la FSP ni el sueldo: solo condiciona la Kenntnisprüfung y la Approbation. Las autoridades no publican plazos; es cálculo nuestro sobre casos.',
  })
  same('defaults: name and país · perfil', cabecera(con({ nombre: 'Ana Pérez', pais: 'Ecuador' }), r, HOY).nombre
    + ' / ' + cabecera(con({ nombre: 'Ana Pérez', pais: 'Ecuador' }), r, HOY).sub, 'Ana Pérez / Ecuador · Especialista')
  same('defaults: where the time comes from', tramos(r).map((t) => t.texto), [
    'Idioma + documentos · 7 m', 'Solicitud · 2 m', 'FSP · 4 m', 'Espera del Bescheid · 12 m', 'Kenntnisprüfung · 7 m', 'Approbation · 2 m',
  ])
  same('defaults: priorities', r.prio.map((p) => p.t), ['Cerrar documentación', 'Alemán a B2', 'Iniciar proceso de visa'])
  same('defaults: main rows', r.mainRows.map((x) => x.name), [
    'Documentación', 'Alemán hasta B2', 'Solicitud al Bundesland', 'FSP', 'Kenntnisprüfung (escenario estimado)', 'Approbation',
  ])
  same('defaults: the current phase is drawn as "ahora"', (dentroFila(r.mainRows[0], r.axisMax) as { tono: string }).tono, 'ahora')
  same('defaults: the salary row', [r.parRows[1].name, r.parRows[1].tone], ['Berufserlaubnis (sueldo)', 'hecho'])
  same('defaults: budget lines', capital(a), [
    'Traducciones juradas + apostillas = 300 € – 800 €',
    'Cursos de alemán hasta B2 = 800 € – 2.000 €',
    'Examen B2 (telc/Goethe) = 155 € – 230 €',
    'Preparación alemán médico FSP (hay recursos gratuitos) = 0 € – 2.000 €',
    'Tasa FSP (Nordrhein-Westfalen) = 400 € – 430 €',
    'Peritaje de equivalencia (Nordrhein-Westfalen) · si la autoridad lo encarga = 0 € – 1.800 €',
    'Visa nacional (categoría D) = 75 €',
  ])
  const p = presupuesto(r.budget, 'media', null)
  same('defaults: cost of living', p.vida, {
    l: 'Costo de vida · 2–6 meses en Alemania sin sueldo × 1.100 €–1.500 €/mes',
    valor: '2.200 € – 9.000 €',
  })
  same('defaults: Capital que necesito', p.total, { sinPendientes: false, valor: '3.930 € – 16.335 €' })
  same('defaults: months field', [p.valorMeses, p.textoMeses], [4, 'calculado: 2–6 · edítalo si sabes el dato real'])
  same('defaults: salary box', [p.sueldo?.titulo, p.sueldo?.filas.map((f) => f.valor)],
    ['A partir del mes ~12: sueldo de médico', ['0 € – 1.050 €', '150 € – 1.000 €']])
  same('defaults: salary box text', p.sueldo?.texto,
    'Con la FSP aprobada solicito la Berufserlaubnis y empiezo a trabajar. El sueldo es el mismo que con la Approbation. Desde ese punto, estos 19 meses de costo de vida y lo que quede del proceso salen del salario, no de mis ahorros.')
  same('defaults: no fees to confirm', p.pendientes, null)
  same('defaults: notes', p.notas.map((n) => n.b), [
    'Sperrkonto (cuenta bloqueada):', 'Cuándo empieza el sueldo:', 'Tasa FSP (Nordrhein-Westfalen):',
    'Tasa Kenntnisprüfung (Nordrhein-Westfalen) · si aplica:', 'De dónde salen las tasas de examen:',
  ])
}

/* ===========================================================================
   "Equivalencia (Approbation directa)": no Kenntnisprüfung
   =========================================================================== */

{
  const a = con({ via: 'Equivalencia (Approbation directa)' })
  const r = analizar(a)
  same('equivalencia: 17–30 months', [r.totalMin, r.totalMax], [17, 30])
  same('equivalencia: header dates', metricas(a), ['1. Documentación', '17–30 meses', 'julio 2027 – marzo 2028', 'abril 2028 – mayo 2029'])
  same('equivalencia: the KP row says it does not apply', dentroFila(r.mainRows[4], r.axisMax), { tipo: 'chip', texto: 'No aplica (equivalencia)' })
  same('equivalencia: KP row name without "(escenario estimado)"', r.mainRows[4].name, 'Kenntnisprüfung')
  same('equivalencia: phase 6 is "No aplica"', estadoFase(6, r), 'No aplica')
  same('equivalencia: no KP fee', analizar(a).budget.items.some((i) => i.l.startsWith('Tasa Kenntnisprüfung')), false)
  same('equivalencia: no KP stretch', tramos(r).map((t) => t.texto), [
    'Idioma + documentos · 7 m', 'Solicitud · 2 m', 'FSP · 4 m', 'Espera del Bescheid · 12 m', 'Approbation · 2 m',
  ])
}

/* ===========================================================================
   FSP "Aprobado"
   =========================================================================== */

{
  const a = con({ fsp: 'Aprobado' })
  const r = analizar(a)
  same('FSP aprobado: first salary in month 5–11', [r.ingresoMin, r.ingresoMax], [5, 11])
  same('FSP aprobado: header dates', metricas(a), ['1. Documentación', '22–39 meses', 'abril 2027 – octubre 2027', 'septiembre 2028 – febrero 2030'])
  same('FSP aprobado: the FSP row says "✓ hecho"', dentroFila(r.mainRows[3], r.axisMax), { tipo: 'hecho' })
  same('FSP aprobado: phase 5 Completado', estadoFase(5, r), 'Completado')
  same('FSP aprobado: exams score 75', r.califs[3].score, 75)
  same('FSP aprobado: priorities', r.prio.map((p) => p.t),
    ['Cerrar documentación', 'Alemán a B2', 'Iniciar proceso de visa', 'Solicitar Berufserlaubnis y buscar puesto'])
  const p = presupuesto(r.budget, 'media', null)
  same('FSP aprobado: no FSP fee or preparation', capital(a).filter((l) => l.includes('FSP')), [])
  same('FSP aprobado: cost of living 0–3 months', p.vida.l, 'Costo de vida · 0–3 meses en Alemania sin sueldo × 1.100 €–1.500 €/mes')
  same('FSP aprobado: capital', p.total.valor, '1.330 € – 9.405 €')
  same('FSP aprobado: salary from month ~8', p.sueldo?.titulo, 'A partir del mes ~8: sueldo de médico')
}

/* ===========================================================================
   "Bescheid recibido"
   =========================================================================== */

{
  const a = con({ solicitud: 'Bescheid recibido' })
  const r = analizar(a)
  same('Bescheid: phase 5 (FSP), 9–16 months', [r.actual, r.totalMin, r.totalMax], [5, 9, 16])
  same('Bescheid: header', metricas(a), ['5. FSP', '9–16 meses', 'febrero 2027 – julio 2027', 'agosto 2027 – marzo 2028'])
  same('Bescheid: the Gutachten row', dentroFila(r.parRows[0], r.axisMax), { tipo: 'chip', texto: 'Bescheid recibido' })
  same('Bescheid: phases 1–3 done', [1, 2, 3, 4].map((n) => estadoFase(n, r)), ['Completado', 'Completado', 'Completado', 'Completado'])
  same('Bescheid: no peritaje', r.budget.items.some((i) => i.l.startsWith('Peritaje')), false)
  same('Bescheid: priorities', r.prio.map((p) => p.t), ['Iniciar proceso de visa', 'Reservar la Kenntnisprüfung'])
  same('Bescheid: Trámite oficial 100 · Bien', [r.califs[2].score, textoScore(r.califs[2].score)], [100, 'Bien'])
  same('Bescheid: capital', presupuesto(r.budget, 'media', null).total.valor, '5.030 € – 18.585 €')
}

/* ===========================================================================
   Berufserlaubnis "No": savings pay until the Approbation
   =========================================================================== */

{
  const a = con({ berufserlaubnis: 'No' })
  const r = analizar(a)
  same('no Berufserlaubnis: header', metricas(a), ['1. Documentación', '22–39 meses', 'Sin Berufserlaubnis', 'septiembre 2028 – febrero 2030'])
  same('no Berufserlaubnis: not highlighted', cabecera(a, r, HOY).metricas[2].hl, false)
  same('no Berufserlaubnis: the row says Descartada', dentroFila(r.parRows[1], r.axisMax), { tipo: 'chip', texto: 'Descartada' })
  const p = presupuesto(r.budget, 'media', null)
  same('no Berufserlaubnis: no salary box', p.sueldo, null)
  same('no Berufserlaubnis: 16–29 months', p.vida, {
    l: 'Costo de vida · 16–29 meses en Alemania sin sueldo × 1.100 €–1.500 €/mes',
    valor: '17.600 € – 43.500 €',
  })
  same('no Berufserlaubnis: every line paid from savings', p.capital.length, 9)
  same('no Berufserlaubnis: capital', p.total.valor, '19.480 € – 52.885 €')
}

/* ===========================================================================
   Fees "a confirmar": shown, and left out of the total
   =========================================================================== */

{
  const a = con({ bundesland: 'sl' })
  const p = presupuesto(analizar(a).budget, 'media', null)
  same('Saarland: the FSP fee is "a confirmar"', p.capital.find((f) => f.l === 'Tasa FSP (Saarland)'),
    { l: 'Tasa FSP (Saarland)', estimado: false, pendiente: true, valor: 'a confirmar' })
  same('Saarland: total without them', p.total, { sinPendientes: true, valor: '3.530 € – 15.905 €' })
  same('Saarland: the box title', p.pendientes?.titulo, 'Faltan 2 tasas por confirmar en Saarland')
  same('Saarland: the reasons', p.pendientes?.items.map((i) => i.b), ['Tasa FSP (Saarland):', 'Tasa Kenntnisprüfung (Saarland) · si aplica:'])
  same('Saarland: the reasons are not repeated in the notes', p.notas.some((n) => n.b.includes('Saarland')), false)
  same('Saarland: "Bescheid en" line', cabecera(a, analizar(a), HOY).land, 'Saarland')
}
{
  const a = con({ bundesland: 'by' })
  const p = presupuesto(analizar(a).budget, 'grande', null)
  same('Bayern: one fee to confirm', p.pendientes?.titulo, 'Falta una tasa por confirmar en Bayern')
  same('Bayern: FSP fee', p.capital.find((f) => f.l === 'Tasa FSP (Bayern)')?.valor, '550 €')
  same('Bayern, big city: cost of living', p.vida.valor, '2.800 € – 11.400 €')
  same('Bayern: total without the KP fee', p.total, { sinPendientes: true, valor: '4.680 € – 18.855 €' })
}

/* ===========================================================================
   "Meses sin sueldo" typed by hand
   =========================================================================== */

{
  const b = analizar(con({})).budget
  const p = presupuesto(b, 'pequena', 12)
  same('12 months by hand: one number, small city', p.vida, {
    l: 'Costo de vida · 12 meses en Alemania sin sueldo × 900 €–1.300 €/mes',
    valor: '10.800 € – 15.600 €',
  })
  same('12 months by hand: capital', p.total.valor, '12.530 € – 22.935 €')
  same('12 months by hand: the field and the way back', [p.manual, p.valorMeses, p.textoMeses], [true, 12, 'volver al cálculo (2–6)'])
  same('1 month by hand: "1 mes"', presupuesto(b, 'media', 1).vida.l, 'Costo de vida · 1 mes en Alemania sin sueldo × 1.100 €–1.500 €/mes')
  same('typed: a number', mesesDesdeTexto('7'), 7)
  same('typed: empty = back to the calculation', mesesDesdeTexto(''), null)
  same('typed: at most 99', mesesDesdeTexto('150'), 99)
  same('typed: at least 0', mesesDesdeTexto('-3'), 0)
  same('"+" from the calculation (4)', pasoMeses(1, 4, null), 5)
  same('"−" never below 0', pasoMeses(-1, 4, 0), 0)
}

/* ===========================================================================
   Result
   =========================================================================== */

if (failures.length) {
  console.error(`${failures.length} DIAGNOSTICO TEST(S) FAILED (${passed} passed):\n`)
  for (const f of failures) console.error('  ✗ ' + f + '\n')
  process.exit(1)
} else {
  console.log(`ALL DIAGNOSTICO TESTS PASSED (${passed} checks)`)
}
