import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import MenuIcon from './MenuIcon.tsx'
import SessionButton from './SessionButton.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { useProfile } from '../lib/profile.ts'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import { MAP_SHAPES } from '../estados/mapShapes.ts'
import styles from './Novedades.module.css'

/** One news post as the page gets it (title and body are plain text) */
interface NewsPost {
  id: string
  title: string
  body: string
  published_at: string
}

/* "12 nov 2026", in German time */
const DATE = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Berlin',
})
function formatDate(iso: string): string {
  return DATE.format(new Date(iso)).replace('.', '')
}

/* The answer of one news request. `key` says which request it answers
   (state + attempt), so an old answer is never shown for a new request. */
type NewsResult =
  | { key: string; ok: true; posts: NewsPost[] }
  | { key: string; ok: false; error: string }

const CloseIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
const AdminIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="16" cy="18" r="2" />
  </svg>
)
const ChatIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />
  </svg>
)

/** The user's state page: the news for their one Bundesland, and calendar
    and chat as previews only (from design-mockup/novedades.html) */
export default function Novedades() {
  const { profile } = useProfile()
  const firstName = profile?.first_name?.trim().split(/\s+/)[0] ?? ''
  const stateId = profile?.main_state ?? null
  /* German name of the state, '' when none is chosen yet */
  const name = MAP_SHAPES.find((s) => s.id === stateId)?.name ?? ''
  usePageTitle((name || 'Novedades') + ' · Medical Network')

  /* ---------- News ---------- */
  const [attempt, setAttempt] = useState(0)
  const [news, setNews] = useState<NewsResult | null>(null)
  const newsKey = stateId + ':' + attempt
  useEffect(() => {
    // No state chosen: no request at all
    if (!stateId || !supabase) return
    const client = supabase
    const key = stateId + ':' + attempt
    let cancelled = false
    async function load() {
      let result: NewsResult
      try {
        // RLS already limits clients to their state (and paid_only). Asking
        // for the same here gives admins the same view as a client of this
        // state: published, date has come, this state or all states.
        const { data, error } = await client
          .from('news_posts')
          .select('id, title, body, published_at')
          .eq('published', true)
          .lte('published_at', new Date().toISOString())
          .or('state.is.null,state.eq.' + stateId)
          .order('published_at', { ascending: false })
          .returns<NewsPost[]>()
        result = error ? { key, ok: false, error: dataErrorMessage(error) } : { key, ok: true, posts: data ?? [] }
      } catch (err) {
        result = { key, ok: false, error: dataErrorMessage(err) }
      }
      if (!cancelled) setNews(result)
    }
    void load()
    return () => { cancelled = true }
  }, [stateId, attempt])
  const current = news?.key === newsKey ? news : null  // null = still loading

  /* Sidebar collapse / expand (starts collapsed on a phone) */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.matchMedia('(max-width: 700px)').matches,
  )

  /* Phone: floating button opens the chat full screen, ✕ / Escape closes it */
  const [chatOpen, setChatOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const chatCloseRef = useRef<HTMLButtonElement>(null)
  const chatOpenChanged = useRef(false)

  function openChat(open: boolean) {
    chatOpenChanged.current = true
    setChatOpen(open)
  }
  useEffect(() => {
    document.body.classList.toggle('chat-open', chatOpen)
    if (chatOpenChanged.current) {
      if (chatOpen) chatCloseRef.current?.focus(); else fabRef.current?.focus()
    }
    if (!chatOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') openChat(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [chatOpen])
  useEffect(() => () => document.body.classList.remove('chat-open'), [])

  /* Desktop: ✕ slides the chat out to the right, the chat icon brings it back */
  const [chatCollapsed, setChatCollapsed] = useState(false)

  /* Chat preview: Enter adds a sent bubble (nothing is sent or saved) */
  const [sent, setSent] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)
  function onSend(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setSent((list) => [...list, text])
    setDraft('')
  }
  useEffect(() => {
    const box = messagesRef.current
    if (box && sent.length) box.scrollTop = box.scrollHeight
  }, [sent])

  return (
    <>
      <div className={styles.layout}>

        {/* Left: sidebar */}
        <nav className={styles.sidebar + (sidebarCollapsed ? ' ' + styles.isCollapsed : '')} aria-label="Menú">
          <div className={styles.sidebarHeader}>
            <div className={styles.profile}>
              <Link className={styles.profileBtn} to="/perfil" aria-label="Perfil">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-3.9 3.6-6 8-6s8 2.1 8 6" />
                </svg>
              </Link>
              <span className={styles.profileName}>{firstName}</span>
            </div>
            <button
              type="button" className={styles.sidebarToggle}
              aria-expanded={!sidebarCollapsed} aria-controls="sidebar-body"
              aria-label={sidebarCollapsed ? 'Mostrar columna' : 'Ocultar columna'}
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              <MenuIcon />
            </button>
          </div>

          <div className={styles.sidebarBody} id="sidebar-body">
            <Link className={styles.communityLink} to="/comunidad">
              <ChatIcon />
              Comunidad
            </Link>

            {/* Admins only. Hiding the link is not the protection: the admin
                pages check again, and the database decides (RLS). */}
            {profile?.is_admin === true && (
              <Link className={styles.adminLink} to="/admin">
                <AdminIcon />
                Administración
              </Link>
            )}

            {/* Calendar: preview only */}
            <section className={styles.calendar} aria-labelledby="cal-heading">
              <div className={styles.sectionHead}>
                <h2 id="cal-heading">Calendario</h2>
              </div>
              <div className={styles.calCard}>
                <p className={styles.calTitle}>Noviembre 2026</p>
                <div className={styles.calWeekdays}>
                  <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
                </div>
                <div className={styles.calDays}>
                  <span></span><span></span><span></span><span></span><span></span><span></span>
                  <span>1</span>
                  <span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span>
                  <span>9</span><span>10</span><span>11</span><span className={styles.today} aria-current="date">12</span><span>13</span><span>14</span><span className={styles.event}>15</span>
                  <span>16</span><span>17</span><span>18</span><span>19</span><span>20</span><span>21</span><span>22</span>
                  <span>23</span><span>24</span><span>25</span><span>26</span><span>27</span><span>28</span><span>29</span>
                  <span>30</span>
                </div>
              </div>
            </section>

            <SessionButton onGreen />
          </div>
        </nav>

        <div className={styles.workspace}>

          {/* Middle: main content */}
          <main className={styles.main}>
            <h1 className={styles.pageTitle}>{(name || 'Novedades').toUpperCase()}</h1>

            {!stateId ? (
              <div className={styles.message}>
                <p>Elige tu estado para ver sus novedades.</p>
                <Link className={styles.messageBtn} to="/estados">Elegir mi estado</Link>
              </div>
            ) : !current ? (
              <p className={styles.message} role="status">Cargando novedades…</p>
            ) : !current.ok ? (
              <div className={styles.message + ' ' + styles.isError} role="alert">
                <p>No se pudieron cargar las novedades. {current.error}</p>
                <button type="button" className={styles.messageBtn} onClick={() => setAttempt((n) => n + 1)}>
                  Reintentar
                </button>
              </div>
            ) : current.posts.length === 0 ? (
              <p className={styles.message}>
                Todavía no hay novedades para <span lang="de">{name}</span>.
              </p>
            ) : (
              current.posts.map((post) => (
                <article key={post.id} className={styles.card}>
                  <p className={styles.cardMeta}>
                    <time className={styles.cardDate} dateTime={post.published_at}>{formatDate(post.published_at)}</time>
                  </p>
                  {/* Plain text only (never HTML); line breaks kept by CSS */}
                  <h3>{post.title}</h3>
                  {post.body && <p className={styles.cardText}>{post.body}</p>}
                </article>
              ))
            )}
          </main>

          {/* Right: chat (preview only) */}
          <aside
            id="chat"
            className={styles.chat + (chatOpen ? ' ' + styles.isOpen : '') + (chatCollapsed ? ' ' + styles.isCollapsed : '')}
            aria-label={('Chat ' + name).trim()}
          >
            <div className={styles.chatHead}>
              {/* Desktop only: hides / shows the chat */}
              <button
                type="button" className={styles.chatToggle}
                aria-expanded={!chatCollapsed} aria-controls="messages"
                aria-label={chatCollapsed ? 'Mostrar chat' : 'Ocultar chat'}
                onClick={() => setChatCollapsed((c) => !c)}
              >
                <CloseIcon className={styles.iconClose} />
                <ChatIcon className={styles.iconOpen} />
              </button>
              <h2>Chat <span className={styles.chatName}>{name}</span></h2>
              <button type="button" className={styles.chatClose} ref={chatCloseRef} aria-label="Cerrar chat" onClick={() => openChat(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className={styles.messages} id="messages" role="log" ref={messagesRef}>
              <p className={styles.msg + ' ' + styles.sent}>[Mensaje enviado]</p>
              <p className={styles.msg}>[Mensaje recibido]</p>
              <p className={styles.msg}>[Mensaje recibido más largo, en varias líneas]</p>
              <p className={styles.msg}>[Mensaje recibido]</p>
              <p className={styles.msg + ' ' + styles.sent}>[Mensaje enviado]</p>
              {sent.map((text, i) => (
                <p key={i} className={styles.msg + ' ' + styles.sent}>{text}</p>
              ))}
            </div>

            <form className={styles.chatForm} autoComplete="off" onSubmit={onSend}>
              <label className="sr-only" htmlFor="chat-input">Escribe un mensaje</label>
              <input
                className={styles.chatInput} id="chat-input" type="text" placeholder="Escribe un mensaje"
                value={draft} onChange={(e) => setDraft(e.target.value)}
              />
            </form>
          </aside>

        </div>
      </div>

      {/* Phone only: opens the chat full screen */}
      <button
        type="button" className={styles.chatFab} ref={fabRef}
        aria-controls="chat" aria-expanded={chatOpen}
        onClick={() => openChat(true)}
      >
        <ChatIcon />
        <span className={styles.chatFabLabel}>{('Chat ' + name).trim()}</span>
      </button>
    </>
  )
}
