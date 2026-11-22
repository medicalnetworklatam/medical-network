import AdminLayout, { BigLinks } from './AdminLayout.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'

/** /admin: the title "administración." and three big buttons, "Clientes"
    (the client overview), "Publicar" (the news form) and "Diagnóstico"
    (the owner's tool for his sales calls). Nothing is read from the
    database here. */
export default function AdminHome() {
  usePageTitle('Administración · Medical Network')
  return (
    <AdminLayout title="Administración" label={null} body="hub">
      <BigLinks
        label="Administración"
        items={[
          { to: '/admin/clientes', title: 'Clientes' },
          { to: '/admin/novedades', title: 'Publicar' },
          { to: '/admin/diagnostico', title: 'Diagnóstico', status: 'Para usar en la llamada · no guarda nada' },
        ]}
      />
    </AdminLayout>
  )
}
