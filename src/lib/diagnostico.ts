/* The CALCULATION of the owner's diagnostic (/admin/diagnostico): from the
   answers to the report. Ported line by line from the owner's original
   file, so the same answers give the same months, euros, dates and texts.
   The content it uses (questions, fees, months, texts) is in
   src/content/diagnostico.ts.

   Everything here is a pure function: it only looks at what it is given
   (the answers, the city size, the months typed by hand, today's date) and
   never touches the page, the browser's storage or the network. That is
   what lets tests/diagnostico.test.ts check it without a browser. */

import {
  AREAS, COLCHON_PUESTO, COSTOS, CUANDO, FASES, GANTT, LAND, LAND_POR_DEFECTO, MESES,
  MESES_MANUAL_LIMITES, PARALELO, PARTIDAS, PLAZOS, PRIORIDADES, PUNTAJES, RITMO, SPERRKONTO,
  TEXTOS, TRAMOS, VIDA_POR_MES, nombreLand,
  type Rango, type Recomendacion, type Respuestas, type Tier,
} from '../content/diagnostico.ts'

/* ===========================================================================
   Formats (exactly as the original)
   =========================================================================== */

/** "m" months after the first day of `fecha`'s month: "agosto 2027" */
export function sumarMeses(fecha: Date, m: number): string {
  const d = new Date(fecha.getFullYear(), fecha.getMonth() + Math.round(m), 1)
  return MESES[d.getMonth()] + ' ' + d.getFullYear()
}

/** 11904 → "11.904 €" */
export const eur = (n: number): string => n.toLocaleString('de-DE') + ' €'

/** "420 €", or "400 € – 430 €" */
export const rango = (min: number, max: number): string => (min === max ? eur(min) : eur(min) + ' – ' + eur(max))

/* ===========================================================================
   Types of the result
   =========================================================================== */

/** One row of the timeline ("Mi ruta planeada") */
export interface FilaGantt {
  name: string
  /** Months from today; missing on a row with only a word in it */
  start?: number
  end?: number
  done?: boolean
  current?: boolean
  na?: boolean
  /** The word shown instead of a bar ("Bescheid recibido") */
  chip?: string
  /** Small line under the name ("aquí empieza el sueldo") */
  note?: string
  /** The bar's kind on the "En paralelo" rows */
  tone?: 'par' | 'hecho'
  /** The phase's number (main rows only) */
  n?: number
}

/** A stretch of "¿De dónde sale ese tiempo?": its name and months */
export interface Tramo {
  l: string
  m: number
}

/** Paid from savings ("capital") or once the salary comes in ("sueldo") */
export type FaseDinero = 'capital' | 'sueldo'

/** One line of the budget: with its euros, or a fee "a confirmar" */
export type Partida =
  | { l: string; fase: FaseDinero; nota?: string; pendiente: true }
  | { l: string; fase: FaseDinero; nota?: string; pendiente?: undefined; min: number; max: number; src?: string; estimado?: true }

export interface Presupuesto {
  items: Partida[]
  mesesBolsilloMin: number
  mesesBolsilloMax: number
  mesesSueldo: number
  conSueldo: boolean
  ingresoMes: number | null
  vidaTiers: Readonly<Record<Tier, Rango>>
  necesitaVisa: boolean
  sperr: number
  /** The state's German name */
  bundesland: string
}

export interface Calificacion {
  area: string
  score: number
  rec: string
}

export interface TareaParalela {
  n: string
  c: string
  d: string
}

export interface Prioridad {
  t: string
  d: string
}

export interface Analisis {
  rem: Record<number, Rango>
  done: Record<number, boolean>
  actual: number
  totalMin: number
  totalMax: number
  prio: Prioridad[]
  paralelo: TareaParalela[]
  alertaB2: boolean
  axisMax: number
  mainRows: FilaGantt[]
  parRows: FilaGantt[]
  seg: Tramo[]
  segTotal: number
  kpNeeded: boolean
  kpAsumida: boolean
  budget: Presupuesto
  califs: Calificacion[]
  overall: number
  landRev: Rango
  ingresoMes: number | null
  ingresoMin: number | null
  ingresoMax: number | null
  conSueldo: boolean
}

