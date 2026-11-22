/* The owner's diagnostic, "Mi ruta a la Approbation" (the admin-only page
   /admin/diagnostico, DECISIONS.md, "Changes on 22 Nov 2026 (evening)").

   This file holds the CONTENT: the questions and their answers, the
   phases, the exam fees per Bundesland, every month and euro figure, the
   scores, and every Spanish text of the report, copied word for word from
   the owner's original file. The CALCULATION that uses them is in
   src/lib/diagnostico.ts. When the owner changes the vía question, the
   fees or a rule, only these two files change.

   Bundesland names are German and come from the site's own list of the
   16 states (src/estados/mapShapes.ts); the two-letter codes ("bw", "nw")
   are only internal keys and are never shown.

   The owner's Claude reads the printed report to fill in his client notes,
   so the report texts must stay exactly as they are here unless the owner
   asks for a change. tests/diagnostico.test.ts checks a few of them. */

import { MAP_SHAPES } from '../estados/mapShapes.ts'

/** [shortest, longest]: months or euros */
export type Rango = readonly [number, number]

/* ===========================================================================
   The answers
   =========================================================================== */

export interface Respuestas {
  nombre: string
  pais: string
  perfil: string
  ubicacion: string
  nivel: string
  cursoIdioma: string
  documentos: string
  solicitud: string
  /** A state code ("nw"); its German name is shown */
  bundesland: string
  fsp: string
  via: string
  kp: string
  hospitacion: string
  berufserlaubnis: string
  horas: string
  visa: string
}

export type Clave = keyof Respuestas

/** One question: a text field, a row of choices, or the Bundesland list */
export type Campo =
  | { k: Clave; tipo: 'texto'; label: string; ph: string }
  | { k: Clave; tipo: 'opciones'; label: string; ops: readonly string[] }
  | { k: Clave; tipo: 'select'; label: string; ops: readonly string[] }

export interface Grupo {
  grupo: string
  campos: readonly Campo[]
}

/* ===========================================================================
   The 7 phases
   =========================================================================== */

export interface Fase {
  n: number
  nombre: string
  desc: string
}

export const FASES: readonly Fase[] = [
  { n: 1, nombre: 'Documentación', desc: 'Traducción jurada y apostilla de título, certificados y plan de estudios. El certificado B2 forma parte del expediente de solicitud.' },
  { n: 2, nombre: 'Alemán hasta B2', desc: 'Certificado B2 (telc/Goethe). Requisito para presentar la solicitud.' },
  { n: 3, nombre: 'Solicitud al Bundesland', desc: 'Presentación del expediente (Antrag). Al entregarlo, la autoridad inicia la evaluación de equivalencia.' },
  { n: 4, nombre: 'Gutachten → Bescheid', desc: 'La Gleichwertigkeitsprüfung corre en paralelo desde que entregas la solicitud. El Bescheid es la respuesta del Gutachter: dice si el título es homologable o si hace falta la Kenntnisprüfung. No frena la FSP, ni la Berufserlaubnis, ni el sueldo. Lo único que depende de él es la Kenntnisprüfung y la Approbation final.' },
  { n: 5, nombre: 'FSP', desc: 'Fachsprachprüfung: examen de alemán médico. Solo depende de tu nivel de alemán: se prepara y se rinde sin esperar el Bescheid. Es el hito que abre la Berufserlaubnis, o sea el momento en que empiezas a cobrar sueldo de médico.' },
  { n: 6, nombre: 'Kenntnisprüfung', desc: 'Examen de conocimientos médicos, solo si el Bescheid lo exige. La preparación puede hacerse mientras se trabaja con la Berufserlaubnis.' },
  { n: 7, nombre: 'Approbation', desc: 'Licencia médica plena y definitiva.' },
]

/* ===========================================================================
   Exam fees per Bundesland
   ===========================================================================
   The owner's file says: checked one by one against the OFFICIAL SOURCE
   (the fee schedule of the Ärztekammer, or of the Land's Approbation
   authority) on 30 August 2026. DECISIONS.md (22 Nov 2026, evening) says
   only 5 are verified; this changes with the owner's update.
   RULE: sinDato = NOT FOUND IN AN OFFICIAL SOURCE. Never filled in with an
   estimate: shown as "a confirmar" and left OUT of the total.
   rev = months from the application to the Bescheid; gut = the cost of the
   equivalence report (Gutachten), in euros. */

export interface TasaOk {
  ok: true
  min: number
  max: number
  src: string
  nota?: string
}
export interface TasaSinDato {
  ok: false
  nota: string
}
export type Tasa = TasaOk | TasaSinDato

const tasa = (min: number, max: number, src: string, nota?: string): TasaOk => ({ min, max, ok: true, src, nota })
const fija = (v: number, src: string, nota?: string): TasaOk => tasa(v, v, src, nota)
const sinDato = (nota: string): TasaSinDato => ({ ok: false, nota })

