import styles from './Auth.module.css'

/** Shown for a moment while the saved login is checked */
export default function Loading() {
  return (
    <div className={styles.loading} role="status">
      Cargando…
    </div>
  )
}
