import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import SessionButton from './SessionButton.tsx'
import HomeMenu from './home/HomeMenu.tsx'
import { useFit } from './home/fit.ts'
import { useReveal } from './home/reveal.ts'
import { usePush } from './home/push.ts'
import { usePhases } from './home/phases.ts'
import { useStory } from './home/story.ts'
import { useAuth } from '../lib/auth.ts'
import { usePageTitle } from '../lib/usePageTitle.ts'
import heroHouse from '../assets/hero-house.jpg'
import lagoon from '../assets/lagoon.jpg'
import ejecucion from '../assets/ejecucion.jpg'
import antes from '../assets/antes.webp'
import hoy from '../assets/hoy.jpg'
import styles from './Home.module.css'

/* Home page (/), from Ivan's prototype in design-hero/ (index.html).
   Same text, same order, same scroll motion; notes in
   design-hero/HERO-NOTES.md, rules in design-hero/DESIGN-RULES.md.

   The motion hooks (src/pages/home/) are the prototype's scripts. They run
   only while this page is open, in this order, and remove everything they
   added when it is left. */
export default function Home() {
  usePageTitle('Medical Network')

  const rootRef = useRef<HTMLDivElement>(null)

  // The page's own background, colour and font on <body>, only while it is open
  useLayoutEffect(() => {
    document.body.classList.add(styles.pageBody)
    return () => document.body.classList.remove(styles.pageBody)
  }, [])

  useFit(rootRef)
  useReveal(rootRef)
  usePush(rootRef)
  usePhases(rootRef)
  useStory(rootRef)

  return (
    <div ref={rootRef}>
      <HomeHeader />

      <main>
        {/* The track is taller than the screen. While you scroll through it the
            hero and the next section both stay pinned, and a growing circle
            reveals the next section on top of the hero (reveal.ts). */}
        <div className={styles.heroTrack}>
          <section className={styles.hero} aria-label="Portada">
            <div className={styles.heroStage}>
              {/* 1. the words in ink, underneath everything */}
              <h1 className={styles.heroWords}>
                <Line>La burocracia</Line>
                <Line>alemana</Line>
                <Line>es un laberinto</Line>
              </h1>

              {/* 2. the photo (later: the video) sits on top of the words */}
              <figure className={styles.heroMedia}>
                <img src={heroHouse} alt="" width={2000} height={1341} />
              </figure>

              {/* 3. the same words again, tinted, cut to the photo's box */}
              <div className={`${styles.heroWords} ${styles.heroWordsOver}`} aria-hidden="true">
                <Line>La burocracia</Line>
                <Line>alemana</Line>
                <Line>es un laberinto</Line>
              </div>
            </div>

            {/* 4. an arrow at the bottom: scroll down (decoration only) */}
            <svg className={styles.heroScroll} viewBox="0 0 24 56" aria-hidden="true" focusable="false">
              <path d="M12 1v52M3 44l9 9 9-9" />
            </svg>
          </section>

          {/* Revealed through the circle (reveal.ts), then scrolls on normally. */}
          <section className={styles.intro} aria-labelledby="intro-title">
            <div className={styles.introHead}>
              <p className={styles.introEyebrow}>yo soy tu</p>
              <h2 className={styles.introTitle} id="intro-title">ruta.</h2>
            </div>

            <div className={styles.introText}>
              <div className={styles.introCopy}>
                <p>Un camino claro para médicos hispanohablantes que quieren homologar
                su título y ejercer medicina en Alemania.</p>
                <p>Aprende qué hacer, en qué orden y cuáles son tus objetivos durante
                el proceso, con acompañamiento directo mientras avanzas.</p>
              </div>
            </div>

            <figure className={styles.introMedia}>
              <img src={heroHouse} alt="" width={2000} height={1341} loading="lazy" />
            </figure>
          </section>

          {/* scroll distance spent growing the circle */}
          <div className={styles.heroTrackGrow} aria-hidden="true"></div>
          {/* then a rest with "ruta." fully open, before "mi historia" comes up */}
          <div className={styles.heroTrackRest} aria-hidden="true"></div>
        </div>

        {/* Mi historia: one pinned screen. Under the head, the two layouts sit
            in the same space; as you scroll, "now" (hoy, después) fades in on
            top of "then" (bio, mis inicios, antes), from a faint blur to fully
            clear (story.ts). */}
        <section className={styles.story} aria-labelledby="story-title">
          <div className={styles.storyPin}>
            <div className={styles.storyHead}>
              <p className={styles.label}>mi</p>
              <h2 className={styles.display} id="story-title">historia.</h2>
            </div>

            <div className={styles.storyStack}>
              <div className={`${styles.storyBody} ${styles.storyBodyThen}`}>
                <div className={styles.storyBio}>
                  <p>Soy Iván Bruckner Calahorrano, médico ecuatoriano. Me gradué en 2015
                  y ese mismo año llegué a Alemania. En 2017 obtuve la <span lang="de">Approbation</span>, hice
                  mi especialidad y hoy trabajo como especialista en un hospital
                  alemán.</p>
                </div>

                <figure className={styles.storyPhoto}>
                  <div className={styles.storyFrame}>
                    <img
                      className={styles.photoAntes}
                      src={antes}
                      alt="Iván de joven, con una camiseta de rayas verdes"
                      width={914}
                      height={816}
                      loading="lazy"
                    />
                  </div>
                  <figcaption>Mis inicios</figcaption>
                </figure>

                <div className={`${styles.storyShift} ${styles.storyShiftThen}`}>
                  <p className={styles.label}>antes</p>
                  <p>No tenía idea por dónde empezar ni qué hacer.</p>
                </div>
              </div>

              <div className={`${styles.storyBody} ${styles.storyBodyNow}`}>
                <figure className={styles.storyPhoto}>
                  <div className={styles.storyFrame}>
                    <img
                      src={hoy}
                      alt="Iván hoy, en quirófano con gorro y mascarilla"
                      width={564}
                      height={776}
                      loading="lazy"
                    />
                  </div>
                  <figcaption>Hoy, especialista</figcaption>
                </figure>

                <div className={`${styles.storyShift} ${styles.storyShiftNow}`}>
                  <p className={styles.label}>después</p>
                  <p>Estructuré un plan claro para enfrentar la burocracia alemana y
                  completar la homologación.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Second hero and the phases, pinned while you scroll through the
            spacers at the end.
            1. push.ts: the first sentence starts alone in the middle; the second
               rises from below and pushes it up until they sit together.
            2. phases.ts: the phases' cells rise from below one at a time and
               settle in place over the hero: the title cell, then phase 01, 02
               and 03. Each new phase takes the focus; the earlier ones shrink.
               At the end a circle closes on them and leaves the closing slide. */}
        <div className={styles.pushTrack}>
          <section
            className={`${styles.hero} ${styles.heroTwo}`}
            aria-label="Yo también empecé confundido. Por eso creé la Ruta Approbation"
          >
            <div className={`${styles.heroStage} ${styles.heroStageA}`} data-fit-h="0.5">
              <h2 className={styles.heroWords}>
                <Line>Yo también</Line>
                <Line>empecé confundido</Line>
              </h2>
            </div>
            <div className={`${styles.heroStage} ${styles.heroStageB}`} data-fit-h="0.5">
              <p className={styles.heroWords}>
                <Line>Por eso creé</Line>
                <Line>la Ruta <span lang="de">Approbation</span></Line>
              </p>
            </div>
          </section>

          {/* The three phases: one row per phase, cells split by thin lines. */}
          <section className={styles.phases} aria-labelledby="phases-title">
            <div className={styles.phasesHead}>
              <p className={styles.label}>las 3</p>
              <h2 className={styles.display} id="phases-title">fases.</h2>
            </div>

            {/* Each phase: number | title + intro | checklist + resultado | photo */}
            <ol className={styles.phasesList}>
              <li className={styles.phase}>
                <span className={styles.phaseNum}>01</span>
                <div className={styles.phaseMain}>
                  <h3 className={styles.phaseTitle}>planificación</h3>
                  <p className={styles.phaseIntro}>Empezamos por lo importante: tu objetivo. Defino
                  contigo la ruta exacta que debes seguir y el orden de cada paso, para que
                  dejes de adivinar. Tú decides tus prioridades, incluso cómo vas a
                  aprender alemán.</p>
                </div>
                <div className={styles.phaseDetail}>
                  <div className={styles.phaseResult}>
                    <p className={styles.label}>resultado</p>
                    <p>Sabes exactamente por dónde empezar y cuál es tu siguiente paso.</p>
                  </div>
                </div>
                <figure className={styles.phaseMedia}>
                  <img src={lagoon} alt="" width={1600} height={1081} loading="lazy" />
                </figure>
              </li>
              <li className={styles.phase}>
                <span className={styles.phaseNum}>02</span>
                <div className={styles.phaseMain}>
                  <h3 className={styles.phaseTitle}>documentación</h3>
                  <p className={styles.phaseIntro}>Tú reúnes tus documentos, pero no vas a ciegas: yo
                  te digo exactamente cuáles necesitas y los reviso contigo antes de
                  seguir. Mientras tanto, trabajamos en paralelo en:</p>
                </div>
                <div className={styles.phaseDetail}>
                  <ul className={styles.phaseItems}>
                    <li>Aprender alemán</li>
                    <li>Elegir tu escuela de idiomas, con mi ayuda</li>
                    <li>Planificar tu estadía en Alemania, con mi ayuda</li>
                    <li>Preparar juntos los siguientes pasos</li>
                  </ul>
                  <div className={styles.phaseResult}>
                    <p className={styles.label}>resultado</p>
                    <p>Dejamos tu documentación lista y en regla, sin meses de espera
                    innecesarios, y te acompañamos en cada paso de tu llegada.</p>
                  </div>
                </div>
                <figure className={styles.phaseMedia}>
                  <img src={heroHouse} alt="" width={2000} height={1341} loading="lazy" />
                </figure>
              </li>
              <li className={styles.phase}>
                <span className={styles.phaseNum}>03</span>
                <div className={styles.phaseMain}>
                  <h3 className={styles.phaseTitle}>ejecución</h3>
                  <p className={styles.phaseIntro}>Ya en Alemania, tú ejecutas cada paso y yo estoy a
                  tu lado para que no te frenes ni te pierdas:</p>
                </div>
                <div className={styles.phaseDetail}>
                  <ul className={styles.phaseItems}>
                    <li>Hacer un curso intensivo de alemán</li>
                    <li>Presentar tu solicitud de homologación, con mi guía</li>
                    <li>Conseguir <span lang="de">Hospitationen</span>, cuando sea posible, con mi ayuda</li>
                    <li>Valorar un posible <span lang="de">Nebenjob</span> para cubrir parte de tus gastos, según tu situación</li>
                  </ul>
                  <div className={styles.phaseResult}>
                    <p className={styles.label}>resultado</p>
                    <p>Das cada paso con un plan claro y yo te acompaño hasta tu
                    homologación.</p>
                  </div>
                </div>
                <figure className={styles.phaseMedia}>
                  <img
                    className={styles.photoEjecucion}
                    src={ejecucion}
                    alt=""
                    width={858}
                    height={929}
                    loading="lazy"
                  />
                </figure>
              </li>
            </ol>
          </section>

          {/* Closing call to action, in the heroes' font: light background, dark
              letters. The headline is justified by fit.ts like the heroes. It is
              pinned behind the phases (hidden until they fill the screen); at the
              end a circle closes on the phases and leaves it (phases.ts). */}
          <section className={styles.cta} aria-labelledby="cta-title">
            <div className={styles.ctaInner}>
              <div className={styles.heroStage} data-fit-h="0.55">
                <h2 className={styles.heroWords} id="cta-title">
                  <Line>Tu homologación</Line>
                  <Line>necesita</Line>
                  <Line>una ruta</Line>
                </h2>
              </div>
              <p className={styles.ctaPrice}>Pago único 3.500 €</p>
              <a
                className={styles.ctaBtn}
                href="https://calendly.com/ivan-ab89/ruta-approbation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Quiero empezar la Ruta <span lang="de">Approbation</span>
              </a>
              <p className={styles.ctaSign}>Nos vemos en Alemania</p>
            </div>
          </section>

          {/* scroll distance spent pushing, then bringing in the phases */}
          <div className={styles.pushTrackPush} aria-hidden="true"></div>
          <div className={styles.pushTrackPhases} aria-hidden="true"></div>
          {/* extra scroll when the open phase is taller than the screen (phases.ts) */}
          <div className={styles.pushTrackMore} aria-hidden="true"></div>
          {/* scroll spent closing the circle on the phases */}
          <div className={styles.pushTrackClose} aria-hidden="true"></div>
        </div>
      </main>
    </div>
  )
}

/** One line of a justified headline. fit.ts sizes it and places the inner
    span on the letters' ink. */
function Line({ children }: { children: ReactNode }) {
  return (
    <span className={styles.line}>
      <span className={styles.lineInk}>{children}</span>
    </span>
  )
}

/** Fixed header: "Mi área" (logged in only), "Entrar" / "Cerrar sesión",
    and "Menú" (HomeMenu.tsx). Its own component, so a login
    change redraws only the header, never the page under the motion hooks. */
function HomeHeader() {
  const { session, loading } = useAuth()
  return (
    <header className={styles.siteHeader}>
      <div className={styles.headerActions}>
        {!loading && session ? (
          <Link className={styles.chip} to="/novedades">Mi área</Link>
        ) : null}
        <SessionButton />
      </div>
      <HomeMenu />
    </header>
  )
}
