import { MAP_SHAPES } from '../estados/mapShapes.ts'
import styles from './Novedades.module.css'

/* A post's date in German time, in parts: { day: "12", month: "nov",
   year: "2026", text: "12 nov 2026" } */
const DATE = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Berlin',
})
function dateParts(iso: string): { day: string; month: string; year: string; text: string } {
  const date = new Date(iso)
  const part = (type: string) => DATE.formatToParts(date).find((p) => p.type === type)?.value.replace('.', '') ?? ''
  return { day: part('day'), month: part('month'), year: part('year'), text: DATE.format(date).replace('.', '') }
}

/** The left cell of a news post's frame, shared by the Novedades list and
    the full post (NovedadPost.tsx): "NOV 2026" over a big "18.", then the
    post's tag, "Todos los estados" or its Bundesland (in German).

    filesNote (the list only): how many files the post has, "3 fotos y
    1 PDF", in a box above the tag. CSS shows it on phones only, where the
    preview has no file area. Screen readers hear the preview's own
    summary instead, so the box is hidden from them. */
export default function NewsMeta({ publishedAt, state, filesNote = '' }: {
  publishedAt: string
  state: string | null
  filesNote?: string
}) {
  const date = dateParts(publishedAt)
  const stateName = state ? MAP_SHAPES.find((s) => s.id === state)?.name ?? '' : ''
  return (
    <div className={styles.postMeta}>
      {/* Seen as "NOV 2026" over "18."; heard once as "18 nov 2026" */}
      <time className={styles.postDate} dateTime={publishedAt}>
        <span className={styles.postMonth} aria-hidden="true">{date.month} {date.year}</span>
        <span className={styles.postDay} aria-hidden="true">{date.day}.</span>
        <span className="sr-only">{date.text}</span>
      </time>
      <div className={styles.postLabels}>
        {filesNote && <p className={styles.postFilesNote} aria-hidden="true">{filesNote}</p>}
        {stateName
          ? <p className={styles.postTag} lang="de">{stateName}</p>
          : <p className={styles.postTag}>Todos los estados</p>}
      </div>
    </div>
  )
}
