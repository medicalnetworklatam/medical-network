import { useNavigate } from 'react-router'
import AdminLayout from './AdminLayout.tsx'
import AdminNewsForm from './AdminNewsForm.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import styles from './Admin.module.css'

/** /admin/novedades/nueva: the form for a new post. Once saved, its "Fotos y
    PDF" page opens (photos and PDF need the post's id). */
export default function AdminNovedadNueva() {
  usePageTitle('Nueva novedad · Administración · Medical Network')
  const navigate = useNavigate()

  return (
    <AdminLayout title="Nueva novedad" compact back={{ to: '/admin/novedades', label: 'Novedades' }}>
      <AdminNewsForm
        editing={null}
        onSaved={(post) => navigate('/admin/novedades/' + post.id + '/archivos', { state: { created: true } })}
      />
      <p className={styles.message}>
        Las fotos y los PDF se añaden después de guardar. Para que los clientes vean la novedad completa
        desde el principio, guárdala sin marcar «Publicada», añade los archivos y luego márcala.
      </p>
    </AdminLayout>
  )
}
