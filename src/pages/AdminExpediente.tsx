import { useId, useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import { CHECK_FAILED, dataErrorMessage, NOT_ALLOWED } from '../lib/dataErrors.ts'
import { formatBerlinDateTime } from '../lib/berlinTime.ts'
import { fillPlaceholders, type PlaceholderValues } from '../lib/placeholders.ts'
import { stepApplies, type ChecklistItem } from '../lib/adminData.ts'
import {
  countChars, dbTrim,
  COUNTRY_MAX, DETAILS_COLUMNS, HEADER_LINE_MAX, ITEM_SETTING_COLUMNS, NOTE_MAX, REASON_MAX,
  type ClientDetails, type ClientItemSetting,
} from '../lib/expediente.ts'
import styles from './Admin.module.css'

/* The client layer on the client's admin screen (AdminCliente.tsx): the
   client's country and header line, and per step "Según la plantilla /
   Aplica / No aplica", reason and note (DECISIONS.md, 21 Nov 2026).

   Each save sends only the columns it changes, without a confirmation step:
   each change is small and undone by going back to "Según la plantilla"
   with empty texts. Nothing is ever deleted (migration 7 has no delete
   grant).

   Migration 7 lets the website change only some columns (never user_id or
   item_id), so a save first updates the client's row and adds it only when
   there is none yet. A single "upsert" (add-or-update in one request)
   would also try to set user_id, and the database would refuse it. */

/** Spanish message when the database refuses a client-layer change */
function layerErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code === NOT_ALLOWED) return 'No tienes permiso para hacer este cambio.'
  if (code === CHECK_FAILED) return 'Un texto es demasiado largo.'
  return dataErrorMessage(error)
}

/** Text as the database will store it: trimmed, and empty becomes null */
function stored(text: string): string | null {
  const trimmed = dbTrim(text)
  return trimmed === '' ? null : trimmed
}

/** "Saves" a row: update it, or add it when there is none yet. Gives back
    the row the database returned. Throws the database's error. */
async function updateOrInsert<T>(
  update: () => PromiseLike<{ data: T | null; error: { code?: string } | null }>,
  insert: () => PromiseLike<{ data: T | null; error: { code?: string } | null }>,
): Promise<T> {
  let result = await update()
  if (!result.error && !result.data) {
    const inserted = await insert()
    // Added meanwhile (another admin, another tab): update it instead
    result = inserted.error?.code === '23505' ? await update() : inserted
  }
  if (result.error) throw result.error
  if (!result.data) throw new Error('not saved')
  return result.data
}

/** True when the text, trimmed like the database does, is over `max` */
function tooLong(text: string, max: number): boolean {
  return countChars(dbTrim(text)) > max
}

/* ===========================================================================
   Country and header line
   =========================================================================== */

