import { useLayoutEffect } from 'react'
import styles from './Auth.module.css'

/** Shown for a moment while the saved login is checked */
export default function Loading() {
  // The new look's background, colour and font on <body>, only while shown
  useLayoutEffect(() => {
    document.body.classList.add(styles.pageBody)
    return () => document.body.classList.remove(styles.pageBody)
  }, [])

  return (
    <div className={styles.loading} role="status">
      Cargando…
    </div>
  )
}
