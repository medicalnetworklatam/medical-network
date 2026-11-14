import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type FocusEvent, type KeyboardEvent, type PointerEvent,
} from 'react'
import { Link, useNavigate } from 'react-router'
import MenuIcon from './MenuIcon.tsx'
import SessionButton from './SessionButton.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { useMediaQuery } from '../lib/useMediaQuery.ts'
import { saveChosenStates } from '../lib/savedStates.ts'
import {
  HIT_R_MOUSE, HIT_R_TOUCH, MAP_STATES, VIEW_NARROW, VIEW_WIDE,
  createMapAnimator, type MapAnimator, type MapClasses, type MapState,
} from '../estados/mapAnimations.ts'
import { plain, search, type SearchEntry } from '../estados/citySearch.ts'
import styles from './Estados.module.css'

const HINT = 'Toca los estados en el mapa o busca tu ciudad.'

/* Berlin, Hamburg and Bremen are tiny: invisible circles enlarge their tap area */
const CITY_STATES = ['be', 'hb', 'hh'].map((id) => MAP_STATES.find((s) => s.id === id)!)

/* The class names the map drawing code adds by itself */
const MAP_CLASSES: MapClasses = {
  isHover: styles.isHover,
  isFlooding: styles.isFlooding,
  floodCircle: styles.floodCircle,
  isShrinking: styles.isShrinking,
  floodOutline: styles.floodOutline,
  label: styles.label,
  labelHit: styles.labelHit,
  isNew: styles.isNew,
  isLeaving: styles.isLeaving,
  leader: styles.leader,
  isDrawing: styles.isDrawing,
  isUndrawing: styles.isUndrawing,
  dot: styles.dot,
}

/** "¿En qué estado federal estás interesado?": the state picker map
    (from design-mockup/estados.html) */
