import type { NewsStatus } from '../lib/adminData.ts'
import styles from './Admin.module.css'

/** The tag style of a news post's status: "Borrador" outlined, "Programada"
    dashed, "Publicada" inverted (the news list and the news form) */
export const STATUS_CLASS: Record<NewsStatus, string> = {
  draft: styles.isDraft,
  scheduled: styles.isScheduled,
  published: styles.isPublished,
}
