/* Search by city or state name, ported from design-mockup/estados.html.
   "Köln", "koln" and "koeln" all find Köln; "Baviera" finds Bayern. */

import { CITIES, STATE_ALIASES } from './cities.ts'
import { MAP_STATES, type MapState } from './mapAnimations.ts'

export interface SearchEntry {
  label: string        /* what the list shows: the city or the state */
  state: MapState
  isState: boolean
  keys: { key: string; alias: string | null }[]
  order: number        /* bigger cities come first in CITIES */
}

export interface SearchHit {
  e: SearchEntry
  rank: number
  alias: string | null /* the other spelling that matched, shown in grey */
}

/* "Köln", "koln" and "koeln" all become the same search key */
export function plain(t: string): string {
  return t.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}
function umlautSpelled(t: string): string {
  return t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
}
function keysFor(names: string[]): SearchEntry['keys'] {
  const keys: SearchEntry['keys'] = []
  names.forEach((n, i) => {
    [plain(n), plain(umlautSpelled(n))].forEach((k) => {
      keys.push({ key: k, alias: i > 0 ? n : null })
    })
  })
  return keys
}

const byId = new Map(MAP_STATES.map((s) => [s.id, s]))

const entries: SearchEntry[] = []
MAP_STATES.forEach((s) => {
  const aliases = STATE_ALIASES['st-' + s.id]
  const names = [s.name].concat(aliases ? aliases.split(',') : [])
  entries.push({ label: s.name, state: s, isState: true, keys: keysFor(names), order: -1 })
})
CITIES.forEach((row, i) => {
  const p = row.split('|')
  const state = byId.get(p[1].toLowerCase())!
  if (plain(p[0]) === plain(state.name)) return   /* Berlin, Hamburg, Bremen: the state already covers it */
  const names = [p[0]].concat(p[2] ? p[2].split(',') : [])
  entries.push({ label: p[0], state, isState: false, keys: keysFor(names), order: i })
})

/* Best match first: states before cities, whole name before a later word,
   bigger cities (earlier in the list) before smaller ones */
export function search(query: string): SearchHit[] {
  const q = plain(query)
  if (!q) return []
  const hits: SearchHit[] = []
  for (const e of entries) {
    let best: { rank: number; alias: string | null } | null = null
    for (const k of e.keys) {
      const rank = k.key.indexOf(q) === 0 ? 0
        : (' ' + k.key).indexOf(' ' + q) !== -1 ? 1 : -1
      if (rank !== -1 && (!best || rank < best.rank || (rank === best.rank && best.alias && !k.alias))) {
        best = { rank, alias: k.alias }
      }
    }
    if (best) hits.push({ e, rank: best.rank, alias: best.alias })
  }
  hits.sort((a, b) =>
    (a.e.isState === b.e.isState ? 0 : a.e.isState ? -1 : 1)
    || a.rank - b.rank || a.e.order - b.e.order)
  return hits.slice(0, 6)
}
