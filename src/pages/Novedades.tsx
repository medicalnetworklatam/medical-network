import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import MenuIcon from './MenuIcon.tsx'
import SessionButton from './SessionButton.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { loadChosenStates, type SavedState } from '../lib/savedStates.ts'
import edificio from '../assets/edificio.jpg'
import styles from './Novedades.module.css'

/* Shown under "Tus estados" until states are chosen on the map */
const SAMPLE_STATES: SavedState[] = [
  { id: 'be', name: 'Berlin' },
  { id: 'by', name: 'Bayern' },
  { id: 'nw', name: 'Nordrhein-Westfalen' },
  { id: 'hh', name: 'Hamburg' },
]

const CloseIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
const ChatIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />
  </svg>
)

/** A state's page: "Tus estados", news cards, and calendar and chat as
    previews only (from design-mockup/novedades.html) */
export default function Novedades() {
  /* Tus estados: the states chosen on the map, saved in this browser
     (an empty list = "No lo sé"). With no saved choice the sample list stays. */
  const [saved] = useState(loadChosenStates)
  const states = saved ?? SAMPLE_STATES
  /* Coming from the map: open on the first state that was picked */
  const [current, setCurrent] = useState<SavedState | null>(
    saved === null ? SAMPLE_STATES[0] : saved[0] ?? null,
  )
  const name = current?.name ?? 'Berlin'
  usePageTitle(name + ' · Medical Network')

  /* Sidebar collapse / expand (starts collapsed on a phone) */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.matchMedia('(max-width: 700px)').matches,
  )

  /* Phone: floating button opens the chat full screen, ✕ / Escape closes it */
  const [chatOpen, setChatOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const chatCloseRef = useRef<HTMLButtonElement>(null)
  const chatOpenChanged = useRef(false)

  function openChat(open: boolean) {
    chatOpenChanged.current = true
    setChatOpen(open)
  }
  useEffect(() => {
    document.body.classList.toggle('chat-open', chatOpen)
    if (chatOpenChanged.current) {
      if (chatOpen) chatCloseRef.current?.focus(); else fabRef.current?.focus()
    }
    if (!chatOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') openChat(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [chatOpen])
  useEffect(() => () => document.body.classList.remove('chat-open'), [])

  /* Desktop: ✕ slides the chat out to the right, the chat icon brings it back */
  const [chatCollapsed, setChatCollapsed] = useState(false)

  /* Chat preview: Enter adds a sent bubble (nothing is sent or saved) */
  const [sent, setSent] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)
  function onSend(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setSent((list) => [...list, text])
    setDraft('')
  }
  useEffect(() => {
    const box = messagesRef.current
    if (box && sent.length) box.scrollTop = box.scrollHeight
  }, [sent])

  return (
    <>
      <div className={styles.layout}>

        {/* Left: sidebar */}
        <nav className={styles.sidebar + (sidebarCollapsed ? ' ' + styles.isCollapsed : '')} aria-label="Estados">
          <div className={styles.sidebarHeader}>
            <div className={styles.profile}>
              <button type="button" className={styles.profileBtn} aria-label="Perfil">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-3.9 3.6-6 8-6s8 2.1 8 6" />
                </svg>
              </button>
              <span className={styles.profileName}>Pepe</span>
            </div>
            <button
              type="button" className={styles.sidebarToggle}
              aria-expanded={!sidebarCollapsed} aria-controls="sidebar-body"
              aria-label={sidebarCollapsed ? 'Mostrar columna' : 'Ocultar columna'}
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              <MenuIcon />
            </button>
          </div>

          <div className={styles.sidebarBody} id="sidebar-body">
            <div className={styles.sectionHead}>
              <h2>Tus estados</h2>
            </div>

            <ul className={styles.states}>
              {states.length === 0 && (
                <li className={styles.statesEmpty}>
                  <p>Todavía no has elegido estados.</p>
                  <Link to="/estados">Elegir estados</Link>
                </li>
              )}
              {states.map((st) => (
                <li key={st.id}>
                  <a
                    className={styles.stateLink} href={'#' + st.id} lang="de"
                    aria-current={current?.id === st.id ? 'page' : undefined}
                    onClick={(e) => { e.preventDefault(); setCurrent(st) }}
                  >
                    {st.name}
                  </a>
                </li>
              ))}
            </ul>

            {/* Calendar: preview only */}
            <section className={styles.calendar} aria-labelledby="cal-heading">
              <div className={styles.sectionHead}>
                <h2 id="cal-heading">Calendario</h2>
              </div>
              <div className={styles.calCard}>
                <p className={styles.calTitle}>Noviembre 2026</p>
                <div className={styles.calWeekdays}>
                  <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
                </div>
                <div className={styles.calDays}>
                  <span></span><span></span><span></span><span></span><span></span><span></span>
                  <span>1</span>
                  <span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span>
                  <span>9</span><span>10</span><span>11</span><span className={styles.today} aria-current="date">12</span><span>13</span><span>14</span><span className={styles.event}>15</span>
                  <span>16</span><span>17</span><span>18</span><span>19</span><span>20</span><span>21</span><span>22</span>
                  <span>23</span><span>24</span><span>25</span><span>26</span><span>27</span><span>28</span><span>29</span>
                  <span>30</span>
                </div>
              </div>
            </section>

            <SessionButton onGreen />
          </div>
        </nav>

        <div className={styles.workspace}>

          {/* Middle: main content */}
          <main className={styles.main}>
            <h1 className={styles.pageTitle}>{name.toUpperCase()}</h1>

            {/* Example news and updates (made up for the mock-up) */}
            <article className={styles.card}>
              <img className={styles.cardImg} src={edificio} width="1200" height="805"
                   alt="Edificio blanco de formas curvas bajo un cielo azul" />
              <p className={styles.cardMeta}>
                <span className={styles.cardTag}>Noticia</span>
                <time className={styles.cardDate} dateTime="2026-11-12">12 nov 2026</time>
              </p>
              <h3>Berlin amplía las fechas para la Kenntnisprüfung</h3>
              <p className={styles.cardText}>La autoridad sanitaria de Berlin (LAGeSo) abrirá más fechas de examen a partir de enero para reducir la espera. Si ya enviaste tu solicitud, recibirás la nueva fecha por correo: no hace falta volver a presentar los documentos.</p>
            </article>

            <article className={styles.card}>
              <p className={styles.cardMeta}>
                <span className={styles.cardTag}>Documento actualizado</span>
                <time className={styles.cardDate} dateTime="2026-11-09">9 nov 2026</time>
              </p>
              <h3>Nuevo formulario de solicitud de la Approbation</h3>
              <p className={styles.cardText}>Desde el 1 de diciembre solo se acepta la versión 2026 del formulario. Cambian la sección de experiencia profesional y la lista de documentos que necesitan traducción jurada.</p>
            </article>

            <article className={styles.card}>
              <p className={styles.cardMeta}>
                <span className={styles.cardTag}>Plazo</span>
                <time className={styles.cardDate} dateTime="2026-11-05">5 nov 2026</time>
              </p>
              <h3>Seguro de responsabilidad profesional: renuévalo antes del 31 de diciembre</h3>
              <p className={styles.cardText}>La Ärztekammer pide el certificado actualizado de tu Berufshaftpflicht para mantener activo tu registro. Puedes subirlo en el portal de miembros en pocos minutos.</p>
            </article>

            <article className={styles.card}>
              <img className={styles.cardImg + ' ' + styles.wide} src={edificio} width="1200" height="805" loading="lazy"
                   alt="Fachada blanca con una fila de ventanas cuadradas" />
              <p className={styles.cardMeta}>
                <span className={styles.cardTag + ' ' + styles.event}>Evento</span>
                <time className={styles.cardDate} dateTime="2026-11-15T18:00">Domingo 15 nov · 18:00</time>
              </p>
              <h3>Sesión online: tu primer año como médico en Alemania</h3>
              <p className={styles.cardText}>Contrato, guardias, impuestos y seguro social, explicados en español por médicos que ya pasaron por ello. Gratis y con tiempo para preguntas al final.</p>
            </article>

            <article className={styles.card}>
              <p className={styles.cardMeta}>
                <span className={styles.cardTag}>Guía</span>
                <time className={styles.cardDate} dateTime="2026-10-28">28 oct 2026</time>
              </p>
              <h3>Fachsprachprüfung: qué esperar el día del examen</h3>
              <p className={styles.cardText}>Paso a paso: la conversación con el paciente, el informe escrito y la presentación del caso a un colega. Incluye frases útiles en alemán para cada parte.</p>
            </article>
          </main>

          {/* Right: chat (preview only) */}
          <aside
            id="chat"
            className={styles.chat + (chatOpen ? ' ' + styles.isOpen : '') + (chatCollapsed ? ' ' + styles.isCollapsed : '')}
            aria-label={'Chat ' + name}
          >
            <div className={styles.chatHead}>
              {/* Desktop only: hides / shows the chat */}
              <button
                type="button" className={styles.chatToggle}
                aria-expanded={!chatCollapsed} aria-controls="messages"
                aria-label={chatCollapsed ? 'Mostrar chat' : 'Ocultar chat'}
                onClick={() => setChatCollapsed((c) => !c)}
              >
                <CloseIcon className={styles.iconClose} />
                <ChatIcon className={styles.iconOpen} />
              </button>
              <h2>Chat <span className={styles.chatName}>{name}</span></h2>
              <button type="button" className={styles.chatClose} ref={chatCloseRef} aria-label="Cerrar chat" onClick={() => openChat(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className={styles.messages} id="messages" role="log" ref={messagesRef}>
              <p className={styles.msg + ' ' + styles.sent}>[Mensaje enviado]</p>
              <p className={styles.msg}>[Mensaje recibido]</p>
              <p className={styles.msg}>[Mensaje recibido más largo, en varias líneas]</p>
              <p className={styles.msg}>[Mensaje recibido]</p>
              <p className={styles.msg + ' ' + styles.sent}>[Mensaje enviado]</p>
              {sent.map((text, i) => (
                <p key={i} className={styles.msg + ' ' + styles.sent}>{text}</p>
              ))}
            </div>

            <form className={styles.chatForm} autoComplete="off" onSubmit={onSend}>
              <label className="sr-only" htmlFor="chat-input">Escribe un mensaje</label>
              <input
                className={styles.chatInput} id="chat-input" type="text" placeholder="Escribe un mensaje"
                value={draft} onChange={(e) => setDraft(e.target.value)}
              />
            </form>
          </aside>

        </div>
      </div>

      {/* Phone only: opens the chat full screen */}
      <button
        type="button" className={styles.chatFab} ref={fabRef}
        aria-controls="chat" aria-expanded={chatOpen}
        onClick={() => openChat(true)}
      >
        <ChatIcon />
        <span className={styles.chatFabLabel}>{'Chat ' + name}</span>
      </button>
    </>
  )
}
