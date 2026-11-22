import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import AdminLayout from './AdminLayout.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import {
  CUANDO, DEFAULTS, FASES, PREGUNTAS, TEXTOS, TIERS, TIER_POR_DEFECTO, nombreLand,
  type Campo, type Clave, type Respuestas, type Tier,
} from '../content/diagnostico.ts'
import {
  analizar, cabecera, dentroFila, estadoFase, mesesDesdeTexto, numeroFase, pasoMeses, presupuesto,
  textoScore, ticksEje, tonoScore, tramos,
  type Analisis, type FilaGantt, type FilaPresupuesto, type TonoScore,
} from '../lib/diagnostico.ts'
import admin from './Admin.module.css'
import styles from './AdminDiagnostico.module.css'

/** /admin/diagnostico: the owner's diagnostic, "Mi ruta a la Approbation",
    for his sales calls (DECISIONS.md, "Changes on 22 Nov 2026 (evening)").
    Admins only (RequireAdmin). The owner types the prospect's answers on the
    left; the report on the right is recalculated with every answer.
    "Guardar PDF" opens the browser's print dialog, which prints only the
    report (AdminDiagnostico.module.css, "Print").

    NOTHING IS STORED: the answers live only in this open page (React state).
    No database, no browser storage, nothing in the address; they are gone
    when the page closes or on "Reiniciar". The browser tab's title never
    holds the prospect's name.

    The content (questions, fees, texts) is in src/content/diagnostico.ts,
    the calculation in src/lib/diagnostico.ts. This file only draws them;
    everything typed is shown as plain text. */
export default function AdminDiagnostico() {
  usePageTitle('Diagnóstico · Administración')
  const [a, setA] = useState<Respuestas>(() => ({ ...DEFAULTS }))
  const [tier, setTier] = useState<Tier>(TIER_POR_DEFECTO)
  /* "Meses sin sueldo" typed by hand (null = the calculation's), and what
     is in the field while it is being typed in */
  const [mesesManual, setMesesManual] = useState<number | null>(null)
  const [mesesBorrador, setMesesBorrador] = useState<string | null>(null)
  /* Today, read once when the page opens: the report's dates count from it */
  const [hoy] = useState(() => new Date())
  const r = useMemo(() => analizar(a), [a])

  function responder(k: Clave, v: string) {
    setA((prev) => ({ ...prev, [k]: v }))
  }
  function reiniciar() {
    setA({ ...DEFAULTS })
    setTier(TIER_POR_DEFECTO)
    setMesesManual(null)
    setMesesBorrador(null)
  }

  return (
    <AdminLayout title="Diagnóstico" compact back={{ to: '/admin', label: 'Administración' }}>
      <div className={styles.tool}>
        <ColumnaRespuestas a={a} responder={responder} reiniciar={reiniciar} />
        <Informe
          a={a}
          r={r}
          hoy={hoy}
          tier={tier}
          setTier={setTier}
          mesesManual={mesesManual}
          setMesesManual={setMesesManual}
          mesesBorrador={mesesBorrador}
          setMesesBorrador={setMesesBorrador}
        />
      </div>
    </AdminLayout>
  )
}

/* ===========================================================================
   The answers (left)
   =========================================================================== */

function ColumnaRespuestas({ a, responder, reiniciar }: {
  a: Respuestas
  responder: (k: Clave, v: string) => void
  reiniciar: () => void
}) {
  const id = useId()
  return (
    <section className={styles.answers} aria-labelledby={id}>
      <div className={styles.answersHead}>
        <h2 className={styles.answersTitle} id={id}>{TEXTOS.respuestasTitulo}</h2>
        <p className={styles.hint}>{TEXTOS.respuestasSub}</p>
        <div className={styles.btns}>
          <button type="button" className={admin.smallBtn} onClick={reiniciar}>{TEXTOS.reiniciar}</button>
          <button type="button" className={admin.primaryBtn} onClick={() => window.print()}>{TEXTOS.guardarPdf}</button>
        </div>
      </div>
      {PREGUNTAS.map((g) => (
        <div key={g.grupo} className={styles.grupo}>
          <h3 className={styles.grupoTitle}>{g.grupo}</h3>
          {g.campos.map((c) => <Pregunta key={c.k} c={c} valor={a[c.k]} responder={responder} />)}
        </div>
      ))}
    </section>
  )
}

