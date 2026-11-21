import type { SupabaseClient } from '@supabase/supabase-js'
import { MAP_SHAPES } from '../estados/mapShapes.ts'

/* What the admin screens read, and the sums they make from it.

   Everything is read with the logged-in admin's own session (the public
   key), so the database's Row Level Security decides what comes back: for a
   non-admin, these same requests return only their own rows.

   The sums (progress %, last activity, a news post's status) are pure
   functions: they only look at what they are given. They are tested by
   tests/adminLogic.test.ts (npm test), because the live database must not
   get test rows. */

/* ---------- Rows, as the pages get them ---------- */

/** One client account (a row of "profiles" that isn't an admin) */
export interface Client {
  id: string
  first_name: string | null
  last_names: string | null
  /** Only shown when the client has no name yet */
  email: string | null
  /** The map's short code ("by", "th"…), or null */
  main_state: string | null
  /** A route code, or null */
  route: string | null
  plan: 'free' | 'paid'
}
/** Never is_admin: the website doesn't read or offer it here */
export const CLIENT_COLUMNS = 'id, first_name, last_names, email, main_state, route, plan'

export interface Route {
  code: string
  name: string
  sort_order: number
  archived: boolean
}
export const ROUTE_COLUMNS = 'code, name, sort_order, archived'

/** A checklist item that counts for progress (never an archived one) */
export interface Item {
  id: string
  state: string
  route: string
  /** "No aplica" by default in the template (migration 7) */
  na_default: boolean
}

/** One row of the client layer (client_item_settings, migration 7), as far
    as progress needs it: applies true = "aplica", false = "no aplica",
    null = the template's default */
export interface ItemSetting {
  user_id: string
  item_id: string
  applies: boolean | null
}

/** Does this step apply to the client? The client layer wins; without it
    (or with "Según la plantilla"), the template's default decides. */
export function stepApplies(item: Pick<Item, 'na_default'>, setting: Pick<ItemSetting, 'applies'> | null | undefined): boolean {
  if (setting && setting.applies !== null) return setting.applies
  return !item.na_default
}

/** One ticked item */
export interface Tick {
  user_id: string
  item_id: string
  done_at: string
}

export interface NewsPost {
  id: string
  title: string
  body: string
  /** null = all states */
  state: string | null
  published_at: string
  published: boolean
  paid_only: boolean
}
export const NEWS_COLUMNS = 'id, title, body, state, published_at, published, paid_only'

/* ---------- States ---------- */

