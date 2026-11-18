/* Photos and PDFs attached to Novedades posts (migration 5): the rules the
   admin form and the Novedades page share.

   The files live in the private storage bucket "news-files", at
   "<post id>/<random uuid>.<jpg|png|webp|pdf>". The uploaded file's own
   name is never part of that path; it is kept as plain text in
   news_attachments.file_name. Who may read a file is decided by the
   database (migration 5), never by this code.

   The pure functions here are tested by tests/newsFiles.test.ts, which
   Node runs directly. prepareFile() needs a browser (it draws on a
   canvas), so it is only called by the admin form. */

import { dataErrorMessage, NO_CONNECTION } from './dataErrors.ts'

export const BUCKET = 'news-files'
/** At most this many files per post (checked by the admin form) */
export const MAX_FILES = 10
/** The bucket's limit: 10 MB per file */
export const MAX_BYTES = 10 * 1024 * 1024
/** Photos are shrunk so their longest side is at most this many pixels */
export const MAX_SIDE = 2000
/** news_attachments.file_name and .description: at most 200 characters */
export const MAX_NAME = 200
/** Signed links (file addresses with a built-in expiry) last 1 hour */
export const LINK_SECONDS = 3600

export type FileKind = 'image' | 'pdf'

/** One row of news_attachments. file_name and description are plain text. */
export interface Attachment {
  id: string
  post_id: string
  kind: FileKind
  path: string
  file_name: string
  /** Photos only, optional: the alt text */
  description: string | null
  sort_order: number
  created_at: string
}
export const ATTACHMENT_COLUMNS = 'id, post_id, kind, path, file_name, description, sort_order, created_at'

/** The four file types the bucket takes, with their kind and ending */
const TYPES: Record<string, { kind: FileKind; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/webp': { kind: 'image', ext: 'webp' },
  'application/pdf': { kind: 'pdf', ext: 'pdf' },
}
/** For the file picker: only offer these types */
export const ACCEPT = Object.keys(TYPES).join(',')

/** The kind and ending of an accepted file type, or null for any other
    type (SVG, HTML, HEIC, Word…) */
export function typeOf(mime: string): { kind: FileKind; ext: string } | null {
  return Object.hasOwn(TYPES, mime) ? TYPES[mime] : null
}

export const WRONG_TYPE = 'Solo se pueden subir fotos (JPG, PNG o WebP) y archivos PDF.'
export const HEIC =
  'Las fotos HEIC no se pueden subir. Elige la foto desde la fototeca del iPhone o iPad ' +
  '(Safari la entrega como JPG) o guárdala antes como JPG.'
export const PDF_TOO_BIG = 'El PDF pesa más de 10 MB. Reduce su tamaño y vuelve a intentarlo.'
export const NOT_A_PDF = 'Este archivo no es un PDF válido.'
export const PNG_TOO_BIG =
  'La imagen PNG sigue pesando más de 10 MB después de reducirla. Guárdala como JPG y vuelve a intentarlo.'
export const PHOTO_TOO_BIG = 'La foto sigue pesando más de 10 MB después de reducirla. Prueba con otra.'
export const PHOTO_UNREADABLE = 'No se pudo leer esta foto. Prueba con otra o guárdala como JPG.'

/** Spanish message when a chosen file's type can't be uploaded, or ''
    when it can */
export function fileTypeError(file: { type: string; name: string }): string {
  if (typeOf(file.type)) return ''
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name) ? HEIC : WRONG_TYPE
}

/** The size a photo is shrunk to: the longest side at most `max` pixels,
    the same proportions, never made bigger */
