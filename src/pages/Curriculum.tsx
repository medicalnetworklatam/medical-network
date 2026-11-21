import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router'
import AreaLayout from './AreaLayout.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { useAuth } from '../lib/auth.ts'
import { useProfile } from '../lib/profile.ts'
import {
  TIPOS, analiza, cvText, deNum, emptyCv, hoyNum, loadCv, meses, newPeriod, removeCv, saveCv,
  type CartaKey, type CvData, type CvPeriod, type DatoKey,
} from '../lib/curriculum.ts'
import board from './Comunidad.module.css'
import news from './Novedades.module.css'
import styles from './Curriculum.module.css'

/** The CV and cover letter tool (/curriculum), opened from Mi expediente.
    The owner's original tool (design-reference/curriculum-original.html),
    ported with the same fields, gap check and produced text. The only
    wording change: the developer's first name in the original became
    "el equipo MNL" (DECISIONS.md, 20 Nov 2026).

    Paid clients and admins use it; free accounts see a short message (a
    website check is enough: nothing is stored in the database). The draft
    is saved only in this browser, under a key with the user's ID
    (src/lib/curriculum.ts), and never sent anywhere. The client copies the
    produced text and sends it by WhatsApp themselves. */
export default function Curriculum() {
  usePageTitle('Mi currículum · Medical Network')
  const { session } = useAuth()
  const { profile } = useProfile()
  const userId = session?.user.id ?? null
  const canUse = profile?.plan === 'paid' || profile?.is_admin === true

  /* The title's size comes from its longest word ("alemania." = 9), set
     from code (React's style prop): the site's CSP blocks style="..." */
  const titleStyle = { '--title-chars': 9 } as CSSProperties

  return (
    <AreaLayout current="curriculum">
      <main className={board.main}>
        <div className={news.back}>
          <Link className={news.backLink} to="/expediente">
            <span aria-hidden="true">←{' '}</span>Mi expediente
          </Link>
        </div>

        <div className={board.head}>
          <h1 className={styles.title} style={titleStyle}>
            <span className={board.label}>Mi currículum</span>{' '}
            <span className={board.pageTitle}>para Alemania<span aria-hidden="true">.</span></span>
          </h1>
        </div>

        {canUse && userId ? (
          /* key: another account on this device starts with its own draft */
          <CvForm key={userId} userId={userId} />
        ) : (
          <p className={board.message}>
            El formulario del currículum es para miembros con el paquete completo.
          </p>
        )}
      </main>
    </AreaLayout>
  )
}

/** A period on screen: the saved fields plus an ID for React only (so the
    list doesn't mix up fields when one is removed). Never saved, never in
    the text. */
type Row = CvPeriod & { id: string }

/** Paso 1's fields: key, label, placeholder, input type */
const DATOS: ReadonlyArray<readonly [DatoKey, string, string, 'text' | 'email']> = [
  ['nombre', 'Nombre y apellidos completos', 'Como aparece en tu pasaporte', 'text'],
  ['nac', 'Fecha de nacimiento', 'DD/MM/AAAA', 'text'],
  ['lugar', 'Lugar y país de nacimiento', 'Quito, Ecuador', 'text'],
  ['nacion', 'Nacionalidad', 'Ecuatoriana', 'text'],
  ['dir', 'Dirección actual', 'Calle, número, ciudad, país', 'text'],
  ['mail', 'Correo electrónico', 'tucorreo@ejemplo.com', 'email'],
  ['tel', 'Teléfono', 'Con el código del país', 'text'],
]

/** Paso 3's six questions: key, question, placeholder */
const PREGUNTAS: ReadonlyArray<readonly [CartaKey, string, string]> = [
  ['c1', '1 · ¿Por qué estudiaste medicina?', 'Sin adornos. Lo que te llevó a esta profesión.'],
  ['c2', '2 · ¿Por qué Alemania y no otro país?', 'Qué buscas allá que no encuentras donde estás.'],
  ['c3', '3 · ¿Qué especialidad quieres hacer y por qué?', 'Si aún no lo decides, dilo también.'],
  ['c4', '4 · ¿Qué sabes hacer con tus manos?', 'Procedimientos, técnicas, guardias, urgencias, quirófano. Sé concreto: cuántas veces, en qué contexto.'],
  ['c5', '5 · ¿Qué buscas en el puesto y qué puedes aportar tú?', 'Qué tipo de hospital o servicio te interesa, y qué ganan ellos contigo.'],
  ['c6', '6 · ¿Desde cuándo podrías empezar y qué nivel de alemán tienes hoy?', 'Fecha aproximada, nivel actual y qué certificado tienes o estás preparando.'],
]

