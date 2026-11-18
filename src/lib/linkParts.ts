/* Finds web addresses in plain text, for linkify.tsx (which turns them into
   links). Kept apart, with no React in it, so Node can run its tests
   directly (tests/linkify.test.ts).

   Rules (Ivan, 18 Nov 2026):
   - Only http:// and https:// addresses become links. "www." alone,
     javascript:, mailto:, ftp: and everything else stay plain text.
   - The address must start a word: in "xhttps://…" nothing is a link.
   - Trailing . , ; : ! ? stay outside the link ("Mira https://a.com." links
     "https://a.com"), and so does a closing bracket ) ] } without a matching
     opening one inside the address ("(ver https://a.com)"). An address with
     its own brackets keeps them ("https://es.wikipedia.org/wiki/A_(b)").
   - An address with a user name or password before the host (anything with
     "@" there, like https://medicalnetworklatam.com@other.com, which really
     goes to other.com) stays plain text, so nobody can disguise where a
     link goes.
   - The browser's own address parser (URL) must accept it. */

export interface TextPart {
  /** The text exactly as written */
  text: string
  /** Only on addresses: where the link goes (the parser's tidy version) */
  href?: string
}

/* A candidate: http:// or https:// (any letter case), then everything up to
   a space, < > " or Spanish quotes « » “ ” */
const CANDIDATE = /https?:\/\/[^\s<>"«»“”]+/gi
const TRAILING = '.,;:!?'
const OPENING: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
/* A letter, digit or "_" glued in front means the address doesn't start a word */
const WORD_CHAR = /[\p{L}\p{N}_]/u

function count(text: string, char: string): number {
  return text.split(char).length - 1
}

/** Removes trailing punctuation and unmatched closing brackets */
function trimEnd(address: string): string {
  let s = address
  for (;;) {
    const last = s.slice(-1)
    if (last && TRAILING.includes(last)) { s = s.slice(0, -1); continue }
    const open = OPENING[last]
    if (open && count(s, open) < count(s, last)) { s = s.slice(0, -1); continue }
    return s
  }
}

/** Where the address really goes, or null when it must stay plain text */
function safeHref(address: string): string | null {
  // The part before the host's end: after "//", up to / ? # or \ (which
  // browsers read as / in web addresses)
  const authority = address.slice(address.indexOf('//') + 2).split(/[/?#\\]/)[0]
  if (authority === '' || authority.includes('@')) return null
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname || url.username || url.password) return null
  return url.href
}

/** Splits the text into plain parts and addresses, in order. Joining every
    part's `text` gives back the text exactly. */
export function linkParts(text: string): TextPart[] {
  const parts: TextPart[] = []
  let plainFrom = 0
  for (const match of text.matchAll(CANDIDATE)) {
    const at = match.index
    if (at > 0 && WORD_CHAR.test(text[at - 1])) continue
    const address = trimEnd(match[0])
    const href = safeHref(address)
    if (!href) continue
    if (at > plainFrom) parts.push({ text: text.slice(plainFrom, at) })
    parts.push({ text: address, href })
    plainFrom = at + address.length
  }
  if (plainFrom < text.length) parts.push({ text: text.slice(plainFrom) })
  return parts
}