export function fitSize(width: number, height: number, max: number = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** The uploaded file's name as stored (plain text): spaces at both ends
    removed, and a name over 200 characters shortened, keeping its ending
    (".pdf"). Characters are counted like the database counts them, so an
    emoji counts as one. An empty name becomes `fallback`. */
export function shortName(name: string, fallback: string, max: number = MAX_NAME): string {
  const chars = Array.from(name.trim())
  if (chars.length === 0) return fallback
  if (chars.length <= max) return chars.join('')
  const dot = chars.lastIndexOf('.')
  // An ending is a dot followed by 1 to 10 letters or digits, like ".pdf"
  const ending = dot > 0 && /^\.[\p{L}\p{N}]{1,10}$/u.test(chars.slice(dot).join('')) ? chars.slice(dot) : []
  const start = chars.slice(0, max - ending.length).join('').trimEnd()
  return start + ending.join('')
}

/** Does the file start like every PDF does ("%PDF-")? */
export function looksLikePdf(firstBytes: Uint8Array): boolean {
  const sign = [0x25, 0x50, 0x44, 0x46, 0x2d]  // % P D F -
  return sign.every((b, i) => firstBytes[i] === b)
}

/** Where a new file goes: "<post id>/<random uuid>.<ending>" */
export function filePath(postId: string, ext: string, uuid: string = crypto.randomUUID()): string {
  return postId + '/' + uuid.toLowerCase() + '.' + ext
}

/** A photo's alt text: its description, or "Foto de la novedad «title»".
    Never empty. */
export function altText(description: string | null, title: string): string {
  return description?.trim() || 'Foto de la novedad «' + title + '»'
}

/** A post's files in their order: by sort_order, then oldest first */
export function sortAttachments<T extends Pick<Attachment, 'id' | 'sort_order' | 'created_at'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) =>
    a.sort_order - b.sort_order
    || a.created_at.localeCompare(b.created_at)
    || a.id.localeCompare(b.id))
}

/** sort_order for a file added at the end */
export function nextSortOrder(list: readonly Pick<Attachment, 'sort_order'>[]): number {
  return list.reduce((max, a) => Math.max(max, a.sort_order + 1), 0)
}

/** The list with the file at `index` moved one place up (-1) or down (+1).
    The same list when it can't move further. */
export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta
  const next = [...list]
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return next
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

/** What to save after a move: each file's place in `list` becomes its
    sort_order (0, 1, 2…). Only the files whose sort_order changes are
    returned. */
export function orderChanges(list: readonly Pick<Attachment, 'id' | 'sort_order'>[]): { id: string; sort_order: number }[] {
  return list.flatMap((a, i) => (a.sort_order === i ? [] : [{ id: a.id, sort_order: i }]))
}

/** Spanish message when the storage service refuses an upload or a removal.
    Its errors carry the HTTP status ("413" = too big, "415" = wrong type,
    "403" = not allowed); a failed connection has none. */
export function storageErrorMessage(error: unknown): string {
  const e = (error ?? {}) as { name?: string; status?: number; statusCode?: string }
  const codes = [String(e.status ?? ''), String(e.statusCode ?? '')]
  if (codes.includes('413')) return 'El archivo pesa más de 10 MB.'
  if (codes.includes('415')) return WRONG_TYPE
  if (codes.includes('401') || codes.includes('403')) {
    return 'No se permitió. Puede que tu sesión haya caducado: vuelve a iniciar sesión.'
  }
  if (e.name === 'StorageUnknownError') return NO_CONNECTION
  return dataErrorMessage(error)
}

/** A file ready to upload */
export interface Prepared {
  blob: Blob
  kind: FileKind
  ext: string
  contentType: string
}

/** Checks a chosen file and gets it ready to upload (browser only).
    - PDFs: at most 10 MB, and must really start like a PDF.
    - Photos: drawn again on a canvas (the browser's drawing area), at most
      2000 px on the longest side, and saved as a new file of the same type.
      The new file has none of the original's hidden data (EXIF), such as
      the phone's GPS location. A photo taken upright stays upright: the
      browser applies the photo's rotation note while drawing it.
    - Anything else is refused. */
export async function prepareFile(file: File): Promise<{ ok: true; file: Prepared } | { ok: false; error: string }> {
  const type = typeOf(file.type)
  if (!type) return { ok: false, error: fileTypeError(file) }

  if (type.kind === 'pdf') {
    if (file.size > MAX_BYTES) return { ok: false, error: PDF_TOO_BIG }
    const first = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    if (!looksLikePdf(first)) return { ok: false, error: NOT_A_PDF }
    return { ok: true, file: { blob: file, kind: 'pdf', ext: 'pdf', contentType: 'application/pdf' } }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return { ok: false, error: PHOTO_UNREADABLE }
  }
  let blob: Blob | null
  try {
    const size = fitSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { ok: false, error: PHOTO_UNREADABLE }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.85))
  } finally {
    bitmap.close()
  }
  // A browser that can't save WebP hands back a PNG instead: use what it made
  const made = blob ? typeOf(blob.type) : null
  if (!blob || !made || made.kind !== 'image') return { ok: false, error: PHOTO_UNREADABLE }
  if (blob.size > MAX_BYTES) return { ok: false, error: made.ext === 'png' ? PNG_TOO_BIG : PHOTO_TOO_BIG }
  return { ok: true, file: { blob, kind: 'image', ext: made.ext, contentType: blob.type } }
}
