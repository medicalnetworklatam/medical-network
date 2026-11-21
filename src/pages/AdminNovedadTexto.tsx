import AdminNewsPage from './AdminNewsPage.tsx'
import AdminNewsForm from './AdminNewsForm.tsx'

/** /admin/novedades/<id>/texto: the post's title, text, Bundesland, date and
    publication (AdminNewsForm.tsx). After a save the page stays on the post.
    Drawn only once the post is loaded (AdminNewsPage.tsx). */
export default function AdminNovedadTexto() {
  return (
    <AdminNewsPage section="Texto y publicación">
      {({ post, setPost }) => <AdminNewsForm editing={post} onSaved={(saved) => setPost(saved)} />}
    </AdminNewsPage>
  )
}
