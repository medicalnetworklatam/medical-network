/* Tests for photos and PDFs in Novedades posts (src/lib/newsFiles.ts):
   which file types are accepted, the size a photo is shrunk to, how long
   file names are shortened, the storage path, the alt text, the order of
   a post's files and the Spanish upload errors. Since migration 6 also the
   photos' small copies (size and path), which files are deleted with a
   photo, and the tiles and screen-reader summary of the Novedades list.

   Run with:  npm test
   It needs no database, no internet and no browser (shrinking the photo
   itself happens on a canvas, which only a browser has). It ends with
   "ALL FILE TESTS PASSED", or lists what failed.

   Node.js 22 runs this TypeScript file directly. */

import {
  altText, filePath, filesSummary, fileTypeError, fitSize, looksLikePdf, moveItem, nextSortOrder, orderChanges,
  previewTiles, shortName, sortAttachments, storageErrorMessage, storagePaths, thumbPath, thumbSize, typeOf,
  HEIC, MAX_NAME, THUMB_SIDE, WRONG_TYPE,
} from '../src/lib/newsFiles.ts'
import { NO_CONNECTION } from '../src/lib/dataErrors.ts'

let passed = 0
const failures: string[] = []

function check(name: string, got: unknown, want: unknown): void {
  const [a, e] = [JSON.stringify(got), JSON.stringify(want)]
  if (a === e) passed++
  else failures.push(`${name}\n    expected ${e}\n    got      ${a}`)
}

/* ---------- File types ---------- */
check('JPEG', typeOf('image/jpeg'), { kind: 'image', ext: 'jpg' })
check('PNG', typeOf('image/png'), { kind: 'image', ext: 'png' })
check('WebP', typeOf('image/webp'), { kind: 'image', ext: 'webp' })
check('PDF', typeOf('application/pdf'), { kind: 'pdf', ext: 'pdf' })
check('SVG refused', typeOf('image/svg+xml'), null)
check('HTML refused', typeOf('text/html'), null)
check('HEIC refused', typeOf('image/heic'), null)
check('GIF refused', typeOf('image/gif'), null)
check('Word refused', typeOf('application/msword'), null)
check('no type refused', typeOf(''), null)
check('not fooled by built-in names', typeOf('toString'), null)
check('accepted type: no message', fileTypeError({ type: 'application/pdf', name: 'a.pdf' }), '')
check('HEIC by type', fileTypeError({ type: 'image/heic', name: 'IMG_0001.HEIC' }), HEIC)
check('HEIC by name only', fileTypeError({ type: '', name: 'IMG_0001.heic' }), HEIC)
check('HEIF', fileTypeError({ type: 'image/heif', name: 'x' }), HEIC)
check('SVG message', fileTypeError({ type: 'image/svg+xml', name: 'logo.svg' }), WRONG_TYPE)

/* ---------- Photo size: longest side at most 2000 px, never bigger ---------- */
check('landscape photo', fitSize(4032, 3024), { width: 2000, height: 1500 })
check('portrait photo', fitSize(3024, 4032), { width: 1500, height: 2000 })
check('square photo', fitSize(5000, 5000), { width: 2000, height: 2000 })
check('small photo stays as it is', fitSize(800, 600), { width: 800, height: 600 })
check('exactly 2000 stays', fitSize(2000, 1000), { width: 2000, height: 1000 })
check('very thin photo keeps at least 1 px', fitSize(10000, 2), { width: 2000, height: 1 })

/* ---------- File names: at most 200 characters, ending kept ---------- */
const long = 'a'.repeat(300) + '.pdf'
check('long PDF name: 200 characters', Array.from(shortName(long, 'x')).length, MAX_NAME)
check('long PDF name keeps ".pdf"', shortName(long, 'x').endsWith('.pdf'), true)
check('long PDF name keeps its start', shortName(long, 'x').startsWith('aaaa'), true)
check('emoji count as one character', Array.from(shortName('😀'.repeat(250) + '.pdf', 'x')).length, MAX_NAME)
check('an emoji is never cut in half', shortName('😀'.repeat(250) + '.pdf', 'x').endsWith('😀.pdf'), true)
check('short name unchanged', shortName('Requisitos Approbation.pdf', 'x'), 'Requisitos Approbation.pdf')
check('spaces at both ends removed', shortName('  informe.pdf  ', 'x'), 'informe.pdf')
check('empty name gets the fallback', shortName('   ', 'documento.pdf'), 'documento.pdf')
check('exactly 200 unchanged', shortName('b'.repeat(196) + '.pdf', 'x'), 'b'.repeat(196) + '.pdf')
check('long name without an ending is cut', shortName('c'.repeat(250), 'x'), 'c'.repeat(200))
check('no space left before the ending', shortName('d'.repeat(195) + '     ' + 'e'.repeat(20) + '.pdf', 'x'),
  'd'.repeat(195) + '.pdf')

