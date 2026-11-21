import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate, useNavigationType, useParams } from 'react-router'
import AreaLayout from './AreaLayout.tsx'
import NewsMeta from './NewsMeta.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { useProfile } from '../lib/profile.ts'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import { linkify } from '../lib/linkify.tsx'
import { cameFromList } from '../lib/listScroll.ts'
import {
  altText, sortAttachments, ATTACHMENT_COLUMNS, BUCKET, LINK_SECONDS, type Attachment,
} from '../lib/newsFiles.ts'
import styles from './Novedades.module.css'

/** One news post as this page gets it (title and body are plain text) */
interface NewsPost {
  id: string
  title: string
  body: string
  published_at: string
  /** The Bundesland the post is for, or null for all states */
  state: string | null
  /** Its photos and PDFs (only those the reader may see: the database
      decides) */
  news_attachments: Attachment[]
}

/** Signed links (file addresses that stop working after 1 hour), by path.
    A path missing here couldn't get a link. */
type Links = Record<string, string>

/** A post id: a uuid, the 36-character id format the database uses. The
    address is checked against this before asking the database, so a bad
    address never causes a database error. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* The answer of one request. `key` says which request it answers (post +
   state + attempt), so an old answer is never shown for a new request.
   post: null = there is no such post for this reader. */
type PostResult =
  | { key: string; ok: true; post: NewsPost | null; links: Links }
  | { key: string; ok: false; error: string }

const NOT_FOUND = 'No encontramos esta novedad.'

/** One Novedades post, whole, on its own page (/novedades/<id>), inside the
    shared column with Novedades marked (DECISIONS.md, 18 Nov 2026,
    evening): "← Novedades", then the date and tag, the title, the full text
    with its links, the photos whole and the PDFs.

    It asks for the post with the same filters as the list (published, date
    has come, the reader's state or all states), so admins see what a client
    sees; RLS decides what a client can really read. A post that doesn't
    exist, one the reader can't see, a reader without a state and an
    address that isn't a post id all show the same message, so nothing is
    given away. */
