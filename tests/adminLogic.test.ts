/* Tests for the admin screens' pure logic: German time (src/lib/berlinTime.ts)
   and the progress %, last activity, news status, paged reads and the
   client screen's status texts (src/lib/adminData.ts).

   Run with:  npm test
   It needs no database and no internet: every row below is made up here, so
   the live Supabase project never gets test rows. It ends with
   "ALL ADMIN LOGIC TESTS PASSED", or lists what failed.

   Node.js 22 runs this TypeScript file directly. */

import { berlinToUtc, formatBerlinDateTime, utcToBerlin } from '../src/lib/berlinTime.ts'
import {
  clientName, documentCountText, lastActivity, newsStatus, progressFor, progressText, readAll,
  setupMissing, sortClients, sortNews, stateName, stepApplies, STATES, summarise,
  type Client, type Item, type ItemSetting, type Page, type Tick,
} from '../src/lib/adminData.ts'

let passed = 0
const failures: string[] = []

function same(name: string, actual: unknown, expected: unknown): void {
  const [a, e] = [JSON.stringify(actual), JSON.stringify(expected)]
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    got      ${a}`)
}

/* ===========================================================================
   German time
   =========================================================================== */

const utc = (date: string, time: string) => {
  const result = berlinToUtc(date, time)
  return result.ok ? result.iso : 'refused: ' + result.reason
}

// Winter: Germany is 1 hour ahead of UTC. Summer: 2 hours.
same('winter time is UTC+1', utc('2026-11-16', '14:05'), '2026-11-16T13:05:00.000Z')
same('summer time is UTC+2', utc('2026-07-01', '14:05'), '2026-07-01T12:05:00.000Z')
same('midnight in winter is the day before in UTC', utc('2026-01-01', '00:00'), '2025-12-31T23:00:00.000Z')
same('midnight in summer is the day before in UTC', utc('2026-08-01', '00:30'), '2026-07-31T22:30:00.000Z')
same('seconds from the time input are ignored', utc('2026-11-16', '14:05:59'), '2026-11-16T13:05:00.000Z')

// Clocks go forward: Sunday 29 March 2026, 02:00 -> 03:00
same('last minute of winter time', utc('2026-03-29', '01:59'), '2026-03-29T00:59:00.000Z')
same('02:00 does not exist that day', utc('2026-03-29', '02:00'), 'refused: gap')
same('02:30 does not exist that day', utc('2026-03-29', '02:30'), 'refused: gap')
same('02:59 does not exist that day', utc('2026-03-29', '02:59'), 'refused: gap')
same('first minute of summer time', utc('2026-03-29', '03:00'), '2026-03-29T01:00:00.000Z')
same('the day before the change is still winter time', utc('2026-03-28', '02:30'), '2026-03-28T01:30:00.000Z')
same('the day after the change is summer time', utc('2026-03-30', '02:30'), '2026-03-30T00:30:00.000Z')
same('same change in 2027 (28 March)', utc('2027-03-28', '02:30'), 'refused: gap')

// Clocks go back: Sunday 25 October 2026, 03:00 -> 02:00 (02:00-02:59 happens twice)
same('last minute before the repeated hour', utc('2026-10-25', '01:59'), '2026-10-24T23:59:00.000Z')
same('02:00 that day: the first one (summer time)', utc('2026-10-25', '02:00'), '2026-10-25T00:00:00.000Z')
same('02:30 that day: the first one (summer time)', utc('2026-10-25', '02:30'), '2026-10-25T00:30:00.000Z')
same('03:00 that day is winter time', utc('2026-10-25', '03:00'), '2026-10-25T02:00:00.000Z')
same('the day before is summer time', utc('2026-10-24', '02:30'), '2026-10-24T00:30:00.000Z')
same('the day after is winter time', utc('2026-10-26', '02:30'), '2026-10-26T01:30:00.000Z')

// Not real dates or times
same('31 February is refused', utc('2026-02-31', '10:00'), 'refused: invalid')
same('29 February in a normal year is refused', utc('2026-02-29', '10:00'), 'refused: invalid')
same('29 February in a leap year works', utc('2028-02-29', '10:00'), '2028-02-29T09:00:00.000Z')
same('month 13 is refused', utc('2026-13-01', '10:00'), 'refused: invalid')
same('25:00 is refused', utc('2026-11-16', '25:00'), 'refused: invalid')
same('10:60 is refused', utc('2026-11-16', '10:60'), 'refused: invalid')
same('an empty date is refused', utc('', '10:00'), 'refused: invalid')
same('an empty time is refused', utc('2026-11-16', ''), 'refused: invalid')
same('a date in another form is refused', utc('16/11/2026', '10:00'), 'refused: invalid')

// Back to German time, for showing
same('winter moment shown in German time', utcToBerlin('2026-11-16T13:05:00.000Z'), { date: '2026-11-16', time: '14:05' })
same('summer moment shown in German time', utcToBerlin('2026-07-01T12:05:00Z'), { date: '2026-07-01', time: '14:05' })
same('late UTC evening is the next German day', utcToBerlin('2026-12-31T23:30:00Z'), { date: '2027-01-01', time: '00:30' })
same('the database\'s own format is understood', utcToBerlin('2026-11-16T13:05:42.123456+00:00'), { date: '2026-11-16', time: '14:05' })
same('the repeated hour, first time', utcToBerlin('2026-10-25T00:30:00Z'), { date: '2026-10-25', time: '02:30' })
same('the repeated hour, second time', utcToBerlin('2026-10-25T01:30:00Z'), { date: '2026-10-25', time: '02:30' })
same('not a date gives empty fields', utcToBerlin('nonsense'), { date: '', time: '' })
same('Spanish text in German time (winter)', formatBerlinDateTime('2026-11-16T13:05:00Z'), '16 nov 2026, 14:05')
same('Spanish text in German time (summer)', formatBerlinDateTime('2026-07-01T22:30:00Z'), '2 jul 2026, 00:30')
same('not a date gives empty text', formatBerlinDateTime('nonsense'), '')

// Every minute of both change days and an ordinary day: typing what is
// shown gives back the same moment (except the second 02:00-02:59 in
// October, which gives the first one, an hour earlier)
{
  let wrong = 0
  let checked = 0
  for (const start of ['2026-03-28T22:00:00Z', '2026-10-24T21:00:00Z', '2026-06-10T00:00:00Z', '2027-03-27T22:00:00Z']) {
    const first = Date.parse(start)
    for (let minute = 0; minute < 8 * 60; minute++) {
      const moment = first + minute * 60_000
      const shown = utcToBerlin(moment)
      const back = berlinToUtc(shown.date, shown.time)
      checked++
      const repeated = moment >= Date.parse('2026-10-25T01:00:00Z') && moment < Date.parse('2026-10-25T02:00:00Z')
      const expected = repeated ? moment - 3_600_000 : moment
      if (!back.ok || Date.parse(back.iso) !== expected) wrong++
    }
  }
  same(`show and type back, ${checked} minutes around the clock changes`, wrong, 0)
}

/* ===========================================================================
   Progress %
   =========================================================================== */

const item = (id: string, state: string, route: string, na_default = false): Item => ({ id, state, route, na_default })
const tick = (user_id: string, item_id: string, done_at = '2026-11-01T10:00:00+00:00'): Tick => ({ user_id, item_id, done_at })
const client = (id: string, main_state: string | null, route: string | null, extra: Partial<Client> = {}): Client => ({
  id, first_name: null, last_names: null, email: null, main_state, route, plan: 'paid', ...extra,
})

// Only non-archived items ever reach these functions (the query leaves
// archived ones out). Bayern + route kp has 4 items, Bayern + fsp has 2,
// Thüringen + kp has 1.
const ITEMS: Item[] = [
  item('by-kp-1', 'by', 'kp'), item('by-kp-2', 'by', 'kp'), item('by-kp-3', 'by', 'kp'), item('by-kp-4', 'by', 'kp'),
  item('by-fsp-1', 'by', 'fsp'), item('by-fsp-2', 'by', 'fsp'),
  item('th-kp-1', 'th', 'kp'),
]
const ticked = (...ids: string[]) => ids.map((id) => ({ item_id: id }))

// The "—" cases
same('no state: —', progressFor({ main_state: null, route: 'kp' }, ITEMS, ticked('by-kp-1')), null)
same('no route: —', progressFor({ main_state: 'by', route: null }, ITEMS, ticked('by-kp-1')), null)
same('no state and no route: —', progressFor({ main_state: null, route: null }, ITEMS, []), null)
same('no items for that state and route yet: —', progressFor({ main_state: 'he', route: 'kp' }, ITEMS, ticked('by-kp-1')), null)
same('state has items, but not for this route: —', progressFor({ main_state: 'th', route: 'fsp' }, ITEMS, []), null)
same('no items at all: —', progressFor({ main_state: 'by', route: 'kp' }, [], ticked('by-kp-1')), null)
same('"—" as text', progressText(null), '—')

// Counting
same('nothing ticked: 0 %', progressFor({ main_state: 'by', route: 'kp' }, ITEMS, []), { done: 0, total: 4, percent: 0 })
same('1 of 4: 25 %', progressFor({ main_state: 'by', route: 'kp' }, ITEMS, ticked('by-kp-1')), { done: 1, total: 4, percent: 25 })
same('all 4 of 4: 100 %', progressFor({ main_state: 'by', route: 'kp' }, ITEMS, ticked('by-kp-1', 'by-kp-2', 'by-kp-3', 'by-kp-4')), { done: 4, total: 4, percent: 100 })
same('1 of 1: 100 %', progressFor({ main_state: 'th', route: 'kp' }, ITEMS, ticked('th-kp-1')), { done: 1, total: 1, percent: 100 })
same('ticks of another route are not counted', progressFor({ main_state: 'by', route: 'kp' }, ITEMS, ticked('by-kp-1', 'by-fsp-1', 'by-fsp-2')), { done: 1, total: 4, percent: 25 })
same('ticks of an old state are not counted', progressFor({ main_state: 'th', route: 'kp' }, ITEMS, ticked('by-kp-1', 'by-kp-2')), { done: 0, total: 1, percent: 0 })
same('ticks of archived or unknown items are not counted', progressFor({ main_state: 'by', route: 'kp' }, ITEMS, ticked('by-kp-archived', 'by-kp-2')), { done: 1, total: 4, percent: 25 })
same('the same tick twice counts once', progressFor({ main_state: 'by', route: 'kp' }, ITEMS, ticked('by-kp-1', 'by-kp-1')), { done: 1, total: 4, percent: 25 })
same('the same item twice in the list counts once', progressFor({ main_state: 'th', route: 'kp' }, [...ITEMS, item('th-kp-1', 'th', 'kp')], ticked('th-kp-1')), { done: 1, total: 1, percent: 100 })
same('text: "25 % (1 de 4)"', progressText({ done: 1, total: 4, percent: 25 }), '25 % (1 de 4)')

// Rounding
{
  const many = (n: number) => Array.from({ length: n }, (_, i) => item('x' + i, 'be', 'kp'))
  const first = (n: number) => Array.from({ length: n }, (_, i) => ({ item_id: 'x' + i }))
  const pct = (done: number, total: number) => progressFor({ main_state: 'be', route: 'kp' }, many(total), first(done))?.percent
  same('1 of 3 rounds to 33', pct(1, 3), 33)
  same('2 of 3 rounds to 67', pct(2, 3), 67)
  same('1 of 8 (12.5) rounds to 13', pct(1, 8), 13)
  same('199 of 200 is 99, never 100 before the end', pct(199, 200), 99)
  same('1 of 300 is 1, never 0 once something is ticked', pct(1, 300), 1)
  same('0 of 300 is 0', pct(0, 300), 0)
  same('300 of 300 is 100', pct(300, 300), 100)
}

/* ===========================================================================
   "No aplica" steps (DECISIONS.md, 20 and 21 Nov 2026): left out of the %,
   of both kinds (template default and client layer), and a tick on such a
   step never counts
   =========================================================================== */
{
  // Baden-Württemberg + route md: 5 steps, 2 of them "no aplica" by default
  const NA_ITEMS: Item[] = [
    item('bw-1', 'bw', 'md'), item('bw-2', 'bw', 'md'), item('bw-3', 'bw', 'md'),
    item('bw-na-1', 'bw', 'md', true), item('bw-na-2', 'bw', 'md', true),
  ]
  const bw = { main_state: 'bw', route: 'md' }
  const set = (item_id: string, applies: boolean | null) => ({ item_id, applies })

  same('the rule: template default "aplica"', stepApplies({ na_default: false }, null), true)
  same('the rule: template default "no aplica"', stepApplies({ na_default: true }, undefined), false)
  same('the rule: "Según la plantilla" (null) keeps the default', stepApplies({ na_default: true }, { applies: null }), false)
  same('the rule: the client layer\'s "Aplica" wins', stepApplies({ na_default: true }, { applies: true }), true)
  same('the rule: the client layer\'s "No aplica" wins', stepApplies({ na_default: false }, { applies: false }), false)

  same('template "no aplica" steps are left out of the total', progressFor(bw, NA_ITEMS, []), { done: 0, total: 3, percent: 0 })
  same('a tick on a template "no aplica" step never counts', progressFor(bw, NA_ITEMS, ticked('bw-na-1', 'bw-na-2', 'bw-1')),
    { done: 1, total: 3, percent: 33 })
  same('client layer "No aplica" is left out too', progressFor(bw, NA_ITEMS, ticked('bw-1'), [set('bw-2', false)]),
    { done: 1, total: 2, percent: 50 })
  same('a tick on a client layer "No aplica" step never counts', progressFor(bw, NA_ITEMS, ticked('bw-2', 'bw-3'), [set('bw-2', false)]),
    { done: 1, total: 2, percent: 50 })
  same('client layer "Aplica" brings a default "no aplica" step back, with its tick', progressFor(bw, NA_ITEMS, ticked('bw-na-1'), [set('bw-na-1', true)]),
    { done: 1, total: 4, percent: 25 })
  same('"Según la plantilla" (null) keeps the default', progressFor(bw, NA_ITEMS, ticked('bw-na-1'), [set('bw-na-1', null)]),
    { done: 0, total: 3, percent: 0 })
  same('every step ticked that applies: 100 %, ticks on the others ignored',
    progressFor(bw, NA_ITEMS, ticked('bw-1', 'bw-3', 'bw-na-1', 'bw-2'), [set('bw-2', false)]),
    { done: 2, total: 2, percent: 100 })
  same('nothing applies: —', progressFor(bw, NA_ITEMS, ticked('bw-1'),
    [set('bw-1', false), set('bw-2', false), set('bw-3', false)]), null)
  same('a client layer row for another state\'s step changes nothing', progressFor(bw, NA_ITEMS, ticked('bw-1'), [set('by-kp-1', false)]),
    { done: 1, total: 3, percent: 33 })

  // The overview: each client only gets their own client-layer rows
  const clients = [client('gabi', 'bw', 'md'), client('hugo', 'bw', 'md')]
  const ticks = [
    tick('gabi', 'bw-1'), tick('gabi', 'bw-na-1'), tick('gabi', 'bw-2'),
    tick('hugo', 'bw-1'), tick('hugo', 'bw-2'),
  ]
  const settings: ItemSetting[] = [
    { user_id: 'gabi', item_id: 'bw-2', applies: false },
    { user_id: 'hugo', item_id: 'bw-na-2', applies: true },
  ]
  const summary = summarise(clients, NA_ITEMS, ticks, settings)
  same('overview: gabi\'s ticks on "no aplica" steps of both kinds never count', summary.get('gabi')?.progress,
    { done: 1, total: 2, percent: 50 })
  same('overview: hugo isn\'t affected by gabi\'s client layer, and has his own', summary.get('hugo')?.progress,
    { done: 2, total: 4, percent: 50 })
  same('overview: without client-layer rows, only the template defaults count', summarise(clients, NA_ITEMS, ticks).get('hugo')?.progress,
    { done: 2, total: 3, percent: 67 })
}

/* ===========================================================================
   Last activity
   =========================================================================== */

same('no ticks: none', lastActivity([]), null)
same('one tick', lastActivity([{ done_at: '2026-11-01T10:00:00+00:00' }]), '2026-11-01T10:00:00+00:00')
same('the most recent of several, in any order', lastActivity([
  { done_at: '2026-11-01T10:00:00+00:00' },
  { done_at: '2026-11-15T08:30:00.123456+00:00' },
  { done_at: '2026-10-20T23:59:59+00:00' },
]), '2026-11-15T08:30:00.123456+00:00')
same('compared as moments, not as text', lastActivity([
  { done_at: '2026-11-15T09:00:00+02:00' },   // 07:00 UTC
  { done_at: '2026-11-15T08:00:00+00:00' },   // 08:00 UTC: later
]), '2026-11-15T08:00:00+00:00')

/* ===========================================================================
   The whole overview at once
   =========================================================================== */
{
  const clients = [
    client('ana', 'by', 'kp'),      // 2 of 4 in Bayern/kp, plus an old Thüringen tick
    client('beto', 'by', 'kp'),     // nothing ticked
    client('caro', null, 'kp'),     // no state, but has an old tick
    client('dani', 'by', null),     // no route
    client('eva', 'th', 'kp'),      // 1 of 1
    client('fer', 'sl', 'kp'),      // no items for Saarland yet
  ]
  const ticks = [
    tick('ana', 'by-kp-1', '2026-11-02T10:00:00+00:00'),
    tick('ana', 'by-kp-3', '2026-11-10T10:00:00+00:00'),
    tick('ana', 'th-kp-1', '2026-11-12T10:00:00+00:00'),   // her old state: not in the %, but it is activity
    tick('caro', 'by-kp-1', '2026-10-01T10:00:00+00:00'),
    tick('eva', 'th-kp-1', '2026-11-05T10:00:00+00:00'),
    tick('someone-else', 'by-kp-2', '2026-11-16T10:00:00+00:00'),  // not in the client list (an admin, say)
  ]
  const summary = summarise(clients, ITEMS, ticks)
  same('one result per client', summary.size, 6)
  same('ana: 2 of 4; last activity is her latest tick, even in an old state', summary.get('ana'),
    { progress: { done: 2, total: 4, percent: 50 }, lastActivity: '2026-11-12T10:00:00+00:00' })
  same('beto: 0 of 4, no activity; other clients\' ticks are not his', summary.get('beto'),
    { progress: { done: 0, total: 4, percent: 0 }, lastActivity: null })
  same('caro: no state gives —, but her old tick is still her last activity', summary.get('caro'),
    { progress: null, lastActivity: '2026-10-01T10:00:00+00:00' })
  same('dani: no route gives —', summary.get('dani'), { progress: null, lastActivity: null })
  same('eva: 1 of 1', summary.get('eva'),
    { progress: { done: 1, total: 1, percent: 100 }, lastActivity: '2026-11-05T10:00:00+00:00' })
  same('fer: no items yet gives —', summary.get('fer'), { progress: null, lastActivity: null })
  same('no clients, no results', summarise([], ITEMS, ticks).size, 0)
}

/* ===========================================================================
   Names, states, sorting
   =========================================================================== */

same('name is "first_name last_names"', clientName({ first_name: 'María Fernanda', last_names: 'García López' }), 'María Fernanda García López')
same('spaces around the name are removed', clientName({ first_name: ' José ', last_names: ' Pérez ' }), 'José Pérez')
same('first name only', clientName({ first_name: 'José', last_names: null }), 'José')
same('no name yet', clientName({ first_name: null, last_names: null }), '')
same('a name of only spaces is no name', clientName({ first_name: '  ', last_names: '' }), '')

/* ===========================================================================
   What an admin has to act on, and the number of documents
   =========================================================================== */

same('paid with state and route: nothing missing', setupMissing({ plan: 'paid', main_state: 'by', route: 'r1' }), { state: false, route: false })
same('paid without a state', setupMissing({ plan: 'paid', main_state: null, route: 'r1' }), { state: true, route: false })
same('paid without a route', setupMissing({ plan: 'paid', main_state: 'by', route: null }), { state: false, route: true })
same('paid without both', setupMissing({ plan: 'paid', main_state: null, route: null }), { state: true, route: true })
same('paid with a state code the map doesn\'t know: no state', setupMissing({ plan: 'paid', main_state: 'xx', route: 'r1' }), { state: true, route: false })
same('free without both: no Alerta', setupMissing({ plan: 'free', main_state: null, route: null }), { state: false, route: false })

same('no documents', documentCountText(0), 'Sin documentos')
same('one document', documentCountText(1), '1 documento')
same('two documents', documentCountText(2), '2 documentos')
same('many documents', documentCountText(25), '25 documentos')
same('clients by name, without a name last (by email)', sortClients([
  client('1', null, null, { email: 'z@example.com' }),
  client('2', null, null, { first_name: 'Óscar', last_names: 'Zea' }),
  client('3', null, null, { email: 'a@example.com' }),
  client('4', null, null, { first_name: 'ana', last_names: 'Mora' }),
  client('5', null, null, { first_name: 'Nora', last_names: 'Paz' }),
]).map((c) => c.id), ['4', '5', '2', '3', '1'])
same('16 states', STATES.length, 16)
same('state names are German', [stateName('by'), stateName('nw'), stateName('th')], ['Bayern', 'Nordrhein-Westfalen', 'Thüringen'])
same('no state has no name', [stateName(null), stateName('xx')], ['', ''])

/* ===========================================================================
   News status
   =========================================================================== */
{
  const now = Date.parse('2026-11-16T12:00:00Z')
  same('not published: Borrador', newsStatus({ published: false, published_at: '2026-11-01T00:00:00Z' }, now), 'draft')
  same('not published with a future date: still Borrador', newsStatus({ published: false, published_at: '2027-01-01T00:00:00Z' }, now), 'draft')
  same('published, date in the future: Programada', newsStatus({ published: true, published_at: '2026-11-16T12:00:01Z' }, now), 'scheduled')
  same('published, date exactly now: Publicada', newsStatus({ published: true, published_at: '2026-11-16T12:00:00Z' }, now), 'published')
  same('published, date in the past: Publicada', newsStatus({ published: true, published_at: '2026-11-15T09:00:00+00:00' }, now), 'published')
  same('news newest first', sortNews([
    { id: 'a', published_at: '2026-11-01T00:00:00Z' },
    { id: 'b', published_at: '2026-12-01T00:00:00Z' },
    { id: 'c', published_at: '2026-11-15T00:00:00Z' },
  ]).map((p) => p.id), ['b', 'c', 'a'])
}

/* ===========================================================================
   Reading a table in pages
   =========================================================================== */

interface Row { id: string }
/** A pretend table of `total` rows, always in the same order (by id) */
function table(total: number) {
  const rows: Row[] = Array.from({ length: total }, (_, i) => ({ id: 'row-' + String(i).padStart(5, '0') }))
  const calls: [number, number][] = []
  const fetchPage = async (from: number, to: number): Promise<Page<Row>> => {
    calls.push([from, to])
    return { data: rows.slice(from, to + 1), error: null, count: total }
  }
  return { rows, calls, fetchPage }
}
const byId = (row: Row) => row.id

{
  const t = table(0)
  same('empty table: no rows', (await readAll(t.fetchPage, byId)).length, 0)
  same('empty table: one request', t.calls, [[0, 999]])
}
{
  const t = table(25)
  same('small table: every row', (await readAll(t.fetchPage, byId)).length, 25)
  same('small table: one request', t.calls, [[0, 999]])
}
{
  const t = table(1000)
  same('exactly one full page: every row', (await readAll(t.fetchPage, byId)).length, 1000)
  same('exactly one full page: one request', t.calls, [[0, 999]])
}
{
  const t = table(2501)
  const all = await readAll(t.fetchPage, byId)
  same('2,501 rows: every row once, in order', all.map(byId).join(), t.rows.map(byId).join())
  same('2,501 rows: three requests, one after the other', t.calls, [[0, 999], [1000, 1999], [2000, 2999]])
}
{
  // The server hands out fewer rows per request than asked for
  const t = table(2501)
  const capped = async (from: number, to: number) => {
    const page = await t.fetchPage(from, to)
    return { ...page, data: (page.data ?? []).slice(0, 400) }
  }
  same('a server limit below the page size still reads every row', (await readAll(capped, byId)).length, 2501)
}
{
  // No row count from the server: stops at the first empty page
  const t = table(2000)
  const noCount = async (from: number, to: number) => ({ ...(await t.fetchPage(from, to)), count: null })
  same('without a count: every row', (await readAll(noCount, byId)).length, 2000)
  same('without a count: stops at the empty page', t.calls.length, 3)
}
{
  // A row added in front while reading pushes one row onto the next page too
  const t = table(15)
  let call = 0
  const shifting = async (from: number, to: number): Promise<Page<Row>> => {
    const shift = call++ === 0 ? 0 : 1
    return { data: t.rows.slice(Math.max(0, from - shift), to + 1 - shift), error: null, count: 15 }
  }
  const all = await readAll(shifting, byId, 10)
  same('a row that arrives twice is kept once', all.length, new Set(all.map(byId)).size)
}
{
  // A server that ignores the page and always answers the same rows
  const stuck = async (): Promise<Page<Row>> => ({ data: [{ id: 'a' }, { id: 'b' }], error: null, count: null })
  same('never asks forever', (await readAll(stuck, byId, 2)).length, 2)
}
{
  const t = table(1500)
  let call = 0
  const failing = async (from: number, to: number): Promise<Page<Row>> =>
    call++ === 0 ? t.fetchPage(from, to) : { data: null, error: { code: 'PGRST301' }, count: null }
  let thrown: unknown = null
  try { await readAll(failing, byId) } catch (err) { thrown = err }
  same('a failed page stops with the database\'s error (no half list)', thrown, { code: 'PGRST301' })
}

/* =========================================================================== */

if (failures.length) {
  console.error(`${failures.length} FAILED, ${passed} passed\n`)
  for (const failure of failures) console.error('FAIL: ' + failure + '\n')
  process.exitCode = 1
} else {
  console.log(`ALL ADMIN LOGIC TESTS PASSED (${passed} checks, device time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone})`)
}
