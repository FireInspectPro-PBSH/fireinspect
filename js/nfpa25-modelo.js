/* ============================================================
   FireInspect Pro — Modelo NFPA 25 (Edición 2020)
   Checklists construidos desde las Tablas 5.1.1.2, 7.1.1.2,
   8.1.1.2, 9.1.1.2 y 13.1.1.2 de la norma.

   Cada ítem tiene:
   · categoria:  'I' Inspección · 'P' Prueba · 'M' Mantenimiento
   · periodicidad: semanal | mensual | trimestral | semestral |
                   anual | quinquenal  (agrupador de visita)
   · periodicidadTexto: detalle exacto cuando difiere (ej: "cada 3 años")
   Unidades fijas: Presión PSI, Caudal GPM (estándar NFPA).
   ============================================================ */

/* ——— Frecuencias de visita (acumulativas: una visita trimestral
       incluye también los ítems semanales y mensuales) ——— */
const NFPA25_FRECUENCIAS = [
  { id: 'semanal',    label: 'Semanal',    nivel: 1, icono: 'calendar-week'  },
  { id: 'mensual',    label: 'Mensual',    nivel: 2, icono: 'calendar-month' },
  { id: 'trimestral', label: 'Trimestral', nivel: 3, icono: 'calendar-stats' },
  { id: 'semestral',  label: 'Semestral',  nivel: 4, icono: 'calendar-time'  },
  { id: 'anual',      label: 'Anual',      nivel: 5, icono: 'calendar-star'  },
  { id: 'quinquenal', label: '3–5 Años',   nivel: 6, icono: 'calendar-repeat'},
];

const NFPA25_CATEGORIAS = {
  I: { label: 'Inspección',    color: '#1A5276' },
  P: { label: 'Prueba',        color: '#6C3483' },
  M: { label: 'Mantenimiento', color: '#117864' },
};

function nivelFrecuencia(periodicidad) {
  const mapa = { diaria:1, semanal:1, mensual:2, trimestral:3, semestral:4, anual:5, bienal:6, trienal:6, quinquenal:6 };
  return mapa[periodicidad] || 5;
}

function etiquetaFrecuencia(id) {
  return (NFPA25_FRECUENCIAS.find(f => f.id === id) || {}).label || id;
}

