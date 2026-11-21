-- =============================================================================
-- Checklist template: bw-medico_drittstaat.json
-- =============================================================================
-- Made by "npm run checklist-sql" from content/checklists/bw-medico_drittstaat.json.
-- Don't edit this file by hand: change the JSON and run the script again.
--
-- Paste this whole file into Supabase's SQL Editor and press "Run"
-- (after migration 7). See supabase/README.md, "Load a checklist template".
--
-- Safe to run again. Everything runs in one transaction: if any line fails,
-- nothing is changed.
--   - the template row (blocks, cover, cards) is added or replaced
--   - a step whose code already exists is updated in place, so ticks stay
--   - a new step is added
--   - a step of this Bundesland + route that came from a template
--     (source_code filled in) but is missing from the JSON gets
--     archived = true. Nothing is deleted. Items without a source_code are
--     never touched.
-- =============================================================================

begin;

-- A backslash in a text is just a backslash.
set local standard_conforming_strings = on;

-- Stop with a clear message if migration 7 isn't applied yet.
do $check$
begin
  if to_regclass('public.checklist_templates') is null
     or not exists (select 1 from public.routes where code = 'medico_drittstaat') then
    raise exception 'Apply migration 7 first (the table checklist_templates or the route is missing).';
  end if;
end
$check$;