export interface Land {
  rev: Rango
  gut: Rango
  fsp: Tasa
  kp: Tasa
}

/** Keyed by state code, in the original's (alphabetical) order */
export const LAND: Readonly<Record<string, Land>> = {
  bw: { rev: [8, 15], gut: [600, 2500],
    fsp: fija(420, 'Gebührenordnung LÄK BW, últ. mod. 16.07.2025'),
    kp: fija(1100, 'Gebührenordnung LÄK BW, pos. 12, últ. mod. 16.07.2025') },
  by: { rev: [8, 14], gut: [0, 1800],
    fsp: fija(550, 'BLÄK, página de Fachsprachenprüfung (06.07.2026)', 'La BLÄK dice «derzeit 550 Euro», sin ordenanza de tasas enlazada.'),
    kp: sinDato('La Regierung von Oberbayern subió la Kenntnisprüfung para todo el que solicite desde el 01/08/2026 y NO ha publicado el monto nuevo. Su FAQ sigue mostrando el texto viejo («bis zu 1.200 Euro»). Pídelo por escrito a la Berufszulassungsstelle antes de dar una cifra.') },
  be: { rev: [8, 16], gut: [0, 1800],
    fsp: fija(550, 'LAGeSo, Hinweise zum Fachsprachentest, Stand marzo 2026'),
    kp: fija(540, 'LAGeSo, Gebührenübersicht, Tarifstelle 51036', 'El documento oficial dice «Stand Dezember 2022». Sigue enlazado hoy, pero conviene reconfirmarlo si el presupuesto es a fecha fija.') },
  bb: { rev: [3, 7], gut: [0, 1800],
    fsp: fija(487, 'Landesärztekammer Brandenburg, página de Fachsprachtests', 'La Kammer no publica desde cuándo rige ese importe.'),
    kp: fija(799, 'LAVG, Hinweise zur ärztlichen Kenntnisprüfung, Stand abril 2024', 'El texto dice «z.Z. 799,00 Euro», o sea «por ahora».') },
  hb: { rev: [5, 12], gut: [0, 1800],
    fsp: fija(530, 'Gebührenverzeichnis ÄK Bremen, pos. 5.02, vigente desde el 29.01.2026'),
    kp: fija(730, 'Gebührenverzeichnis ÄK Bremen, pos. 5.01, vigente desde el 29.01.2026', 'Reorganizar una fecha de examen cuesta 300 € aparte.') },
  hh: { rev: [5, 12], gut: [0, 1800],
    fsp: fija(550, 'Gebührenordnung ÄK Hamburg, pos. 4.1', 'Cancelar la FSP tras la citación cuesta 200 €.'),
    kp: fija(900, 'Gebührenordnung ÄK Hamburg, pos. 3.2 (mündlich-praktische Prüfung)', 'La ordenanza no dice literalmente «Kenntnisprüfung»: distingue prueba oral (470 €) de oral-práctica (900 €). La Kenntnisprüfung es oral-práctica, pero conviene que la Kammer lo confirme por escrito.') },
  he: { rev: [8, 14], gut: [0, 1800],
    fsp: tasa(500, 800, 'Kostensatzung LÄK Hessen, pos. 6200, Stand 01.07.2026', 'La Kammer publica un RANGO, no una cifra fija, y se paga por adelantado. No uses el punto medio: pídele el importe exacto a la LÄKH.'),
    kp: fija(1350, 'Kostensatzung LÄK Hessen, pos. 6100, Stand 01.07.2026') },
  mv: { rev: [5, 12], gut: [0, 1800],
    fsp: fija(700, 'Gebührenverzeichnis ÄK M-V, pos. 2.6, vigente desde el 01.01.2025'),
    kp: fija(640, 'Gebührenverzeichnis ÄK M-V, pos. 2.5, vigente desde el 01.01.2025', 'Hay modificaciones posteriores de 2026 cuyo texto consolidado no es público, pero ninguna de ellas toca estos importes.') },
  ni: { rev: [6, 12], gut: [0, 1800],
    fsp: fija(595, 'NiZzA, aviso oficial de costos, vigente desde el 01.01.2026'),
    kp: fija(980, 'NiZzA, aviso oficial de costos, vigente desde el 01.01.2026') },
  nw: { rev: [10, 18], gut: [0, 1800],
    fsp: tasa(400, 430, 'Gebührenordnung ÄK Nordrhein 2026 y Verwaltungsgebührenordnung ÄK Westfalen-Lippe', 'NRW tiene DOS Ärztekammern y cobran distinto: 430 € en Nordrhein y 400 € en Westfalen-Lippe.'),
    kp: fija(1050, 'Verwaltungsgebührenordnung ÄK Westfalen-Lippe, secc. F', 'La Kenntnisprüfung de TODO NRW la hace y la cobra la Ärztekammer Westfalen-Lippe, aunque el cliente viva en zona Nordrhein.') },
  rp: { rev: [3, 8], gut: [0, 1800],
    fsp: fija(470, 'Bezirksärztekammer Rheinhessen, Stand 01.01.2026', 'Si se cancela con menos de 14 días de antelación o no se presenta, se pierde el 100 %.'),
    kp: sinDato('Ni el LSJV, ni su hoja informativa de la Kenntnisprüfung, ni el portal de derecho del Land publican la tasa. Hay que pedirla por escrito al LSJV Koblenz.') },
  sl: { rev: [5, 12], gut: [0, 1800],
    fsp: sinDato('La Ärztekammer des Saarlandes no tiene página de FSP y su ordenanza de tasas no la contempla. Antes de presupuestar, confirma con el Landesamt für Soziales si el Saarland exige FSP o acepta un certificado C1.'),
    kp: sinDato('No aparece ni en la hoja informativa del Landesamt für Soziales, ni en el FAQ del Landesprüfungsamt, ni en la ordenanza de tasas de la Kammer.') },
  sn: { rev: [4, 10], gut: [220, 2860],
    fsp: fija(590, 'Gebührenverzeichnis 2026 de la Sächsische LÄK, pos. 5.4'),
    kp: sinDato('La Landesdirektion Sachsen no publica una tasa propia de la Kenntnisprüfung. Lo que sí publica es «Feststellung der Gleichwertigkeit nach Prüfungsaufwand im Einzelfall: 220–2.860 €», que es discrecional y ya está recogido arriba como peritaje.') },
  st: { rev: [3, 6], gut: [0, 1800],
    fsp: fija(500, 'Ärztekammer Sachsen-Anhalt, página de Sprachtest', 'La Kammer no publica fecha de vigencia.'),
    kp: sinDato('La toma el Landesverwaltungsamt de Halle, que no publica la tasa. Hay que pedirla al Landesprüfungsamt für Gesundheitsberufe.') },
  sh: { rev: [4, 8], gut: [0, 1800],
    fsp: fija(600, 'SHIBB, FAQ de médicos, Stand marzo 2024', 'La FSP no la toma la Kammer de Schleswig-Holstein sino la de Mecklenburg-Vorpommern, por encargo del SHIBB.'),
    kp: fija(400, 'Gebührensatzung ÄK Schleswig-Holstein, secc. VIII, consolidada al 18.12.2025', '400 € el primer intento. La repetición cuesta 750 €.') },
  th: { rev: [12, 22], gut: [0, 1800],
    fsp: fija(600, 'Landesärztekammer Thüringen, página de Fachsprachenprüfung', 'Su ordenanza fija un rango de 400 a 600 €; la Kammer concreta 600 € en su web.'),
    kp: sinDato('La cobra el Thüringer Landesverwaltungsamt, que no la publica. CUIDADO: los «400 €» que circulan salen de la posición J.6.b de la ordenanza de la Kammer, que es la prueba para homologar un título de ESPECIALISTA, no la Kenntnisprüfung de la Approbation. Son exámenes distintos.') },
}

