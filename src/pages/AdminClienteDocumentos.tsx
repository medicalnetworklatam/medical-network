import AdminClientPage from './AdminClientPage.tsx'
import AdminDocumentos from './AdminDocumentos.tsx'

/** /admin/clientes/<id>/documentos: the PDFs the team uploads for this
    client (AdminDocumentos.tsx, unchanged). Drawn only once the client is
    loaded and isn't an admin account (AdminClientPage.tsx), so upload and
    delete never appear for a missing, invalid or admin ID. */
export default function AdminClienteDocumentos() {
  return (
    <AdminClientPage section={{ title: 'Documentos' }}>
      {({ clientId, client, loading }) => (
        <AdminDocumentos clientId={clientId} isFree={client.plan === 'free'} disabled={loading} />
      )}
    </AdminClientPage>
  )
}