/* ===========================================================================
   The calculation
   =========================================================================== */

/** Under this many months, a stretch counts as nothing (no bar, no row) */
const CASI_CERO = 0.3

/** Which advice goes with a score */
function recomendacion(r: Recomendacion, score: number): string {
  return score >= PUNTAJES.bien ? r.bien : score >= PUNTAJES.atencion ? r.atencion : r.critico
}

/** The original's analizar(): the answers → phases, months, timeline,
    budget, scores, priorities. Same results as the original. */
export function analizar(a: Respuestas): Analisis {
  const mult = RITMO[a.horas] || 1
  const scale = (r: Rango, f = 1): Rango => [r[0] * f, r[1] * f]
  const exp = (r: Rango) => (r[0] + r[1]) / 2
  const nivelB2 = ['B2', 'C1', 'FSP aprobado'].includes(a.nivel)
  const enAlemania = a.ubicacion === 'Ya vivo en Alemania'
  const visaLista = ['Ya tengo permiso', 'Ciudadanía UE'].includes(a.visa)
  const necesitaVisa = !enAlemania && !visaLista
  const kpNeeded = a.via !== 'Equivalencia (Approbation directa)'
  const kpAsumida = a.via === 'Aún no lo sé'
  const land = LAND[a.bundesland] || LAND[LAND_POR_DEFECTO]
  const landNombre = nombreLand(a.bundesland)

  const alemanBase = PLAZOS.aleman[a.nivel] || [0, 0]
  const docBase = PLAZOS.documentos[a.documentos] || [0, 0]
  const solBase: Rango = ['Presentada, esperando', 'Bescheid recibido'].includes(a.solicitud) ? [0, 0] : PLAZOS.solicitud
  const { factor, minimo } = PLAZOS.revisionEnCurso
  const reviewBase: Rango = a.solicitud === 'Bescheid recibido' ? [0, 0]
    : a.solicitud === 'Presentada, esperando'
      ? [Math.max(minimo[0], Math.round(land.rev[0] * factor[0])), Math.max(minimo[1], Math.round(land.rev[1] * factor[1]))]
      : land.rev
  const fspBase = PLAZOS.fsp[a.fsp] || [0, 0]
  const kpBase: Rango = !kpNeeded ? [0, 0] : (PLAZOS.kp[a.kp] || PLAZOS.kpPorDefecto)

  const rem: Record<number, Rango> = {
    1: docBase, 2: scale(alemanBase, mult), 3: solBase, 4: reviewBase,
    5: scale(fspBase, mult), 6: scale(kpBase, mult), 7: PLAZOS.approbation,
  }

  const docsDone = a.documentos === 'Completo y verificado'
  const applied = ['Presentada, esperando', 'Bescheid recibido'].includes(a.solicitud)
  const bescheidDone = a.solicitud === 'Bescheid recibido'
  const fspDone = a.fsp === 'Aprobado'
  const kpActuallyDone = a.kp === 'Aprobado'

  const done: Record<number, boolean> = {}
  done[6] = kpActuallyDone || !kpNeeded
  done[5] = fspDone || kpActuallyDone
  done[4] = bescheidDone
  done[3] = applied
  done[1] = docsDone || done[3]
  done[2] = nivelB2 || done[3]
  done[7] = false

  const spine = [1, 2, 3, 4, 5, 6, 7]
  const actual = spine.find((n) => !done[n]) || 7

  /* The timeline. Two independent chains that start together:
     - the Gutachten runs on its own from the application and ends in the
       Bescheid;
     - the FSP only depends on German and doesn't wait for the Bescheid.
     The Bescheid only decides the Kenntnisprüfung and the final
     Approbation. The salary starts with the FSP, not with the Bescheid. */
  const calc = (sel: (r: Rango) => number, colchon: number) => {
    const v = (n: number) => (done[n] ? 0 : sel(rem[n]))
    const doc = v(1), aleman = v(2)
    const prep = Math.max(doc, aleman)
    const submit = prep + v(3)
    const bescheidEnd = submit + v(4)
    const fspEnd = aleman + v(5)
    const ingreso = fspEnd + colchon
    const kpStart = Math.max(bescheidEnd, fspEnd)
    const kpEnd = kpStart + v(6)
    const approbEnd = Math.max(bescheidEnd, kpEnd) + v(7)
    return { doc, aleman, prep, submit, bescheidEnd, fspEnd, ingreso, kpStart, kpEnd, approbEnd }
  }
  const lo = calc((r) => r[0], COLCHON_PUESTO[0])
  const hi = calc((r) => r[1], COLCHON_PUESTO[1])
  const t = calc(exp, (COLCHON_PUESTO[0] + COLCHON_PUESTO[1]) / 2)
  const totalMin = Math.round(lo.approbEnd), totalMax = Math.round(hi.approbEnd)

  const e = (n: number) => (done[n] ? 0 : exp(rem[n]))
  const axisMax = Math.max(Math.ceil(Math.max(t.approbEnd, totalMax)), 1)
  const clip = (x: number) => Math.max(0, Math.min(axisMax, x))

  const winMain: Record<number, Rango> = {
    1: [0, t.doc], 2: [0, t.aleman], 3: [t.prep, t.submit],
    5: [t.aleman, t.fspEnd], 6: [t.kpStart, t.kpEnd],
    7: [Math.max(t.bescheidEnd, t.kpEnd), t.approbEnd],
  }
  const mainRows: FilaGantt[] = [1, 2, 3, 5, 6, 7].map((n) => {
    const naKP = n === 6 && !kpNeeded
    const nota = n === 5 && !done[5] ? GANTT.notaSueldo : ''
    return {
      n, name: FASES.find((f) => f.n === n)!.nombre + (n === 6 && kpAsumida ? GANTT.escenarioEstimado : ''),
      start: winMain[n][0], end: winMain[n][1], done: done[n] && !naKP, current: n === actual,
      na: naKP, chip: naKP ? GANTT.noAplicaEquivalencia : '', note: nota,
    }
  })

  const parRows: FilaGantt[] = []
  if (done[4]) parRows.push({ name: GANTT.gutachten, na: true, chip: GANTT.bescheidRecibido })
  else parRows.push({ name: GANTT.gutachten, start: clip(t.submit), end: clip(t.bescheidEnd), tone: 'par', note: GANTT.notaGutachten })
  if (a.berufserlaubnis !== 'No' && !done[7] && t.approbEnd - t.ingreso > CASI_CERO) {
    parRows.push({ name: GANTT.berufserlaubnisSueldo, start: clip(t.ingreso), end: clip(t.approbEnd), tone: 'hecho', note: GANTT.notaBerufserlaubnis })
  } else {
    parRows.push({ name: GANTT.berufserlaubnis, na: true, chip: a.berufserlaubnis === 'No' ? GANTT.descartada : GANTT.requiereFsp })
  }
  if (a.hospitacion === 'Realizada') parRows.push({ name: GANTT.hospitationen, na: true, chip: GANTT.hecho })
  else {
    const hs = clip(Math.min(t.submit, t.fspEnd))
    parRows.push({ name: GANTT.hospitationen, start: hs, end: Math.max(hs + 1, clip(t.fspEnd)), tone: 'par' })
  }
  if (!necesitaVisa) parRows.push({ name: GANTT.visa, na: true, chip: enAlemania ? GANTT.enAlemania : GANTT.resuelto })
  else parRows.push({ name: GANTT.visa, start: PLAZOS.visa[0], end: clip(PLAZOS.visa[1]), tone: 'par' })
  if (enAlemania) parRows.push({ name: GANTT.vivienda, na: true, chip: GANTT.resuelto })
  else parRows.push({ name: GANTT.vivienda, start: clip(PLAZOS.vivienda[0]), end: clip(PLAZOS.vivienda[1]), tone: 'par' })

  const seg: Tramo[] = []
  if (t.prep > 0) seg.push({ l: TRAMOS.prep, m: t.prep })
  if (e(3) > 0) seg.push({ l: TRAMOS.solicitud, m: e(3) })
  if (t.fspEnd - t.prep > 0) seg.push({ l: TRAMOS.fsp, m: t.fspEnd - t.prep })
  const espera = Math.max(0, t.kpStart - t.fspEnd)
  if (espera > CASI_CERO) seg.push({ l: TRAMOS.espera, m: espera })
  if (e(6) > 0) seg.push({ l: TRAMOS.kp, m: e(6) })
  if (t.approbEnd - Math.max(t.bescheidEnd, t.kpEnd) > 0) seg.push({ l: TRAMOS.approbation, m: t.approbEnd - Math.max(t.bescheidEnd, t.kpEnd) })
  const segTotal = seg.reduce((x, s) => x + s.m, 0) || 1

  /* Where the money comes from. Savings pay from arriving in Germany until
     the first salary. From then on the salary (the same with the
     Berufserlaubnis as with the Approbation) pays the cost of living, so it
     is no longer money the client must have before starting. */
  const conSueldo = a.berufserlaubnis !== 'No'
  type Cronologia = ReturnType<typeof calc>
  const llegadaDe = (c: Cronologia) => (enAlemania ? 0 : Math.min(a.cursoIdioma === 'En Alemania' ? PLAZOS.llegadaCursoEnAlemania : c.submit, c.fspEnd))
  const finBolsilloDe = (c: Cronologia) => (conSueldo ? c.ingreso : c.approbEnd)
  const bolsilloDe = (c: Cronologia) => Math.max(0, finBolsilloDe(c) - llegadaDe(c))
  const mesesBolsilloMin = Math.round(bolsilloDe(lo))
  const mesesBolsilloMax = Math.round(bolsilloDe(hi))
  const mesesSueldo = Math.round(Math.max(0, t.approbEnd - finBolsilloDe(t)))
  const ingresoMes = conSueldo ? t.ingreso : null

  /* The budget */
  const trasSueldo = (mes: number) => conSueldo && mes > t.ingreso
  const linea = (l: string, x: (typeof land)['fsp'], fase: FaseDinero): Partida => (x.ok
    ? { l, min: x.min, max: x.max, src: x.src, nota: x.nota, fase }
    : { l, pendiente: true, nota: x.nota, fase })

  const cursoBase = COSTOS.cursoAleman[a.nivel] || [0, 0]
  const items: Partida[] = []
  if (!docsDone) items.push({ l: PARTIDAS.traducciones, min: COSTOS.traducciones[0], max: COSTOS.traducciones[1], fase: 'capital' })
  if (!nivelB2) {
    items.push({ l: PARTIDAS.cursos, min: cursoBase[0], max: cursoBase[1], fase: 'capital' })
    items.push({ l: PARTIDAS.examenB2, min: COSTOS.examenB2[0], max: COSTOS.examenB2[1], fase: 'capital' })
  }
  if (!fspDone) {
    items.push({ l: PARTIDAS.preparacionFsp, min: COSTOS.preparacionFsp[0], max: COSTOS.preparacionFsp[1], fase: 'capital' })
    items.push(linea(PARTIDAS.tasaFsp(landNombre), land.fsp, 'capital'))
  }
  if (kpNeeded && !kpActuallyDone) {
    const it = linea(PARTIDAS.tasaKp(landNombre, kpAsumida), land.kp, trasSueldo(t.kpStart) ? 'sueldo' : 'capital')
    if (!it.pendiente && kpAsumida) it.min = 0
    items.push(it)
  }
  if (!bescheidDone) items.push({ l: PARTIDAS.peritaje(landNombre), min: land.gut[0], max: land.gut[1], estimado: true, fase: trasSueldo(t.submit) ? 'sueldo' : 'capital' })
  items.push({ l: PARTIDAS.approbation, min: COSTOS.approbation[0], max: COSTOS.approbation[1], estimado: true, fase: trasSueldo(t.approbEnd) ? 'sueldo' : 'capital' })
  if (necesitaVisa) items.push({ l: PARTIDAS.visa, min: COSTOS.visa[0], max: COSTOS.visa[1], fase: 'capital' })
  const budget: Presupuesto = {
    items, mesesBolsilloMin, mesesBolsilloMax, mesesSueldo, conSueldo, ingresoMes,
    vidaTiers: VIDA_POR_MES, necesitaVisa, sperr: SPERRKONTO, bundesland: landNombre,
  }

  /* The scores */
  const P = PUNTAJES
  const califs: Calificacion[] = []
  const nivelScore = P.nivel[a.nivel] + (['En mi país', 'En Alemania'].includes(a.cursoIdioma) ? P.bonoCurso : 0)
  califs.push({ area: AREAS.idioma.area, score: Math.min(100, nivelScore), rec: recomendacion(AREAS.idioma, nivelScore) })
  const docScore = P.documentos[a.documentos]
  califs.push({ area: AREAS.documentacion.area, score: docScore, rec: recomendacion(AREAS.documentacion, docScore) })
  const tramScore = P.tramite[a.solicitud]
  califs.push({ area: AREAS.tramite.area, score: tramScore, rec: recomendacion(AREAS.tramite, tramScore) })
  const exScore = fspDone && (kpActuallyDone || !kpNeeded) ? P.examenes.todoAprobado
    : fspDone ? P.examenes.fspAprobada
      : a.fsp === 'Fecha asignada' ? P.examenes.fechaAsignada
        : a.fsp === 'Preparando' ? P.examenes.preparando
          : P.examenes.otro
  califs.push({ area: AREAS.examenes.area, score: exScore, rec: recomendacion(AREAS.examenes, exScore) })
  const logScore = enAlemania ? P.logistica.enAlemania : visaLista ? P.logistica.visaLista
    : a.visa === 'Visa en trámite' ? P.logistica.visaEnTramite : P.logistica.otro
  califs.push({ area: AREAS.logistica.area, score: logScore, rec: recomendacion(AREAS.logistica, logScore) })
  const ritScore = P.ritmo[a.horas]
  califs.push({ area: AREAS.ritmo.area, score: ritScore, rec: recomendacion(AREAS.ritmo, ritScore) })
  const overall = Math.round(califs.reduce((x, c) => x + c.score, 0) / califs.length)

  /* What to sort out in parallel, and when */
  const paralelo: TareaParalela[] = []
  const PI = PARALELO.idioma
  if (nivelB2 || a.cursoIdioma === 'Ya lo concluí') paralelo.push({ n: PI.n, c: CUANDO.hecho, d: PI.hecho })
  else if (a.cursoIdioma === 'En mi país') paralelo.push({ n: PI.n, c: CUANDO.proximo, d: PI.enMiPais })
  else if (a.cursoIdioma === 'En Alemania') paralelo.push({ n: PI.n, c: CUANDO.proximo, d: PI.enAlemania })
  else paralelo.push({ n: PI.n, c: CUANDO.ahora, d: PI.ninguno })
  const PV = PARALELO.visa
  if (enAlemania || visaLista) paralelo.push({ n: PV.n, c: CUANDO.hecho, d: enAlemania ? PV.enAlemania : PV.lista })
  else if (a.visa === 'Visa en trámite') paralelo.push({ n: PV.n, c: CUANDO.proximo, d: PV.enTramite })
  else paralelo.push({ n: PV.n, c: CUANDO.ahora, d: PV.necesita })
  const PW = PARALELO.vivienda
  if (enAlemania) paralelo.push({ n: PW.n, c: CUANDO.hecho, d: PW.enAlemania })
  else paralelo.push({ n: PW.n, c: necesitaVisa ? CUANDO.proximo : CUANDO.ahora, d: PW.otro })
  const PH = PARALELO.hospitationen
  if (a.hospitacion === 'Realizada') paralelo.push({ n: PH.n, c: CUANDO.hecho, d: PH.realizada })
  else if (['En curso', 'Planificada'].includes(a.hospitacion)) paralelo.push({ n: PH.n, c: CUANDO.proximo, d: PH.enCurso })
  else {
    const listo = ['B1', 'B2', 'C1', 'FSP aprobado'].includes(a.nivel)
    if (listo && !necesitaVisa) paralelo.push({ n: PH.n, c: CUANDO.ahora, d: PH.ahora })
    else paralelo.push({ n: PH.n, c: CUANDO.masAdelante, d: PH.despues })
  }

  /* Priorities now */
  const R = PRIORIDADES
  const prio: Prioridad[] = []
  if (!done[1]) prio.push(R.documentacion)
  if (!nivelB2 && !done[2]) prio.push(R.aleman)
  if (necesitaVisa) prio.push(R.visa)
  if (done[1] && done[2] && !done[3]) prio.push({ t: R.solicitud.t, d: R.solicitud.d(landNombre) })
  if (nivelB2 && !fspDone) prio.push(R.fsp)
  if (done[3] && !done[4]) prio.push({ t: R.gutachten.t, d: R.gutachten.d(landNombre) })
  const listoHosp = ['B1', 'B2', 'C1', 'FSP aprobado'].includes(a.nivel)
  if (listoHosp && !necesitaVisa && !['En curso', 'Realizada'].includes(a.hospitacion)) prio.push(R.hospitationen)
  if (done[4] && kpNeeded && !kpActuallyDone) prio.push(R.kp)
  if (a.berufserlaubnis !== 'No' && fspDone && !done[7]) prio.push(R.berufserlaubnis)

  const alertaB2 = a.documentos === 'Completo y verificado' && !nivelB2

  return {
    rem, done, actual, totalMin, totalMax, prio: prio.slice(0, 4), paralelo, alertaB2,
    axisMax, mainRows, parRows, seg, segTotal, kpNeeded, kpAsumida, budget, califs, overall,
    landRev: land.rev, ingresoMes, ingresoMin: conSueldo ? Math.round(lo.ingreso) : null,
    ingresoMax: conSueldo ? Math.round(hi.ingreso) : null, conSueldo,
  }
}