/** Used when the answer isn't a known state (as in the original) */
export const LAND_POR_DEFECTO = 'nw'

/** The state codes, in the order of the list */
export const BUNDESLAENDER: readonly string[] = Object.keys(LAND)

/** A state's German name, from the site's list ("nw" → "Nordrhein-Westfalen") */
export function nombreLand(code: string): string {
  return MAP_SHAPES.find((s) => s.id === code)?.name ?? code
}

/* ===========================================================================
   The questions and their starting answers
   =========================================================================== */

export const PREGUNTAS: readonly Grupo[] = [
  { grupo: 'Mi perfil', campos: [
    { k: 'nombre', tipo: 'texto', label: 'Mi nombre', ph: 'Nombre y apellido' },
    { k: 'pais', tipo: 'texto', label: 'Mi país de origen', ph: 'Ej. Ecuador, Colombia, México…' },
    { k: 'perfil', tipo: 'opciones', label: 'Mi perfil profesional', ops: ['Recién graduado', 'Con experiencia', 'Especialista'] },
    { k: 'ubicacion', tipo: 'opciones', label: '¿Dónde estoy ahora?', ops: ['En mi país de origen', 'En otro país', 'Ya vivo en Alemania'] },
  ] },
  { grupo: 'Mi alemán', campos: [
    { k: 'nivel', tipo: 'opciones', label: 'Mi nivel de alemán', ops: ['Ninguno/A1', 'A2', 'B1', 'B2', 'C1', 'FSP aprobado'] },
    { k: 'cursoIdioma', tipo: 'opciones', label: '¿Tomo un curso de alemán ahora?', ops: ['Ninguno', 'En mi país', 'En Alemania', 'Ya lo concluí'] },
  ] },
  { grupo: 'Mis documentos', campos: [
    { k: 'documentos', tipo: 'opciones', label: 'Estado de mi expediente', ops: ['No iniciado', 'En proceso', 'Traducidos y apostillados', 'Completo y verificado'] },
  ] },
  { grupo: 'Mi solicitud', campos: [
    { k: 'solicitud', tipo: 'opciones', label: 'Estado de mi solicitud', ops: ['No presentada', 'En preparación', 'Presentada, esperando', 'Bescheid recibido'] },
    { k: 'bundesland', tipo: 'select', label: 'Bundesland al que apunto', ops: BUNDESLAENDER },
  ] },
  { grupo: 'Reconocimiento', campos: [
    { k: 'fsp', tipo: 'opciones', label: 'Mi FSP (alemán médico)', ops: ['No iniciado', 'Preparando', 'Fecha asignada', 'Aprobado'] },
    { k: 'via', tipo: 'opciones', label: '¿Qué resultado espero del Bescheid?', ops: ['Requiere Kenntnisprüfung', 'Equivalencia (Approbation directa)', 'Aún no lo sé'] },
    { k: 'kp', tipo: 'opciones', label: 'Estado de mi Kenntnisprüfung', ops: ['No aplica aún', 'Preparando', 'Fecha asignada', 'Aprobado'] },
  ] },
  { grupo: 'Complementos', campos: [
    { k: 'hospitacion', tipo: 'opciones', label: 'Mis Hospitationen (prácticas)', ops: ['No iniciada', 'Planificada', 'En curso', 'Realizada'] },
    { k: 'berufserlaubnis', tipo: 'opciones', label: '¿Quiero la Berufserlaubnis provisional?', ops: ['Sí', 'No', 'No lo sé'] },
  ] },
  { grupo: 'Mis recursos', campos: [
    { k: 'horas', tipo: 'opciones', label: 'Mis horas de estudio por semana', ops: ['<5', '5-15', '15-30', '30+ (tiempo completo)'] },
    { k: 'visa', tipo: 'opciones', label: 'Mi situación migratoria', ops: ['Necesito visa', 'Visa en trámite', 'Ya tengo permiso', 'Ciudadanía UE'] },
  ] },
]

