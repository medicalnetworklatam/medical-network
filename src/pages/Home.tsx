import { Link } from 'react-router'
import MenuIcon from './MenuIcon.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import styles from './Home.module.css'

/** Home page (from design-mockup/index.html) */
export default function Home() {
  usePageTitle('Medical Network')

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <header className={styles.siteHeader}>
          <p className={styles.brand}>Medical Network</p>
          <Link className={styles.menuBtn} to="/estados" aria-label="Abrir menú">
            <MenuIcon />
          </Link>
        </header>

        <main>
          <div className={styles.container}>
            <section className={styles.hero}>
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle}>
                  <span className={`${styles.line} ${styles.line1}`}>Ser médico ya es difícil,</span>
                  <span className={`${styles.line} ${styles.line2}`}>No te preocupes</span>
                  <span className={`${styles.line} ${styles.line3}`}>por la burocracia</span>
                </h1>
              </div>
              <div className={styles.chart} aria-hidden="true">
                <div className={`${styles.bar} ${styles.bar1}`}></div>
                <div className={`${styles.bar} ${styles.bar2}`}></div>
                <div className={`${styles.bar} ${styles.bar3}`}></div>
                <div className={`${styles.bar} ${styles.bar4}`}></div>
              </div>
            </section>

            <section className={styles.cards}>
              <div className={`${styles.card} ${styles.cardMain}`}><p>[Main content block]</p></div>
              <div className={`${styles.card} ${styles.cardBox1}`}><p>[Box 1]</p></div>
              <div className={`${styles.card} ${styles.cardBox2}`}><p>[Box 2]</p></div>
            </section>
          </div>
        </main>

      </div>
    </div>
  )
}
