import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import styles from '../Home.module.css'

/*
  Everything the home page changes outside itself while it is open, and
  takes back when it is left:

  - usePageChrome: the class on <body> (the page's dark background and
    font, Home.module.css .page-body); a top scroll padding on <html> the
    height of the fixed header, so a section reached by a header link, or
    a link reached with Tab, is never hidden under the header; and smooth
    scrolling for the header links, only when "reduce motion" is off (the
    links are real anchors, #historias…, and work without it).

  - useCallBar: whether the phone's bottom bar with the Calendly button
    shows (below 768px; DECISIONS.md, 23 and 24 Nov 2026). It shows once
    the hero has scrolled away above the screen, and hides while any part
    of the price section ("Ruta Approbation", which has its own button) is
    on screen. Two IntersectionObservers watch the two sections (no work
    on every scroll). On phones <html> also gets a bottom scroll padding
    the bar's height, so a link reached with Tab is never behind the bar.
    While the menu is open the bar hides too (a CSS rule, .page:has()).
*/

export function usePageChrome(headerRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const html = document.documentElement
    const header = headerRef.current
    document.body.classList.add(styles.pageBody)

    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    const setBehavior = () => {
      html.style.scrollBehavior = reduce.matches ? '' : 'smooth'
    }
    setBehavior()
    reduce.addEventListener('change', setBehavior)

    const setPadding = () => {
      html.style.scrollPaddingTop = header ? header.offsetHeight + 'px' : ''
    }
    setPadding()
    const ro = header ? new ResizeObserver(setPadding) : null
    if (header) ro!.observe(header)

    return () => {
      document.body.classList.remove(styles.pageBody)
      reduce.removeEventListener('change', setBehavior)
      ro?.disconnect()
      html.style.removeProperty('scroll-behavior')
      html.style.removeProperty('scroll-padding-top')
    }
  }, [headerRef])
}

export function useCallBar(
  heroRef: RefObject<HTMLElement | null>,
  priceRef: RefObject<HTMLElement | null>,
  barRef: RefObject<HTMLElement | null>,
): boolean {
  const [heroGone, setHeroGone] = useState(false)
  const [priceOnScreen, setPriceOnScreen] = useState(false)

  useEffect(() => {
    const hero = heroRef.current
    const price = priceRef.current
    if (!hero || !price || !('IntersectionObserver' in window)) return
    const heroIo = new IntersectionObserver(([e]) => {
      // gone = not on screen any more, and above it (not below)
      setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0)
    })
    const priceIo = new IntersectionObserver(([e]) => setPriceOnScreen(e.isIntersecting))
    heroIo.observe(hero)
    priceIo.observe(price)
    return () => {
      heroIo.disconnect()
      priceIo.disconnect()
    }
  }, [heroRef, priceRef])

  // Phones: room at the bottom for the bar when scrolling to a focused link
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const html = document.documentElement
    const phone = matchMedia('(max-width: 767px)')
    const update = () => {
      // the bar keeps its size while hidden (only its visibility changes)
      html.style.scrollPaddingBottom = phone.matches ? bar.offsetHeight + 'px' : ''
    }
    update()
    phone.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      phone.removeEventListener('change', update)
      window.removeEventListener('resize', update)
      html.style.removeProperty('scroll-padding-bottom')
    }
  }, [barRef])

  return heroGone && !priceOnScreen
}
