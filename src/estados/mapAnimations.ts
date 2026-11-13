/* The map's drawing and animations, ported from design-mockup/estados.html.

   React decides WHICH states are chosen (see pages/Estados.tsx). This file
   only draws what goes with that, straight into the SVG:
   - the green fill that grows from the black dot (and shrinks back into it),
   - on wide screens, each chosen state's name beside the map with a curved
     line and a dot, pushed apart so names never overlap.
   It stays step-by-step drawing code, like the mock-up, so the timing and
   look stay exactly the same. */

import { MAP_SHAPES } from './mapShapes.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

export const MAP_W = 559.1
export const MAP_H = 760

/* Layout knobs (map units; the map is MAP_H tall) */
export const GUTTER = 250        /* room for names left and right of the map */
const NAME_GAP = 28              /* map edge -> name */
const LINE_GAP = 16              /* map edge -> end of the line */
const LINE_H = 28                /* height of one line of a name */
const NAME_SPACING = 14          /* min. space between two names */
export const HIT_R_MOUSE = 18, HIT_R_TOUCH = 38  /* tap circles for the city-states (38 = 44px on a phone) */
export const SIDE_LABELS = true  /* names with a line beside the map */

export const VIEW_NARROW = [-8, -8, MAP_W + 16, MAP_H + 16].join(' ')
export const VIEW_WIDE = SIDE_LABELS ? [-GUTTER, -20, MAP_W + 2 * GUTTER, MAP_H + 40].join(' ') : VIEW_NARROW

const FLOOD_MS = 550   /* keep equal to the .flood-circle animation */
const MOVE_MS = 320    /* names sliding to their new place */

/** A state with everything the drawing needs to know about it */
export interface MapState {
  id: string        /* ISO code, e.g. "by" */
  name: string      /* German name */
  d: string         /* outline */
  ax: number        /* where the dot, line and green fill start */
  ay: number
  side: 'left' | 'right'
  lines: string[]   /* the name, split in two at the hyphen when long */
  h: number         /* height of the name */
}

export const MAP_STATES: readonly MapState[] = MAP_SHAPES.map((shape) => {
  /* Long names go on two lines, split at the hyphen */
  const dash = shape.name.indexOf('-')
  const lines = shape.name.length > 15 && dash > 0
    ? [shape.name.slice(0, dash + 1), shape.name.slice(dash + 1)]
    : [shape.name]
  return {
    id: shape.id,
    name: shape.name,
    d: shape.d,
    ax: shape.x,
    ay: shape.y,
    side: shape.x < MAP_W / 2 ? 'left' : 'right',
    lines,
    h: lines.length * LINE_H,
  }
})

/** The CSS class names the drawing uses (from Estados.module.css) */
export interface MapClasses {
  isHover: string
  isFlooding: string
  floodCircle: string
  isShrinking: string
  floodOutline: string
  label: string
  labelHit: string
  isNew: string
  isLeaving: string
  leader: string
  isDrawing: string
  isUndrawing: string
  dot: string
}

export interface MapLayers {
  svg: SVGSVGElement
  floods: SVGGElement
  floodClips: SVGDefsElement
  leaders: SVGGElement
  labels: SVGGElement
}

interface Flood {
  circle: SVGCircleElement
  growing: boolean
  parts: Element[]
  timers: number[]
}

interface Label {
  g: SVGGElement
  line: SVGPathElement
  dot: SVGCircleElement
  y: number | null
  from: number
  to: number
}

export interface MapAnimator {
  /** Call after a state was chosen (on = true) or removed. chosen = the full list now. */
  toggled(s: MapState, on: boolean, chosen: readonly MapState[]): void
  setHover(s: MapState, on: boolean): void
  destroy(): void
}

