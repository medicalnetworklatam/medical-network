import { useEffect, useState } from 'react'
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

const AdminIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="16" cy="18" r="2" />
  </svg>
)
const ChatIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />
  </svg>
)

/** The user's state page: the news for their one Bundesland, links to the
    community board and to the state's chat (/chat), and the calendar as a
    preview only (from design-mockup/novedades.html) */
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

  /* The link to the state's chat: "Chat de Bayern", or just "Chat" */
  const chatLabel = name ? <>Chat de <span lang="de">{name}</span></> : 'Chat'

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
            <Link className={styles.chatLink} to="/chat">
              <ChatIcon />
              <span>{chatLabel}</span>
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

        </div>
      </div>

      {/* Phone only: floating link to the state's chat */}
      <Link className={styles.chatFab} to="/chat">
        <ChatIcon />
        <span className={styles.chatFabLabel}>{chatLabel}</span>
      </Link>
    </>
  )
}