/* ===========================================================================
   The report's pieces, as the original draws them
   =========================================================================== */

export type TonoScore = 'bien' | 'atencion' | 'critico'

/** A score's band: 75+ "Bien", 45+ "Atención", below "Crítico" */
export function tonoScore(s: number): TonoScore {
  return s >= PUNTAJES.bien ? 'bien' : s >= PUNTAJES.atencion ? 'atencion' : 'critico'
}

/** A score's word */
export function textoScore(s: number): string {
  return { bien: TEXTOS.bien, atencion: TEXTOS.atencion, critico: TEXTOS.critico }[tonoScore(s)]
}

/** The header: the name, "país · perfil", and the four figures */
export interface Cabecera {
  nombre: string
  sub: string
  metricas: { k: string; v: string; hl: boolean }[]
  land: string
  pie: string
}

export function cabecera(a: Respuestas, r: Analisis, hoy: Date): Cabecera {
  const fase = FASES.find((f) => f.n === r.actual)
  return {
    nombre: a.nombre || TEXTOS.sinNombre,
    sub: [a.pais, a.perfil].filter(Boolean).join(' · '),
    metricas: [
      { k: TEXTOS.faseActual, v: r.actual + '. ' + fase?.nombre, hl: false },
      { k: TEXTOS.tiempoRestante, v: TEXTOS.meses(r.totalMin, r.totalMax), hl: false },
      {
        k: TEXTOS.primerSueldo,
        v: r.conSueldo && r.ingresoMin !== null && r.ingresoMax !== null
          ? sumarMeses(hoy, r.ingresoMin) + ' – ' + sumarMeses(hoy, r.ingresoMax)
          : TEXTOS.sinBerufserlaubnis,
        hl: r.conSueldo,
      },
      { k: TEXTOS.approbationAprox, v: sumarMeses(hoy, r.totalMin) + ' – ' + sumarMeses(hoy, r.totalMax), hl: false },
    ],
    land: nombreLand(a.bundesland),
    pie: TEXTOS.bescheidRango(r.landRev[0], r.landRev[1]),
  }
}

