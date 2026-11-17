import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { supabase } from '../lib/supabase.ts'
import { CHECK_FAILED, dataErrorMessage, NOT_ALLOWED } from '../lib/dataErrors.ts'
import styles from './Comunidad.module.css'

/** One community post as the page gets it (all plain text) */
interface Post {
  id: string
  author_id: string
  author_name: string
  /** True when the author was an admin when they posted ("Equipo MNL").
      Set by the database only (migration 4). */
  is_staff: boolean
  body: string
  /** Exactly as the database sent it (with microseconds). Used as-is for
      "Ver más", never turned into a JavaScript Date and back. */
  created_at: string
}

const COLUMNS = 'id, author_id, author_name, is_staff, body, created_at'
const PAGE = 30   // posts per page
const MAX = 2000  // the database allows 1 to 2,000 characters
const REFRESH_MS = 20_000  // chat: look for new messages every 20 seconds
const NEWER_MAX = 100      // chat: most new messages taken in one refresh

/* The words that differ between the board ("publicación") and a state's
   chat ("mensaje"). Everything else is the same code. */
const BOARD_TEXTS = {
  formTitle: 'Nueva publicación',
  intro: 'Comparte tu experiencia con los trámites. Solo texto. Los demás miembros verán tu nombre como',
  label: 'Tu publicación',
  listTitle: 'Publicaciones',
  loading: 'Cargando publicaciones…',
  empty: 'Todavía no hay publicaciones. Comparte la primera.',
  loadError: 'No se pudieron cargar las publicaciones.',
  notAllowed: 'No tienes permiso para publicar en la comunidad. Si crees que es un error, contáctanos.',
  badLength: 'La publicación debe tener entre 1 y 2000 caracteres.',
  published: 'Publicación publicada.',
  deleted: 'Publicación eliminada.',
  confirmDelete: '¿Eliminar esta publicación?',
}
const CHAT_TEXTS: typeof BOARD_TEXTS = {
  formTitle: 'Nuevo mensaje',
  intro: 'Escribe a los miembros de este estado. Solo texto. Verán tu nombre como',
  label: 'Tu mensaje',
  listTitle: 'Mensajes',
  loading: 'Cargando mensajes…',
  empty: 'Todavía no hay mensajes. Escribe el primero.',
  loadError: 'No se pudieron cargar los mensajes.',
  notAllowed: 'No tienes permiso para escribir en este chat. Si crees que es un error, contáctanos.',
  badLength: 'El mensaje debe tener entre 1 y 2000 caracteres.',
  published: 'Mensaje publicado.',
  deleted: 'Mensaje eliminado.',
  confirmDelete: '¿Eliminar este mensaje?',
}

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

/** Spanish message when the database refuses a new post. (The speed limit
    has its own message in dataErrorMessage.) */
function publishErrorMessage(error: unknown, t: typeof BOARD_TEXTS): string {
  const code = (error as { code?: string } | null)?.code
  if (code === NOT_ALLOWED) return t.notAllowed
  if (code === CHECK_FAILED) return t.badLength
  return dataErrorMessage(error)
}

type ListResult = { rows: Post[] } | { error: string }

/** The list and the form, for paid members and admins only. Used by the
    community board (Comunidad.tsx) and by a state's chat (Chat.tsx). Its
    styles are in Comunidad.module.css.

    `state` says which posts: null = the general board, a state code ("by",
    "th"…) = that state's chat. The database (RLS) decides what a user may
    really read and post; this only asks for the right posts.

    A chat also looks for new messages by itself every 20 seconds.

    The page gives it a `key` (user, and state), so a different user or
    state always gets a new PostBoard that starts from nothing. */