export const DEFAULTS: Readonly<Respuestas> = {
  nombre: '', pais: '', perfil: 'Especialista', ubicacion: 'En mi país de origen',
  nivel: 'B1', cursoIdioma: 'Ninguno', documentos: 'En proceso',
  solicitud: 'No presentada', bundesland: 'nw',
  fsp: 'No iniciado', via: 'Aún no lo sé', kp: 'No aplica aún',
  hospitacion: 'No iniciada', berufserlaubnis: 'No lo sé',
  horas: '5-15', visa: 'Necesito visa',
}

/* ===========================================================================
   Months
   =========================================================================== */

/** Months between passing the FSP and the first salary with the
    Berufserlaubnis. The aim is to go straight into a job; up to 3 months of
    margin in case the search takes longer. No official deadline: the
    owner's own rule. */
export const COLCHON_PUESTO: Rango = [0, 3]

/** Study hours per week → how much the study phases stretch or shrink */
export const RITMO: Readonly<Record<string, number>> = {
  '<5': 1.25, '5-15': 1.0, '15-30': 0.85, '30+ (tiempo completo)': 0.7,
}

/** Months left in each phase, by answer */
export const PLAZOS = {
  aleman: { 'Ninguno/A1': [12, 18], 'A2': [8, 12], 'B1': [5, 8], 'B2': [0, 0], 'C1': [0, 0], 'FSP aprobado': [0, 0] } as Readonly<Record<string, Rango>>,
  documentos: { 'No iniciado': [2, 4], 'En proceso': [1, 2], 'Traducidos y apostillados': [0, 1], 'Completo y verificado': [0, 0] } as Readonly<Record<string, Rango>>,
  /** Preparing and handing in the application, when not yet handed in */
  solicitud: [1, 2] as Rango,
  /** Already handed in ("Presentada, esperando"): this share of the Land's
      months to the Bescheid is left, but at least this many months */
  revisionEnCurso: { factor: [0.4, 0.6] as Rango, minimo: [1, 2] as Rango },
  fsp: { 'Aprobado': [0, 0], 'Fecha asignada': [1, 2], 'Preparando': [2, 4], 'No iniciado': [3, 5] } as Readonly<Record<string, Rango>>,
  kp: { 'Aprobado': [0, 0], 'Fecha asignada': [1, 3], 'Preparando': [4, 7], 'No aplica aún': [5, 9] } as Readonly<Record<string, Rango>>,
  kpPorDefecto: [5, 9] as Rango,
  approbation: [1, 2] as Rango,
  /** The visa row of the timeline: from month 0 to month 3 */
  visa: [0, 3] as Rango,
  /** The housing row of the timeline */
  vivienda: [1.5, 4] as Rango,
  /** A German course in Germany: arrival in month 2 */
  llegadaCursoEnAlemania: 2,
}