/** One question. Text fields are controlled by React, so they keep focus
    while typing; autofill is off, so names aren't remembered by the browser. */
function Pregunta({ c, valor, responder }: { c: Campo; valor: string; responder: (k: Clave, v: string) => void }) {
  const id = useId()
  if (c.tipo === 'texto') {
    return (
      <div className={styles.campo}>
        <label className={styles.campoLabel} htmlFor={id}>{c.label}</label>
        <input
          id={id}
          className={admin.input}
          type="text"
          value={valor}
          placeholder={c.ph}
          autoComplete="off"
          onChange={(e) => responder(c.k, e.target.value)}
        />
      </div>
    )
  }
  if (c.tipo === 'select') {
    return (
      <div className={styles.campo}>
        <label className={styles.campoLabel} htmlFor={id}>{c.label}</label>
        <select id={id} className={admin.select} value={valor} onChange={(e) => responder(c.k, e.target.value)}>
          {c.ops.map((o) => <option key={o} value={o} lang="de">{nombreLand(o)}</option>)}
        </select>
      </div>
    )
  }
  return (
    <div className={styles.campo} role="group" aria-labelledby={id}>
      <p className={styles.campoLabel} id={id}>{c.label}</p>
      <Pills ops={c.ops.map((o) => ({ id: o, label: o }))} valor={valor} elegir={(v) => responder(c.k, v)} />
    </div>
  )
}