-- 1. The template: block titles, cover texts and info cards
insert into public.checklist_templates (state, route, title, rules_label, generated_on, cover, blocks, cards)
values (
  'bw',
  'medico_drittstaat',
  'Expediente Baden-Württemberg · Médico · título de fuera de la UE (Drittstaat)',
  'Reforma del 01/11/2026',
  '2026-11-20'::date,
  '{"eyebrow":"Medical Network LATAM","titulo":"Expediente de {nombre}","subtitulo":"{perfil} · Los papeles que pide el Regierungspräsidium Stuttgart — Baden-Württemberg, con las reglas nuevas del 01/11/2026.","barra_de_avance":{"titulo":"Mi avance hacia la Approbation","hitos":["Papeles","Traducciones","Formularios","Entrega","Exámenes"]},"metricas":["Ahora mismo","Avance del expediente","Hasta entregar la solicitud","Hasta la Approbation"]}'::jsonb,
  '[{"bloque":1,"titulo":"Lo que puedes empezar hoy","subtitulo":"No depende de nadie más. Todo esto corre en paralelo, así que se arranca junto."},{"bloque":2,"titulo":"Las traducciones","subtitulo":"En cuanto tengas las copias de los documentos en español."},{"bloque":3,"titulo":"Los formularios y lo que caduca","subtitulo":"Lo que se firma, y los papeles con fecha de vencimiento: estos pueden ir después del sobre."},{"bloque":4,"titulo":"La entrega","subtitulo":"El sobre con los Nr. 1 a 11, en un solo envío."},{"bloque":5,"titulo":"Después de entregar","subtitulo":"Aquí manda la autoridad. Lo que sí depende de ti es prepararte mientras esperas."}]'::jsonb,
  '{"lo_que_cambio_con_la_reforma":{"titulo":"Lo que cambió el 01/11/2026 y te favorece","puntos":["Todo va en copia simple: ya no hacen falta copias certificadas ni originales.","La traducción puede ser al alemán o al inglés, y lo que está en inglés no se traduce.","La Kenntnisprüfung es la regla: no hay que marcar nada para elegirla.","Good Standing, antecedentes y certificado médico pueden ir después del sobre."]},"leyenda":"El recuadro es el número que ese documento tiene en la lista del Antrag (páginas 6 a 8). No es el orden en que hay que hacer las cosas: para eso están los bloques. Los puntos en gris, «no va ahora», no desaparecen a propósito: debajo de cada uno dice cuándo te tocaría.","sobre":{"titulo":"Cómo va el sobre, en el orden de la lista del Antrag","texto":"Primero el Antrag firmado (A) y después los documentos por su número. El funcionario tiene esta lista delante: encontrarlo todo en su sitio evita que te pidan cosas dos veces.","orden":["A · Antrag","1","2","3","4 (si aplica)","5 (si aplica)","6","7","8","9","10","11","12 (puede ir después)","13 (puede ir después)","15 (puede ir después)"],"nota_12_13_15":"Puede ir con el sobre o después, con menos de 3 meses al llegar al RP.","pie":"Solo por correo postal, todo en copia simple, cada documento grapado y cada traducción justo detrás de su documento. Se envía a: Regierungspräsidium Stuttgart, Referat 98, Ruppmannstraße 21, 70565 Stuttgart."},"mis_dudas":{"titulo":"Mis dudas para la próxima llamada","ayuda":"Lo que escribas aquí lo revisa Ivan antes de la llamada.","marcador_vacio":"Escribe aquí tus dudas o lo que quieras revisar en la próxima llamada. Se guarda solo."},"errores_frecuentes":{"titulo":"Errores que cuestan meses","puntos":[{"titulo":"Mandar el sobre sin el B2.","texto":"El Antrag y la Anlage 1 lo dicen expresamente: sin B2 no se presenta."},{"titulo":"Pedir demasiado pronto lo que caduca.","texto":"Good Standing, antecedentes y certificado médico valen 3 meses contados hasta que LLEGAN al RP. Ahora pueden ir después del sobre: aprovéchalo."},{"titulo":"Mandar originales.","texto":"El RP se queda con todo lo que recibe. Todo va en copia simple."},{"titulo":"Presentar incompleto.","texto":"Si falta algo lo piden una sola vez y dan 3 meses; después, en general, rechazo con tasa de 100 €."},{"titulo":"Instalarte en otro Bundesland al llegar.","texto":"Stuttgart deja de ser competente y hay que avisar enseguida."}]},"autoridad_y_costos":{"titulo":"La autoridad y los costos","filas":[{"etiqueta":"Bundesland","valor":"Baden-Württemberg"},{"etiqueta":"Ruta","valor":"{genero:Médico|Médica} · título de fuera de la UE"},{"etiqueta":"Autoridad","valor":"LAfG BW, Regierungspräsidium Stuttgart (Referat 98)"},{"etiqueta":"Dirección de envío","valor":"Regierungspräsidium Stuttgart, Referat 98, Ruppmannstraße 21, 70565 Stuttgart"},{"etiqueta":"Contacto","valor":"solo por su formulario web; no publican correo directo"},{"etiqueta":"Tasa de la FSP","valor":"420 € (la cobra la Landesärztekammer)"},{"etiqueta":"Tasa de la Kenntnisprüfung","valor":"1.100 € por intento (la cobra la Landesärztekammer)"},{"etiqueta":"Tasa de la Approbation","valor":"450 €"},{"etiqueta":"Tasa de la Berufserlaubnis","valor":"250 € hasta un año · 350 € si es de más de un año"},{"etiqueta":"Duración media (oficial, año pasado)","valor":"alrededor de 3 años"}],"otros_costos":"Rechazo de la solicitud: hasta 400 € según el estado; por documentos incompletos tras el plazo de 3 meses, 100 €. Retirarla: hasta 200 €. Gutachten, solo si lo pides: hasta 2.500 €, con anticipo de hasta 2.000 €. Traducciones y cursos de alemán van por tu cuenta.","contacto":"No atienden expedientes por teléfono: el contacto es por el formulario web del RP. Una sola oficina para todo el Land, aunque haya cuatro Regierungspräsidien."},"fuentes":{"titulo":"De dónde sale cada dato","oficial":"La lista de documentos y sus números, las caducidades, las tasas, las esperas orientativas (FSP 4 a 6 meses, Kenntnisprüfung 8 a 10, Gutachten hasta 15) y la duración media, que publica el propio RP.","estimacion":"Los demás «plazo estimado» de esta lista. Lo que viene de la asesoría de Freiburg está dicho así en el texto.","documentos":["Antrag del Regierungspräsidium Stuttgart, Stand 01/11/2026 (lista de documentos Nr. 1 a 18, páginas 6 a 8)","Anlage 1 y Anlage 6, Stand 29/10/2026","Anlagen 2 a 5 (sin cambios con la reforma)","Página de Medicina, FAQ y página de FSP del RP Stuttgart","FICHA BADEN-WUERTTEMBERG en Drive (versión del 09/11/2026, recomprobada el 18/11/2026)"],"fecha_de_version":"Antrag del 01/11/2026 y Anlage 1 y 6 del 29/10/2026, comprobados contra la web del Regierungspräsidium Stuttgart el 18/11/2026","consejo":"Antes de enviar, baja el Antrag otra vez de la web del RP por si cambió."},"pie":"Medical Network LATAM · La lista de documentos es la del Antrag de LAfG BW, Regierungspräsidium Stuttgart (Referat 98). Los plazos estimados son de experiencia, no promesas. La autoridad se reserva el derecho de pedir documentos adicionales."}'::jsonb
)
on conflict (state, route) do update set
  title        = excluded.title,
  rules_label  = excluded.rules_label,
  generated_on = excluded.generated_on,
  cover        = excluded.cover,
  blocks       = excluded.blocks,
  cards        = excluded.cards;

