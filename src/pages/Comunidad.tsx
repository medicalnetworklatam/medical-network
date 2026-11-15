import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import SessionButton from './SessionButton.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { useAuth } from '../lib/auth.ts'
import { authorName, useProfile } from '../lib/profile.ts'
import { supabase } from '../lib/supabase.ts'
import { CHECK_FAILED, dataErrorMessage, NOT_ALLOWED } from '../lib/dataErrors.ts'
import styles from './Comunidad.module.css'

/** One community post as the page gets it (all plain text) */
interface Post {
  id: string
  author_id: string
  author_name: string
  body: string
  /** Exactly as the database sent it (with microseconds). Used as-is for
      "Ver más", never turned into a JavaScript Date and back. */
  created_at: string
}

const COLUMNS = 'id, author_id, author_name, body, created_at'
const PAGE = 30   // posts per page
const MAX = 2000  // the database allows 1 to 2,000 characters

/** Removes spaces, tabs, carriage returns and line breaks at both ends,
    exactly like the database does (btrim(body, E' \t\r\n')). Not .trim(),
    which also removes other kinds of spaces the database keeps. */
function dbTrim(text: string): string {
  return text.replace(/^[ \t\r\n]+/, '').replace(/[ \t\r\n]+$/, '')
}

/** Counts characters like the database (char_length): an emoji counts as 1 */
function countChars(text: string): number {
  return Array.from(text).length
}

/* "15 nov 2026, 14:05", in the reader's own time zone */
const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso)).replace('.', '')
}

/** Spanish message when the database refuses a new post */
function publishErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code === NOT_ALLOWED) {
    return 'No tienes permiso para publicar en la comunidad. Si crees que es un error, contáctanos.'
  }
  if (code === CHECK_FAILED) return 'La publicación debe tener entre 1 y 2000 caracteres.'
  return dataErrorMessage(error)
}

/** The community board: one board for all members (text only). Paid members
    and admins read and write; free users only see a short message. */
export default function Comunidad() {
  usePageTitle('Comunidad · Medical Network')
  const { session } = useAuth()
  const { profile } = useProfile()
  const userId = session?.user.id ?? null
  const isAdmin = profile?.is_admin === true
  // The database (RLS) decides in the end; this only avoids useless requests
  const canRead = profile?.plan === 'paid' || isAdmin

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link className={styles.pill} to="/novedades">
            <span aria-hidden="true">←</span> Novedades
          </Link>
          <SessionButton />
        </header>

        <main className={styles.main}>
          <h1 className={styles.pageTitle}>COMUNIDAD</h1>

          {profile && !profile.main_state && (
            <p className={styles.reminder}>
              Aún no has elegido tu estado.{' '}
              <Link className={styles.reminderLink} to="/estados">Elegir mi estado</Link>
            </p>
          )}

          {canRead && userId && profile ? (
            <Board
              key={userId}
              userId={userId}
              isAdmin={isAdmin}
              shownName={authorName(profile.first_name ?? '', profile.last_names ?? '')}
            />
          ) : (
            <p className={styles.message}>La comunidad es para miembros con el paquete completo.</p>
          )}
        </main>
      </div>
    </div>
  )
}

