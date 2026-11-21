import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage, NOT_ALLOWED } from '../lib/dataErrors.ts'
import { formatBerlinDateTime } from '../lib/berlinTime.ts'
import {
  checkPdf, documentName, documentPath, sortDocuments, storageErrorMessage,
  ACCEPT, BUCKET, DOCUMENT_COLUMNS, PDF_TYPE, type ClientDocument,
} from '../lib/clientFiles.ts'
import styles from './Admin.module.css'

/** Spanish message when the database refuses a client_documents row */
function rowErrorMessage(error: unknown): string {
  if ((error as { code?: string } | null)?.code === NOT_ALLOWED) {
    return 'No tienes permiso para cambiar los documentos de este cliente.'
  }
  return dataErrorMessage(error)
}

/** What the section is doing right now (everything else waits) */
type Busy = null | 'upload' | 'remove'

/** After a change, which element gets the keyboard focus back */
type FocusTarget = { id: string; button: 'remove' } | { heading: true }

/** "Documentos" on a client's admin screen (DECISIONS.md, 21 Nov 2026,
    night): the PDFs the team uploads for this client, who sees them in
    "Mis documentos" (/documentos). Saved at once, one at a time:
    - add ("Subir PDF"): the browser checks the file first (PDF type, starts
      with "%PDF-", at most 10 MB; clientFiles.ts). Then the file is
      uploaded to "<client id>/<random uuid>.pdf" and its client_documents
      row is added. If the row can't be saved, the file is removed again.
    - delete ("Eliminar"): asks inside the page first, then deletes the row,
      then the file. If only the file can't be deleted, the client still
      can't see it (it has no row).
    Only admins may do either: the database decides (migration 8). File
    names are plain text; a name over 200 characters is shortened, keeping
    ".pdf". */