/** A row of choices: square buttons, the chosen one filled */
function Pills({ ops, valor, elegir }: { ops: { id: string; label: string }[]; valor: string; elegir: (v: string) => void }) {
  return (
    <div className={styles.pills}>
      {ops.map((o) => (
        <button
          key={o.id}
          type="button"
          className={styles.pill}
          aria-pressed={valor === o.id}
          onClick={() => elegir(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ===========================================================================
   The report (right): the original's report, in the same order
   =========================================================================== */

/** CSS class of a colour with meaning (DECISIONS.md, 21 Nov 2026, late) */
const TONO_SCORE: Record<TonoScore, string> = {
  bien: styles.isHecho, atencion: styles.isDato, critico: styles.isAlerta,
}

function Informe({
  a, r, hoy, tier, setTier, mesesManual, setMesesManual, mesesBorrador, setMesesBorrador,
}: {
  a: Respuestas
  r: Analisis
  hoy: Date
  tier: Tier
  setTier: (t: Tier) => void
  mesesManual: number | null
  setMesesManual: (m: number | null) => void
  mesesBorrador: string | null
  setMesesBorrador: (s: string | null) => void
}) {
  const nameId = useId()
  const cab = cabecera(a, r, hoy)
  const land = cab.land

  return (
    <article className={styles.report} aria-labelledby={nameId}>
      {/* Header */}
      <header className={styles.cab}>
        <div className={styles.cabTop}>
          <p className={styles.marca}>{TEXTOS.marca}</p>
          <h2 className={styles.cabName} id={nameId}>{cab.nombre}</h2>
          <p className={styles.cabSub}>{cab.sub}</p>
        </div>
        <dl className={styles.mets}>
          {cab.metricas.map((m) => (
            <div key={m.k} className={styles.met + (m.hl ? ' ' + styles.isHecho : '')}>
              <dt className={styles.metK}>{m.k}</dt>
              <dd className={styles.metV}>{m.v}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.cabPie}>
          {TEXTOS.bescheidEn}<b lang="de">{land}</b>{cab.pie}
        </p>
      </header>

      {/* ¿De dónde sale ese tiempo? */}
      <Celda titulo={TEXTOS.tiempoTitulo} sub={TEXTOS.tiempoSub}>
        <ul className={styles.tramos}>
          {tramos(r).map((t) => (
            <li key={t.texto} className={styles.tramo}>
              <span className={styles.tramoText}>{t.texto}</span>
              <span className={styles.tramoTrack} aria-hidden="true">
                <span className={styles.tramoFill} style={{ '--pct': t.pct } as CSSProperties} />
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.pie}>{TEXTOS.tiempoPie}</p>
      </Celda>

      {r.alertaB2 && (
        <p className={styles.caja + ' ' + styles.isAlerta}>
          <b>{TEXTOS.alertaB2Titulo}</b>{TEXTOS.alertaB2}
        </p>
      )}

      {/* Mis prioridades ahora */}
      <Celda titulo={TEXTOS.prioridadesTitulo}>
        {r.prio.length === 0 ? (
          <p className={styles.sub}>{TEXTOS.sinPrioridades}</p>
        ) : (
          <ol className={styles.prio}>
            {r.prio.map((p, i) => (
              <li key={p.t} className={styles.prioItem}>
                <span className={styles.num}>{i + 1}</span>
                <div>
                  <p className={styles.pT}>{p.t}</p>
                  <p className={styles.pD}>{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Celda>

      {/* Mi ruta planeada */}
      <Celda titulo={TEXTOS.rutaTitulo} sub={TEXTOS.rutaSub(land)}>
        <Gantt r={r} />
      </Celda>

      {/* Qué resolver en paralelo y cuándo */}
      <Celda titulo={TEXTOS.paraleloTitulo} sub={TEXTOS.paraleloSub}>
        <div>
          {r.paralelo.map((p) => (
            <div key={p.n} className={styles.parFila}>
              <div>
                <p className={styles.pT}>{p.n}</p>
                <p className={styles.pD}>{p.d}</p>
              </div>
              <span className={styles.tag + ' ' + tonoCuando(p.c)}>{p.c}</span>
            </div>
          ))}
        </div>
      </Celda>

      {/* Detalle de las fases */}
      <Celda titulo={TEXTOS.fasesTitulo}>
        <div className={styles.fases}>
          {FASES.map((f) => {
            const st = estadoFase(f.n, r)
            const tono = st === TEXTOS.estadoCompletado ? styles.isHecho : st === TEXTOS.estadoEnCurso ? styles.isParaTi : styles.isPlain
            return (
              <div key={f.n}>
                <p className={styles.fT}>
                  <span className={styles.fN}>{numeroFase(f.n)}</span>{' '}
                  <span className={styles.fNom}>{f.nombre}</span>{' '}
                  <span className={styles.fSt}>· <span className={styles.tag + ' ' + tono}>{st}</span></span>
                </p>
                <p className={styles.pD}>{f.desc}</p>
              </div>
            )
          })}
        </div>
        <p className={styles.pie}>{TEXTOS.fasesPie}</p>
      </Celda>

      {/* Mi presupuesto estimado */}
      <Presupuesto
        r={r}
        tier={tier}
        setTier={setTier}
        mesesManual={mesesManual}
        setMesesManual={setMesesManual}
        mesesBorrador={mesesBorrador}
        setMesesBorrador={setMesesBorrador}
      />

      {/* Mi evaluación por áreas */}
      <section className={styles.celda}>
        <div className={styles.evalHead}>
          <h3 className={styles.celdaTitle}>{TEXTOS.evaluacionTitulo}</h3>
          <div className={styles.puntaje}>
            <p className={styles.puntajeNum}><b>{r.overall}</b><small>{TEXTOS.de100}</small></p>
            <span className={styles.tag + ' ' + TONO_SCORE[tonoScore(r.overall)]}>{textoScore(r.overall)}</span>
          </div>
        </div>
        {r.califs.map((c) => (
          <div key={c.area} className={styles.calFila}>
            <p className={styles.calCab}>
              <span className={styles.calArea}>{c.area}</span>
              <span className={styles.tag + ' ' + TONO_SCORE[tonoScore(c.score)]}>{textoScore(c.score)} · {c.score}</span>
            </p>
            <span className={styles.barra} aria-hidden="true">
              <span className={styles.barraFill + ' ' + TONO_SCORE[tonoScore(c.score)]} style={{ '--fill': c.score / 100 } as CSSProperties} />
            </span>
            <p className={styles.pD}>{c.rec}</p>
          </div>
        ))}
      </section>

      <p className={styles.firma}>{TEXTOS.firma}</p>
    </article>
  )
}

/** "Ahora" = Para ti (like "En curso"), "Hecho / no aplica" = Hecho,
    "Próximo" = an outline, "Más adelante" = no frame */
function tonoCuando(c: string): string {
  if (c === CUANDO.ahora) return styles.isParaTi
  if (c === CUANDO.hecho) return styles.isHecho
  if (c === CUANDO.proximo) return styles.isOutline
  return styles.isPlain
}

/** One ruled cell of the report: its title, a line under it, its content */
function Celda({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className={styles.celda}>
      <h3 className={styles.celdaTitle}>{titulo}</h3>
      {sub && <p className={styles.sub}>{sub}</p>}
      {children}
    </section>
  )
}

/* ---------- Mi ruta planeada ---------- */

const TONO_BARRA = {
  fase: styles.isFase, ahora: styles.isParaTi, par: styles.isDato, hecho: styles.isHecho,
}

function Gantt({ r }: { r: Analisis }) {
  const ticks = ticksEje(r.axisMax)
  const x = (m: number) => ({ '--x': (m / r.axisMax) * 100 }) as CSSProperties
  return (
    <>
      <div className={styles.gantt}>
        <div className={styles.gFila + ' ' + styles.isEje}>
          <div className={styles.gLbl} />
          <div className={styles.gEje}>
            {ticks.map((t) => <span key={t} className={styles.gTick} style={x(t)}>{t}</span>)}
          </div>
        </div>
        <p className={styles.gSec}>{TEXTOS.rutaPrincipal}</p>
        {r.mainRows.map((row) => <Fila key={row.name} row={row} r={r} ticks={ticks} x={x} />)}
        <p className={styles.gSec}>{TEXTOS.enParalelo}</p>
        {r.parRows.map((row) => <Fila key={row.name} row={row} r={r} ticks={ticks} x={x} />)}
      </div>
      <ul className={styles.leyenda}>
        <li><span className={styles.sw + ' ' + styles.isFase} />{TEXTOS.leyendaFase}</li>
        <li><span className={styles.sw + ' ' + styles.isParaTi} />{TEXTOS.leyendaEnCurso}</li>
        <li><span className={styles.sw + ' ' + styles.isDato} />{TEXTOS.leyendaParalelo}</li>
        <li><span className={styles.sw + ' ' + styles.isHecho} />{TEXTOS.leyendaSueldo}</li>
      </ul>
    </>
  )
}

function Fila({ row, r, ticks, x }: {
  row: FilaGantt
  r: Analisis
  ticks: number[]
  x: (m: number) => CSSProperties
}) {
  const dentro = dentroFila(row, r.axisMax)
  return (
    <div className={styles.gFila}>
      <div className={styles.gLbl + (row.done ? ' ' + styles.isDone : '')}>
        {row.name}
        {row.note && <span className={styles.gNota}>{row.note}</span>}
      </div>
      <div className={styles.gPista}>
        {ticks.map((t) => <span key={t} className={styles.gLinea} style={x(t)} />)}
        {dentro.tipo === 'hecho' && <span className={styles.gChip + ' ' + styles.tag + ' ' + styles.isHecho}>{TEXTOS.hecho}</span>}
        {dentro.tipo === 'chip' && <span className={styles.gChip}>{dentro.texto}</span>}
        {dentro.tipo === 'barra' && (
          <span
            className={styles.gBarra + ' ' + TONO_BARRA[dentro.tono]}
            style={{ '--left': dentro.left, '--width': dentro.width } as CSSProperties}
          />
        )}
      </div>
    </div>
  )
}

/* ---------- Mi presupuesto estimado ---------- */

function Presupuesto({
  r, tier, setTier, mesesManual, setMesesManual, mesesBorrador, setMesesBorrador,
}: {
  r: Analisis
  tier: Tier
  setTier: (t: Tier) => void
  mesesManual: number | null
  setMesesManual: (m: number | null) => void
  mesesBorrador: string | null
  setMesesBorrador: (s: string | null) => void
}) {
  const titleId = useId()
  const mesesId = useId()
  const p = presupuesto(r.budget, tier, mesesManual)

  function escribirMeses(v: string) {
    setMesesBorrador(v)
    setMesesManual(mesesDesdeTexto(v))
  }
  function paso(d: number) {
    setMesesBorrador(null)
    setMesesManual(pasoMeses(d, p.calcMedio, mesesManual))
  }

  return (
    <section className={styles.celda} aria-labelledby={titleId}>
      <h3 className={styles.celdaTitle} id={titleId}>{TEXTOS.presupuestoTitulo}</h3>
      <p className={styles.sub}>{TEXTOS.presupuestoSub}</p>
      <div className={styles.noPrint} role="group" aria-labelledby={titleId}>
        <Pills ops={TIERS.map((t) => ({ id: t.id, label: t.label }))} valor={tier} elegir={(v) => setTier(v as Tier)} />
      </div>

      <div>
        <h4 className={styles.reunir}>{TEXTOS.reunirTitulo}</h4>
        <p className={styles.sub}>{TEXTOS.reunirSub}</p>
      </div>
      <div className={styles.meses + ' ' + styles.noPrint}>
        <label className={styles.mesesLabel} htmlFor={mesesId}>{TEXTOS.mesesSinSueldo}</label>
        <div className={styles.mesesRow}>
          <button type="button" className={admin.smallBtn + ' ' + styles.paso} aria-label="Un mes menos" onClick={() => paso(-1)}>−</button>
          <input
            id={mesesId}
            className={admin.input + ' ' + styles.mesesInput}
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={mesesBorrador ?? String(p.valorMeses)}
            onChange={(e) => escribirMeses(e.target.value)}
            onBlur={() => setMesesBorrador(null)}
          />
          <button type="button" className={admin.smallBtn + ' ' + styles.paso} aria-label="Un mes más" onClick={() => paso(1)}>+</button>
        </div>
        {p.manual ? (
          <button
            type="button"
            className={styles.textBtn}
            onClick={() => { setMesesBorrador(null); setMesesManual(null) }}
          >
            {p.textoMeses}
          </button>
        ) : (
          <span className={styles.hint}>{p.textoMeses}</span>
        )}
      </div>

      <table className={styles.tabla}>
        <tbody>
          {p.capital.map((f) => <FilaTabla key={f.l} f={f} />)}
          <tr>
            <td>{p.vida.l}</td>
            <td className={styles.numC}>{p.vida.valor}</td>
          </tr>
          <tr className={styles.total}>
            <td>{TEXTOS.capital}{p.total.sinPendientes && <span className={styles.sinPend}>{TEXTOS.sinPendientes}</span>}</td>
            <td className={styles.numC}>{p.total.valor}</td>
          </tr>
        </tbody>
      </table>

      {p.sueldo ? (
        <div className={styles.caja + ' ' + styles.isHecho}>
          <p className={styles.cT}>{p.sueldo.titulo}</p>
          <p>{p.sueldo.texto}</p>
          {p.sueldo.filas.length > 0 && (
            <table className={styles.tabla}>
              <tbody>{p.sueldo.filas.map((f) => <FilaTabla key={f.l} f={f} />)}</tbody>
            </table>
          )}
          <p className={styles.cSmall}>{TEXTOS.sueldoPie}</p>
        </div>
      ) : (
        <p className={styles.caja + ' ' + styles.isOutline}>{TEXTOS.sinBerufserlaubnisCaja}</p>
      )}

      {p.pendientes && (
        <div className={styles.caja + ' ' + styles.isAlerta}>
          <p className={styles.cT}>{p.pendientes.titulo}</p>
          <ul className={styles.cList}>
            {p.pendientes.items.map((i) => <li key={i.b}><b>{i.b}</b> {i.t}</li>)}
          </ul>
          <p className={styles.cSmall}>{TEXTOS.pendientesPie}</p>
        </div>
      )}

      <div className={styles.notas}>
        {p.notas.map((n) => <p key={n.b}><b>{n.b}</b> {n.t}</p>)}
      </div>
    </section>
  )
}

function FilaTabla({ f }: { f: FilaPresupuesto }) {
  return (
    <tr>
      <td>{f.l}{f.estimado && <>{' '}<span className={styles.tag + ' ' + styles.isOutline}>{TEXTOS.estimado}</span></>}</td>
      <td className={styles.numC}>
        {f.pendiente ? <span className={styles.tag + ' ' + styles.isAlerta}>{f.valor}</span> : f.valor}
      </td>
    </tr>
  )
}