/* ---------- PDF signature ---------- */
const bytes = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)))
check('real PDF start', looksLikePdf(bytes('%PDF-')), true)
check('HTML pretending to be a PDF', looksLikePdf(bytes('<html')), false)
check('too short', looksLikePdf(bytes('%PD')), false)

/* ---------- Path: <post id>/<uuid>.<ending>, never the file's own name ---------- */
const post = '0b7c4f0e-8a51-4c43-9b0e-3f1d2a6b9c10'
check('path with a given uuid', filePath(post, 'pdf', 'A1B2C3D4-0000-4000-8000-000000000000'),
  post + '/a1b2c3d4-0000-4000-8000-000000000000.pdf')
const UUID_PATH = /^[0-9a-f-]{36}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/
check('path with a random uuid matches the database rule', UUID_PATH.test(filePath(post, 'jpg')), true)
check('two paths are never the same', filePath(post, 'jpg') === filePath(post, 'jpg'), false)

/* ---------- Small copies of photos (migration 6) ---------- */
check('small copy side is 480 px', THUMB_SIDE, 480)
check('small copy of a landscape photo', thumbSize(4032, 3024), { width: 480, height: 360 })
check('small copy of a portrait photo', thumbSize(3024, 4032), { width: 360, height: 480 })
check('small copy of a square photo', thumbSize(2000, 2000), { width: 480, height: 480 })
check('small copy of an already shrunk photo', thumbSize(2000, 1500), { width: 480, height: 360 })
check('small photo is never made bigger', thumbSize(300, 200), { width: 300, height: 200 })
check('exactly 480 stays', thumbSize(480, 100), { width: 480, height: 100 })
check('very thin photo keeps at least 1 px', thumbSize(10000, 3), { width: 480, height: 1 })
check('small copy path with a given uuid', thumbPath(post, 'A1B2C3D4-0000-4000-8000-000000000000'),
  post + '/a1b2c3d4-0000-4000-8000-000000000000.jpg')
check('small copy path matches the database rule (lowercase .jpg, post folder)', UUID_PATH.test(thumbPath(post)), true)
check('small copy is in the post\'s folder', thumbPath(post).split('/')[0], post)
check('small copy is always a .jpg', thumbPath(post).endsWith('.jpg'), true)
{
  const photo = filePath(post, 'jpg')
  check('small copy is never the photo\'s own path', thumbPath(post) === photo, false)
}
check('removing a photo with a small copy deletes both files',
  storagePaths({ path: post + '/p.jpg', thumb_path: post + '/t.jpg' }), [post + '/p.jpg', post + '/t.jpg'])
check('removing an old photo deletes only the photo (no empty entry)',
  storagePaths({ path: post + '/p.jpg', thumb_path: null }), [post + '/p.jpg'])
check('removing a PDF deletes only the PDF', storagePaths({ path: post + '/d.pdf', thumb_path: null }), [post + '/d.pdf'])

/* ---------- The preview's tiles (2×2) on the Novedades list ---------- */
const photo = (n: number) => ({ kind: 'image' as const, thumb_path: 't' + n + '.jpg' })
const oldPhoto = { kind: 'image' as const, thumb_path: null }
const pdf = { kind: 'pdf' as const, thumb_path: null }
check('no files: no tiles', previewTiles([]), [])
check('1 file: the file and 3 empty cells', previewTiles([photo(1)]),
  [{ kind: 'thumb', path: 't1.jpg' }, { kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }])
check('3 files in their order, old photo and PDF', previewTiles([pdf, oldPhoto, photo(1)]),
  [{ kind: 'pdf' }, { kind: 'photo' }, { kind: 'thumb', path: 't1.jpg' }, { kind: 'empty' }])
check('4 files: all four shown, no "+N"', previewTiles([photo(1), photo(2), photo(3), pdf]),
  [{ kind: 'thumb', path: 't1.jpg' }, { kind: 'thumb', path: 't2.jpg' }, { kind: 'thumb', path: 't3.jpg' }, { kind: 'pdf' }])
check('5 files: three shown, then "+2"', previewTiles([photo(1), photo(2), photo(3), photo(4), pdf]),
  [{ kind: 'thumb', path: 't1.jpg' }, { kind: 'thumb', path: 't2.jpg' }, { kind: 'thumb', path: 't3.jpg' },
    { kind: 'more', count: 2 }])
