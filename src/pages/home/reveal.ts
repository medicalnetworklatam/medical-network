import { useLayoutEffect, type RefObject } from 'react'
import styles from '../Home.module.css'
import { all, clamp, one, smooth } from './dom.ts'

/*
  Circle transition on the pinned .hero-track (from design-hero/reveal.js).
  The track pins its hero while you scroll through its .hero-track__grow
  spacer, and a circle centred on the screen changes size with the scroll.

  .intro: the circle grows with the scroll and shows only the title,
  centred. Once the whole title fits inside, the section "opens": the
  circle widens to full screen, the title glides to its place and the rest
  fades in. Scrolling back up runs the same motion in reverse, following
  the scroll. With reduced motion the opening jumps to where it is heading
  instead of easing there.

  Clean-up when the page is left: every listener is removed (one
  AbortController) and the waiting animation frame is cancelled.
*/

const HOLD = 0.15 // last share of each grow distance spent at rest
const BACK = 0.22 // how far below the opening point the reverse finishes (share of the grow)
const EASE = 0.11 // how quickly the opening catches up with its target, per frame at 60fps

interface Circle {
  track: HTMLElement
  grow: HTMLElement
  el: HTMLElement
  title: HTMLElement | null
  open: boolean
  q: number
  tMax: number
}

export function useReveal(rootRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    const circles: Circle[] = []
    for (const track of all(root, styles.heroTrack)) {
      const grow = one(track, styles.heroTrackGrow)
      const opener = one(track, styles.intro)
      if (grow && opener) {
        circles.push({ track, grow, el: opener, title: one(opener, styles.introTitle), open: false, q: 0, tMax: 0 })
      }
    }
    if (!circles.length) return
    const ac = new AbortController()
    const { signal } = ac

    let first = true
    let last = performance.now()

    function update(now = performance.now()): void {
      const w = window.innerWidth
      const h = window.innerHeight
      const full = Math.hypot(w / 2, h / 2) + 2 // centre-to-corner distance
      const dt = Math.min(64, now - last)
      last = now
      let moving = false

      circles.forEach((c) => {
        const { track, grow, el, title } = c
        const scrolled = -track.getBoundingClientRect().top
        const t = clamp(scrolled / (grow.offsetHeight * (1 - HOLD)))
        const top = el.getBoundingClientRect().top
        const cy = h / 2 - top

        const need = title ? Math.hypot(title.offsetWidth / 2, title.offsetHeight / 2) * 1.1 : 0
        const tOpen = Math.min(1, need / full) // scroll point where the title fits
        const back = Math.min(BACK, tOpen * 0.6)

        // where the opening should be heading
        if (!c.open && t >= tOpen) {
          c.open = true
          c.tMax = t
        }
        let target = 0
        if (c.open) {
          // Once open, the motion is spread over all the scroll from the furthest
          // point reached (tMax) back to a little before the opening point, so
          // scrolling up undoes it gradually from the very first pixel.
          c.tMax = Math.max(c.tMax, t)
          const from = tOpen - back
          target = clamp((t - from) / Math.max(c.tMax - from, 1e-3))
        }

        // ease q toward the target (instant on first paint or with reduced motion)
        if (first || reduce.matches) c.q = target
        else c.q += (target - c.q) * (1 - Math.pow(1 - EASE, dt / 16.7))
        if (Math.abs(target - c.q) < 0.001) c.q = target
        else moving = true
        if (c.open && c.q === 0 && t < tOpen) {
          c.open = false
          c.tMax = 0
        }

        const e = smooth(c.q)
        const r = t * full + (full - t * full) * e
        setCircle(el, r, full, cy)

        if (title) {
          const dx = w / 2 - (title.offsetLeft + title.offsetWidth / 2)
          const dy = cy - (title.offsetTop + title.offsetHeight / 2)
          title.style.setProperty('--tx', (dx * (1 - e)).toFixed(1) + 'px')
          title.style.setProperty('--ty', (dy * (1 - e)).toFixed(1) + 'px')
        }
        el.style.setProperty('--o', clamp((e - 0.5) / 0.5).toFixed(3)) // rest fades in on the second half
      })

      first = false
      if (moving) schedule()
    }

    function setCircle(el: HTMLElement, r: number, full: number, cy: number): void {
      if (r >= full - 0.5) {
        el.style.clipPath = 'none' // fully covering: no clipping
        return
      }
      el.style.clipPath = ''
      el.style.setProperty('--r', Math.max(0, r).toFixed(1) + 'px')
      el.style.setProperty('--cy', cy.toFixed(1) + 'px')
    }

    let raf = 0
    function schedule(): void {
      if (!raf) {
        raf = requestAnimationFrame((now) => {
          raf = 0
          update(now)
        })
      }
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true, signal })
    window.addEventListener('resize', schedule, { signal })
    window.addEventListener('load', schedule, { signal }) // images can change the layout

    return () => {
      ac.abort()
      cancelAnimationFrame(raf)
    }
  }, [rootRef])
}