/** The month numbers over the timeline */
export function ticksEje(axisMax: number): number[] {
  const step = axisMax <= 6 ? 1 : axisMax <= 12 ? 2 : axisMax <= 24 ? 3 : 4
  const ticks: number[] = []
  for (let m = 0; m <= axisMax; m += step) ticks.push(m)
  if (ticks[ticks.length - 1] !== axisMax) ticks.push(axisMax)
  return ticks
}

/** What a timeline row shows inside its track */
export type DentroFila =
  | { tipo: 'hecho' }
  | { tipo: 'chip'; texto: string }
  | { tipo: 'barra'; tono: 'fase' | 'ahora' | 'par' | 'hecho'; left: number; width: number }

/** A timeline row's contents: "✓ hecho", a word, or a bar (left and width
    in % of the track; at least 3%, as in the original) */
export function dentroFila(row: FilaGantt, axisMax: number): DentroFila {
  if (row.done) return { tipo: 'hecho' }
  if (row.na) return { tipo: 'chip', texto: row.chip ?? '' }
  const start = row.start ?? 0, end = row.end ?? 0
  return {
    tipo: 'barra',
    tono: row.current ? 'ahora' : (row.tone || 'fase'),
    left: (start / axisMax) * 100,
    width: Math.max(((end - start) / axisMax) * 100, 3),
  }
}

