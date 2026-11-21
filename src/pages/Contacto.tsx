import type { CSSProperties } from 'react'
import AreaLayout from './AreaLayout.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { contact } from '../content/contact.ts'
import board from './Comunidad.module.css'
import styles from './Contacto.module.css'

/** How to reach the MNL team: WhatsApp and email, plus a separate email for
    problems with the website. Open to every logged-in user (free accounts
    and clients without a Bundesland too). The values live in
    src/content/contact.ts; an empty value hides its row. No form, nothing
    is stored. */
export default function Contacto() {
  usePageTitle('Contacto · Medical Network')

  /* wa.me wants only digits (country code first, no "+" or spaces) */
  const whatsappDigits = contact.whatsappNumber.replace(/\D/g, '')
  const whatsappDisplay = contact.whatsappDisplay.trim()
  const contactEmail = contact.contactEmail.trim()
  const webEmail = contact.webEmail.trim()
  const hasAny = whatsappDigits !== '' || contactEmail !== '' || webEmail !== ''

  /* The title's size comes from its length ("contacto." = 9), set from
     code (React's style prop): the site's CSP blocks style="..." attributes */
  const titleStyle = { '--title-chars': 9 } as CSSProperties

  return (
    <AreaLayout current="contacto">
      <main className={board.main}>
        <div className={board.head}>
          <p className={board.label}>equipo mnl</p>
          <h1 className={board.pageTitle} style={titleStyle}>
            Contacto<span aria-hidden="true">.</span>
          </h1>
        </div>

        {hasAny ? (
          <>
            <p className={styles.intro}>¿Tienes un problema o una duda? Escríbenos.</p>

            {(whatsappDigits || contactEmail) && (
              <div className={styles.cells}>
                {whatsappDigits && (
                  <section className={styles.cell} aria-labelledby="contacto-whatsapp">
                    <h2 className={board.label} id="contacto-whatsapp">WhatsApp</h2>
                    {whatsappDisplay && <p className={styles.value}>{whatsappDisplay}</p>}
                    <a
                      className={styles.primaryBtn}
                      href={'https://wa.me/' + whatsappDigits}
                      target="_blank" rel="noopener noreferrer"
                    >
                      Escribir por WhatsApp
                      <span className="sr-only"> (se abre en una pestaña nueva)</span>
                    </a>
                  </section>
                )}

                {contactEmail && (
                  <section className={styles.cell} aria-labelledby="contacto-correo">
                    <h2 className={board.label} id="contacto-correo">Correo</h2>
                    <a className={styles.emailLink} href={'mailto:' + contactEmail}>
                      {contactEmail}
                    </a>
                  </section>
                )}
              </div>
            )}

            {webEmail && (
              <p className={styles.web}>
                ¿Problemas con la página web? Escríbenos a{' '}
                <a className={styles.webLink} href={'mailto:' + webEmail}>{webEmail}</a>
              </p>
            )}
          </>
        ) : (
          <p className={board.message}>Pronto publicaremos nuestros datos de contacto.</p>
        )}
      </main>
    </AreaLayout>
  )
}
