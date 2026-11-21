import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage, NOT_ALLOWED } from '../lib/dataErrors.ts'
import { berlinToUtc, utcToBerlin } from '../lib/berlinTime.ts'
import {
  NEWS_COLUMNS, NEWS_STATUS_LABEL, newsStatus, STATES,
  type NewsPost, type NewsStatus,
} from '../lib/adminData.ts'
import { STATUS_CLASS } from './adminNewsStatus.ts'
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

/** Spanish message when the database refuses a save */
function saveErrorMessage(error: unknown): string {
  if ((error as { code?: string } | null)?.code === NOT_ALLOWED) {
    return 'No tienes permiso para publicar novedades.'
  }
  return dataErrorMessage(error)
}

/** The news form: a new post (`editing` null) or one post's text and
    publication. Schedules with a date in the future; unticking "Publicada"
    unpublishes. Posts are never deleted here.
    - A new post: once saved, `onSaved(post, true)` (the page then opens its
      "Fotos y PDF", which need its id).
    - An edit: sends only what changed, then shows "Guardada" and keeps the
      form on the saved post; `onSaved(post, false)`.
    On wide screens: title and text on the left, the rest on the right. */
export default function AdminNewsForm({ editing, onSaved }: {
  editing: NewsPost | null
  onSaved: (post: NewsPost, created: boolean) => void
}) {
  /* The time used for "Programada" / "Publicada": kept fresh, so a
     scheduled post turns into "Publicada" by itself when its moment comes */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const [draft, setDraft] = useState<Draft>(() => (editing ? draftOf(editing) : newDraft()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<'title' | 'date' | null>(null)
  /* The last saved post, exactly as the database returned it */
  const [saved, setSaved] = useState<NewsPost | null>(null)
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
        // What is on screen stays: the form keeps the text
        setError(error
          ? saveErrorMessage(error)
          : 'No se guardó. Puede que la novedad ya no exista: vuelve a «Novedades».')
        return
      }
      setNow(Date.now())
      if (editing) {
        // Stay on the post, now exactly as saved
        setDraft(draftOf(data))
        setSaved(data)
      }
      onSaved(data, !editing)
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
    <section className={styles.card} aria-labelledby="news-form-heading">
      {/* The page title already says it: for screen readers only */}
      <h2 className="sr-only" id="news-form-heading">
        {editing ? 'Editar novedad' : 'Nueva novedad'}
      </h2>
      <form className={styles.newsFormGrid} onSubmit={onSubmit} noValidate>
        <div className={styles.form}>
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
              id="news-body" className={styles.textarea + ' ' + styles.newsBody} rows={7}
              value={draft.body} onChange={(e) => change({ body: e.target.value })}
              aria-describedby="news-body-hint"
            />
            <p className={styles.hint} id="news-body-hint">
              Solo texto, con sus saltos de línea. Las direcciones web se convierten en enlaces.
            </p>
          </div>
        </div>

        <div className={styles.form}>
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
                Guardada: «{saved.title}» · {NEWS_STATUS_LABEL[newsStatus(saved, now)]}
              </p>
            )}
          </div>

          <div className={styles.formBtns}>
            <button type="submit" className={styles.primaryBtn} disabled={saving || !supabase}>
              {submitLabel}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