/** "¿De dónde sale ese tiempo?": each stretch's text and its share in % */
export function tramos(r: Analisis): { texto: string; pct: number }[] {
  return r.seg.map((s) => ({ texto: TEXTOS.tramo(s.l, Math.round(s.m)), pct: (s.m / r.segTotal) * 100 }))
}

/** "Detalle de las fases": a phase's status word */
export function estadoFase(n: number, r: Analisis): string {
  const naKP = n === 6 && !r.kpNeeded
  return naKP ? TEXTOS.estadoNoAplica : r.done[n] ? TEXTOS.estadoCompletado : n === r.actual ? TEXTOS.estadoEnCurso : TEXTOS.estadoPendiente
}

/** "01" … "07" */
export const numeroFase = (n: number): string => String(n).padStart(2, '0')

/* ---------- "Meses sin sueldo", typed by hand ---------- */

/** What was typed → the months to use: null (use the calculation) when it
    isn't a number, otherwise kept between 0 and 99 */
export function mesesDesdeTexto(v: string): number | null {
  const n = parseInt(v, 10)
  return isNaN(n) ? null : Math.max(MESES_MANUAL_LIMITES[0], Math.min(MESES_MANUAL_LIMITES[1], n))
}

/** "−" / "+": one month less or more than what is shown */
export function pasoMeses(d: number, calcMedio: number, manual: number | null): number | null {
  const base = manual === null ? calcMedio : manual
  return mesesDesdeTexto(String(base + d))
}

