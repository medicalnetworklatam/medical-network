import { useLayoutEffect, type RefObject } from 'react'
import styles from '../Home.module.css'

/*
  Fade-up: every block marked data-fade in the home page fades in from a
  little lower the first time it comes into view, once.

  An IntersectionObserver (a browser feature that says when an element
  enters the screen) sets data-in on the block; the CSS (Home.module.css,
  .fx) does the rest. Blocks are only hidden once this hook has added .fx
  to the page, so if the script ever fails, nothing stays invisible. With
  "reduce motion" on, it does nothing and everything is simply there.

  When the page is left, the observer stops and .fx is removed.
*/
export function useFadeUp(rootRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !('IntersectionObserver' in window)) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.setAttribute('data-in', '')
          io.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    root.querySelectorAll('[data-fade]').forEach((el) => io.observe(el))
    root.classList.add(styles.fx)

    return () => {
      io.disconnect()
      root.classList.remove(styles.fx)
    }
  }, [rootRef])
}
