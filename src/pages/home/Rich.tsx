import { parseRich, type RichNode } from '../../lib/richText.ts'

/** Draws a home page text with its marks (src/lib/richText.ts):
    **highlighted words** in <strong>, *German words* with lang="de".
    Always plain text: nothing is inserted as HTML. */
export function Rich({ text, className }: { text: string; className?: string }) {
  return <>{draw(parseRich(text), className)}</>
}

function draw(nodes: RichNode[], className?: string) {
  return nodes.map((n, i) => {
    if (typeof n === 'string') return n
    if (n.kind === 'de') return <span key={i} lang="de">{draw(n.children, className)}</span>
    return <strong key={i} className={className}>{draw(n.children, className)}</strong>
  })
}