/** The list and the form, for paid members and admins only */
function Board({ userId, isAdmin, shownName }: { userId: string; isAdmin: boolean; shownName: string }) {
  /* ---------- List ---------- */
  const [posts, setPosts] = useState<Post[] | null>(null)  // null = not loaded yet
  const [hasMore, setHasMore] = useState(false)
  // Which list request is running: the newest posts, or older ones ("Ver más")
  const [listBusy, setListBusy] = useState<'first' | 'more' | null>('first')
  const [listError, setListError] = useState('')
  // Counts list requests: an answer arriving after the page closed is ignored
  const requestNo = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  /** Asks for one page of posts, newest first. With `after`, only posts
      older than that one ("keyset paging": by created_at, then id for posts
      with the very same time). One extra post tells us if more exist. */
  async function fetchPage(after: Post | null): Promise<{ rows: Post[] } | { error: string }> {
    if (!supabase) return { error: dataErrorMessage(null) }
    try {
      let query = supabase
        .from('community_posts')
        .select(COLUMNS)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE + 1)
      if (after) {
        // created_at goes in exactly as the database sent it, in quotes
        // (it contains "." and ":", which PostgREST would read as syntax)
        const t = '"' + after.created_at + '"'
        query = query.or(`created_at.lt.${t},and(created_at.eq.${t},id.lt.${after.id})`)
      }
      const { data, error } = await query.returns<Post[]>()
      return error ? { error: dataErrorMessage(error) } : { rows: data ?? [] }
    } catch (err) {
      return { error: dataErrorMessage(err) }
    }
  }

  /** Shows the answer to a request for the newest posts, unless a newer
      request was made since (or the page was closed) */
  function showFirst(mine: number, result: { rows: Post[] } | { error: string }) {
    if (!mounted.current || mine !== requestNo.current) return
    setListBusy(null)
    if ('error' in result) {
      setListError(result.error) // the posts already shown stay
      return
    }
    setListError('')
    setPosts(result.rows.slice(0, PAGE))
    setHasMore(result.rows.length > PAGE)
  }

  /** The newest posts again: after publishing, and with "Actualizar" */
  function loadFirst() {
    const mine = ++requestNo.current
    setListBusy('first')
    void fetchPage(null).then((result) => showFirst(mine, result))
  }

  async function loadMore() {
    const last = posts?.[posts.length - 1]
    if (!last || listBusy) return
    const mine = ++requestNo.current
    setListBusy('more')
    const result = await fetchPage(last)
    if (!mounted.current || mine !== requestNo.current) return
    setListBusy(null)
    if ('error' in result) {
      setListError(result.error)
      return
    }
    setListError('')
    setPosts((list) => {
      const known = new Set((list ?? []).map((p) => p.id))
      return [...(list ?? []), ...result.rows.slice(0, PAGE).filter((p) => !known.has(p.id))]
    })
    setHasMore(result.rows.length > PAGE)
  }

  // When the page opens (listBusy already starts as 'first'). Runs once:
  // a different user gets a new Board (key={userId}).
  useEffect(() => {
    const mine = ++requestNo.current
    void fetchPage(null).then((result) => showFirst(mine, result))
  }, [])

  /* Short Spanish messages for screen readers ("Publicación eliminada.") */
  const [announcement, setAnnouncement] = useState('')

  /* ---------- Form ---------- */
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)
  const body = dbTrim(draft)
  const count = countChars(body)
  const tooLong = count > MAX
  const canPublish = body !== '' && !tooLong && !sending

  async function onPublish(e: FormEvent) {
    e.preventDefault()
    if (!canPublish || !supabase) return
    setSending(true)
    setFormError('')
    setAnnouncement('')
    try {
      // Only the body: the database sets the author, the name and the date
      const { data, error } = await supabase
        .from('community_posts')
        .insert({ body })
        .select(COLUMNS)
        .single<Post>()
      if (!mounted.current) return
      if (error || !data) {
        setFormError(publishErrorMessage(error)) // the text stays in the box
        textRef.current?.focus()
        return
      }
      setDraft('')
      setPosts((list) => [data, ...(list ?? []).filter((p) => p.id !== data.id)])
      setAnnouncement('Publicación publicada.')
      loadFirst()
    } catch (err) {
      if (!mounted.current) return
      setFormError(publishErrorMessage(err))
      textRef.current?.focus()
    } finally {
      if (mounted.current) setSending(false)
    }
  }

  /* ---------- Delete ---------- */
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)
  const listHeadingRef = useRef<HTMLHeadingElement>(null)

  async function onDelete(post: Post) {
    if (deletingId || !supabase) return
    setDeletingId(post.id)
    setDeleteError(null)
    setAnnouncement('')
    let message = ''
    try {
      // Ask for the deleted row back: if the database refuses (RLS), nothing
      // is deleted and nothing comes back, without any error
      const { data, error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', post.id)
        .select('id')
      if (error) message = dataErrorMessage(error)
      else if (!data?.length) {
        message = 'No se pudo eliminar. Puede que ya se haya eliminado: pulsa «Actualizar».'
      }
    } catch (err) {
      message = dataErrorMessage(err)
    }
    if (!mounted.current) return
    setDeletingId(null)
    if (message) {
      setDeleteError({ id: post.id, message })
      return
    }
    setConfirmingId(null)
    setPosts((list) => (list ?? []).filter((p) => p.id !== post.id))
    setAnnouncement('Publicación eliminada.')
    listHeadingRef.current?.focus()
  }

  return (
    <>
      <span className="sr-only" role="status">{announcement}</span>

      {/* Form */}
      <section className={styles.card} aria-labelledby="new-post-heading">
        <h2 className={styles.sectionTitle} id="new-post-heading">Nueva publicación</h2>
        <p className={styles.intro}>
          Comparte tu experiencia con los trámites. Solo texto. Los demás miembros verán tu nombre
          como «{shownName}».
        </p>
        <form className={styles.form} onSubmit={onPublish} noValidate>
          <label className="sr-only" htmlFor="post-body">Tu publicación</label>
          <textarea
            ref={textRef} id="post-body" className={styles.textarea}
            rows={5} value={draft}
            onChange={(e) => { setDraft(e.target.value); setFormError('') }}
            aria-describedby={'post-count' + (formError ? ' post-error' : '')}
            aria-invalid={tooLong}
          />
          <div className={styles.formRow}>
            <p className={styles.counter + (tooLong ? ' ' + styles.isOver : '')} id="post-count">
              {count} / {MAX}
              <span className="sr-only"> caracteres</span>
            </p>
            <button type="submit" className={styles.primaryBtn} disabled={!canPublish}>
              {sending ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
          <div className={styles.live} aria-live="polite">
            {tooLong && <p className={styles.fieldNote}>Puedes escribir como máximo 2000 caracteres.</p>}
          </div>
          <div className={styles.live} aria-live="assertive">
            {formError && <p className={styles.error} id="post-error">{formError}</p>}
          </div>
        </form>
      </section>

      {/* List */}
      <section className={styles.list} aria-labelledby="posts-heading" aria-busy={listBusy !== null}>
        <div className={styles.listHead}>
          <h2 className={styles.sectionTitle} id="posts-heading" ref={listHeadingRef} tabIndex={-1}>
            Publicaciones
          </h2>
          <button
            type="button" className={styles.smallBtn}
            onClick={loadFirst} disabled={listBusy !== null}
          >
            {listBusy === 'first' && posts ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {listError && (
          <div className={styles.message + ' ' + styles.isError} role="alert">
            <p>No se pudieron cargar las publicaciones. {listError}</p>
          </div>
        )}

        {!posts ? (
          listBusy && <p className={styles.message} role="status">Cargando publicaciones…</p>
        ) : posts.length === 0 ? (
          <p className={styles.message}>Todavía no hay publicaciones. Comparte la primera.</p>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              canDelete={isAdmin || post.author_id === userId}
              confirming={confirmingId === post.id}
              deleting={deletingId === post.id}
              error={deleteError?.id === post.id ? deleteError.message : ''}
              onAsk={() => { setConfirmingId(post.id); setDeleteError(null) }}
              onCancel={() => { setConfirmingId(null); setDeleteError(null) }}
              onConfirm={() => void onDelete(post)}
            />
          ))
        )}

        {posts && hasMore && (
          <button
            type="button" className={styles.moreBtn}
            onClick={() => void loadMore()} disabled={listBusy !== null}
          >
            {listBusy === 'more' ? 'Cargando…' : 'Ver más'}
          </button>
        )}
      </section>
    </>
  )
}