/** Month names, for "Primer sueldo aprox." and "Approbation aprox." */
export const MESES: readonly string[] = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/* ===========================================================================
   Money (euros)
   =========================================================================== */

export const COSTOS = {
  traducciones: [300, 800] as Rango,
  cursoAleman: { 'Ninguno/A1': [2000, 4000], 'A2': [1500, 3000], 'B1': [800, 2000], 'B2': [0, 0], 'C1': [0, 0], 'FSP aprobado': [0, 0] } as Readonly<Record<string, Rango>>,
  examenB2: [155, 230] as Rango,
  preparacionFsp: [0, 2000] as Rango,
  approbation: [150, 1000] as Rango,
  visa: [75, 75] as Rango,
}

/** The three city sizes for the cost of living */
export type Tier = 'pequena' | 'media' | 'grande'

/** Cost of living per month in Germany, by city size */
export const VIDA_POR_MES: Readonly<Record<Tier, Rango>> = {
  grande: [1400, 1900], media: [1100, 1500], pequena: [900, 1300],
}
export const TIER_POR_DEFECTO: Tier = 'media'
export const TIERS: readonly { id: Tier; label: string }[] = [
  { id: 'pequena', label: 'Ciudad pequeña' },
  { id: 'media', label: 'Ciudad media / este' },
  { id: 'grande', label: 'Ciudad grande (München, Berlín…)' },
]

/** Sperrkonto per year (the original keeps it in the budget; the text
    below spells it out) */
export const SPERRKONTO = 11904

/** "Meses sin sueldo" typed by hand: kept between these */
export const MESES_MANUAL_LIMITES: Rango = [0, 99]

/* ===========================================================================
   Scores (0–100)
   =========================================================================== */

export const PUNTAJES = {
  nivel: { 'FSP aprobado': 100, 'C1': 90, 'B2': 75, 'B1': 45, 'A2': 25, 'Ninguno/A1': 10 } as Readonly<Record<string, number>>,
  /** Points added to the language score while taking a course */
  bonoCurso: 5,
  documentos: { 'Completo y verificado': 100, 'Traducidos y apostillados': 70, 'En proceso': 40, 'No iniciado': 10 } as Readonly<Record<string, number>>,
  tramite: { 'Bescheid recibido': 100, 'Presentada, esperando': 75, 'En preparación': 45, 'No presentada': 15 } as Readonly<Record<string, number>>,
  examenes: { todoAprobado: 100, fspAprobada: 75, fechaAsignada: 60, preparando: 45, otro: 20 },
  logistica: { enAlemania: 100, visaLista: 90, visaEnTramite: 60, otro: 25 },
  ritmo: { '30+ (tiempo completo)': 100, '15-30': 75, '5-15': 50, '<5': 25 } as Readonly<Record<string, number>>,
  /** From this score up: "Bien"; from `atencion` up: "Atención"; below: "Crítico" */
  bien: 75,
  atencion: 45,
}

/* ===========================================================================
   Texts made by the calculation
   =========================================================================== */

/** One area's advice for each score band */
export interface Recomendacion {
  area: string
  bien: string
  atencion: string
  critico: string
}

const tramiteSiguiente = 'La solicitud define todo el calendario: prepararla en cuanto documentos y B2 estén listos.'

export const AREAS = {
  idioma: { area: 'Idioma', bien: 'Nivel sólido; enfocar el alemán médico (FSP).', atencion: 'Vas por buen camino: mantener ritmo constante hacia el B2 y planear el salto al alemán médico.', critico: 'Punto crítico: sin B2 no hay solicitud. Inscribirse ya en un curso con plan definido.' },
  documentacion: { area: 'Documentación', bien: 'Expediente listo: deja de ser el cuello de botella.', atencion: 'Avanzar con traducciones y apostillas; los tiempos de apostilla (4–8 semanas) suelen sorprender.', critico: 'Empezar ya: reunir títulos, plan de estudios y certificados. Es la base de todo lo demás.' },
  /* The original has one text for "Atención" and "Crítico" here */
  tramite: { area: 'Trámite oficial', bien: 'En marcha; dar seguimiento activo a la autoridad.', atencion: tramiteSiguiente, critico: tramiteSiguiente },
  examenes: { area: 'Exámenes', bien: 'Bien encaminado; asegurar plaza para lo que falte.', atencion: 'Mantener preparación estructurada; reservar fecha cuanto antes (listas largas).', critico: 'Iniciar la preparación de la FSP en paralelo a la espera del Bescheid: es tiempo que se gana.' },
  logistica: { area: 'Logística (visa/vivienda)', bien: 'Resuelto; enfocar energía en idioma y exámenes.', atencion: 'Seguimiento a la visa y asegurar alojamiento inicial para el Anmeldung.', critico: 'Pedir cita en la embajada ya: las listas de espera pueden tardar meses y frenan todo lo demás.' },
  ritmo: { area: 'Ritmo de estudio', bien: 'Ritmo excelente: cada mes de estudio intenso acorta la ruta.', atencion: 'Ritmo aceptable; si puedes subir horas, la ruta se acorta visiblemente.', critico: 'Con menos de 5 h/semana la ruta se alarga mucho: buscar bloques fijos de estudio.' },
} satisfies Record<string, Recomendacion>

