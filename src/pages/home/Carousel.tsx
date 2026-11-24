import { Children, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { home } from '../../content/home.ts'
import styles from './Carousel.module.css'

const DESKTOP = '(min-width: 1024px)'
const REDUCE = '(prefers-reduced-motion: reduce)'

/** True while the media query matches (follows changes, e.g. a resize) */
function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** The home page's one carousel (Historias, Cómo funciona, Qué incluye).
    Each child is one card; the cards' look is the page's (Home.module.css).

    - From 1024px: the row of cards slides sideways (a CSS transform,
      500ms ease-out) so the current card is in the middle; the others are
      smaller and faded. "Anterior" / "Siguiente" and one dot per card
      ("Ir a la tarjeta 2") move it, and so do the left and right arrow
      keys while one of those buttons has the focus. Clicking a faded card
      brings it to the middle.
    - Below 1024px: the row is swiped with a finger and stops on each card
      (the browser's own scroll-snap, no script). The dots follow the card
      in view and jump to a card when tapped.
    - With one card: no buttons and no dots.
    - With "reduce motion": no slide or smooth scroll, it jumps.
    Every card is as tall as the tallest one. */
export default function Carousel({ label, children }: {
  /** What screen readers call the carousel */
  label: string
  children: ReactNode
}) {
  const slides = Children.toArray(children)
  const count = slides.length
  const [index, setIndex] = useState(0)
  const [announce, setAnnounce] = useState('')
  const desktop = useMedia(DESKTOP)
  const reduce = useMedia(REDUCE)
  const trackRef = useRef<HTMLDivElement>(null)

  /** How far apart two cards are, in px (a card's width plus the gap) */
  function step(): number {
    const track = trackRef.current
    const first = track?.querySelector<HTMLElement>('.' + CSS.escape(styles.slide))
    if (!track || !first) return 0
    return first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || '0')
  }

  function goTo(i: number, speak: boolean): void {
    const next = Math.max(0, Math.min(count - 1, i))
    setIndex(next)
    if (speak) setAnnounce(home.carousel.status(next + 1, count))
    // Phones: scroll the row to that card (the transform isn't used there)
    if (!desktop && trackRef.current) {
      trackRef.current.scrollTo({ left: next * step(), behavior: reduce ? 'auto' : 'smooth' })
    }
  }

  // Phones: the dots follow the card that a swipe brought to the middle
  useEffect(() => {
    const track = trackRef.current
    if (desktop || !track) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const s = step()
        if (s > 0) setIndex(Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / s))))
      })
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      track.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [desktop, count])

  // Switching between the two layouts (a resize): keep the same card.
  // Only on a switch, so the index is read from a ref.
  const indexRef = useRef(index)
  useEffect(() => {
    indexRef.current = index
  }, [index])
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    track.scrollLeft = desktop ? 0 : indexRef.current * step()
  }, [desktop])

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(index + (e.key === 'ArrowRight' ? 1 : -1), true)
    }
  }

  const several = count > 1

  return (
    <div
      className={styles.carousel}
      role="region"
      aria-roledescription={home.carousel.carousel}
      aria-label={label}
    >
      <div className={styles.viewport}>
        <div
          className={`${styles.track} ${several ? '' : styles.single}`}
          ref={trackRef}
          style={{ '--i': index } as CSSProperties}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              className={`${styles.slide} ${i === index ? styles.current : ''}`}
              role="group"
              aria-roledescription={home.carousel.card}
              aria-label={several ? home.carousel.status(i + 1, count) : undefined}
              onClick={desktop && i !== index ? () => goTo(i, false) : undefined}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {several && (
        <div className={styles.controls} onKeyDown={onKeyDown}>
          <button
            type="button"
            className={`${styles.arrow} ${styles.prev}`}
            aria-label={home.carousel.prev}
            disabled={index === 0}
            onClick={() => goTo(index - 1, true)}
          >
            <Chevron />
          </button>
          <div className={styles.dots}>
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={styles.dot}
                aria-label={home.carousel.goTo(i + 1)}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => goTo(i, true)}
              >
                <span className={styles.dotMark} aria-hidden="true"></span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${styles.arrow} ${styles.next}`}
            aria-label={home.carousel.next}
            disabled={index === count - 1}
            onClick={() => goTo(index + 1, true)}
          >
            <Chevron />
          </button>
        </div>
      )}

      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>
  )
}

/** A right-pointing chevron; the "Anterior" button flips it with CSS */
export function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
