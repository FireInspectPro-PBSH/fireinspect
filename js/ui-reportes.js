/* ============================================================
   FireInspect Pro — UI parte 3
   Planes de acción, calendario, reportes y generación de PDF
   ============================================================ */

/* ============================================================
   PLANES DE ACCIÓN
   ============================================================ */

async function renderizarPlanes() {
  await PlanesAccion.actualizarVencimientos();
  const planes = await FireDB.getAll(FireDB.STORES.PLANES_ACCION);
  const clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  const clientesMap = {};
  clientes.forEach(c => clientesMap[c.id] = c);

  const pendientes = planes.filter(p => p.estado === PlanesAccion.ESTADOS.PENDIENTE).length;
  const enProceso = planes.filter(p => p.estado === PlanesAccion.ESTADOS.EN_PROCESO).length;
  const vencidos = planes.filter(p => p.estado === PlanesAccion.ESTADOS.VENCIDO).length;

  document.getElementById('planes-metricas').innerHTML = `
    <div class="metrica warn"><div class="valor">${pendientes}</div><div class="etiqueta">Pendientes</div></div>
    <div class="metrica neutro"><div class="valor">${enProceso}</div><div class="etiqueta">En proceso</div></div>
    <div class="metrica danger"><div class="valor">${vencidos}</div><div class="etiqueta">Vencidos</div></div>
  `;

  actualizarBadgePlanes(pendientes + vencidos);

  const filtro = Estado.filtroPlanes;
  const planesFiltrados = (filtro === 'todos' ? planes : planes.filter(p => p.estado === filtro))
    .sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite));

  const cont = document.getElementById('lista-planes');
  if (planesFiltrados.length === 0) {
    cont.innerHTML = `<div class="estado-vacio"><i class="ti ti-list-check" aria-hidden="true"></i><p>No hay planes de acción en esta categoría</p></div>`;
    return;
  }

  const hoy = new Date().toISOString().split('T')[0];
  cont.innerHTML = planesFiltrados.map(p => {
    const modelo = HallazgosAuditoria.resolverModeloVisual(p.tipoSistema);
    const vencido = p.estado === PlanesAccion.ESTADOS.VENCIDO;
    const cerrado = p.estado === PlanesAccion.ESTADOS.CERRADO;
    const diasRestantes = diasEntre(hoy, p.fechaLimite);

    const claseBadgeEstado = {
      pendiente: 'badge-warn', en_proceso: 'badge-neutro', cerrado: 'badge-ok', vencido: 'badge-danger'
    }[p.estado];
    const labelEstado = {
      pendiente: 'Pendiente', en_proceso: 'En proceso', cerrado: 'Cerrado', vencido: 'Vencido'
    }[p.estado];

    return `
      <div class="card plan-card criticidad-${p.criticidad} ${cerrado ? 'estado-cerrado' : ''}">
        <div class="plan-header">
          <div>
            <span class="ref">${p.itemRef} · ${clientesMap[p.clienteId]?.nombre || ''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge ${claseBadgeEstado}">${labelEstado}</span>
            <button onclick="UI.eliminarPlan('${p.id}')"
              style="background:none;border:none;cursor:pointer;padding:4px;color:var(--gris-400);line-height:1;"
              title="Eliminar plan" aria-label="Eliminar plan">
              <i class="ti ti-trash" style="font-size:16px;" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div class="plan-desc"><i class="ti ti-${modelo.icono}" style="margin-right:5px;color:var(--gris-500);" aria-hidden="true"></i>${p.descripcion}</div>
        <div class="plan-meta">
          <span>Detectado: ${formatearFecha(p.fechaDeteccion)}</span>
          <span class="${vencido ? 'vencido' : ''}">${cerrado ? 'Cerrado: ' + formatearFecha(p.fechaCierre?.split('T')[0]) : (vencido ? `Vencido hace ${Math.abs(diasRestantes)} días` : `Vence: ${formatearFecha(p.fechaLimite)}`)}</span>
        </div>
        ${!cerrado ? `
          <div class="btn-fila" style="margin-top:12px;">
            ${p.estado !== 'en_proceso' ? `<button class="btn btn-sm btn-secundario" onclick="UI.cambiarEstadoPlan('${p.id}','en_proceso')"><i class="ti ti-player-play" aria-hidden="true"></i> En proceso</button>` : ''}
            <button class="btn btn-sm btn-primary" onclick="UI.cambiarEstadoPlan('${p.id}','cerrado')"><i class="ti ti-check" aria-hidden="true"></i> Marcar resuelto</button>
          </div>` : ''}
      </div>`;
  }).join('');
}

