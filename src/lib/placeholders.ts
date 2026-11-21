/* Fills in the placeholders of the owner's checklist templates
   (DECISIONS.md, 20 and 21 Nov 2026). Used by Mi expediente
   (src/pages/Expediente.tsx) and the client's admin screen, and tested by
   tests/placeholders.test.ts (npm test).

   - {pais}          the client's country, or "tu país" when it's empty
   - {nombre}        first name + last names
   - {perfil}        the client's header line; when it's empty, the " · "
                     right after it goes too
   - {genero:x|y}    the neutral rule: both forms, shortened when they differ
                     only in the ending o → a ("médico|médica" → "médico/a"),
                     otherwise both in full ("Arzt|Ärztin" → "Arzt/Ärztin")

   The result is plain text: the pages show it as text, never as HTML.
   Anything else between { and } is left exactly as written. */

export interface PlaceholderValues {
  /** The client's country (client_details.country), or null */
  pais?: string | null
  /** First name + last names */
  nombre?: string | null
  /** The header line (client_details.header_line), or null */
  perfil?: string | null
}

/** "médico|médica" → "médico/a"; "Arzt|Ärztin" → "Arzt/Ärztin" */
export function neutralGender(masculine: string, feminine: string): string {
  if (masculine === feminine) return masculine
  if (
    masculine.length > 1 && masculine.length === feminine.length
    && masculine.endsWith('o') && feminine.endsWith('a')
    && masculine.slice(0, -1) === feminine.slice(0, -1)
  ) {
    return masculine + '/a'
  }
  return masculine + '/' + feminine
}

/** The text with every known placeholder filled in */
export function fillPlaceholders(text: string, values: PlaceholderValues = {}): string {
  const pais = values.pais?.trim() || 'tu país'
  const nombre = values.nombre?.trim() ?? ''
  const perfil = values.perfil?.trim() ?? ''
  return text.replace(/\{perfil\}( · )?|\{([^{}]*)\}/g, (whole, afterPerfil: string | undefined, inner: string | undefined) => {
    if (inner === undefined) return perfil ? perfil + (afterPerfil ?? '') : ''
    if (inner === 'pais') return pais
    if (inner === 'nombre') return nombre
    const gender = /^genero:([^{}|]+)\|([^{}|]+)$/.exec(inner)
    if (gender) return neutralGender(gender[1], gender[2])
    return whole
  })
}