/** The 16 Bundesländer (German names), in alphabetical order */
export const STATES: readonly { id: string; name: string }[] = MAP_SHAPES
  .map(({ id, name }) => ({ id, name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'de'))

/** German name of a state code; '' for none or an unknown code */
export function stateName(code: string | null): string {
  return STATES.find((s) => s.id === code)?.name ?? ''
}

/* ---------- Names ---------- */

/** "first_name last_names"; '' when the name step isn't done yet */
export function clientName(client: Pick<Client, 'first_name' | 'last_names'>): string {
  return [client.first_name?.trim(), client.last_names?.trim()].filter(Boolean).join(' ')
}

/** Clients by name (Spanish alphabet); those without a name last, by email */
export function sortClients<T extends Pick<Client, 'id' | 'first_name' | 'last_names' | 'email'>>(clients: readonly T[]): T[] {
  return [...clients].sort((a, b) => {
    const [nameA, nameB] = [clientName(a), clientName(b)]
    if (!nameA !== !nameB) return nameA ? -1 : 1
    return (
      nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
      || (a.email ?? '').localeCompare(b.email ?? '', 'es')
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )
  })
}

/* ---------- What an admin has to act on ---------- */

/** What a paid client still lacks: a Bundesland (none, or a code the map
    doesn't know) and/or a route. Each one is shown as an Alerta cell in the
    client overview, and either one makes "Estado, ruta y plan" an Alerta
    button on the client's screen (DECISIONS.md, 21 Nov 2026, late). A free
    client lacks nothing here: no Alerta. */
export function setupMissing(client: Pick<Client, 'main_state' | 'route' | 'plan'>): { state: boolean; route: boolean } {
  const paid = client.plan === 'paid'
  return { state: paid && !stateName(client.main_state), route: paid && !client.route }
}

/** "Sin documentos", "1 documento", "3 documentos" */
export function documentCountText(count: number): string {
  if (count <= 0) return 'Sin documentos'
  return count === 1 ? '1 documento' : `${count} documentos`
}

/** "Sin archivos", "1 foto", "3 fotos · 1 PDF", "2 PDF" (a news post's files) */
export function newsFilesText(photos: number, pdfs: number): string {
  const parts: string[] = []
  if (photos > 0) parts.push(photos === 1 ? '1 foto' : `${photos} fotos`)
  if (pdfs > 0) parts.push(`${pdfs} PDF`)
  return parts.length ? parts.join(' · ') : 'Sin archivos'
}

/* ---------- Progress and last activity ---------- */

export interface Progress {
  /** Ticked items of the client's current state and route that apply */
  done: number
  /** Non-archived items of the client's current state and route that apply */
  total: number
  /** Whole number from 0 to 100. 100 only when everything is ticked, and 0
      only when nothing is. */
  percent: number
}

/** Progress of one client: ticked items ÷ non-archived items for their
    current Bundesland and route, leaving out the steps that don't apply to
    them ("no aplica" by the template's default or by the client layer;
    DECISIONS.md, 20 and 21 Nov 2026).

    Returns null (shown as "—") when the client has no state, no route, or
    there are no items that apply for that state and route yet.

    `items` must hold only non-archived items. `settings` are this client's
    own client-layer rows. Ticks for anything else (an old state, another
    route, an archived item, a step that doesn't apply) are not counted, and
    an item ticked twice in `ticks` counts once. */
export function progressFor(
  client: Pick<Client, 'main_state' | 'route'>,
  items: readonly Item[],
  ticks: readonly Pick<Tick, 'item_id'>[],
  settings: readonly Pick<ItemSetting, 'item_id' | 'applies'>[] = [],
): Progress | null {
  if (!client.main_state || !client.route) return null
  const settingOf = new Map(settings.map((setting) => [setting.item_id, setting]))
  const current = new Set<string>()
  for (const item of items) {
    if (item.state !== client.main_state || item.route !== client.route) continue
    if (stepApplies(item, settingOf.get(item.id))) current.add(item.id)
  }
  if (current.size === 0) return null
  const ticked = new Set<string>()
  for (const tick of ticks) {
    if (current.has(tick.item_id)) ticked.add(tick.item_id)
  }
  return { done: ticked.size, total: current.size, percent: percentOf(ticked.size, current.size) }
}

/** Rounded to a whole number, but never 100 before everything is ticked
    (199 of 200 is 99, not 100) and never 0 once something is (1 of 300 is 1) */
function percentOf(done: number, total: number): number {
  if (done >= total) return 100
  if (done <= 0) return 0
  return Math.min(99, Math.max(1, Math.round((done / total) * 100)))
}

/** "45 % (9 de 20)", or "—" when there is nothing to measure */
export function progressText(progress: Progress | null): string {
  if (!progress) return '—'
  return `${progress.percent} % (${progress.done} de ${progress.total})`
}

/** The client's most recent tick, in any state or route (`done_at` exactly
    as the database sent it), or null when they have none. Unticking removes
    the tick, so it no longer counts. */
export function lastActivity(ticks: readonly Pick<Tick, 'done_at'>[]): string | null {
  let latest: string | null = null
  let latestMs = -Infinity
  for (const tick of ticks) {
    const ms = Date.parse(tick.done_at)
    if (ms > latestMs) {
      latestMs = ms
      latest = tick.done_at
    }
  }
  return latest
}

export interface ClientSummary {
  progress: Progress | null
  lastActivity: string | null
}

/** Rows grouped by their user_id */
function byUser<T extends { user_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const result = new Map<string, T[]>()
  for (const row of rows) {
    const list = result.get(row.user_id)
    if (list) list.push(row)
    else result.set(row.user_id, [row])
  }
  return result
}

/** Progress and last activity for every client at once, from one list of
    items, one list of ticks and one list of client-layer rows (no request
    per client). Each client only gets their own ticks and rows. */
export function summarise(
  clients: readonly Client[],
  items: readonly Item[],
  ticks: readonly Tick[],
  settings: readonly ItemSetting[] = [],
): Map<string, ClientSummary> {
  const ticksOf = byUser(ticks)
  const settingsOf = byUser(settings)
  const result = new Map<string, ClientSummary>()
  for (const client of clients) {
    const own = ticksOf.get(client.id) ?? []
    result.set(client.id, {
      progress: progressFor(client, items, own, settingsOf.get(client.id) ?? []),
      lastActivity: lastActivity(own),
    })
  }
  return result
}

/* ---------- News status ---------- */

export type NewsStatus = 'draft' | 'scheduled' | 'published'

/** "Borrador" (not published), "Programada" (published, but its date is
    still in the future) or "Publicada". Same rule as the database uses to
    decide what clients see: published and published_at <= now. */
export function newsStatus(post: Pick<NewsPost, 'published' | 'published_at'>, nowMs: number): NewsStatus {
  if (!post.published) return 'draft'
  return Date.parse(post.published_at) > nowMs ? 'scheduled' : 'published'
}

export const NEWS_STATUS_LABEL: Record<NewsStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  published: 'Publicada',
}