export function createMapAnimator(
  layers: MapLayers,
  cls: MapClasses,
  onLabelClick: (s: MapState) => void,
): MapAnimator {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const floods = new Map<string, Flood>()
  const labels = new Map<string, Label>()
  const pending = new Set<number>()   /* timers to clear when leaving the page */
  let chosen: readonly MapState[] = []
  let frame = 0

  function later(fn: () => void, ms: number): number {
    const t = window.setTimeout(() => { pending.delete(t); fn() }, ms)
    pending.add(t)
    return t
  }

  function pathOf(s: MapState): SVGPathElement {
    return layers.svg.querySelector<SVGPathElement>('#st-' + s.id)!
  }

  function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
    const node = document.createElementNS(SVG_NS, tag)
    for (const k in attrs) node.setAttribute(k, String(attrs[k]))
    return node
  }

  /* ---------- Green fill grows from the dot / shrinks back into it ---------- */
  /* A green circle centred on the dot (x/y), cut to the state's shape.
     Selecting: it grows until it covers the farthest corner of the state,
     then the state itself turns green and the circle is removed.
     Unselecting: the state turns white underneath and the circle shrinks back
     into the dot (the same animation backwards). Clicking again mid-way turns
     it around from where it is. */
  function flood(s: MapState, growing: boolean): void {
    const path = pathOf(s)
    /* how far an unfinished flood got, so the new one can continue from there */
    let startAt = 0
    const old = floods.get(s.id)
    if (old && old.growing !== growing) {
      const running = old.circle.getAnimations ? old.circle.getAnimations()[0] : null
      const time = running ? running.currentTime : null
      const elapsed = typeof time === 'number' ? time : FLOOD_MS
      startAt = Math.max(0, FLOOD_MS - Math.min(elapsed, FLOOD_MS))
    }
    stopFlood(s)
    if (reduceMotion.matches) return
    if (startAt >= FLOOD_MS) return   /* the other one had not started: nothing to show */
    const clipId = 'clip-' + s.id
    if (!document.getElementById(clipId)) {
      const clip = el('clipPath', { id: clipId })
      clip.appendChild(el('path', { d: s.d, 'clip-rule': 'evenodd' }))
      layers.floodClips.appendChild(clip)
    }
    const b = path.getBBox()
    const r = Math.max(
      Math.hypot(b.x - s.ax, b.y - s.ay),
      Math.hypot(b.x + b.width - s.ax, b.y - s.ay),
      Math.hypot(b.x - s.ax, b.y + b.height - s.ay),
      Math.hypot(b.x + b.width - s.ax, b.y + b.height - s.ay),
    )
    const g = el('g', { 'clip-path': 'url(#' + clipId + ')' })
    const circle = el('circle', {
      class: cls.floodCircle + (growing ? '' : ' ' + cls.isShrinking), cx: s.ax, cy: s.ay, r,
    })
    if (startAt) circle.style.animationDelay = '-' + Math.round(startAt) + 'ms'
    g.appendChild(circle)
    /* the state's own border, redrawn on top so the circle never covers it */
    const outline = el('path', { class: cls.floodOutline, d: s.d })
    layers.floods.appendChild(g)
    layers.floods.appendChild(outline)
    if (growing) path.classList.add(cls.isFlooding)   /* stays unselected-white underneath */

    const f: Flood = { circle, growing, parts: [g, outline], timers: [] }
    f.timers.push(later(() => {
      if (!growing) { stopFlood(s); return }   /* shrunk into the dot: done */
      path.classList.remove(cls.isFlooding)    /* turns green under the full circle */
      f.timers.push(later(() => stopFlood(s), 200))
    }, FLOOD_MS - startAt))
    floods.set(s.id, f)
  }

  function stopFlood(s: MapState): void {
    const f = floods.get(s.id)
    if (!f) return
    f.timers.forEach((t) => { clearTimeout(t); pending.delete(t) })
    f.parts.forEach((p) => p.remove())
    pathOf(s).classList.remove(cls.isFlooding)
    floods.delete(s.id)
  }

  /* ---------- Names with lines ---------- */

  function addLabel(s: MapState): void {
    const left = s.side === 'left'
    const textX = left ? -NAME_GAP : MAP_W + NAME_GAP
    const animate = !reduceMotion.matches

    const g = el('g', { class: cls.label + (animate ? ' ' + cls.isNew : '') })
    g.appendChild(el('rect', {
      class: cls.labelHit,
      x: left ? -GUTTER : MAP_W + LINE_GAP,
      y: -NAME_SPACING / 2,
      width: GUTTER - LINE_GAP,
      height: s.h + NAME_SPACING,
    }))
    const text = el('text', { x: textX, 'text-anchor': left ? 'end' : 'start', lang: 'de' })
    s.lines.forEach((line, i) => {
      const t = el('tspan', { x: textX, y: 20 + i * LINE_H })
      t.textContent = line
      text.appendChild(t)
    })
    g.appendChild(text)
    g.addEventListener('click', () => onLabelClick(s))

    const line = el('path', { class: cls.leader + (animate ? ' ' + cls.isDrawing : ''), pathLength: 1 })
    const dot = el('circle', { class: cls.dot + (animate ? ' ' + cls.isNew : ''), cx: s.ax, cy: s.ay, r: 5.5 })

    layers.leaders.appendChild(line)
    layers.leaders.appendChild(dot)
    layers.labels.appendChild(g)

    /* The draw-in is only a start-up effect; drop it so later moves stay solid */
    if (animate) later(() => line.classList.remove(cls.isDrawing), 700)

    labels.set(s.id, { g, line, dot, y: null, from: 0, to: 0 })
  }

  function removeLabel(s: MapState): void {
    const lb = labels.get(s.id)
    labels.delete(s.id)
    if (!lb) return
    const parts = [lb.g, lb.line, lb.dot]
    if (reduceMotion.matches) {
      parts.forEach((p) => p.remove())
      return
    }
    /* Play the selecting animation backwards (see .is-leaving / .is-undrawing) */
    lb.g.classList.remove(cls.isNew)
    lb.dot.classList.remove(cls.isNew)
    lb.line.classList.remove(cls.isDrawing)
    lb.g.classList.add(cls.isLeaving)
    lb.dot.classList.add(cls.isLeaving)
    lb.line.classList.add(cls.isUndrawing)
    later(() => parts.forEach((p) => p.remove()), 460)
  }

  /* Each side: names sorted top-to-bottom by their state, as close to the
     state's height as possible, pushed apart so they never overlap. */
  function layoutLabels(): void {
    (['left', 'right'] as const).forEach((side) => {
      const items = chosen.filter((s) => s.side === side)
        .sort((a, b) => a.ay - b.ay)
      let floor = -10
      items.forEach((s) => {
        const lb = labels.get(s.id)!
        lb.to = Math.max(s.ay - s.h / 2, floor)
        floor = lb.to + s.h + NAME_SPACING
      })
      let ceiling = MAP_H + 10
      for (let i = items.length - 1; i >= 0; i--) {
        const lb = labels.get(items[i].id)!
        if (lb.to + items[i].h > ceiling) lb.to = ceiling - items[i].h
        ceiling = lb.to - NAME_SPACING
      }
    })
    startMove()
  }

  function leaderPath(s: MapState, top: number): string {
    const ex = s.side === 'left' ? -LINE_GAP : MAP_W + LINE_GAP
    const ey = top + s.h / 2 - 1
    const mx = s.ax + (ex - s.ax) * 0.5
    return 'M' + s.ax + ' ' + s.ay + 'C' + mx + ' ' + s.ay + ' ' + mx + ' ' + ey + ' ' + ex + ' ' + ey
  }

  function place(s: MapState, top: number): void {
    const lb = labels.get(s.id)!
    lb.y = top
    lb.g.setAttribute('transform', 'translate(0 ' + top + ')')
    lb.line.setAttribute('d', leaderPath(s, top))
  }

  let moveStart = 0, moving = false
  function startMove(): void {
    chosen.forEach((s) => {
      const lb = labels.get(s.id)!
      lb.from = lb.y === null ? lb.to : lb.y   /* new names start where they belong */
    })
    if (reduceMotion.matches) {
      chosen.forEach((s) => place(s, labels.get(s.id)!.to))
      return
    }
    moveStart = performance.now()
    if (!moving) { moving = true; frame = requestAnimationFrame(step) }
  }
  function step(now: number): void {
    const t = Math.min(1, (now - moveStart) / MOVE_MS)
    const e = 1 - Math.pow(1 - t, 3)
    chosen.forEach((s) => {
      const lb = labels.get(s.id)!
      place(s, lb.from + (lb.to - lb.from) * e)
    })
    if (t < 1) frame = requestAnimationFrame(step); else moving = false
  }

  return {
    toggled(s, on, chosenNow) {
      chosen = chosenNow
      flood(s, on)
      if (SIDE_LABELS) {
        if (on) addLabel(s); else removeLabel(s)
        layoutLabels()
      }
    },
    setHover(s, on) {
      pathOf(s).classList.toggle(cls.isHover, on)
    },
    destroy() {
      pending.forEach((t) => clearTimeout(t))
      pending.clear()
      cancelAnimationFrame(frame)
    },
  }
}