export function DetailsForm({ clientId, details, disabled, onSaved }: {
  clientId: string
  details: ClientDetails | null
  disabled: boolean
  onSaved: (details: ClientDetails) => void
}) {
  const id = useId()
  const [country, setCountry] = useState(details?.country ?? '')
  const [headerLine, setHeaderLine] = useState(details?.header_line ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNote, setSavedNote] = useState('')

  const changed = stored(country) !== (details?.country ?? null) || stored(headerLine) !== (details?.header_line ?? null)
  const countryTooLong = tooLong(country, COUNTRY_MAX)
  const lineTooLong = tooLong(headerLine, HEADER_LINE_MAX)

  async function save() {
    if (!supabase || saving || !changed) return
    if (countryTooLong || lineTooLong) {
      setError('Revisa los textos: el país puede tener hasta 100 caracteres y la línea de encabezado hasta 300.')
      return
    }
    const db = supabase
    const values = { country: stored(country), header_line: stored(headerLine) }
    setSaving(true)
    setError('')
    setSavedNote('')
    try {
      const row = await updateOrInsert(
        () => db.from('client_details').update(values).eq('user_id', clientId)
          .select(DETAILS_COLUMNS).maybeSingle<ClientDetails>(),
        () => db.from('client_details').insert({ user_id: clientId, ...values })
          .select(DETAILS_COLUMNS).single<ClientDetails>(),
      )
      onSaved(row)
      setCountry(row.country ?? '')
      setHeaderLine(row.header_line ?? '')
      setSavedNote('Guardado.')
    } catch (err) {
      setError('No se guardó. ' + layerErrorMessage(err))
    }
    setSaving(false)
  }

  return (
    <div className={styles.setting} role="group" aria-labelledby={id + '-title'}>
      <h3 className={styles.settingLabel} id={id + '-title'}>País y línea de encabezado</h3>
      <div className={styles.field}>
        <label className={styles.subLabel} htmlFor={id + '-country'}>País</label>
        <input
          id={id + '-country'} className={styles.input} value={country}
          aria-describedby={id + '-country-hint'} aria-invalid={countryTooLong || undefined}
          onChange={(e) => { setCountry(e.target.value); setError(''); setSavedNote('') }}
        />
        <p className={styles.hint} id={id + '-country-hint'}>
          Rellena «{'{pais}'}» en el expediente. Vacío: «tu país». Hasta {COUNTRY_MAX} caracteres.
        </p>
      </div>
      <div className={styles.field}>
        <label className={styles.subLabel} htmlFor={id + '-line'}>Línea de encabezado</label>
        <input
          id={id + '-line'} className={styles.input} value={headerLine}
          aria-describedby={id + '-line-hint'} aria-invalid={lineTooLong || undefined}
          onChange={(e) => { setHeaderLine(e.target.value); setError(''); setSavedNote('') }}
        />
        <p className={styles.hint} id={id + '-line-hint'}>
          Se muestra al principio del subtítulo, p. ej. «Médica · Título de Perú (2018) · Vive en Lima». Hasta {HEADER_LINE_MAX} caracteres.
        </p>
      </div>
      <div className={styles.formBtns}>
        <button
          type="button" className={styles.primaryBtn}
          onClick={() => void save()} disabled={disabled || saving || !changed}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <span className={styles.savedNote} aria-live="polite">{savedNote}</span>
      </div>
      <div className={styles.live} aria-live="assertive">
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  )
}

/* ===========================================================================
   One step: its tick (read-only) and its client layer
   =========================================================================== */

type Choice = 'template' | 'yes' | 'no'
const toChoice = (applies: boolean | null | undefined): Choice => (applies === true ? 'yes' : applies === false ? 'no' : 'template')
const toApplies = (choice: Choice): boolean | null => (choice === 'yes' ? true : choice === 'no' ? false : null)

