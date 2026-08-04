/* ============================================================
   FireInspect Pro — Planes de acción
   Punto 3: Seguimiento de no conformidades y medición de cumplimiento
   ============================================================
   Cada vez que se guarda una inspección con ítems marcados como
   "No conforme", automáticamente se generan planes de acción
   pendientes que se pueden asignar, fechar y cerrar con evidencia.
   ============================================================ */

const ESTADOS_PLAN = {
  PENDIENTE: 'pendiente',
  EN_PROCESO: 'en_proceso',
  CERRADO: 'cerrado',
  VENCIDO: 'vencido'
};

/* Genera automáticamente los planes de acción a partir de los ítems
   no conformes de una inspección recién guardada */
async function generarPlanesDesdeInspeccion(inspeccion) {
  const planesCreados = [];
  const modeloSistema = NFPA25.MODELO[inspeccion.tipoSistema];
  if (!modeloSistema) return planesCreados;

  for (const item of modeloSistema.checklist) {
    const respuesta = inspeccion.respuestas[item.id];
    if (respuesta === false || respuesta === 'no') {
      const diasPlazo = item.criticidad === 'alta' ? 7 : 30;
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() + diasPlazo);

      const plan = {
        clienteId: inspeccion.clienteId,
        inspeccionId: inspeccion.id,
        sistemaId: inspeccion.sistemaId,
        tipoSistema: inspeccion.tipoSistema,
        itemRef: item.ref,
        descripcion: item.texto,
        criticidad: item.criticidad,
        estado: ESTADOS_PLAN.PENDIENTE,
        fechaDeteccion: inspeccion.fecha,
        fechaLimite: fechaLimite.toISOString().split('T')[0],
        responsable: inspeccion.inspector || '',
        observacionesDeteccion: inspeccion.observaciones || '',
        fotosIds: [],
        historial: [
          { fecha: new Date().toISOString(), evento: 'Plan generado automáticamente desde inspección', estado: ESTADOS_PLAN.PENDIENTE }
        ]
      };

      const guardado = await FireSync.add(FireDB.STORES.PLANES_ACCION, plan);
      planesCreados.push(guardado);
    }
  }

  return planesCreados;
}

/* Cambia el estado de un plan de acción y registra el cambio en su historial.
   Si el plan vino de un hallazgo de auditoría (Recomendación 5), también
   sincroniza el estado en el hallazgo de origen para que ambos queden
   consistentes y los gráficos reflejen lo mismo desde cualquiera de los dos. */
async function actualizarEstadoPlan(planId, nuevoEstado, nota) {
  const plan = await FireDB.get(FireDB.STORES.PLANES_ACCION, planId);
  if (!plan) throw new Error('Plan de acción no encontrado');

  plan.estado = nuevoEstado;
  if (!plan.historial) plan.historial = [];
  plan.historial.push({
    fecha: new Date().toISOString(),
    evento: nota || `Estado actualizado a ${nuevoEstado}`,
    estado: nuevoEstado
  });

  if (nuevoEstado === ESTADOS_PLAN.CERRADO) {
    plan.fechaCierre = new Date().toISOString();
  }

  const resultado = await FireSync.put(FireDB.STORES.PLANES_ACCION, plan);

  if (plan.hallazgoAuditoriaId && window.HallazgosAuditoria) {
    await HallazgosAuditoria.sincronizarCierreDesdeHallazgo(plan.hallazgoAuditoriaId, nuevoEstado);
  }

  return resultado;
}

/* Marca como vencidos los planes cuya fecha límite ya pasó y no están cerrados */
async function actualizarVencimientos() {
  const planes = await FireDB.getAll(FireDB.STORES.PLANES_ACCION);
  const hoy = new Date().toISOString().split('T')[0];
  let actualizados = 0;

  for (const plan of planes) {
    const yaVencido = plan.fechaLimite < hoy;
    const noEstaCerrado = plan.estado !== ESTADOS_PLAN.CERRADO;
    const noMarcadoComoVencido = plan.estado !== ESTADOS_PLAN.VENCIDO;

    if (yaVencido && noEstaCerrado && noMarcadoComoVencido) {
      plan.estado = ESTADOS_PLAN.VENCIDO;
      plan.historial.push({ fecha: new Date().toISOString(), evento: 'Marcado automáticamente como vencido', estado: ESTADOS_PLAN.VENCIDO });
      await FireSync.put(FireDB.STORES.PLANES_ACCION, plan);
      actualizados++;
    }
  }
  return actualizados;
}

/* Calcula indicadores de cumplimiento global y por cliente a partir de
   las inspecciones y planes de acción almacenados */
async function calcularIndicadoresCumplimiento(clienteId) {
  const todasInspecciones = await FireDB.getAll(FireDB.STORES.INSPECCIONES);
  const inspecciones = clienteId
    ? todasInspecciones.filter(i => i.clienteId === clienteId)
    : todasInspecciones;

  const todosPlanes = await FireDB.getAll(FireDB.STORES.PLANES_ACCION);
  const planes = clienteId
    ? todosPlanes.filter(p => p.clienteId === clienteId)
    : todosPlanes;

  const porSistema = {};
  for (const tipo of Object.keys(NFPA25.MODELO)) {
    const inspeccionesTipo = inspecciones.filter(i => i.tipoSistema === tipo);
    if (inspeccionesTipo.length === 0) {
      porSistema[tipo] = { promedio: null, cantidad: 0 };
      continue;
    }
    const suma = inspeccionesTipo.reduce((acc, i) => acc + (i.cumplimiento || 0), 0);
    porSistema[tipo] = {
      promedio: Math.round(suma / inspeccionesTipo.length),
      cantidad: inspeccionesTipo.length
    };
  }

  const promedioGeneral = inspecciones.length > 0
    ? Math.round(inspecciones.reduce((acc, i) => acc + (i.cumplimiento || 0), 0) / inspecciones.length)
    : 100;

  const planesPendientes = planes.filter(p => p.estado === ESTADOS_PLAN.PENDIENTE || p.estado === ESTADOS_PLAN.EN_PROCESO).length;
  const planesVencidos = planes.filter(p => p.estado === ESTADOS_PLAN.VENCIDO).length;
  const planesCerrados = planes.filter(p => p.estado === ESTADOS_PLAN.CERRADO).length;
  const tasaCierre = planes.length > 0 ? Math.round((planesCerrados / planes.length) * 100) : 100;

  return {
    promedioGeneral,
    porSistema,
    totalInspecciones: inspecciones.length,
    planesPendientes,
    planesVencidos,
    planesCerrados,
    tasaCierre
  };
}

window.PlanesAccion = {
  ESTADOS: ESTADOS_PLAN,
  generarDesdeInspeccion: generarPlanesDesdeInspeccion,
  actualizarEstado: actualizarEstadoPlan,
  actualizarVencimientos,
  calcularIndicadores: calcularIndicadoresCumplimiento
};
