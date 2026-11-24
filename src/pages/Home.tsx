import { useRef } from 'react'
import { Link } from 'react-router'
import HomeHeader from './home/HomeHeader.tsx'
import CallLink from './home/CallLink.tsx'
import Carousel from './home/Carousel.tsx'
import Strip from './home/Strip.tsx'
import YearRow from './home/YearRow.tsx'
import { Rich } from './home/Rich.tsx'
import { useFadeUp } from './home/fadeUp.ts'
import { useCallBar, usePageChrome } from './home/callBar.ts'
import { useAuth } from '../lib/auth.ts'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { home, sections, type HomePhoto } from '../content/home.ts'
import antes from '../assets/antes.webp'
import hoy from '../assets/hoy.jpg'
import quirofano from '../assets/prueba-quirofano.webp'
import edificio from '../assets/edificio.jpg'
import lagoon from '../assets/lagoon.jpg'
import heroHouse from '../assets/hero-house.jpg'
import ejecucion from '../assets/ejecucion.jpg'
// Ivan's background images (24 Nov 2026)
import streak from '../assets/home-streak.webp'
import portraitGlow from '../assets/home-portrait-glow.webp'
import grain from '../assets/home-grain.webp'
import styles from './Home.module.css'

/* Home page (/), rebuilt on 24 Nov 2026 from Ivan's own landing design
   (DECISIONS.md, "Changes on 24 Nov 2026"; measurements in
   design-reference/landing-v2/SPEC.md, texts in COPY.md there). Every text
   comes from src/content/home.ts. Only this page uses this look: its
   colours and fonts are in Home.module.css, put on <body> while it is open.

   Sections: header → hero → strip → Historias → Quién soy → Cómo funciona
   → Qué incluye → Ruta Approbation (price) → Preguntas → ¿Ya eres
   cliente? → footer, plus the phone's bottom bar with the Calendly button.

   Many photos are placeholders until the owner sends his own (see
   PHOTOS below and the pull request of 24 Nov 2026). */

/** The site's photos by name, with their size (so the page doesn't jump
    while they load). Placeholders: see home.ts. */
const PHOTOS: Record<HomePhoto, { src: string; width: number; height: number }> = {
  antes: { src: antes, width: 914, height: 816 },
  hoy: { src: hoy, width: 564, height: 776 },
  quirofano: { src: quirofano, width: 1440, height: 960 },
  edificio: { src: edificio, width: 1200, height: 805 },
  lagoon: { src: lagoon, width: 1600, height: 1081 },
  heroHouse: { src: heroHouse, width: 2000, height: 1341 },
  ejecucion: { src: ejecucion, width: 858, height: 929 },
}

function Photo({ name, alt, className, eager }: { name: HomePhoto; alt: string; className?: string; eager?: boolean }) {
  const p = PHOTOS[name]
  return (
    <img
      className={className}
      src={p.src}
      alt={alt}
      width={p.width}
      height={p.height}
      loading={eager ? undefined : 'lazy'}
      decoding="async"
    />
  )
}