export function StepLayer({ item, doneAt, setting, clientId, placeholderValues, onSaved }: {
  item: ChecklistItem
  /** When the client ticked it, or null */
  doneAt: string | null
  /** The client layer as the database last gave it, or null */
  setting: ClientItemSetting | null
  clientId: string
  placeholderValues: PlaceholderValues
  onSaved: (row: ClientItemSetting) => void
}) {
  const id = useId()
  const [choice, setChoice] = useState<Choice>(toChoice(setting?.applies))
  const [reason, setReason] = useState(setting?.reason ?? '')
  const [note, setNote] = useState(setting?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNote, setSavedNote] = useState('')

  const applies = stepApplies(item, setting)
  const fill = (text: string | null) => fillPlaceholders(text ?? '', placeholderValues)
  const changed = toApplies(choice) !== (setting?.applies ?? null)
    || stored(reason) !== (setting?.reason ?? null)
    || stored(note) !== (setting?.note ?? null)
  const reasonTooLong = tooLong(reason, REASON_MAX)
  const noteTooLong = tooLong(note, NOTE_MAX)

  function edited() {
    setError('')
    setSavedNote('')
  }

  async function save() {
    if (!supabase || saving || !changed) return
    if (reasonTooLong || noteTooLong) {
      setError(`Revisa los textos: el motivo puede tener hasta ${REASON_MAX} caracteres y la nota hasta ${NOTE_MAX}.`)
      return
    }
    const db = supabase
    const values = { applies: toApplies(choice), reason: stored(reason), note: stored(note) }
    setSaving(true)
    setError('')
    setSavedNote('')
    try {
      const row = await updateOrInsert(
        () => db.from('client_item_settings').update(values)
          .eq('user_id', clientId).eq('item_id', item.id)
          .select(ITEM_SETTING_COLUMNS).maybeSingle<ClientItemSetting>(),
        () => db.from('client_item_settings').insert({ user_id: clientId, item_id: item.id, ...values })
          .select(ITEM_SETTING_COLUMNS).single<ClientItemSetting>(),
      )
      onSaved(row)
      setChoice(toChoice(row.applies))
      setReason(row.reason ?? '')
      setNote(row.note ?? '')
      setSavedNote('Guardado.')
    } catch (err) {
      setError('No se guardó este paso. ' + layerErrorMessage(err))
    }
    setSaving(false)
  }

  /* What the folded summary says: the saved state, not the draft */
  const hasLayer = !!setting && (setting.applies !== null || !!setting.reason || !!setting.note)
  const summaryText = [
    setting?.applies === true ? 'aplica' : setting?.applies === false ? 'no aplica' : 'según la plantilla',
    setting?.reason ? 'con motivo' : '',
    setting?.note ? 'con nota' : '',
  ].filter(Boolean).join(' · ')

  const defaultText = item.na_default ? 'no aplica' : 'aplica'
  /* The chosen option is coloured: the template's rule is for everyone
     (Para todos), "Aplica" / "No aplica" is this client's own (Para ti) */
  const options: { value: Choice; label: string; tone: string }[] = [
    { value: 'template', label: `Según la plantilla (${defaultText})`, tone: styles.isParaTodos },
    { value: 'yes', label: 'Aplica', tone: styles.isParaTi },
    { value: 'no', label: 'No aplica', tone: styles.isParaTi },
  ]

  return (
    <li className={styles.checkItem + (doneAt && applies ? ' ' + styles.isDone : '') + (applies ? '' : ' ' + styles.isNa)}>
      <span className={styles.checkMark} aria-hidden="true">{doneAt ? '✓' : ''}</span>
      <div className={styles.checkBody}>
        <p className={styles.checkTitle}>
          {item.official_number && <span className={styles.officialTag}>{fill(item.official_number)}</span>}
          {fill(item.title)}
        </p>
        <p className={styles.checkStatus}>
          {doneAt
            ? (
              /* Hecho only when the step counts; "no aplica" stays uncoloured */
              <>
                <span className={applies ? styles.hechoTag : undefined}>
                  Hecho · <time dateTime={doneAt}>{formatBerlinDateTime(doneAt)}</time> (hora de Alemania)
                </span>
                {!applies && ' · No cuenta: no aplica'}
              </>
            )
            : 'Pendiente'}
          {!applies && !doneAt && ' · No aplica'}
        </p>
        {item.na_default && item.na_reason && (
          <p className={styles.hint}>Motivo de la plantilla: {fill(item.na_reason)}</p>
        )}

        {/* Folded by default to keep the screen short; open when this
            client already has a client layer for the step */}
        <details className={styles.layerBox} open={hasLayer || undefined}>
          <summary className={styles.layerSummary}>
            Para este cliente: <strong>{summaryText}</strong>
          </summary>
        <fieldset className={styles.fieldset + ' ' + styles.layer} disabled={saving}>
          <legend className={styles.subLabel + ' ' + styles.layerLegend}>¿Aplica a este cliente?</legend>
          <div className={styles.choices}>
            {options.map((option) => (
              <label key={option.value} className={styles.choice + ' ' + option.tone}>
                <input
                  type="radio" name={id + '-applies'} value={option.value}
                  checked={choice === option.value}
                  onChange={() => { setChoice(option.value); edited() }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <div className={styles.field}>
            <label className={styles.subLabel} htmlFor={id + '-reason'}>Motivo</label>
            <textarea
              id={id + '-reason'} className={styles.textarea + ' ' + styles.smallTextarea} value={reason}
              aria-describedby={id + '-reason-hint'} aria-invalid={reasonTooLong || undefined}
              onChange={(e) => { setReason(e.target.value); edited() }}
            />
            <p className={styles.hint} id={id + '-reason-hint'}>
              Se muestra cuando el paso no aplica; vacío: el de la plantilla. {countChars(dbTrim(reason))} / {REASON_MAX}
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.subLabel + ' ' + styles.paraTiTag} htmlFor={id + '-note'}>Nota para el cliente</label>
            <textarea
              id={id + '-note'} className={styles.textarea + ' ' + styles.smallTextarea} value={note}
              aria-describedby={id + '-note-hint'} aria-invalid={noteTooLong || undefined}
              onChange={(e) => { setNote(e.target.value); edited() }}
            />
            <p className={styles.hint} id={id + '-note-hint'}>
              Sale en su propio recuadro, «Nota para ti». {countChars(dbTrim(note))} / {NOTE_MAX}
            </p>
          </div>

          <div className={styles.formBtns}>
            <button
              type="button" className={styles.primaryBtn}
              onClick={() => void save()} disabled={saving || !changed}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <span className={styles.savedNote} aria-live="polite">{savedNote}</span>
          </div>
        </fieldset>
        </details>
        <div className={styles.live} aria-live="assertive">
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    </li>
  )
}
