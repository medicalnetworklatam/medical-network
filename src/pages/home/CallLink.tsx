import type { ReactNode } from 'react'

const CALENDLY = 'https://calendly.com/ivan-ab89/ruta-approbation'

/** A link to the owner's Calendly page, in a new tab. Every Calendly button
    on the home page uses it, with one label (DECISIONS.md, 23 Nov 2026):
    "Agenda tu llamada gratuita". Screen readers also hear that it opens a
    new tab. No tracking: a plain link, nothing is sent from our side. */
export default function CallLink({ className, onClick, children }: {
  className?: string
  onClick?: () => void
  children?: ReactNode // the label's own markup, when it needs more (the menu's arrow)
}) {
  return (
    <a className={className} href={CALENDLY} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {children ?? 'Agenda tu llamada gratuita'}
      <span className="sr-only"> (se abre en una pestaña nueva)</span>
    </a>
  )
}
