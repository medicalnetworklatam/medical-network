import AdminLayout, { BigLinks } from './AdminLayout.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'

/** /admin: the title "administración." and two big buttons, "Clientes"
    (the client overview) and "Publicar" (the news form). Nothing is read
    from the database here. */
export default function AdminHome() {
  usePageTitle('Administración · Medical Network')
  return (
    <AdminLayout title="Administración" label={null} body="hub">
      <BigLinks
        label="Administración"
        items={[
          { to: '/admin/clientes', title: 'Clientes' },
          { to: '/admin/novedades', title: 'Publicar' },
        ]}
      />
    </AdminLayout>
  )
}
