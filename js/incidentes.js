/* ============================================================
   FireInspect Pro — Eventos de incidentes
   Recomendación 4: bitácora de incidentes en sistemas contra
   incendios (activaciones, fallas, alarmas), separada de las
   inspecciones de rutina. Disponible para todos los clientes
   y también para "clientes parciales" que solo usan este módulo.
   ============================================================ */

const TIPOS_INCIDENTE = [
  { id: 'activacion_rociador', label: 'Activación de rociador', icono: 'spray' },
  { id: 'falla_bomba', label: 'Falla de bomba', icono: 'engine' },
  { id: 'alarma_activada', label: 'Activación de alarma', icono: 'bell-ringing' },
  { id: 'fuga_agua', label: 'Fuga o pérdida de agua', icono: 'droplet-half-2' },
  { id: 'falla_suministro', label: 'Falla de suministro de agua', icono: 'plug-connected-x' },
  { id: 'incendio_real', label: 'Incendio real (siniestro)', icono: 'flame' },
  { id: 'otro', label: 'Otro evento', icono: 'alert-circle' }
];

/* Crea un incidente nuevo. clienteId puede ser null si el incidente
   pertenece a un cliente "solo incidentes" que aún no tiene sistemas
   NFPA 25 cargados en la app, según pidió el usuario en la recomendación 4 */
async function crearIncidente(datos) {
  const incidente = {
    clienteId: datos.clienteId || null,
    nombreClienteLibre: datos.nombreClienteLibre || '', // para cuando no hay clienteId
    fecha: datos.fecha,
    hora: datos.hora || '',
    tipoIncidente: datos.tipoIncidente,
    tipoSistema: datos.tipoSistema || null, // referencia opcional a tanque/bomba/hidrante/rociador
    esAlarmaFalsa: !!datos.esAlarmaFalsa,
    descripcion: datos.descripcion || '',
    danosReportados: datos.danosReportados || '',
    accionesTomadas: datos.accionesTomadas || '',
    responsableReporte: datos.responsableReporte || '',
    fotos: datos.fotos || []
  };
  return FireDB.add(FireDB.STORES.INCIDENTES, incidente);
}

async function actualizarIncidente(id, datos) {
  const existente = await FireDB.get(FireDB.STORES.INCIDENTES, id);
  if (!existente) throw new Error('Incidente no encontrado');
  return FireDB.put(FireDB.STORES.INCIDENTES, { ...existente, ...datos });
}

async function eliminarIncidente(id) {
  return FireDB.delete(FireDB.STORES.INCIDENTES, id);
}

function obtenerTipoIncidente(id) {
  return TIPOS_INCIDENTE.find(t => t.id === id) || TIPOS_INCIDENTE[TIPOS_INCIDENTE.length - 1];
}

/* Indicadores simples para el dashboard/reportes: total de incidentes,
   cuántos fueron alarmas falsas, y desglose por tipo */
async function calcularIndicadoresIncidentes(clienteId) {
  const todos = await FireDB.getAll(FireDB.STORES.INCIDENTES);
  const incidentes = clienteId ? todos.filter(i => i.clienteId === clienteId) : todos;

  const alarmasFalsas = incidentes.filter(i => i.esAlarmaFalsa).length;
  const porTipo = {};
  TIPOS_INCIDENTE.forEach(t => { porTipo[t.id] = 0; });
  incidentes.forEach(i => { if (porTipo[i.tipoIncidente] !== undefined) porTipo[i.tipoIncidente]++; });

  return {
    total: incidentes.length,
    alarmasFalsas,
    tasaAlarmasFalsas: incidentes.length > 0 ? Math.round((alarmasFalsas / incidentes.length) * 100) : 0,
    porTipo
  };
}

window.Incidentes = {
  TIPOS: TIPOS_INCIDENTE,
  crear: crearIncidente,
  actualizar: actualizarIncidente,
  eliminar: eliminarIncidente,
  obtenerTipo: obtenerTipoIncidente,
  calcularIndicadores: calcularIndicadoresIncidentes
};