export default function AdminDocumentos({ clientId, isFree, disabled }: {
  clientId: string
  /** The client is on the free plan, so they can't see their documents */
  isFree: boolean
  /** The client screen is reloading: wait */
  disabled: boolean
}) {
  const [items, setItems] = useState<ClientDocument[] | null>(null)  // null = not loaded yet
  const [attempt, setAttempt] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  /* Set together with a state change; used once the page shows it */
  const focusTarget = useRef<FocusTarget | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  /* ---------- Load this client's documents ---------- */
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await db
          .from('client_documents')
          .select(DOCUMENT_COLUMNS)
          .eq('user_id', clientId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .returns<ClientDocument[]>()
        if (cancelled) return
        if (error) { setLoadError(dataErrorMessage(error)); return }
        setItems(sortDocuments(data ?? []))
        setLoadError('')
      } catch (err) {
        if (!cancelled) setLoadError(dataErrorMessage(err))
      }
    }
    void load()
    return () => { cancelled = true }
  }, [clientId, attempt])

  /* ---------- Give the focus back after a change ---------- */
  /* (Buttons are disabled while saving, which takes the focus away from
     them; once the change is on screen, it goes back where it was.) */
  useEffect(() => {
    const target = focusTarget.current
    if (!target || busy) return
    focusTarget.current = null
    if ('heading' in target) {
      headingRef.current?.focus()
      return
    }
    sectionRef.current
      ?.querySelector<HTMLButtonElement>(`[data-file="${target.id}"] [data-button="${target.button}"]`)
      ?.focus()
  }, [busy, items, confirmId])

  const waiting = busy !== null || disabled || !supabase

  function fail(message: string) {
    if (!mounted.current) return
    setError(message)
    setStatus('')
  }

  /* Checks the chosen file at once, so a wrong file is reported before
     "Subir PDF" is pressed (and again when it is) */
  function chooseFile(chosen: File | null) {
    setFile(chosen)
    setStatus('')
    setError('')
    if (!chosen) return
    void checkPdf(chosen).then((message) => {
      // Only if this is still the chosen file
      if (mounted.current && fileRef.current?.files?.[0] === chosen) setError(message)
    }).catch(() => undefined)
  }

  /* ---------- Add a document: first the file, then its row ---------- */
  async function onUpload(e: FormEvent) {
    e.preventDefault()
    if (waiting || !supabase || !items) return
    const db = supabase
    if (!file) {
      setError('Elige un PDF.')
      fileRef.current?.focus()
      return
    }
    setBusy('upload')
    setError('')
    setStatus('Subiendo…')
    try {
      const problem = await checkPdf(file)
      if (problem) { fail(problem); return }
      const path = documentPath(clientId)

      const upload = await db.storage.from(BUCKET).upload(path, file, {
        contentType: PDF_TYPE,
        upsert: false,
        cacheControl: '3600',
      })
      if (upload.error) { fail(storageErrorMessage(upload.error)); return }

      const row = { user_id: clientId, path, file_name: documentName(file.name) }
      const { data, error } = await db
        .from('client_documents').insert(row).select(DOCUMENT_COLUMNS).maybeSingle<ClientDocument>()
      if (error || !data) {
        // No row: remove the file again, so no file is left without one
        await db.storage.from(BUCKET).remove([path]).catch(() => undefined)
        fail(error ? rowErrorMessage(error) : 'No se guardó el documento. Inténtalo de nuevo.')
        return
      }
      if (!mounted.current) return
      setItems((list) => sortDocuments([...(list ?? []), data]))
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setStatus('PDF subido: ' + data.file_name)
    } catch (err) {
      fail(storageErrorMessage(err))
    } finally {
      if (mounted.current) setBusy(null)
    }
  }

  /* ---------- Delete a document: first the row, then the file ---------- */
  async function remove(item: ClientDocument) {
    if (waiting || !supabase) return
    const db = supabase
    setBusy('remove')
    setError('')
    setStatus('')
    try {
      const { data, error } = await db
        .from('client_documents').delete().eq('id', item.id).select('id').maybeSingle()
      if (error || !data) {
        fail(error ? rowErrorMessage(error) : 'No se pudo eliminar. Puede que ya no exista: vuelve a cargar la página.')
        return
      }
      if (mounted.current) {
        setItems((list) => (list ?? []).filter((d) => d.id !== item.id))
        setConfirmId(null)
        focusTarget.current = { heading: true }
      }
      const removed = await db.storage.from(BUCKET).remove([item.path]).catch(() => null)
      if (!mounted.current) return
      setStatus(removed && !removed.error && removed.data?.length === 1
        ? 'Eliminado: ' + item.file_name
        : 'Eliminado de la lista del cliente: ' + item.file_name + '. El archivo no se pudo borrar del ' +
          'almacenamiento, pero el cliente ya no lo ve.')
    } catch (err) {
      fail(rowErrorMessage(err))
    } finally {
      if (mounted.current) setBusy(null)
    }
  }

  function ask(item: ClientDocument) {
    setConfirmId(item.id)
    setError('')
    setStatus('')
    focusTarget.current = { id: item.id, button: 'remove' }  // lands on "Cancelar" (see the buttons)
  }
  function cancel(item: ClientDocument) {
    setConfirmId(null)
    focusTarget.current = { id: item.id, button: 'remove' }
  }

  return (
    /* Wide screens: adding a PDF on the left, the list on the right. On a
       phone, adding first, then the list. */
    <section
      ref={sectionRef} className={styles.docsGrid}
      aria-labelledby="documents-heading" aria-busy={items === null}
    >
      <div className={styles.docsSide}>
        <h2 className={styles.sectionTitle} id="documents-heading" ref={headingRef} tabIndex={-1}>
          Documentos{items ? ` (${items.length})` : ''}
        </h2>
        <p className={styles.hint}>
          Solo PDF, hasta 10 MB. Se guardan al momento y el cliente los ve en «Mis documentos».
          {isFree && <> Con el plan gratis, el cliente no ve sus documentos.</>}
        </p>

        {items && (
          <form className={styles.form} onSubmit={onUpload} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="doc-file">Añadir un PDF</label>
              {/* The browser's own picker shows its words in the device's
                  language; this one is always in Spanish. The real picker is
                  still there (hidden, but reachable with Tab); the button is
                  its label. */}
              <div className={styles.filePickRow}>
                <input
                  ref={fileRef} id="doc-file" className={styles.fileInput} type="file" accept={ACCEPT}
                  onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} disabled={waiting}
                  aria-describedby={'doc-file-chosen' + (error ? ' documents-error' : '')}
                />
                <label className={styles.smallBtn + ' ' + styles.filePick} htmlFor="doc-file">Elegir archivo</label>
                <span className={styles.fileChosen} id="doc-file-chosen">
                  {file ? file.name : 'Ningún archivo elegido'}
                </span>
              </div>
            </div>
            <div className={styles.formBtns}>
              <button type="submit" className={styles.primaryBtn} disabled={waiting}>
                {busy === 'upload' ? 'Subiendo…' : 'Subir PDF'}
              </button>
            </div>
          </form>
        )}

        <div className={styles.live} aria-live="assertive">
          {error && <p className={styles.error} id="documents-error">{error}</p>}
        </div>
        <div className={styles.live} role="status">
          {status && <p className={styles.notice}>{status}</p>}
        </div>
      </div>

      <div className={styles.docsList}>
        {loadError && (
          <div className={styles.message + ' ' + styles.isError} role="alert">
            <p>No se pudieron cargar los documentos. {loadError}</p>
            <button type="button" className={styles.messageBtn} onClick={() => setAttempt((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        )}

        {!items ? (
          !loadError && <p className={styles.note} role="status">Cargando documentos…</p>
        ) : items.length === 0 ? (
          <p className={styles.note}>Este cliente todavía no tiene documentos.</p>
        ) : (
          <ul className={styles.fileList}>
            {items.map((item) => (
              <li key={item.id} className={styles.fileItem} data-file={item.id}>
                {/* Plain text only (never HTML) */}
                <p className={styles.fileInfo}>
                  <span className={styles.fileName}>{item.file_name}</span>
                </p>
                <p className={styles.fileDesc}>
                  Subido el <time dateTime={item.created_at}>{formatBerlinDateTime(item.created_at)}</time> (hora de Alemania)
                </p>
                {confirmId === item.id ? (
                  <div className={styles.confirm}>
                    <p className={styles.confirmText}>
                      ¿Eliminar «{item.file_name}»? El cliente dejará de verlo.
                    </p>
                    <div className={styles.confirmBtns}>
                      <button type="button" className={styles.primaryBtn} onClick={() => void remove(item)} disabled={waiting}>
                        {busy === 'remove' ? 'Eliminando…' : 'Sí, eliminar'}
                      </button>
                      {/* data-button="remove": gets the focus when the question opens */}
                      <button type="button" className={styles.smallBtn} data-button="remove"
                        onClick={() => cancel(item)} disabled={waiting}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.fileBtns}>
                    <button
                      type="button" className={styles.smallBtn} data-button="remove"
                      onClick={() => ask(item)} disabled={waiting}
                      aria-label={'Eliminar: ' + item.file_name}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
