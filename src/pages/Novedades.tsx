import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigationType } from 'react-router'
import AreaLayout from './AreaLayout.tsx'
import NewsMeta from './NewsMeta.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { useProfile } from '../lib/profile.ts'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import {
  filesSummary, previewTiles, sortAttachments, BUCKET, LINK_SECONDS, type Attachment, type Tile,
} from '../lib/newsFiles.ts'
import { readListScroll, saveListScroll, type FromList } from '../lib/listScroll.ts'
import { MAP_SHAPES } from '../estados/mapShapes.ts'
import styles from './Novedades.module.css'

/** What the list needs of a post's file: its kind, its small copy (photos
    since migration 6) and its place. Never the full file's path: the list
    never loads full photos or PDFs. */
type PreviewFile = Pick<Attachment, 'id' | 'kind' | 'thumb_path' | 'sort_order' | 'created_at'>
const PREVIEW_FILE_COLUMNS = 'id, kind, thumb_path, sort_order, created_at'

/** One news post as the list gets it (title and body are plain text) */
interface NewsPost {
  id: string
  title: string
  body: string
  published_at: string
  /** The Bundesland the post is for, or null for all states */
  state: string | null
  /** Its photos and PDFs (only those the reader may see: the database
      decides) */
  news_attachments: PreviewFile[]
}

/** Signed links (file addresses that stop working after 1 hour) of the
    small copies, by path. A path missing here couldn't get a link. */
type Links = Record<string, string>

/* The answer of one news request. `key` says which request it answers
   (state + attempt), so an old answer is never shown for a new request. */
type NewsResult =
  | { key: string; ok: true; posts: NewsPost[]; links: Links }
  | { key: string; ok: false; error: string }

/** The user's state page: the news for their one Bundesland. In the new
    look (src/styles/redesign.css): the shared dark column on the left
    (AreaLayout.tsx: links, calendar preview, "Cerrar sesión") and the news
    on the light side, each post in its own ruled frame.

    Each post is a preview (DECISIONS.md, 18 Nov 2026, evening): date, tag,
    title, the start of the text, and its files as small tiles. The whole
    preview opens the full post, /novedades/<id> (NovedadPost.tsx). Going
    back returns the reader to where they were in the list. */
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
        // Each post comes with its files' rows in the same request.
        const { data, error } = await client
          .from('news_posts')
          .select('id, title, body, published_at, state, news_attachments(' + PREVIEW_FILE_COLUMNS + ')')
          .eq('published', true)
          .lte('published_at', new Date().toISOString())
          .or('state.is.null,state.eq.' + stateId)
          .order('published_at', { ascending: false })
          .returns<NewsPost[]>()
        if (error) {
          result = { key, ok: false, error: dataErrorMessage(error) }
        } else {
          const posts = data ?? []
          result = { key, ok: true, posts, links: await thumbLinks(client, posts) }
        }
      } catch (err) {
        result = { key, ok: false, error: dataErrorMessage(err) }
      }
      if (!cancelled) setNews(result)
    }
    void load()
    return () => { cancelled = true }
  }, [stateId, attempt])
  const current = news?.key === newsKey ? news : null  // null = still loading

  /* ---------- Back from a post: return to the same place ---------- */
  /* (The router this site uses doesn't do it by itself.) On Back ("POP"),
     scroll to where the list was when the post was opened, once the posts
     are on screen. Only once per visit; anything else opens at the top. */
  const location = useLocation()
  const navigationType = useNavigationType()
  const restored = useRef(false)
  const postsShown = current?.ok === true && current.posts.length > 0
  useLayoutEffect(() => {
    if (restored.current || !postsShown) return
    restored.current = true
    if (navigationType !== 'POP') return
    const y = readListScroll(location.key)
    if (y !== null) window.scrollTo(0, y)
  }, [postsShown, navigationType, location.key])
  const listKey = location.key
  const rememberPlace = () => saveListScroll(listKey, window.scrollY)

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
            {current.posts.map((post) => (
              <Post key={post.id} post={post} links={current.links} onOpen={rememberPlace} />
            ))}
          </div>
        )}
      </main>
    </AreaLayout>
  )
}

/** One signed link for every small copy shown on the page (at most 4 per
    post), all made in ONE request. The storage service makes a link only
    for a file the reader may read (migration 6). If the request fails, the
    posts are still shown and their photos show a "Foto" tile. */