function actualizarBadgePlanes(cantidad) {
  const badge = document.getElementById('badge-planes');
  if (!badge) return;
  if (cantidad > 0) {
    badge.textContent = cantidad > 9 ? '9+' : cantidad;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function filtrarPlanes(filtro, btn) {
  Estado.filtroPlanes = filtro;
  document.querySelectorAll('[data-filtro-plan]').forEach(b => b.classList.remove('activo'));
  btn.classList.add('activo');
  renderizarPlanes();
}

async function cambiarEstadoPlan(planId, nuevoEstado) {
  await PlanesAccion.actualizarEstado(planId, nuevoEstado, `Estado cambiado manualmente a ${nuevoEstado}`);
  mostrarToast(nuevoEstado === 'cerrado' ? 'Plan de acción cerrado' : 'Estado actualizado', 'exito');
  renderizarPlanes();
  renderizarDashboard();
}

/* ============================================================
   CALENDARIO
   ============================================================ */

const NOMBRES_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const NOMBRES_DIAS = ['D','L','M','X','J','V','S'];

async function renderizarCalendario() {
  poblarSelectoresClientes();
  const fecha = Estado.mesCalendario;
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth();

  document.getElementById('cal-mes-actual').textContent = `${NOMBRES_MESES[mes]} ${anio}`;

  const eventos = await FireDB.getAll(FireDB.STORES.EVENTOS);
  const eventosDelMes = {};
  eventos.forEach(e => {
    const [a, m, d] = e.fecha.split('-').map(Number);
    if (a === anio && m - 1 === mes) {
      if (!eventosDelMes[d]) eventosDelMes[d] = [];
      eventosDelMes[d].push(e);
    }
  });

  const primerDiaSemana = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() === mes;

  let gridHtml = NOMBRES_DIAS.map(d => `<div class="cal-dia-nombre">${d}</div>`).join('');

  for (let i = 0; i < primerDiaSemana; i++) gridHtml += `<div class="cal-dia otro-mes"></div>`;

  for (let d = 1; d <= diasEnMes; d++) {
    const esHoy = esMesActual && hoy.getDate() === d;
    const tieneEvento = !!eventosDelMes[d];
    const esUrgente = tieneEvento && eventosDelMes[d].some(e => {
      const fechaEvento = new Date(anio, mes, d);
      return fechaEvento < hoy;
    });
    gridHtml += `<div class="cal-dia ${esHoy ? 'hoy' : ''} ${tieneEvento ? 'evento' : ''} ${esUrgente ? 'evento-urgente' : ''}" onclick="UI.verEventosDelDia(${anio},${mes},${d})">${d}</div>`;
  }

  document.getElementById('cal-grid').innerHTML = gridHtml;

  const hoyIso = new Date().toISOString().split('T')[0];
  const proximos = eventos.filter(e => e.fecha >= hoyIso).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  const clientesMap = {};
  clientes.forEach(c => clientesMap[c.id] = c);

  const contEventos = document.getElementById('cal-lista-eventos');
  if (proximos.length === 0) {
    contEventos.innerHTML = `<div class="estado-vacio"><i class="ti ti-calendar-off" aria-hidden="true"></i><p>No hay inspecciones agendadas</p></div>`;
  } else {
    contEventos.innerHTML = proximos.slice(0, 8).map(e => {
      const modelo = NFPA25.MODELO[e.tipoSistema];
      return `
        <div class="lista-item">
          <div class="icono-circulo" style="background:${modelo.color}18;"><i class="ti ti-${modelo.icono}" style="color:${modelo.color};" aria-hidden="true"></i></div>
          <div class="info"><p>${clientesMap[e.clienteId]?.nombre || 'Cliente eliminado'}</p><span>${formatearFecha(e.fecha)} · ${e.hora}hs · ${modelo.nombre}${e.nota ? ' · ' + e.nota : ''}</span></div>
          <button class="btn btn-sm btn-secundario" onclick="UI.eliminarEvento('${e.id}')" aria-label="Eliminar"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>`;
    }).join('');
  }
}

function cambiarMesCalendario(delta) {
  Estado.mesCalendario.setMonth(Estado.mesCalendario.getMonth() + delta);
  renderizarCalendario();
}

function verEventosDelDia(anio, mes, dia) {
  // navegación simple: por ahora resalta el día; expansión futura podría abrir un detalle
  mostrarToast(`${dia}/${mes + 1}/${anio}`);
}

function abrirModalEvento() {
  document.getElementById('evento-fecha').value = new Date().toISOString().split('T')[0];
  abrirModal('modal-evento');
}

async function guardarEvento() {
  const clienteId = document.getElementById('evento-cliente').value;
  if (!clienteId) { mostrarToast('Seleccioná un cliente', 'error'); return; }

  const evento = {
    clienteId,
    tipoSistema: document.getElementById('evento-sistema').value,
    fecha: document.getElementById('evento-fecha').value,
    hora: document.getElementById('evento-hora').value,
    nota: document.getElementById('evento-nota').value.trim()
  };

  await FireSync.add(FireDB.STORES.EVENTOS, evento);
  cerrarModal('modal-evento');
  mostrarToast('Inspección agendada', 'exito');
  renderizarCalendario();
  renderizarDashboard();
}

async function eliminarEvento(eventoId) {
  await FireSync.delete(FireDB.STORES.EVENTOS, eventoId);
  mostrarToast('Evento eliminado');
  renderizarCalendario();
  renderizarDashboard();
}

/* ============================================================
   REPORTES (gráficos + generación PDF)
   ============================================================ */

let chartClientesInstancia = null;
let chartMesesInstancia = null;

async function eliminarPlan(planId) {
  const confirmar = await new Promise(resolve => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;max-width:340px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.18);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <div style="background:#FEF2F2;border-radius:50%;padding:8px;"><i class="ti ti-trash" style="color:#DC2626;font-size:20px;"></i></div>
          <strong style="font-size:15px;">Eliminar plan de acción</strong>
        </div>
        <p style="font-size:13px;color:#6B7280;line-height:1.5;margin-bottom:20px;">
          Esta acción es permanente y no se puede deshacer.<br><strong>¿Querés continuar?</strong>
        </p>
        <div style="display:flex;gap:10px;">
          <button id="_ep_cancel" class="btn btn-secundario" style="flex:1;">Cancelar</button>
          <button id="_ep_confirm" class="btn" style="flex:1;background:#DC2626;color:white;">Eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#_ep_cancel').onclick  = () => { modal.remove(); resolve(false); };
    modal.querySelector('#_ep_confirm').onclick = () => { modal.remove(); resolve(true);  };
  });
  if (!confirmar) return;
  try {
    await FireSync.delete(FireDB.STORES.PLANES_ACCION, planId);
    mostrarToast('Plan eliminado', 'exito');
    renderizarPlanes();
    if (typeof renderizarDashboard === 'function') renderizarDashboard();
  } catch(e) {
    mostrarToast('Error al eliminar el plan', 'error');
  }
}

