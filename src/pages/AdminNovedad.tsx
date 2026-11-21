import { useEffect, useState } from 'react'
import AdminNewsPage, { type NewsPage } from './AdminNewsPage.tsx'
import { BigLinks } from './AdminLayout.tsx'
import { supabase } from '../lib/supabase.ts'
import { dataErrorMessage } from '../lib/dataErrors.ts'
import { formatBerlinDateTime } from '../lib/berlinTime.ts'
import { NEWS_STATUS_LABEL, newsFilesText, newsStatus, stateName } from '../lib/adminData.ts'
import styles from './Admin.module.css'

type Files =
  | { postId: string; ok: true; photos: number; pdfs: number }
  | { postId: string; ok: false; error: string }

/** /admin/novedades/<id> (and any other address under it): the post's title
    and two big buttons, "Texto y publicación" and "Fotos y PDF", each with
    a one-line status (DECISIONS.md, 21 Nov 2026, night, latest). Drawn only
    once the post is loaded (AdminNewsPage.tsx). */
export default function AdminNovedad() {
  return (
    <AdminNewsPage>
      {(page) => <NewsHub {...page} />}
    </AdminNewsPage>
  )
}

function NewsHub({ postId, post }: NewsPage) {
  /* Only the number of photos and of PDF: no file names, no signed links */
  const [files, setFiles] = useState<Files | null>(null)
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    let cancelled = false
    async function load() {
      let next: Files
      try {
        const count = async (kind: 'image' | 'pdf') => {
          const { count, error } = await db.from('news_attachments')
            .select('id', { count: 'exact', head: true })
            .eq('post_id', postId).eq('kind', kind)
          if (error) throw error
          return count ?? 0
        }
        const [photos, pdfs] = await Promise.all([count('image'), count('pdf')])
        next = { postId, ok: true, photos, pdfs }
      } catch (err) {
        next = { postId, ok: false, error: dataErrorMessage(err) }
      }
      if (!cancelled) setFiles(next)
    }
    void load()
    return () => { cancelled = true }
  }, [postId])
  const current = files?.postId === postId ? files : null  // null = loading
  const [now] = useState(() => Date.now())
  const state = stateName(post.state)

  return (
    <>
      {current && !current.ok && (
        <div className={styles.message + ' ' + styles.isError} role="alert">
          <p>No se pudo cargar el resumen de la novedad. {current.error}</p>
        </div>
      )}
      <BigLinks
        label="Secciones de la novedad"
        items={[
          {
            to: `/admin/novedades/${postId}/texto`,
            title: 'Texto y publicación',
            // Everything from the database is plain text
            status: (
              <>
                {NEWS_STATUS_LABEL[newsStatus(post, now)]}
                {' · '}{formatBerlinDateTime(post.published_at)}
                {' · '}{post.state ? <span lang="de">{state || post.state}</span> : 'Todos los estados'}
                {' · '}{post.paid_only ? 'Solo de pago' : 'También gratis'}
              </>
            ),
          },
          {
            to: `/admin/novedades/${postId}/archivos`,
            title: 'Fotos y PDF',
            status: !current ? 'Cargando…' : current.ok ? newsFilesText(current.photos, current.pdfs) : undefined,
          },
        ]}
      />
    </>
  )
}