check('6 files: "+3"', previewTiles([pdf, pdf, pdf, pdf, pdf, pdf])[3], { kind: 'more', count: 3 })
check('10 files: "+7"', previewTiles(Array.from({ length: 10 }, (_, i) => photo(i)))[3], { kind: 'more', count: 7 })
check('always 4 cells', [1, 2, 3, 4, 5, 6].every((n) => previewTiles(Array.from({ length: n }, () => pdf)).length === 4), true)

/* ---------- What screen readers hear instead of the tiles ---------- */
check('no files: nothing', filesSummary([]), '')
check('1 foto', filesSummary([photo(1)]), 'Archivos: 1 foto')
check('2 fotos', filesSummary([photo(1), oldPhoto]), 'Archivos: 2 fotos')
check('1 PDF', filesSummary([pdf]), 'Archivos: 1 PDF')
check('2 PDF (no plural s)', filesSummary([pdf, pdf]), 'Archivos: 2 PDF')
check('1 foto y 2 PDF', filesSummary([pdf, photo(1), pdf]), 'Archivos: 1 foto y 2 PDF')
check('3 fotos y 1 PDF', filesSummary([photo(1), pdf, photo(2), oldPhoto]), 'Archivos: 3 fotos y 1 PDF')
check('2 fotos y 1 PDF', filesSummary([photo(1), photo(2), pdf]), 'Archivos: 2 fotos y 1 PDF')

/* ---------- Alt text: never empty ---------- */
check('description is the alt text', altText('Edificio de la Ärztekammer', 'Plazos'), 'Edificio de la Ärztekammer')
check('no description', altText(null, 'Nuevos plazos'), 'Foto de la novedad «Nuevos plazos»')
check('only spaces', altText('   ', 'Nuevos plazos'), 'Foto de la novedad «Nuevos plazos»')

/* ---------- Order of a post's files ---------- */
const files = [
  { id: 'c', sort_order: 1, created_at: '2026-11-18T10:00:00Z' },
  { id: 'b', sort_order: 0, created_at: '2026-11-18T11:00:00Z' },
  { id: 'a', sort_order: 0, created_at: '2026-11-18T11:00:00Z' },
  { id: 'd', sort_order: 0, created_at: '2026-11-18T09:00:00Z' },
]
check('sorted by order, then oldest first, then id', sortAttachments(files).map((f) => f.id), ['d', 'a', 'b', 'c'])
check('next order after the last', nextSortOrder(files), 2)
check('next order of an empty post', nextSortOrder([]), 0)

const list = [
  { id: 'x', sort_order: 0 },
  { id: 'y', sort_order: 1 },
  { id: 'z', sort_order: 2 },
]
check('move down', moveItem(list, 0, 1).map((f) => f.id), ['y', 'x', 'z'])
check('move up', moveItem(list, 2, -1).map((f) => f.id), ['x', 'z', 'y'])
check('first can\'t move up', moveItem(list, 0, -1).map((f) => f.id), ['x', 'y', 'z'])
check('last can\'t move down', moveItem(list, 2, 1).map((f) => f.id), ['x', 'y', 'z'])
check('a move saves only the two files that swapped', orderChanges(moveItem(list, 1, 1)),
  [{ id: 'z', sort_order: 1 }, { id: 'y', sort_order: 2 }])
check('old gaps in the order are closed', orderChanges([{ id: 'p', sort_order: 0 }, { id: 'q', sort_order: 5 }]),
  [{ id: 'q', sort_order: 1 }])
check('nothing to save when nothing moved', orderChanges(list), [])

/* ---------- Spanish upload errors ---------- */
check('too big (status in the body)', storageErrorMessage({ status: 400, statusCode: '413' }), 'El archivo pesa más de 10 MB.')
check('too big (HTTP status)', storageErrorMessage({ status: 413 }), 'El archivo pesa más de 10 MB.')
check('wrong type', storageErrorMessage({ status: 400, statusCode: '415' }), WRONG_TYPE)
check('not allowed', storageErrorMessage({ status: 400, statusCode: '403' }).startsWith('No se permitió.'), true)
check('no connection', storageErrorMessage({ name: 'StorageUnknownError' }), NO_CONNECTION)
check('anything else', storageErrorMessage({ status: 500 }), 'Algo salió mal. Inténtalo de nuevo en unos minutos.')

/* =========================================================================== */

if (failures.length) {
  console.error(`${failures.length} FAILED, ${passed} passed\n`)
  for (const failure of failures) console.error('FAIL: ' + failure + '\n')
  process.exitCode = 1
} else {
  console.log(`ALL FILE TESTS PASSED (${passed} checks)`)
}