export default function Home() {
  usePageTitle('Medical Network')
  const { session, loading } = useAuth()

  const rootRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const priceRef = useRef<HTMLElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  usePageChrome(headerRef)
  useFadeUp(rootRef)
  const barShown = useCallBar(heroRef, priceRef, barRef)

  const { hero, stories, about, phases, includes, price, faq, client, footer } = home

  return (
    <div className={styles.page} ref={rootRef} id="inicio">
      <HomeHeader ref={headerRef} />

      <main>
        {/* 1. Hero: the headline (one h1 in two parts), the button, the
            portrait (a placeholder until the owner's cut-out portrait) */}
        <section className={`${styles.dark} ${styles.hero}`} ref={heroRef} aria-labelledby="hero-title">
          <img className={styles.heroBg} src={grain} alt="" width={2000} height={1318} />
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroText}>
              <h1 className={styles.heroTitle} id="hero-title">
                <span className={styles.heroLead}>{hero.titleLead}</span>{' '}
                <span className={styles.heroRest}><Rich text={hero.titleRest} className={styles.hl} /></span>
              </h1>
              <div className={styles.call}>
                <CallLink className={`${styles.btn} ${styles.btnPrimary}`} />
                <p className={styles.callNote}>{hero.callNote}</p>
              </div>
            </div>
            <figure className={styles.heroPortrait}>
              {/* a soft teal glow behind the portrait */}
              <img className={styles.heroGlow} src={portraitGlow} alt="" width={1366} height={900} />
              <Photo name="hoy" alt={hero.portraitAlt} eager className={styles.heroPhoto} />
            </figure>
          </div>
        </section>

        {/* 2. The strip, over the hero's bottom edge */}
        <Strip />

        {/* 3. Historias: testimonials */}
        <section className={styles.rays} id="historias" aria-labelledby="historias-title">
          <div className={styles.container}>
            <h2 className={styles.h2} id="historias-title" data-fade><Rich text={stories.title} className={styles.hl} /></h2>
            <div data-fade>
              <Carousel label={stories.label}>
                {stories.cards.map((c) => (
                  <figure key={c.name} className={styles.story}>
                    <div className={styles.storyTop}>
                      {c.photo ? (
                        <Photo name={c.photo} alt={c.alt} className={styles.storyPhoto} />
                      ) : (
                        <span className={styles.storyMark} aria-hidden="true">“</span>
                      )}
                    </div>
                    <div className={styles.storyBody}>
                      <blockquote className={styles.storyQuote}>
                        <p><Rich text={c.quote} /></p>
                      </blockquote>
                      <figcaption className={styles.storyBy}>
                        <span className={styles.storyName}>{c.name}</span>
                        <span className={styles.storyRole}><Rich text={c.role} /></span>
                      </figcaption>
                    </div>
                  </figure>
                ))}
              </Carousel>
            </div>
          </div>
        </section>

        {/* 4. Quién soy: the owner's years as cards */}
        <section className={`${styles.dark} ${styles.about}`} id="quien-soy" aria-labelledby="quien-soy-title">
          <span className={styles.aboutLine} aria-hidden="true"></span>
          <div className={styles.container}>
            <div className={styles.aboutHead} data-fade>
              <h2 className={styles.aboutTitle} id="quien-soy-title"><Rich text={about.title} className={styles.hl} /></h2>
              <p className={styles.aboutSub}>{about.subtitle}</p>
            </div>
            <div data-fade>
              <YearRow label={about.label}>
                {about.cards.map((c) => (
                  <li key={c.year} className={styles.yearCard}>
                    <Photo name={c.photo} alt={c.alt} className={styles.yearPhoto} />
                    <div className={styles.yearText}>
                      <span className={styles.yearNum}>{c.year}</span>
                      <span className={styles.yearLine}><Rich text={c.text} /></span>
                    </div>
                  </li>
                ))}
              </YearRow>
            </div>
            <p className={styles.aboutText} data-fade><Rich text={about.paragraph} className={styles.hl} /></p>
          </div>
        </section>

        {/* 5. Cómo funciona: the three phases */}
        <section className={`${styles.light} ${styles.lightA}`} id="como-funciona" aria-labelledby="como-funciona-title">
          <div className={styles.container}>
            <h2 className={styles.h2} id="como-funciona-title" data-fade><Rich text={phases.title} className={styles.hl} /></h2>
            <div data-fade>
              <Carousel label={phases.label}>
                {phases.cards.map((p) => (
                  <article key={p.num} className={styles.offer}>
                    <Photo name={p.photo} alt="" className={styles.offerPhoto} />
                    <div className={styles.offerBody}>
                      <p className={styles.offerTag}>{p.num}</p>
                      <h3 className={styles.offerTitle}>{p.title}</h3>
                      <p><Rich text={p.intro} /></p>
                      {p.items.length > 0 && (
                        <ul className={styles.offerList}>
                          {p.items.map((item) => <li key={item}><Rich text={item} /></li>)}
                        </ul>
                      )}
                      <div className={styles.offerResult}>
                        <p className={styles.offerResultLabel}>{phases.resultLabel}</p>
                        <p><Rich text={p.result} /></p>
                      </div>
                    </div>
                  </article>
                ))}
              </Carousel>
            </div>
          </div>
        </section>

        {/* 6. Qué incluye: what the package includes and the bonuses */}
        <section className={`${styles.light} ${styles.lightB}`} id="que-incluye" aria-labelledby="que-incluye-title">
          <div className={styles.container}>
            <div className={styles.secHead} data-fade>
              <h2 className={styles.h2} id="que-incluye-title"><Rich text={includes.title} className={styles.hl} /></h2>
              <p className={styles.secSub}>{includes.subtitle}</p>
            </div>
            <div data-fade>
              <Carousel label={includes.label}>
                {includes.cards.map((c) => (
                  <article key={c.title} className={`${styles.offer} ${styles.offerShort}`}>
                    <div className={styles.offerBody}>
                      <h3 className={styles.offerTitle}>{c.title}</h3>
                      <p className={styles.offerTag}>{c.tag}</p>
                      <p><Rich text={c.text} /></p>
                    </div>
                  </article>
                ))}
              </Carousel>
            </div>
            <p className={styles.total} data-fade><Rich text={includes.total} className={styles.hl} /></p>
          </div>
        </section>

        {/* 7. Ruta Approbation: the price. The phone's bar hides while it
            is on screen (it has its own button). */}
        <section className={`${styles.dark} ${styles.price}`} id="ruta-approbation" ref={priceRef} aria-labelledby="ruta-approbation-title">
          {/* the light streak, desktop only: it runs behind the photo on the
              left, never behind the text on the right */}
          <img className={styles.priceBg} src={streak} alt="" width={1366} height={768} loading="lazy" />
          <div className={`${styles.container} ${styles.priceGrid}`}>
            <figure className={styles.pricePhoto}>
              <Photo name="ejecucion" alt="" />
            </figure>
            <div className={styles.priceText} data-fade>
              <h2 className={styles.priceTitle} id="ruta-approbation-title"><Rich text={price.title} /></h2>
              <p className={styles.priceSub}>{price.subtitle}</p>
              <p className={styles.pricePill}>
                <span className={styles.pricePillSmall}>{price.pillSmall}</span>{' '}
                <span className={styles.pricePillBig}>{price.pillBig}</span>
              </p>
              <p className={styles.priceText2}><Rich text={price.paragraph} /></p>
              <p className={styles.priceLine}>{price.line}</p>
              <div className={styles.call}>
                <CallLink className={`${styles.btn} ${styles.btnPrimary}`} />
                <p className={styles.callNote}>{price.callNote}</p>
              </div>
              <p className={styles.signoff}>{price.signoff}</p>
            </div>
          </div>
        </section>

        {/* 8. Preguntas frecuentes: the browser's own open/close rows
            (<details>), closed at first; Tab, Enter and Space work without
            any script. */}
        <section className={styles.rays} id="preguntas" aria-labelledby="preguntas-title">
          <div className={styles.container}>
            <h2 className={styles.h2} id="preguntas-title" data-fade><Rich text={faq.title} className={styles.hl} /></h2>
            <div className={styles.faqList} data-fade>
              {faq.items.map((f) => (
                <details key={f.q} className={styles.faqItem}>
                  <summary className={styles.faqQ}>
                    <span>{f.q}</span>
                    <span className={styles.faqSign} aria-hidden="true"></span>
                  </summary>
                  <p className={styles.faqA}><Rich text={f.a} /></p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 9. ¿Ya eres cliente?: the way into the client area */}
        <section className={styles.client} aria-labelledby="cliente-title">
          <img className={styles.clientBg} src={grain} alt="" width={2000} height={1318} loading="lazy" />
          <div className={`${styles.container} ${styles.clientInner}`} data-fade>
            <span className={styles.clientIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" focusable="false">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <h2 className={styles.clientTitle} id="cliente-title"><Rich text={client.title} className={styles.hl} /></h2>
            <p className={styles.clientText}><Rich text={client.paragraph} className={styles.hl} /></p>
            {loading ? null : session ? (
              <Link className={styles.clientBtn} to="/novedades"><EnterIcon />{home.header.myArea}</Link>
            ) : (
              <>
                <Link className={styles.clientBtn} to="/iniciar-sesion"><EnterIcon />{client.login}</Link>
                <p className={styles.clientNote}>{client.notYet}</p>
                <CallLink className={`${styles.btn} ${styles.btnSmallOutline}`} />
              </>
            )}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <ul className={styles.footerLinks}>
            {sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`}><span><Rich text={s.label} /></span></a></li>
            ))}
          </ul>
          <p className={styles.copyright}>{footer.copyright}</p>
        </div>
      </footer>

      {/* Phones only: the call bar at the bottom of the screen (callBar.ts) */}
      <div className={`${styles.callBar} ${barShown ? styles.isShown : ''}`} ref={barRef}>
        <CallLink className={`${styles.btn} ${styles.btnPrimary} ${styles.callBarBtn}`} />
      </div>
    </div>
  )
}

/** The arrow-into-a-door icon before "Entrar" / "Mi área" */
function EnterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
