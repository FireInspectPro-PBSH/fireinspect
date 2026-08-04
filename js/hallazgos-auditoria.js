/* ============================================================
   FireInspect Pro — Hallazgos de auditoría
   Recomendación 5: condiciones inseguras detectadas POR FUERA del
   circuito de inspección de rutina (ej: recorrida de auditoría,
   observación casual, denuncia interna). A diferencia del checklist
   NFPA 25 normal, esto no sigue una periodicidad fija: son hallazgos
   puntuales que igual deben quedar registrados, seguidos, y deben
   impactar los mismos indicadores de cumplimiento y planes de acción
   que ya tiene la app, según pidió el usuario explícitamente.
   ============================================================ */

const CATEGORIAS_HALLAZGO = [
  { id: 'acceso_obstruido', label: 'Acceso a equipo obstruido' },
  { id: 'senalizacion_faltante', label: 'Señalización faltante o dañada' },
  { id: 'extintor_inaccesible', label: 'Extintor inaccesible o tapado' },
  { id: 'salida_emergencia', label: 'Salida de emergencia bloqueada' },
  { id: 'valvula_cerrada', label: 'Válvula cerrada indebidamente' },
  { id: 'almacenamiento_inadecuado', label: 'Almacenamiento bajo rociadores' },
  { id: 'dano_fisico', label: 'Daño físico a componente del sistema' },
  { id: 'otro', label: 'Otra condición insegura' }
];

const SEVERIDADES_HALLAZGO = {
  critica: { label: 'Crítica', diasPlazo: 3, color: '#C0392B' },
  alta: { label: 'Alta', diasPlazo: 7, color: '#D68910' },
  media: { label: 'Media', diasPlazo: 30, color: '#1A5276' },
  baja: { label: 'Baja', diasPlazo: 90, color: '#5F5E5A' }
};

/* Crea un hallazgo de auditoría y genera automáticamente su plan de
   acción asociado, para que aparezca junto con el resto de los planes
   que vienen de no conformidades de inspección y alimente los mismos
   gráficos de cumplimiento */
async function crearHallazgo(datos) {
  const severidadInfo = SEVERIDADES_HALLAZGO[datos.severidad] || SEVERIDADES_HALLAZGO.media;
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() + severidadInfo.diasPlazo);

  const hallazgo = {
    clienteId: datos.clienteId,
    fecha: datos.fecha,
    categoria: datos.categoria,
    severidad: datos.severidad,
    ubicacion: datos.ubicacion || '',
    descripcion: datos.descripcion || '',
    detectadoPor: datos.detectadoPor || '',
    contextoAuditoria: datos.contextoAuditoria || '',
    estado: 'pendiente',
    fechaLimite: fechaLimite.toISOString().split('T')[0],
    fotos: datos.fotos || [],
    planAccionId: null
  };

  const guardado = await FireSync.add(FireDB.STORES.HALLAZGOS_AUDITORIA, hallazgo);

  const categoriaInfo = CATEGORIAS_HALLAZGO.find(c => c.id === datos.categoria);
  const plan = {
    clienteId: datos.clienteId,
    inspeccionId: null,
    hallazgoAuditoriaId: guardado.id,
    sistemaId: null,
    tipoSistema: 'auditoria',
    itemRef: 'AUDITORÍA',
    descripcion: `${categoriaInfo ? categoriaInfo.label : 'Hallazgo'}: ${datos.descripcion || ''}`.trim(),
    criticidad: (datos.severidad === 'critica' || datos.severidad === 'alta') ? 'alta' : 'media',
    estado: PlanesAccion.ESTADOS.PENDIENTE,
    fechaDeteccion: datos.fecha,
    fechaLimite: hallazgo.fechaLimite,
    responsable: datos.detectadoPor || '',
    observacionesDeteccion: datos.descripcion || '',
    fotosIds: [],
    historial: [
      { fecha: new Date().toISOString(), evento: 'Plan generado automáticamente desde hallazgo de auditoría', estado: PlanesAccion.ESTADOS.PENDIENTE }
    ]
  };
  const planGuardado = await FireSync.add(FireDB.STORES.PLANES_ACCION, plan);

  guardado.planAccionId = planGuardado.id;
  await FireSync.put(FireDB.STORES.HALLAZGOS_AUDITORIA, guardado);

  return guardado;
}

/* Modelo visual para planes que vienen de hallazgos de auditoría (no es
   un sistema NFPA25 real, por eso vive separado de NFPA25.MODELO, pero
   necesita representación visual igual que los 4 sistemas normativos
   para que listas de planes/alertas puedan mostrarlo sin romper) */
const MODELO_VISUAL_AUDITORIA = {
  nombre: 'Hallazgo de auditoría',
  capitulo: 'Condición insegura (extra-rutina)',
  icono: 'shield-exclamation',
  color: '#6C3483'
};

/* Punto único para resolver el modelo visual (ícono, nombre, color) de
   CUALQUIER tipoSistema que pueda tener un plan de acción: los 4 sistemas
   NFPA25 normales, o 'auditoria' para los que vienen de esta recomendación.
   Usar esta función en vez de NFPA25.MODELO[tipo] directo evita errores
   cuando aparecen tipos nuevos que no son parte del modelo NFPA25 puro. */
const MODELO_VISUAL_CURVA_DESEMPENO = {
  nombre: 'Curva de Desempeño de Bomba',
  capitulo: 'NFPA 20 / NFPA 25 §8.3.3',
  icono: 'chart-line',
  color: '#1A5276'
};

function resolverModeloVisual(tipoSistema) {
  if (tipoSistema === 'auditoria')        return MODELO_VISUAL_AUDITORIA;
  if (tipoSistema === 'curva_desempeno')  return MODELO_VISUAL_CURVA_DESEMPENO;
  return NFPA25.MODELO[tipoSistema] || MODELO_VISUAL_AUDITORIA;
}

async function sincronizarCierreDesdeHallazgo(hallazgoId, nuevoEstado) {
  const hallazgo = await FireDB.get(FireDB.STORES.HALLAZGOS_AUDITORIA, hallazgoId);
  if (!hallazgo) return;
  hallazgo.estado = nuevoEstado;
  await FireSync.put(FireDB.STORES.HALLAZGOS_AUDITORIA, hallazgo);
}

async function calcularIndicadoresHallazgos(clienteId) {
  const todos = await FireDB.getAll(FireDB.STORES.HALLAZGOS_AUDITORIA);
  const hallazgos = clienteId ? todos.filter(h => h.clienteId === clienteId) : todos;

  const abiertos = hallazgos.filter(h => h.estado !== 'cerrado').length;
  const porSeveridad = { critica: 0, alta: 0, media: 0, baja: 0 };
  hallazgos.forEach(h => { if (porSeveridad[h.severidad] !== undefined) porSeveridad[h.severidad]++; });

  return { total: hallazgos.length, abiertos, porSeveridad };
}

window.HallazgosAuditoria = {
  CATEGORIAS: CATEGORIAS_HALLAZGO,
  SEVERIDADES: SEVERIDADES_HALLAZGO,
  crear: crearHallazgo,
  sincronizarCierreDesdeHallazgo,
  calcularIndicadores: calcularIndicadoresHallazgos,
  resolverModeloVisual
};
