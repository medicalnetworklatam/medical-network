/* ------------------------------------------------------------------
   Every text on the home page (/), from the copy deck in
   design-reference/landing-v2/COPY.md (DECISIONS.md, "Changes on 24 Nov
   2026"). Change a text here only: src/pages/Home.tsx and the pieces in
   src/pages/home/ read them from this file. Keep COPY.md in step.

   Two marks inside a text (the same as in COPY.md), turned into page
   markup by src/lib/richText.ts, never inserted as HTML:
     **words**   highlighted words (cream semibold on dark sections, the
                 darker muted teal on light ones)
     *Wort*      a German word: read out in German (lang="de"), it looks
                 the same as the words around it
   They can be combined: **Ruta *Approbation***.

   Texts kept word for word from the page before 24 Nov 2026 are marked
   [igual]. Facts about the owner that he must OK on the preview are
   marked [dueño].

   "Agenda tu llamada gratuita" (every Calendly button) lives in
   src/pages/home/CallLink.tsx, and "Cerrar sesión" in
   src/pages/SessionButton.tsx: both are shared, so they stay there.
------------------------------------------------------------------- */

/** The site's own photos the page may use (mapped to files in Home.tsx) */
export type HomePhoto =
  | 'antes'
  | 'hoy'
  | 'quirofano'
  | 'edificio'
  | 'lagoon'
  | 'heroHouse'
  | 'ejecucion'

/** The sections the header and footer link to: the id is the address
    after "#" (medicalnetworklatam.com/#historias) */
export const sections = [
  { id: 'quien-soy', label: 'Quién soy' },
  { id: 'historias', label: 'Historias' },
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'que-incluye', label: 'Qué incluye' },
  { id: 'ruta-approbation', label: 'Ruta *Approbation*' },
  { id: 'preguntas', label: 'Preguntas' },
] as const

export type SectionId = (typeof sections)[number]['id']

