import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Link, useParams } from 'react-router'
import AreaLayout from './AreaLayout.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { useAuth } from '../lib/auth.ts'
import { useProfile } from '../lib/profile.ts'
import { supabase } from '../lib/supabase.ts'
import { CHECK_FAILED, dataErrorMessage, NOT_ALLOWED } from '../lib/dataErrors.ts'
import { fillPlaceholders } from '../lib/placeholders.ts'
import { clientName, loadChecklist, loadTicks, progressFor, type ChecklistItem } from '../lib/adminData.ts'
import {
  blockProgress, countChars, currentBlock, dbTrim, envelopeNote, loadClientSettings, pendingText,
  readBlocks, readCards, readCover, stepView,
  DETAILS_COLUMNS, DUDAS_COLUMNS, DUDAS_MAX, TEMPLATE_COLUMNS,
  type BlockInfo, type Cards, type ClientDetails, type ClientItemSetting, type Cover, type Dudas, type TemplateRow,
} from '../lib/expediente.ts'
import board from './Comunidad.module.css'
import styles from './Expediente.module.css'

/* ---------- The 8 screens (DECISIONS.md, 21 Nov 2026; Ivan chose them) ----------
   /expediente            Resumen: cover, numbers, milestone bar, notices
   /expediente/1 … /5     one block each
   /expediente/sobre      the envelope, errors, authority and costs, sources
   /expediente/dudas      Mis dudas
   Any other address under /expediente shows the Resumen. */
type Screen = 'resumen' | 1 | 2 | 3 | 4 | 5 | 'sobre' | 'dudas'
const SCREENS: readonly Screen[] = ['resumen', 1, 2, 3, 4, 5, 'sobre', 'dudas']

function screenFrom(part: string | undefined): Screen {
  if (part && /^[1-5]$/.test(part)) return Number(part) as Screen
  if (part === 'sobre' || part === 'dudas') return part
  return 'resumen'
}
function screenPath(screen: Screen): string {
  return screen === 'resumen' ? '/expediente' : '/expediente/' + screen
}

/** The link to the CV tool (another page, /curriculum) */
const CV_PATH = '/curriculum'
const CV_LABEL = 'Abrir el formulario del currículum'

/** Fixed texts (DECISIONS.md, 21 Nov 2026) */
const SAVED_NOTICE = 'Tus marcas se guardan en tu cuenta: las ves igual en el celular y en la computadora.'
const DUDAS_HELP = 'Lo que escribas aquí lo revisa el equipo MNL antes de la próxima llamada.'
const DUDAS_PLACEHOLDER = 'Escribe aquí tus dudas o lo que quieras revisar en la próxima llamada.'

type Loaded =
  | { key: string; kind: 'error'; error: string }
  | { key: string; kind: 'noRoute' }
  | { key: string; kind: 'notReady' }
  | {
      key: string
      kind: 'ready'
      route: string
      template: TemplateRow
      items: ChecklistItem[]
      ticked: string[]
      settings: ClientItemSetting[]
      details: ClientDetails | null
      dudas: Dudas | null
    }

/* "21 nov 2026, 14:05", in the reader's own time zone */
const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : DATE_TIME.format(date).replace('.', '')
}

/** Mi expediente: the client's checklist for their Bundesland and route,
    from the owner's template plus the client layer an admin sets. Paid
    members (and admins) with a state and a route only; everyone else sees
    one message. The database (RLS) decides in the end what anyone may
    read. Every text from the database is shown as plain text. */
