import { useState } from 'react'
import { home } from '../../content/home.ts'
import styles from '../Home.module.css'

/** The scrolling strip under the hero: "Te acompaño si eres:" and the four
    routes, moving left in a 16-second loop (a CSS animation). The row is
    drawn twice so the loop has no jump; the second copy is hidden from
    screen readers. It stops while the mouse is over it or the keyboard
    focus is in it, and the button at its end pauses it for good (moving
    content that lasts more than 5 seconds needs a way to stop it).
    With "reduce motion": it stands still, the copy and the button go, and
    the routes wrap onto several lines so every one can be read. */
export default function Strip() {
  const [paused, setPaused] = useState(false)
  const { label, items, pause, resume } = home.strip

  const row = (copy: boolean) => (
    <ul className={styles.stripList} aria-hidden={copy || undefined}>
      {items.map((item) => (
        <li key={item} className={styles.stripItem}>
          {item}
          <span className={styles.stripDot} aria-hidden="true">•</span>
        </li>
      ))}
    </ul>
  )

  return (
    <div className={styles.stripWrap}>
      <div className={`${styles.strip} ${paused ? styles.isPaused : ''}`}>
        <p className={styles.stripLabel}>{label}</p>
        <span className={styles.stripDivider} aria-hidden="true"></span>
        <div className={styles.stripMarquee}>
          <div className={styles.stripTrack}>
            {row(false)}
            {row(true)}
          </div>
        </div>
        <button
          type="button"
          className={styles.stripPause}
          aria-label={paused ? resume : pause}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