/** "Qué resolver en paralelo y cuándo": the "cuándo" words */
export const CUANDO = {
  ahora: 'Ahora',
  proximo: 'Próximo',
  masAdelante: 'Más adelante',
  hecho: 'Hecho / no aplica',
} as const

export const PARALELO = {
  idioma: {
    n: 'Escuela de idiomas',
    hecho: 'Nivel de alemán suficiente para avanzar.',
    enMiPais: 'Avanzar hasta ~B1 en mi país y planificar un intensivo en Alemania para cerrar el B2 y el alemán médico.',
    enAlemania: 'Intensivo en Alemania hasta B2 aprovechando la inmersión; luego enfocar el alemán médico (FSP).',
    ninguno: 'Inscribirme ya: empezar en mi país hasta ~B1 y continuar con un intensivo en Alemania hasta B2. Es el tramo más largo de la ruta.',
  },
  visa: {
    n: 'Visa / embajada',
    enAlemania: 'Ya vivo en Alemania.',
    lista: 'Ya tengo permiso o ciudadanía UE.',
    enTramite: 'Dar seguimiento a la solicitud y preparar los documentos para el Anmeldung al llegar.',
    necesita: 'Solicitar cita en la embajada cuanto antes (listas largas) y reunir requisitos. La vía depende del motivo de entrada: curso de idioma (§16f), reconocimiento (§16d) o empleo. Confirmar con la embajada.',
  },
  vivienda: {
    n: 'Vivienda',
    enAlemania: 'Ya vivo en Alemania.',
    otro: 'Dos momentos: un alojamiento inicial (temporal o reservado) que puede ser necesario para el expediente de visa, y la vivienda definitiva con el registro de domicilio (Anmeldung) al llegar.',
  },
  hospitationen: {
    n: 'Hospitationen',
    realizada: 'Prácticas de observación clínica ya realizadas.',
    enCurso: 'Aprovechar para pulir el alemán médico, conseguir referencias y abrir puertas a un puesto y a la Berufserlaubnis.',
    ahora: 'Gestionar prácticas de observación; solaparlas con la preparación de FSP y de la Kenntnisprüfung.',
    despues: 'Planificarlas para cuando alcance ~B1 y esté en Alemania; van en paralelo a la preparación de idioma y conocimientos.',
  },
}

/** "Mis prioridades ahora" (at most 4 are shown) */
export const PRIORIDADES = {
  documentacion: { t: 'Cerrar documentación', d: 'Completar traducción jurada y apostilla del expediente (incluye el certificado B2).' },
  aleman: { t: 'Alemán a B2', d: 'Alcanzar el B2 certificado: es la llave para poder solicitar.' },
  visa: { t: 'Iniciar proceso de visa', d: 'Pedir cita en la embajada (listas largas), reunir requisitos y asegurar alojamiento inicial.' },
  solicitud: { t: 'Presentar la solicitud', d: (land: string) => 'Entregar el Antrag en ' + land + ': al hacerlo arranca la evaluación de equivalencia.' },
  fsp: { t: 'Ir por la FSP ya', d: 'No depende del Bescheid ni de la solicitud: solo del alemán. Es el examen que abre la Berufserlaubnis, o sea el día que dejas de gastar ahorros y empiezas a cobrar sueldo de médico.' },
  gutachten: { t: 'Seguir el Gutachten', d: (land: string) => 'Dar seguimiento a la autoridad de ' + land + '. Corre en paralelo: mientras tanto no se detiene nada.' },
  hospitationen: { t: 'Arrancar Hospitationen', d: 'Prácticas en paralelo al estudio: idioma médico, contexto clínico y contactos laborales.' },
  kp: { t: 'Reservar la Kenntnisprüfung', d: 'Listas largas: agendar plaza cuanto antes. La preparación puede hacerse trabajando con la Berufserlaubnis.' },
  berufserlaubnis: { t: 'Solicitar Berufserlaubnis y buscar puesto', d: 'Con la FSP aprobada ya puedes trabajar como médico, con el mismo sueldo que tendrás con la Approbation. No hace falta esperar el Bescheid.' },
}