export default function Expediente() {
  usePageTitle('Mi expediente · Medical Network')
  const { session } = useAuth()
  const { profile } = useProfile()
  const userId = session?.user.id ?? null
  const state = profile?.main_state ?? null
  // The database (RLS) decides in the end; this only avoids useless requests
  const canRead = profile?.plan === 'paid' || profile?.is_admin === true
  const screen = screenFrom(useParams()['*'])

  /* ---------- Loading ---------- */
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const loadKey = userId + '|' + state + '|' + attempt
  useEffect(() => {
    if (!supabase || !userId || !canRead || !state) return
    const db = supabase
    const uid = userId
    const st = state
    const key = uid + '|' + st + '|' + attempt
    let cancelled = false
    async function load() {
      let next: Loaded
      try {
        // The route is set by an admin; the shared profile doesn't load it
        const own = await db.from('profiles').select('route').eq('id', uid).maybeSingle<{ route: string | null }>()
        if (own.error) throw own.error
        const route = own.data?.route ?? null
        if (!route) {
          next = { key, kind: 'noRoute' }
        } else {
          const [template, items, ticks, settings, details, dudas] = await Promise.all([
            db.from('checklist_templates').select(TEMPLATE_COLUMNS)
              .eq('state', st).eq('route', route).maybeSingle<TemplateRow>(),
            loadChecklist(db, st, route),
            loadTicks(db, uid),
            loadClientSettings(db, uid),
            db.from('client_details').select(DETAILS_COLUMNS).eq('user_id', uid).maybeSingle<ClientDetails>(),
            db.from('client_dudas').select(DUDAS_COLUMNS).eq('user_id', uid).maybeSingle<Dudas>(),
          ])
          if (template.error) throw template.error
          if (details.error) throw details.error
          if (dudas.error) throw dudas.error
          next = !template.data || items.length === 0
            ? { key, kind: 'notReady' }
            : {
                key, kind: 'ready', route, template: template.data, items,
                ticked: ticks.map((t) => t.item_id), settings, details: details.data, dudas: dudas.data,
              }
        }
      } catch (err) {
        next = { key, kind: 'error', error: dataErrorMessage(err) }
      }
      if (!cancelled) setLoaded(next)
    }
    void load()
    return () => { cancelled = true }
  }, [userId, state, canRead, attempt])
  const current = loaded?.key === loadKey ? loaded : null  // null = loading

  const titleStyle = { '--title-chars': 11 } as CSSProperties  // "expediente."
  const ready = current?.kind === 'ready' ? current : null

  let content: ReactNode
  if (!canRead) {
    content = <p className={board.message}>El expediente es para miembros con el paquete completo.</p>
  } else if (!state) {
    content = (
      <p className={board.reminder}>
        Aún no has elegido tu estado.{' '}
        <Link className={board.reminderLink} to="/estados">Elegir mi estado</Link>
      </p>
    )
  } else if (!current) {
    content = <p className={board.message} role="status">Cargando tu expediente…</p>
  } else if (current.kind === 'error') {
    content = (
      <div className={board.message + ' ' + board.isError} role="alert">
        <p>No se pudo cargar tu expediente. {current.error}</p>
        <button type="button" className={styles.retryBtn} onClick={() => setAttempt((n) => n + 1)}>Reintentar</button>
      </div>
    )
  } else if (current.kind === 'noRoute') {
    content = (
      <p className={board.reminder}>
        Tu ruta todavía no está asignada. Escríbenos si tienes dudas.{' '}
        <Link className={board.reminderLink} to="/contacto">Contacto</Link>
      </p>
    )
  } else if (current.kind === 'notReady') {
    content = <p className={board.message}>Tu expediente todavía no está listo. Te avisaremos.</p>
  } else {
    content = (
      <Checklist
        key={current.key}
        data={current}
        userId={userId!}
        state={state}
        screen={screen}
        name={profile ? clientName(profile) : ''}
      />
    )
  }

  return (
    <AreaLayout current="expediente">
      <main className={board.main + ' ' + styles.main}>
        <div className={board.head + ' ' + styles.head}>
          <p className={board.label}>mi</p>
          <h1 className={board.pageTitle} style={titleStyle}>
            Expediente<span aria-hidden="true">.</span>
          </h1>
          {ready && (
            <p className={styles.cvTop}>
              <Link className={styles.outlineBtn} to={CV_PATH}>{CV_LABEL}</Link>
            </p>
          )}
        </div>
        {content}
      </main>
    </AreaLayout>
  )
}

