/* The CV and cover letter tool (/curriculum, src/pages/Curriculum.tsx):
   the period types, the gap check, the text the client copies and sends,
   and saving the draft on this device.

   Ported line for line from the owner's original tool
   (design-reference/curriculum-original.html, its <script>). The produced
   text must keep EXACTLY the original's format (headers, line order,
   labels), because the owner's Claude reads it: change nothing in
   cvText() without asking Ivan. Tested by tests/curriculum.test.ts.

   Nothing here talks to the database or any server. The draft lives only
   in this browser's storage (localStorage), under a key with the user's
   ID, so another account on the same device starts empty.

   No React and no DOM in this file (only localStorage in the last two
   functions), so the tests can run it with plain Node.js. */

/** The 17 kinds of period: [saved code, label shown and written in the
    text]. Same codes, labels and order as the original. */
export const TIPOS: ReadonlyArray<readonly [string, string]> = [
  ['colegio', 'Colegio / bachillerato'],
  ['medicina', 'Estudios de medicina'],
  ['otrosestudios', 'Otros estudios universitarios'],
  ['internado', 'Año práctico / internado / rural'],
  ['especialidad', 'Especialidad o residencia'],
  ['medico', 'Trabajo como médico'],
  ['otrotrabajo', 'Otro trabajo (no médico)'],
  ['idiomas', 'Curso de idiomas'],
  ['formacion', 'Otro curso o formación'],
  ['desempleo', 'Sin empleo / buscando trabajo'],
  ['crianza', 'Maternidad, paternidad o crianza'],
  ['enfermedad', 'Enfermedad o recuperación'],
  ['cuidado', 'Cuidado de un familiar'],
  ['militar', 'Servicio militar o social'],
  ['viaje', 'Viaje o estancia en el extranjero'],
  ['voluntario', 'Voluntariado'],
  ['otro', 'Otro (lo explico abajo)'],
]

/** Paso 1's fields, in order (saved as d.nombre, d.nac…) */
export const DATO_KEYS = ['nombre', 'nac', 'lugar', 'nacion', 'dir', 'mail', 'tel'] as const
export type DatoKey = (typeof DATO_KEYS)[number]

/** Paso 3's six answers (saved as c.c1 … c.c6) */
export const CARTA_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const
export type CartaKey = (typeof CARTA_KEYS)[number]

/** One period of Paso 2. Dates are "YYYY-MM" (what a month field gives),
    or '' when empty. */
export interface CvPeriod {
  desde: string
  hasta: string
  tipo: string
  titulo: string
  donde: string
  ciudad: string
  detalle: string
}

/** Everything the client writes: same shape as the original's saved value */
export interface CvData {
  d: Partial<Record<DatoKey, string>>
  per: CvPeriod[]
  c: Partial<Record<CartaKey, string>>
}

export function emptyCv(): CvData {
  return { d: {}, per: [], c: {} }
}

/** A new period, as "Añadir un periodo" makes it */
export function newPeriod(): CvPeriod {
  return { desde: '', hasta: '', tipo: 'medicina', titulo: '', donde: '', ciudad: '', detalle: '' }
}

/* ── Dates ──────────────────────────────────────────────────────────
   A month is counted as one number: year × 12 + (month − 1). */

/** "2019-03" → 24231; null when empty or not a month */
export function aNum(ym: string): number | null {
  if (!ym) return null
  const p = ym.split('-')
  const a = parseInt(p[0], 10)
  const m = parseInt(p[1], 10)
  if (!a || !m) return null
  return a * 12 + (m - 1)
}

/** 24231 → "03/2019" */
export function deNum(n: number): string {
  const a = Math.floor(n / 12)
  const m = (n % 12) + 1
  return (m < 10 ? '0' : '') + m + '/' + a
}

/** This month, on this device's clock */
export function hoyNum(now: Date = new Date()): number {
  return now.getFullYear() * 12 + now.getMonth()
}

/** "1 mes", "3 meses" */
export function meses(n: number): string {
  return n === 1 ? '1 mes' : n + ' meses'
}

/* ── The gap check ─────────────────────────────────────────────── */

export type GapCheck =
  | { vacio: true; sinFecha: number }
  | {
      vacio: false
      /** periods without a start date (not checked) */
      sinFecha: number
      /** the first month of the earliest period */
      ini: number
      /** this month */
      hoy: number
      /** the months nobody explained, as [first, last] runs, oldest first */
      huecos: Array<[number, number]>
      /** one entry per month from ini to hoy: true when covered */
      tramos: boolean[]
    }

/** Which months from the earliest period up to this month are covered.
    An empty "Hasta" runs up to this month; a period whose dates are the
    wrong way round is turned round; months after this one don't count. */
export function analiza(per: readonly CvPeriod[], hoy: number): GapCheck {
  const val: Array<[number, number]> = []
  let sinFecha = 0
  for (const p of per) {
    let a = aNum(p.desde)
    if (a === null) { sinFecha++; continue }
    let b = p.hasta ? aNum(p.hasta) : hoy
    if (b === null) b = hoy
    if (b < a) { const t = a; a = b; b = t }
    val.push([a, Math.min(b, hoy)])
  }
  if (!val.length) return { vacio: true, sinFecha }

  val.sort((x, y) => x[0] - y[0])
  const ini = val[0][0]
  const cubierto = new Set<number>()
  for (const r of val) for (let m = r[0]; m <= r[1]; m++) cubierto.add(m)

  const huecos: Array<[number, number]> = []
  let run: [number, number] | null = null
  for (let m = ini; m <= hoy; m++) {
    if (cubierto.has(m)) { if (run) { huecos.push(run); run = null } }
    else if (!run) run = [m, m]
    else run[1] = m
  }
  if (run) huecos.push(run)

  const tramos: boolean[] = []
  for (let k = ini; k <= hoy; k++) tramos.push(cubierto.has(k))

  return { vacio: false, sinFecha, ini, hoy, huecos, tramos }
}