/** The timeline's rows: names, notes and the words inside a row */
export const GANTT = {
  escenarioEstimado: ' (escenario estimado)',
  notaSueldo: 'aquí empieza el sueldo',
  noAplicaEquivalencia: 'No aplica (equivalencia)',
  gutachten: 'Gutachten → Bescheid',
  bescheidRecibido: 'Bescheid recibido',
  notaGutachten: 'no frena la FSP ni el sueldo',
  berufserlaubnisSueldo: 'Berufserlaubnis (sueldo)',
  notaBerufserlaubnis: 'mismo sueldo que con Approbation',
  berufserlaubnis: 'Berufserlaubnis',
  descartada: 'Descartada',
  requiereFsp: 'Requiere FSP aprobada',
  hospitationen: 'Hospitationen',
  hecho: 'Hecho',
  visa: 'Visa / embajada',
  enAlemania: 'En Alemania',
  resuelto: 'Resuelto',
  vivienda: 'Vivienda',
}

/** "¿De dónde sale ese tiempo?": the stretches of the critical path */
export const TRAMOS = {
  prep: 'Idioma + documentos',
  solicitud: 'Solicitud',
  fsp: 'FSP',
  espera: 'Espera del Bescheid',
  kp: 'Kenntnisprüfung',
  approbation: 'Approbation',
}

/** The budget's lines */
export const PARTIDAS = {
  traducciones: 'Traducciones juradas + apostillas',
  cursos: 'Cursos de alemán hasta B2',
  examenB2: 'Examen B2 (telc/Goethe)',
  preparacionFsp: 'Preparación alemán médico FSP (hay recursos gratuitos)',
  tasaFsp: (land: string) => 'Tasa FSP (' + land + ')',
  tasaKp: (land: string, siAplica: boolean) => 'Tasa Kenntnisprüfung (' + land + ')' + (siAplica ? ' · si aplica' : ''),
  peritaje: (land: string) => 'Peritaje de equivalencia (' + land + ') · si la autoridad lo encarga',
  approbation: 'Tasa de Approbation',
  visa: 'Visa nacional (categoría D)',
}

/* ===========================================================================
   Texts of the page and the report, in the report's order
   =========================================================================== */