async function renderizarReportes() {
  await poblarSelectoresClientes();

  let inspecciones = await FireDB.getAll(FireDB.STORES.INSPECCIONES);
  let clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  let planes = await FireDB.getAll(FireDB.STORES.PLANES_ACCION);

  /* — Visualizador con cliente asociado: solo ve los datos de SU empresa — */
  const esVisualizador = Estado.sesion?.rol === 'visualizador';
  const clienteSesion = (esVisualizador && Estado.sesion.clienteId) || null;
  if (clienteSesion) {
    inspecciones = inspecciones.filter(i => i.clienteId === clienteSesion);
    planes       = planes.filter(p => p.clienteId === clienteSesion);
    clientes     = clientes.filter(c => c.id === clienteSesion);
    // El selector de reporte consolidado queda fijo en su cliente
    const selRep = document.getElementById('rep-cliente');
    if (selRep) { selRep.value = clienteSesion; selRep.disabled = true; }
  }

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const inspeccionesEsteMes = inspecciones.filter(i => i.fecha >= inicioMes).length;
  const noConformidades = planes.filter(p => p.estado !== PlanesAccion.ESTADOS.CERRADO).length;

  document.getElementById('reportes-metricas').innerHTML = `
    <div class="metrica ok"><div class="valor">${inspecciones.length}</div><div class="etiqueta">Insp. totales</div></div>
    <div class="metrica neutro"><div class="valor">${inspeccionesEsteMes}</div><div class="etiqueta">Insp. este mes</div></div>
    <div class="metrica warn"><div class="valor">${noConformidades}</div><div class="etiqueta">No conformidades</div></div>
    <div class="metrica danger"><div class="valor">${planes.filter(p => p.estado === 'vencido').length}</div><div class="etiqueta">Vencidas</div></div>
  `;

  /* ═══ Título del panel según rol ═══ */
  const tituloEl = document.getElementById('panel-titulo');
  const subtituloEl = document.getElementById('panel-subtitulo');
  if (tituloEl && clienteSesion) {
    tituloEl.textContent = 'Mis informes';
    subtituloEl.textContent = clientes[0]?.nombre || '';
  } else if (tituloEl) {
    tituloEl.textContent = 'Panel ' + (Estado.config.empresa || 'PBSH');
    subtituloEl.textContent = 'Control de cartera e intervenciones';
  }

  /* ═══ SEGUIMIENTO MACRO DE INTERVENCIONES ═══
     Todas las acciones correctivas de todos los clientes en una tabla
     ejecutiva con filtros por estado y acción rápida. */
  const clientesMapInterv = {};
  clientes.forEach(cl => clientesMapInterv[cl.id] = cl.nombre);

  if (!Estado.panelFiltroInterv) Estado.panelFiltroInterv = 'abiertas';
  const filtroInterv = Estado.panelFiltroInterv;

  const ordenEstado = { vencido: 0, pendiente: 1, en_proceso: 2, cerrado: 3 };
  const planesOrdenados = [...planes].sort((a, b) =>
    (ordenEstado[a.estado] ?? 9) - (ordenEstado[b.estado] ?? 9) || (a.fechaLimite || '').localeCompare(b.fechaLimite || ''));

  const coincideFiltro = p => {
    if (filtroInterv === 'todas')      return true;
    if (filtroInterv === 'abiertas')   return p.estado !== 'cerrado';
    if (filtroInterv === 'vencidas')   return p.estado === 'vencido';
    if (filtroInterv === 'en_proceso') return p.estado === 'en_proceso';
    if (filtroInterv === 'resueltas')  return p.estado === 'cerrado';
    return true;
  };
  const intervVisibles = planesOrdenados.filter(coincideFiltro);

  const contadorInterv = document.getElementById('panel-interv-contador');
  if (contadorInterv) contadorInterv.textContent =
    `${planes.filter(p => p.estado !== 'cerrado').length} abiertas · ${planes.filter(p => p.estado === 'vencido').length} vencidas`;

  const FILTROS_INTERV = [
    { id: 'abiertas',   label: 'Abiertas'   },
    { id: 'vencidas',   label: 'Vencidas'   },
    { id: 'en_proceso', label: 'En proceso' },
    { id: 'resueltas',  label: 'Resueltas'  },
    { id: 'todas',      label: 'Todas'      },
  ];
  const filtrosEl = document.getElementById('panel-filtros-interv');
  if (filtrosEl) filtrosEl.innerHTML = FILTROS_INTERV.map(f => `
    <button onclick="UI.panelFiltrarInterv('${f.id}')"
      style="padding:6px 13px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;
             border:1.5px solid ${filtroInterv === f.id ? 'var(--gris-700)' : 'var(--gris-300)'};
             background:${filtroInterv === f.id ? 'var(--gris-700)' : 'white'};
             color:${filtroInterv === f.id ? 'white' : 'var(--gris-600)'};">${f.label}</button>`).join('');

  const badgeInterv = p => {
    if (p.estado === 'vencido')    return '<span class="badge badge-danger">Vencido</span>';
    if (p.estado === 'en_proceso') return '<span class="badge badge-warn">En proceso</span>';
    if (p.estado === 'cerrado')    return '<span class="badge badge-ok">Resuelto</span>';
    return '<span class="badge" style="background:var(--gris-200);color:var(--gris-700);">Pendiente</span>';
  };

  const tablaEl = document.getElementById('panel-tabla-interv');
  if (tablaEl) {
    if (intervVisibles.length === 0) {
      tablaEl.innerHTML = `<p style="font-size:12.5px;color:var(--gris-500);padding:8px 0;">
        ${filtroInterv === 'abiertas' ? 'Sin intervenciones abiertas — cartera al día ✓' : 'Sin intervenciones en este filtro'}</p>`;
    } else {
      tablaEl.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:520px;">
          <thead>
            <tr style="background:var(--gris-700);color:white;">
              <th style="text-align:left;padding:8px 10px;font-weight:600;border-radius:6px 0 0 0;">Cliente</th>
              <th style="text-align:left;padding:8px 10px;font-weight:600;">Hallazgo</th>
              <th style="text-align:left;padding:8px 10px;font-weight:600;white-space:nowrap;">Vence</th>
              <th style="text-align:left;padding:8px 10px;font-weight:600;">Estado</th>
              <th style="padding:8px 10px;border-radius:0 6px 0 0;"></th>
            </tr>
          </thead>
          <tbody>
            ${intervVisibles.map((p, idx) => `
              <tr style="border-bottom:1px solid var(--gris-100);${idx % 2 === 1 ? 'background:var(--gris-50);' : ''}">
                <td style="padding:9px 10px;font-weight:600;color:var(--gris-900);white-space:nowrap;">${clientesMapInterv[p.clienteId] || '—'}</td>
                <td style="padding:9px 10px;color:var(--gris-700);line-height:1.4;">
                  ${p.descripcion}${p.criticidad === 'alta' ? ' <span style="color:var(--rojo);font-weight:700;font-size:11px;">· CRÍTICO</span>' : ''}
                </td>
                <td style="padding:9px 10px;white-space:nowrap;color:${p.estado === 'vencido' ? 'var(--rojo)' : 'var(--gris-600)'};font-weight:${p.estado === 'vencido' ? '700' : '400'};">
                  ${formatearFecha(p.fechaLimite)}
                </td>
                <td style="padding:9px 10px;">${badgeInterv(p)}</td>
                <td style="padding:9px 6px;white-space:nowrap;text-align:right;">
                  ${esVisualizador ? '' : `
                    <button class="btn btn-sm btn-secundario" title="Editar plan" onclick="UI.abrirModalEditarPlan('${p.id}')"><i class="ti ti-edit" aria-hidden="true"></i></button>
                    ${p.estado !== 'cerrado' ? `
                      ${p.estado !== 'en_proceso' ? `<button class="btn btn-sm btn-secundario" title="Marcar en proceso" onclick="UI.panelCambiarEstadoInterv('${p.id}','en_proceso')"><i class="ti ti-player-play" aria-hidden="true"></i></button>` : ''}
                      <button class="btn btn-sm btn-primary" title="Marcar resuelto" onclick="UI.panelCambiarEstadoInterv('${p.id}','cerrado')"><i class="ti ti-check" aria-hidden="true"></i></button>
                    ` : `
                      <button class="btn btn-sm btn-secundario" title="Reabrir (volver a pendiente)" onclick="UI.panelReabrirInterv('${p.id}')"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Reabrir</button>
                    `}
                  `}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    }
  }

  /* ═══ COMPARATIVO DE CUMPLIMIENTO POR CLIENTE (barras) ═══ */
  const datosClientes = clientes.map(cl => {
    const insps = inspecciones.filter(i => i.clienteId === cl.id);
    const promedio = insps.length ? Math.round(insps.reduce((a, i) => a + (i.cumplimiento || 0), 0) / insps.length) : null;
    return { nombre: cl.nombre, valor: promedio, n: insps.length };
  }).filter(d => d.valor !== null).sort((a, b) => b.valor - a.valor);

  const cardComparativo = document.getElementById('card-comparativo');
  if (cardComparativo) cardComparativo.style.display = clienteSesion ? 'none' : 'block';
  const linkModulos = document.getElementById('panel-link-modulos');
  if (linkModulos) linkModulos.style.display = esVisualizador ? 'none' : 'inline-flex';

  /* ═══ GRÁFICOS DE GESTIÓN: cargado vs. ejecutado ═══ */
  const cardsGestion = document.getElementById('panel-graficos-gestion');
  if (cardsGestion) cardsGestion.style.display = esVisualizador ? 'none' : '';

  if (!esVisualizador) {
    const eventos = await FireDB.getAll(FireDB.STORES.EVENTOS);
    const anio = new Date().getFullYear().toString();

    /* Barras dobles ejecutivas: fila Total + una por cliente */
    const barrasDobles = (filas, labelA, labelB, colorA, colorB) => {
      const max = Math.max(1, ...filas.flatMap(f => [f.a, f.b]));
      const fila = (f, esTotal) => `
        <div style="padding:${esTotal ? '10px' : '8px'} 0;${esTotal ? 'border-bottom:1.5px solid var(--gris-200);margin-bottom:4px;' : 'border-bottom:1px solid var(--gris-100);'}">
          <p style="font-size:${esTotal ? '13px' : '12.5px'};font-weight:${esTotal ? '700' : '600'};color:var(--gris-${esTotal ? '900' : '800'});margin-bottom:5px;">${f.nombre}</p>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
            <div style="flex:1;height:11px;background:var(--gris-100);border-radius:6px;overflow:hidden;">
              <div style="width:${Math.round(f.a / max * 100)}%;height:100%;background:${colorA};border-radius:6px;"></div>
            </div>
            <span style="width:34px;text-align:right;font-size:11.5px;font-weight:700;color:${colorA};">${f.a}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:11px;background:var(--gris-100);border-radius:6px;overflow:hidden;">
              <div style="width:${Math.round(f.b / max * 100)}%;height:100%;background:${colorB};border-radius:6px;"></div>
            </div>
            <span style="width:34px;text-align:right;font-size:11.5px;font-weight:700;color:${colorB};">${f.b}</span>
          </div>
        </div>`;
      const leyenda = `
        <div style="display:flex;gap:14px;font-size:11.5px;color:var(--gris-600);margin-bottom:8px;">
          <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:3px;background:${colorA};"></span>${labelA}</span>
          <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:3px;background:${colorB};"></span>${labelB}</span>
        </div>`;
      return leyenda + filas.map((f, i) => fila(f, i === 0)).join('');
    };

    /* — Planes: cargados vs resueltos (histórico) — */
    const filasPlanes = [{
      nombre: 'Total cartera',
      a: planes.length,
      b: planes.filter(p => p.estado === 'cerrado').length,
    }, ...clientes.map(cl => ({
      nombre: cl.nombre,
      a: planes.filter(p => p.clienteId === cl.id).length,
      b: planes.filter(p => p.clienteId === cl.id && p.estado === 'cerrado').length,
    })).filter(f => f.a > 0)];

    const grafPlanes = document.getElementById('panel-graf-planes');
    if (grafPlanes) grafPlanes.innerHTML = planes.length === 0
      ? '<p style="font-size:12.5px;color:var(--gris-500);">Sin planes de acción registrados</p>'
      : barrasDobles(filasPlanes, 'Cargados', 'Resueltos', '#1A5276', '#1E8449');

    /* — Inspecciones del año: planificadas (agenda) vs ejecutadas — */
    const planifAnio = eventos.filter(e => (e.fecha || '').startsWith(anio));
    const ejecAnio   = inspecciones.filter(i => (i.fecha || '').startsWith(anio));
    const filasInsp = [{
      nombre: 'Total cartera',
      a: planifAnio.length,
      b: ejecAnio.length,
    }, ...clientes.map(cl => ({
      nombre: cl.nombre,
      a: planifAnio.filter(e => e.clienteId === cl.id).length,
      b: ejecAnio.filter(i => i.clienteId === cl.id).length,
    })).filter(f => f.a > 0 || f.b > 0)];

    const grafInsp = document.getElementById('panel-graf-insp');
    if (grafInsp) grafInsp.innerHTML = (planifAnio.length === 0 && ejecAnio.length === 0)
      ? '<p style="font-size:12.5px;color:var(--gris-500);">Sin actividad este año — planificá visitas en Agenda</p>'
      : barrasDobles(filasInsp, 'Planificadas', 'Ejecutadas', '#6C3483', '#C0392B');
  }

  const compEl = document.getElementById('panel-comparativo');
  if (compEl) {
    compEl.innerHTML = datosClientes.length === 0
      ? '<p style="font-size:12.5px;color:var(--gris-500);">Aún no hay inspecciones registradas</p>'
      : datosClientes.map(d => {
          const est = NFPA25.estadoPorCumplimiento(d.valor);
          return `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0;">
            <span style="width:120px;flex-shrink:0;font-size:12.5px;font-weight:600;color:var(--gris-800);
                         white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.nombre}</span>
            <div style="flex:1;height:16px;background:var(--gris-100);border-radius:8px;overflow:hidden;">
              <div style="width:${d.valor}%;height:100%;background:${est.color};border-radius:8px;"></div>
            </div>
            <span style="width:88px;flex-shrink:0;text-align:right;font-size:12px;font-weight:700;color:${est.color};">
              ${d.valor}% <span style="font-weight:400;color:var(--gris-400);">(${d.n})</span>
            </span>
          </div>`;
        }).join('');
  }

  // --- Historial de inspecciones ---
  const clientesMap = {};
  clientes.forEach(c => clientesMap[c.id] = c);
  const historial = inspecciones.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 12);
  const contHist = document.getElementById('panel-historial-contador');
  if (contHist) contHist.textContent = inspecciones.length;
  const contHistorial = document.getElementById('lista-historial-inspecciones');

  if (historial.length === 0) {
    contHistorial.innerHTML = `<div class="estado-vacio"><i class="ti ti-clipboard-off" aria-hidden="true"></i><p>Todavía no se registraron inspecciones</p></div>`;
  } else {
    contHistorial.innerHTML = historial.map(i => {
      const modelo = NFPA25.MODELO[i.tipoSistema];
      const est = NFPA25.estadoPorCumplimiento(i.cumplimiento || 0);
      return `
        <div class="lista-item" onclick="UI.verDetalleInspeccion('${i.id}')">
          <div class="icono-circulo" style="background:${modelo.color}18;"><i class="ti ti-${modelo.icono}" style="color:${modelo.color};" aria-hidden="true"></i></div>
          <div class="info"><p>${clientesMap[i.clienteId]?.nombre || ''} — ${modelo.nombre}</p><span>${formatearFecha(i.fecha)} · ${i.inspector || 'Sin inspector'}</span></div>
          <span class="badge ${est.nivel === 'ok' ? 'badge-ok' : est.nivel === 'warn' ? 'badge-warn' : 'badge-danger'}">${i.cumplimiento || 0}%</span>
          <i class="ti ti-eye" style="color:var(--gris-300);margin-left:4px;" aria-hidden="true"></i>
        </div>`;
    }).join('');
  }
}

/* ═══════════════════════════════════════════════════════════════
   VISTA DE DETALLE DE INSPECCIÓN
   Muestra el resultado completo en pantalla, sin generar PDF.
   Incluye la firma predeterminada del inspector si está configurada.
═══════════════════════════════════════════════════════════════ */
async function verDetalleInspeccion(inspeccionId) {
  const insp    = await FireDB.get(FireDB.STORES.INSPECCIONES, inspeccionId);
  if (!insp) { mostrarToast('No se encontró la inspección', 'error'); return; }
  const cliente = await FireDB.get(FireDB.STORES.CLIENTES, insp.clienteId);
  const modelo  = (typeof HallazgosAuditoria !== 'undefined')
                  ? HallazgosAuditoria.resolverModeloVisual(insp.tipoSubtipo === 'curva_desempeno' ? 'curva_desempeno' : insp.tipoSistema)
                  : NFPA25.MODELO[insp.tipoSistema];
  const est     = NFPA25.estadoPorCumplimiento(insp.cumplimiento || 0);

  document.getElementById('detalle-insp-titulo').textContent =
    insp.tipoSubtipo === 'curva_desempeno' ? 'Curva de Desempeño' : 'Detalle de inspección';

  let html = '';

  /* — Encabezado con cliente, sistema y estado — */
  html += `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
      <div class="icono-circulo" style="background:${modelo.color}18;width:46px;height:46px;flex-shrink:0;">
        <i class="ti ti-${modelo.icono}" style="color:${modelo.color};font-size:22px;" aria-hidden="true"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <p style="font-size:15px;font-weight:700;color:var(--gris-900);">${cliente?.nombre || '—'}</p>
        <p style="font-size:12.5px;color:var(--gris-500);">${modelo.nombre}${insp.nombreSistema ? ' · ' + insp.nombreSistema : ''}</p>
      </div>
      <div style="text-align:center;flex-shrink:0;">
        <p style="font-size:22px;font-weight:700;color:${est.color};">${insp.cumplimiento || 0}%</p>
        <p style="font-size:11px;color:${est.color};font-weight:600;">${est.label}</p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px;color:var(--gris-700);background:var(--gris-50);border-radius:var(--border-radius-md);padding:10px 12px;margin-bottom:14px;">
      <span><i class="ti ti-calendar" aria-hidden="true"></i> ${formatearFecha(insp.fecha)}</span>
      <span><i class="ti ti-user" aria-hidden="true"></i> ${insp.inspector || 'Sin inspector'}</span>
      ${insp.frecuencia ? `<span><i class="ti ti-calendar-repeat" aria-hidden="true"></i> Visita ${NFPA25.etiquetaFrecuencia(insp.frecuencia)}</span>` : ''}
      ${cliente?.direccion ? `<span style="grid-column:1/-1;"><i class="ti ti-map-pin" aria-hidden="true"></i> ${cliente.direccion}</span>` : ''}
    </div>`;

  if (insp.tipoSubtipo === 'curva_desempeno') {
    /* — Detalle específico de Curva de Desempeño — */
    const r = insp.resultado || {};
    const clasLabel = { excellent:'4 - Excelente', good:'3 - Buena', fair:'2 - Regular', poor:'1 - Deficiente' };
    const clasColor = { excellent:'#1E8449', good:'#2471A3', fair:'#D68910', poor:'#C0392B' };
    html += `
      <div class="seccion-titulo">Resultado de la prueba</div>
      <div style="background:${clasColor[r.clasificacion_global] || '#888'}12;border-radius:var(--border-radius-md);padding:12px;text-align:center;margin-bottom:12px;">
        <p style="font-size:19px;font-weight:700;color:${clasColor[r.clasificacion_global] || '#555'};">${clasLabel[r.clasificacion_global] || '—'}</p>
        <p style="font-size:12px;color:${r.cumple_nfpa ? 'var(--verde)' : 'var(--rojo)'};font-weight:600;">
          ${r.cumple_nfpa ? 'Cumple NFPA 25 — dentro de parámetros' : 'No cumple NFPA 25 — requiere acción correctiva'}
        </p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px;text-align:center;margin-bottom:12px;">
        <div style="padding:8px;background:var(--gris-50);border-radius:var(--border-radius-sm);">
          <p style="font-weight:700;color:${r.shutoff_ok ? 'var(--verde)' : 'var(--rojo)'};">${r.shutoff_ok ? 'OK' : 'FALLA'}</p>
          <p style="color:var(--gris-500);">Shutoff</p>
        </div>
        <div style="padding:8px;background:var(--gris-50);border-radius:var(--border-radius-sm);">
          <p style="font-weight:700;color:${clasColor[r.clasificacion_100] || '#555'};">${clasLabel[r.clasificacion_100] || '—'}</p>
          <p style="color:var(--gris-500);">Punto 100%Q</p>
        </div>
        <div style="padding:8px;background:var(--gris-50);border-radius:var(--border-radius-sm);">
          <p style="font-weight:700;color:${clasColor[r.clasificacion_150] || '#555'};">${clasLabel[r.clasificacion_150] || '—'}</p>
          <p style="color:var(--gris-500);">Punto 150%Q</p>
        </div>
      </div>
      ${insp.marca || insp.modelo ? `
      <div class="seccion-titulo">Bomba ensayada</div>
      <p style="font-size:13px;color:var(--gris-700);margin-bottom:12px;">
        ${[insp.marca, insp.modelo, insp.serie ? 'Serie ' + insp.serie : ''].filter(Boolean).join(' · ')}
      </p>` : ''}`;

    /* — Gráfico de la curva, reconstruido desde los datos guardados — */
    if (insp.datosPrueba && typeof CurvaDesempeno !== 'undefined' && UI.cdConstruirSVG) {
      try {
        const resGraf = CurvaDesempeno.analizarCurvaDesempeno(insp.datosPrueba);
        const { svgHtml, leyendaHtml } = UI.cdConstruirSVG(
          resGraf, insp.datosPrueba.pn_psi, insp.datosPrueba.qn_gpm, insp.datosPrueba);
        html += `
          <div class="seccion-titulo">Curva de Desempeño — Presión vs. Caudal</div>
          <div style="margin-bottom:6px;">${svgHtml}</div>
          ${leyendaHtml}
          <div style="margin-bottom:12px;"></div>`;
      } catch (e) { /* datos incompletos: se omite el gráfico */ }
    }

    html += `
      ${insp.conclusion ? `
      <div class="seccion-titulo">Conclusión técnica</div>
      <p style="font-size:12.5px;color:var(--gris-700);line-height:1.65;white-space:pre-wrap;margin-bottom:12px;">${insp.conclusion}</p>` : ''}`;
  } else {
    /* — Detalle de inspección NFPA 25 estándar — */

    // Valores medidos
    const modeloNFPA = NFPA25.MODELO[insp.tipoSistema];
    const valores = insp.valoresExtra || {};
    const camposConValor = (modeloNFPA?.campos || []).filter(c => valores[c.id] !== undefined && valores[c.id] !== '');
    if (camposConValor.length > 0) {
      html += `<div class="seccion-titulo">Valores registrados</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12.5px;margin-bottom:14px;">
        ${camposConValor.map(c => `
          <div style="background:var(--gris-50);border-radius:var(--border-radius-sm);padding:7px 10px;">
            <p style="font-size:11px;color:var(--gris-500);">${c.label}</p>
            <p style="font-weight:600;color:var(--gris-900);">${valores[c.id]}${c.unidad ? ` <span style="font-weight:400;font-size:11px;color:var(--gris-500);">${Unidades.textoConversion(valores[c.id], c.unidad)}</span>` : ''}</p>
          </div>`).join('')}
        </div>`;
    }

    // Checklist con estados
    const respuestas = insp.respuestas || {};
    // Muestra solo los ítems que correspondían a la frecuencia de esa visita
    let itemsDetalle = modeloNFPA?.checklist || [];
    if (insp.frecuencia && NFPA25.nivelFrecuencia) {
      const nivelVisita = NFPA25.nivelFrecuencia(insp.frecuencia);
      itemsDetalle = itemsDetalle.filter(i => NFPA25.nivelFrecuencia(i.periodicidad) <= nivelVisita);
    }
    if (itemsDetalle.length) {
      const iconoEstado = r =>
        r === 'ok' ? '<i class="ti ti-circle-check" style="color:var(--verde);font-size:17px;" aria-hidden="true"></i>' :
        r === 'no' ? '<i class="ti ti-circle-x" style="color:var(--rojo);font-size:17px;" aria-hidden="true"></i>' :
        r === 'na' ? '<span style="font-size:10.5px;font-weight:700;color:var(--gris-400);">N/A</span>' :
                     '<span style="font-size:10.5px;color:var(--gris-300);">—</span>';
      html += `<div class="seccion-titulo">Checklist de cumplimiento</div>
        <div style="margin-bottom:14px;">
        ${itemsDetalle.map(item => `
          <div style="display:flex;align-items:flex-start;gap:9px;padding:7px 0;border-bottom:1px solid var(--gris-100);">
            <div style="width:24px;text-align:center;flex-shrink:0;padding-top:1px;">${iconoEstado(respuestas[item.id])}</div>
            <div style="flex:1;min-width:0;">
              <p style="font-size:12.5px;color:var(--gris-800);line-height:1.45;">${item.texto}</p>
              <p style="font-size:10.5px;color:var(--gris-400);">${item.ref} · ${item.periodicidad}${item.criticidad === 'alta' ? ' · <span style="color:var(--rojo);font-weight:600;">crítico</span>' : ''}</p>
            </div>
          </div>`).join('')}
        </div>`;
    }
  }

  /* — Observaciones — */
  if (insp.observaciones) {
    html += `<div class="seccion-titulo">Observaciones</div>
      <p style="font-size:12.5px;color:var(--gris-700);line-height:1.6;margin-bottom:14px;white-space:pre-wrap;">${insp.observaciones}</p>`;
  }

  /* — Fotos — */
  const fotos = insp.fotos || [];
  if (fotos.length > 0) {
    html += `<div class="seccion-titulo">Registro fotográfico (${fotos.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
      ${fotos.map((f, idx) => {
        const src = typeof f === 'string' ? f : (f.dataUrl || '');
        return src ? `<img src="${src}" alt="Foto ${idx+1}" style="width:74px;height:74px;object-fit:cover;border-radius:8px;border:1.5px solid var(--gris-200);cursor:pointer;" onclick="UI.ampliarFotoDetalle('${inspeccionId}',${idx})">` : '';
      }).join('')}
      </div>`;
  }

  /* — Firma: la de la inspección, o la predeterminada del inspector — */
  const firma = insp.firmaDataUrl || Estado.config.firmaPredeterminada;
  if (firma) {
    html += `<div class="seccion-titulo">Firma del inspector</div>
      <div style="background:white;border:1.5px solid var(--gris-200);border-radius:var(--border-radius-md);padding:10px;text-align:center;margin-bottom:6px;">
        <img src="${firma}" alt="Firma del inspector" style="max-height:64px;max-width:100%;object-fit:contain;">
      </div>
      <p style="font-size:11.5px;color:var(--gris-500);text-align:center;margin-bottom:14px;">
        ${insp.inspector || Estado.config.inspector || ''}${!insp.firmaDataUrl && Estado.config.firmaPredeterminada ? ' · firma predeterminada' : ''}
      </p>`;
  }

  /* — Acciones — */
  html += `
    <div class="btn-fila" style="margin-top:6px;">
      <button class="btn btn-primary" onclick="UI.descargarPDFInspeccion('${inspeccionId}')">
        <i class="ti ti-file-type-pdf" aria-hidden="true"></i> Descargar PDF
      </button>
      <button class="btn btn-secundario" onclick="UI.cerrarModal('modal-detalle-inspeccion')">
        Cerrar
      </button>
    </div>`;

  document.getElementById('detalle-insp-contenido').innerHTML = html;
  abrirModal('modal-detalle-inspeccion');
}

/* Amplía una foto del detalle a pantalla completa */
async function ampliarFotoDetalle(inspeccionId, idx) {
  const insp = await FireDB.get(FireDB.STORES.INSPECCIONES, inspeccionId);
  const f = insp?.fotos?.[idx];
  const src = typeof f === 'string' ? f : (f?.dataUrl || '');
  if (!src) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
  overlay.innerHTML = `
    <img src="${src}" style="max-width:94vw;max-height:82vh;border-radius:8px;object-fit:contain;">
    <button onclick="this.parentElement.remove()" style="background:white;color:#111;border:none;padding:8px 24px;border-radius:20px;font-size:14px;cursor:pointer;">Cerrar</button>`;
  document.body.appendChild(overlay);
}

/* Descarga el PDF de una inspección puntual desde el historial */
async function descargarPDFInspeccion(inspeccionId) {
  const inspeccion = await FireDB.get(FireDB.STORES.INSPECCIONES, inspeccionId);
  if (!inspeccion) { mostrarToast('No se encontró la inspección', 'error'); return; }
  const cliente = await FireDB.get(FireDB.STORES.CLIENTES, inspeccion.clienteId);

  // Las Curvas de Desempeño tienen su propio informe (ficha técnica +
  // gráfico + clasificación NFPA 20), distinto del reporte de checklist
  if (inspeccion.tipoSubtipo === 'curva_desempeno') {
    await UI.cdGenerarPDFGuardado(inspeccion, cliente);
    return;
  }

  mostrarToast('Generando PDF...');
  const doc = await ReportesPDF.generarInspeccion(inspeccion, {
    incluirLogo: true, incluirFirma: true, incluirFotos: true,
    empresaInspectora: Estado.config.empresa
  });

  // Nombre de archivo: Sistema_Frecuencia_Cliente_Fecha
  // Ej: Tanques_Trimestral_Cargill_2025-06-15.pdf
  const sistemaTag   = (inspeccion.tipoSistema || 'sistema').charAt(0).toUpperCase()
                     + (inspeccion.tipoSistema || 'sistema').slice(1);
  const frecTag      = NFPA25.etiquetaFrecuencia(inspeccion.frecuencia || 'anual');
  const clienteTag   = (cliente?.nombre || 'cliente').replace(/\s+/g, '_');
  const nombreArchivo = `${sistemaTag}_${frecTag}_${clienteTag}_${inspeccion.fecha}.pdf`;
  ReportesPDF.descargar(doc, nombreArchivo);
  mostrarToast('PDF generado', 'exito');
}

/* Genera el reporte PDF consolidado desde el formulario de la pantalla Reportes */
async function generarReporteConsolidado() {
  const clienteId = document.getElementById('rep-cliente').value;
  if (!clienteId) { mostrarToast('Seleccioná un cliente', 'error'); return; }

  const tipoSistema = document.getElementById('rep-sistema').value;
  const periodo = document.getElementById('rep-periodo').value;
  const incluirLogo = document.getElementById('rep-logo').checked;
  const incluirFirma = document.getElementById('rep-firma').checked;
  const incluirFotos = document.getElementById('rep-fotos').checked;

  let inspecciones = await FireDB.getByIndex(FireDB.STORES.INSPECCIONES, 'clienteId', clienteId);

  if (tipoSistema !== 'todos') {
    inspecciones = inspecciones.filter(i => i.tipoSistema === tipoSistema);
  }

  let periodoLabel = 'Todo el historial';
  if (periodo !== 'todos') {
    const dias = parseInt(periodo, 10);
    const limite = new Date();
    limite.setDate(limite.getDate() - dias);
    const limiteIso = limite.toISOString().split('T')[0];
    inspecciones = inspecciones.filter(i => i.fecha >= limiteIso);
    periodoLabel = `Últimos ${dias} días`;
  }

  if (inspecciones.length === 0) {
    mostrarToast('No hay inspecciones que coincidan con esos filtros', 'error');
    return;
  }

  mostrarToast('Generando reporte PDF...');
  inspecciones.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const doc = await ReportesPDF.generarConsolidado(clienteId, inspecciones, {
    incluirLogo, incluirFirma, periodoLabel,
    empresaInspectora: Estado.config.empresa,
    inspector: Estado.config.inspector,
    firmaDataUrl: inspecciones[0]?.firmaDataUrl
  });

  const cliente = await FireDB.get(FireDB.STORES.CLIENTES, clienteId);
  const nombreArchivo = `Reporte_${cliente.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  ReportesPDF.descargar(doc, nombreArchivo);
  mostrarToast('Reporte generado correctamente', 'exito');
}

async function verPDFInspeccion(inspeccionId) {
  await descargarPDFInspeccion(inspeccionId);
}

/* ═══ Acciones del Panel PBSH ═══ */
function panelFiltrarInterv(filtro) {
  Estado.panelFiltroInterv = filtro;
  renderizarReportes();
}

async function panelCambiarEstadoInterv(planId, estado) {
  await cambiarEstadoPlan(planId, estado);
  renderizarReportes();
}

/* Reabre un plan cerrado por error → vuelve a pendiente (solo administrador).
   Si la fecha límite ya pasó, actualizarVencimientos lo marcará vencido. */
async function panelReabrirInterv(planId) {
  if (Estado.sesion?.rol === 'visualizador') return;
  if (!confirm('¿Reabrir este plan de acción? Volverá a estado pendiente.')) return;
  await PlanesAccion.actualizarEstado(planId, 'pendiente', 'Plan reabierto por el administrador (cierre por error)');
  await PlanesAccion.actualizarVencimientos();
  mostrarToast('Plan reabierto', 'exito');
  renderizarReportes();
}

/* ═══ Edición completa de un plan de acción (solo administrador) ═══ */
async function abrirModalEditarPlan(planId) {
  if (Estado.sesion?.rol === 'visualizador') return;
  const plan = await FireDB.get(FireDB.STORES.PLANES_ACCION, planId);
  if (!plan) { mostrarToast('Plan no encontrado', 'error'); return; }
  const cliente = await FireDB.get(FireDB.STORES.CLIENTES, plan.clienteId);

  document.getElementById('editplan-id').value = plan.id;
  document.getElementById('editplan-cliente').innerHTML =
    `<i class="ti ti-building" aria-hidden="true"></i> <strong>${cliente?.nombre || '—'}</strong>`;
  document.getElementById('editplan-descripcion').value = plan.descripcion || '';
  document.getElementById('editplan-fecha').value = plan.fechaLimite || '';
  document.getElementById('editplan-criticidad').value = plan.criticidad === 'alta' ? 'alta' : 'media';
  document.getElementById('editplan-estado').value =
    plan.estado === 'vencido' ? 'pendiente' : (plan.estado || 'pendiente');
  abrirModal('modal-editar-plan');
}

async function guardarEdicionPlan() {
  const id = document.getElementById('editplan-id').value;
  const plan = await FireDB.get(FireDB.STORES.PLANES_ACCION, id);
  if (!plan) return;

  const descripcion = document.getElementById('editplan-descripcion').value.trim();
  const fecha = document.getElementById('editplan-fecha').value;
  if (!descripcion) { mostrarToast('La descripción no puede quedar vacía', 'error'); return; }
  if (!fecha)       { mostrarToast('Ingresá la fecha límite', 'error'); return; }

  plan.descripcion = descripcion;
  plan.fechaLimite = fecha;
  plan.criticidad  = document.getElementById('editplan-criticidad').value;
  plan.estado      = document.getElementById('editplan-estado').value;
  plan.historial = plan.historial || [];
  plan.historial.push({ fecha: new Date().toISOString(), nota: 'Plan editado por el administrador' });

  await FireSync.put(FireDB.STORES.PLANES_ACCION, plan);
  await PlanesAccion.actualizarVencimientos();
  cerrarModal('modal-editar-plan');
  mostrarToast('Plan actualizado', 'exito');

  // Refresca el contexto activo
  if (document.getElementById('pantalla-reportes').classList.contains('activa')) renderizarReportes();
  if (document.getElementById('pantalla-detalle-cliente').classList.contains('activa') && typeof UI.hubIrA === 'function') UI.hubIrA('planes');
  if (document.getElementById('pantalla-planes').classList.contains('activa')) renderizarPlanes();
}

window.UI = window.UI || {};
Object.assign(window.UI, {
  renderizarPlanes, filtrarPlanes, cambiarEstadoPlan, eliminarPlan, panelFiltrarInterv, panelCambiarEstadoInterv, panelReabrirInterv, abrirModalEditarPlan, guardarEdicionPlan,
  renderizarCalendario, cambiarMesCalendario, verEventosDelDia, abrirModalEvento, guardarEvento, eliminarEvento,
  renderizarReportes, descargarPDFInspeccion, generarReporteConsolidado, verPDFInspeccion,
  verDetalleInspeccion, ampliarFotoDetalle
});
