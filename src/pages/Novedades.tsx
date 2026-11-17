import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
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

/** The user's state page: the news for their one Bundesland, links to the
    community board and to the state's chat (/chat), and the calendar as a
    preview only. In the new look (src/styles/redesign.css): ruled cells, a
    dark column on the left (on a phone, a bar with a menu) and the news on
    the light side. */
export default function Novedades() {
  const { profile } = useProfile()
  const firstName = profile?.first_name?.trim().split(/\s+/)[0] ?? ''
  const stateId = profile?.main_state ?? null
  /* German name of the state, '' when none is chosen yet */
  const name = MAP_SHAPES.find((s) => s.id === stateId)?.name ?? ''
  usePageTitle((name || 'Novedades') + ' · Medical Network')

  // The page's own background, colour and font on <body>, only while it is open
  useLayoutEffect(() => {
    document.body.classList.add(styles.pageBody)
    return () => document.body.classList.remove(styles.pageBody)
  }, [])

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

  /* The menu: open or closed on a phone (it starts closed). On larger
     screens the column is always open and the button is hidden. */
  const [menuOpen, setMenuOpen] = useState(false)

  /* The link to the state's chat: "Chat de Bayern", or just "Chat" */
  const chatLabel = name ? <>Chat de <span lang="de">{name}</span></> : 'Chat'

  /* The title's size comes from its longest word ("Mecklenburg-" counts
     12, "Niedersachsen." 14), so it always fits its column; the CSS
     turns this number into a size. Set from code (React's style prop),
     never as a style="..." attribute: the site's CSP blocks those. */
  const titleWord = name ? name + '.' : 'novedades.'
  const titleParts = titleWord.split('-')
  const titleChars = Math.max(...titleParts.map((w, i) => w.length + (i < titleParts.length - 1 ? 1 : 0)))
  const titleStyle = { '--title-chars': titleChars } as CSSProperties

  return (
    <div className={styles.layout}>

      {/* Left: the column (on a phone, a bar with the menu below it) */}
      <nav className={styles.column + (menuOpen ? ' ' + styles.isOpen : '')} aria-label="Menú">
        <div className={styles.bar}>
          <Link className={styles.profile} to="/perfil">
            <span className={styles.label}>Mi perfil</span>
            <span className={styles.profileName}>{firstName}</span>
          </Link>
          <button
            type="button" className={styles.menuBtn}
            aria-expanded={menuOpen} aria-controls="novedades-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span>Menú</span>
            <span className={styles.menuBtnIcon} aria-hidden="true"></span>
          </button>
        </div>

        <div className={styles.menuBody} id="novedades-menu">
          <Link className={styles.row} to="/comunidad">Comunidad</Link>
          <Link className={styles.row} to="/chat"><span>{chatLabel}</span></Link>

          {/* Admins only. Hiding the link is not the protection: the admin
              pages check again, and the database decides (RLS). */}
          {profile?.is_admin === true && (
            <Link className={styles.row} to="/admin">Administración</Link>
          )}

          {/* Calendar: preview only, it doesn't work yet */}
          <section className={styles.calendar} aria-labelledby="cal-heading">
            <div className={styles.calHead}>
              <h2 className={styles.label} id="cal-heading">Calendario</h2>
              <p className={styles.calSoon}>Próximamente</p>
            </div>
            <p className={styles.calMonth}>Noviembre 2026</p>
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
              <span>30</span><span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
          </section>

          <div className={styles.session}>
            <SessionButton redesign />
          </div>
        </div>
      </nav>

      {/* Right: the news */}
      <main className={styles.main}>
        <header className={styles.head}>
          {/* Read as one heading: "Novedades de Bayern" / "Mis novedades" */}
          <h1 className={styles.title} style={titleStyle}>
            {name ? (
              <>
                <span className={styles.label}>Novedades de</span>{' '}
                <span className={styles.titleName} lang="de">{name}<span aria-hidden="true">.</span></span>
              </>
            ) : (
              <>
                <span className={styles.label}>Mis</span>{' '}
                <span className={styles.titleName}>novedades<span aria-hidden="true">.</span></span>
              </>
            )}
          </h1>
        </header>

        {!stateId ? (
          <div className={styles.message + ' ' + styles.isInverted}>
            <p className={styles.messageLead}>Elige tu estado para ver sus novedades.</p>
            <Link className={styles.messageBtn} to="/estados">Elegir mi estado</Link>
          </div>
        ) : !current ? (
          <p className={styles.message} role="status">Cargando novedades…</p>
        ) : !current.ok ? (
          <div className={styles.message + ' ' + styles.isInverted} role="alert">
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
            <article key={post.id} className={styles.post}>
              <p className={styles.postDate}>
                <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
              </p>
              <div className={styles.postBody}>
                {/* Plain text only (never HTML); line breaks kept by CSS */}
                <h2 className={styles.postTitle}>{post.title}</h2>
                {post.body && <p className={styles.postText}>{post.body}</p>}
              </div>
            </article>
          ))
        )}
      </main>

      {/* Phone only: floating link to the state's chat */}
      <Link className={styles.chatFab} to="/chat">
        <span className={styles.chatFabLabel}>{chatLabel}</span>
      </Link>
    </div>
  )
}
