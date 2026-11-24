import { useEffect, useState, type CSSProperties } from 'react'
import styles from '../Home.module.css'

/* TEMPORARY tool for Ivan (24 Nov 2026), removed before the pull request
   is merged. Shown only when the address ends with "?ajustar", so normal
   visitors never see it. Three sliders per portrait (hero and price
   section) move and resize the owner's cut-out live, through CSS variables
   on the page (--tune-…, used in Home.module.css). The line at the bottom
   says the values and the screen size; Ivan copies it to Claude, who turns
   it into the real sizes. Nothing is saved. */

type Tune = { scale: number; x: number; y: number }
const START: Tune = { scale: 100, x: 0, y: 0 }

export default function PortraitTuner({ onChange }: { onChange: (vars: CSSProperties) => void }) {
  const [hero, setHero] = useState<Tune>(START)
  const [price, setPrice] = useState<Tune>(START)
  const [open, setOpen] = useState(true)
  const [size, setSize] = useState(() => `${window.innerWidth}×${window.innerHeight}`)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onResize = () => setSize(`${window.innerWidth}×${window.innerHeight}`)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    onChange({
      '--tune-hero-scale': hero.scale / 100,
      '--tune-hero-x': `${hero.x}px`,
      '--tune-hero-y': `${hero.y}px`,
      '--tune-price-scale': price.scale / 100,
      '--tune-price-x': `${price.x}px`,
      '--tune-price-y': `${price.y}px`,
    } as CSSProperties)
  }, [hero, price, onChange])

  const line =
    `Screen ${size} · hero: size ${hero.scale}%, x ${hero.x}px, y ${hero.y}px` +
    ` · price: size ${price.scale}%, x ${price.x}px, y ${price.y}px`

  async function copy() {
    try {
      await navigator.clipboard.writeText(line)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked: the line is selectable text, copy it by hand */
    }
  }

  return (
    <div className={styles.tuner} role="region" aria-label="Portrait adjuster (temporary)">
      <button type="button" className={styles.tunerToggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Portrait adjuster {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <Group title="Hero portrait" value={hero} set={setHero} />
          <Group title="Price section portrait (desktop, 1024px+)" value={price} set={setPrice} />
          <p className={styles.tunerLine}>{line}</p>
          <div className={styles.tunerActions}>
            <button type="button" onClick={copy}>{copied ? 'Copied ✓' : 'Copy values'}</button>
            <button type="button" onClick={() => { setHero(START); setPrice(START) }}>Reset</button>
          </div>
        </>
      )}
    </div>
  )
}

function Group({ title, value, set }: { title: string; value: Tune; set: (t: Tune) => void }) {
  return (
    <fieldset className={styles.tunerGroup}>
      <legend>{title}</legend>
      <Slider label="Size" unit="%" min={40} max={200} step={1} value={value.scale} onChange={(v) => set({ ...value, scale: v })} />
      <Slider label="Left / right" unit="px" min={-500} max={500} step={2} value={value.x} onChange={(v) => set({ ...value, x: v })} />
      <Slider label="Up / down" unit="px" min={-400} max={400} step={2} value={value.y} onChange={(v) => set({ ...value, y: v })} />
    </fieldset>
  )
}

function Slider({ label, unit, min, max, step, value, onChange }: {
  label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void
}) {
  return (
    <label className={styles.tunerRow}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{value}{unit}</output>
    </label>
  )
}