/** News posts newest first (by publish date, then id for the very same date) */
export function sortNews<T extends Pick<NewsPost, 'id' | 'published_at'>>(posts: readonly T[]): T[] {
  return [...posts].sort((a, b) =>
    Date.parse(b.published_at) - Date.parse(a.published_at) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
}

/* ---------- Reading whole tables, in pages ---------- */

/** Supabase returns at most 1,000 rows per request */
export const PAGE_SIZE = 1000

export interface Page<T> {
  data: T[] | null
  error: unknown
  /** How many rows there are in total, when the request asked for it */
  count?: number | null
}

/** Reads every row of one query, a page at a time.

    `fetchPage(from, to)` must ask for rows number `from` to `to` (counting
    from 0) of the SAME query, ALWAYS IN THE SAME ORDER: order by the
    primary key, so no row is skipped or handed out twice between pages.
    `key` gives a row's primary key; should a row still arrive twice (a row
    added while reading), it is kept once.

    It stops when it has as many rows as the database says exist (`count`),
    or, without a count, when a page comes back empty. Throws the database's
    error if a page fails. */
export async function readAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
  key: (row: T) => string,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const rows = new Map<string, T>()
  let from = 0
  for (;;) {
    const { data, error, count } = await fetchPage(from, from + pageSize - 1)
    if (error) throw error
    const page = data ?? []
    if (page.length === 0) break
    const before = rows.size
    for (const row of page) rows.set(key(row), row)
    from += page.length
    if (typeof count === 'number' && from >= count) break
    // A page with nothing new: stop, instead of asking forever
    if (rows.size === before) break
  }
  return [...rows.values()]
}

/* ---------- The requests ---------- */

/** Every route (also archived ones, to name a client's old route) */
export function loadRoutes(db: SupabaseClient): Promise<Route[]> {
  return readAll<Route>(
    (from, to) => db.from('routes')
      .select(ROUTE_COLUMNS, { count: 'exact' })
      .order('code')
      .range(from, to)
      .returns<Route[]>(),
    (route) => route.code,
  )
}

export interface Overview {
  clients: Client[]
  routes: Route[]
  items: Item[]
  ticks: Tick[]
  settings: ItemSetting[]
}

/** Every client-layer row that says "aplica" or "no aplica" (rows set back
    to "Según la plantilla" change nothing, so they aren't read). Pass a
    user ID for one client's rows only. */
