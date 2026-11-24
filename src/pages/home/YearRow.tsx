import { useEffect, useRef, useState, type ReactNode } from 'react'
import { home } from '../../content/home.ts'
import { Chevron } from './Carousel.tsx'
import styles from '../Home.module.css'

/** The year cards of "¿Quién es tu guía?": a row that scrolls sideways
    (swipe, trackpad, or the two buttons under it) and stops on each card.
    The two round buttons show only when the row is wider than the screen
    (on a desktop all five fit); the one that can move is filled.
    Each child is one card (an <li>). */
export default function YearRow({ label, children }: { label: string; children: ReactNode }) {
  const rowRef = useRef<HTMLOListElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const max = row.scrollWidth - row.clientWidth
        setOverflows(max > 1)
        setAtStart(row.scrollLeft <= 1)
        setAtEnd(row.scrollLeft >= max - 1)
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(row)
    row.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      row.removeEventListener('scroll', update)
      cancelAnimationFrame(raf)
    }
  }, [])

  function move(dir: 1 | -1): void {
    const row = rowRef.current
    const card = row?.firstElementChild as HTMLElement | null
    if (!row || !card) return
    const gap = parseFloat(getComputedStyle(row).columnGap || '0')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className={styles.years}>
      <ol className={styles.yearRow} ref={rowRef} aria-label={label}>
        {children}
      </ol>
      {overflows && (
        <div className={styles.yearNav}>
          <button
            type="button"
            className={`${styles.yearBtn} ${styles.yearPrev}`}
            aria-label={home.carousel.prev}
            disabled={atStart}
            onClick={() => move(-1)}
          >
            <Chevron />
          </button>
          <button
            type="button"
            className={styles.yearBtn}
            aria-label={home.carousel.next}
            disabled={atEnd}
            onClick={() => move(1)}
          >
            <Chevron />
          </button>
        </div>
      )}
    </div>
  )
}