/* ── The text to copy and send ─────────────────────────────────── */

/** A period type's label; an unknown code is written as it is */
export function nombreTipo(t: string): string {
  for (const [code, label] of TIPOS) if (code === t) return label
  return t || 'Sin especificar'
}

/** The owner's six cover-letter questions, as they are written in the text */
const PREGUNTAS = [
  'Por que estudie medicina', 'Por que Alemania', 'Que especialidad y por que',
  'Que se hacer con las manos', 'Que busco en el puesto y que aporto',
  'Desde cuando puedo empezar y mi nivel de aleman',
]

/** The text the client copies and sends to the MNL team. EXACTLY the
    original's format: the owner's Claude reads it. */
export function cvText(estado: CvData, hoy: number): string {
  const r = analiza(estado.per, hoy)
  const L: string[] = []
  L.push('=== DATOS PARA MI CURRICULUM ALEMAN ===')
  L.push('Nombre completo: ' + (estado.d.nombre || ''))
  L.push('Fecha de nacimiento: ' + (estado.d.nac || ''))
  L.push('Lugar y pais de nacimiento: ' + (estado.d.lugar || ''))
  L.push('Nacionalidad: ' + (estado.d.nacion || ''))
  L.push('Direccion actual: ' + (estado.d.dir || ''))
  L.push('Correo: ' + (estado.d.mail || ''))
  L.push('Telefono: ' + (estado.d.tel || ''))
  L.push('')
  L.push('=== MIS PERIODOS, DEL MAS ANTIGUO AL MAS RECIENTE ===')
  /* oldest first; periods without a start date at the end (the
     original's comparison, kept as it is) */
  const orden = estado.per.slice().sort((x, y) => {
    const a = aNum(x.desde)
    const b = aNum(y.desde)
    if (a === null) return 1
    if (b === null) return -1
    return a - b
  })
  if (!orden.length) L.push('(ninguno)')
  orden.forEach((p, i) => {
    /* `?? 0`: the original wrote a date that isn't a month as "01/0" */
    const d = p.desde ? deNum(aNum(p.desde) ?? 0) : '??'
    const h = p.hasta ? deNum(aNum(p.hasta) ?? 0) : 'actualidad'
    L.push((i + 1) + ') ' + d + ' - ' + h + ' | ' + nombreTipo(p.tipo))
    L.push('   Titulo o puesto: ' + (p.titulo || '-'))
    L.push('   Donde: ' + (p.donde || '-'))
    L.push('   Ciudad y pais: ' + (p.ciudad || '-'))
    if (p.detalle) L.push('   Detalle: ' + p.detalle)
  })
  L.push('')
  L.push('=== CONTROL DE HUECOS ===')
  if (r.vacio) L.push('Sin periodos cargados.')
  else if (r.huecos.length) {
    L.push('ATENCION: quedan meses sin explicar.')
    for (const g of r.huecos) {
      const n = g[1] - g[0] + 1
      L.push('  - ' + deNum(g[0]) + (n > 1 ? ' a ' + deNum(g[1]) : '') + ' (' + meses(n) + ')')
    }
  } else L.push('Sin huecos. Cubre desde ' + deNum(r.ini) + ' hasta hoy.')
  L.push('')
  L.push('=== PARA MI CARTA DE PRESENTACION ===')
  PREGUNTAS.forEach((q, i) => {
    L.push((i + 1) + '. ' + q + ':')
    L.push((estado.c[CARTA_KEYS[i]] || '(sin contestar)').trim())
    L.push('')
  })
  return L.join('\n')
}

/* ── Saving on this device ─────────────────────────────────────── */

/** The browser storage key: one draft per account on this device */
export function storageKey(userId: string): string {
  return 'mnl-cv-v1:' + userId
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Reads a saved draft. Anything that isn't text is left out, so a broken
    or old saved value can't break the page. */
export function parseCv(raw: string | null): CvData {
  const out = emptyCv()
  if (!raw) return out
  let s: unknown
  try { s = JSON.parse(raw) } catch { return out }
  if (!s || typeof s !== 'object') return out
  const o = s as { d?: unknown; per?: unknown; c?: unknown }
  if (o.d && typeof o.d === 'object') {
    for (const k of DATO_KEYS) out.d[k] = str((o.d as Record<string, unknown>)[k])
  }
  if (o.c && typeof o.c === 'object') {
    for (const k of CARTA_KEYS) out.c[k] = str((o.c as Record<string, unknown>)[k])
  }
  if (Array.isArray(o.per)) {
    for (const p of o.per) {
      if (!p || typeof p !== 'object') continue
      const q = p as Record<string, unknown>
      out.per.push({
        desde: str(q.desde), hasta: str(q.hasta), tipo: str(q.tipo), titulo: str(q.titulo),
        donde: str(q.donde), ciudad: str(q.ciudad), detalle: str(q.detalle),
      })
    }
  }
  return out
}

/** The saved draft of this account, or an empty one */
export function loadCv(userId: string): CvData {
  try {
    return parseCv(localStorage.getItem(storageKey(userId)))
  } catch {
    return emptyCv() // storage blocked (e.g. private mode)
  }
}

/** Saves the draft; false when the browser refused */
export function saveCv(userId: string, data: CvData): boolean {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

/** "Borrar todo y empezar de nuevo" */
export function removeCv(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {
    /* storage blocked: nothing saved anyway */
  }
}