export function loadItemSettings(db: SupabaseClient, userId?: string): Promise<ItemSetting[]> {
  return readAll<ItemSetting>(
    // client_item_settings has no id: its primary key is (user_id, item_id)
    (from, to) => {
      let query = db.from('client_item_settings')
        .select('user_id, item_id, applies', { count: 'exact' })
        .not('applies', 'is', null)
      if (userId) query = query.eq('user_id', userId)
      return query
        .order('user_id')
        .order('item_id')
        .range(from, to)
        .returns<ItemSetting[]>()
    },
    (setting) => setting.user_id + ' ' + setting.item_id,
  )
}

/** Everything the client overview needs: one query per table (in pages of
    1,000 rows), never one request per client. */
export async function loadOverview(db: SupabaseClient): Promise<Overview> {
  const [clients, routes, items, ticks, settings] = await Promise.all([
    readAll<Client>(
      (from, to) => db.from('profiles')
        .select(CLIENT_COLUMNS, { count: 'exact' })
        .eq('is_admin', false)
        .order('id')
        .range(from, to)
        .returns<Client[]>(),
      (client) => client.id,
    ),
    loadRoutes(db),
    readAll<Item>(
      (from, to) => db.from('checklist_items')
        .select('id, state, route, na_default', { count: 'exact' })
        .eq('archived', false)
        .order('id')
        .range(from, to)
        .returns<Item[]>(),
      (item) => item.id,
    ),
    readAll<Tick>(
      // progress has no id: its primary key is (user_id, item_id)
      (from, to) => db.from('progress')
        .select('user_id, item_id, done_at', { count: 'exact' })
        .order('user_id')
        .order('item_id')
        .range(from, to)
        .returns<Tick[]>(),
      (tick) => tick.user_id + ' ' + tick.item_id,
    ),
    loadItemSettings(db),
  ])
  return { clients, routes, items, ticks, settings }
}

/** One checklist step as Mi expediente and the client's admin screen show
    it (migration 7 added the template's fields). Every text is plain text,
    with the template's placeholders still in it (src/lib/placeholders.ts). */
export interface ChecklistItem extends Item {
  title: string
  body: string
  sort_order: number
  /** Template block 1–5; null for an item that doesn't come from a template */
  block: number | null
  /** The number in the authority's list ("6", "pág. 4", "—"), or null */
  official_number: string | null
  /** Place in the envelope; null = not in the envelope */
  sobre_order: number | null
  donde: string | null
  plazo: string | null
  aviso: string | null
  caduca: string | null
  na_reason: string | null
  /** The owner's step code ("p2", "bw8"), or null */
  source_code: string | null
}
const CHECKLIST_COLUMNS = 'id, state, route, title, body, sort_order, block, official_number, sobre_order, '
  + 'donde, plazo, aviso, caduca, na_default, na_reason, source_code'

/** The non-archived checklist of one state and route, in its own order:
    by block (items without a block last), then the template's order */
export async function loadChecklist(db: SupabaseClient, state: string, route: string): Promise<ChecklistItem[]> {
  const items = await readAll<ChecklistItem>(
    (from, to) => db.from('checklist_items')
      .select(CHECKLIST_COLUMNS, { count: 'exact' })
      .eq('archived', false)
      .eq('state', state)
      .eq('route', route)
      .order('id')
      .range(from, to)
      .returns<ChecklistItem[]>(),
    (item) => item.id,
  )
  return items.sort((a, b) =>
    (a.block ?? 99) - (b.block ?? 99)
    || a.sort_order - b.sort_order
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Every tick of one client */
export function loadTicks(db: SupabaseClient, userId: string): Promise<Tick[]> {
  return readAll<Tick>(
    (from, to) => db.from('progress')
      .select('user_id, item_id, done_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('item_id')
      .range(from, to)
      .returns<Tick[]>(),
    (tick) => tick.item_id,
  )
}

/** Every news post: drafts, scheduled and published (admins see them all) */
export async function loadNews(db: SupabaseClient): Promise<NewsPost[]> {
  const posts = await readAll<NewsPost>(
    (from, to) => db.from('news_posts')
      .select(NEWS_COLUMNS, { count: 'exact' })
      .order('id')
      .range(from, to)
      .returns<NewsPost[]>(),
    (post) => post.id,
  )
  return sortNews(posts)
}
