import { useLayoutEffect, useRef, type FocusEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import SessionButton from './SessionButton.tsx'
import HomeMenu from './home/HomeMenu.tsx'
import CallLink from './home/CallLink.tsx'
import { useFit } from './home/fit.ts'
import { useReveal } from './home/reveal.ts'
import { usePush } from './home/push.ts'
import { usePhases } from './home/phases.ts'
import { useStory } from './home/story.ts'
import { useCallBar } from './home/callBar.ts'
import { useAuth } from '../lib/auth.ts'
import { usePageTitle } from '../lib/usePageTitle.ts'
import heroHouse from '../assets/hero-house.jpg'
import lagoon from '../assets/lagoon.jpg'
import ejecucion from '../assets/ejecucion.jpg'
import antes from '../assets/antes.webp'
import hoy from '../assets/hoy.jpg'
import quirofano from '../assets/prueba-quirofano.webp'
import testimonioAndrea from '../assets/testimonio-andrea.webp'
import styles from './Home.module.css'

/* Home page (/), from Ivan's prototype in design-hero/ (index.html).
   Notes in design-hero/HERO-NOTES.md, rules in design-hero/DESIGN-RULES.md.
   Since 23 Nov 2026 (DECISIONS.md, "the home page sells") it also has the
   Calendly buttons, the phone's call bar, and three sections after the
   phases ("qué incluye", "evidencia real", "preguntas frecuentes"), with
   the closing slide moved to the end.

   The motion hooks (src/pages/home/) are the prototype's scripts. They run
   only while this page is open, in this order, and remove everything they
   added when it is left. */
export default function Home() {
  usePageTitle('Medical Network')

  const rootRef = useRef<HTMLDivElement>(null)
  const growRef = useRef<HTMLDivElement>(null)

  // The arrow on the first slide: scroll to the end of the circle's growing
  // distance, where "yo soy tu / ruta." is fully open (the same place a
  // scroll by hand reaches). Smooth, or a jump with reduced motion.
  function goToNextSlide(): void {
    const grow = growRef.current
    const track = grow?.parentElement
    if (!grow || !track) return
    const top = track.getBoundingClientRect().top + window.scrollY + grow.offsetHeight
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
  }

  // The early button sits in "ruta.", which is see-through until its circle
  // has opened (reveal.ts sets --o on it). If Tab reaches the button before
  // that, open the section first, so the focus never lands on something
  // you can't see.
  function showIntro(e: FocusEvent<HTMLElement>): void {
    const intro = e.currentTarget.closest<HTMLElement>('.' + CSS.escape(styles.intro))
    const o = parseFloat(intro?.style.getPropertyValue('--o') || '1')
    if (o < 0.99) goToNextSlide()
  }

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
  useCallBar(rootRef)

  return (
    <div className={styles.page} ref={rootRef}>
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

            {/* 4. an arrow at the bottom: a button to the next slide */}
            <button
              type="button"
              className={styles.heroScroll}
              aria-label="Ir a la siguiente sección"
              onClick={goToNextSlide}
            >
              <svg viewBox="0 0 24 56" aria-hidden="true" focusable="false">
                <path d="M12 1v52M3 44l9 9 9-9" />
              </svg>
            </button>
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
              {/* the early Calendly button (DECISIONS.md, 23 Nov 2026) */}
              <div className={styles.call} onFocus={showIntro}>
                <CallLink className={styles.callBtn} />
                <p className={styles.callNote}>Dura unos 30 minutos. Sin costo.</p>
              </div>
            </div>

            <figure className={styles.introMedia}>
              <img src={heroHouse} alt="" width={2000} height={1341} loading="lazy" />
            </figure>
          </section>

          {/* scroll distance spent growing the circle */}
          <div className={styles.heroTrackGrow} ref={growRef} aria-hidden="true"></div>
          {/* then a rest with "ruta." fully open, before "mi historia" comes up */}
          <div className={styles.heroTrackRest} aria-hidden="true"></div>
        </div>

        {/* Mi historia: one pinned screen. Under the head, the two layouts sit
            in the same space; as you scroll, "now" (hoy, después) slides up
            from below and covers "then" (bio, mis inicios, antes), which stays
            still underneath (story.ts). */}
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
               At the end a circle closes on them and leaves "qué incluye". */}
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

          {/* "qué incluye", first screen: pinned behind the phases (hidden until
              they fill the screen); at the end a circle closes on the phases
              and leaves it (phases.ts). Then it scrolls on normally, and the
              rest of the section follows right under it (.includes-more).
              Exactly one screen, also on a 375 x 667 phone minus the call
              bar, so "Tu plataforma MNL" (the biggest point) comes first
              in the part that scrolls. */}
          <section className={styles.includes} aria-labelledby="includes-title">
            <div className={styles.secHead}>
              <h2 className={styles.secTitle} id="includes-title">
                <span className={styles.label}>qué</span>{' '}
                <span className={styles.display}>incluye<span aria-hidden="true">.</span></span>
              </h2>
            </div>
            <div className={styles.includesLead}>
              <p className={styles.leadStrong}>Acompañamiento durante todo tu proceso.</p>
              <p>No hay una duración fija: cada homologación avanza a su propio ritmo, y el
              acompañamiento sigue el tuyo.</p>
            </div>
            <ul className={styles.points}>
              <li className={styles.point}>
                <h3 className={styles.pointTitle}>Agenda de videollamadas conmigo</h3>
                <p>Para revisar avances, objetivos y próximos pasos.</p>
              </li>
              <li className={styles.point}>
                <h3 className={styles.pointTitle}>WhatsApp directo conmigo</h3>
                <p>Para dudas y situaciones importantes.</p>
              </li>
              <li className={styles.point}>
                <h3 className={styles.pointTitle}>Acompañamiento en cada etapa</h3>
                <p>Planificación, documentación y ejecución.</p>
              </li>
            </ul>
          </section>

          {/* scroll distance spent pushing, then bringing in the phases */}
          <div className={styles.pushTrackPush} aria-hidden="true"></div>
          <div className={styles.pushTrackPhases} aria-hidden="true"></div>
          {/* extra scroll when the open phase is taller than the screen (phases.ts) */}
          <div className={styles.pushTrackMore} aria-hidden="true"></div>
          {/* scroll spent closing the circle on the phases */}
          <div className={styles.pushTrackClose} aria-hidden="true"></div>
        </div>

        {/* The rest of "qué incluye", scrolling normally: the platform (the
            biggest point), the bonuses and the price. */}
        <div className={styles.includesMore}>
          <div className={styles.platform}>
            <h3 className={styles.platformTitle}>Tu plataforma MNL</h3>
            <p>Un área privada solo para clientes: tu expediente paso a paso según
            tu <span lang="de">Bundesland</span> y tu ruta, las novedades de tu estado, la
            Comunidad MNL, el chat de tu <span lang="de">Bundesland</span>, tus documentos y la
            herramienta para tu currículum. Incluye acceso gratuito a las nuevas
            herramientas que se desarrollen.</p>
          </div>

          <div className={styles.secHead}>
            <h3 className={styles.secTitle}>
              <span className={styles.label}>bonos</span>{' '}
              <span className={styles.display}>incluidos<span aria-hidden="true">.</span></span>
            </h3>
          </div>
          <ul className={styles.bonuses}>
            <li className={styles.bonus}>
              <h4 className={styles.pointTitle}>Guía de diagnóstico</h4>
              <p>Tiempos y costos aproximados del proceso.</p>
            </li>
            <li className={styles.bonus}>
              <h4 className={styles.pointTitle}>Guía de alemán A1–B1</h4>
              <p>Ejercicios y prompts de IA.</p>
            </li>
            <li className={styles.bonus}>
              <h4 className={styles.pointTitle}>Guía de preparación FSP</h4>
              <p>Material de apoyo para preparar
              la <span lang="de">Fachsprachprüfung</span>.</p>
            </li>
            <li className={styles.bonus}>
              <h4 className={styles.pointTitle}>Cooperaciones</h4>
              <p>Curso de preparación FSP online desde tu país con perfectgerman, con
              50 % de descuento, y posibilidad de una beca BAMF para un curso de
              preparación FSP al estar en Alemania.</p>
            </li>
          </ul>
          <p className={styles.includesTotal}>Todo incluido: pago único 3.500&nbsp;€.</p>
        </div>

        {/* Evidencia real: the owner's own process, and Andrea's words with
            her WhatsApp screenshot (her consent: DECISIONS.md, 23 Nov 2026).
            Photos sit in frames that always fit on the screen. */}
        <section className={styles.proof} aria-labelledby="proof-title">
          <div className={styles.secHead}>
            <h2 className={styles.secTitle} id="proof-title">
              <span className={styles.label}>evidencia</span>{' '}
              <span className={styles.display}>real<span aria-hidden="true">.</span></span>
            </h2>
          </div>

          <div className={styles.proofRow}>
            <div className={styles.proofText}>
              <h3 className={styles.pointTitle}>Mi propio proceso de homologación</h3>
              <p>De mi llegada en 2015 a la <span lang="de">Approbation</span> en 2017, y después
              la especialidad.</p>
            </div>
            <figure className={styles.proofPhoto}>
              <img
                src={quirofano}
                alt="Iván con colegas en un quirófano"
                width={1440}
                height={960}
                loading="lazy"
              />
            </figure>
          </div>

          <div className={`${styles.proofRow} ${styles.testimony}`}>
            <figure className={styles.proofText}>
              <p className={styles.label}>testimonio</p>
              <blockquote className={styles.quote}>
                <p>Lo que más me ha ayudado hasta el momento es que puedo resolver mis
                dudas al momento ya que la comunicación a través de WhatsApp es rápida y
                eficaz y me siento confiada en qué estoy dando los pasos correctos.</p>
                <p>He logrado entender que se necesita mucha paciencia en el camino, que
                la burocracia alemana puede llegar a ser tediosa o frustrante para quienes
                somos nuevos. Que se puede avanzar solo pero también te puedes
                equivocar..</p>
                <p>Le recomendaría la asesoría con Iván a todos los médicos latinos que ya
                están seguros de querer venir a Alemania, para que no se equivoquen en el
                camino.</p>
              </blockquote>
              <figcaption className={styles.quoteName}>Andrea</figcaption>
            </figure>
            <div className={styles.shot}>
              <img
                src={testimonioAndrea}
                alt="Captura del mensaje de WhatsApp de Andrea"
                width={720}
                height={1410}
                loading="lazy"
              />
            </div>
          </div>
        </section>

        {/* Preguntas frecuentes: the browser's own open/close rows
            (<details>), closed at first; Tab, Enter and Space work without
            any script. The owner's texts, word for word. */}
        <section className={styles.faq} aria-labelledby="faq-title">
          <div className={styles.secHead}>
            <h2 className={styles.secTitle} id="faq-title">
              <span className={styles.label}>preguntas</span>{' '}
              <span className={styles.display}>frecuentes<span aria-hidden="true">.</span></span>
            </h2>
          </div>
          <div className={styles.faqList}>
            <Faq q="¿Haces el proceso de homologación por mí?">
              No. Ruta <span lang="de">Approbation</span> te enseña cómo hacerlo y te acompaña
              mientras avanzas. Las acciones las ejecutas tú, con un plan claro y criterio
              para cada decisión.
            </Faq>
            <Faq q="¿Cuánto dura el programa?">
              No tiene una duración fija. El acompañamiento dura lo que dure tu proceso de
              homologación, que puede variar considerablemente según cada caso.
            </Faq>
            <Faq q="¿Me garantizas la homologación o un tiempo determinado?">
              No. Nadie puede garantizar con honestidad el resultado ni los tiempos: dependen
              de tu caso, de las autoridades y de tu ejecución. Lo que sí obtienes es un plan
              claro para reducir errores y evitar tiempos innecesarios.
            </Faq>
            <Faq q="¿Cómo es el acompañamiento?">
              Agenda de videollamadas conmigo y comunicación directa por WhatsApp para dudas
              y situaciones importantes, durante las diferentes etapas del proceso.
            </Faq>
            <Faq q="¿Qué necesito para aplicar?">
              Ser médico graduado y habilitado para ejercer tu profesión, y estar dispuesto a
              trabajar por tus objetivos, ejecutar las tareas y participar activamente.
            </Faq>
            <Faq q="¿Qué métodos de pago aceptas?">
              Tarjeta de crédito, PayPal, Apple Pay, Google Pay, Amazon Pay y Klarna. El
              precio es de 3.500&nbsp;€, pago único.
            </Faq>
            {/* Ivan's choice (23 Nov 2026), for the law firm to check. No link:
                the Widerrufsbelehrung doesn't exist on the site yet. */}
            <Faq q="¿Tengo derecho de desistimiento?">
              Tienes un derecho de desistimiento de 14 días según §§ 312g, 355 BGB
              (<span lang="de">Widerrufsrecht</span>). Los detalles están en
              la <span lang="de">Widerrufsbelehrung</span>. Esto no es una garantía de
              resultado.
            </Faq>
          </div>
        </section>

        {/* Closing call to action, in the heroes' font: light background, dark
            letters. The headline is justified by fit.ts like the heroes. The
            last section of the page (since 23 Nov 2026 no longer pinned
            behind the phases); the phone's call bar hides while it is on
            screen (callBar.ts). */}
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
            <div className={styles.call}>
              <CallLink className={styles.callBtn} />
              <p className={styles.callNote}>Dura unos 30 minutos. Sin costo.</p>
            </div>
            <p className={styles.ctaSign}>Nos vemos en Alemania</p>
          </div>
        </section>
      </main>

      {/* Phones only: the call bar at the bottom of the screen. Hidden until
          callBar.ts shows it (never without the motion script). */}
      <div className={styles.callBar}>
        <CallLink className={`${styles.callBtn} ${styles.callBarBtn}`} />
      </div>
    </div>
  )
}

/** One question of "preguntas frecuentes": a native open/close row. */
function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className={styles.faqItem}>
      <summary className={styles.faqQ}>
        <span>{q}</span>
        <span className={styles.faqSign} aria-hidden="true"></span>
      </summary>
      <p className={styles.faqA}>{children}</p>
    </details>
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