-- 2. The steps (26): added, or updated in place by their code
insert into public.checklist_items (
  code, state, route, source_code,
  block, sort_order, official_number, sobre_order,
  title, body, donde, plazo,
  aviso, caduca, na_default, na_reason
)
values
  ('bw-medico_drittstaat-n1', 'bw', 'medico_drittstaat', 'n1', 1, 1, '1', 2, 'Beratungsnachweis: la prueba de que el RP Stuttgart es competente', 'Es lo primero que revisa el RP: sin esto no mira nada, ni siquiera si el expediente está completo. Como vives en {pais}, vale UNO de estos: el Beratungsnachweis (§ 1a Anerkennungsberatungsgesetz BW), una prueba de vínculo familiar en Baden-Württemberg, o una Stellenzusage de un empleador de BW (Anlage 3). El Beratungsnachweis es gratis: es la constancia de haber recibido asesoría de la Bundesagentur für Arbeit o del IQ-Netzwerk, y la asesoría puede ser online, desde {pais}. Va en copia simple.', 'IQ-Netzwerk o Bundesagentur für Arbeit (asesoría online)', '1–2 meses', 'Desde la reforma hay una regla nueva (Anlage 1, A.5): si cuando llegues a Alemania te empadronas en OTRO Bundesland, Stuttgart deja de ser competente y tienes que avisar enseguida. Si vas por Baden-Württemberg, al llegar vives en Baden-Württemberg.', null, false, null),
  ('bw-medico_drittstaat-p1', 'bw', 'medico_drittstaat', 'p1', 1, 2, '2', 3, 'Pasaporte vigente', 'Copia simple del pasaporte o de la cédula vigentes. Un permiso de residencia o un visado NO sirven como identidad.', 'Tú', '1 semana', 'Revisa que no venza durante el trámite: el procedimiento dura años.', null, false, null),
  ('bw-medico_drittstaat-p2', 'bw', 'medico_drittstaat', 'p2', 1, 3, '3', 4, 'Lebenslauf en alemán, en tabla', 'Currículum EN ALEMÁN y en tabla, con todas las etapas de tu formación y todos tus trabajos, cada uno con periodo, lugar y país: colegio, carrera, internado, rural si la hiciste, y lo que haya después hasta hoy. El modelo está al final de la Anlage 1 y termina con la fecha. Copia simple o impreso. Se arma con el formulario de currículum de Medical Network LATAM.', 'Tú, con el formulario de currículum', '1–2 semanas', 'Que no quede ningún mes sin explicar desde que empezaste la carrera. Y que las fechas coincidan EXACTAMENTE con las de tus certificados.', null, false, null),
  ('bw-medico_drittstaat-bw4', 'bw', 'medico_drittstaat', 'bw4', 1, 4, '4', 5, 'Prueba de cambio de nombre', 'Solo si cambiaste de nombre alguna vez, por ejemplo al casarte.', 'Registro Civil', '1 mes', null, null, true, 'No aplica si nunca cambiaste de nombre. Si fuera tu caso, va el acta correspondiente.'),
  ('bw-medico_drittstaat-bw5', 'bw', 'medico_drittstaat', 'bw5', 1, 5, '5', 6, 'Partida de nacimiento (solo si el nombre se escribe distinto)', 'Partida de nacimiento u otra prueba oficial del nombre.', 'Registro Civil', '1 mes', null, null, true, 'Desde la reforma ya no es solo para países de habla árabe: hace falta si tu nombre aparece escrito de forma distinta en los documentos. Revisa que tus dos nombres y tus dos apellidos estén escritos igual en el pasaporte, el título, la habilitación y las traducciones. Si coinciden, no aplica.'),
  ('bw-medico_drittstaat-f1', 'bw', 'medico_drittstaat', 'f1', 1, 6, '6', 7, 'Título de medicina', 'Copia simple de tu título de medicina (con la apostilla, si la tiene pegada), unida a su traducción. Desde el 01/11/2026 ya NO hace falta copia certificada: todo va en copia simple. El título tiene que ser de medicina occidental.', 'Tu universidad', '1–2 semanas', 'No mandes nunca el original: el RP se queda con todo lo que recibe. Guarda tus originales: si dudan de un documento, pueden pedirlo.', null, false, null),
  ('bw-medico_drittstaat-f3', 'bw', 'medico_drittstaat', 'f3', 1, 7, '7', 8, 'Fächerindex: todas tus materias con horas y notas', 'Expedido por la universidad, a tu nombre: todos los años de la carrera, todas las materias, sus horas y tus notas. Copia simple con su traducción.', 'Tu universidad', '1–2 meses', 'Revísalo materia por materia antes de mandarlo a traducir: si falta una materia o está mal escrita, se corrige en la universidad, no en la traducción.', null, false, null),
  ('bw-medico_drittstaat-bw8', 'bw', 'medico_drittstaat', 'bw8', 1, 8, '8', 9, 'Constancia del internado rotativo completo', 'Constancia de que terminaste COMPLETA la fase práctica de la carrera. El RP da como ejemplos el Praktisches Jahr, la Internatur, la Ordinatur o el Rotating Internship: en {pais}, el internado rotativo. Copia simple con su traducción.', 'Tu facultad o el hospital del internado', '1–2 meses', null, null, false, null),
  ('bw-medico_drittstaat-bw9', 'bw', 'medico_drittstaat', 'bw9', 1, 9, '9', 10, 'Habilitación para ejercer en {pais}', 'Prueba de que estás {genero:habilitado|habilitada} para ejercer la medicina en {pais} (registro del título o licencia, como se llame allá). Copia simple con su traducción. Desde la reforma tampoco necesita copia certificada.', 'La autoridad que te habilitó en {pais}', '1–2 meses', 'Es distinto del título y del Good Standing: el título dice que estudiaste, este dice que puedes ejercer, y el Good Standing dice que ejerciste sin sanciones.', null, false, null),
  ('bw-medico_drittstaat-i1', 'bw', 'medico_drittstaat', 'i1', 1, 10, '10', 11, 'Certificado de alemán B2', 'Copia simple, sin traducción, anverso y reverso. Tiene que ser de un instituto miembro pleno de ALTE: Goethe-Institut, telc u ÖSD. Sin el B2 no se manda el sobre: el Antrag y la Anlage 1 lo dicen expresamente.', 'Goethe-Institut, telc u ÖSD', '1 semana', null, null, false, null),
  ('bw-medico_drittstaat-p0', 'bw', 'medico_drittstaat', 'p0', 1, 11, '—', null, 'Averiguar cuánto tardan los papeles que caducan', 'Son tres: el Good Standing (Nr. 12, si te toca), los antecedentes penales de {pais} (Nr. 13) y el certificado médico (Nr. 15). Los tres valen 3 meses contados hasta que LLEGAN al RP. Hoy no los pides: averiguas cuánto tarda cada uno, para pedirlos contando hacia atrás desde el día en que van a llegar.', 'Quien los emite en {pais}', '1–2 semanas', null, null, false, null),
  ('bw-medico_drittstaat-t1', 'bw', 'medico_drittstaat', 't1', 2, 12, '—', null, 'Traducción jurada al alemán (o al inglés)', 'Todo documento en español va con traducción COMPLETA al alemán o al inglés, de un traductor público o jurado, en Alemania o en el extranjero (también en {pais}). Basta una copia simple del documento en español unida (grapada) a la traducción, y la traducción va justo detrás de su documento. Si tus documentos llevan apostilla, la apostilla también se traduce. Lo que esté en inglés no se traduce.', 'Traductor público o jurado', '1–2 meses', null, null, false, null),
  ('bw-medico_drittstaat-e1', 'bw', 'medico_drittstaat', 'e1', 3, 13, 'Antrag', 1, 'Formulario de solicitud (Antrag del 01/11/2026)', 'El formulario NUEVO, versión del 01/11/2026, completo y firmado en la página 5. Página 1: Approbation. Página 4: si vas por la Kenntnisprüfung, NO marcas la casilla del Gutachten. Página 5: declaración de que no tienes otro procedimiento abierto en otro Bundesland, y la casilla voluntaria de notificación por e-mail. Bájalo de la web del RP el día que lo llenes.', 'Web del Regierungspräsidium Stuttgart', '1 semana', 'Si marcas la notificación por e-mail, desde el correo pueden empezar a correr plazos para recurrir: revísalo a diario, también el spam, y avisa enseguida si cambias de dirección.', null, false, null),
  ('bw-medico_drittstaat-bw_via', 'bw', 'medico_drittstaat', 'bw_via', 3, 14, 'pág. 4', null, 'Kenntnisprüfung o Gutachten: la decisión', 'Desde el 01/11/2026 la Kenntnisprüfung es la REGLA y no hay que marcar nada para elegirla. El Gutachten (comparar tus documentos con la carrera alemana) es la excepción: se pide con la casilla de la página 4 o por escrito dentro de las 4 SEMANAS siguientes a que el Antrag LLEGUE al RP, y la decisión es VINCULANTE. Con Gutachten van además el currículum de la carrera confirmado por la universidad (Nr. 16) y la Anlage 5 (Nr. 17); cuesta hasta 2.500 €, con anticipo de hasta 2.000 €, y se espera hasta 15 meses. Si encuentra una diferencia esencial en aunque sea una materia, igual hay que dar la Kenntnisprüfung.', 'Tú, con Ivan', '1 semana', 'El propio RP escribe que para muchos solicitantes de medicina la Kenntnisprüfung es el camino más rápido y más barato. Es una decisión de dinero y de meses, y no tiene marcha atrás: la cerramos juntos antes de firmar.', null, false, null),
  ('bw-medico_drittstaat-bw11', 'bw', 'medico_drittstaat', 'bw11', 3, 15, '11', 12, 'Anlage 4: inscripción a la Kenntnisprüfung', 'El formulario Anlage 4, lleno y firmado. Con la firma aceptas hacer la Kenntnisprüfung y pagarla (1.100 € por intento). Solo NO va si eliges el Gutachten.', 'Web del Regierungspräsidium Stuttgart', '1 semana', null, null, false, null),
  ('bw-medico_drittstaat-p3', 'bw', 'medico_drittstaat', 'p3', 3, 16, '12', 13, 'Certificate of Good Standing', 'Certificado de que no tienes procesos profesionales ni disciplinarios. Se pide de cada país donde EJERCISTE como {genero:médico|médica} al menos seis meses dentro de los últimos tres años. Lo emite el colegio médico o la autoridad competente. Copia simple con traducción.', 'Autoridad sanitaria o colegio médico de {pais}', '1–2 meses', null, 'Máximo 3 meses de antigüedad el día en que LLEGA al Regierungspräsidium, no el día en que lo pides. Desde la reforma puede ir con el sobre o después, sin declararlo en ninguna casilla, siempre antes de la Approbation.', false, 'Solo se pide si ejerciste al menos seis meses en los últimos tres años.'),
  ('bw-medico_drittstaat-p4', 'bw', 'medico_drittstaat', 'p4', 3, 17, '13', 14, 'Antecedentes penales de {pais}', 'De cada país donde viviste al menos seis meses en los últimos tres años: en tu caso, {pais}. Copia simple con traducción.', 'Policía o justicia de {pais}', '1 mes', null, 'Máximo 3 meses de antigüedad el día en que LLEGA al Regierungspräsidium, no el día en que lo pides. Desde la reforma puede ir con el sobre o después, sin declararlo en ninguna casilla, siempre antes de la Approbation.', false, null),
  ('bw-medico_drittstaat-e3', 'bw', 'medico_drittstaat', 'e3', 3, 18, '15', 15, 'Anlage 2: certificado médico de aptitud', 'Solo el formulario Anlage 2 del RP: otros no se aceptan. Lo firma CUALQUIER médico que ejerza en Alemania (de cabecera, de empresa, de hospital), con fecha, sello y firma. Un médico de {pais} no aparece como opción.', 'Un médico que ejerza en Alemania', '1–2 semanas', 'En la práctica lo sacas cuando llegues a Alemania y lo mandas después del sobre. El Antrag nuevo lo permite sin declarar nada.', 'Máximo 3 meses de antigüedad el día en que LLEGA al Regierungspräsidium, no el día en que lo pides. Desde la reforma puede ir con el sobre o después, sin declararlo en ninguna casilla, siempre antes de la Approbation.', false, null),
  ('bw-medico_drittstaat-bw16', 'bw', 'medico_drittstaat', 'bw16', 3, 19, '16 y 17', null, 'Solo con Gutachten: currículum de la carrera y Anlage 5', 'Currículum con contenidos y horas, confirmado por la universidad, y Kostenübernahmeerklärung.', 'Universidad', '1–2 meses', null, null, true, 'Solo si pides el Gutachten (al presentar o en las 4 semanas siguientes). Con la Kenntnisprüfung no van, ni tampoco certificados de trabajo ni de cursos.'),
  ('bw-medico_drittstaat-e4', 'bw', 'medico_drittstaat', 'e4', 4, 20, '—', null, 'Mandar el sobre', 'Solo por correo postal a Regierungspräsidium Stuttgart, Referat 98, Ruppmannstraße 21, 70565 Stuttgart. Van sí o sí los Nr. 1 a 11 (el 4 y el 5 solo si te aplican), más el Antrag firmado. Cada documento de varias páginas grapado, en el orden de la lista; sin fundas plásticas ni carpetas de clip. Todo en copia simple: nada de originales. Antes de cerrar, escanea todo tal como va, y mándalo con seguimiento.', 'Correo postal con seguimiento', '1–2 semanas', 'No lo mandes incompleto. Si falta algo, el RP lo pide UNA sola vez y da 3 meses; después decide con lo que hay, en general con un rechazo de 100 €.', null, false, null),
  ('bw-medico_drittstaat-b1', 'bw', 'medico_drittstaat', 'b1', 5, 21, '—', null, 'Acuse de recibo y carta para la visa', 'La FAQ del RP dice que el acuse de recibo llega dentro de un mes. Según la asesoría de Freiburg (no es la autoridad), a quien vive en el extranjero se lo mandan por e-mail, igual que la carta para la visa (§ 16d AufenthG) cuando el expediente está completo, y las esperas se alargaron algo con la reforma. En la secuencia que publica el RP para la Kenntnisprüfung no aparece un Defizitbescheid: lo que llevas a la embajada es esa carta. Ojo: la carta para la visa la confirman Freiburg y la Anlage 1 anterior; la Anlage 1 nueva ya no la menciona.', 'El Regierungspräsidium (por e-mail)', '1–3 meses', 'Pregunta en la embajada alemana en {pais} si aceptan la carta impresa desde el e-mail del RP. Freiburg no lo sabe y depende de cada embajada.', null, false, null),
  ('bw-medico_drittstaat-b2', 'bw', 'medico_drittstaat', 'b2', 5, 22, '—', null, 'Fachsprachprüfung (FSP)', 'Examen de alemán médico, orientado al C1. Cuando el expediente está completo el RP te inscribe solo en la Landesärztekammer, que te propone fecha y te cobra 420 € antes. Espera orientativa del RP: 4 a 6 meses. Aceptan en su lugar una FSP aprobada en otro Bundesland, la FaMed (rendida después del 13/05/2024), telc Deutsch B2/C1 Medizin o la ÖÄK Sprachprüfung, PERO solo si el comprobante va dentro del sobre. Vale 3 años; el tiempo trabajado con Berufserlaubnis la alarga.', 'Landesärztekammer Baden-Württemberg', '4–6 meses', 'El RP no mueve la fecha, tampoco para hacer un curso: prepárala desde ya, no cuando llegue la carta.', null, false, null),
  ('bw-medico_drittstaat-b3', 'bw', 'medico_drittstaat', 'b3', 5, 23, '18', null, 'Si la quieres: Berufserlaubnis para trabajar mientras tanto', 'Con la FSP aprobada y una Stellenzusage de un empleador de BW (Anlage 3) puedes pedirla en cualquier momento. Solo en BW, bajo supervisión, máximo 2 años por regla general, sin hacer la especialidad. Cuesta 250 € hasta un año y 350 € si es de más. Los tiempos de Berufserlaubnis de otros Bundesländer cuentan dentro de los dos años, y si no encuentras puesto el tiempo no se alarga.', 'La misma autoridad', '1–2 meses', 'Es voluntaria: para la Approbation no hace falta. Si decides no pedirla, márcalo como hecho.', null, false, null),
  ('bw-medico_drittstaat-b4', 'bw', 'medico_drittstaat', 'b4', 5, 24, '—', null, 'Kenntnisprüfung', 'Aprobada la FSP, el RP te inscribe automáticamente en la Landesärztekammer. Espera orientativa: 8 a 10 meses. Es en alemán, de un solo día: presentación de un paciente con examen e informe escrito, y conversación oral de 60 a 90 minutos. Materias: Medicina Interna y Cirugía, más urgencias, farmacología clínica, imagen, radioprotección, marco legal del ejercicio y comunicación con el paciente, la familia y otros profesionales. 1.100 € por intento, 3 intentos en total. Aprobada, el RP te pide el Führungszeugnis alemán (Nr. 14) y, si está todo, concede la Approbation.', 'Landesärztekammer Baden-Württemberg', '8–10 meses', 'La fecha no se mueve y la citación llega con poco margen: hay que estar {genero:listo|lista} antes de que llegue la carta. Si no te presentas sin un motivo importante, cuenta como intento.', null, false, null),
  ('bw-medico_drittstaat-p5', 'bw', 'medico_drittstaat', 'p5', 5, 25, '14', null, 'Führungszeugnis alemán Belegart OB (cuando el RP lo pida)', 'Aprobada la Kenntnisprüfung, el RP te pide el Führungszeugnis alemán. Lo pides SOLO entonces, Belegart «OB», en el Bürgeramt de tu domicilio o online en el Bundesamt für Justiz, con Verwendungszweck «Approbation als {genero:Arzt|Ärztin}», dirigido al Regierungspräsidium Stuttgart, Referat 98, a la atención de quien lleva tu expediente. Llega directo a ellos: no va en el sobre.', 'Bürgeramt o Bundesamt für Justiz', '1–3 semanas', null, 'Tiene que tener menos de 3 meses el día en que te CONCEDEN la Approbation. Por eso no se pide antes de que el RP lo indique.', false, null),
  ('bw-medico_drittstaat-b5', 'bw', 'medico_drittstaat', 'b5', 5, 26, '—', null, 'Recibir la Approbation en una dirección de Alemania', 'El certificado de Approbation se manda, en principio, solo a una dirección en Alemania (lo dice el Antrag). La duración media de los procedimientos terminados el año pasado en BW fue de alrededor de TRES AÑOS: es un dato del RP, no una promesa.', '—', '—', null, null, false, null)