export const home = {
  header: {
    /** The name on the left: a link to the top of the page */
    name: 'Medical Network LATAM',
    menu: 'Menú',
    login: 'Entrar',
    myArea: 'Mi área',
    /** Screen readers only: the list of section links */
    navLabel: 'Secciones',
  },

  hero: {
    // REVISIT EVERY YEAR: "2027" is the year a visitor would start. Change
    // it each autumn (e.g. to 2028 in late 2027), or the page sounds old.
    titleLead:
      'Si quieres que 2027 sea el año en que empieces a homologar tu título y a ejercer medicina en Alemania…',
    titleRest:
      'Aquí aprendes a hacerlo con **Ruta *Approbation***, un plan claro que convierte la burocracia alemana en pasos concretos.',
    callNote: 'Dura unos 30 minutos. Sin costo.', // [igual]
    /** The portrait (a placeholder, hoy.jpg, until the owner's cut-out
        portrait): the same words as on the old page [igual] */
    portraitAlt: 'Iván hoy, en quirófano con gorro y mascarilla',
  },

  strip: {
    label: 'Te acompaño si eres:',
    // [dueño] the four routes (DECISIONS.md, 20 Nov 2026)
    items: [
      'Médico con título de fuera de la UE',
      'Médico con título de la UE, el EEE o Suiza',
      'Dentista con título de fuera de la UE',
      'Dentista con título de la UE, el EEE o Suiza',
    ],
    pause: 'Pausar la cinta',
    resume: 'Reanudar la cinta',
  },

  stories: {
    title: 'Historias de **homologación**',
    /** Screen readers: the carousel's name */
    label: 'Historias de homologación',
    cards: [
      {
        // [igual] Andrea's consent: DECISIONS.md, 23 Nov 2026
        quote:
          '“Le recomendaría la asesoría con Iván a todos los médicos latinos que ya están seguros de querer venir a Alemania, para que no se equivoquen en el camino.”',
        name: 'Andrea',
        role: 'Cliente actual',
        photo: null,
        alt: '',
      },
      {
        quote: '“Yo también empecé confundido. Por eso creé Ruta *Approbation*.”',
        name: 'Iván Bruckner',
        role: 'Mi propio proceso: de mi llegada en 2015 a la *Approbation* en 2017, y después la especialidad.',
        photo: 'quirofano',
        alt: 'Iván con colegas en un quirófano', // [igual]
      },
    ] satisfies { quote: string; name: string; role: string; photo: HomePhoto | null; alt: string }[],
  },

  about: {
    title: '¿Quién es **tu guía?**',
    subtitle: 'De recién llegado a especialista',
    /** Screen readers: the list of year cards */
    label: 'Mi camino',
    // [dueño] every card. Photos marked "placeholder" wait for the owner's.
    cards: [
      { year: '2015', text: 'Me gradúo de médico y llego a Alemania', photo: 'antes', alt: 'Iván de joven, con una camiseta de rayas verdes' },
      { year: '2017', text: 'Obtengo la *Approbation*', photo: 'edificio', alt: '' }, // placeholder
      { year: 'Después', text: 'Hago mi especialidad', photo: 'lagoon', alt: '' }, // placeholder
      { year: 'Hoy', text: 'Trabajo como especialista en un hospital alemán', photo: 'hoy', alt: 'Iván hoy, en quirófano con gorro y mascarilla' },
      { year: 'Y ahora', text: 'Creo Ruta *Approbation* para acompañar a otros médicos', photo: 'heroHouse', alt: '' }, // placeholder
    ] satisfies { year: string; text: string; photo: HomePhoto; alt: string }[],
    // [dueño]
    paragraph:
      '**Soy Iván Bruckner Calahorrano**, médico ecuatoriano. Viví en carne propia **la burocracia alemana**: me gradué en 2015, ese mismo año llegué a Alemania y en 2017 obtuve la *Approbation*. Hoy trabajo como especialista en un hospital alemán y te enseño **la ruta que a mí me faltó al empezar**.',
  },

  phases: {
    title: 'Tu ruta en 3 **fases**',
    label: 'Las 3 fases',
    resultLabel: 'Resultado',
    // [igual] every text of the three phases
    cards: [
      {
        num: '01',
        title: 'Planificación',
        intro:
          'Empezamos por lo importante: tu objetivo. Defino contigo la ruta exacta que debes seguir y el orden de cada paso, para que dejes de adivinar. Tú decides tus prioridades, incluso cómo vas a aprender alemán.',
        items: [],
        result: 'Sabes exactamente por dónde empezar y cuál es tu siguiente paso.',
        photo: 'lagoon',
      },
      {
        num: '02',
        title: 'Documentación',
        intro:
          'Tú reúnes tus documentos, pero no vas a ciegas: yo te digo exactamente cuáles necesitas y los reviso contigo antes de seguir. Mientras tanto, trabajamos en paralelo en:',
        items: [
          'Aprender alemán',
          'Elegir tu escuela de idiomas, con mi ayuda',
          'Planificar tu estadía en Alemania, con mi ayuda',
          'Preparar juntos los siguientes pasos',
        ],
        result:
          'Dejamos tu documentación lista y en regla, sin meses de espera innecesarios, y te acompañamos en cada paso de tu llegada.',
        photo: 'heroHouse',
      },
      {
        num: '03',
        title: 'Ejecución',
        intro:
          'Ya en Alemania, tú ejecutas cada paso y yo estoy a tu lado para que no te frenes ni te pierdas:',
        items: [
          'Hacer un curso intensivo de alemán',
          'Presentar tu solicitud de homologación, con mi guía',
          'Conseguir *Hospitationen*, cuando sea posible, con mi ayuda',
          'Valorar un posible *Nebenjob* para cubrir parte de tus gastos, según tu situación',
        ],
        result: 'Das cada paso con un plan claro y yo te acompaño hasta tu homologación.',
        photo: 'ejecucion',
      },
    ] satisfies { num: string; title: string; intro: string; items: string[]; result: string; photo: HomePhoto }[],
  },

  includes: {
    title: 'Qué **incluye**',
    label: 'Qué incluye',
    // [igual]
    subtitle:
      'Acompañamiento durante todo tu proceso. No hay una duración fija: cada homologación avanza a su propio ritmo, y el acompañamiento sigue el tuyo.',
    // [igual] every title and text; the mint line is "Incluido" or "Bono"
    cards: [
      {
        title: 'Tu plataforma MNL',
        tag: 'Incluido',
        text: 'Un área privada solo para clientes: tu expediente paso a paso según tu *Bundesland* y tu ruta, las novedades de tu estado, la Comunidad MNL, el chat de tu *Bundesland*, tus documentos y la herramienta para tu currículum. Incluye acceso gratuito a las nuevas herramientas que se desarrollen.',
      },
      { title: 'Agenda de videollamadas conmigo', tag: 'Incluido', text: 'Para revisar avances, objetivos y próximos pasos.' },
      { title: 'WhatsApp directo conmigo', tag: 'Incluido', text: 'Para dudas y situaciones importantes.' },
      { title: 'Acompañamiento en cada etapa', tag: 'Incluido', text: 'Planificación, documentación y ejecución.' },
      { title: 'Guía de diagnóstico', tag: 'Bono', text: 'Tiempos y costos aproximados del proceso.' },
      // (word joiners around the dash keep "A1–B1" on one line)
      { title: 'Guía de alemán A1⁠–⁠B1', tag: 'Bono', text: 'Ejercicios y prompts de IA.' },
      { title: 'Guía de preparación FSP', tag: 'Bono', text: 'Material de apoyo para preparar la *Fachsprachprüfung*.' },
      {
        title: 'Cooperaciones',
        tag: 'Bono',
        text: 'Curso de preparación FSP online desde tu país con perfectgerman, con 50 % de descuento, y posibilidad de una beca BAMF para un curso de preparación FSP al estar en Alemania.',
      },
    ] satisfies { title: string; tag: 'Incluido' | 'Bono'; text: string }[],
    total: 'Todo incluido: pago único **3.500 €**.', // [igual] (the price highlighted)
  },

  price: {
    title: 'Ruta *Approbation*',
    subtitle: 'con Iván Bruckner',
    pillSmall: 'Pago único',
    pillBig: '3.500 €',
    paragraph:
      'Ruta *Approbation* no es un curso ni una agencia que hace los trámites por ti: es un acompañamiento personal durante todo tu proceso. Te digo con claridad qué hacer, en qué orden y qué evitar, revisamos juntos tus documentos y avanzas con un plan, no a ciegas.',
    line: 'Tu homologación necesita una ruta.', // [igual]
    callNote: 'Dura unos 30 minutos. Sin costo.', // [igual]
    signoff: 'Nos vemos en Alemania', // [igual]
  },

  faq: {
    title: 'Preguntas **frecuentes**',
    // [igual] the owner's texts, word for word
    items: [
      {
        q: '¿Haces el proceso de homologación por mí?',
        a: 'No. Ruta *Approbation* te enseña cómo hacerlo y te acompaña mientras avanzas. Las acciones las ejecutas tú, con un plan claro y criterio para cada decisión.',
      },
      {
        q: '¿Cuánto dura el programa?',
        a: 'No tiene una duración fija. El acompañamiento dura lo que dure tu proceso de homologación, que puede variar considerablemente según cada caso.',
      },
      {
        q: '¿Me garantizas la homologación o un tiempo determinado?',
        a: 'No. Nadie puede garantizar con honestidad el resultado ni los tiempos: dependen de tu caso, de las autoridades y de tu ejecución. Lo que sí obtienes es un plan claro para reducir errores y evitar tiempos innecesarios.',
      },
      {
        q: '¿Cómo es el acompañamiento?',
        a: 'Agenda de videollamadas conmigo y comunicación directa por WhatsApp para dudas y situaciones importantes, durante las diferentes etapas del proceso.',
      },
      {
        q: '¿Qué necesito para aplicar?',
        a: 'Ser médico graduado y habilitado para ejercer tu profesión, y estar dispuesto a trabajar por tus objetivos, ejecutar las tareas y participar activamente.',
      },
      {
        q: '¿Qué métodos de pago aceptas?',
        a: 'Tarjeta de crédito, PayPal, Apple Pay, Google Pay, Amazon Pay y Klarna. El precio es de 3.500 €, pago único.',
      },
      {
        // Ivan's choice (23 Nov 2026), for the law firm to check. No link:
        // the Widerrufsbelehrung doesn't exist on the site yet.
        q: '¿Tengo derecho de desistimiento?',
        a: 'Tienes un derecho de desistimiento de 14 días según §§ 312g, 355 BGB (*Widerrufsrecht*). Los detalles están en la *Widerrufsbelehrung*. Esto no es una garantía de resultado.',
      },
    ],
  },

  client: {
    title: '¿Ya eres **cliente?**',
    paragraph:
      'Si ya formas parte de Ruta *Approbation*, **accede directamente a tu plataforma MNL** para seguir tu expediente paso a paso y ver las novedades de tu *Bundesland*.',
    login: 'Entrar', // logged in: header.myArea ("Mi área")
    /** Logged out only, with a Calendly pill under it */
    notYet: '¿Aún no eres cliente? Empecemos por tu caso.',
  },

  footer: {
    copyright: '© 2026 Medical Network LATAM. Todos los derechos reservados.',
  },

  /** The carousels' buttons and what screen readers hear */
  carousel: {
    prev: 'Anterior',
    next: 'Siguiente',
    goTo: (n: number) => `Ir a la tarjeta ${n}`,
    status: (n: number, total: number) => `Tarjeta ${n} de ${total}`,
    /** What a single card is called (aria-roledescription) */
    card: 'tarjeta',
    carousel: 'carrusel',
  },
}
