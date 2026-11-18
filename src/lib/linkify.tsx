import type { ReactNode } from 'react'
import { linkParts } from './linkParts.ts'

/** Plain text with its web addresses turned into links, for posts and chat
    messages. Everything is built as React elements: the text is never read
    as HTML (no dangerouslySetInnerHTML), so nothing written in it can run.
    Which addresses count, and where each one ends, is decided in
    linkParts.ts.

    Line breaks stay in the text parts; the CSS around it keeps them
    (white-space: pre-wrap). Links open in a new tab and don't tell the
    other site where the reader came from. */
export function linkify(text: string): ReactNode[] {
  return linkParts(text).map((part, i) =>
    part.href ? (
      <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow">
        {part.text}
      </a>
    ) : (
      part.text
    ),
  )
}
