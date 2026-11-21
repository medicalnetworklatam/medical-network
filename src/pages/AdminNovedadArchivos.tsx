import { useState } from 'react'
import { useLocation } from 'react-router'
import AdminNewsPage from './AdminNewsPage.tsx'
import AdminNewsFiles from './AdminNewsFiles.tsx'
import { NEWS_STATUS_LABEL, newsStatus } from '../lib/adminData.ts'
import styles from './Admin.module.css'

/** /admin/novedades/<id>/archivos: the post's photos and PDF
    (AdminNewsFiles.tsx). A new post opens here right after it is saved,
    with a notice. Drawn only once the post is loaded (AdminNewsPage.tsx). */
export default function AdminNovedadArchivos() {
  const location = useLocation()
  /* Set by "Nueva novedad" when it opens this page after saving */
  const created = (location.state as { created?: boolean } | null)?.created === true
  const [now] = useState(() => Date.now())

  return (
    <AdminNewsPage section="Fotos y PDF">
      {({ postId, post, loading }) => (
        <>
          {created && (
            <p className={styles.message} role="status">
              Guardada: «{post.title}» · {NEWS_STATUS_LABEL[newsStatus(post, now)]}. Ahora puedes añadirle fotos y PDF.
            </p>
          )}
          <AdminNewsFiles key={postId} postId={postId} postTitle={post.title} disabled={loading} />
        </>
      )}
    </AdminNewsPage>
  )
}
