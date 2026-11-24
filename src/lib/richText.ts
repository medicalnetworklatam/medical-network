/* Reads the two marks used in the home page's texts (src/content/home.ts):
     **words**  highlighted words
     *Wort*     a German word (shown with lang="de")
   and turns a text into a small tree the page draws as plain text inside
   <strong> and <span lang="de">. Nothing is ever inserted as HTML.

   A German word can sit inside highlighted words ("**Ruta *Approbation***");
   inside a German word, the next "*" always closes it. A mark that is never
   closed is kept as the plain "*" characters, so a typo shows up on the
   page instead of hiding text. Tested by tests/richText.test.ts. */

export type RichNode =
  | string
  | { kind: 'strong'; children: RichNode[] }
  | { kind: 'de'; children: RichNode[] }

export function parseRich(text: string): RichNode[] {
  return parseUntil(text, 0, null).nodes
}

/** Plain words without the marks (for labels screen readers hear) */
export function plainRich(text: string): string {
  const flat = (nodes: RichNode[]): string =>
    nodes.map((n) => (typeof n === 'string' ? n : flat(n.children))).join('')
  return flat(parseRich(text))
}

type Closer = '**' | '*' | null

function parseUntil(s: string, start: number, closer: Closer): { nodes: RichNode[]; end: number; closed: boolean } {
  const nodes: RichNode[] = []
  let text = ''
  let i = start
  const flush = () => {
    if (text) nodes.push(text)
    text = ''
  }

  while (i < s.length) {
    if (s[i] !== '*') {
      text += s[i]
      i++
      continue
    }
    // Inside a German word, any "*" closes it
    if (closer === '*') {
      flush()
      return { nodes, end: i + 1, closed: true }
    }
    if (s.startsWith('**', i)) {
      if (closer === '**') {
        flush()
        return { nodes, end: i + 2, closed: true }
      }
      // open highlighted words (not inside highlighted words: "**" there closes)
      const inner = parseUntil(s, i + 2, '**')
      if (inner.closed) {
        flush()
        nodes.push({ kind: 'strong', children: inner.nodes })
        i = inner.end
      } else {
        text += '**'
        i += 2
      }
      continue
    }
    // a single "*": open a German word
    const inner = parseUntil(s, i + 1, '*')
    if (inner.closed) {
      flush()
      nodes.push({ kind: 'de', children: inner.nodes })
      i = inner.end
    } else {
      text += '*'
      i += 1
    }
  }
  flush()
  return { nodes, end: i, closed: closer === null }
}
