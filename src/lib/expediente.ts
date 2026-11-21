import type { SupabaseClient } from '@supabase/supabase-js'
import { stepApplies, type ChecklistItem, type ItemSetting } from './adminData.ts'

/* What Mi expediente (src/pages/Expediente.tsx) and the client's admin
   screen (src/pages/AdminCliente.tsx) read about a checklist, beyond its
   steps (loadChecklist in adminData.ts), and the small sums they make.

   Migration 7: checklist_templates (block titles, cover, info cards),
   client_item_settings (the client layer), client_details (country, header
   line) and client_dudas ("Mis dudas"). The database's Row Level Security
   decides what comes back: a client gets only their own rows.

   The template's cover, blocks and cards are "jsonb" (structured JSON
   data). They are read here piece by piece: anything missing or of an
   unexpected kind is simply left out, so an odd template never breaks the
   page. Every text stays plain text, shown as text, never as HTML. */

/* ---------- Rows ---------- */

/** One row of checklist_templates, as the website reads it */
export interface TemplateRow {
  title: string
  cover: unknown
  blocks: unknown
  cards: unknown
}
export const TEMPLATE_COLUMNS = 'title, cover, blocks, cards'

/** One row of the client layer, with the texts */
export interface ClientItemSetting extends ItemSetting {
  /** Why the step doesn't apply (shown when it doesn't), or null */
  reason: string | null
  /** The client's personal note, its own box under the step, or null */
  note: string | null
  updated_at: string
}
export const ITEM_SETTING_COLUMNS = 'user_id, item_id, applies, reason, note, updated_at'

/** client_details: fills {pais} and {perfil} */
export interface ClientDetails {
  country: string | null
  header_line: string | null
}
export const DETAILS_COLUMNS = 'country, header_line'

/** client_dudas: "Mis dudas", one text per client */
export interface Dudas {
  body: string
  updated_at: string
}
export const DUDAS_COLUMNS = 'body, updated_at'

/** The longest "Mis dudas" text the database accepts (after trimming) */
export const DUDAS_MAX = 4000
/** The longest reason and note the database accepts (migration 7) */
export const REASON_MAX = 500
export const NOTE_MAX = 2000
/** The longest country and header line the database accepts */
export const COUNTRY_MAX = 100
export const HEADER_LINE_MAX = 300

/** Every client-layer row of one client (admins read anyone's; a client
    gets only their own, for the steps they can read) */
export async function loadClientSettings(db: SupabaseClient, userId: string): Promise<ClientItemSetting[]> {
  const { data, error } = await db.from('client_item_settings')
    .select(ITEM_SETTING_COLUMNS)
    .eq('user_id', userId)
    .order('item_id')
    .returns<ClientItemSetting[]>()
  if (error) throw error
  return data ?? []
}

/* ---------- Texts like the database counts them ---------- */

/** Removes spaces, tabs, carriage returns and line breaks at both ends,
    exactly like the database does (btrim(body, E' \t\r\n')). The same rule
    as the community board's counter (PostBoard.tsx). */
export function dbTrim(text: string): string {
  return text.replace(/^[ \t\r\n]+/, '').replace(/[ \t\r\n]+$/, '')
}

/** Counts characters like the database (char_length): an emoji counts as 1 */
export function countChars(text: string): number {
  return Array.from(text).length
}