const COPIED = 'Copiado — pégaselo al equipo MNL por WhatsApp'
const COPY_BY_HAND = 'Selecciona el texto y cópialo a mano'

function withIds(per: CvPeriod[]): Row[] {
  return per.map((p) => ({ ...p, id: crypto.randomUUID() }))
}
/** What is saved: the original's shape, without the React-only IDs */
function toData(d: CvData['d'], rows: Row[], c: CvData['c']): CvData {
  return { d, per: rows.map(({ id: _id, ...p }) => p), c }
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function CvForm({ userId }: { userId: string }) {
  /* The saved draft, read once when the page opens */
  const [initial] = useState(() => loadCv(userId))
  const [datos, setDatos] = useState(initial.d)
  const [rows, setRows] = useState<Row[]>(() => withIds(initial.per))
  const [carta, setCarta] = useState(initial.c)

  /* "Guardado en este dispositivo", shown for 2 seconds after a save */
  const [savedNote, setSavedNote] = useState('')
  /* the copy message next to "Preparar mi texto…" */
  const [copyNote, setCopyNote] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  /* The newest values, for the delayed save */
  const latest = useRef(toData(initial.d, withIds(initial.per), initial.c))
  useLayoutEffect(() => {
    latest.current = toData(datos, rows, carta)
  }, [datos, rows, carta])
  const saveTimer = useRef<number | undefined>(undefined)
  const noteTimer = useRef<number | undefined>(undefined)

  const outBoxRef = useRef<HTMLDivElement>(null)
  const outRef = useRef<HTMLTextAreaElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const clearRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  function save(data: CvData) {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = undefined
    if (!saveCv(userId, data)) return
    setSavedNote('Guardado en este dispositivo')
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setSavedNote(''), 2000)
  }

  /* Leaving the page: save what is still waiting, then stop the timers */
  useEffect(() => () => {
    if (saveTimer.current !== undefined) saveCv(userId, latest.current)
    window.clearTimeout(saveTimer.current)
    window.clearTimeout(noteTimer.current)
  }, [userId])

  /* Paso 1 and Paso 3: saved half a second after the last key press, as
     in the original */
  function saveSoon() {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => save(latest.current), 500)
  }
  function setDato(k: DatoKey, v: string) {
    setDatos((d) => ({ ...d, [k]: v }))
    saveSoon()
  }
  function setRespuesta(k: CartaKey, v: string) {
    setCarta((c) => ({ ...c, [k]: v }))
    saveSoon()
  }

  /* Paso 2: saved at once, as in the original */
  function changeRows(next: Row[]) {
    setRows(next)
    save(toData(datos, next, carta))
  }
  function addPeriod() {
    changeRows([...rows, { ...newPeriod(), id: crypto.randomUUID() }])
  }
  function removePeriod(id: string) {
    changeRows(rows.filter((r) => r.id !== id))
    addRef.current?.focus() // the pressed button is gone
  }
  function setField(id: string, k: keyof CvPeriod, v: string) {
    changeRows(rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  }

  /* Copy as the original does: select the text, then the clipboard, or
     the older copy command; if both fail, the text is still on screen */
  function copy() {
    const area = outRef.current
    if (!area) return
    area.focus()
    area.select()
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(area.value).then(
          () => setCopyNote(COPIED),
          () => setCopyNote(COPY_BY_HAND),
        )
        return
      }
      const ok = document.execCommand && document.execCommand('copy')
      setCopyNote(ok ? COPIED : COPY_BY_HAND)
    } catch {
      setCopyNote(COPY_BY_HAND)
    }
  }

  function prepare() {
    /* draw the text box at once, so it can be selected and copied while
       the button press still counts (browsers allow copying only then) */
    flushSync(() => setOutput(cvText(latest.current, hoyNum())))
    copy()
    outBoxRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' })
  }
  function closeOutput() {
    setOutput(null)
    setCopyNote('')
  }

  /* "Borrar todo y empezar de nuevo": asked inside the page */
  const moved = useRef(false)
  useEffect(() => {
    if (!moved.current) return
    if (confirming) cancelRef.current?.focus(); else clearRef.current?.focus()
  }, [confirming])
  function ask() { moved.current = true; setConfirming(true) }
  function cancel() { moved.current = true; setConfirming(false) }
  function onConfirmKey(e: KeyboardEvent) {
    if (e.key === 'Escape') cancel()
  }
  function clearAll() {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = undefined
    const empty = emptyCv()
    setDatos(empty.d)
    setRows([])
    setCarta(empty.c)
    removeCv(userId)
    setOutput(null)
    moved.current = false
    setConfirming(false)
    topRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  const r = analiza(rows, hoyNum())

  return (
    <div className={styles.form}>
      <div className={styles.cover} ref={topRef} tabIndex={-1}>
        <p className={styles.coverText}>
          Llénalo en español. De aquí sale tu <b lang="de">Lebenslauf</b> en el formato exacto
          que exige la autoridad alemana, y tu <b>carta de presentación</b> para postular a
          hospitales. Lo que escribas se guarda en este dispositivo mientras lo completas.
        </p>
      </div>

      {/* ---------- Paso 1 ---------- */}
      <section className={styles.step} aria-labelledby="cv-paso1">
        <StepHead id="cv-paso1" num="Paso 1" title="Mis datos">
          Van en el encabezado del currículum, como se acostumbra en Alemania.
        </StepHead>
        <div className={styles.stepBody}>
        <div className={styles.gridWrap}>
          <div className={styles.grid}>
            {DATOS.map(([k, label, placeholder, type]) => (
              <div className={styles.field} key={k}>
                <label className={styles.fieldLabel} htmlFor={'d_' + k}>{label}</label>
                <input
                  className={styles.input} id={'d_' + k} type={type}
                  placeholder={placeholder} value={datos[k] ?? ''}
                  onChange={(e) => setDato(k, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
        </div>
      </section>

      {/* ---------- Paso 2 ---------- */}
      <section className={styles.step} aria-labelledby="cv-paso2">
        <StepHead id="cv-paso2" num="Paso 2" title="Mi vida, mes por mes">
          Aquí está lo importante y es lo que más expedientes frena: la autoridad exige un
          currículum <b>sin un solo hueco</b>. Cada mes desde que saliste del colegio hasta hoy
          tiene que estar explicado. Estudiar, trabajar, estar desempleado, cuidar a alguien,
          estar enfermo, viajar — todo cuenta y todo se escribe. Un vacío sin explicar no se lee
          como «no pasó nada», se lee como «falta información».
        </StepHead>
        <div className={styles.stepBody}>

        {rows.length ? (
          rows.map((p, i) => (
            <PeriodCell
              key={p.id} p={p} n={i + 1}
              onField={(k, v) => setField(p.id, k, v)}
              onRemove={() => removePeriod(p.id)}
            />
          ))
        ) : (
          <p className={styles.empty}>
            Todavía no has añadido ningún periodo. Empieza por el colegio o por el inicio de la carrera.
          </p>
        )}

        <div className={styles.toolbar}>
          <button type="button" className={board.smallBtn} ref={addRef} onClick={addPeriod}>
            Añadir un periodo
          </button>
          <span className={styles.saved} aria-live="polite">{savedNote}</span>
        </div>

        <GapCells r={r} />
        </div>
      </section>

      {/* ---------- Paso 3 ---------- */}
      <section className={styles.step} aria-labelledby="cv-paso3">
        <StepHead id="cv-paso3" num="Paso 3" title="Para mi carta de presentación">
          No escribas una carta. Contesta estas seis preguntas con naturalidad, como si me lo
          contaras hablando. Con eso se arma después una carta en el estilo alemán, que es más
          sobrio y directo de lo que acostumbramos.
        </StepHead>
        <div className={styles.stepBody}>
        <div className={styles.gridWrap}>
          <div className={styles.grid + ' ' + styles.gridWide}>
            {PREGUNTAS.map(([k, q, placeholder]) => (
              <div className={styles.field} key={k}>
                <label className={styles.fieldLabel} htmlFor={k}>{q}</label>
                <textarea
                  className={styles.textarea} id={k}
                  placeholder={placeholder} value={carta[k] ?? ''}
                  onChange={(e) => setRespuesta(k, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
        </div>
      </section>

      {/* ---------- Paso 4 ---------- */}
      <section className={styles.step} aria-labelledby="cv-paso4">
        <StepHead id="cv-paso4" num="Paso 4" title="Mandárselo al equipo MNL">
          Cuando esté completo y sin huecos, pulsa el botón. Aparece abajo un texto: cópialo y
          mándaselo por WhatsApp. Con eso el equipo MNL te prepara el currículum y la carta en alemán.
        </StepHead>
        <div className={styles.stepBody}>

        <div className={styles.toolbar}>
          <button type="button" className={board.primaryBtn} onClick={prepare}>
            Preparar mi texto para el equipo MNL
          </button>
          {!confirming && (
            <button type="button" className={board.smallBtn} ref={clearRef} onClick={ask}>
              Borrar todo y empezar de nuevo
            </button>
          )}
          <span className={styles.saved} aria-live="polite">{copyNote}</span>
        </div>

        {confirming && (
          <div className={board.confirm + ' ' + styles.confirm} role="group" aria-label="Confirmar borrado" onKeyDown={onConfirmKey}>
            <p className={board.confirmText}>Se borra todo lo que has escrito en este dispositivo. ¿Seguro?</p>
            <div className={board.confirmBtns}>
              <button type="button" className={board.dangerBtn} onClick={clearAll}>Sí, borrar todo</button>
              <button type="button" className={board.smallBtn} ref={cancelRef} onClick={cancel}>Cancelar</button>
            </div>
          </div>
        )}

        <div className={styles.output} ref={outBoxRef} hidden={output === null}>
          <label className={styles.fieldLabel} htmlFor="salida">Cópialo entero y mándaselo al equipo MNL</label>
          <textarea
            className={styles.textarea + ' ' + styles.outputText} id="salida"
            ref={outRef} readOnly spellCheck={false} value={output ?? ''}
          />
          <div className={styles.outputBtns}>
            <button type="button" className={board.smallBtn} onClick={copy}>Copiar otra vez</button>
            <button type="button" className={board.smallBtn} onClick={closeOutput}>Cerrar</button>
          </div>
        </div>

        <p className={styles.note}>
          Si el botón de copiar no funciona en tu celular, selecciona el texto a mano y cópialo.
          Siempre está a la vista.
        </p>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>
          <b>Medical Network LATAM</b> · El requisito de currículum sin lagunas es literal de la
          autoridad alemana.
        </p>
        <p>Lo que escribas aquí se queda en este dispositivo hasta que tú lo copies y lo mandes.</p>
      </footer>
    </div>
  )
}

/** A step's head cell: "PASO 1" over "mis datos.", and its explanation */
function StepHead({ id, num, title, children }: { id: string; num: string; title: string; children: ReactNode }) {
  return (
    <div className={styles.stepHead}>
      <h2 className={styles.stepTitle} id={id}>
        <span className={board.label}>{num}</span>{' '}
        <span className={styles.stepName}>{title}<span aria-hidden="true">.</span></span>
      </h2>
      <p className={styles.stepText}>{children}</p>
    </div>
  )
}

/** One period of Paso 2 */
function PeriodCell({ p, n, onField, onRemove }: {
  p: Row
  n: number
  onField: (k: keyof CvPeriod, v: string) => void
  onRemove: () => void
}) {
  const base = 'per-' + p.id
  function text(k: keyof CvPeriod, label: string, placeholder: string) {
    return (
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={base + '-' + k}>{label}</label>
        <input
          className={styles.input} id={base + '-' + k} type="text"
          placeholder={placeholder} value={p[k]}
          onChange={(e) => onField(k, e.target.value)}
        />
      </div>
    )
  }

  return (
    <div className={styles.period} role="group" aria-labelledby={base + '-n'}>
      <div className={styles.periodTop}>
        <span className={board.label} id={base + '-n'}>Periodo {n}</span>
        <button type="button" className={board.smallBtn} onClick={onRemove}>
          Quitar<span className="sr-only"> el periodo {n}</span>
        </button>
      </div>
      <div className={styles.gridWrap}>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={base + '-desde'}>Desde</label>
            <input
              className={styles.input} id={base + '-desde'} type="month"
              value={p.desde} onChange={(e) => onField('desde', e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={base + '-hasta'}>Hasta</label>
            <input
              className={styles.input} id={base + '-hasta'} type="month"
              aria-describedby={base + '-hasta-hint'}
              value={p.hasta} onChange={(e) => onField('hasta', e.target.value)}
            />
            <p className={styles.hint} id={base + '-hasta-hint'}>Déjalo vacío si sigue hasta hoy.</p>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={base + '-tipo'}>Qué era</label>
            <select
              className={styles.select} id={base + '-tipo'}
              value={p.tipo} onChange={(e) => onField('tipo', e.target.value)}
            >
              {TIPOS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
          {text('titulo', 'Título, puesto o cargo', 'Médico residente de urología')}
          {text('donde', 'Dónde (institución o empresa)', 'Hospital Carlos Andrade Marín')}
          {text('ciudad', 'Ciudad y país', 'Quito, Ecuador')}
          <div className={styles.field + ' ' + styles.fieldFull}>
            <label className={styles.fieldLabel} htmlFor={base + '-detalle'}>Detalle breve (opcional)</label>
            <input
              className={styles.input} id={base + '-detalle'} type="text"
              placeholder="Una línea: qué hacías, qué aprendiste" value={p.detalle}
              onChange={(e) => onField('detalle', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The gap check under the periods, and its timeline bar */
function GapCells({ r }: { r: ReturnType<typeof analiza> }) {
  if (r.vacio) {
    return (
      <div className={styles.check}>
        <p className={styles.checkLead}>Todavía no puedo revisar</p>
        <p>Añade tus periodos con sus fechas y aquí te aviso si queda algún mes sin explicar.</p>
      </div>
    )
  }

  /* The bar: one block per run of covered or uncovered months, as wide as
     its share of the months (React's style prop, allowed by the CSP) */
  const runs: Array<{ covered: boolean; n: number }> = []
  for (const c of r.tramos) {
    const last = runs[runs.length - 1]
    if (last && last.covered === c) last.n++
    else runs.push({ covered: c, n: 1 })
  }

  return (
    <>
      {r.sinFecha > 0 && (
        <div className={styles.check}>
          <p className={styles.checkLead}>
            {r.sinFecha}{r.sinFecha === 1 ? ' periodo sin fecha de inicio' : ' periodos sin fecha de inicio'}
          </p>
          <p>Ponles la fecha para que pueda revisarlos.</p>
        </div>
      )}
      {r.huecos.length > 0 ? (
        <div className={styles.check + ' ' + styles.isInverted}>
          <p className={styles.checkLead}>Te faltan meses por explicar</p>
          <p>
            La autoridad alemana exige que no haya ni un mes en blanco. Añade un periodo que cubra
            esto, aunque sea «sin empleo», «enfermedad» o «viaje»:
          </p>
          <ul className={styles.gaps}>
            {r.huecos.map((g) => {
              const n = g[1] - g[0] + 1
              return (
                <li key={g[0]}>
                  <b>{deNum(g[0]) + (n > 1 ? ' – ' + deNum(g[1]) : '')}</b> · {meses(n)}
                </li>
              )
            })}
          </ul>
        </div>
      ) : r.sinFecha === 0 ? (
        <div className={styles.check}>
          <p className={styles.checkLead}>Sin huecos</p>
          <p>
            Tu historial cubre cada mes desde {deNum(r.ini)} hasta hoy. Esto es justo lo que pide
            la autoridad.
          </p>
        </div>
      ) : null}

      {/* The list above says the same in words */}
      <div className={styles.line} aria-hidden="true">
        <div className={styles.bar}>
          {runs.map((run, i) => (
            <span
              key={i}
              className={run.covered ? styles.barCovered : styles.barGap}
              style={{ flexGrow: run.n }}
            />
          ))}
        </div>
        <div className={styles.axis}>
          <span>{deNum(r.ini)}</span>
          <span>hoy</span>
        </div>
      </div>
    </>
  )
}
