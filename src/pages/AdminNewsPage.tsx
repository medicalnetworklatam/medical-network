import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import AdminLayout from './AdminLayout.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import { NEWS_COLUMNS, type NewsPost } from '../lib/adminData.ts'
import styles from './Admin.module.css'

/* What a post ID looks like. Anything else in the address is not asked for. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What a post page gets once the post is loaded */
export interface NewsPage {
  postId: string
  /** The post as the database last gave it: from the load, or a save */
  post: NewsPost
  setPost: (post: NewsPost) => void
  /** Reloading */
  loading: boolean
}

type Loaded =
  | { attempt: number; ok: true; post: NewsPost | null }
  | { attempt: number; ok: false; error: string }

/** The one way the pages of a news post (/admin/novedades/<id> and its two
    pages) load it: a valid ID in the address (otherwise "Novedad no
    encontrada." and nothing is asked for), then that one post. `children`
    (the page's section) is drawn ONLY once the post has loaded.
    It also draws the frame: the back link, the title (the post's title on
    its hub, with its own capitals) and the browser tab's title, which stays
    generic (DECISIONS.md, 21 Nov 2026, night, latest). */
export default function AdminNewsPage({ section = null, children }: {
  /** null: the post's hub page; otherwise the page title ("Fotos y PDF") */
  section?: string | null
  children: (page: NewsPage) => ReactNode
}) {
  usePageTitle((section ? section + ' · ' : '') + 'Novedad · Administración · Medical Network')
  const { id = '' } = useParams()

  if (!UUID.test(id)) {
    return (
      <Frame section={section} postId={null} post={null}>
        <p className={styles.message}>Novedad no encontrada.</p>
      </Frame>
    )
  }
  return <Loader key={id} postId={id} section={section}>{children}</Loader>
}

function Loader({ postId, section, children }: {
  postId: string
  section: string | null
  children: (page: NewsPage) => ReactNode
}) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [post, setPost] = useState<NewsPost | null>(null)
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    let cancelled = false
    async function load() {
      let next: Loaded
      try {
        const { data, error } = await db.from('news_posts').select(NEWS_COLUMNS)
          .eq('id', postId).maybeSingle<NewsPost>()
        if (error) throw error
        next = { attempt, ok: true, post: data }
      } catch (err) {
        next = { attempt, ok: false, error: dataErrorMessage(err) }
      }
      if (cancelled) return
      setLoaded(next)
      if (next.ok) setPost(next.post)
    }
    void load()
    return () => { cancelled = true }
  }, [postId, attempt])
  const loading = loaded?.attempt !== attempt

  /* ---------- Loading, error, not found: never the page's section ---------- */
  if (!post) {
    let message: ReactNode
    if (loading) {
      message = <p className={styles.message} role="status">Cargando novedad…</p>
    } else if (loaded && !loaded.ok) {
      message = (
        <div className={styles.message + ' ' + styles.isError} role="alert">
          <p>No se pudo cargar la novedad. {loaded.error}</p>
          <button type="button" className={styles.messageBtn} onClick={() => setAttempt((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )
    } else {
      message = <p className={styles.message}>Novedad no encontrada.</p>
    }
    return <Frame section={section} postId={postId} post={null}>{message}</Frame>
  }

  return (
    <Frame section={section} postId={postId} post={post}>
      {children({ postId, post, setPost, loading })}
    </Frame>
  )
}

/** The frame: on the hub, the post's title as the title and "← Novedades";
    on a section page, the section as the title, the post's title as the
    small label and "← <post title>". Titles are plain text. */
function Frame({ section, postId, post, children }: {
  section: string | null
  /** null: not a valid ID */
  postId: string | null
  /** null: not loaded (yet), or not found */
  post: NewsPost | null
  children: ReactNode
}) {
  if (!section) {
    return (
      <AdminLayout
        title={post ? post.title : 'Novedad'}
        nameTitle={!!post}
        clientTitle
        back={{ to: '/admin/novedades', label: 'Novedades' }}
        body="hub"
      >
        {children}
      </AdminLayout>
    )
  }
  return (
    <AdminLayout
      title={section}
      label={post ? post.title : 'administración'}
      nameLabel={!!post}
      compact
      back={postId
        ? { to: '/admin/novedades/' + postId, label: post ? post.title : 'Novedad' }
        // Not a post ID: its hub would only say "not found" too
        : { to: '/admin/novedades', label: 'Novedades' }}
    >
      {children}
    </AdminLayout>
  )
}