/* ---------- "Mi presupuesto estimado" ---------- */

export interface FilaPresupuesto {
  l: string
  estimado: boolean
  pendiente: boolean
  /** "300 € – 800 €" or "a confirmar" */
  valor: string
}

export interface Nota {
  /** The bold start, with its colon */
  b: string
  t: string
}

export interface VistaPresupuesto {
  manual: boolean
  /** The months the calculation gives, in the middle of its range */
  calcMedio: number
  /** The number in the "Meses sin sueldo" field */
  valorMeses: number
  /** "volver al cálculo (4–9)" (manual) or "calculado: 4–9 · …" */
  textoMeses: string
  capital: FilaPresupuesto[]
  vida: { l: string; valor: string }
  total: { sinPendientes: boolean; valor: string }
  /** The salary box (null: no Berufserlaubnis, the grey box instead) */
  sueldo: { titulo: string; texto: string; filas: FilaPresupuesto[] } | null
  /** The box of fees "a confirmar" (null: none) */
  pendientes: { titulo: string; items: Nota[] } | null
  notas: Nota[]
}

function filaPresupuesto(i: Partida): FilaPresupuesto {
  return {
    l: i.l,
    estimado: !i.pendiente && i.estimado === true,
    pendiente: i.pendiente === true,
    valor: i.pendiente ? TEXTOS.aConfirmar : rango(i.min, i.max),
  }
}

