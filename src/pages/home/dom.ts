/* Small helpers shared by the home page's hooks (fit.ts, callBar.ts).

   Those hooks find elements in the drawn page and change them directly,
   instead of asking React to redraw the page. They find elements by the
   CSS module's class names (styles.xxx), the same names the CSS uses. */

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
  // while developing (npm run dev), instead of the page silently not working
  if (import.meta.env.DEV && !cls) console.error('Home page: a class is missing from Home.module.css')
  return '.' + CSS.escape(String(cls))
}
