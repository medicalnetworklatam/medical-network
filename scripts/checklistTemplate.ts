/* Turns one of the owner's checklist templates (JSON) into SQL that Ivan
   pastes into Supabase's SQL Editor. Used by scripts/checklist-to-sql.ts
   (npm run checklist-sql) and tested by tests/checklistTemplate.test.ts.

   The file name says which Bundesland and route the template is for:
   "<state>-<route>.json", e.g. "bw-medico_drittstaat.json".

   What happens:
   1. checkTemplate() validates the JSON and lists every problem it finds.
      Nothing is written when there is any problem.
   2. It cleans the texts: inline {nota_personal} markers are removed (the
      site shows personal notes in their own box), and the cards that
      describe the owner's old device-only file are left out.
      {pais} and {genero:x|y} stay; the website fills them in.
   3. toSql() writes one transaction that can be run again safely:
      existing steps are updated in place (ticks stay), new steps are added,
      and steps of this state + route that came from a template but are
      missing now get archived = true. Nothing is ever deleted.

   Safe SQL: every value goes into the SQL as a quoted text literal
   (sqlText below), numbers only after checking they are whole numbers, and
   the state and route only after checking them against fixed lists. No
   JSON key or name is ever used as SQL itself. */

/** The 16 Bundesland codes (the same list as public.state_code, migration 1) */
export const STATES = [
  'bw', 'by', 'be', 'bb', 'hb', 'hh', 'he', 'mv',
  'ni', 'nw', 'rp', 'sl', 'sn', 'st', 'sh', 'th',
] as const

/** The four permanent route codes (migration 7) */
export const ROUTES = ['medico_drittstaat', 'medico_ue', 'dentista_drittstaat', 'dentista_ue'] as const

/** The owner's step codes: lowercase letters and digits, single "_" between them */
export const STEP_CODE = /^[a-z0-9]+(_[a-z0-9]+)*$/

/** The fields every step must have, and nothing else */
const STEP_FIELDS = [
  'codigo', 'bloque', 'numero_oficial', 'titulo', 'descripcion', 'donde', 'plazo',
  'aviso', 'caduca', 'no_aplica_estado', 'motivo_no_aplica',
] as const

export type Target = { state: string; route: string; fileName: string }

export type ItemRow = {
  code: string
  sourceCode: string
  block: number
  sortOrder: number
  officialNumber: string
  sobreOrder: number | null
  title: string
  body: string
  donde: string
  plazo: string
  aviso: string | null
  caduca: string | null
  naDefault: boolean
  naReason: string | null
}

export type TemplateRow = {
  title: string
  rulesLabel: string | null
  generatedOn: string | null
  cover: unknown
  blocks: { bloque: number; titulo: string; subtitulo: string }[]
  cards: Record<string, unknown>
}

export type ImportPlan = { target: Target; template: TemplateRow; items: ItemRow[] }

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

function isObject(v: unknown): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/* ---------- File name → state and route ---------- */

/** "bw-medico_drittstaat.json" → { state: 'bw', route: 'medico_drittstaat' } */
export function targetFromFileName(fileName: string): Target | string {
  const m = /^([a-z]{2})-([a-z0-9]+(?:_[a-z0-9]+)*)\.json$/.exec(fileName)
  if (!m) return `The file name "${fileName}" must be "<state>-<route>.json", e.g. "bw-medico_drittstaat.json".`
  const [, state, route] = m
  if (!(STATES as readonly string[]).includes(state)) {
    return `"${state}" in the file name is not one of the 16 Bundesland codes (${STATES.join(', ')}).`
  }
  if (!(ROUTES as readonly string[]).includes(route)) {
    return `"${route}" in the file name is not one of the four routes (${ROUTES.join(', ')}).`
  }
  return { state, route, fileName }
}

/* ---------- Placeholders ---------- */

/** Which placeholders a text may contain, by where it is */
type Place = 'cover' | 'step' | 'other'

const SIMPLE = new Set(['pais', 'nota_personal', 'nombre', 'perfil'])