export default function PostBoard({ userId, isAdmin, shownName, state = null }: {
  userId: string
  isAdmin: boolean
  shownName: string
  state?: string | null
}) {
  const isChat = state !== null
  const t = isChat ? CHAT_TEXTS : BOARD_TEXTS

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

  /* The same facts as `posts` and `listBusy`, readable at once by code that
     runs later (the chat's timer), which would otherwise see old values */
  const postsRef = useRef<Post[] | null>(null)
  const busyRef = useRef(true)
  function show(list: Post[]) {
    postsRef.current = list
    setPosts(list)
  }
  function setBusy(busy: 'first' | 'more' | null) {
    busyRef.current = busy !== null
    setListBusy(busy)
  }

  /* Chat only (see "new messages every 20 seconds" below) */
  // The newest message a list request brought. The refresh asks only for
  // messages newer than this one. (Not simply the first one shown: right
  // after publishing, that is the user's own new message, and messages
  // others wrote just before it would be skipped.)
  const newestListed = useRef<Post | null>(null)
  // The refresh that is running now, if any
  const refreshing = useRef<Promise<void> | null>(null)
  // A refresh was wanted while another list request was running
  const refreshWanted = useRef(false)

  /* Short Spanish messages for screen readers ("Publicación eliminada.") */
  const [announcement, setAnnouncement] = useState('')

  /** Asks for posts of this board or chat, newest first.
      - `older`: only posts older than that one ("Ver más")
      - `newer`: only posts newer than that one (the chat's refresh)
      Both compare by created_at, then by id for posts with the very same
      time ("keyset paging"), so no post is skipped or shown twice. Asking
      for one more than needed tells us if more exist. */
  async function fetchRows(
    from: { older: Post } | { newer: Post } | null, limit: number,
  ): Promise<ListResult> {
    if (!supabase) return { error: dataErrorMessage(null) }
    try {
      let query = supabase
        .from('community_posts')
        .select(COLUMNS)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit)
      // The board: posts with an empty state only, or chat messages would
      // appear on it. A chat: that state's messages only.
      query = state === null ? query.is('state', null) : query.eq('state', state)
      if (from) {
        const post = 'older' in from ? from.older : from.newer
        const op = 'older' in from ? 'lt' : 'gt'
        // created_at goes in exactly as the database sent it, in quotes
        // (it contains "." and ":", which PostgREST would read as syntax)
        const time = '"' + post.created_at + '"'
        query = query.or(`created_at.${op}.${time},and(created_at.eq.${time},id.${op}.${post.id})`)
      }
      const { data, error } = await query.returns<Post[]>()
      return error ? { error: dataErrorMessage(error) } : { rows: data ?? [] }
    } catch (err) {
      return { error: dataErrorMessage(err) }
    }
  }

  /** Shows the answer to a request for the newest posts, unless a newer
      request was made since (or the page was closed) */
  function showFirst(mine: number, result: ListResult) {
    if (!mounted.current || mine !== requestNo.current) return
    setBusy(null)
    if ('error' in result) {
      setListError(result.error) // the posts already shown stay
    } else {
      setListError('')
      show(result.rows.slice(0, PAGE))
      setHasMore(result.rows.length > PAGE)
      newestListed.current = result.rows[0] ?? null
    }
    afterRequest()
  }

  /** The newest posts again: when the page opens, with "Actualizar", and on
      the board after publishing. This is also how a post that someone
      deleted disappears from the list. */
  async function loadFirst() {
    const mine = ++requestNo.current
    setBusy('first')
    await refreshing.current // never two list requests at once
    if (!mounted.current || mine !== requestNo.current) return
    showFirst(mine, await fetchRows(null, PAGE + 1))
  }

  async function loadMore() {
    if (busyRef.current || !postsRef.current?.length) return
    const mine = ++requestNo.current
    setBusy('more')
    await refreshing.current // never two list requests at once
    if (!mounted.current || mine !== requestNo.current) return
    const shown = postsRef.current ?? []
    const last = shown[shown.length - 1]
    // (the list can have become empty while waiting, if its posts were deleted)
    const result: ListResult = last ? await fetchRows({ older: last }, PAGE + 1) : { rows: [] }
    if (!mounted.current || mine !== requestNo.current) return
    setBusy(null)
    if ('error' in result) {
      setListError(result.error)
    } else {
      setListError('')
      const list = postsRef.current ?? []
      const known = new Set(list.map((p) => p.id))
      show([...list, ...result.rows.slice(0, PAGE).filter((p) => !known.has(p.id))])
      setHasMore(result.rows.length > PAGE)
    }
    afterRequest()
  }

  /* ---------- Chat only: new messages every 20 seconds ---------- */

  /** Asks once for the messages newer than the newest one listed and puts
      them on top */
  async function fetchNewer() {
    const newest = newestListed.current
    const result = newest
      ? await fetchRows({ newer: newest }, NEWER_MAX + 1)
      : await fetchRows(null, PAGE + 1) // nothing listed yet: the newest messages
    if (!mounted.current) return
    if ('error' in result) {
      setListError(result.error)
      return
    }
    setListError('')
    const rows = result.rows
    if (rows.length === 0) {
      if (!newest) show([])
      return
    }
    newestListed.current = rows[0]
    if (!newest || rows.length > NEWER_MAX) {
      // Nothing was listed yet, or more new messages than one refresh
      // takes: start again from the newest ones
      show(rows.slice(0, PAGE))
      setHasMore(rows.length > PAGE)
      return
    }
    // New messages on top, each one only once
    const list = postsRef.current ?? []
    const known = new Set(list.map((p) => p.id))
    const got = new Set(rows.map((p) => p.id))
    show([...rows, ...list.filter((p) => !got.has(p.id))])
    const others = rows.filter((p) => !known.has(p.id) && p.author_id !== userId).length
    if (others > 0) {
      setAnnouncement(others === 1 ? '1 mensaje nuevo.' : others + ' mensajes nuevos.')
    }
  }

  /** The chat's refresh. Does nothing while any list request is running:
      never two at once. If another refresh is asked for while this one runs
      (after publishing), it asks once more when it has finished. */
  function refreshNewer() {
    if (!isChat || !mounted.current || busyRef.current || refreshing.current) return
    const run = async () => {
      do {
        refreshWanted.current = false
        await fetchNewer()
      } while (refreshWanted.current && mounted.current && !busyRef.current)
    }
    refreshing.current = run().finally(() => { refreshing.current = null })
  }

  /** Starts the refresh that had to wait for another list request. Runs
      when a list request has finished, and after publishing in a chat. */
  function afterRequest() {
    if (refreshWanted.current && !busyRef.current) refreshNewer()
  }

  /* Code that is set up once (when the page opens, the timer) reaches the
     newest versions of these two through this */
  const latest = useRef({ loadFirst, refreshNewer })
  useEffect(() => {
    latest.current = { loadFirst, refreshNewer }
  })

  // When the page opens (listBusy already starts as 'first'). Runs once:
  // a different user or state gets a new PostBoard (see `key` above).
  useEffect(() => {
    void latest.current.loadFirst()
  }, [])

  // The timer only runs while the page is open AND visible. When the tab
  // comes back into view it looks at once and starts counting again; leaving
  // the page stops it.
  useEffect(() => {
    if (!isChat) return
    let timer: number | undefined
    function stop() {
      if (timer !== undefined) window.clearInterval(timer)
      timer = undefined
    }
    function start() {
      stop()
      timer = window.setInterval(() => latest.current.refreshNewer(), REFRESH_MS)
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        latest.current.refreshNewer()
        start()
      } else {
        stop()
      }
    }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isChat])

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
      // Only the body, and the state in a chat: the database sets the
      // author, the name, the date and the "Equipo MNL" mark
      const { data, error } = await supabase
        .from('community_posts')
        .insert(state === null ? { body } : { body, state })
        .select(COLUMNS)
        .single<Post>()
      if (!mounted.current) return
      if (error || !data) {
        setFormError(publishErrorMessage(error, t)) // the text stays in the box
        textRef.current?.focus()
        return
      }
      setDraft('')
      show([data, ...(postsRef.current ?? []).filter((p) => p.id !== data.id)])
      setAnnouncement(t.published)
      if (isChat) {
        // Only what is newer than the newest message listed (as soon as no
        // other list request is running)
        refreshWanted.current = true
        afterRequest()
      } else {
        void loadFirst()
      }
    } catch (err) {
      if (!mounted.current) return
      setFormError(publishErrorMessage(err, t))
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
    show((postsRef.current ?? []).filter((p) => p.id !== post.id))
    setAnnouncement(t.deleted)
    listHeadingRef.current?.focus()
  }

  return (
    <>
      <span className="sr-only" role="status">{announcement}</span>

      {/* Form */}
      <section className={styles.card} aria-labelledby="new-post-heading">
        <h2 className={styles.sectionTitle} id="new-post-heading">{t.formTitle}</h2>
        <p className={styles.intro}>{t.intro} «{shownName}».</p>
        <form className={styles.form} onSubmit={onPublish} noValidate>
          <label className="sr-only" htmlFor="post-body">{t.label}</label>
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
            {t.listTitle}
          </h2>
          <button
            type="button" className={styles.smallBtn}
            onClick={() => void loadFirst()} disabled={listBusy !== null}
          >
            {listBusy === 'first' && posts ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {listError && (
          <div className={styles.message + ' ' + styles.isError} role="alert">
            <p>{t.loadError} {listError}</p>
          </div>
        )}

        {!posts ? (
          listBusy && <p className={styles.message} role="status">{t.loading}</p>
        ) : posts.length === 0 ? (
          <p className={styles.message}>{t.empty}</p>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              confirmText={t.confirmDelete}
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
function PostCard({ post, confirmText, canDelete, confirming, deleting, error, onAsk, onCancel, onConfirm }: {
  post: Post
  confirmText: string
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
        {/* Marked by the database on posts written by an admin */}
        {post.is_staff && <span className={styles.staffBadge}>Equipo MNL</span>}
        <time className={styles.postDate} dateTime={post.created_at}>{formatDateTime(post.created_at)}</time>
      </p>
      <p className={styles.postText}>{post.body}</p>

      {canDelete && (
        confirming ? (
          <div className={styles.confirm} role="group" aria-label="Confirmar eliminación" onKeyDown={onKeyDown}>
            <p className={styles.confirmText}>{confirmText}</p>
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
