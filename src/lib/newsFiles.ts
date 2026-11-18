/* Photos and PDFs attached to Novedades posts (migration 5): the rules the
   admin form and the Novedades page share.

   The files live in the private storage bucket "news-files", at
   "<post id>/<random uuid>.<jpg|png|webp|pdf>". The uploaded file's own
   name is never part of that path; it is kept as plain text in
   news_attachments.file_name. Who may read a file is decided by the
   database (migrations 5 and 6), never by this code.

   Each photo also gets a small copy (about 480 px, JPEG, migration 6) at
   "<post id>/<another random uuid>.jpg", made in the browser when the
   photo is uploaded. The Novedades list shows the small copies in its
   preview tiles, never the full photos. Photos uploaded before migration 6
   have none.

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
/** A photo's small copy: the longest side at most this many pixels */
export const THUMB_SIDE = 480
/** A photo's small copy: JPEG quality (0 to 1) */
export const THUMB_QUALITY = 0.8

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
  /** Photos only: the small copy's path (migration 6). null for PDFs and
      for photos uploaded before migration 6. */
  thumb_path: string | null
  sort_order: number
  created_at: string
}
export const ATTACHMENT_COLUMNS = 'id, post_id, kind, path, file_name, description, thumb_path, sort_order, created_at'

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

/** The size of a photo's small copy: the longest side at most 480 px, the
    same proportions, never made bigger */
export function thumbSize(width: number, height: number): { width: number; height: number } {
  return fitSize(width, height, THUMB_SIDE)
}

/** Where a photo's small copy goes: "<post id>/<another random uuid>.jpg".
    Always a JPEG, and never the photo's own path (the database checks
    both). */
export function thumbPath(postId: string, uuid: string = crypto.randomUUID()): string {
  return filePath(postId, 'jpg', uuid)
}

/** The files to delete from storage when a file is removed: the file, and
    a photo's small copy when it has one (never an empty entry) */
export function storagePaths(file: Pick<Attachment, 'path' | 'thumb_path'>): string[] {
  return file.thumb_path ? [file.path, file.thumb_path] : [file.path]
}

/* ---------- The preview's file area on the Novedades list ---------- */

/** One tile of a post's file area:
    - thumb: a photo's small copy (path in storage)
    - photo: a photo without a small copy (uploaded before migration 6)
    - pdf: a PDF
    - count: the black tile with a number (3 files: "3"; more than 4: the
      total number of files) */
export type Tile =
  | { kind: 'thumb'; path: string }
  | { kind: 'photo' }
  | { kind: 'pdf' }
  | { kind: 'count'; count: number }

/** The tiles of a post's file area, for its files in their order. The
    square keeps its size; what fills it depends on the number of files
    (DECISIONS.md, 18 Nov 2026, evening):
    - 1 file: one tile filling the square
    - 2 files: a column of two tiles
    - 3 files: three tiles (top left, top right, bottom left) and a black
      tile with "3" (bottom right)
    - 4 files: the 2×2 grid
    - more than 4: the first three files and a black tile with the total
      number of files
    So there are 0, 1, 2 or 4 tiles; the page picks the layout from that
    number. No files: no tiles. */
export function previewTiles(files: readonly Pick<Attachment, 'kind' | 'thumb_path'>[]): Tile[] {
  const fileTile = (file: Pick<Attachment, 'kind' | 'thumb_path'>): Tile =>
    file.kind === 'pdf' ? { kind: 'pdf' }
      : file.thumb_path ? { kind: 'thumb', path: file.thumb_path }
        : { kind: 'photo' }
  if (files.length === 3 || files.length > 4) {
    return [...files.slice(0, 3).map(fileTile), { kind: 'count', count: files.length }]
  }
  return files.map(fileTile)
}

/** How many files a post has, in words: "3 fotos y 1 PDF", "1 foto",
    "2 PDF". '' when there are no files. ("PDF" stays the same in the
    plural.) Shown on phones in a box above the post's tag, instead of the
    file area. */
export function filesCount(files: readonly Pick<Attachment, 'kind'>[]): string {
  const photos = files.filter((f) => f.kind === 'image').length
  const pdfs = files.length - photos
  const parts: string[] = []
  if (photos > 0) parts.push(photos + (photos === 1 ? ' foto' : ' fotos'))
  if (pdfs > 0) parts.push(pdfs + ' PDF')
  return parts.join(' y ')
}

/** What screen readers hear instead of the tiles: "Archivos: 3 fotos y
    1 PDF", "Archivos: 1 foto", "Archivos: 2 PDF". '' when there are no
    files. */
export function filesSummary(files: readonly Pick<Attachment, 'kind'>[]): string {
  const count = filesCount(files)
  return count ? 'Archivos: ' + count : ''
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
  /** Photos only: the small copy (JPEG). null for PDFs. */
  thumb: Blob | null
}

/** Checks a chosen file and gets it ready to upload (browser only).
    - PDFs: at most 10 MB, and must really start like a PDF.
    - Photos: drawn again on a canvas (the browser's drawing area), at most
      2000 px on the longest side, and saved as a new file of the same type.
      The new file has none of the original's hidden data (EXIF), such as
      the phone's GPS location. A photo taken upright stays upright: the
      browser applies the photo's rotation note while drawing it.
      The small copy is drawn the same way from the same picture: at most
      480 px, JPEG, quality 0.8, upright, no hidden data. JPEG has no
      transparency, so a see-through PNG gets a white background in its
      small copy (the photo itself keeps its transparency).
    - Anything else is refused. */
export async function prepareFile(file: File): Promise<{ ok: true; file: Prepared } | { ok: false; error: string }> {
  const type = typeOf(file.type)
  if (!type) return { ok: false, error: fileTypeError(file) }

  if (type.kind === 'pdf') {
    if (file.size > MAX_BYTES) return { ok: false, error: PDF_TOO_BIG }
    const first = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    if (!looksLikePdf(first)) return { ok: false, error: NOT_A_PDF }
    return { ok: true, file: { blob: file, kind: 'pdf', ext: 'pdf', contentType: 'application/pdf', thumb: null } }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return { ok: false, error: PHOTO_UNREADABLE }
  }
  let blob: Blob | null
  let thumb: Blob | null
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

    // The small copy, from the same upright picture
    const small = thumbSize(bitmap.width, bitmap.height)
    const thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = small.width
    thumbCanvas.height = small.height
    const thumbCtx = thumbCanvas.getContext('2d')
    if (!thumbCtx) return { ok: false, error: PHOTO_UNREADABLE }
    thumbCtx.fillStyle = 'white'  // under see-through parts (JPEG has no transparency)
    thumbCtx.fillRect(0, 0, small.width, small.height)
    thumbCtx.imageSmoothingQuality = 'high'
    thumbCtx.drawImage(bitmap, 0, 0, small.width, small.height)
    thumb = await new Promise<Blob | null>((resolve) => thumbCanvas.toBlob(resolve, 'image/jpeg', THUMB_QUALITY))
  } finally {
    bitmap.close()
  }
  // A browser that can't save WebP hands back a PNG instead: use what it made
  const made = blob ? typeOf(blob.type) : null
  if (!blob || !made || made.kind !== 'image') return { ok: false, error: PHOTO_UNREADABLE }
  if (blob.size > MAX_BYTES) return { ok: false, error: made.ext === 'png' ? PNG_TOO_BIG : PHOTO_TOO_BIG }
  if (!thumb || thumb.type !== 'image/jpeg') return { ok: false, error: PHOTO_UNREADABLE }
  return { ok: true, file: { blob, kind: 'image', ext: made.ext, contentType: blob.type, thumb } }
}