/* ===========================================================================
   The checklist itself (paid, with a state, a route and a template)
   =========================================================================== */

type Ready = Extract<Loaded, { kind: 'ready' }>

function Checklist({ data, userId, state, screen, name }: {
  data: Ready
  userId: string
  state: string
  screen: Screen
  name: string
}) {
  const cover = readCover(data.template.cover)
  const blocks = readBlocks(data.template.blocks)
  const cards = readCards(data.template.cards)
  const settingOf = new Map(data.settings.map((s) => [s.item_id, s]))
  const fill = (text: string | null | undefined) => fillPlaceholders(text ?? '', {
    pais: data.details?.country, nombre: name, perfil: data.details?.header_line,
  })
  /** The milestone's name for a block ("Papeles"), or "Bloque 1" */
  const milestone = (block: number) => cover.milestones[block - 1] || 'Bloque ' + block

  /* ---------- Ticks: the client's own, by item ID ---------- */
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(data.ticked))
  const [busy, setBusy] = useState<Set<string>>(() => new Set())
  const [tickErrors, setTickErrors] = useState<Map<string, string>>(() => new Map())
  const [announcement, setAnnouncement] = useState('')
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  function setOne<T>(map: Map<string, T>, id: string, value: T | undefined): Map<string, T> {
    const next = new Map(map)
    if (value === undefined) next.delete(id)
    else next.set(id, value)
    return next
  }

  async function toggle(item: ChecklistItem, tick: boolean) {
    if (!supabase || busy.has(item.id)) return
    const title = fill(item.title)
    setBusy((b) => new Set(b).add(item.id))
    setTickErrors((e) => setOne(e, item.id, undefined))
    setAnnouncement('')
    let error = ''
    try {
      if (tick) {
        const { error: e } = await supabase.from('progress').insert({ user_id: userId, item_id: item.id })
        // Already ticked (e.g. on another device): that's what was wanted
        if (e && e.code !== '23505') throw e
      } else {
        const { error: e } = await supabase.from('progress').delete().eq('user_id', userId).eq('item_id', item.id)
        if (e) throw e
      }
    } catch (err) {
      error = (err as { code?: string } | null)?.code === NOT_ALLOWED
        ? 'No se pudo guardar la marca: no tienes permiso. Si crees que es un error, escríbenos.'
        : 'No se pudo guardar la marca. ' + dataErrorMessage(err)
    }
    if (!mounted.current) return
    setBusy((b) => { const n = new Set(b); n.delete(item.id); return n })
    if (error) {
      setTickErrors((e) => setOne(e, item.id, error))
      return
    }
    setTicked((t) => {
      const n = new Set(t)
      if (tick) n.add(item.id)
      else n.delete(item.id)
      return n
    })
    setAnnouncement((tick ? 'Marcado: ' : 'Desmarcado: ') + title)
  }

  /* ---------- Sums ---------- */
  const progress = progressFor(
    { main_state: state, route: data.route }, data.items, [...ticked].map((id) => ({ item_id: id })), data.settings,
  )
  const perBlock = blockProgress(data.items, ticked, settingOf)
  const now = currentBlock(perBlock)

  /* ---------- Moving between screens: back to the top, focus on the heading ---------- */
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstScreen = useRef(true)
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false
      return
    }
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [screen])

  const index = SCREENS.indexOf(screen)
  const label = (s: Screen) =>
    s === 'resumen' ? 'Resumen' : s === 'sobre' ? 'El sobre' : s === 'dudas' ? 'Mis dudas' : `${s} · ${milestone(s)}`

  let body: ReactNode
  if (screen === 'resumen') {
    body = (
      <Summary
        headingRef={headingRef} cover={cover} cards={cards} fill={fill}
        progress={progress} perBlock={perBlock} now={now} milestone={milestone}
      />
    )
  } else if (screen === 'sobre') {
    body = <Envelope headingRef={headingRef} cards={cards} items={data.items} settingOf={settingOf} fill={fill} />
  } else if (screen === 'dudas') {
    body = <MisDudas headingRef={headingRef} title={cards.dudasTitle} userId={userId} initial={data.dudas} />
  } else {
    const info = blocks[screen - 1]
    const items = data.items.filter((item) => item.block === screen)
    body = (
      <BlockScreen
        headingRef={headingRef} info={info} items={items} fill={fill}
        settingOf={settingOf} ticked={ticked} busy={busy} tickErrors={tickErrors} onToggle={toggle}
        extra={screen === 5 ? data.items.filter((item) => item.block === null) : []}
      />
    )
  }

  return (
    <>
      <span className="sr-only" role="status">{announcement}</span>
      <ScreenNav current={screen} label={label} />
      {body}
      <nav className={styles.pager} aria-label="Pantallas del expediente">
        {index > 0 ? (
          <Link className={styles.pagerLink} to={screenPath(SCREENS[index - 1])}>
            <span aria-hidden="true">←</span> {label(SCREENS[index - 1])}
          </Link>
        ) : <span />}
        {index < SCREENS.length - 1 && (
          <Link className={styles.pagerLink + ' ' + styles.isNext} to={screenPath(SCREENS[index + 1])}>
            {label(SCREENS[index + 1])} <span aria-hidden="true">→</span>
          </Link>
        )}
      </nav>
    </>
  )
}

