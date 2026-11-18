/* Finds web addresses in plain text, for linkify.tsx (which turns them into
   links). Kept apart, with no React in it, so Node can run its tests
   directly (tests/linkify.test.ts).

   Rules (Ivan, 18 Nov 2026):
   - Three kinds of addresses become links:
     1. http:// and https:// addresses
     2. addresses starting with "www." (www.example.com)
     3. bare domains whose last part is on ENDINGS below (kammer.de,
        ministerio.gob.ec, a.b.example.com), with or without a path
        (example.com/ruta?x=1). The ending must be written exactly as in
        the list, in lowercase, so a missing space after a full stop
        ("Alemania.De hecho") stays text.
     For 2 and 3 the link goes to "https://" + the address; the link text
     is always the address exactly as written. javascript:, mailto:, ftp:
     and everything else stay plain text.
   - The address must start a word: in "xhttps://…" nothing is a link. For
     2 and 3 that means after a space, a line break, an opening bracket or
     quote (and ¿ ¡ < >), or at the very start; and nothing glued after its
     host either ("example.com-x", "maria.es@gmail.com").
   - Trailing . , ; : ! ? stay outside the link ("Mira https://a.com." links
     "https://a.com"), and so does a closing bracket ) ] } without a matching
     opening one inside the address ("(ver https://a.com)"). An address with
     its own brackets keeps them ("https://es.wikipedia.org/wiki/A_(b)").
   - Anything with "@" before the host stays plain text: a user name or
     password (https://medicalnetworklatam.com@other.com, which really goes
     to other.com), and emails (name@example.com), so nobody can disguise
     where a link goes and emails never become web links.
   - The browser's own address parser (URL) must accept it. */

export interface TextPart {
  /** The text exactly as written */
  text: string
  /** Only on addresses: where the link goes (the parser's tidy version) */
  href?: string
}

/** Endings that make a bare domain a link (rule 3) */
const ENDINGS = new Set([
  'com', 'org', 'net', 'info', 'eu', 'de', 'at', 'ch', 'es', 'ec', 'pe', 'co', 'mx',
  'ar', 'cl', 'bo', 've', 'uy', 'py', 'gob', 'gov', 'edu',
])

/* What ends an address: a space, < > " or Spanish quotes « » “ ” */
const STOP = '\\s<>"«»“”'
/* One part of a host name: letters or digits, with "-" only inside */
const LABEL = '[\\p{L}\\p{N}](?:[\\p{L}\\p{N}-]*[\\p{L}\\p{N}])?'
/* A candidate, either
   - http:// or https:// (any letter case), then everything up to a stop, or
   - a host name (parts with dots, ending in 2 or more letters), maybe a
     port (":8080"), maybe a path, query or #part up to a stop. */
const CANDIDATE = new RegExp(
  `https?://[^${STOP}]+` +
  `|(?:${LABEL}\\.)+\\p{L}{2,}(?::\\d{1,5})?(?:[/?#][^${STOP}]*)?`,
  'giu',
)
const HAS_SCHEME = /^https?:\/\//i
const TRAILING = '.,;:!?'
const OPENING: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
/* A letter, digit or "_" glued in front means the address doesn't start a word */
const WORD_CHAR = /[\p{L}\p{N}_]/u
/* Rules 2 and 3: what may come right before the address (or nothing) */
const OPENER = /[\s([{«“‘"'¿¡<>]/u
/* Rules 2 and 3: what may not come right after the host (glued on) */
const GLUED_AFTER = /[\p{L}\p{N}_@-]/u

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

/** The tidy address, if the parser accepts it as a plain https/http
    address with a host and no user name or password */
function parsed(address: string): string | null {
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

/** Rule 1: where an http(s) address really goes, or null when it must stay
    plain text */
function schemeHref(address: string): string | null {
  // The part before the host's end: after "//", up to / ? # or \ (which
  // browsers read as / in web addresses)
  const authority = address.slice(address.indexOf('//') + 2).split(/[/?#\\]/)[0]
  if (authority === '' || authority.includes('@')) return null
  return parsed(address)
}

/** Rules 2 and 3: where an address without http(s):// goes ("https://" +
    the address), or null when it must stay plain text */
function bareHref(address: string): string | null {
  const host = address.split(/[/?#:]/)[0]
  const parts = host.split('.')
  if (/^www\./i.test(host)) {
    if (parts.length < 3) return null // "www.ejemplo" alone isn't an address
  } else if (!ENDINGS.has(parts[parts.length - 1])) {
    return null
  }
  return parsed('https://' + address)
}

/** Splits the text into plain parts and addresses, in order. Joining every
    part's `text` gives back the text exactly. */
export function linkParts(text: string): TextPart[] {
  const parts: TextPart[] = []
  let plainFrom = 0
  for (const match of text.matchAll(CANDIDATE)) {
    const at = match.index
    const raw = match[0]
    const before = at > 0 ? text[at - 1] : ''
    let address: string
    let href: string | null
    if (HAS_SCHEME.test(raw)) {
      if (before && WORD_CHAR.test(before)) continue
      address = trimEnd(raw)
      href = schemeHref(address)
    } else {
      // after "@" (an email), "/", "." or a letter: not the start of a word
      if (before && !OPENER.test(before)) continue
      const after = text[at + raw.length] ?? ''
      if (after && GLUED_AFTER.test(after)) continue
      address = trimEnd(raw)
      href = bareHref(address)
    }
    if (!href) continue
    if (at > plainFrom) parts.push({ text: text.slice(plainFrom, at) })
    parts.push({ text: address, href })
    plainFrom = at + address.length
  }
  if (plainFrom < text.length) parts.push({ text: text.slice(plainFrom) })
  return parts
}