/* ---------- Reading the template's jsonb safely ---------- */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
/** A text, or '' when it isn't one */
function text(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
/** The texts of a list (anything else in it is left out) */
function texts(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
}

export interface Cover {
  eyebrow: string
  title: string
  subtitle: string
  barTitle: string
  /** The milestones of the progress bar: one per block, in order */
  milestones: string[]
}

export function readCover(cover: unknown): Cover {
  const c = isObject(cover) ? cover : {}
  const bar = isObject(c.barra_de_avance) ? c.barra_de_avance : {}
  return {
    eyebrow: text(c.eyebrow),
    title: text(c.titulo),
    subtitle: text(c.subtitulo),
    barTitle: text(bar.titulo),
    milestones: texts(bar.hitos),
  }
}

export interface BlockInfo {
  block: number
  title: string
  subtitle: string
}

/** Blocks 1 to 5, in order (a missing block gets an empty title) */
export function readBlocks(blocks: unknown): BlockInfo[] {
  const list = Array.isArray(blocks) ? blocks.filter(isObject) : []
  return [1, 2, 3, 4, 5].map((n) => {
    const b = list.find((x) => x.bloque === n)
    return { block: n, title: text(b?.titulo), subtitle: text(b?.subtitulo) }
  })
}

export interface Cards {
  reform: { title: string; points: string[] } | null
  legend: string
  envelope: {
    title: string
    text: string
    /** The owner's list, for the short notes after a number ("puede ir después") */
    order: string[]
    note: string
    footer: string
  } | null
  dudasTitle: string
  errors: { title: string; points: { title: string; text: string }[] } | null
  authority: { title: string; rows: { label: string; value: string }[]; otherCosts: string; contact: string } | null
  sources: {
    title: string
    official: string
    estimate: string
    documents: string[]
    version: string
    advice: string
  } | null
  footer: string
}

export function readCards(cards: unknown): Cards {
  const c = isObject(cards) ? cards : {}
  const reform = isObject(c.lo_que_cambio_con_la_reforma) ? c.lo_que_cambio_con_la_reforma : null
  const envelope = isObject(c.sobre) ? c.sobre : null
  const dudas = isObject(c.mis_dudas) ? c.mis_dudas : {}
  const errors = isObject(c.errores_frecuentes) ? c.errores_frecuentes : null
  const authority = isObject(c.autoridad_y_costos) ? c.autoridad_y_costos : null
  const sources = isObject(c.fuentes) ? c.fuentes : null
  return {
    reform: reform ? { title: text(reform.titulo), points: texts(reform.puntos) } : null,
    legend: text(c.leyenda),
    envelope: envelope
      ? {
          title: text(envelope.titulo),
          text: text(envelope.texto),
          order: Array.isArray(envelope.orden) ? envelope.orden.map(text) : [],
          note: text(envelope.nota_12_13_15),
          footer: text(envelope.pie),
        }
      : null,
    dudasTitle: text(dudas.titulo),
    errors: errors
      ? {
          title: text(errors.titulo),
          points: (Array.isArray(errors.puntos) ? errors.puntos : [])
            .filter(isObject)
            .map((p) => ({ title: text(p.titulo), text: text(p.texto) }))
            .filter((p) => p.title || p.text),
        }
      : null,
    authority: authority
      ? {
          title: text(authority.titulo),
          // Stored as a list, in the owner's order (scripts/checklistTemplate.ts)
          rows: (Array.isArray(authority.filas) ? authority.filas : [])
            .filter(isObject)
            .map((r) => ({ label: text(r.etiqueta), value: text(r.valor) }))
            .filter((r) => r.label || r.value),
          otherCosts: text(authority.otros_costos),
          contact: text(authority.contacto),
        }
      : null,
    sources: sources
      ? {
          title: text(sources.titulo),
          official: text(sources.oficial),
          estimate: text(sources.estimacion),
          documents: texts(sources.documentos),
          version: text(sources.fecha_de_version),
          advice: text(sources.consejo),
        }
      : null,
    footer: text(c.pie),
  }
}

/** The short note after a number in the owner's envelope list:
    "12 (puede ir después)" → "puede ir después"; "6" → "" */
export function envelopeNote(entry: string): string {
  return /\(([^)]*)\)\s*$/.exec(entry)?.[1].trim() ?? ''
}

/* ---------- One step, for this client ---------- */

export interface StepView {
  /** Does it apply? The client layer wins over the template's default. */
  applies: boolean
  /** Ticked, and it applies (a tick on a "no aplica" step never counts) */
  done: boolean
  /** Why it doesn't apply: the client layer's reason, otherwise the template's */
  reason: string | null
  /** The client's personal note */
  note: string | null
}

export function stepView(
  item: Pick<ChecklistItem, 'na_default' | 'na_reason'>,
  setting: Pick<ClientItemSetting, 'applies' | 'reason' | 'note'> | undefined,
  ticked: boolean,
): StepView {
  const applies = stepApplies(item, setting)
  return {
    applies,
    done: applies && ticked,
    reason: setting?.reason?.trim() || item.na_reason?.trim() || null,
    note: setting?.note?.trim() || null,
  }
}

/* ---------- Blocks: the milestone bar and "Ahora mismo" ---------- */

export interface BlockProgress {
  block: number
  /** Steps that apply */
  total: number
  /** Of those, ticked */
  done: number
}

/** For blocks 1 to 5: how many steps apply and how many of those are
    ticked. Steps that don't apply, and their ticks, never count. */
export function blockProgress(
  items: readonly Pick<ChecklistItem, 'id' | 'block' | 'na_default'>[],
  ticked: ReadonlySet<string>,
  settings: ReadonlyMap<string, Pick<ItemSetting, 'applies'>>,
): BlockProgress[] {
  return [1, 2, 3, 4, 5].map((block) => {
    let total = 0
    let done = 0
    for (const item of items) {
      if (item.block !== block || !stepApplies(item, settings.get(item.id))) continue
      total++
      if (ticked.has(item.id)) done++
    }
    return { block, total, done }
  })
}

/** "Ahora mismo": the first block that still has pending steps that apply,
    or null when every step that applies is done ("Completo") */
export function currentBlock(progress: readonly BlockProgress[]): BlockProgress | null {
  return progress.find((p) => p.done < p.total) ?? null
}

/** "7 pendientes", "1 pendiente" */
export function pendingText(count: number): string {
  return count === 1 ? '1 pendiente' : `${count} pendientes`
}