/** Every problem with the placeholders in one text ([] = fine).
    Allowed: {pais} and {genero:x|y} everywhere; {nota_personal} only in
    steps; {nombre} and {perfil} only on the cover. Any other "{" or "}"
    is a problem. */
export function placeholderProblems(text: string, place: Place): string[] {
  const problems: string[] = []
  const rest = text.replace(/\{([^{}]*)\}/g, (whole, inner: string) => {
    if (inner.startsWith('genero:')) {
      if (!/^genero:[^{}|]+\|[^{}|]+$/.test(inner)) problems.push(`"${whole}" must be {genero:masculine|feminine}`)
    } else if (!SIMPLE.has(inner)) {
      problems.push(`unknown placeholder "${whole}"`)
    } else if (inner === 'nota_personal' && place !== 'step') {
      problems.push('{nota_personal} is only allowed in steps')
    } else if ((inner === 'nombre' || inner === 'perfil') && place !== 'cover') {
      problems.push(`${whole} is only allowed on the cover (portada)`)
    }
    return ''
  })
  if (/[{}]/.test(rest)) problems.push('a "{" or "}" that is not part of a placeholder')
  return problems
}

/** Characters the database can't store, or that have no place in a text */
function badCharacters(text: string): boolean {
  // Matching control characters is the point here (tabs and line breaks are allowed)
  // oxlint-disable-next-line no-control-regex
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)
}

/* ---------- {nota_personal} ---------- */

/** Removes the inline {nota_personal} markers: " ({nota_personal})" inside a
    sentence disappears, and a text that is only "{nota_personal}" becomes
    null. Returns a string with the problem if a marker is left anywhere else. */
export function removeNotaPersonal(text: string): { text: string | null } | { problem: string } {
  if (text.trim() === '{nota_personal}') return { text: null }
  const cleaned = text.split(' ({nota_personal})').join('')
  if (cleaned.includes('{nota_personal}')) {
    return { problem: '{nota_personal} may only appear as " ({nota_personal})" inside a sentence, or as the whole text' }
  }
  return { text: cleaned.trim() === '' ? null : cleaned }
}

/* ---------- The envelope (tarjetas.sobre.orden) ---------- */

/** "A · Antrag" → "Antrag", "12 (puede ir después)" → "12", "4 (si aplica)" → "4" */
export function sobreNumber(entry: string): string {
  const noNote = entry.replace(/\s*\([^)]*\)\s*$/, '')
  const parts = noNote.split(' · ')
  return parts[parts.length - 1].trim()
}

/* ---------- Cards ---------- */

/** The cards as the site stores them:
    - "aviso_guardado" is left out (it describes the old device-only file)
    - "mis_dudas" keeps only titulo, ayuda and marcador_vacio (boton and
      explicacion are about sending it by WhatsApp)
    - "autoridad_y_costos.filas" becomes a list of { etiqueta, valor }, in
      the JSON's order (the database's jsonb type doesn't keep key order) */
export function cleanCards(cards: Record<string, Json>): Record<string, Json> {
  const out: Record<string, Json> = {}
  for (const [key, value] of Object.entries(cards)) {
    if (key === 'aviso_guardado') continue
    if (key === 'mis_dudas' && isObject(value)) {
      const kept: Record<string, Json> = {}
      for (const k of ['titulo', 'ayuda', 'marcador_vacio']) if (k in value) kept[k] = value[k]
      out[key] = kept
      continue
    }
    if (key === 'autoridad_y_costos' && isObject(value) && isObject(value.filas)) {
      out[key] = {
        ...value,
        filas: Object.entries(value.filas).map(([etiqueta, valor]) => ({ etiqueta, valor })),
      }
      continue
    }
    out[key] = value
  }
  return out
}

/* ---------- Validation ---------- */

/** Walks every text inside a value. Only texts, lists, objects and null
    are allowed in the cover, the cards and the blocks' texts. */