const NFPA25_MODELO = {

  /* ══════════════════════════════════════════════════════════
     TANQUES DE ALMACENAMIENTO DE AGUA — NFPA 25 Cap. 9
     Fuente: Tabla 9.1.1.2 (2020)
  ══════════════════════════════════════════════════════════ */
  tanque: {
    nombre: 'Reserva de agua (Tanque)',
    capitulo: 'NFPA 25 — Cap. 9',
    icono: 'droplet',
    color: '#1A5276',
    campos: [
      { id: 'capacidadM3',    label: 'Capacidad nominal (m³)',  tipo: 'numero', unidad: 'volumen_m3' },
      { id: 'nivelActual',    label: 'Nivel actual (%)',        tipo: 'numero' },
      { id: 'ultimoLlenado',  label: 'Fecha de último llenado', tipo: 'fecha' },
      { id: 'temperaturaAgua',label: 'Temperatura del agua (°F)', tipo: 'numero', opcional: true }
    ],
    checklist: [
      /* — SEMANAL — */
      { id: 't01', categoria: 'I', periodicidad: 'semanal',    ref: '§9.2.2',    criticidad: 'alta',
        texto: 'Sistema de calentamiento en servicio durante temporada fría (diaria si no hay alarmas de baja temperatura supervisadas)',
        periodicidadTexto: 'semanal en temporada de calentamiento' },
      /* — MENSUAL — */
      { id: 't02', categoria: 'I', periodicidad: 'mensual',    ref: '§9.2.1.2',  criticidad: 'alta',
        texto: 'Nivel de agua igual o superior al nivel de diseño — tanques SIN alarmas de nivel supervisadas' },
      { id: 't03', categoria: 'I', periodicidad: 'mensual',    ref: '§13.3.2',   criticidad: 'alta',
        texto: 'Válvulas de control en posición abierta, aseguradas (selladas/candado) o supervisadas' },
      /* — TRIMESTRAL — */
      { id: 't04', categoria: 'I', periodicidad: 'trimestral', ref: '§9.2.1.1',  criticidad: 'alta',
        texto: 'Nivel de agua correcto — tanques CON alarmas de nivel supervisadas conectadas a ubicación atendida' },
      { id: 't05', categoria: 'I', periodicidad: 'trimestral', ref: '§9.2.4.1',  criticidad: 'alta',
        texto: 'Exterior del tanque sin corrosión, fugas ni daños visibles' },
      { id: 't06', categoria: 'I', periodicidad: 'trimestral', ref: '§9.2.4.1',  criticidad: 'media',
        texto: 'Área circundante libre de acumulación de materiales, hielo o erosión del terreno' },
      { id: 't07', categoria: 'I', periodicidad: 'trimestral', ref: '§9.2.4.1',  criticidad: 'alta',
        texto: 'Estructura de soporte y cimientos sin daños ni asentamientos' },
      { id: 't08', categoria: 'I', periodicidad: 'trimestral', ref: '§9.2.4.1',  criticidad: 'media',
        texto: 'Pasarelas, escaleras y plataformas de acceso en buen estado' },
      { id: 't09', categoria: 'I', periodicidad: 'trimestral', ref: '§9.2.4.1',  criticidad: 'media',
        texto: 'Ventilaciones libres de obstrucciones y con mallas intactas' },
      /* — ANUAL — */
      { id: 't10', categoria: 'I', periodicidad: 'anual',      ref: '§9.2.4.5',  criticidad: 'media',
        texto: 'Superficies pintadas o revestidas sin desprendimientos ni corrosión bajo el revestimiento' },
      { id: 't11', categoria: 'I', periodicidad: 'anual',      ref: '§9.2.4.3',  criticidad: 'media',
        texto: 'Juntas de expansión sin fugas ni grietas' },
      { id: 't12', categoria: 'P', periodicidad: 'anual',      ref: '§9.3.2',    criticidad: 'alta',
        texto: 'Prueba del sistema de calentamiento del tanque (antes de la temporada de calentamiento)' },
      { id: 't13', categoria: 'P', periodicidad: 'anual',      ref: '§9.3.3',    criticidad: 'alta',
        texto: 'Prueba de alarmas de baja temperatura del agua (antes de la temporada fría)' },
      { id: 't14', categoria: 'P', periodicidad: 'anual',      ref: '§9.3.4',    criticidad: 'media',
        texto: 'Prueba de interruptores limitadores de alta temperatura del sistema de calentamiento' },
      { id: 't15', categoria: 'P', periodicidad: 'anual',      ref: '§9.3.5',    criticidad: 'alta',
        texto: 'Prueba de alarmas de nivel de agua (alto y bajo)', periodicidadTexto: 'cada 2 años o según fabricante' },
      { id: 't16', categoria: 'P', periodicidad: 'anual',      ref: '§13.3.3.1', criticidad: 'alta',
        texto: 'Prueba de estado de válvulas: operar cada válvula de control en todo su recorrido y retornar a posición' },
      { id: 't17', categoria: 'M', periodicidad: 'anual',      ref: '§9.4.2',    criticidad: 'media',
        texto: 'Mantenimiento del nivel de agua y purga de sedimentos según necesidad' },
      { id: 't18', categoria: 'M', periodicidad: 'anual',      ref: '§13.3.4',   criticidad: 'media',
        texto: 'Lubricación de vástagos de válvulas de control y operación completa' },
      /* — 3–5 AÑOS — */
      { id: 't19', categoria: 'I', periodicidad: 'quinquenal', ref: '§9.2.5.1.1', criticidad: 'alta',
        texto: 'Inspección INTERIOR — tanques de acero sin protección contra la corrosión', periodicidadTexto: 'cada 3 años' },
      { id: 't20', categoria: 'I', periodicidad: 'quinquenal', ref: '§9.2.5.1.2', criticidad: 'alta',
        texto: 'Inspección INTERIOR — todos los demás tanques (vaciado o con buzo/ROV)', periodicidadTexto: 'cada 5 años' },
      { id: 't21', categoria: 'P', periodicidad: 'quinquenal', ref: '§9.3.1',    criticidad: 'media',
        texto: 'Prueba de indicadores de nivel (recorrido completo)', periodicidadTexto: 'cada 5 años' },
      { id: 't22', categoria: 'P', periodicidad: 'quinquenal', ref: '§13.4',     criticidad: 'media',
        texto: 'Manómetros: calibrar o reemplazar', periodicidadTexto: 'cada 5 años' },
    ]
  },

  /* ══════════════════════════════════════════════════════════
     BOMBAS CONTRA INCENDIO — NFPA 25 Cap. 8
     Fuente: Tabla 8.1.1.2 y Tabla 8.1.2 (2020) + formularios ITM
  ══════════════════════════════════════════════════════════ */
  bomba: {
    nombre: 'Bomba contra incendio',
    capitulo: 'NFPA 25 — Cap. 8',
    icono: 'engine',
    color: '#D68910',
    campos: [
      { id: 'tipoBomba',       label: 'Tipo de bomba',              tipo: 'select', opciones: ['Eléctrica principal', 'Diesel', 'Jockey / compensadora'] },
      { id: 'presionArranque', label: 'Presión de arranque (PSI)',  tipo: 'numero', unidad: 'presion' },
      { id: 'presionTrabajo',  label: 'Presión de trabajo (PSI)',   tipo: 'numero', unidad: 'presion' },
      { id: 'caudalNominal',   label: 'Caudal nominal (GPM)',       tipo: 'numero', unidad: 'caudal',  opcional: true }
    ],
    checklist: [
      /* — SEMANAL — Inspección visual §8.2.2 */
      { id: 'b01', categoria: 'I', periodicidad: 'semanal',    ref: '§8.2.2(1)', criticidad: 'alta',
        texto: 'Caseta/cuarto de bombas: temperatura adecuada (≥40°F/4°C), ventilación, orden y limpieza, iluminación' },
      { id: 'b02', categoria: 'I', periodicidad: 'semanal',    ref: '§8.2.2(2)', criticidad: 'alta',
        texto: 'Sistema de bomba: válvulas de succión, descarga y bypass abiertas; tuberías sin fugas; presiones de succión y sistema normales; empaquetadura con goteo leve' },
      { id: 'b03', categoria: 'I', periodicidad: 'semanal',    ref: '§8.2.2(3)', criticidad: 'alta',
        texto: 'Sistema eléctrico: luz piloto de controlador encendida, luz de inversión de fase normal, interruptor de transferencia en normal' },
      { id: 'b04', categoria: 'I', periodicidad: 'semanal',    ref: '§8.2.2(4)', criticidad: 'alta',
        texto: 'Sistema diesel: tanque de combustible ≥ 2/3, nivel de aceite y refrigerante, cargador de baterías operando, agua de camisa con calefactor' },
      { id: 'b05', categoria: 'P', periodicidad: 'semanal',    ref: '§8.3.1.1',  criticidad: 'alta',
        texto: 'Prueba de funcionamiento SIN FLUJO (churn) — bomba DIESEL: 30 minutos; registrar presiones, RPM, tiempo de arranque, ruidos y temperaturas' },
      /* — MENSUAL — */
      { id: 'b06', categoria: 'P', periodicidad: 'mensual',    ref: '§8.3.1.2',  criticidad: 'alta',
        texto: 'Prueba de funcionamiento SIN FLUJO (churn) — bomba ELÉCTRICA: 10 minutos; registrar presiones, arranque automático desde caída de presión' },
      { id: 'b07', categoria: 'I', periodicidad: 'mensual',    ref: '§13.3.2',   criticidad: 'alta',
        texto: 'Válvulas de control del conjunto de bomba aseguradas en posición correcta (selladas/supervisadas)' },
      /* — TRIMESTRAL — */
      { id: 'b08', categoria: 'I', periodicidad: 'trimestral', ref: '§8.1.1.2',  criticidad: 'media',
        texto: 'Respiradero del cárter del motor diesel limpio y sin obstrucciones' },
      /* — ANUAL — Inspección */
      { id: 'b09', categoria: 'I', periodicidad: 'anual',      ref: '§8.3.6.4',  criticidad: 'alta',
        texto: 'Alineación de acoplamiento bomba-motor dentro de tolerancias' },
      { id: 'b10', categoria: 'I', periodicidad: 'anual',      ref: '§8.1.1.2',  criticidad: 'media',
        texto: 'Aislamiento de cables y conductores sin fisuras ni deterioro' },
      { id: 'b11', categoria: 'I', periodicidad: 'anual',      ref: '§8.1.1.2',  criticidad: 'media',
        texto: 'Sistema de escape y trampa de condensado de drenaje sin fugas ni corrosión' },
      { id: 'b12', categoria: 'I', periodicidad: 'anual',      ref: '§8.1.1.2',  criticidad: 'media',
        texto: 'Conexiones y mangueras flexibles sin grietas ni pérdidas' },
      { id: 'b13', categoria: 'I', periodicidad: 'anual',      ref: '§8.1.1.2',  criticidad: 'media',
        texto: 'Ventilaciones del tanque de combustible y tubería de rebose libres de obstrucciones' },
      { id: 'b14', categoria: 'I', periodicidad: 'anual',      ref: '§8.1.1.2',  criticidad: 'media',
        texto: 'Corrosión en placas de circuito impreso (PCB) del controlador: ausente' },
      { id: 'b15', categoria: 'I', periodicidad: 'anual',      ref: '§8.1.1.2',  criticidad: 'media',
        texto: 'Rejillas de succión de pozo húmedo libres, en su lugar y sin obstrucciones (también tras cada operación)' },
      /* — ANUAL — Prueba */
      { id: 'b16', categoria: 'P', periodicidad: 'anual',      ref: '§8.3.3.1',  criticidad: 'alta',
        texto: 'PRUEBA DE FLUJO ANUAL al 0%, 100% y 150% del caudal nominal — Curva de Desempeño (usar el módulo dedicado)' },
      { id: 'b17', categoria: 'P', periodicidad: 'anual',      ref: '§8.3.3.4',  criticidad: 'alta',
        texto: 'Prueba del interruptor de transferencia automática (simular falla de fuente normal)' },
      { id: 'b18', categoria: 'P', periodicidad: 'anual',      ref: '§8.3.3.5',  criticidad: 'alta',
        texto: 'Prueba de señales de alarma y supervisión del controlador de bomba' },
      { id: 'b19', categoria: 'P', periodicidad: 'anual',      ref: '§8.3.4.1',  criticidad: 'alta',
        texto: 'Prueba del combustible diesel: calidad y degradación (ASTM D975)' },
      { id: 'b20', categoria: 'P', periodicidad: 'anual',      ref: '§8.3.3',    criticidad: 'media',
        texto: 'Manómetros, transductores y medidores de flujo usados en las pruebas: calibrados' },
      { id: 'b21', categoria: 'P', periodicidad: 'anual',      ref: '§8.3.3.8',  criticidad: 'media',
        texto: 'Prueba del módulo de control electrónico (MCE) del motor diesel' },
      { id: 'b22', categoria: 'P', periodicidad: 'anual',      ref: '§13.5.7',   criticidad: 'alta',
        texto: 'Válvula de alivio principal: apertura y ajuste correctos durante la prueba de flujo' },
      /* — ANUAL — Mantenimiento (Tabla 8.1.2) */
      { id: 'b23', categoria: 'M', periodicidad: 'anual',      ref: 'T.8.1.2',   criticidad: 'alta',
        texto: 'Baterías: nivel de electrolito, densidad, terminales limpios y ajustados, carga de ecualización' },
      { id: 'b24', categoria: 'M', periodicidad: 'anual',      ref: 'T.8.1.2',   criticidad: 'alta',
        texto: 'Cambio de aceite lubricante y filtro de aceite (50 horas de operación o anual)' },
      { id: 'b25', categoria: 'M', periodicidad: 'anual',      ref: 'T.8.1.2',   criticidad: 'media',
        texto: 'Filtro de combustible: reemplazo; verificar agua y materiales extraños en el tanque' },
      { id: 'b26', categoria: 'M', periodicidad: 'anual',      ref: 'T.8.1.2',   criticidad: 'media',
        texto: 'Conexiones eléctricas de potencia y control: ajuste y limpieza (o según fabricante)' },
      { id: 'b27', categoria: 'M', periodicidad: 'anual',      ref: 'T.8.1.2',   criticidad: 'media',
        texto: 'Lubricación de acoplamientos y cojinetes de bomba y motor según fabricante' },
      /* — 3–5 AÑOS — */
      { id: 'b28', categoria: 'M', periodicidad: 'quinquenal', ref: 'T.8.1.2',   criticidad: 'media',
        texto: 'Componentes de transmisión con elastómeros (acoples de torsión): inspección/reemplazo', periodicidadTexto: 'cada 5 años o según fabricante' },
    ]
  },

  /* ══════════════════════════════════════════════════════════
     HIDRANTES Y RED PRIVADA — NFPA 25 Cap. 7 y 13
     Fuente: Tabla 7.1.1.2 y Tabla 13.1.1.2 (2020)
  ══════════════════════════════════════════════════════════ */
  hidrante: {
    nombre: 'Hidrantes y mangueras',
    capitulo: 'NFPA 25 — Cap. 7 y 13',
    icono: 'fire-hydrant',
    color: '#117864',
    campos: [
      { id: 'tipoHidrante',    label: 'Tipo',                           tipo: 'select', opciones: ['Exterior — barril húmedo', 'Exterior — barril seco', 'Interior (gabinete)'] },
      { id: 'presionEstatica', label: 'Presión estática (PSI)',          tipo: 'numero', unidad: 'presion' },
      { id: 'presionResidual', label: 'Presión residual (PSI)',          tipo: 'numero', unidad: 'presion', opcional: true },
      { id: 'caudalMedido',    label: 'Caudal medido (GPM)',             tipo: 'numero', unidad: 'caudal',  opcional: true },
      { id: 'longitudManguera',label: 'Longitud de manguera (ft)',       tipo: 'numero', opcional: true }
    ],
    checklist: [
      /* — SEMANAL / MENSUAL — */
      { id: 'h01', categoria: 'I', periodicidad: 'semanal',    ref: '§13.3.2.1',   criticidad: 'alta',
        texto: 'Válvulas de control NO supervisadas: posición abierta correcta y accesibles' },
      { id: 'h02', categoria: 'I', periodicidad: 'mensual',    ref: '§13.3.2.1.1', criticidad: 'alta',
        texto: 'Válvulas de control bloqueadas o supervisadas eléctricamente: posición y sellos correctos' },
      /* — TRIMESTRAL — */
      { id: 'h03', categoria: 'I', periodicidad: 'trimestral', ref: '§13.8.1',     criticidad: 'alta',
        texto: 'Conexión del cuerpo de bomberos (FDC): accesible, tapas colocadas, juntas en buen estado, válvula de retención sin pérdidas, drenada' },
      { id: 'h04', categoria: 'I', periodicidad: 'trimestral', ref: '§7.2.2.8',    criticidad: 'media',
        texto: 'Casetas de mangueras: accesibles, completas y con equipamiento en buen estado' },
      { id: 'h05', categoria: 'P', periodicidad: 'trimestral', ref: '§13.3.3.5',   criticidad: 'media',
        texto: 'Dispositivos de supervisión de válvulas: señal a las dos vueltas del volante o cambio de posición' },
      /* — SEMESTRAL — */
      { id: 'h06', categoria: 'I', periodicidad: 'semestral',  ref: '§7.2.2.7',    criticidad: 'media',
        texto: 'Boquillas monitoras: sin daños ni corrosión, engrasadas y con movimiento libre' },
      /* — ANUAL — */
      { id: 'h07', categoria: 'I', periodicidad: 'anual',      ref: '§7.2.2.4',    criticidad: 'alta',
        texto: 'Hidrantes de barril seco/pared (y tras cada operación): sin agua/hielo en barril, drenaje correcto, sin fugas ni grietas, roscas y tuerca operativa en buen estado, llave disponible' },
      { id: 'h08', categoria: 'I', periodicidad: 'anual',      ref: '§7.2.2.5',    criticidad: 'alta',
        texto: 'Hidrantes de barril húmedo (y tras cada operación): accesibles, sin fugas en bocas ni tapa, roscas en buen estado' },
      { id: 'h09', categoria: 'I', periodicidad: 'anual',      ref: '§7.2.2.1',    criticidad: 'media',
        texto: 'Tubería y accesorios expuestos: sin pérdidas, corrosión ni daños mecánicos, soportes correctos' },
      { id: 'h10', categoria: 'I', periodicidad: 'anual',      ref: '§7.2.2.3',    criticidad: 'media',
        texto: 'Filtros de succión de línea principal (y tras cada flujo significativo): sin taponamiento, incrustaciones ni corrosión' },
      { id: 'h11', categoria: 'P', periodicidad: 'anual',      ref: '§7.3.2',      criticidad: 'alta',
        texto: 'Prueba de flujo de hidrantes: apertura total hasta agua clara, verificar caudal y cierre sin golpe de ariete' },
      { id: 'h12', categoria: 'P', periodicidad: 'anual',      ref: '§7.3.3',      criticidad: 'media',
        texto: 'Boquillas monitoras: prueba de rango y operación en todo su recorrido' },
      { id: 'h13', categoria: 'P', periodicidad: 'anual',      ref: '§13.2.3',     criticidad: 'alta',
        texto: 'Prueba de drenaje principal (main drain) en cada entrada de suministro: registrar presiones estática y residual y comparar con años anteriores' },
      { id: 'h14', categoria: 'P', periodicidad: 'anual',      ref: '§13.3.3.1',   criticidad: 'alta',
        texto: 'Prueba de estado de válvulas: operar cada válvula de control en su recorrido completo y retornar' },
      { id: 'h15', categoria: 'P', periodicidad: 'anual',      ref: '§13.7',       criticidad: 'alta',
        texto: 'Dispositivo de prevención de contraflujo: prueba anual (flujo directo según demanda del sistema)' },
      { id: 'h16', categoria: 'M', periodicidad: 'anual',      ref: '§7.4.2',      criticidad: 'media',
        texto: 'Hidrantes: lubricación de tuerca operativa, roscas y tapas' },
      { id: 'h17', categoria: 'M', periodicidad: 'anual',      ref: '§13.3.4',     criticidad: 'media',
        texto: 'Válvulas de control: lubricar vástago, operar recorrido completo y ajustar prensaestopas' },
      /* — 3–5 AÑOS — */
      { id: 'h18', categoria: 'P', periodicidad: 'quinquenal', ref: '§7.3.1',      criticidad: 'alta',
        texto: 'Prueba de flujo de tuberías subterráneas y expuestas: comparar con resultados de diseño/aceptación', periodicidadTexto: 'cada 5 años' },
      { id: 'h19', categoria: 'P', periodicidad: 'quinquenal', ref: '§13.4',       criticidad: 'media',
        texto: 'Manómetros: calibrar o reemplazar', periodicidadTexto: 'cada 5 años' },
    ]
  },

  /* ══════════════════════════════════════════════════════════
     ROCIADORES — NFPA 25 Cap. 5 y 13
     Fuente: Tabla 5.1.1.2 y Tabla 13.1.1.2 (2020)
  ══════════════════════════════════════════════════════════ */
  rociador: {
    nombre: 'Rociadores (RISER / ECA)',
    capitulo: 'NFPA 25 — Cap. 5',
    icono: 'spray',
    color: '#C0392B',
    campos: [
      { id: 'tipoSistemaRociador', label: 'Tipo de sistema', tipo: 'select', opciones: ['Tubería húmeda (wet pipe)', 'Tubería seca (dry pipe)', 'Diluvio (deluge)', 'Acción previa (pre-action)'] },
      { id: 'presionRiser',        label: 'Presión en RISER (PSI)',              tipo: 'numero', unidad: 'presion' },
      { id: 'caudalFlowTest',      label: 'Caudal flow test (GPM)',              tipo: 'numero', unidad: 'caudal',  opcional: true },
      { id: 'cantidadRociadores',  label: 'Cantidad de rociadores inspeccionados', tipo: 'numero' },
      { id: 'edadRociadores',      label: 'Año de fabricación (más antiguo)',    tipo: 'numero', opcional: true }
    ],
    checklist: [
      /* — SEMANAL — */
      { id: 'r01', categoria: 'I', periodicidad: 'semanal',    ref: '§13.4.4',    criticidad: 'alta',
        texto: 'Manómetros de sistemas SECOS y de ACCIÓN PREVIA: presiones de aire y agua en proporción normal' },
      { id: 'r02', categoria: 'I', periodicidad: 'semanal',    ref: '§13.3.2.1',  criticidad: 'alta',
        texto: 'Válvulas de control NO supervisadas (incluida válvula del RISER): abiertas, accesibles y señalizadas' },
      /* — MENSUAL — */
      { id: 'r03', categoria: 'I', periodicidad: 'mensual',    ref: '§5.2.4',     criticidad: 'alta',
        texto: 'Manómetros de sistemas HÚMEDOS: en buen estado y con presión normal de agua conservada' },
      { id: 'r04', categoria: 'I', periodicidad: 'mensual',    ref: '§13.3.2.1.1',criticidad: 'alta',
        texto: 'Válvulas de control bloqueadas o supervisadas: posición, sellos y candados correctos' },
      /* — TRIMESTRAL — */
      { id: 'r05', categoria: 'I', periodicidad: 'trimestral', ref: '§13.8.1',    criticidad: 'alta',
        texto: 'Conexión del cuerpo de bomberos (FDC): accesible, tapas y juntas en buen estado, drenada' },
      { id: 'r06', categoria: 'P', periodicidad: 'trimestral', ref: '§5.3.3.1',   criticidad: 'alta',
        texto: 'Prueba de dispositivos de alarma MECÁNICOS (motor de agua y gong)' },
      { id: 'r07', categoria: 'I', periodicidad: 'trimestral', ref: '§5.2.7',     criticidad: 'media',
        texto: 'Cinta calefactora de tuberías (heat trace) operativa en zonas expuestas a congelamiento' },
      /* — SEMESTRAL — */
      { id: 'r08', categoria: 'P', periodicidad: 'semestral',  ref: '§5.3.3.2',   criticidad: 'alta',
        texto: 'Prueba de dispositivos de alarma de flujo tipo INTERRUPTOR DE PRESIÓN y de PALETA (vane)' },
      /* — ANUAL — */
      { id: 'r09', categoria: 'I', periodicidad: 'anual',      ref: '§5.2.1',     criticidad: 'alta',
        texto: 'Rociadores (desde nivel de piso): sin corrosión, carga extraña, pintura no original, daños ni fugas; orientación correcta; espacio libre de 18 in (45 cm) bajo deflectores' },
      { id: 'r10', categoria: 'I', periodicidad: 'anual',      ref: '§5.2.2',     criticidad: 'alta',
        texto: 'Tuberías y accesorios (desde nivel de piso): sin fugas, corrosión, desalineación ni cargas ajenas' },
      { id: 'r11', categoria: 'I', periodicidad: 'anual',      ref: '§5.2.3',     criticidad: 'alta',
        texto: 'Soportes colgantes, riostras sísmicas y demás soportes: firmes, sin daños ni desprendimientos' },
      { id: 'r12', categoria: 'I', periodicidad: 'anual',      ref: '§5.2.5–5.2.9', criticidad: 'media',
        texto: 'Letreros informativos y placa de diseño hidráulico: presentes, legibles y asegurados' },
      { id: 'r13', categoria: 'I', periodicidad: 'anual',      ref: '§5.2.1.4',   criticidad: 'media',
        texto: 'Gabinete de rociadores de repuesto: cantidad y tipos correctos, llave de instalación presente' },
      { id: 'r14', categoria: 'P', periodicidad: 'anual',      ref: '§13.2.3',    criticidad: 'alta',
        texto: 'Prueba de drenaje principal (main drain) en cada montante: registrar estática/residual y comparar con históricos' },
      { id: 'r15', categoria: 'P', periodicidad: 'anual',      ref: '§5.3.4',     criticidad: 'alta',
        texto: 'Solución anticongelante: verificar concentración y punto de congelamiento' },
      { id: 'r16', categoria: 'P', periodicidad: 'anual',      ref: '§13.3.3.1',  criticidad: 'alta',
        texto: 'Prueba de estado de válvulas del sistema: recorrido completo y retorno a posición' },
      { id: 'r17', categoria: 'M', periodicidad: 'anual',      ref: '§5.4.1',     criticidad: 'alta',
        texto: 'Drenajes de punto bajo en sistemas secos/acción previa: drenar antes de la temporada de heladas' },
      { id: 'r18', categoria: 'M', periodicidad: 'anual',      ref: '§5.4.1.9',   criticidad: 'alta',
        texto: 'Rociadores y boquillas que protegen cocinas comerciales y ductos de ventilación: reemplazo o ensayo anual' },
      { id: 'r19', categoria: 'M', periodicidad: 'anual',      ref: '§13.3.4',    criticidad: 'media',
        texto: 'Válvulas (todos los tipos): lubricación y operación de mantenimiento' },
      /* — 3–5 AÑOS — */
      { id: 'r20', categoria: 'I', periodicidad: 'quinquenal', ref: '§14.2',      criticidad: 'alta',
        texto: 'Evaluación de la condición interna de tuberías (inspección por obstrucciones)', periodicidadTexto: 'cada 5 años' },
      { id: 'r21', categoria: 'P', periodicidad: 'quinquenal', ref: '§5.3.1.1',   criticidad: 'alta',
        texto: 'Muestreo y ensayo de rociadores por antigüedad: 50 años (luego c/10) · respuesta rápida a los 20 (luego c/10) · secos a los 15 (luego c/10) · temperatura extra-alta y entornos adversos c/5', periodicidadTexto: 'según antigüedad' },
      { id: 'r22', categoria: 'P', periodicidad: 'quinquenal', ref: '§13.4',      criticidad: 'media',
        texto: 'Manómetros: calibrar o reemplazar', periodicidadTexto: 'cada 5 años' },
    ]
  }
};