export default function NovedadPost() {
  const { id = '' } = useParams()
  const validId = UUID.test(id)
  const postId = id.toLowerCase()
  const { profile } = useProfile()
  const stateId = profile?.main_state ?? null
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()

  /* Opened from a link (not Back or Forward): start at the top. The router
     this site uses keeps the list's scroll position otherwise. */
  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0)
  }, [postId, navigationType])

  /* ---------- The post ---------- */
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<PostResult | null>(null)
  const askDatabase = validId && stateId !== null && supabase !== null
  const key = postId + ':' + stateId + ':' + attempt
  useEffect(() => {
    if (!askDatabase || !supabase || !stateId) return
    const client = supabase
    const requestKey = postId + ':' + stateId + ':' + attempt
    let cancelled = false
    async function load() {
      let next: PostResult
      try {
        const { data, error } = await client
          .from('news_posts')
          .select('id, title, body, published_at, state, news_attachments(' + ATTACHMENT_COLUMNS + ')')
          .eq('id', postId)
          .eq('published', true)
          .lte('published_at', new Date().toISOString())
          .or('state.is.null,state.eq.' + stateId)
          .maybeSingle<NewsPost>()
        if (error) {
          next = { key: requestKey, ok: false, error: dataErrorMessage(error) }
        } else {
          next = { key: requestKey, ok: true, post: data, links: data ? await fileLinks(client, data) : {} }
        }
      } catch (err) {
        next = { key: requestKey, ok: false, error: dataErrorMessage(err) }
      }
      if (!cancelled) setResult(next)
    }
    void load()
    return () => { cancelled = true }
  }, [askDatabase, postId, stateId, attempt])

  /* null = still loading; a bad address or no state = not found at once */
  const current: PostResult | null = !askDatabase
    ? { key, ok: true, post: null, links: {} }
    : result?.key === key ? result : null
  const post = current?.ok ? current.post : null

  usePageTitle(
    post ? post.title + ' · Medical Network'
      : current?.ok ? 'Novedad no encontrada · Medical Network'
        : 'Novedades · Medical Network',
  )

  /* "← Novedades": like the browser's Back button when the page before
     this one, in this tab, is the list (so the list opens where the reader
     was). Opened any other way (a shared link, a new tab), it goes to
     /novedades. A click with Ctrl, Cmd, Shift or the middle button keeps
     the browser's own behaviour (e.g. open in a new tab). */
  const fromList = cameFromList(location.state)
  function onBack(e: MouseEvent<HTMLAnchorElement>) {
    if (!fromList || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    void navigate(-1)
  }

  return (
    <AreaLayout current="novedades">
      <main className={styles.main}>
        <div className={styles.back}>
          <Link className={styles.backLink} to="/novedades" onClick={onBack}>
            <span aria-hidden="true">←{' '}</span>Novedades
          </Link>
        </div>

        {!current ? (
          <p className={styles.message} role="status">Cargando novedad…</p>
        ) : !current.ok ? (
          <div className={styles.message + ' ' + styles.isInverted} role="alert">
            <p>No se pudo cargar la novedad. {current.error}</p>
            <button type="button" className={styles.messageBtn} onClick={() => setAttempt((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        ) : !current.post ? (
          <div className={styles.message + ' ' + styles.isInverted}>
            <h1 className={styles.messageLead}>{NOT_FOUND}</h1>
            <Link className={styles.messageBtn} to="/novedades">Ver novedades</Link>
          </div>
        ) : (
          <div className={styles.posts}>
            <FullPost post={current.post} readerState={stateId} links={current.links} />
          </div>
        )}
      </main>
    </AreaLayout>
  )
}

/** One signed link for each of this post's files (the full photos and the
    PDFs), in ONE request. The storage service makes a link only for a file
    the reader may read (migration 5). If the request fails, the post is
    still shown and each file says it couldn't be loaded. */
async function fileLinks(client: NonNullable<typeof supabase>, post: NewsPost): Promise<Links> {
  const paths = (post.news_attachments ?? []).map((a) => a.path)
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

/** The whole post, in the same frame as the list: the date and the tag in
    one cell, the title (the page's heading), the full text and the files in
    the other. Title and body are plain text only (never HTML); web
    addresses in the body become links (linkify, built as React elements).
    The files come after the text, in the admin's order. */
function FullPost({ post, readerState, links }: {
  post: NewsPost
  /** The reader's own Bundesland, for the colour of the date cell */
  readerState: string | null
  links: Links
}) {
  const text = useMemo(() => linkify(post.body), [post.body])
  const files = useMemo(() => sortAttachments(post.news_attachments ?? []), [post.news_attachments])
  return (
    <article className={styles.post}>
      <NewsMeta publishedAt={post.published_at} state={post.state} readerState={readerState} />
      <div className={styles.postBody}>
        {/* Line breaks kept by CSS */}
        <h1 className={styles.postTitle}>{post.title}</h1>
        {post.body && <p className={styles.postText}>{text}</p>}
        {files.length > 0 && (
          <div className={styles.postFiles}>
            {files.map((file) => (
              <PostFile key={file.id} file={file} url={links[file.path]} title={post.title} />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

/** One file of a post. Both kinds open in a new tab, from the storage
    service's own address (never inside this site, never as HTML).
    - a photo: shown whole, never taller than the screen and never cropped
      (design-hero/DESIGN-RULES.md); tapping it opens it full size
    - a PDF: a row with its name and "Abrir PDF" */
function PostFile({ file, url, title }: { file: Attachment; url: string | undefined; title: string }) {
  if (!url) {
    return (
      <p className={styles.fileMissing}>
        {file.kind === 'pdf'
          ? <>No se pudo cargar el PDF «{file.file_name}».</>
          : 'No se pudo cargar esta foto.'}{' '}
        Vuelve a cargar la página para intentarlo de nuevo.
      </p>
    )
  }
  if (file.kind === 'image') {
    return (
      <a className={styles.photo} href={url} target="_blank" rel="noopener noreferrer">
        <img className={styles.photoImg} src={url} alt={altText(file.description, title)} loading="lazy" decoding="async" />
        <span className="sr-only"> (se abre en tamaño completo en una pestaña nueva)</span>
      </a>
    )
  }
  return (
    <a className={styles.pdf} href={url} target="_blank" rel="noopener noreferrer">
      <span className={styles.pdfKind} aria-hidden="true">PDF</span>
      <span className={styles.pdfName}>{file.file_name}</span>
      <span className={styles.pdfOpen}>
        Abrir PDF<span className="sr-only"> (se abre en una pestaña nueva)</span>
      </span>
    </a>
  )
}