function eachText(value: Json, where: string, visit: (text: string, where: string) => void, problems: string[]): void {
  if (typeof value === 'string') visit(value, where)
  else if (Array.isArray(value)) value.forEach((v, i) => eachText(v, `${where}[${i}]`, visit, problems))
  else if (isObject(value)) for (const [k, v] of Object.entries(value)) eachText(v, `${where}.${k}`, visit, problems)
  else if (value !== null) problems.push(`${where}: only texts are allowed here, not ${JSON.stringify(value)}`)
}

function checkText(text: string, where: string, place: Place, problems: string[]): void {
  if (badCharacters(text)) problems.push(`${where}: contains a control character`)
  for (const p of placeholderProblems(text, place)) problems.push(`${where}: ${p}`)
}

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Checks the whole template and builds what goes into the database.
    Returns every problem found; the plan only when there are none. */
export function checkTemplate(data: unknown, fileName: string): { plan: ImportPlan | null; problems: string[] } {
  const problems: string[] = []
  const target = targetFromFileName(fileName)
  if (typeof target === 'string') problems.push(target)
  if (!isObject(data)) {
    problems.push('The file must contain one JSON object.')
    return { plan: null, problems }
  }
  for (const key of ['meta', 'portada', 'bloques', 'pasos', 'tarjetas']) {
    if (!(key in data)) problems.push(`The top-level field "${key}" is missing.`)
  }
  for (const key of Object.keys(data)) {
    if (!['meta', 'portada', 'bloques', 'pasos', 'tarjetas'].includes(key)) problems.push(`Unknown top-level field "${key}".`)
  }

  /* meta: only what the site keeps (the owner's generator rules stay with him) */
  const meta = data.meta
  let title = ''
  let rulesLabel: string | null = null
  let generatedOn: string | null = null
  if (!isObject(meta)) problems.push('meta must be an object.')
  else {
    if (typeof meta.plantilla !== 'string' || meta.plantilla.trim() === '' || meta.plantilla.length > 300) {
      problems.push('meta.plantilla must be a text of 1 to 300 characters (the template\'s name).')
    } else {
      title = meta.plantilla
      checkText(title, 'meta.plantilla', 'other', problems)
    }
    if (meta.reglas != null) {
      if (typeof meta.reglas !== 'string' || meta.reglas.trim() === '' || meta.reglas.length > 200) {
        problems.push('meta.reglas must be a text of 1 to 200 characters, or left out.')
      } else {
        rulesLabel = meta.reglas
        checkText(rulesLabel, 'meta.reglas', 'other', problems)
      }
    }
    if (meta.generada != null) {
      if (typeof meta.generada !== 'string' || !isRealDate(meta.generada)) {
        problems.push('meta.generada must be a date written YYYY-MM-DD, or left out.')
      } else generatedOn = meta.generada
    }
  }

  /* portada (the cover) */
  const cover = data.portada
  if (!isObject(cover)) problems.push('portada must be an object.')
  else eachText(cover, 'portada', (t, w) => checkText(t, w, 'cover', problems), problems)

  /* bloques: exactly 1 to 5, once each */
  const blocks: TemplateRow['blocks'] = []
  if (!Array.isArray(data.bloques)) problems.push('bloques must be a list.')
  else {
    data.bloques.forEach((b, i) => {
      const where = `bloques[${i}]`
      if (!isObject(b)) { problems.push(`${where} must be an object.`); return }
      for (const k of Object.keys(b)) {
        if (!['bloque', 'titulo', 'subtitulo'].includes(k)) problems.push(`${where}: unknown field "${k}".`)
      }
      if (typeof b.bloque !== 'number' || !Number.isInteger(b.bloque) || b.bloque < 1 || b.bloque > 5) {
        problems.push(`${where}.bloque must be a whole number from 1 to 5.`)
        return
      }
      if (typeof b.titulo !== 'string' || b.titulo.trim() === '') problems.push(`${where}.titulo must be a text.`)
      if (typeof b.subtitulo !== 'string') problems.push(`${where}.subtitulo must be a text.`)
      if (typeof b.titulo === 'string') checkText(b.titulo, `${where}.titulo`, 'other', problems)
      if (typeof b.subtitulo === 'string') checkText(b.subtitulo, `${where}.subtitulo`, 'other', problems)
      if (blocks.some((x) => x.bloque === b.bloque)) problems.push(`Block ${b.bloque} appears twice in bloques.`)
      else blocks.push({ bloque: b.bloque, titulo: String(b.titulo), subtitulo: String(b.subtitulo) })
    })
    for (let n = 1; n <= 5; n++) {
      if (!blocks.some((x) => x.bloque === n)) problems.push(`Block ${n} is missing from bloques.`)
    }
    blocks.sort((x, y) => x.bloque - y.bloque)
  }

  /* pasos (the steps) */
  const items: ItemRow[] = []
  const seen = new Set<string>()
  if (!Array.isArray(data.pasos) || data.pasos.length === 0) problems.push('pasos must be a list with at least one step.')
  else {
    data.pasos.forEach((p, i) => {
      if (!isObject(p)) { problems.push(`pasos[${i}] must be an object.`); return }
      const code = typeof p.codigo === 'string' ? p.codigo : ''
      const where = code ? `Step "${code}"` : `pasos[${i}]`
      const before = problems.length

      for (const k of Object.keys(p)) {
        if (!(STEP_FIELDS as readonly string[]).includes(k)) problems.push(`${where}: unknown field "${k}".`)
      }
      for (const k of STEP_FIELDS) if (!(k in p)) problems.push(`${where}: the field "${k}" is missing.`)

      if (!STEP_CODE.test(code)) problems.push(`${where}: codigo must use only a-z, 0-9 and single "_" (e.g. "bw8", "bw_via").`)
      else if (seen.has(code)) problems.push(`${where}: the code appears more than once.`)
      else seen.add(code)

      if (typeof p.bloque !== 'number' || !Number.isInteger(p.bloque) || p.bloque < 1 || p.bloque > 5) {
        problems.push(`${where}: bloque must be a whole number from 1 to 5.`)
      }
      if (typeof p.numero_oficial !== 'string' || p.numero_oficial.trim() === '' || p.numero_oficial.length > 50) {
        problems.push(`${where}: numero_oficial must be a text of 1 to 50 characters (e.g. "6", "pág. 4", "—").`)
      }
      for (const k of ['titulo', 'descripcion', 'donde', 'plazo'] as const) {
        if (typeof p[k] !== 'string' || (p[k] as string).trim() === '') problems.push(`${where}: ${k} must be a text.`)
      }
      for (const k of ['aviso', 'caduca', 'motivo_no_aplica'] as const) {
        if (p[k] !== null && (typeof p[k] !== 'string' || (p[k] as string).trim() === '')) {
          problems.push(`${where}: ${k} must be a text or null.`)
        }
      }
      if (typeof p.no_aplica_estado !== 'boolean') problems.push(`${where}: no_aplica_estado must be true or false.`)
      else if (p.no_aplica_estado && typeof p.motivo_no_aplica !== 'string') {
        problems.push(`${where}: a "no aplica" step needs motivo_no_aplica (the reason).`)
      }

      // Texts: placeholders, then the {nota_personal} clean-up
      const texts: Record<string, string | null> = {}
      for (const k of ['titulo', 'descripcion', 'donde', 'plazo', 'aviso', 'caduca', 'motivo_no_aplica', 'numero_oficial'] as const) {
        const v = p[k]
        if (typeof v !== 'string') { texts[k] = null; continue }
        checkText(v, `${where}.${k}`, 'step', problems)
        const r = removeNotaPersonal(v)
        if ('problem' in r) { problems.push(`${where}.${k}: ${r.problem}`); continue }
        texts[k] = r.text
      }
      for (const k of ['titulo', 'descripcion', 'donde', 'plazo', 'numero_oficial'] as const) {
        if (typeof p[k] === 'string' && texts[k] === null) problems.push(`${where}.${k}: can't be only {nota_personal}.`)
      }

      if (problems.length > before || !target || typeof target === 'string') return
      items.push({
        code: `${target.state}-${target.route}-${code}`,
        sourceCode: code,
        block: p.bloque as number,
        sortOrder: i + 1,
        officialNumber: texts.numero_oficial as string,
        sobreOrder: null,
        title: texts.titulo as string,
        body: texts.descripcion as string,
        donde: texts.donde as string,
        plazo: texts.plazo as string,
        aviso: texts.aviso,
        caduca: texts.caduca,
        naDefault: p.no_aplica_estado as boolean,
        naReason: texts.motivo_no_aplica,
      })
    })
  }

  /* tarjetas (the info cards) */
  let cards: Record<string, Json> = {}
  const rawCards = data.tarjetas
  if (!isObject(rawCards)) problems.push('tarjetas must be an object.')
  else {
    eachText(rawCards, 'tarjetas', (t, w) => checkText(t, w, 'other', problems), problems)
    const filas = isObject(rawCards.autoridad_y_costos) ? rawCards.autoridad_y_costos.filas : undefined
    if (filas !== undefined && !isObject(filas)) problems.push('tarjetas.autoridad_y_costos.filas must be an object.')
    cards = cleanCards(rawCards)

    // The envelope: every entry matches exactly one step's numero_oficial
    const sobre = rawCards.sobre
    if (isObject(sobre) && sobre.orden !== undefined) {
      if (!Array.isArray(sobre.orden)) problems.push('tarjetas.sobre.orden must be a list.')
      else if (Array.isArray(data.pasos)) {
        const steps = data.pasos.filter(isObject)
        sobre.orden.forEach((entry, i) => {
          if (typeof entry !== 'string') { problems.push(`tarjetas.sobre.orden[${i}] must be a text.`); return }
          const number = sobreNumber(entry)
          const matches = steps.filter((s) => s.numero_oficial === number)
          if (matches.length !== 1) {
            problems.push(`tarjetas.sobre.orden[${i}] "${entry}" matches ${matches.length} steps by numero_oficial "${number}" instead of 1.`)
            return
          }
          const item = items.find((it) => it.sourceCode === matches[0].codigo)
          if (!item) return  // that step already has a problem of its own
          if (item.sobreOrder !== null) problems.push(`Step "${item.sourceCode}" appears twice in tarjetas.sobre.orden.`)
          else item.sobreOrder = i + 1
        })
      }
    }
  }

  if (problems.length > 0 || typeof target === 'string') return { plan: null, problems }
  for (const it of items) {
    if (!blocks.some((b) => b.bloque === it.block)) problems.push(`Step "${it.sourceCode}": block ${it.block} has no entry in bloques.`)
  }
  if (problems.length > 0) return { plan: null, problems }
  return {
    plan: { target, template: { title, rulesLabel, generatedOn, cover, blocks, cards }, items },
    problems,
  }
}

