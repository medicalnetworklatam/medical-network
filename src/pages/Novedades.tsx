import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import AreaLayout from './AreaLayout.tsx'
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
  /** The Bundesland the post is for, or null for all states */
  state: string | null
}

/* A post's date in German time, in parts: { day: "12", month: "nov",
   year: "2026", text: "12 nov 2026" } */
const DATE = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Berlin',
})
function dateParts(iso: string): { day: string; month: string; year: string; text: string } {
  const date = new Date(iso)
  const part = (type: string) => DATE.formatToParts(date).find((p) => p.type === type)?.value.replace('.', '') ?? ''
  return { day: part('day'), month: part('month'), year: part('year'), text: DATE.format(date).replace('.', '') }
}

/* The answer of one news request. `key` says which request it answers
   (state + attempt), so an old answer is never shown for a new request. */
type NewsResult =
  | { key: string; ok: true; posts: NewsPost[] }
  | { key: string; ok: false; error: string }

/** The user's state page: the news for their one Bundesland. In the new
    look (src/styles/redesign.css): the shared dark column on the left
    (AreaLayout.tsx: links, calendar preview, "Cerrar sesión") and the news
    on the light side, each post in its own ruled frame. */
export default function Novedades() {
  const { profile } = useProfile()
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
          .select('id, title, body, published_at, state')
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

  /* The title's size comes from its longest word ("Mecklenburg-" counts
     12, "Niedersachsen." 14), so it always fits its column; the CSS
     turns this number into a size. Set from code (React's style prop),
     never as a style="..." attribute: the site's CSP blocks those. */
  const titleWord = name ? name + '.' : 'novedades.'
  const titleParts = titleWord.split('-')
  const titleChars = Math.max(...titleParts.map((w, i) => w.length + (i < titleParts.length - 1 ? 1 : 0)))
  const titleStyle = { '--title-chars': titleChars } as CSSProperties

  return (
    <AreaLayout current="novedades">
      {/* The news */}
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
          <div className={styles.posts}>
            {current.posts.map((post) => <Post key={post.id} post={post} />)}
          </div>
        )}
      </main>
    </AreaLayout>
  )
}

/** One news post, in its own frame: the date and the post's tag ("Todos
    los estados" or the Bundesland) in one cell, the title and text in the
    other. Title and body are plain text only (never HTML). */
function Post({ post }: { post: NewsPost }) {
  const date = dateParts(post.published_at)
  const stateName = post.state ? MAP_SHAPES.find((s) => s.id === post.state)?.name ?? '' : ''
  return (
    <article className={styles.post}>
      <div className={styles.postMeta}>
        {/* Seen as "NOV 2026" over "18."; heard once as "18 nov 2026" */}
        <time className={styles.postDate} dateTime={post.published_at}>
          <span className={styles.postMonth} aria-hidden="true">{date.month} {date.year}</span>
          <span className={styles.postDay} aria-hidden="true">{date.day}.</span>
          <span className="sr-only">{date.text}</span>
        </time>
        {stateName
          ? <p className={styles.postTag} lang="de">{stateName}</p>
          : <p className={styles.postTag}>Todos los estados</p>}
      </div>
      <div className={styles.postBody}>
        {/* Line breaks kept by CSS */}
        <h2 className={styles.postTitle}>{post.title}</h2>
        {post.body && <p className={styles.postText}>{post.body}</p>}
        {/* Photos, PDFs and links go here, after the text (next pull
            request, migration 5) */}
      </div>
    </article>
  )
}