export const TEXTOS = {
  /* The answers column */
  respuestasTitulo: 'Mis respuestas',
  respuestasSub: 'La ruta se recalcula al instante con cada respuesta.',
  reiniciar: 'Reiniciar',
  /* The original said "Descargar PDF" (it made the PDF itself) */
  guardarPdf: 'Guardar PDF',

  /* Header */
  marca: 'Medical Network LATAM',
  sinNombre: 'Mi caso',
  faseActual: 'Fase actual',
  tiempoRestante: 'Tiempo estimado restante',
  meses: (min: number, max: number) => min + '–' + max + ' meses',
  primerSueldo: 'Primer sueldo aprox.',
  sinBerufserlaubnis: 'Sin Berufserlaubnis',
  approbationAprox: 'Approbation aprox.',
  bescheidEn: 'Bescheid en ',
  bescheidRango: (min: number, max: number) => ': rango estimado ' + min + '–' + max + ' meses (barra "Gutachten → Bescheid"). Corre en paralelo y no retrasa la FSP ni el sueldo: solo condiciona la Kenntnisprüfung y la Approbation. Las autoridades no publican plazos; es cálculo nuestro sobre casos.',

  /* ¿De dónde sale ese tiempo? */
  tiempoTitulo: '¿De dónde sale ese tiempo?',
  tiempoSub: 'Peso de cada tramo de la ruta crítica (estimado).',
  tramo: (l: string, meses: number) => l + ' · ' + meses + ' m',
  tiempoPie: 'El Gutachten no aparece aquí porque no alarga la ruta crítica: corre en paralelo y solo condiciona la Kenntnisprüfung. Lo que de verdad manda el calendario es el alemán, porque de él depende la FSP y con ella el sueldo.',

  /* Only when the file is complete without B2 */
  alertaB2Titulo: 'Revisar consistencia · ',
  alertaB2: 'El expediente de solicitud incluye el certificado B2. Con el nivel de alemán indicado, el expediente aún no estaría realmente completo.',

  /* Mis prioridades ahora */
  prioridadesTitulo: 'Mis prioridades ahora',
  sinPrioridades: 'Sin acciones pendientes según mis respuestas.',

  /* Mi ruta planeada */
  rutaTitulo: 'Mi ruta planeada',
  rutaSub: (land: string) => 'Línea de tiempo (meses desde hoy) con los plazos de ' + land + '. Arriba la ruta principal; abajo, lo que corre en paralelo, incluido el Gutachten y el periodo con sueldo.',
  rutaPrincipal: 'Ruta principal',
  enParalelo: 'En paralelo',
  hecho: '✓ hecho',
  leyendaFase: 'Fase',
  leyendaEnCurso: 'En curso',
  leyendaParalelo: 'Paralelo',
  leyendaSueldo: 'Sueldo (Berufserlaubnis, desde la FSP hasta la Approbation)',

  /* Qué resolver en paralelo y cuándo */
  paraleloTitulo: 'Qué resolver en paralelo y cuándo',
  paraleloSub: 'Trámites que se planifican a la par del idioma y los exámenes.',

  /* Detalle de las fases */
  fasesTitulo: 'Detalle de las fases',
  estadoNoAplica: 'No aplica',
  estadoCompletado: 'Completado',
  estadoEnCurso: 'En curso',
  estadoPendiente: 'Pendiente',
  fasesPie: 'La Berufserlaubnis es opcional y solo requiere la FSP aprobada: no espera al Bescheid. Se trabaja con ella hasta la Approbation, con el mismo sueldo, y la Kenntnisprüfung se prepara trabajando.',

  /* Mi presupuesto estimado */
  presupuestoTitulo: 'Mi presupuesto estimado',
  presupuestoSub: 'La pregunta no es cuánto cuesta todo el proceso, sino cuánto dinero necesito tener antes de empezar. Lo que cae después del primer sueldo ya no sale de mis ahorros.',
  reunirTitulo: 'Lo que necesito reunir',
  reunirSub: 'Desde hoy hasta mi primer sueldo como médico.',
  mesesSinSueldo: 'Meses sin sueldo',
  volverAlCalculo: (min: number, max: number) => 'volver al cálculo (' + min + '–' + max + ')',
  calculado: (min: number, max: number) => 'calculado: ' + min + '–' + max + ' · edítalo si sabes el dato real',
  estimado: 'estimado',
  aConfirmar: 'a confirmar',
  costoDeVida: (meses: string, vidaMin: string, vidaMax: string) => 'Costo de vida · ' + meses + ' en Alemania sin sueldo × ' + vidaMin + '–' + vidaMax + '/mes',
  mes: ' mes',
  mesesPalabra: ' meses',
  capital: 'Capital que necesito',
  sinPendientes: ' · sin lo que falta confirmar',
  sueldoTitulo: (mes: number) => 'A partir del mes ~' + mes + ': sueldo de médico',
  sueldoTexto: (meses: number) => 'Con la FSP aprobada solicito la Berufserlaubnis y empiezo a trabajar. El sueldo es el mismo que con la Approbation. Desde ese punto, estos ' + meses + ' meses de costo de vida y lo que quede del proceso salen del salario, no de mis ahorros.',
  sueldoPie: 'No se suma al capital de arriba: para entonces ya tengo ingresos.',
  sinBerufserlaubnisCaja: 'El cálculo asume que descarto la Berufserlaubnis, así que el costo de vida corre a mi cargo hasta la Approbation. Con la FSP aprobada podría trabajar bastante antes y bajar mucho esta cifra.',
  pendientesTitulo: (n: number, land: string) => (n === 1 ? 'Falta una tasa por confirmar' : 'Faltan ' + n + ' tasas por confirmar') + ' en ' + land,
  pendientesPie: 'No las inventamos ni las estimamos: la autoridad no las publica. Quedan fuera del total hasta tenerlas por escrito.',
  notaSperrkonto: { b: 'Sperrkonto (cuenta bloqueada):', t: 'la visa exige tener bloqueado ~11.904 €/año (992 €/mes) para visa de estudios, o ~13.092 €/año (1.091 €/mes) para Chancenkarte, visa de curso de idioma o búsqueda de empleo. Para procesos de más de 12 meses la embajada puede pedir la prueba por toda la duración, así que la cifra real suele ser mayor. No es un gasto perdido: se recupera mes a mes para vivir. Confirmar con la embajada.' },
  notaSueldo: { b: 'Cuándo empieza el sueldo:', t: 'se cuenta desde la FSP aprobada, con un margen de hasta 3 meses para conseguir el puesto. No hay plazo oficial: el objetivo es entrar directo, pero puede demorar.' },
  notaTasas: { b: 'De dónde salen las tasas de examen:', t: 'de la ordenanza de tasas oficial de cada Ärztekammer o autoridad del Land, verificada una por una el 30 de agosto de 2026. Lo marcado como «estimado» es cálculo nuestro, no dato oficial. Las tasas cambian: confirmar antes de comprometer un presupuesto.' },

  /* Mi evaluación por áreas */
  evaluacionTitulo: 'Mi evaluación por áreas',
  de100: '/100',
  bien: 'Bien',
  atencion: 'Atención',
  critico: 'Crítico',

  /* Closing line */
  firma: 'Medical Network LATAM · Análisis orientativo generado con mis respuestas · Tasas de examen verificadas en fuente oficial el 30/08/2026; el resto son estimaciones sujetas a cambio',
}