/* ---------- SQL ---------- */

/** A text as a SQL literal: 'it''s'. Single quotes are doubled; nothing
    else is special in a standard SQL string (the generated file switches
    standard_conforming_strings on, so a backslash is just a backslash).
    "$$" inside the text is harmless inside single quotes. */
export function sqlText(value: string | null): string {
  if (value === null) return 'null'
  if (value.includes('\u0000')) throw new Error('A text contains a NUL character, which the database can\'t store.')
  return `'${value.replaceAll("'", "''")}'`
}

/** A whole number for SQL, checked */
function sqlInt(value: number | null): string {
  if (value === null) return 'null'
  if (!Number.isSafeInteger(value)) throw new Error(`Not a whole number: ${value}`)
  return String(value)
}

/** Structured data as a jsonb literal */
function sqlJson(value: unknown): string {
  return `${sqlText(JSON.stringify(value))}::jsonb`
}

/** The SQL file for one template. Run again as often as needed. */
export function toSql(plan: ImportPlan): string {
  const { target, template, items } = plan
  // Checked again here, because these two also appear inside the DO block
  if (!(STATES as readonly string[]).includes(target.state) || !(ROUTES as readonly string[]).includes(target.route)) {
    throw new Error('Unknown state or route.')
  }
  if (!/^[a-z]{2}-[a-z0-9_]+\.json$/.test(target.fileName)) throw new Error('Unexpected file name.')
  const state = sqlText(target.state)
  const route = sqlText(target.route)

  const rows = items.map((it) => '  (' + [
    sqlText(it.code), state, route, sqlText(it.sourceCode),
    sqlInt(it.block), sqlInt(it.sortOrder), sqlText(it.officialNumber), sqlInt(it.sobreOrder),
    sqlText(it.title), sqlText(it.body), sqlText(it.donde), sqlText(it.plazo),
    sqlText(it.aviso), sqlText(it.caduca), it.naDefault ? 'true' : 'false', sqlText(it.naReason),
  ].join(', ') + ')')

  const codes = items.map((it) => '    ' + sqlText(it.code)).join(',\n')

  return `-- =============================================================================
-- Checklist template: ${target.fileName}
-- =============================================================================
-- Made by "npm run checklist-sql" from content/checklists/${target.fileName}.
-- Don't edit this file by hand: change the JSON and run the script again.
--
-- Paste this whole file into Supabase's SQL Editor and press "Run"
-- (after migration 7). See supabase/README.md, "Load a checklist template".
--
-- Safe to run again. Everything runs in one transaction: if any line fails,
-- nothing is changed.
--   - the template row (blocks, cover, cards) is added or replaced
--   - a step whose code already exists is updated in place, so ticks stay
--   - a new step is added
--   - a step of this Bundesland + route that came from a template
--     (source_code filled in) but is missing from the JSON gets
--     archived = true. Nothing is deleted. Items without a source_code are
--     never touched.
-- =============================================================================

begin;

-- A backslash in a text is just a backslash.
set local standard_conforming_strings = on;

-- Stop with a clear message if migration 7 isn't applied yet.
do $check$
begin
  if to_regclass('public.checklist_templates') is null
     or not exists (select 1 from public.routes where code = ${route}) then
    raise exception 'Apply migration 7 first (the table checklist_templates or the route is missing).';
  end if;
end
$check$;

-- 1. The template: block titles, cover texts and info cards
insert into public.checklist_templates (state, route, title, rules_label, generated_on, cover, blocks, cards)
values (
  ${state},
  ${route},
  ${sqlText(template.title)},
  ${sqlText(template.rulesLabel)},
  ${template.generatedOn === null ? 'null' : `${sqlText(template.generatedOn)}::date`},
  ${sqlJson(template.cover)},
  ${sqlJson(template.blocks)},
  ${sqlJson(template.cards)}
)
on conflict (state, route) do update set
  title        = excluded.title,
  rules_label  = excluded.rules_label,
  generated_on = excluded.generated_on,
  cover        = excluded.cover,
  blocks       = excluded.blocks,
  cards        = excluded.cards;

-- 2. The steps (${items.length}): added, or updated in place by their code
insert into public.checklist_items (
  code, state, route, source_code,
  block, sort_order, official_number, sobre_order,
  title, body, donde, plazo,
  aviso, caduca, na_default, na_reason
)
values
${rows.join(',\n')}
on conflict (code) do update set
  source_code     = excluded.source_code,
  block           = excluded.block,
  sort_order      = excluded.sort_order,
  official_number = excluded.official_number,
  sobre_order     = excluded.sobre_order,
  title           = excluded.title,
  body            = excluded.body,
  donde           = excluded.donde,
  plazo           = excluded.plazo,
  aviso           = excluded.aviso,
  caduca          = excluded.caduca,
  na_default      = excluded.na_default,
  na_reason       = excluded.na_reason,
  archived        = false;

-- 3. Steps of this Bundesland + route from a template, missing from the JSON
update public.checklist_items
   set archived = true
 where state = ${state}
   and route = ${route}
   and source_code is not null
   and not archived
   and code not in (
${codes}
   );

commit;

-- Check: active steps should be ${items.length}.
select count(*) filter (where not archived) as pasos_activos,
       count(*) filter (where archived)     as pasos_archivados
  from public.checklist_items
 where state = ${state} and route = ${route} and source_code is not null;
`
}
