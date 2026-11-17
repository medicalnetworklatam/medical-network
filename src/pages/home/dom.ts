/* Small helpers shared by the home page's motion hooks (fit.ts, reveal.ts,
   push.ts, phases.ts, story.ts).

   Those hooks work like the prototype's scripts: they find elements in the
   drawn page and set CSS variables on them many times a second while you
   scroll, instead of asking React to redraw the page. They find elements by
   the CSS module's class names (styles.xxx), the same names the CSS uses. */

/** The first element inside `parent` with this CSS module class, or null */
export function one<T extends HTMLElement = HTMLElement>(parent: ParentNode, cls: string): T | null {
  return parent.querySelector<T>(selector(cls))
}

/** Every element inside `parent` with this CSS module class */
export function all<T extends HTMLElement = HTMLElement>(parent: ParentNode, cls: string): T[] {
  return [...parent.querySelectorAll<T>(selector(cls))]
}

function selector(cls: string): string {
  // styles.xxx is undefined when the class isn't in Home.module.css: say so
  // while developing (npm run dev), instead of the motion silently not working
  if (import.meta.env.DEV && !cls) console.error('Home motion: a class is missing from Home.module.css')
  return '.' + CSS.escape(String(cls))
}

export const clamp = (v: number): number => Math.min(1, Math.max(0, v))

/** Ease in and out */
export const smooth = (v: number): number => v * v * (3 - 2 * v)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
