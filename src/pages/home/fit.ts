import { useLayoutEffect, type RefObject } from 'react'
import styles from '../Home.module.css'
import { all } from './dom.ts'

/*
  Justified headline (from design-hero/fit.js): every line of .hero__words
  is sized on its own so all lines start and end at exactly the same x.
  Sizes are measured on the letters' ink (not the font's side bearings), so
  edges line up optically. Both copies of the words (ink + tinted overlay)
  get identical values. Runs for every .hero__stage on the home page. Stages
  in the same hero share one width (the narrowest any of them allows), so
  stacked sentences line up too. data-fit-h limits a stage to a share of the
  screen height.

  Each line is written as <span class="line"><span class="line__ink">…</span>
  </span> in Home.tsx (the prototype's script added the inner span itself).

  Clean-up when the page is left: every listener is removed (one
  AbortController), the waiting animation frame is cancelled, and a late
  "fonts are ready" is ignored.
*/

const GAP = 0.3 // space between lines, as a share of the smallest cap height
const MAX_W = 1400 // never wider than this (px)

interface Line {
  ink: number // ink width at 100px
  left: number // ink start offset at 100px
  cap: number // cap height per px of size
  base: number // baseline from top, line-height 1
}

interface Stage {
  stage: HTMLElement
  layers: HTMLElement[]
  hero: HTMLElement
}

export function useFit(rootRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    const ctx = document.createElement('canvas').getContext('2d')
    if (!root || !ctx) return
    const ac = new AbortController()
    const { signal } = ac

    const heroSelector = [styles.hero, styles.cta].map((c) => '.' + CSS.escape(c)).join(', ')
    const stages: Stage[] = []
    for (const stage of all(root, styles.heroStage)) {
      const hero = stage.closest<HTMLElement>(heroSelector)
      const layers = all(stage, styles.heroWords)
      if (hero && layers.length) stages.push({ stage, layers, hero })
    }

    function measure(s: Stage): Line[] {
      const cs = getComputedStyle(s.layers[0])
      ctx!.font = `${cs.fontWeight} 100px ${cs.fontFamily}`
      return all(s.layers[0], styles.line).map((l) => {
        const m = ctx!.measureText((l.textContent ?? '').trim().toUpperCase())
        const A = (m.fontBoundingBoxAscent ?? 92) / 100
        const D = (m.fontBoundingBoxDescent ?? 24) / 100
        return {
          ink: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
          left: m.actualBoundingBoxLeft,
          cap: m.actualBoundingBoxAscent / 100,
          base: (1 - A - D) / 2 + A,
        }
      })
    }

    // the widest this stage may be: the hero's width, its share of the height, MAX_W
    function limit(s: Stage): number {
      const lines = measure(s)
      // height of the whole block per 1px of width
      const caps = lines.map((l) => (l.cap * 100) / l.ink)
      const k = caps.reduce((a, b) => a + b, 0) + GAP * Math.min(...caps) * (lines.length - 1)

      const pad = parseFloat(getComputedStyle(s.hero).paddingLeft) * 2
      const availW = s.hero.clientWidth - pad
      // data-fit-h: the share of the screen's height this stage may take
      const share = parseFloat(s.stage.dataset.fitH ?? '') || 1
      const availH = (window.innerHeight - 240) * share
      return Math.min(availW, availH / k, MAX_W)
    }

    function fit(s: Stage): void {
      const lines = measure(s)
      const caps = lines.map((l) => (l.cap * 100) / l.ink)
      const siblings = stages.filter((o) => o.hero === s.hero)
      const W = Math.max(200, Math.min(...siblings.map(limit)))

      s.stage.style.setProperty('--stage-w', W + 'px')
      const gap = GAP * Math.min(...caps) * W

      s.layers.forEach((layer) => {
        layer.style.setProperty('--gap', gap + 'px')
        all(layer, styles.line).forEach((el, i) => {
          const l = lines[i]
          const size = (100 * W) / l.ink
          el.style.setProperty('--s', size + 'px')
          el.style.setProperty('--h', l.cap * size + 'px')
          el.style.setProperty('--x', (l.left / 100) * size + 'px')
          el.style.setProperty('--y', -(l.base - l.cap) * size + 'px')
        })
        layer.classList.add(styles.isFitted)
      })
    }

    const fitAll = () => stages.forEach(fit)
    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fitAll)
    }

    fitAll()
    schedule() // again next frame, as in the prototype
    void document.fonts?.ready.then(() => {
      if (!signal.aborted) schedule()
    })
    document.fonts?.addEventListener('loadingdone', schedule, { signal })
    window.addEventListener('resize', schedule, { signal })

    return () => {
      ac.abort()
      cancelAnimationFrame(raf)
      stages.forEach((s) => s.layers.forEach((layer) => layer.classList.remove(styles.isFitted)))
    }
  }, [rootRef])
}