/** The original's budget block: the lines paid from savings, the cost of
    living (by city size and months without salary; months typed by hand
    win), the total without the fees "a confirmar", the salary box, the
    box of missing fees and the notes. */
export function presupuesto(b: Presupuesto, tier: Tier, mesesManual: number | null): VistaPresupuesto {
  const vida = b.vidaTiers[tier]
  /* Months typed by hand win, and the range becomes one number */
  const manual = mesesManual !== null
  const mMin = mesesManual !== null ? mesesManual : b.mesesBolsilloMin
  const mMax = mesesManual !== null ? mesesManual : b.mesesBolsilloMax
  const calcMedio = Math.round((b.mesesBolsilloMin + b.mesesBolsilloMax) / 2)
  const vidaMin = vida[0] * mMin, vidaMax = vida[1] * mMax
  const cap = b.items.filter((i) => i.fase !== 'sueldo')
  const post = b.items.filter((i) => i.fase === 'sueldo')
  let tasasMin = 0, tasasMax = 0
  for (const i of cap) {
    if (i.pendiente) continue
    tasasMin += i.min
    tasasMax += i.max
  }
  const pendientes = b.items.filter((i) => i.pendiente)
  const conNota = b.items.filter((i) => i.nota)

  const meses = mMin === mMax ? mMin + (mMin === 1 ? TEXTOS.mes : TEXTOS.mesesPalabra) : mMin + '–' + mMax + TEXTOS.mesesPalabra

  const notas: Nota[] = []
  if (b.necesitaVisa) notas.push(TEXTOS.notaSperrkonto)
  notas.push(TEXTOS.notaSueldo)
  for (const i of conNota) if (!i.pendiente) notas.push({ b: i.l + ':', t: i.nota ?? '' })
  notas.push(TEXTOS.notaTasas)

  return {
    manual,
    calcMedio,
    valorMeses: mesesManual !== null ? mesesManual : calcMedio,
    textoMeses: manual
      ? TEXTOS.volverAlCalculo(b.mesesBolsilloMin, b.mesesBolsilloMax)
      : TEXTOS.calculado(b.mesesBolsilloMin, b.mesesBolsilloMax),
    capital: cap.map(filaPresupuesto),
    vida: {
      l: TEXTOS.costoDeVida(meses, eur(vida[0]), eur(vida[1])),
      valor: eur(vidaMin) + ' – ' + eur(vidaMax),
    },
    total: { sinPendientes: pendientes.length > 0, valor: eur(tasasMin + vidaMin) + ' – ' + eur(tasasMax + vidaMax) },
    sueldo: b.conSueldo
      ? {
        titulo: TEXTOS.sueldoTitulo(Math.round(b.ingresoMes ?? 0)),
        texto: TEXTOS.sueldoTexto(b.mesesSueldo),
        filas: post.map(filaPresupuesto),
      }
      : null,
    pendientes: pendientes.length
      ? { titulo: TEXTOS.pendientesTitulo(pendientes.length, b.bundesland), items: pendientes.map((i) => ({ b: i.l + ':', t: i.nota ?? '' })) }
      : null,
    notas,
  }
}
