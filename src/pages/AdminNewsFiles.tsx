import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage, NOT_ALLOWED } from '../lib/dataErrors.ts'
import {
  altText, fileTypeError, filePath, moveItem, nextSortOrder, orderChanges, prepareFile, shortName,
  sortAttachments, storageErrorMessage, storagePaths, thumbPath, typeOf,
  ACCEPT, ATTACHMENT_COLUMNS, BUCKET, MAX_FILES, MAX_NAME, type Attachment,
} from '../lib/newsFiles.ts'
import styles from './Admin.module.css'

/** Spanish message when the database refuses an attachment row */
function rowErrorMessage(error: unknown): string {
  if ((error as { code?: string } | null)?.code === NOT_ALLOWED) {
    return 'No tienes permiso para cambiar los archivos de las novedades.'
  }
  return dataErrorMessage(error)
}

/** What the section is doing right now (everything else waits) */
type Busy = null | 'upload' | 'order' | 'remove'

/** After a change, which button gets the keyboard focus back */
type FocusTarget = { id: string; button: 'up' | 'down' | 'remove' } | { heading: true }

/** "Fotos y PDF" in the admin news form, for a post that is already saved
    (it needs the post's id). Files are saved at once, without "Guardar
    cambios":
    - add: the file is checked and, for photos, shrunk and re-saved in the
      browser (newsFiles.ts), uploaded to "<post id>/<uuid>.<ending>", then
      its news_attachments row is added. A photo also gets a small copy
      (480 px JPEG, migration 6), made in the same step and uploaded right
      after the photo; the admin sees no extra step. Order: photo, small
      copy, row. If the small copy can't be uploaded, the photo is removed
      again; if the row can't be saved, both files are removed again.
    - order: "Arriba" / "Abajo" swap two files
    - remove: asks first, then deletes the row, then the file (and a
      photo's small copy). If only the files can't be deleted, clients
      still can't see them (they have no row).
    At most 10 files per post. Names and descriptions are plain text. */