/* Calcula el % de cumplimiento ponderado por criticidad */
function calcularCumplimiento(itemsChecklist, respuestas) {
  if (!itemsChecklist || itemsChecklist.length === 0) return 100;
  let puntosTotal = 0, puntosObtenidos = 0;
  itemsChecklist.forEach(item => {
    const peso = item.criticidad === 'alta' ? 2 : 1;
    puntosTotal += peso;
    const r = respuestas[item.id];
    if (r === true || r === 'ok') puntosObtenidos += peso;
    else if (r === 'na')          puntosTotal   -= peso;
  });
  if (puntosTotal === 0) return 100;
  return Math.round((puntosObtenidos / puntosTotal) * 100);
}

function estadoPorCumplimiento(porcentaje) {
  if (porcentaje >= 85) return { nivel: 'ok',     label: 'Conforme',    color: '#1E8449' };
  if (porcentaje >= 70) return { nivel: 'warn',   label: 'Observado',   color: '#D68910' };
  return                       { nivel: 'danger', label: 'No conforme', color: '#C0392B' };
}

window.NFPA25 = {
  MODELO: NFPA25_MODELO,
  FRECUENCIAS: NFPA25_FRECUENCIAS,
  CATEGORIAS: NFPA25_CATEGORIAS,
  nivelFrecuencia, etiquetaFrecuencia,
  calcularCumplimiento, estadoPorCumplimiento
};