export default function Estados() {
  usePageTitle('Estados · Medical Network')
  const navigate = useNavigate()

  /* The chosen states, in the order they were picked. The ref always holds
     the latest list, so a quick second click sees the first one. */
  const [chosen, setChosen] = useState<MapState[]>([])
  const chosenRef = useRef<MapState[]>([])
  const [announcement, setAnnouncement] = useState('')
  const [hint, setHint] = useState(HINT)
  const [focusRing, setFocusRing] = useState<{ d: string; visible: boolean } | null>(null)

  const narrow = useMediaQuery('(max-width: 700px)')
  const coarse = useMediaQuery('(pointer: coarse)')

  /* ---------- The map drawing (green fill, names with lines) ---------- */
  const svgRef = useRef<SVGSVGElement>(null)
  const floodsRef = useRef<SVGGElement>(null)
  const floodClipsRef = useRef<SVGDefsElement>(null)
  const leadersRef = useRef<SVGGElement>(null)
  const labelsRef = useRef<SVGGElement>(null)
  const animator = useRef<MapAnimator | null>(null)

  /* Only uses refs and state setters, so the same function is kept for the
     whole visit (the drawing code calls it when a name beside the map is clicked) */
  const toggle = useCallback((s: MapState) => {
    const before = chosenRef.current
    const on = !before.includes(s)
    const now = on ? [...before, s] : before.filter((x) => x !== s)
    chosenRef.current = now
    setChosen(now)
    setAnnouncement(s.name + (on ? ' elegido' : ' quitado'))
    animator.current?.toggled(s, on, now)
  }, [])

  useEffect(() => {
    const a = createMapAnimator(
      {
        svg: svgRef.current!,
        floods: floodsRef.current!,
        floodClips: floodClipsRef.current!,
        leaders: leadersRef.current!,
        labels: labelsRef.current!,
      },
      MAP_CLASSES,
      toggle,
    )
    animator.current = a
    return () => { a.destroy(); animator.current = null }
  }, [toggle])

  function hoverHandlers(s: MapState) {
    return {
      onPointerEnter: (e: PointerEvent) => { if (e.pointerType === 'mouse') animator.current?.setHover(s, true) },
      onPointerLeave: () => animator.current?.setHover(s, false),
    }
  }

  function onStateKeyDown(e: KeyboardEvent, s: MapState) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(s) }
  }

  function onStateFocus(e: FocusEvent<SVGPathElement>, s: MapState) {
    let visible = true
    try { visible = e.currentTarget.matches(':focus-visible') } catch { /* old browser */ }
    setFocusRing({ d: s.d, visible })
  }

  /* ---------- Phone: chosen states as chips ---------- */
  const chipsRef = useRef<HTMLUListElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const chipToFocus = useRef<number | null>(null)

  function removeChip(s: MapState) {
    chipToFocus.current = chosenRef.current.indexOf(s)
    toggle(s)
  }
  /* keep keyboard focus in the list after a chip disappears */
  useLayoutEffect(() => {
    const i = chipToFocus.current
    if (i === null) return
    chipToFocus.current = null
    const chips = chipsRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []
    if (chips.length) chips[Math.min(i, chips.length - 1)].focus()
    else nextRef.current?.focus()
  }, [chosen])

  /* ---------- Search by city ---------- */
  const [query, setQuery] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const results = useMemo(() => search(query), [query])

  function openList(open: boolean) {
    setListOpen(open)
    if (!open) setActive(-1)
  }

  function choose(e: SearchEntry) {
    if (!chosenRef.current.includes(e.state)) toggle(e.state)   /* never un-chooses */
    const msg = e.isState
      ? e.state.name + ' elegido.'
      : e.label + ' está en ' + e.state.name + ' (elegido).'
    setHint(msg)
    setAnnouncement(msg)
    setQuery('')
    openList(false)
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const n = results.length
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault()
      if (!listOpen) openList(true)
      setActive(active < n - 1 ? active + 1 : 0)
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault()
      setActive(active > 0 ? active - 1 : n - 1)
    } else if (e.key === 'Enter') {
      if (listOpen && n) { e.preventDefault(); choose(results[active >= 0 ? active : 0].e) }
    } else if (e.key === 'Escape') {
      if (listOpen) openList(false); else setQuery('')
    }
  }

  /* ---------- Siguiente / No lo sé ---------- */
  function onNext() {
    if (!chosen.length) return
    saveChosenStates(chosen.map((s) => ({ id: s.id, name: s.name })))
    navigate('/novedades')
  }
  function onUnsure() {
    saveChosenStates([])
    navigate('/novedades')
  }

  const n = chosen.length
  const countText = n === 0 ? 'Ningún estado elegido'
    : n === 1 ? '1 estado elegido' : n + ' estados elegidos'

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <header className={styles.siteHeader}>
          <Link className={styles.brand} to="/">Medical Network</Link>
          <div className={styles.headerActions}>
            <SessionButton />
            <Link className={styles.menuBtn} to="/novedades" aria-label="Abrir menú">
              <MenuIcon />
            </Link>
          </div>
        </header>

        <main className={styles.content}>
          <div className={styles.intro}>
            <h1 className={styles.pageTitle} id="page-title">¿En qué estado federal estás interesado?</h1>
            <p className={styles.hint}>{hint}</p>
          </div>

          <div className={styles.search}>
            <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <label className="sr-only" htmlFor="city">Busca tu ciudad</label>
            <input
              className={styles.searchInput} id="city" type="text" role="combobox"
              aria-autocomplete="list" aria-expanded={listOpen} aria-controls="city-list"
              aria-activedescendant={listOpen && active >= 0 ? 'city-opt-' + active : undefined}
              autoComplete="off" autoCapitalize="off" spellCheck={false}
              placeholder="Busca tu ciudad (p. ej. Múnich, Köln)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(-1)
                setListOpen(plain(e.target.value) !== '')
              }}
              onFocus={() => { if (query) openList(plain(query) !== '') }}
              onBlur={() => openList(false)}
              onKeyDown={onSearchKeyDown}
            />
            <ul className={styles.suggestions} id="city-list" role="listbox" aria-label="Ciudades" hidden={!listOpen}>
              {listOpen && results.length === 0 && (
                <li className={styles.suggestionEmpty} role="presentation">
                  No encontramos esa ciudad. Prueba con una ciudad grande cercana, o toca el estado en el mapa.
                </li>
              )}
              {listOpen && results.map((r, i) => (
                <li
                  key={r.e.label + r.e.state.id}
                  className={styles.suggestion}
                  id={'city-opt-' + i}
                  role="option"
                  aria-selected={i === active}
                  /* pointerdown + preventDefault keeps focus in the box */
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(r.e)}
                >
                  <span className={styles.suggestionCity} lang="de">
                    {r.e.label}
                    {r.alias && <span className={styles.suggestionAlias} lang="es">{' · ' + r.alias}</span>}
                  </span>
                  <span className={styles.suggestionState} lang="de">
                    {r.e.isState ? 'Estado' : r.e.state.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.stage}>
            {/* State borders: see estados/mapShapes.ts. Never hand-edit them. */}
            <svg
              ref={svgRef} className={styles.map} id="map"
              viewBox={narrow ? VIEW_NARROW : VIEW_WIDE}
              role="group" aria-labelledby="page-title"
            >
              <g className={styles.states}>
                {MAP_STATES.map((s) => (
                  <path
                    key={s.id}
                    /* className never changes here: the drawing code adds
                       is-hover / is-flooding to it directly */
                    className={styles.state}
                    id={'st-' + s.id}
                    role="checkbox"
                    tabIndex={0}
                    aria-checked={chosen.includes(s)}
                    aria-label={s.name}
                    d={s.d}
                    onClick={() => toggle(s)}
                    onKeyDown={(e) => onStateKeyDown(e, s)}
                    onFocus={(e) => onStateFocus(e, s)}
                    onBlur={() => setFocusRing((f) => f && { ...f, visible: false })}
                    {...hoverHandlers(s)}
                  />
                ))}
              </g>
              <defs ref={floodClipsRef}></defs>
              <g ref={floodsRef} className={styles.floods} aria-hidden="true"></g>
              <g className={styles.hits} aria-hidden="true">
                {CITY_STATES.map((s) => (
                  <circle
                    key={s.id}
                    className={styles.hit}
                    cx={s.ax} cy={s.ay}
                    r={coarse ? HIT_R_TOUCH : HIT_R_MOUSE}
                    onClick={() => toggle(s)}
                    {...hoverHandlers(s)}
                  />
                ))}
              </g>
              <path
                className={styles.focusRing + (focusRing?.visible ? ' ' + styles.isOn : '')}
                d={focusRing?.d ?? ''}
              />
              <g ref={leadersRef} className={styles.leaders} aria-hidden="true"></g>
              <g ref={labelsRef} className={styles.labels} aria-hidden="true"></g>
            </svg>
          </div>

          <ul className={styles.chips} ref={chipsRef} aria-label="Estados elegidos">
            {chosen.map((s) => (
              <li key={s.id}>
                <button type="button" className={styles.chip} aria-label={'Quitar ' + s.name} onClick={() => removeChip(s)}>
                  <span lang="de">{s.name}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.actions}>
            {/* "No lo sé" takes the count's place while nothing is chosen */}
            <button type="button" className={styles.unsureBtn} hidden={n !== 0} onClick={onUnsure}>No lo sé</button>
            <p className={styles.count} aria-live="polite" hidden={n === 0}>{countText}</p>
            <button type="button" className={styles.nextBtn} ref={nextRef} disabled={n === 0} onClick={onNext}>Siguiente</button>
          </div>
          <p className="sr-only" aria-live="polite">{announcement}</p>
        </main>

      </div>
    </div>
  )
}