/** The row of the 8 screens. The current one is marked. Arrow keys move
    between the links (Tab still works as usual). */
function ScreenNav({ current, label }: { current: Screen; label: (s: Screen) => string }) {
  const listRef = useRef<HTMLUListElement>(null)
  const currentRef = useRef<HTMLAnchorElement>(null)
  // On a phone the row scrolls sideways: keep the current screen in view
  useEffect(() => {
    const link = currentRef.current
    const list = listRef.current
    if (!link || !list) return
    list.scrollLeft = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2
  }, [current])

  function onKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(e.key)) return
    const links = [...(listRef.current?.querySelectorAll('a') ?? [])]
    const at = links.indexOf(document.activeElement as HTMLAnchorElement)
    if (at < 0) return
    e.preventDefault()
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? links.length - 1
      : (at + (e.key === 'ArrowRight' ? 1 : -1) + links.length) % links.length
    links[to].focus()
  }

  return (
    <nav className={styles.screens} aria-label="Partes del expediente">
      <ul className={styles.screenList} ref={listRef} onKeyDown={onKeyDown}>
        {SCREENS.map((s) => {
          const isCurrent = s === current
          return (
            <li key={String(s)}>
              <Link
                ref={isCurrent ? currentRef : undefined}
                className={styles.screenLink + (isCurrent ? ' ' + styles.isCurrent : '')}
                to={screenPath(s)} aria-current={isCurrent ? 'page' : undefined}
              >
                {label(s)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

type HeadingRef = RefObject<HTMLHeadingElement | null>
type Fill = (text: string | null | undefined) => string

/* ---------- Resumen ---------- */

function Summary({ headingRef, cover, cards, fill, progress, perBlock, now, milestone }: {
  headingRef: HeadingRef
  cover: Cover
  cards: Cards
  fill: Fill
  progress: ReturnType<typeof progressFor>
  perBlock: ReturnType<typeof blockProgress>
  now: ReturnType<typeof currentBlock>
  milestone: (block: number) => string
}) {
  const subtitle = fill(cover.subtitle)
  return (
    <>
      <section className={styles.cover} aria-labelledby="exp-cover">
        {cover.eyebrow && <p className={board.label}>{fill(cover.eyebrow)}</p>}
        <h2 className={styles.coverTitle} id="exp-cover" ref={headingRef} tabIndex={-1}>
          {fill(cover.title) || 'Tu expediente'}
        </h2>
        {subtitle && <p className={styles.coverText}>{subtitle}</p>}
      </section>

      <div className={styles.numbers}>
        <section className={styles.number} aria-labelledby="exp-now">
          <h3 className={board.label} id="exp-now">Ahora mismo</h3>
          {now ? (
            <Link className={styles.numberLink} to={screenPath(now.block as Screen)}>
              {milestone(now.block)} · {pendingText(now.total - now.done)}
            </Link>
          ) : (
            <p className={styles.numberValue}>Completo</p>
          )}
        </section>
        <section className={styles.number} aria-labelledby="exp-avance">
          <h3 className={board.label} id="exp-avance">Avance del expediente</h3>
          <p className={styles.numberValue}>{progress ? progress.percent + ' %' : '—'}</p>
          {progress && (
            <p className={styles.numberHint}>
              {progress.done} de {progress.total} {progress.total === 1 ? 'paso hecho' : 'pasos hechos'}
            </p>
          )}
        </section>
      </div>

      <section className={styles.bar} aria-labelledby="exp-bar">
        <h3 className={board.label} id="exp-bar">{fill(cover.barTitle) || 'Mi avance'}</h3>
        <ol className={styles.milestones}>
          {perBlock.map((p) => {
            const share = p.total === 0 ? 1 : p.done / p.total
            const done = p.done >= p.total
            const fillStyle = { '--fill': share } as CSSProperties
            return (
              <li key={p.block} className={styles.milestone + (done ? ' ' + styles.isDone : '')}>
                <span className={styles.milestoneTrack} aria-hidden="true">
                  <span className={styles.milestoneFill} style={fillStyle} />
                </span>
                <span className={styles.milestoneName}>{milestone(p.block)}</span>
                <span className={styles.milestoneCount}>
                  {p.total === 0
                    ? 'Nada que hacer'
                    : <>{p.done}/{p.total}<span className="sr-only"> pasos hechos</span></>}
                </span>
              </li>
            )
          })}
        </ol>
      </section>

      <p className={styles.notice}>{SAVED_NOTICE}</p>

      {cards.reform && (cards.reform.title || cards.reform.points.length > 0) && (
        <section className={styles.card} aria-labelledby="exp-reform">
          <h3 className={styles.cardTitle} id="exp-reform">{fill(cards.reform.title) || 'Lo que cambió'}</h3>
          <ul className={styles.points}>
            {cards.reform.points.map((point, i) => <li key={i}>{fill(point)}</li>)}
          </ul>
        </section>
      )}

      {cards.legend && (
        <section className={styles.card} aria-labelledby="exp-legend">
          <h3 className={board.label} id="exp-legend">Cómo leer la lista</h3>
          <p className={styles.cardText}>{fill(cards.legend)}</p>
        </section>
      )}
    </>
  )
}

/* ---------- One block ---------- */

function BlockScreen({ headingRef, info, items, extra, fill, settingOf, ticked, busy, tickErrors, onToggle }: {
  headingRef: HeadingRef
  info: BlockInfo
  items: ChecklistItem[]
  /** Steps that don't come from a template (none today): after block 5 */
  extra: ChecklistItem[]
  fill: Fill
  settingOf: Map<string, ClientItemSetting>
  ticked: Set<string>
  busy: Set<string>
  tickErrors: Map<string, string>
  onToggle: (item: ChecklistItem, tick: boolean) => void
}) {
  const step = (item: ChecklistItem) => (
    <Step
      key={item.id} item={item} fill={fill}
      view={stepView(item, settingOf.get(item.id), ticked.has(item.id))}
      busy={busy.has(item.id)} error={tickErrors.get(item.id) ?? ''} onToggle={onToggle}
    />
  )
  return (
    <>
      <section className={styles.blockHead} aria-labelledby="exp-block">
        <p className={board.label}>bloque {info.block}</p>
        <h2 className={styles.blockTitle} id="exp-block" ref={headingRef} tabIndex={-1}>
          {fill(info.title) || 'Bloque ' + info.block}
        </h2>
        {info.subtitle && <p className={styles.blockText}>{fill(info.subtitle)}</p>}
      </section>
      {items.length === 0 && extra.length === 0 ? (
        <p className={board.message}>Este bloque no tiene pasos.</p>
      ) : (
        <ol className={styles.steps}>{items.map(step)}</ol>
      )}
      {extra.length > 0 && (
        <section aria-labelledby="exp-extra">
          <h2 className={styles.extraTitle + ' ' + board.label} id="exp-extra">Otros pasos</h2>
          <ol className={styles.steps}>{extra.map(step)}</ol>
        </section>
      )}
    </>
  )
}

/** One step: official number box | tick box, title, texts and boxes.
    A step that doesn't apply is greyed, shows its reason and can't be
    ticked. */
function Step({ item, view, fill, busy, error, onToggle }: {
  item: ChecklistItem
  view: ReturnType<typeof stepView>
  fill: Fill
  busy: boolean
  error: string
  onToggle: (item: ChecklistItem, tick: boolean) => void
}) {
  const id = useId()
  const title = fill(item.title)
  return (
    <li className={styles.step + (view.applies ? '' : ' ' + styles.isNa) + (view.done ? ' ' + styles.isDone : '')}>
      <div className={styles.official}>
        <span className="sr-only">Número en la lista oficial: </span>
        <span className={styles.officialBox}>{fill(item.official_number) || '—'}</span>
      </div>

      <div className={styles.stepBody}>
        <div className={styles.stepHead}>
          {view.applies ? (
            /* a 44px tap area around the 28px box; the title is its label */
            <span className={styles.tickArea}>
              <input
                type="checkbox" id={id} className={styles.tick}
                checked={view.done} disabled={busy}
                aria-describedby={error ? id + '-error' : undefined}
                onChange={(e) => onToggle(item, e.target.checked)}
              />
            </span>
          ) : (
            <span className={styles.tickNa} aria-hidden="true" />
          )}
          <h3 className={styles.stepTitle}>
            {view.applies ? <label htmlFor={id}>{title}</label> : title}
          </h3>
        </div>

        {!view.applies && (
          <p className={styles.naLine}>
            <span className={styles.naTag}>No aplica</span>
            {view.reason && <span>{fill(view.reason)}</span>}
          </p>
        )}

        {item.body && <p className={styles.stepText}>{fill(item.body)}</p>}

        {(item.donde || item.plazo) && (
          <dl className={styles.facts}>
            {item.donde && (
              <div className={styles.fact}>
                <dt className={board.label}>Dónde</dt>
                <dd>{fill(item.donde)}</dd>
              </div>
            )}
            {item.plazo && (
              <div className={styles.fact}>
                <dt className={board.label}>Plazo</dt>
                <dd>{fill(item.plazo)}</dd>
              </div>
            )}
          </dl>
        )}

        {item.aviso && <Box label="Atención" text={fill(item.aviso)} />}
        {item.caduca && <Box label="Caduca" text={fill(item.caduca)} />}
        {view.note && <Box label="Nota para ti" text={view.note} inverted />}

        {item.source_code === 'p2' && (
          <p>
            <Link className={styles.outlineBtn} to={CV_PATH}>{CV_LABEL}</Link>
          </p>
        )}

        <div className={board.live} aria-live="assertive" id={id + '-error'}>
          {error && <p className={board.error}>{error}</p>}
        </div>
      </div>
    </li>
  )
}

function Box({ label, text, inverted = false }: { label: string; text: string; inverted?: boolean }) {
  return (
    <div className={styles.box + (inverted ? ' ' + styles.isInverted : '')}>
      <p className={board.label}>{label}</p>
      <p className={styles.boxText}>{text}</p>
    </div>
  )
}

/* ---------- El sobre, errors, authority and costs, sources, footer ---------- */

function Envelope({ headingRef, cards, items, settingOf, fill }: {
  headingRef: HeadingRef
  cards: Cards
  items: ChecklistItem[]
  settingOf: Map<string, ClientItemSetting>
  fill: Fill
}) {
  const inEnvelope = items
    .filter((item) => item.sobre_order !== null)
    .sort((a, b) => (a.sobre_order ?? 0) - (b.sobre_order ?? 0))
  const env = cards.envelope
  return (
    <>
      <section className={styles.card} aria-labelledby="exp-envelope">
        <p className={board.label}>el sobre</p>
        <h2 className={styles.cardTitle} id="exp-envelope" ref={headingRef} tabIndex={-1}>
          {fill(env?.title) || 'Cómo va el sobre'}
        </h2>
        {env?.text && <p className={styles.cardText}>{fill(env.text)}</p>}
        {inEnvelope.length > 0 && (
          <ol className={styles.envelope}>
            {inEnvelope.map((item) => {
              const applies = stepView(item, settingOf.get(item.id), false).applies
              const note = env ? envelopeNote(env.order[(item.sobre_order ?? 0) - 1] ?? '') : ''
              return (
                <li key={item.id} className={styles.envelopeRow + (applies ? '' : ' ' + styles.isNa)}>
                  <span className={styles.officialBox}>{fill(item.official_number) || '—'}</span>
                  <span className={styles.envelopeTitle}>{fill(item.title)}</span>
                  {!applies
                    ? <span className={styles.naTag}>No aplica</span>
                    : note && <span className={styles.envelopeNote}>{fill(note)}</span>}
                </li>
              )
            })}
          </ol>
        )}
        {env?.note && <p className={styles.cardText}>{fill(env.note)}</p>}
        {env?.footer && <p className={styles.cardStrong}>{fill(env.footer)}</p>}
      </section>

      {cards.errors && (
        <section className={styles.card} aria-labelledby="exp-errors">
          <h2 className={styles.cardTitle} id="exp-errors">{fill(cards.errors.title) || 'Errores frecuentes'}</h2>
          <ul className={styles.errors}>
            {cards.errors.points.map((p, i) => (
              <li key={i}>
                {p.title && <strong>{fill(p.title)}</strong>} {fill(p.text)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {cards.authority && (
        <section className={styles.card} aria-labelledby="exp-authority">
          <h2 className={styles.cardTitle} id="exp-authority">{fill(cards.authority.title) || 'La autoridad y los costos'}</h2>
          {cards.authority.rows.length > 0 && (
            <dl className={styles.rows}>
              {cards.authority.rows.map((row, i) => (
                <div key={i} className={styles.row}>
                  <dt>{fill(row.label)}</dt>
                  <dd>{fill(row.value)}</dd>
                </div>
              ))}
            </dl>
          )}
          {cards.authority.otherCosts && <p className={styles.cardText}>{fill(cards.authority.otherCosts)}</p>}
          {cards.authority.contact && <p className={styles.cardText}>{fill(cards.authority.contact)}</p>}
        </section>
      )}

      {cards.sources && (
        <section className={styles.card} aria-labelledby="exp-sources">
          <h2 className={styles.cardTitle} id="exp-sources">{fill(cards.sources.title) || 'Fuentes'}</h2>
          {cards.sources.official && <Labelled label="Oficial" text={fill(cards.sources.official)} />}
          {cards.sources.estimate && <Labelled label="Estimado" text={fill(cards.sources.estimate)} />}
          {cards.sources.documents.length > 0 && (
            <div className={styles.labelled}>
              <p className={board.label}>Documentos</p>
              <ul className={styles.points}>
                {cards.sources.documents.map((doc, i) => <li key={i}>{fill(doc)}</li>)}
              </ul>
            </div>
          )}
          {cards.sources.version && <Labelled label="Versión" text={fill(cards.sources.version)} />}
          {cards.sources.advice && <p className={styles.cardStrong}>{fill(cards.sources.advice)}</p>}
        </section>
      )}

      {cards.footer && <p className={styles.footer}>{fill(cards.footer)}</p>}
    </>
  )
}

function Labelled({ label, text }: { label: string; text: string }) {
  return (
    <div className={styles.labelled}>
      <p className={board.label}>{label}</p>
      <p className={styles.cardText}>{text}</p>
    </div>
  )
}

/* ---------- Mis dudas ---------- */

/** Spanish message when the database refuses the dudas */
function dudasErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code === NOT_ALLOWED) return 'No tienes permiso para guardar tus dudas. Si crees que es un error, escríbenos.'
  if (code === CHECK_FAILED) return `Tus dudas pueden tener como máximo ${DUDAS_MAX} caracteres.`
  return dataErrorMessage(error)
}

function MisDudas({ headingRef, title, userId, initial }: {
  headingRef: HeadingRef
  title: string
  userId: string
  initial: Dudas | null
}) {
  const id = useId()
  const [saved, setSaved] = useState<Dudas | null>(initial)
  const [draft, setDraft] = useState(initial?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('')

  const length = countChars(dbTrim(draft))
  const tooLong = length > DUDAS_MAX
  const changed = dbTrim(draft) !== dbTrim(saved?.body ?? '')

  async function save() {
    if (!supabase || saving || tooLong) return
    const db = supabase
    setSaving(true)
    setError('')
    setAnnouncement('')
    try {
      // Only body may be changed (migration 7): update the row, or add it
      // the first time. (One "upsert" would also try to set user_id.)
      const update = () => db.from('client_dudas').update({ body: draft })
        .eq('user_id', userId).select(DUDAS_COLUMNS).maybeSingle<Dudas>()
      let result = await update()
      if (!result.error && !result.data) {
        const inserted = await db.from('client_dudas').insert({ user_id: userId, body: draft })
          .select(DUDAS_COLUMNS).single<Dudas>()
        // Added meanwhile from another device: update it instead
        result = inserted.error?.code === '23505' ? await update() : inserted
      }
      if (result.error) throw result.error
      if (!result.data) throw new Error('not saved')
      setSaved(result.data)
      setDraft(result.data.body)
      setAnnouncement('Dudas guardadas.')
    } catch (err) {
      setError('No se guardaron tus dudas. ' + dudasErrorMessage(err))
    }
    setSaving(false)
  }

  return (
    <section className={styles.card} aria-labelledby="exp-dudas">
      <span className="sr-only" role="status">{announcement}</span>
      <p className={board.label}>para la llamada</p>
      <h2 className={styles.cardTitle} id="exp-dudas" ref={headingRef} tabIndex={-1}>{title || 'Mis dudas'}</h2>
      <p className={styles.cardText} id={id + '-help'}>{DUDAS_HELP}</p>
      <label className="sr-only" htmlFor={id}>Tus dudas</label>
      <textarea
        id={id} className={board.textarea + ' ' + styles.dudas}
        value={draft} placeholder={DUDAS_PLACEHOLDER}
        aria-describedby={id + '-help ' + id + '-count'} aria-invalid={tooLong || undefined}
        onChange={(e) => { setDraft(e.target.value); setError('') }}
      />
      <div className={board.formRow}>
        <p className={board.counter + (tooLong ? ' ' + board.isOver : '')} id={id + '-count'}>
          {length} / {DUDAS_MAX}
        </p>
        <button
          type="button" className={board.primaryBtn}
          onClick={() => void save()} disabled={saving || tooLong || !changed}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {tooLong && <p className={board.fieldNote}>Puedes escribir como máximo {DUDAS_MAX} caracteres.</p>}
      <p className={styles.savedAt}>
        {saved
          ? <>Guardado el <time dateTime={saved.updated_at}>{formatDateTime(saved.updated_at)}</time>{changed && ' · Tienes cambios sin guardar.'}</>
          : changed ? 'Todavía no has guardado tus dudas.' : 'Todavía no has escrito dudas.'}
      </p>
      <div className={board.live} aria-live="assertive">
        {error && <p className={board.error}>{error}</p>}
      </div>
    </section>
  )
}
