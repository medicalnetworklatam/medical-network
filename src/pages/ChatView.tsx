import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type FormEvent, type KeyboardEvent, type RefObject,
} from 'react'
import { linkify } from '../lib/linkify.tsx'
import { useMediaQuery } from '../lib/useMediaQuery.ts'
import type { Post } from './PostBoard.tsx'
import board from './Comunidad.module.css'
import styles from './Chat.module.css'

/* How a state's chat looks and scrolls. All the talking to the database
   (the newest 30, "Ver mensajes anteriores", the refresh every 20 seconds,
   sending, deleting) stays in PostBoard.tsx, with the same rules as the
   board; this file only draws what PostBoard gives it.

   - Oldest at the top, newest at the bottom; the page opens at the newest.
   - One scrollbar: the page itself scrolls (or whatever box around the chat
     scrolls, if the layout around it changes). The writing box sticks to
     the bottom of the chat area and comes after the last message, so it
     never covers it.
   - iPhone and iPad: Safari doesn't shrink the page when the keyboard
     opens. While the box has the focus, it is lifted by the part of the
     page the keyboard hides (see "Keyboard" below). */

const MAX = 2000           // the database allows 1 to 2,000 characters
const COUNTER_FROM = 1800  // the counter shows from here on
const RUN_MS = 5 * 60_000  // one name for a run of messages within 5 minutes
const NEAR_BOTTOM = 64     // px: closer than this to the end counts as "at the bottom"

