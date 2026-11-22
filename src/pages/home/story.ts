import { useLayoutEffect, type RefObject } from 'react'
import styles from '../Home.module.css'
import { one } from './dom.ts'

/*
  Mi historia (from design-hero/story.js): one pinned screen in which the
  "now" layout (hoy, después) slides up from below and covers "then" (bio,
  mis inicios, antes) as you scroll, while "then" stays still underneath.

  Each layout has a rest zone (--story-hold of scroll) where nothing
  changes: "then" stays put for a while after it fills the screen, and
  "now" stays put for a while before the section moves on. So a casual
  scroll while reading does not tip you into the next one.

  No snapping (owner's choice): the page rests wherever you stop, even half
  way through the slide. It follows the scroll both ways.

  Clean-up when the page is left: every listener is removed (one
  AbortController), the waiting animation frame is cancelled, and the class
  added here is removed.
*/

export function useStory(rootRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    const story = root && one(root, styles.story)
    const pin = story && one(story, styles.storyPin)
    if (!story || !pin) return
    const ac = new AbortController()
    const { signal } = ac

    // the slide runs from a ("then" fully shown, after its rest) to b ("now"
    // fully in place, before its rest)
    function points(): [number, number] {
      const top = story!.getBoundingClientRect().top + window.scrollY
      const extra = story!.offsetHeight - pin!.offsetHeight // 2 rests + the slide
      const cs = getComputedStyle(story!)
      const H = parseFloat(cs.getPropertyValue('--story-hold'))
      const F = parseFloat(cs.getPropertyValue('--story-fade'))
      const hold = (extra * H) / (2 * H + F)
      return [top + hold, top + extra - hold]
    }

    function paint(): void {
      const [a, b] = points()
      const f = Math.min(1, Math.max(0, (window.scrollY - a) / (b - a)))
      story!.style.setProperty('--f', f.toFixed(3))
      story!.classList.toggle(styles.isNow, f > 0.5)
    }

    let raf = 0
    const schedule = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0
          paint()
        })
      }
    }

    paint()
    window.addEventListener('scroll', schedule, { passive: true, signal })
    window.addEventListener('resize', schedule, { signal })

    return () => {
      ac.abort()
      cancelAnimationFrame(raf)
      story.classList.remove(styles.isNow)
    }
  }, [rootRef])
}
