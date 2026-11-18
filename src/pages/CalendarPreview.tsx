import { useState } from 'react'
import { utcToBerlin } from '../lib/berlinTime.ts'
import styles from './CalendarPreview.module.css'

/* The example events: one type only ("Webinars / reuniones"), on fixed
   days of whatever month is shown. Every month has these days. */
const EXAMPLE_DAYS = [5, 19, 26]

/* "noviembre de 2026" -> "Noviembre 2026" */
const MONTH = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
function monthTitle(year: number, month: number): string {
  const text = MONTH.format(new Date(Date.UTC(year, month - 1, 1))).replace(' de ', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The calendar in the dark column: a preview only, it doesn't work yet
    ("Próximamente"). It shows the current month with today marked, both in
    German time (Europe/Berlin), and a few example webinars. */
export default function CalendarPreview() {
  // Today in Germany, whatever the device's own time zone ("2026-11-18"),
  // read once when the page opens
  const [now] = useState(() => Date.now())
  const [year, month, today] = utcToBerlin(now).date.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  // Empty cells before the 1st: weeks start on Monday (getUTCDay: 0 = Sunday)
  const blanksBefore = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const blanksAfter = (7 - ((blanksBefore + daysInMonth) % 7)) % 7

  const cells = []
  for (let i = 0; i < blanksBefore; i++) cells.push(<span key={'b' + i} aria-hidden="true"></span>)
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = day === today
    const isEvent = EXAMPLE_DAYS.includes(day)
    const className = [isToday && styles.today, isEvent && styles.event].filter(Boolean).join(' ')
    cells.push(
      <span key={day} className={className || undefined} aria-current={isToday ? 'date' : undefined}>
        {day}
        {isEvent && <span className="sr-only">, webinar de ejemplo</span>}
      </span>,
    )
  }
  for (let i = 0; i < blanksAfter; i++) cells.push(<span key={'a' + i} aria-hidden="true"></span>)

  return (
    <section className={styles.calendar} aria-labelledby="cal-heading">
      <div className={styles.head}>
        <h2 className={styles.label} id="cal-heading">Calendario</h2>
        <p className={styles.soon}>Próximamente</p>
      </div>
      <p className={styles.month}>{monthTitle(year, month)}</p>
      <div className={styles.weekdays} aria-hidden="true">
        <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
      </div>
      <div className={styles.days}>{cells}</div>
      <p className={styles.legend}>
        <span className={styles.legendMark} aria-hidden="true"></span>
        Webinars / reuniones (ejemplo)
      </p>
    </section>
  )
}