/* "14:05" and "12 nov 2026", in the reader's own time zone */
const TIME = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/** Midnight of that day, in the reader's time zone */
function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
/** "Hoy", "Ayer" or "12 nov 2026" */
function dayLabel(d: Date, now: Date): string {
  const day = dayStart(d)
  if (day === dayStart(now)) return 'Hoy'
  if (day === dayStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Ayer'
  return DAY.format(d).replace('.', '')
}

/** The box that really scrolls around the chat: the nearest one that can
    scroll, or null for the page itself */
function scrollBox(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY
    if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

export interface ChatTexts {
  intro: string
  label: string
  listTitle: string
  loading: string
  empty: string
  loadError: string
  confirmDelete: string
}

export interface ChatForm {
  draft: string
  onDraft: (text: string) => void
  sending: boolean
  error: string
  count: number
  tooLong: boolean
  canPublish: boolean
  onSubmit: (e: FormEvent) => void
}

export interface ChatDelete {
  confirmingId: string | null
  deletingId: string | null
  error: { id: string; message: string } | null
  onAsk: (id: string) => void
  onCancel: () => void
  onConfirm: (post: Post) => void
}

export default function ChatView({
  userId, isAdmin, shownName, t, posts, hasMore, listBusy, listError,
  onRefresh, onLoadMore, form, textRef, sentNo, del, headingRef,
}: {
  userId: string
  isAdmin: boolean
  shownName: string
  t: ChatTexts
  /** Newest first, as PostBoard keeps them; null = not loaded yet */
  posts: Post[] | null
  hasMore: boolean
  listBusy: 'first' | 'more' | null
  listError: string
  onRefresh: () => void
  onLoadMore: () => void
  form: ChatForm
  /** The writing box (PostBoard puts the focus back in it after an error) */
  textRef: RefObject<HTMLTextAreaElement | null>
  /** Goes up by one each time the user's own message was sent */
  sentNo: number
  del: ChatDelete
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const rootRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  /* ---------- Scrolling ---------- */

  // Was the reader at the bottom before the last change? Kept up to date by
  // every scroll, so it still says what it was when new messages arrive.
  const atBottom = useRef(true)
  // "Mensajes nuevos ↓": new messages arrived while the reader was higher up
  const [newBelow, setNewBelow] = useState(false)

  function isAtBottom(): boolean {
    const root = rootRef.current
    if (!root) return true
    const box = scrollBox(root)
    const visibleEnd = box ? box.getBoundingClientRect().bottom : window.innerHeight
    return root.getBoundingClientRect().bottom - visibleEnd <= NEAR_BOTTOM
  }

  function toBottom() {
    const root = rootRef.current
    if (!root) return
    const box = scrollBox(root)
    if (box) box.scrollTop = box.scrollHeight
    else window.scrollTo(0, document.documentElement.scrollHeight)
    atBottom.current = true
    setNewBelow(false)
  }

  useEffect(() => {
    function onScroll() {
      atBottom.current = isAtBottom()
      if (atBottom.current) setNewBelow(false)
    }
    // "capture" catches the scrolling of any box, not just the page's
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [])

  /* Before "Ver mensajes anteriores": the first message shown and where it
     is on the screen, so it can be put back in the same place */
  const anchor = useRef<{ id: string; top: number } | null>(null)
  function loadOlder() {
    const first = listRef.current?.querySelector<HTMLElement>('[data-id]')
    anchor.current = first?.dataset.id
      ? { id: first.dataset.id, top: first.getBoundingClientRect().top }
      : null
    onLoadMore()
  }

  /* "Actualizar" goes to the bottom once the newest messages are back */
  const bottomAfterLoad = useRef(false)
  function refresh() {
    bottomAfterLoad.current = true
    onRefresh()
  }

  /* After every change to the list, before the browser paints it: decide
     where the page should be */
  const before = useRef<{ ids: Set<string> | null; sentNo: number }>({ ids: null, sentNo })
  useLayoutEffect(() => {
    const prev = before.current
    if (!posts) return
    before.current = { ids: new Set(posts.map((p) => p.id)), sentNo }

    if (!prev.ids || sentNo !== prev.sentNo || (bottomAfterLoad.current && listBusy === null)) {
      // First load, the user's own message, or "Actualizar"
      bottomAfterLoad.current = false
      anchor.current = null
      toBottom()
      return
    }
    // Older messages came in above: move by exactly as much as they pushed
    // the first message down, so the reader stays where they were
    if (anchor.current && listBusy === null) {
      const { id, top } = anchor.current
      anchor.current = null
      const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)
      const moved = el ? el.getBoundingClientRect().top - top : 0
      if (moved) {
        const scroller = (rootRef.current && scrollBox(rootRef.current)) ?? window
        scroller.scrollBy(0, moved)
      }
    }
    // New messages at the bottom (from the 20-second refresh)
    const newest = posts[0]
    if (newest && !prev.ids.has(newest.id)) {
      if (atBottom.current) toBottom()
      else setNewBelow(true)
    }
  }, [posts, sentNo, listBusy])

  /* ---------- Writing box ---------- */

  // A mouse or trackpad: Enter sends, Shift+Enter makes a new line.
  // Touch screens: Enter makes a new line, the button sends.
  const enterSends = useMediaQuery('(hover: hover) and (pointer: fine)')
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || !enterSends) return
    if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
    if (e.nativeEvent.isComposing) return // an accent still being typed
    e.preventDefault()
    if (form.canPublish) formRef.current?.requestSubmit()
  }

  // Grows with the text, up to about 5 lines (max-height in the CSS), then
  // scrolls inside. The height is set from code, never as a style="..."
  // attribute (the site's CSP blocks those).
  useLayoutEffect(() => {
    const box = textRef.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = box.scrollHeight + (box.offsetHeight - box.clientHeight) + 'px'
    if (atBottom.current) toBottom()
  }, [form.draft, textRef])

  /* ---------- Keyboard (iPhone, iPad, Android) ----------
     The keyboard covers the bottom of the page without making it smaller.
     `visualViewport` is the part of the page really on screen. The lift is
     the gap between the bottom of that visible part and the bottom of the
     page's window (window.innerHeight):

         lift = innerHeight - (visualViewport.offsetTop + visualViewport.height)

     When Safari scrolls the box into view by itself, it moves the visible
     part down (offsetTop grows), so the gap, and with it the lift, shrinks
     by exactly as much: what Safari already scrolled is never added a
     second time. It is measured again on every resize and scroll of the
     visible part. The lift is only used while the box has the focus and the
     page isn't zoomed in; otherwise it is 0.

     It is set as a CSS variable from code (never a style="..." attribute,
     which the CSP blocks). The CSS uses it twice: as the writing box's
     distance from the bottom, and as extra room under the chat, so the last
     message can still be scrolled above the lifted box. */
  useEffect(() => {
    const vv = window.visualViewport
    const root = rootRef.current
    const box = textRef.current
    if (!vv || !root || !box) return
    let lift = 0
    let frame = 0
    function measure() {
      if (!vv || !root) return
      const focused = document.activeElement === box
      const gap = window.innerHeight - (vv.offsetTop + vv.height)
      const next = focused && Math.abs(vv.scale - 1) < 0.01 && gap > 1 ? Math.round(gap) : 0
      if (next === lift) return
      const wasAtBottom = atBottom.current
      lift = next
      root.style.setProperty('--chat-lift', lift + 'px')
      if (wasAtBottom) toBottom()
    }
    function update() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    box.addEventListener('focus', update)
    box.addEventListener('blur', update)
    return () => {
      cancelAnimationFrame(frame)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      box.removeEventListener('focus', update)
      box.removeEventListener('blur', update)
      root.style.removeProperty('--chat-lift')
    }
  }, [textRef]) // set up once: the box and the chat stay the same while it's open

  /* ---------- The list, oldest first ---------- */

  // Today, for "Hoy" and "Ayer"; looked at again every minute, so the
  // labels change at midnight even if no new message comes
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = new Date()
      setNow((old) => (dayStart(old) === dayStart(next) ? old : next))
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const shown = posts ? [...posts].reverse() : []
  const rows = shown.map((post, i) => {
    const date = new Date(post.created_at)
    const prev = i > 0 ? shown[i - 1] : null
    const prevDate = prev ? new Date(prev.created_at) : null
    const newDay = !prevDate || dayStart(prevDate) !== dayStart(date)
    const runStart = newDay || !prev || !prevDate
      || prev.author_id !== post.author_id
      || prev.author_name !== post.author_name
      || prev.is_staff !== post.is_staff
      || date.getTime() - prevDate.getTime() > RUN_MS
    return { post, date, newDay, runStart }
  })

  const showCounter = form.count >= COUNTER_FROM
  const describedBy = ['chat-hint', showCounter && 'chat-count', form.error && 'chat-error']
    .filter(Boolean).join(' ')

  return (
    <section className={styles.chat} ref={rootRef} aria-labelledby="posts-heading">
      <div className={styles.chatHead}>
        <div className={board.listHead + ' ' + styles.chatHeadRow}>
          <h2 className={board.sectionTitle} id="posts-heading" ref={headingRef} tabIndex={-1}>
            {t.listTitle}
          </h2>
          <button type="button" className={board.smallBtn} onClick={refresh} disabled={listBusy !== null}>
            {listBusy === 'first' && posts ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
        <p className={styles.hint} id="chat-hint">{t.intro} «{shownName}».</p>
      </div>

      {listError && (
        <div className={board.message + ' ' + board.isError} role="alert">
          <p>{t.loadError} {listError}</p>
        </div>
      )}

      <div className={styles.messages} ref={listRef} aria-busy={listBusy !== null}>
        {posts && hasMore && (
          <button
            type="button" className={board.moreBtn + ' ' + styles.olderBtn}
            onClick={loadOlder} disabled={listBusy !== null}
          >
            {listBusy === 'more' ? 'Cargando…' : 'Ver mensajes anteriores'}
          </button>
        )}

        {!posts ? (
          listBusy && <p className={styles.note} role="status">{t.loading}</p>
        ) : posts.length === 0 ? (
          <p className={styles.note}>{t.empty}</p>
        ) : (
          rows.map(({ post, date, newDay, runStart }) => (
            <ChatRow
              key={post.id}
              post={post}
              date={date}
              day={newDay ? dayLabel(date, now) : ''}
              runStart={runStart}
              own={post.author_id === userId}
              confirmText={t.confirmDelete}
              canDelete={isAdmin || post.author_id === userId}
              confirming={del.confirmingId === post.id}
              deleting={del.deletingId === post.id}
              error={del.error?.id === post.id ? del.error.message : ''}
              onAsk={() => del.onAsk(post.id)}
              onCancel={del.onCancel}
              onConfirm={() => del.onConfirm(post)}
            />
          ))
        )}
      </div>

      <form className={styles.composer} ref={formRef} onSubmit={form.onSubmit} noValidate>
        {newBelow && (
          <button type="button" className={styles.newBtn} onClick={toBottom}>
            Mensajes nuevos <span aria-hidden="true">↓</span>
          </button>
        )}
        <div className={board.live} aria-live="assertive">
          {form.error && <p className={board.error} id="chat-error">{form.error}</p>}
        </div>
        <div className={board.live} aria-live="polite">
          {form.tooLong && <p className={board.fieldNote}>Puedes escribir como máximo 2000 caracteres.</p>}
        </div>
        <div className={styles.composerRow}>
          <label className="sr-only" htmlFor="chat-body">{t.label}</label>
          <textarea
            ref={textRef} id="chat-body" className={styles.input}
            rows={1} value={form.draft} placeholder="Escribe un mensaje"
            onChange={(e) => form.onDraft(e.target.value)}
            onKeyDown={onKeyDown}
            aria-describedby={describedBy}
            aria-invalid={form.tooLong}
          />
          <button
            type="submit" className={board.primaryBtn + ' ' + styles.send}
            disabled={!form.canPublish}
            // keeps the focus (and a phone's keyboard) in the box
            onMouseDown={(e) => e.preventDefault()}
          >
            {form.sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
        {showCounter && (
          <p className={board.counter + ' ' + styles.counter + (form.tooLong ? ' ' + board.isOver : '')} id="chat-count">
            {form.count} / {MAX}
            <span className="sr-only"> caracteres</span>
          </p>
        )}
      </form>
    </section>
  )
}

/** One message, with the day's separator above it when a new day starts.
    The text is plain text with links (linkify, never HTML); CSS keeps its
    line breaks. */
function ChatRow({
  post, date, day, runStart, own, confirmText, canDelete, confirming, deleting, error,
  onAsk, onCancel, onConfirm,
}: {
  post: Post
  date: Date
  /** "Hoy", "Ayer", "12 nov 2026", or '' when the day doesn't change */
  day: string
  runStart: boolean
  own: boolean
  confirmText: string
  canDelete: boolean
  confirming: boolean
  deleting: boolean
  error: string
  onAsk: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  // Found once per message, not again on every key press in the box
  const text = useMemo(() => linkify(post.body), [post.body])
  const deleteRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Move the focus only after a click here, not when the message first appears
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

  const staff = post.is_staff ? ' (Equipo MNL)' : ''
  const cls = [
    styles.msg,
    own ? styles.isOwn : styles.isOther,
    post.is_staff && styles.isStaff,
    runStart && styles.isRunStart,
  ].filter(Boolean).join(' ')

  return (
    <>
      {day && <h3 className={styles.day}>{day}</h3>}
      <article className={cls} data-id={post.id}>
        {/* The name once per run; screen readers hear it on every message.
            Own messages: no name, "Tú" for screen readers. */}
        {own ? (
          runStart && post.is_staff ? (
            <p className={styles.msgName}>
              <span className="sr-only">Tú</span>
              <span className={board.staffBadge}>Equipo MNL</span>
            </p>
          ) : (
            <p className="sr-only">Tú{staff}</p>
          )
        ) : runStart ? (
          <p className={styles.msgName}>
            <span className={styles.msgAuthor}>{post.author_name}</span>
            {/* Marked by the database on messages written by an admin */}
            {post.is_staff && <span className={board.staffBadge}>Equipo MNL</span>}
          </p>
        ) : (
          <p className="sr-only">{post.author_name}{staff}</p>
        )}

        <div className={styles.bubble}>
          <p className={styles.msgText}>{text}</p>
          <p className={styles.msgFoot}>
            <time dateTime={post.created_at}>{TIME.format(date)}</time>
            {canDelete && !confirming && (
              <button type="button" className={styles.delBtn} ref={deleteRef} onClick={ask}>
                Eliminar
              </button>
            )}
          </p>
          {canDelete && confirming && (
            <div className={styles.confirm} role="group" aria-label="Confirmar eliminación" onKeyDown={onKeyDown}>
              <p className={styles.confirmText}>{confirmText}</p>
              <div className={styles.confirmBtns}>
                <button type="button" className={styles.confirmYes} onClick={onConfirm} disabled={deleting}>
                  {deleting ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
                <button type="button" className={styles.confirmNo} ref={cancelRef} onClick={cancel} disabled={deleting}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
        <div className={board.live} aria-live="assertive">
          {error && <p className={board.error}>{error}</p>}
        </div>
      </article>
    </>
  )
}