/** One post. The body is plain text (never HTML, no automatic links); CSS
    keeps its line breaks. */
function PostCard({ post, canDelete, confirming, deleting, error, onAsk, onCancel, onConfirm }: {
  post: Post
  canDelete: boolean
  confirming: boolean
  deleting: boolean
  error: string
  onAsk: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const deleteRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Move the focus only after a click here, not when the card first appears
  const moved = useRef(false)
  useEffect(() => {
    if (!moved.current) return
    if (confirming) cancelRef.current?.focus(); else deleteRef.current?.focus()
  }, [confirming])

  function ask() { moved.current = true; onAsk() }
  function cancel() { moved.current = true; onCancel() }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !deleting) cancel()
  }

  return (
    <article className={styles.post}>
      <p className={styles.postMeta}>
        <span className={styles.postAuthor}>{post.author_name}</span>
        <time className={styles.postDate} dateTime={post.created_at}>{formatDateTime(post.created_at)}</time>
      </p>
      <p className={styles.postText}>{post.body}</p>

      {canDelete && (
        confirming ? (
          <div className={styles.confirm} role="group" aria-label="Confirmar eliminación" onKeyDown={onKeyDown}>
            <p className={styles.confirmText}>¿Eliminar esta publicación?</p>
            <div className={styles.confirmBtns}>
              <button type="button" className={styles.dangerBtn} onClick={onConfirm} disabled={deleting}>
                {deleting ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
              <button type="button" className={styles.smallBtn} ref={cancelRef} onClick={cancel} disabled={deleting}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.postActions}>
            <button type="button" className={styles.smallBtn} ref={deleteRef} onClick={ask}>
              Eliminar
            </button>
          </div>
        )
      )}
      <div className={styles.live} aria-live="assertive">
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </article>
  )
}
