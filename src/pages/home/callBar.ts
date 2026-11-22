import { useLayoutEffect, type RefObject } from 'react'
import styles from '../Home.module.css'
import { one } from './dom.ts'

/*
  The bar at the bottom of the screen on phones, with the Calendly button
  (DECISIONS.md, 23 Nov 2026). The bar itself is drawn by Home.tsx and
  styled in Home.module.css (.call-bar): hidden by default, and not drawn
  at all above 700px. This hook only says when it shows (.is-shown):

    - from the point where the circle has fully opened "yo soy tu / ruta."
      (the first hero has gone; the same point the first slide's arrow
      scrolls to)
    - until the closing slide (.cta) reaches the screen: then it hides, and
      it shows again when you scroll back up above the closing slide.

  While the home menu is open the bar hides too (a CSS rule, .page:has()).
  Hidden means visibility: hidden, so Tab and screen readers skip it.

  On phones, the pinned screens leave room for the bar at the bottom
  (--screen in Home.module.css), so it never covers a photo or text you
  can't scroll to. And while the page is open on a phone, <html> gets a
  bottom scroll padding the bar's height: a link or FAQ row reached with
  Tab is scrolled into view above the bar, not behind it.

  Clean-up when the page is left: every listener is removed (one
  AbortController), the waiting animation frame is cancelled, and the
  class and the scroll padding are removed.
*/

export function useCallBar(rootRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    const track = root && one(root, styles.heroTrack)
    const grow = track && one(track, styles.heroTrackGrow)
    const cta = root && one(root, styles.cta)
    const bar = root && one(root, styles.callBar)
    if (!track || !grow || !cta || !bar) return
    const ac = new AbortController()
    const { signal } = ac
    const html = document.documentElement
    const phone = matchMedia('(max-width: 700px)')

    function update(): void {
      const opened = track!.getBoundingClientRect().top + grow!.offsetHeight <= 1
      const ctaOnScreen = cta!.getBoundingClientRect().top < window.innerHeight
      bar!.classList.toggle(styles.isShown, opened && !ctaOnScreen)
      // the bar keeps its size while hidden (only its visibility changes)
      html.style.scrollPaddingBottom = phone.matches ? bar!.offsetHeight + 'px' : ''
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
    phone.addEventListener('change', schedule, { signal })

    return () => {
      ac.abort()
      cancelAnimationFrame(raf)
      bar.classList.remove(styles.isShown)
      html.style.removeProperty('scroll-padding-bottom')
    }
  }, [rootRef])
}
