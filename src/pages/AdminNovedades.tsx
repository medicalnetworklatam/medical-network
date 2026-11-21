import { useEffect, useRef, useState, type FormEvent } from 'react'
import AdminLayout from './AdminLayout.tsx'
import AdminNewsFiles from './AdminNewsFiles.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage, NOT_ALLOWED } from '../lib/dataErrors.ts'
import { berlinToUtc, formatBerlinDateTime, utcToBerlin } from '../lib/berlinTime.ts'
import {
  loadNews, NEWS_COLUMNS, NEWS_STATUS_LABEL, newsStatus, sortNews, stateName, STATES,
  type NewsPost, type NewsStatus,
} from '../lib/adminData.ts'
import styles from './Admin.module.css'

/* The form's fields. Date and time are what a clock in Germany shows. */
interface Draft {
  title: string
  body: string
  /** '' = all states */
  state: string
  date: string
  time: string
  published: boolean
  paidOnly: boolean
}

/** A new post: for all states, dated "now" in German time, published and
    paid-only ticked */
function newDraft(): Draft {
  return { title: '', body: '', state: '', ...utcToBerlin(Date.now()), published: true, paidOnly: true }
}

function draftOf(post: NewsPost): Draft {
  return {
    title: post.title,
    body: post.body,
    state: post.state ?? '',
    ...utcToBerlin(post.published_at),
    published: post.published,
    paidOnly: post.paid_only,
  }
}

/** The columns a save may send (the database sets the id) */
interface NewsChange {
  title?: string
  body?: string
  state?: string | null
  published_at?: string
  published?: boolean
  paid_only?: boolean
}

type ListResult =
  | { attempt: number; ok: true }
  | { attempt: number; ok: false; error: string }

/** Spanish message when the database refuses a save */
function saveErrorMessage(error: unknown): string {
  if ((error as { code?: string } | null)?.code === NOT_ALLOWED) {
    return 'No tienes permiso para publicar novedades.'
  }
  return dataErrorMessage(error)
}

const STATUS_CLASS: Record<NewsStatus, string> = {
  draft: styles.isDraft,
  scheduled: styles.isScheduled,
  published: styles.isPublished,
}

/** The admin news form: create, edit, unpublish (untick "Publicada") and
    schedule (a date in the future) news posts, and the list of every post
    with its status. Posts are never deleted here; unpublish instead.
    Photos and PDFs are added to a post once it is saved (it needs its id):
    after saving a new post the form stays open on it, with "Fotos y PDF"
    (AdminNewsFiles.tsx) under the form. */
