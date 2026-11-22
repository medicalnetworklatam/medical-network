import { useLayoutEffect, type RefObject } from 'react'
import styles from '../Home.module.css'
import { clamp, one } from './dom.ts'

/*
  Second hero: one sentence pushes the other (from design-hero/push.js).
  The hero is pinned while you scroll through .push-track__push. Sentence B
  rises from just below the screen, linearly with the scroll. Sentence A
  stays in the middle of the screen until B reaches it, then is pushed up
  ahead of B, keeping the same gap. They end as a pair, centred together on
  the screen. Everything is computed from the scroll position, so scrolling
  up reverses it exactly.

  Clean-up when the page is left: every listener is removed (one
  AbortController), the waiting animation frame is cancelled, a late
  "fonts are ready" is ignored, and the classes added here are removed.
*/

// The spacer is 137.5svh (.push-track__push in Home.module.css): the push
// takes the first 85svh, the last 52.5svh are a pause with both sentences on
// screen before the phases start to rise (shortened from 75svh, 23 Nov 2026).
const HOLD = 1 - 85 / 137.5 // last share of the push distance spent at rest

export function usePush(rootRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    const track = root && one(root, styles.pushTrack)
    const hero = track && one(track, styles.hero)
    const push = track && one(track, styles.pushTrackPush)
    const a = hero && one(hero, styles.heroStageA)
    const b = hero && one(hero, styles.heroStageB)
    if (!track || !hero || !push || !a || !b) return
    const ac = new AbortController()
    const { signal } = ac

    hero.classList.add(styles.isPushing)
    track.classList.add(styles.isPushing) // shows the push spacer

    function update(): void {
      const H = hero!.clientHeight
      const hA = a!.offsetHeight
      const hB = b!.offsetHeight
      const scrolled = -track!.getBoundingClientRect().top
      const t = clamp(scrolled / (push!.offsetHeight * (1 - HOLD)))

      // The gap between the two at the end: about half a sentence's height, so
      // they read as one pair, centred together on the screen. On a wide screen,
      // where the sentences are tall, it is capped so each keeps its own half.
      const gap = Math.max(Math.min(0.6 * Math.max(hA, hB), H / 2 - (hA + hB) / 2), H * 0.03)
      const bFrom = H // just below the screen
      const bTo = H / 2 - (hA + gap + hB) / 2 + hA + gap // the pair centred
      const bTop = bFrom + (bTo - bFrom) * t
      const aTop = Math.min(H / 2 - hA / 2, bTop - gap - hA)

      a!.style.setProperty('--top', aTop.toFixed(1) + 'px')
      b!.style.setProperty('--top', bTop.toFixed(1) + 'px')
    }

    let raf = 0
    const schedule = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0
          update()
        })
      }
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true, signal })
    window.addEventListener('resize', schedule, { signal })
    window.addEventListener('load', schedule, { signal })
    void document.fonts?.ready.then(() => {
      if (!signal.aborted) schedule() // fit.ts resizes the words once fonts load
    })

    return () => {
      ac.abort()
      cancelAnimationFrame(raf)
      hero.classList.remove(styles.isPushing)
      track.classList.remove(styles.isPushing)
    }
  }, [rootRef])
}
