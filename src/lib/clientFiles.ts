/* "Mis documentos" (migration 8): the rules the client page (/documentos)
   and the admin's "Documentos" section share.

   The files are PDFs the MNL team uploads for one client. They live in the
   private storage bucket "client-files", at "<client id>/<random uuid>.pdf".
   The uploaded file's own name is never part of that path; it is kept as
   plain text in client_documents.file_name. Who may read a file is decided
   by the database (migration 8), never by this code: a paid client reads
   only the files that have their own client_documents row.

   Same pattern as news files (src/lib/newsFiles.ts), whose helpers are
   reused here: the name shortening, the "%PDF-" check, the 10 MB limit,
   the 1-hour signed links and the storage error messages.

   The pure functions here are tested by tests/clientFiles.test.ts, which
   Node runs directly. checkPdf() reads the file's first bytes, so it needs
   a browser File; it is only called by the admin section. */

import { looksLikePdf, shortName, MAX_BYTES, MAX_NAME, NOT_A_PDF, PDF_TOO_BIG } from './newsFiles.ts'

export { LINK_SECONDS, MAX_BYTES, NOT_A_PDF, PDF_TOO_BIG, storageErrorMessage } from './newsFiles.ts'

export const BUCKET = 'client-files'
/** The only file type the bucket takes */
export const PDF_TYPE = 'application/pdf'
/** For the file picker: only offer PDFs */
export const ACCEPT = PDF_TYPE

export const NOT_PDF_TYPE = 'Solo se pueden subir archivos PDF.'

/** One row of client_documents. file_name is plain text. */
export interface ClientDocument {
  id: string
  user_id: string
  path: string
  file_name: string
  created_at: string
}
export const DOCUMENT_COLUMNS = 'id, user_id, path, file_name, created_at'

/** Spanish message when a chosen file can't be uploaded, or '' when it
    can. Checked in this order: the type the browser reports must be PDF,
    the file at most 10 MB, and its first bytes must be "%PDF-" (every PDF
    starts like that; a renamed Word file or photo doesn't). */
export function pdfError(file: { type: string; size: number }, firstBytes: Uint8Array): string {
  if (file.type !== PDF_TYPE) return NOT_PDF_TYPE
  if (file.size > MAX_BYTES) return PDF_TOO_BIG
  if (!looksLikePdf(firstBytes)) return NOT_A_PDF
  return ''
}

/** Checks a chosen file in the browser: '' when it may be uploaded, or the
    Spanish message. Reads only its first 5 bytes. */
export async function checkPdf(file: File): Promise<string> {
  const first = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  return pdfError(file, first)
}

/** The name kept for a document (plain text): spaces at both ends
    removed, and a name over 200 characters shortened, keeping ".pdf". An
    empty name becomes "documento.pdf". */
export function documentName(name: string): string {
  return shortName(name, 'documento.pdf', MAX_NAME)
}

/** Where a new document goes: "<client id>/<random uuid>.pdf", lowercase */
export function documentPath(clientId: string, uuid: string = crypto.randomUUID()): string {
  return clientId.toLowerCase() + '/' + uuid.toLowerCase() + '.pdf'
}

/** The same rule as the database's check on client_documents.path: a
    lowercase uuid folder that is this client's id, a lowercase uuid name,
    ".pdf" */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const PATH = new RegExp('^(' + UUID + ')/' + UUID + '\\.pdf$')
export function isDocumentPath(path: string, clientId: string): boolean {
  const match = PATH.exec(path)
  return match !== null && match[1] === clientId
}

/** A client's documents, newest first (the same date: by id, so the order
    never jumps) */
export function sortDocuments<T extends Pick<ClientDocument, 'id' | 'created_at'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) =>
    Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id))
}
