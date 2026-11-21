/* Tests for "Mis documentos" (src/lib/clientFiles.ts): the checks the
   admin's "Subir PDF" makes in the browser before uploading (PDF type,
   the "%PDF-" start, at most 10 MB), how long names are shortened, the
   storage path and the order of the list.

   Run with:  npm test
   It needs no database, no internet and no browser. Every file and ID
   here is made up. It ends with "ALL DOCUMENT TESTS PASSED", or lists
   what failed.

   Node.js 22 runs this TypeScript file directly. */

import {
  checkPdf, documentName, documentPath, isDocumentPath, pdfError, sortDocuments,
  ACCEPT, BUCKET, MAX_BYTES, NOT_A_PDF, NOT_PDF_TYPE, PDF_TOO_BIG,
} from '../src/lib/clientFiles.ts'

let passed = 0
const failures: string[] = []

function check(name: string, got: unknown, want: unknown): void {
  const [a, e] = [JSON.stringify(got), JSON.stringify(want)]
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    got      ${a}`)
}

const PDF_START = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])  // "%PDF-"
const bytes = (text: string) => new TextEncoder().encode(text)
const MB = 1024 * 1024

/* ---------- The bucket ---------- */
check('bucket name', BUCKET, 'client-files')
check('the picker offers only PDF', ACCEPT, 'application/pdf')
check('10 MB limit', MAX_BYTES, 10 * MB)

/* ---------- Type: only application/pdf ---------- */
check('a PDF is accepted', pdfError({ type: 'application/pdf', size: 1000 }, PDF_START), '')
check('Word refused', pdfError({ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1000 }, PDF_START), NOT_PDF_TYPE)
check('old Word refused', pdfError({ type: 'application/msword', size: 1000 }, PDF_START), NOT_PDF_TYPE)
check('photo refused', pdfError({ type: 'image/jpeg', size: 1000 }, PDF_START), NOT_PDF_TYPE)
check('HTML refused', pdfError({ type: 'text/html', size: 1000 }, PDF_START), NOT_PDF_TYPE)
check('no type refused', pdfError({ type: '', size: 1000 }, PDF_START), NOT_PDF_TYPE)
check('type message in Spanish', NOT_PDF_TYPE, 'Solo se pueden subir archivos PDF.')

/* ---------- Start: the first bytes must be "%PDF-" ---------- */
check('starts with %PDF-1.7', pdfError({ type: 'application/pdf', size: 1000 }, bytes('%PDF-1.7\n')), '')
check('a renamed photo is refused', pdfError({ type: 'application/pdf', size: 1000 }, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])), NOT_A_PDF)
check('a renamed Word file is refused', pdfError({ type: 'application/pdf', size: 1000 }, bytes('PK\u0003\u0004x')), NOT_A_PDF)
check('lowercase %pdf- is refused', pdfError({ type: 'application/pdf', size: 1000 }, bytes('%pdf-1.4')), NOT_A_PDF)
check('an empty file is refused', pdfError({ type: 'application/pdf', size: 0 }, new Uint8Array()), NOT_A_PDF)
check('a too short file is refused', pdfError({ type: 'application/pdf', size: 4 }, bytes('%PDF')), NOT_A_PDF)
check('"%PDF" later in the file is refused', pdfError({ type: 'application/pdf', size: 1000 }, bytes(' %PDF')), NOT_A_PDF)
check('start message in Spanish', NOT_A_PDF, 'Este archivo no es un PDF válido.')

/* ---------- Size: at most 10 MB ---------- */
check('exactly 10 MB is accepted', pdfError({ type: 'application/pdf', size: 10 * MB }, PDF_START), '')
check('10 MB + 1 byte is refused', pdfError({ type: 'application/pdf', size: 10 * MB + 1 }, PDF_START), PDF_TOO_BIG)
check('25 MB is refused', pdfError({ type: 'application/pdf', size: 25 * MB }, PDF_START), PDF_TOO_BIG)
check('size message in Spanish', PDF_TOO_BIG, 'El PDF pesa más de 10 MB. Reduce su tamaño y vuelve a intentarlo.')
check('the type is checked before the size', pdfError({ type: 'image/png', size: 25 * MB }, PDF_START), NOT_PDF_TYPE)
check('the size is checked before the start', pdfError({ type: 'application/pdf', size: 25 * MB }, bytes('hola!')), PDF_TOO_BIG)

/* ---------- Names: at most 200 characters, ".pdf" kept ---------- */
const long = 'Approbation Antrag Baden-Württemberg '.repeat(10) + '.pdf'
const shortened = documentName(long)
check('a long name is shortened to 200 characters', Array.from(shortened).length, 200)
check('a long name keeps ".pdf"', shortened.endsWith('.pdf'), true)
check('a long name keeps its start', shortened.startsWith('Approbation Antrag'), true)
check('a 200-character name stays as it is', documentName('x'.repeat(196) + '.pdf'), 'x'.repeat(196) + '.pdf')
check('a 201-character name loses one letter', documentName('x'.repeat(197) + '.pdf'), 'x'.repeat(196) + '.pdf')
check('an emoji counts as one character', Array.from(documentName('📄'.repeat(250) + '.pdf')).length, 200)
check('an emoji is never cut in half', documentName('📄'.repeat(250) + '.pdf'), '📄'.repeat(196) + '.pdf')
check('spaces at both ends are removed', documentName('  Título final.pdf \n'), 'Título final.pdf')
check('no space is left before ".pdf"', documentName('x'.repeat(195) + '  ' + 'y'.repeat(10) + '.pdf'), 'x'.repeat(195) + '.pdf')
check('an empty name becomes documento.pdf', documentName('   '), 'documento.pdf')
check('a short name stays as it is', documentName('Título de médico.pdf'), 'Título de médico.pdf')
check('a name without an ending is still at most 200', Array.from(documentName('z'.repeat(300))).length, 200)

/* ---------- Path: "<client id>/<random uuid>.pdf" ---------- */
const client = '11111111-2222-4333-8444-555555555555'
const other = '99999999-8888-4777-8666-555555555555'
const uuid = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'
const path = documentPath(client, uuid)
check('path: client folder, lowercase uuid, .pdf', path, client + '/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.pdf')
check('path follows the database rule', isDocumentPath(path, client), true)
check('a new random path follows the rule', isDocumentPath(documentPath(client), client), true)
check('two new paths differ', documentPath(client) === documentPath(client), false)
check('the uploaded name is never in the path', documentPath(client, uuid).includes('Antrag'), false)
check('another client\'s folder is refused', isDocumentPath(path, other), false)
check('uppercase is refused', isDocumentPath(client + '/' + uuid + '.pdf', client), false)
check('another ending is refused', isDocumentPath(client + '/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.docx', client), false)
check('".PDF" is refused', isDocumentPath(client + '/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.PDF', client), false)
check('a sub-folder is refused', isDocumentPath(client + '/x/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.pdf', client), false)
check('the file\'s own name is refused', isDocumentPath(client + '/Antrag.pdf', client), false)
check('a folder that isn\'t a uuid is refused', isDocumentPath('carpeta/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.pdf', 'carpeta'), false)

/* ---------- Order: newest first ---------- */
const docs = [
  { id: 'b', created_at: '2026-11-20T10:00:00+00:00' },
  { id: 'c', created_at: '2026-11-21T09:30:00.123456+00:00' },
  { id: 'a', created_at: '2026-11-20T10:00:00+00:00' },
  { id: 'd', created_at: '2026-11-19T23:59:59+00:00' },
]
check('newest first, same moment by id', sortDocuments(docs).map((d) => d.id), ['c', 'a', 'b', 'd'])
check('the list given is not changed', docs.map((d) => d.id), ['b', 'c', 'a', 'd'])
check('an empty list stays empty', sortDocuments([]), [])

/* ---------- checkPdf reads the real first bytes of a File ---------- */
const realPdf = new File([bytes('%PDF-1.4\n% made-up test file\n')], 'Prueba.pdf', { type: 'application/pdf' })
const fakePdf = new File([bytes('<html>no</html>')], 'Prueba.pdf', { type: 'application/pdf' })
const wordFile = new File([bytes('PK\u0003\u0004')], 'Carta.docx', { type: 'application/msword' })
check('checkPdf: a real PDF', await checkPdf(realPdf), '')
check('checkPdf: HTML named .pdf', await checkPdf(fakePdf), NOT_A_PDF)
check('checkPdf: a Word file', await checkPdf(wordFile), NOT_PDF_TYPE)

/* ---------- Result ---------- */
if (failures.length > 0) {
  console.error(`${failures.length} DOCUMENT TEST(S) FAILED (${passed} passed):\n`)
  for (const f of failures) console.error('  ✗ ' + f + '\n')
  process.exit(1)
}
console.log(`ALL DOCUMENT TESTS PASSED (${passed} checks)`)