async function thumbLinks(client: NonNullable<typeof supabase>, posts: NewsPost[]): Promise<Links> {
  const paths = posts.flatMap((p) =>
    previewTiles(sortAttachments(p.news_attachments ?? [])).flatMap((t) => (t.kind === 'thumb' ? [t.path] : [])))
  if (paths.length === 0) return {}
  try {
    const { data, error } = await client.storage.from(BUCKET).createSignedUrls(paths, LINK_SECONDS)
    if (error || !data) return {}
    const links: Links = {}
    for (const item of data) {
      if (item.path && item.signedUrl && !item.error) links[item.path] = item.signedUrl
    }
    return links
  } catch {
    return {}
  }
}

/** One news post as a preview, in its own frame: the date and the tag in
    one cell; in the other, the title, the start of the text (plain text,
    no links: the whole preview is one link already) and, when the post has
    files, a square file area on the right, filled by the number of files
    (see previewTiles in newsFiles.ts).

    The title is the only link (its accessible name is the title); CSS
    stretches its ::after layer over the whole frame, above every other part
    of the card, so clicking or tapping anywhere opens the post. */
function Post({ post, links, onOpen }: { post: NewsPost; links: Links; onOpen: () => void }) {
  const files = useMemo(() => sortAttachments(post.news_attachments ?? []), [post.news_attachments])
  const tiles = useMemo(() => previewTiles(files), [files])
  const state: FromList = { fromList: true }
  return (
    <article className={styles.post + ' ' + styles.isPreview}>
      <NewsMeta publishedAt={post.published_at} state={post.state} />
      <div className={styles.preview + (tiles.length ? ' ' + styles.hasFiles : '')}>
        <h2 className={styles.postTitle}>
          <Link className={styles.postLink} to={'/novedades/' + post.id} state={state} onClick={onOpen}>
            {post.title}
          </Link>
        </h2>
        {post.body && <PreviewText text={post.body} />}
        {tiles.length > 0 && (
          <>
            {/* Screen readers hear "Archivos: 3 fotos y 1 PDF" instead */}
            <div className={styles.fileArea} aria-hidden="true">
              <div className={styles.tiles + ' ' + TILES_LAYOUT[tiles.length]}>
                {tiles.map((tile, i) => <TileCell key={i} tile={tile} links={links} />)}
              </div>
            </div>
            <p className="sr-only">{filesSummary(files)}</p>
          </>
        )}
      </div>
    </article>
  )
}

/** The start of a post's text: about 4 lines (5 on a phone), set by CSS.
    When the text is longer than that, it fades out at the bottom: this
    measures whether the text is cut (a ResizeObserver tells when the box
    changes size, e.g. on turning the iPad) and adds the class that fades
    it. Short texts show whole, with no fade. */
function PreviewText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [long, setLong] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setLong(el.scrollHeight > el.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])
  return (
    <p ref={ref} className={styles.previewText + (long ? ' ' + styles.isLong : '')}>{text}</p>
  )
}

/** The file area's layout by the number of tiles (previewTiles gives 1, 2
    or 4): one tile filling the square, a column of two, or the 2×2 grid */
const TILES_LAYOUT: Record<number, string> = {
  1: styles.tilesOne,
  2: styles.tilesColumn,
  4: styles.tilesGrid,
}

/** One tile of the file area: a photo's small copy (cropped to its tile),
    "FOTO" for a photo without one (or whose link failed), "PDF", or the
    black tile with a number. Decoration only: the summary is read
    instead. */
function TileCell({ tile, links }: { tile: Tile; links: Links }) {
  if (tile.kind === 'thumb' && links[tile.path]) {
    return (
      <span className={styles.tile}>
        <img className={styles.tileImg} src={links[tile.path]} alt="" loading="lazy" decoding="async" />
      </span>
    )
  }
  if (tile.kind === 'thumb' || tile.kind === 'photo') {
    return <span className={styles.tile + ' ' + styles.tileWord}>Foto</span>
  }
  if (tile.kind === 'pdf') return <span className={styles.tile + ' ' + styles.tilePdf}>PDF</span>
  return <span className={styles.tile + ' ' + styles.tileCount}>{tile.count}</span>
}
