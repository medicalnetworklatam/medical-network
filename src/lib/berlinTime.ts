/* German time (Europe/Berlin) for the admin screens.

   The database stores a moment in time ("timestamptz"), which has no time
   zone of its own. The admin types a date and a time as a clock in Germany
   would show them, so they have to be converted to that moment, and back for
   display. Germany is 1 hour ahead of world time (UTC) in winter and 2 hours
   ahead in summer; the browser's built-in time zone data knows which applies
   on any date, so nothing here depends on the device's own time zone.

   Only pure functions: tested by tests/adminLogic.test.ts (npm test). */

const ZONE = 'Europe/Berlin'
const DAY = 24 * 60 * 60 * 1000

/* Reads the German clock at a given moment, as numbers */
const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
})

/** The German clock at moment `ms`, written as if it were a UTC time.
    (Two of these can be compared or subtracted like ordinary times.) */
function berlinWallClock(ms: number): number {
  const p: Record<string, number> = {}
  for (const part of PARTS.formatToParts(new Date(ms))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}

/** How far the German clock is ahead of UTC at moment `ms`, in milliseconds
    (1 hour in winter, 2 hours in summer) */
function offsetAt(ms: number): number {
  const wholeSeconds = Math.floor(ms / 1000) * 1000
  return berlinWallClock(wholeSeconds) - wholeSeconds
}

const two = (n: number) => String(n).padStart(2, '0')

export type BerlinToUtc =
  | { ok: true; iso: string }
  /** 'invalid': not a real date or time.
      'gap': that time doesn't exist in Germany: on the last Sunday of March
      the clocks jump from 02:00 straight to 03:00. */
  | { ok: false; reason: 'invalid' | 'gap' }

/** Turns a German date ("2026-11-16") and time ("14:05"), as <input
    type="date"> and <input type="time"> give them, into the moment to store
    ("2026-11-16T13:05:00.000Z").

    On the last Sunday of October the hour from 02:00 to 02:59 happens twice
    (the clocks go back). The first one (still summer time) is used. */
export function berlinToUtc(date: string, time: string): BerlinToUtc {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(time)
  if (!d || !t) return { ok: false, reason: 'invalid' }
  const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])]
  const [hour, minute] = [Number(t[1]), Number(t[2])]
  if (hour > 23 || minute > 59) return { ok: false, reason: 'invalid' }

  // The typed clock time, written as if it were UTC
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const check = new Date(wall)
  // 31 February and the like roll over to another day: refuse them
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return { ok: false, reason: 'invalid' }
  }

  // The offset one day before and one day after covers both sides of a
  // clock change. Try each: the right moment is one whose German clock
  // shows exactly what was typed.
  const offsets = new Set([offsetAt(wall - DAY), offsetAt(wall + DAY)])
  const moments: number[] = []
  for (const offset of offsets) {
    const moment = wall - offset
    if (berlinWallClock(moment) === wall) moments.push(moment)
  }
  if (moments.length === 0) return { ok: false, reason: 'gap' }
  return { ok: true, iso: new Date(Math.min(...moments)).toISOString() }
}

/** The German date and time of a stored moment, in the form the date and
    time inputs use: { date: "2026-11-16", time: "14:05" }. Seconds are
    dropped. Returns empty strings for something that isn't a date. */
export function utcToBerlin(iso: string | number): { date: string; time: string } {
  const ms = typeof iso === 'number' ? iso : Date.parse(iso)
  if (Number.isNaN(ms)) return { date: '', time: '' }
  const wall = new Date(berlinWallClock(ms))
  return {
    date: String(wall.getUTCFullYear()).padStart(4, '0') + '-' + two(wall.getUTCMonth() + 1) + '-' + two(wall.getUTCDate()),
    time: two(wall.getUTCHours()) + ':' + two(wall.getUTCMinutes()),
  }
}

/* "16 nov 2026, 14:05", in German time */
const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  timeZone: ZONE,
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

/** A stored moment as Spanish text in German time: "16 nov 2026, 14:05" */
export function formatBerlinDateTime(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  return DATE_TIME.format(new Date(ms)).replace('.', '')
}