export default function AdminNewsFiles({ postId, postTitle, disabled }: {
  postId: string
  postTitle: string
  /** The news form is saving: wait */
  disabled: boolean
}) {
  const [items, setItems] = useState<Attachment[] | null>(null)  // null = not loaded yet
  const [attempt, setAttempt] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
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

  /* ---------- Load this post's files ---------- */
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await db
          .from('news_attachments')
          .select(ATTACHMENT_COLUMNS)
          .eq('post_id', postId)
          .returns<Attachment[]>()
        if (cancelled) return
        if (error) { setLoadError(dataErrorMessage(error)); return }
        setItems(sortAttachments(data ?? []))
        setLoadError('')
      } catch (err) {
        if (!cancelled) setLoadError(dataErrorMessage(err))
      }
    }
    void load()
    return () => { cancelled = true }
  }, [postId, attempt])

  /* ---------- Give the focus back after a change ---------- */
  /* (Buttons are disabled while saving, which takes the focus away from
     them; once the change is on screen, it goes back to the same file.) */
  useEffect(() => {
    const target = focusTarget.current
    if (!target || busy) return
    focusTarget.current = null
    if ('heading' in target) {
      headingRef.current?.focus()
      return
    }
    const item = sectionRef.current?.querySelector(`[data-file="${target.id}"]`)
    const wanted = item?.querySelector<HTMLButtonElement>(`[data-button="${target.button}"]`)
    // At the top or bottom of the list, "Arriba" / "Abajo" is disabled: use another button
    const button = wanted && !wanted.disabled ? wanted
      : item?.querySelector<HTMLButtonElement>('[data-button]:not(:disabled)')
    button?.focus()
  }, [busy, items, confirmId])

  const waiting = busy !== null || disabled || !supabase
  const isPhoto = file ? typeOf(file.type)?.kind === 'image' : false

  function setFocus(target: FocusTarget) {
    focusTarget.current = target
  }

  function fail(message: string) {
    if (!mounted.current) return
    setError(message)
    setStatus('')
  }

  function chooseFile(chosen: File | null) {
    setFile(chosen)
    setStatus('')
    setError(chosen ? fileTypeError(chosen) : '')
  }

  /* ---------- Add a file ---------- */
  async function onUpload(e: FormEvent) {
    e.preventDefault()
    if (waiting || !supabase || !items) return
    const db = supabase
    if (!file) {
      setError('Elige una foto o un PDF.')
      fileRef.current?.focus()
      return
    }
    if (items.length >= MAX_FILES) {
      setError('Esta novedad ya tiene 10 archivos, el máximo.')
      return
    }
    setBusy('upload')
    setError('')
    setStatus('Subiendo…')
    try {
      const prepared = await prepareFile(file)
      if (!prepared.ok) { fail(prepared.error); return }
      const ready = prepared.file
      const path = filePath(postId, ready.ext)

      const upload = await db.storage.from(BUCKET).upload(path, ready.blob, {
        contentType: ready.contentType,
        upsert: false,
        cacheControl: '3600',
      })
      if (upload.error) { fail(storageErrorMessage(upload.error)); return }

      // A photo's small copy, right after the photo. If it fails, stop and
      // remove the photo again, so no photo is left without its row.
      let thumb: string | null = null
      if (ready.thumb) {
        thumb = thumbPath(postId)
        const small = await db.storage.from(BUCKET).upload(thumb, ready.thumb, {
          contentType: 'image/jpeg',
          upsert: false,
          cacheControl: '3600',
        }).catch((err: unknown) => ({ error: err }))
        if (small.error) {
          await db.storage.from(BUCKET).remove([path]).catch(() => undefined)
          fail(storageErrorMessage(small.error))
          return
        }
      }
      const uploaded = thumb ? [path, thumb] : [path]

      const row = {
        post_id: postId,
        kind: ready.kind,
        path,
        file_name: shortName(file.name, ready.kind === 'pdf' ? 'documento.pdf' : 'foto.' + ready.ext),
        description: ready.kind === 'image' ? description.trim() || null : null,
        thumb_path: thumb,
        sort_order: nextSortOrder(items),
      }
      const { data, error } = await db
        .from('news_attachments').insert(row).select(ATTACHMENT_COLUMNS).maybeSingle<Attachment>()
      if (error || !data) {
        // No row: remove the file (and the small copy) again, so no file is
        // left without one
        await db.storage.from(BUCKET).remove(uploaded).catch(() => undefined)
        fail(error ? rowErrorMessage(error) : 'No se guardó el archivo. Inténtalo de nuevo.')
        return
      }
      if (!mounted.current) return
      setItems((list) => sortAttachments([...(list ?? []), data]))
      setFile(null)
      setDescription('')
      if (fileRef.current) fileRef.current.value = ''
      setStatus((data.kind === 'pdf' ? 'PDF añadido: ' : 'Foto añadida: ') + data.file_name)
    } catch (err) {
      fail(storageErrorMessage(err))
    } finally {
      if (mounted.current) setBusy(null)
    }
  }

  /* ---------- Move a file up or down ---------- */
  async function move(index: number, delta: -1 | 1) {
    if (waiting || !supabase || !items) return
    const db = supabase
    const moved = items[index]
    const next = moveItem(items, index, delta)
    const changes = orderChanges(next)
    if (changes.length === 0) return
    setBusy('order')
    setError('')
    setStatus('')
    try {
      const results = await Promise.all(changes.map((c) =>
        db.from('news_attachments').update({ sort_order: c.sort_order }).eq('id', c.id).select('id').maybeSingle()))
      if (!mounted.current) return
      const failed = results.find((r) => r.error || !r.data)
      if (failed) {
        fail(failed.error ? rowErrorMessage(failed.error) : 'No se pudo guardar el orden. Inténtalo de nuevo.')
        setAttempt((n) => n + 1)  // show the order as it is saved now
        return
      }
      setItems(next.map((a, i) => ({ ...a, sort_order: i })))
      setStatus(`Orden guardado: «${moved.file_name}» está en el puesto ${index + delta + 1} de ${next.length}.`)
      setFocus({ id: moved.id, button: delta < 0 ? 'up' : 'down' })
    } catch (err) {
      fail(rowErrorMessage(err))
    } finally {
      if (mounted.current) setBusy(null)
    }
  }

  /* ---------- Remove a file: first the row, then the file ---------- */
  async function remove(item: Attachment) {
    if (waiting || !supabase) return
    const db = supabase
    setBusy('remove')
    setError('')
    setStatus('')
    try {
      const { data, error } = await db
        .from('news_attachments').delete().eq('id', item.id).select('id').maybeSingle()
      if (error || !data) {
        fail(error ? rowErrorMessage(error) : 'No se pudo quitar. Puede que ya no exista: vuelve a cargar la página.')
        return
      }
      if (mounted.current) {
        setItems((list) => (list ?? []).filter((a) => a.id !== item.id))
        setConfirmId(null)
        setFocus({ heading: true })
      }
      // The file, and a photo's small copy when it has one (a photo from
      // before migration 6 has none: then only the photo's path)
      const paths = storagePaths(item)
      const removed = await db.storage.from(BUCKET).remove(paths).catch(() => null)
      if (!mounted.current) return
      setStatus(removed && !removed.error && removed.data?.length === paths.length
        ? 'Quitado: ' + item.file_name
        : 'Quitado de la novedad: ' + item.file_name + '. El archivo no se pudo borrar del almacenamiento, ' +
          'pero los clientes ya no lo ven.')
    } catch (err) {
      fail(rowErrorMessage(err))
    } finally {
      if (mounted.current) setBusy(null)
    }
  }

  function ask(item: Attachment) {
    setConfirmId(item.id)
    setError('')
    setStatus('')
    setFocus({ id: item.id, button: 'remove' })  // lands on "Cancelar" (see the buttons)
  }
  function cancel(item: Attachment) {
    setConfirmId(null)
    setFocus({ id: item.id, button: 'remove' })
  }

  return (
    /* Wide screens: adding a file on the left, the list on the right. On a
       phone, adding first, then the list. */
    <section ref={sectionRef} className={styles.docsGrid} aria-labelledby="files-heading" aria-busy={items === null}>
      <div className={styles.docsSide}>
        <h2 className={styles.sectionTitle} id="files-heading" ref={headingRef} tabIndex={-1}>
          Fotos y PDF{items ? ` (${items.length} de ${MAX_FILES})` : ''}
        </h2>
        <p className={styles.hint}>
          Se guardan al momento, sin pulsar «Guardar cambios». Fotos JPG, PNG o WebP: se reducen a
          2000 px y se les quitan los datos ocultos, como la ubicación. PDF de hasta 10 MB.
        </p>

        {items && (items.length >= MAX_FILES ? (
          <p className={styles.notice}>
            Esta novedad ya tiene 10 archivos, el máximo. Quita uno para añadir otro.
          </p>
        ) : (
          <form className={styles.form} onSubmit={onUpload} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="news-file">Añadir una foto o un PDF</label>
              {/* The browser's own picker shows its words in the device's
                  language; this one is always in Spanish. The real picker is
                  still there (hidden, but reachable with Tab); the button is
                  its label. */}
              <div className={styles.filePickRow}>
                <input
                  ref={fileRef} id="news-file" className={styles.fileInput} type="file" accept={ACCEPT}
                  onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} disabled={waiting}
                  aria-describedby={'news-file-chosen' + (error ? ' files-error' : '')}
                />
                <label className={styles.smallBtn + ' ' + styles.filePick} htmlFor="news-file">Elegir archivo</label>
                <span className={styles.fileChosen} id="news-file-chosen">
                  {file ? file.name : 'Ningún archivo elegido'}
                </span>
              </div>
            </div>
            {isPhoto && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="news-file-desc">Descripción de la foto (opcional)</label>
                <input
                  id="news-file-desc" className={styles.input} type="text" maxLength={MAX_NAME}
                  value={description} onChange={(e) => setDescription(e.target.value)} disabled={waiting}
                  aria-describedby="news-file-desc-hint"
                />
                <p className={styles.hint} id="news-file-desc-hint">
                  La oyen quienes usan un lector de pantalla. Si la dejas vacía, se lee
                  «{altText(null, postTitle)}».
                </p>
              </div>
            )}
            <div className={styles.formBtns}>
              <button type="submit" className={styles.primaryBtn} disabled={waiting}>
                {busy === 'upload' ? 'Subiendo…' : 'Subir archivo'}
              </button>
            </div>
          </form>
        ))}

        <div className={styles.live} aria-live="assertive">
          {error && <p className={styles.error} id="files-error">{error}</p>}
        </div>
        <div className={styles.live} role="status">
          {status && <p className={styles.notice}>{status}</p>}
        </div>
      </div>

      <div className={styles.docsList}>
        {loadError && (
          <div className={styles.message + ' ' + styles.isError} role="alert">
            <p>No se pudieron cargar los archivos. {loadError}</p>
            <button type="button" className={styles.messageBtn} onClick={() => setAttempt((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        )}

        {!items ? (
          !loadError && <p className={styles.note} role="status">Cargando archivos…</p>
        ) : items.length === 0 ? (
          <p className={styles.note}>Esta novedad todavía no tiene fotos ni PDF.</p>
        ) : (
          <ol className={styles.fileList}>
            {items.map((item, i) => (
              <li key={item.id} className={styles.fileItem} data-file={item.id}>
                {/* Plain text only (never HTML) */}
                <p className={styles.fileInfo}>
                  <span className={styles.tag}>{item.kind === 'pdf' ? 'PDF' : 'Foto'}</span>{' '}
                  <span className={styles.fileName}>{item.file_name}</span>
                </p>
                {item.kind === 'image' && (
                  <p className={styles.fileDesc}>
                    {item.description
                      ? <>Descripción: {item.description}</>
                      : <>Sin descripción: se lee «{altText(null, postTitle)}».</>}
                  </p>
                )}
                {confirmId === item.id ? (
                  <div className={styles.confirm}>
                    <p className={styles.confirmText}>
                      ¿Quitar «{item.file_name}» de la novedad? Los clientes dejarán de verlo.
                    </p>
                    <div className={styles.confirmBtns}>
                      <button type="button" className={styles.primaryBtn} onClick={() => void remove(item)} disabled={waiting}>
                        {busy === 'remove' ? 'Quitando…' : 'Sí, quitar'}
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
                      type="button" className={styles.smallBtn} data-button="up"
                      onClick={() => void move(i, -1)} disabled={waiting || i === 0}
                      aria-label={'Mover arriba: ' + item.file_name}
                    >
                      <span aria-hidden="true">↑{'\u00a0'}</span>Arriba
                    </button>
                    <button
                      type="button" className={styles.smallBtn} data-button="down"
                      onClick={() => void move(i, 1)} disabled={waiting || i === items.length - 1}
                      aria-label={'Mover abajo: ' + item.file_name}
                    >
                      <span aria-hidden="true">↓{'\u00a0'}</span>Abajo
                    </button>
                    <button
                      type="button" className={styles.smallBtn} data-button="remove"
                      onClick={() => ask(item)} disabled={waiting}
                      aria-label={'Quitar: ' + item.file_name}
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
