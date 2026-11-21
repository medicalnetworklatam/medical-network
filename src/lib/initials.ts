/** The letters in a community post's round avatar: the first letter of the
    first two words of the name the database shows ("José P." → "JP",
    "María" → "M", "Miembro" → "M"). Only letters and digits count, so
    "P." gives "P". "?" when the name has none. Plain text, never HTML.
    Tested by tests/initials.test.ts (npm test). */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((word) => Array.from(word.replace(/[^\p{L}\p{N}]/gu, ''))[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
  return letters ? letters.toLocaleUpperCase('es') : '?'
}