export default function AdminNovedades() {
  usePageTitle('Publicar novedades · Administración · Medical Network')

  /* ---------- List ---------- */
  const [posts, setPosts] = useState<NewsPost[] | null>(null)  // null = not loaded yet
  const [attempt, setAttempt] = useState(0)
  const [listResult, setListResult] = useState<ListResult | null>(null)
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    let cancelled = false
    async function load() {
      try {
        const rows = await loadNews(db)
        if (cancelled) return
        setPosts(rows)
        setListResult({ attempt, ok: true })
      } catch (err) {
        if (!cancelled) setListResult({ attempt, ok: false, error: dataErrorMessage(err) })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [attempt])
  const listLoading = listResult?.attempt !== attempt
  const listError = listResult && !listResult.ok && !listLoading ? listResult.error : ''

  /* The time used for "Programada" / "Publicada": kept fresh, so a scheduled
     post turns into "Publicada" by itself when its moment comes */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  /* ---------- Form ---------- */
  const [editing, setEditing] = useState<NewsPost | null>(null)  // null = a new post
  const [draft, setDraft] = useState<Draft>(newDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<'title' | 'date' | null>(null)
  /* The last saved post, exactly as the database returned it, and whether
     it was a new one */
  const [saved, setSaved] = useState<{ post: NewsPost; created: boolean } | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  function change(fields: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...fields }))
    setError('')
    setInvalid(null)
    setSaved(null)
  }

  function startEdit(post: NewsPost) {
    setEditing(post)
    setDraft(draftOf(post))
    setError('')
    setInvalid(null)
    setSaved(null)
    titleRef.current?.focus()  // also scrolls the form into view
  }
  function startNew() {
    setEditing(null)
    setDraft(newDraft())
    setError('')
    setInvalid(null)
  }

  /* The typed German date and time as the moment to store */
  const moment = berlinToUtc(draft.date, draft.time)
  /* What the post will be once saved */
  const draftStatus: NewsStatus | null = moment.ok
    ? newsStatus({ published: draft.published, published_at: moment.iso }, now)
    : draft.published ? null : 'draft'

  function fail(message: string, field: 'title' | 'date') {
    setError(message)
    setInvalid(field)
    ;(field === 'title' ? titleRef : dateRef).current?.focus()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving || !supabase) return
    setSaved(null)
    const title = draft.title.trim()
    const body = draft.body.trim()
    if (!title) return fail('Escribe un título.', 'title')
    if (!moment.ok) {
      return fail(
        moment.reason === 'gap'
          ? 'Esa hora no existe en Alemania: ese día el reloj pasa de las 02:00 a las 03:00 por el cambio de hora. Elige otra hora.'
          : 'Escribe una fecha y una hora válidas.',
        'date',
      )
    }

    const all: Required<NewsChange> = {
      title,
      body,
      state: draft.state || null,
      published_at: moment.iso,
      published: draft.published,
      paid_only: draft.paidOnly,
    }
    // Editing: send only what changed. The date only when its fields were
    // changed, so a post's exact seconds aren't lost by editing its text.
    let fields: NewsChange = all
    if (editing) {
      const before = draftOf(editing)
      fields = {}
      if (all.title !== editing.title) fields.title = all.title
      if (all.body !== editing.body) fields.body = all.body
      if (all.state !== editing.state) fields.state = all.state
      if (draft.date !== before.date || draft.time !== before.time) fields.published_at = all.published_at
      if (all.published !== editing.published) fields.published = all.published
      if (all.paid_only !== editing.paid_only) fields.paid_only = all.paid_only
      if (Object.keys(fields).length === 0) {
        setError('No hay cambios que guardar.')
        return
      }
    }

    setSaving(true)
    setError('')
    setInvalid(null)
    try {
      // Either way, ask for the saved row back and show that
      const request = editing
        ? supabase.from('news_posts').update(fields).eq('id', editing.id).select(NEWS_COLUMNS).maybeSingle<NewsPost>()
        : supabase.from('news_posts').insert(fields).select(NEWS_COLUMNS).maybeSingle<NewsPost>()
      const { data, error } = await request
      if (!mounted.current) return
      if (error || !data) {
        // What is on screen stays: the form keeps the text, the list the old post
        setError(error
          ? saveErrorMessage(error)
          : 'No se guardó. Puede que la novedad ya no exista: pulsa «Actualizar».')
        return
      }
      setPosts((list) => sortNews([data, ...(list ?? []).filter((p) => p.id !== data.id)]))
      setNow(Date.now())
      setSaved({ post: data, created: !editing })
      if (editing) {
        startNew()
      } else {
        // A new post: stay on it, so photos and PDFs can be added now
        setEditing(data)
        setDraft(draftOf(data))
      }
    } catch (err) {
      if (mounted.current) setError(saveErrorMessage(err))
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  const submitLabel = saving ? 'Guardando…'
    : editing ? 'Guardar cambios'
    : draftStatus === 'draft' ? 'Guardar borrador'
    : draftStatus === 'scheduled' ? 'Programar'
    : 'Publicar'

  return (
    <AdminLayout title="Publicar novedades" back={{ to: '/admin', label: 'Administración' }}>

      {/* Form */}
      <section className={styles.card + ' ' + styles.newsForm} aria-labelledby="news-form-heading">
        <h2 className={styles.sectionTitle} id="news-form-heading">
          {editing ? 'Editar novedad' : 'Nueva novedad'}
        </h2>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="news-title">Título</label>
            <input
              ref={titleRef} id="news-title" className={styles.input} type="text" required
              value={draft.title} onChange={(e) => change({ title: e.target.value })}
              aria-invalid={invalid === 'title'} aria-describedby={error ? 'news-error' : undefined}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="news-body">Texto</label>
            <textarea
              id="news-body" className={styles.textarea} rows={7}
              value={draft.body} onChange={(e) => change({ body: e.target.value })}
              aria-describedby="news-body-hint"
            />
            <p className={styles.hint} id="news-body-hint">
              Solo texto, con sus saltos de línea. Las direcciones web se convierten en enlaces.
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="news-state">Estado (Bundesland)</label>
            <select
              id="news-state" className={styles.select}
              value={draft.state} onChange={(e) => change({ state: e.target.value })}
            >
              <option value="">Todos los estados</option>
              {STATES.map((s) => <option key={s.id} value={s.id} lang="de">{s.name}</option>)}
            </select>
          </div>

          <fieldset className={styles.fieldset} aria-describedby="news-date-hint">
            <legend className={styles.label}>Fecha de publicación</legend>
            <div className={styles.dateRow}>
              <div className={styles.field}>
                <label className={styles.subLabel} htmlFor="news-date">Fecha</label>
                <input
                  ref={dateRef} id="news-date" className={styles.input} type="date" required
                  value={draft.date} onChange={(e) => change({ date: e.target.value })}
                  aria-invalid={invalid === 'date'}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.subLabel} htmlFor="news-time">Hora</label>
                <input
                  id="news-time" className={styles.input} type="time" required
                  value={draft.time} onChange={(e) => change({ time: e.target.value })}
                  aria-invalid={invalid === 'date'}
                />
              </div>
            </div>
            <p className={styles.hint} id="news-date-hint">
              Hora de Alemania. Con una fecha futura, la novedad queda programada y los clientes
              la ven cuando llegue ese momento.
            </p>
          </fieldset>

          <label className={styles.check}>
            <input
              type="checkbox" checked={draft.published}
              onChange={(e) => change({ published: e.target.checked })}
            />
            <span>
              Publicada
              <span className={styles.checkHint}>Sin marcar, se guarda como borrador y los clientes no la ven.</span>
            </span>
          </label>

          <label className={styles.check}>
            <input
              type="checkbox" checked={draft.paidOnly}
              onChange={(e) => change({ paidOnly: e.target.checked })}
            />
            <span>
              Solo para clientes de pago
              <span className={styles.checkHint}>Sin marcar, también la ven las cuentas gratis.</span>
            </span>
          </label>

          {draftStatus && (
            <p className={styles.note}>
              Al guardar quedará como{' '}
              <span className={styles.status + ' ' + STATUS_CLASS[draftStatus]}>{NEWS_STATUS_LABEL[draftStatus]}</span>
            </p>
          )}

          <div className={styles.live} aria-live="assertive">
            {error && <p className={styles.error} id="news-error">{error}</p>}
          </div>
          <div className={styles.live} role="status">
            {saved && (
              <p className={styles.notice}>
                Guardada: «{saved.post.title}» · {NEWS_STATUS_LABEL[newsStatus(saved.post, now)]}
                {saved.created && '. Ahora puedes añadirle fotos y PDF, abajo.'}
              </p>
            )}
          </div>

          <div className={styles.formBtns}>
            <button type="submit" className={styles.primaryBtn} disabled={saving || !supabase}>
              {submitLabel}
            </button>
            {editing && (
              <button type="button" className={styles.smallBtn} onClick={startNew} disabled={saving}>
                Cancelar edición
              </button>
            )}
          </div>
        </form>

        {/* Photos and PDFs: only for a saved post (they need its id) */}
        {editing ? (
          <AdminNewsFiles key={editing.id} postId={editing.id} postTitle={editing.title} disabled={saving} />
        ) : (
          <div className={styles.files}>
            <h3 className={styles.sectionTitle}>Fotos y PDF</h3>
            <p className={styles.note}>
              Guarda la novedad primero; después podrás añadirle fotos y PDF aquí. Para que los clientes
              la vean completa desde el principio, guárdala sin marcar «Publicada», añade los archivos
              y luego márcala.
            </p>
          </div>
        )}
      </section>

      {/* Every post, newest first */}
      <section className={styles.list + ' ' + styles.newsList} aria-labelledby="news-list-heading" aria-busy={listLoading}>
        <div className={styles.listHead}>
          <h2 className={styles.sectionTitle} id="news-list-heading">
            {posts ? `Todas las novedades (${posts.length})` : 'Todas las novedades'}
          </h2>
          <button
            type="button" className={styles.smallBtn}
            onClick={() => setAttempt((n) => n + 1)} disabled={listLoading || saving}
          >
            {listLoading && posts ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {listError && (
          <div className={styles.message + ' ' + styles.isError} role="alert">
            <p>No se pudieron cargar las novedades. {listError}</p>
          </div>
        )}

        {!posts ? (
          listLoading && <p className={styles.message} role="status">Cargando novedades…</p>
        ) : posts.length === 0 ? (
          <p className={styles.message}>Todavía no hay novedades.</p>
        ) : (
          posts.map((post) => {
            const status = newsStatus(post, now)
            const isEditing = editing?.id === post.id
            return (
              <article key={post.id} className={styles.post + (isEditing ? ' ' + styles.isEditing : '')}>
                <p className={styles.postMeta}>
                  <span className={styles.status + ' ' + STATUS_CLASS[status]}>{NEWS_STATUS_LABEL[status]}</span>
                  <time dateTime={post.published_at}>{formatBerlinDateTime(post.published_at)}</time>
                  {/* A state's post: Para ti; all states: Para todos */}
                  {post.state
                    ? <span className={styles.newsTag + ' ' + styles.isParaTi} lang="de">{stateName(post.state) || post.state}</span>
                    : <span className={styles.newsTag + ' ' + styles.isParaTodos}>Todos los estados</span>}
                  <span>{post.paid_only ? 'Solo de pago' : 'También gratis'}</span>
                </p>
                {/* Plain text only (never HTML); line breaks kept by CSS */}
                <h3 className={styles.postTitle}>{post.title}</h3>
                {post.body && <p className={styles.postText}>{post.body}</p>}
                <div className={styles.postActions}>
                  <button
                    type="button" className={styles.smallBtn}
                    onClick={() => startEdit(post)} disabled={saving || isEditing}
                    aria-label={'Editar: ' + post.title}
                  >
                    {isEditing ? 'Editando…' : 'Editar'}
                  </button>
                </div>
              </article>
            )
          })
        )}
      </section>
    </AdminLayout>
  )
}