on conflict (code) do update set
  source_code     = excluded.source_code,
  block           = excluded.block,
  sort_order      = excluded.sort_order,
  official_number = excluded.official_number,
  sobre_order     = excluded.sobre_order,
  title           = excluded.title,
  body            = excluded.body,
  donde           = excluded.donde,
  plazo           = excluded.plazo,
  aviso           = excluded.aviso,
  caduca          = excluded.caduca,
  na_default      = excluded.na_default,
  na_reason       = excluded.na_reason,
  archived        = false;

-- 3. Steps of this Bundesland + route from a template, missing from the JSON
update public.checklist_items
   set archived = true
 where state = 'bw'
   and route = 'medico_drittstaat'
   and source_code is not null
   and not archived
   and code not in (
    'bw-medico_drittstaat-n1',
    'bw-medico_drittstaat-p1',
    'bw-medico_drittstaat-p2',
    'bw-medico_drittstaat-bw4',
    'bw-medico_drittstaat-bw5',
    'bw-medico_drittstaat-f1',
    'bw-medico_drittstaat-f3',
    'bw-medico_drittstaat-bw8',
    'bw-medico_drittstaat-bw9',
    'bw-medico_drittstaat-i1',
    'bw-medico_drittstaat-p0',
    'bw-medico_drittstaat-t1',
    'bw-medico_drittstaat-e1',
    'bw-medico_drittstaat-bw_via',
    'bw-medico_drittstaat-bw11',
    'bw-medico_drittstaat-p3',
    'bw-medico_drittstaat-p4',
    'bw-medico_drittstaat-e3',
    'bw-medico_drittstaat-bw16',
    'bw-medico_drittstaat-e4',
    'bw-medico_drittstaat-b1',
    'bw-medico_drittstaat-b2',
    'bw-medico_drittstaat-b3',
    'bw-medico_drittstaat-b4',
    'bw-medico_drittstaat-p5',
    'bw-medico_drittstaat-b5'
   );

commit;

-- Check: active steps should be 26.
select count(*) filter (where not archived) as pasos_activos,
       count(*) filter (where archived)     as pasos_archivados
  from public.checklist_items
 where state = 'bw' and route = 'medico_drittstaat' and source_code is not null;
