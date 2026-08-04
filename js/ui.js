/* ============================================================
   FireInspect Pro — Lógica de interfaz (UI)
   Conecta los módulos de datos (db, nfpa25, planes, fotos, firma,
   pdf) con las pantallas del index.html
   ============================================================ */

const Estado = {
  pantallaActual: 'dashboard',
  sistemaInspeccionActual: 'tanque',
  clienteDetalleActual: null,
  fotosInspeccionTemp: [], // fotos cargadas durante la inspección en curso, antes de guardar
  firmaTemp: null,
  firmaInstancia: null,
  mesCalendario: new Date(),
  filtroPlanes: 'todos',
  config: { empresa: '', inspector: '' },
  pdfPendienteEnvio: null,
  logoTemporalCliente: null
};

/* ---------------- Utilidades generales ---------------- */

function mostrarToast(mensaje, tipo) {
  const toast = document.getElementById('toast');
  const texto = document.getElementById('toast-texto');
  texto.textContent = mensaje;
  toast.className = 'toast mostrar' + (tipo ? ' ' + tipo : '');
  const icono = toast.querySelector('i');
  icono.className = tipo === 'exito' ? 'ti ti-check' : (tipo === 'error' ? 'ti ti-x' : 'ti ti-info-circle');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.classList.remove('mostrar'); }, 2800);
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return '-';
  const [a, m, d] = fechaIso.split('-');
  return `${d}/${m}/${a}`;
}

function diasEntre(fechaA, fechaB) {
  const a = new Date(fechaA);
  const b = new Date(fechaB);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function inicialesDe(nombre) {
  return (nombre || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');
}

function colorAvatarDe(id) {
  const colores = [
    { bg: '#FDEDEC', fg: '#C0392B' },
    { bg: '#EBF5FB', fg: '#1A5276' },
    { bg: '#EAFAF1', fg: '#1E8449' },
    { bg: '#F5EEF8', fg: '#6C3483' },
    { bg: '#FEF9E7', fg: '#D68910' }
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return colores[hash % colores.length];
}

/* ---------------- Navegación entre pantallas ---------------- */

function irA(nombrePantalla, subtabActiva) {
  // El rol visualizador solo puede acceder a Reportes
  if (Estado.sesion?.rol === 'visualizador' && nombrePantalla !== 'reportes') {
    nombrePantalla = 'reportes';
    subtabActiva = undefined;
  }
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  document.getElementById('pantalla-' + nombrePantalla).classList.add('activa');

  // Para pantallas con sub-pestañas (ej. "planes" agrupa Planes/Incidentes/Auditoría),
  // el sidebar tiene varios botones con el mismo data-pantalla; data-subtab-target
  // permite distinguir cuál de ellos corresponde resaltar como verdaderamente activo
  const subtabEfectiva = subtabActiva || 'planes';
  document.querySelectorAll('.navbar button, #sidebar-nav button').forEach(b => {
    const coincideSubtab = !b.dataset.subtabTarget || b.dataset.subtabTarget === subtabEfectiva;
    b.classList.toggle('activo', b.dataset.pantalla === nombrePantalla && coincideSubtab);
  });

  Estado.pantallaActual = nombrePantalla;
  document.getElementById('fab-nueva-inspeccion').classList.toggle('fab-oculto', nombrePantalla === 'inspeccion');

  if (nombrePantalla === 'dashboard') renderizarDashboard();
  if (nombrePantalla === 'clientes') renderizarListaClientes();
  if (nombrePantalla === 'inspeccion') renderizarPantallaInspeccion();
  if (nombrePantalla === 'planes') {
    // asegura que la sub-pestaña visible coincida con la solicitada (por
    // defecto "planes"), sin importar cuál haya quedado abierta la última vez
    const btnSubtab = document.querySelector(`[data-subtab="${subtabEfectiva}"]`);
    if (btnSubtab) cambiarSubTabSeguimiento(subtabEfectiva, btnSubtab);
    else renderizarPlanes();
  }
  if (nombrePantalla === 'calendario') renderizarCalendario();
  if (nombrePantalla === 'reportes') renderizarReportes();
  if (nombrePantalla === 'equipos') renderizarEquiposGlobal();
  if (nombrePantalla === 'informe-consolidado') renderizarInformeConsolidado();

  window.scrollTo(0, 0);
}

function abrirModal(idModal) {
  document.getElementById(idModal).classList.add('activo');
}
function cerrarModal(idModal) {
  document.getElementById(idModal).classList.remove('activo');
}

/* ============================================================
   DASHBOARD
   ============================================================ */

/* ═══════════════════════════════════════════════════════════════
   PANTALLA DE INICIO — Portada de clientes
   Grilla de tarjetas con el logo de cada cliente como protagonista,
   semáforo de cumplimiento y aviso de vencimientos. Tocás un cliente
   y entrás a su hub (planificación, resultados, informes, equipos).
═══════════════════════════════════════════════════════════════ */
async function renderizarDashboard() {
  await PlanesAccion.actualizarVencimientos();

  const clientes     = (await FireDB.getAll(FireDB.STORES.CLIENTES)).sort((a,b) => a.nombre.localeCompare(b.nombre));
  const inspecciones = await FireDB.getAll(FireDB.STORES.INSPECCIONES);
  const planes       = await FireDB.getAll(FireDB.STORES.PLANES_ACCION);
  const eventos      = await FireDB.getAll(FireDB.STORES.EVENTOS);

  /* ── Franja superior compacta: lo justo para decidir ── */
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split('T')[0];
  const en7 = new Date(hoy.getTime() + 7 * 86400000).toISOString().split('T')[0];
  const visitasSemana = eventos.filter(e => e.fecha >= hoyStr && e.fecha <= en7).length;
  const pendientes = planes.filter(p => p.estado === PlanesAccion.ESTADOS.PENDIENTE).length;
  const vencidas   = planes.filter(p => p.estado === PlanesAccion.ESTADOS.VENCIDO).length;

  const chip = (icono, texto, color, bg, destino) => `
    <button onclick="UI.irA('${destino}')"
      style="display:flex;align-items:center;gap:6px;border:1px solid ${color}33;background:${bg};color:${color};
             border-radius:20px;padding:7px 13px;font-size:12.5px;font-weight:600;cursor:pointer;">
      <i class="ti ti-${icono}" aria-hidden="true"></i>${texto}
    </button>`;

  document.getElementById('dash-franja').innerHTML =
    chip('calendar-event', `${visitasSemana} visita${visitasSemana === 1 ? '' : 's'} esta semana`, '#1A5276', '#EBF2F8', 'calendario') +
    (pendientes > 0 ? chip('progress-alert', `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`, '#B7770D', '#FEF9E7', 'planes') : '') +
    (vencidas   > 0 ? chip('alert-octagon', `${vencidas} vencida${vencidas === 1 ? '' : 's'}`, '#C0392B', '#FDEDEC', 'planes') : '');

  /* ── Estado por cliente ── */
  const grilla = document.getElementById('dash-grilla-clientes');

  if (clientes.length === 0) {
    grilla.innerHTML = `
      <div class="estado-vacio" style="grid-column:1/-1;">
        <i class="ti ti-building-community" aria-hidden="true"></i>
        <p>Agregá tu primer cliente para comenzar</p>
        <button class="btn btn-primary" style="margin-top:10px;" onclick="UI.abrirModalCliente()">
          <i class="ti ti-plus" aria-hidden="true"></i> Nuevo cliente
        </button>
      </div>`;
    return;
  }

  grilla.innerHTML = clientes.map(cliente => {
    const insCliente = inspecciones.filter(i => i.clienteId === cliente.id);
    const promedio = insCliente.length
      ? Math.round(insCliente.reduce((a, i) => a + (i.cumplimiento || 0), 0) / insCliente.length)
      : null;
    const estado = promedio !== null ? NFPA25.estadoPorCumplimiento(promedio) : null;
    const vencCliente = planes.filter(p => p.clienteId === cliente.id && p.estado === PlanesAccion.ESTADOS.VENCIDO).length;
    const av = colorAvatarDe(cliente.id);

    return `
      <div onclick="UI.verDetalleCliente('${cliente.id}')"
           style="position:relative;background:white;border:1px solid var(--gris-200);border-radius:var(--border-radius-lg);
                  padding:16px 12px 13px;text-align:center;cursor:pointer;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
        ${vencCliente > 0 ? `
          <span style="position:absolute;top:8px;right:8px;background:var(--rojo);color:white;font-size:10px;
                       font-weight:700;border-radius:10px;padding:2px 7px;">${vencCliente} vencida${vencCliente > 1 ? 's' : ''}</span>` : ''}

        <div style="height:58px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;">
          ${cliente.logoDataUrl
            ? `<img src="${cliente.logoDataUrl}" alt="" style="max-height:54px;max-width:92%;object-fit:contain;">`
            : `<div class="avatar-cliente" style="width:50px;height:50px;font-size:17px;background:${av.bg};color:${av.fg};">${inicialesDe(cliente.nombre)}</div>`}
        </div>

        <p style="font-size:13.5px;font-weight:700;color:var(--gris-900);line-height:1.3;margin-bottom:6px;
                  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${cliente.nombre}</p>

        ${estado
          ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:${estado.color};">
               <span style="width:8px;height:8px;border-radius:50%;background:${estado.color};display:inline-block;"></span>
               ${promedio}% · ${estado.label}
             </span>`
          : `<span style="font-size:11.5px;color:var(--gris-400);">Sin inspecciones aún</span>`}
      </div>`;
  }).join('') + `
    <div onclick="UI.abrirModalCliente()"
         style="border:1.5px dashed var(--gris-300);border-radius:var(--border-radius-lg);padding:16px 12px;
                display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
                cursor:pointer;min-height:130px;color:var(--gris-500);">
      <i class="ti ti-plus" style="font-size:24px;" aria-hidden="true"></i>
      <span style="font-size:12.5px;font-weight:600;">Agregar cliente</span>
    </div>`;
}

async function renderizarListaClientes() {
  const clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  const cont = document.getElementById('lista-clientes');

  if (clientes.length === 0) {
    cont.innerHTML = `<div class="estado-vacio"><i class="ti ti-building-off" aria-hidden="true"></i><p>Todavía no agregaste clientes</p></div>`;
    return;
  }

  const tarjetas = await Promise.all(clientes.map(async cliente => {
    const sistemas = await FireDB.getByIndex(FireDB.STORES.SISTEMAS, 'clienteId', cliente.id);
    const inspecciones = await FireDB.getByIndex(FireDB.STORES.INSPECCIONES, 'clienteId', cliente.id);
    const ultimaInsp = inspecciones.sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    const promedio = inspecciones.length
      ? Math.round(inspecciones.reduce((acc, i) => acc + (i.cumplimiento || 0), 0) / inspecciones.length)
      : 100;
    const estado = NFPA25.estadoPorCumplimiento(promedio);
    const claseFill = estado.nivel === 'ok' ? 'relleno-verde' : (estado.nivel === 'warn' ? 'relleno-amber' : 'relleno-rojo');
    const claseBadge = estado.nivel === 'ok' ? 'badge-ok' : (estado.nivel === 'warn' ? 'badge-warn' : 'badge-danger');
    const colores = colorAvatarDe(cliente.id);

    return `
      <div class="card" style="cursor:pointer;" onclick="UI.verDetalleCliente('${cliente.id}')">
        <div style="display:flex;align-items:center;gap:11px;">
          ${cliente.logoDataUrl
            ? `<img src="${cliente.logoDataUrl}" style="width:58px;height:40px;border-radius:8px;object-fit:contain;background:white;border:1px solid var(--gris-200);padding:2px;flex-shrink:0;">`
            : `<div class="avatar-cliente" style="background:${colores.bg};color:${colores.fg};">${inicialesDe(cliente.nombre)}</div>`}
          <div style="flex:1;min-width:0;">
            <p style="font-size:14px;font-weight:600;color:var(--gris-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cliente.nombre}</p>
            <span style="font-size:11.5px;color:var(--gris-500);">${sistemas.length} sistema${sistemas.length === 1 ? '' : 's'} · ${ultimaInsp ? 'Última insp: ' + formatearFecha(ultimaInsp.fecha) : 'Sin inspecciones'}</span>
          </div>
          <span class="badge ${claseBadge}">${promedio}%</span>
        </div>
        <div style="margin-top:11px;"><div class="progreso-barra"><div class="relleno ${claseFill}" style="width:${promedio}%"></div></div></div>
      </div>`;
  }));

  cont.innerHTML = tarjetas.join('');
}

/* ═══════════════════════════════════════════════════════════════
   HUB DEL CLIENTE — Centro de operaciones
   Sub-pestañas: Resumen · Inspecciones · Equipos · Planes · Informes
═══════════════════════════════════════════════════════════════ */

const HUB_TABS = [
  { id: 'resumen',      label: 'Resumen',      icono: 'layout-dashboard' },
  { id: 'inspecciones', label: 'Inspecciones', icono: 'clipboard-check'  },
  { id: 'equipos',      label: 'Equipos',      icono: 'tools'            },
  { id: 'planes',       label: 'Planes',       icono: 'list-check'       },
  { id: 'informes',     label: 'Informes',     icono: 'file-type-pdf'    },
];

async function verDetalleCliente(clienteId) {
  Estado.clienteDetalleActual = clienteId;
  Estado.hubTab = 'resumen';
  const cliente = await FireDB.get(FireDB.STORES.CLIENTES, clienteId);
  if (!cliente) { mostrarToast('Cliente no encontrado', 'error'); return; }

  const cont = document.getElementById('detalle-cliente-contenido');
  cont.innerHTML = `
    <!-- Encabezado del cliente -->
    <div class="card" style="margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${cliente.logoDataUrl
          ? `<img src="${cliente.logoDataUrl}" style="width:76px;height:50px;border-radius:8px;object-fit:contain;background:white;border:1px solid var(--gris-200);padding:3px;flex-shrink:0;">`
          : `<div class="avatar-cliente" style="width:52px;height:52px;font-size:17px;background:${colorAvatarDe(cliente.id).bg};color:${colorAvatarDe(cliente.id).fg};">${inicialesDe(cliente.nombre)}</div>`}
        <div style="flex:1;min-width:0;">
          <p style="font-size:16px;font-weight:700;">${cliente.nombre}</p>
          <span style="font-size:12px;color:var(--gris-500);">${cliente.direccion || 'Sin dirección registrada'}</span>
          <div style="display:flex;gap:14px;font-size:12px;color:var(--gris-600);margin-top:3px;">
            <span><i class="ti ti-user" aria-hidden="true"></i> ${cliente.contacto || '-'}</span>
            <span><i class="ti ti-phone" aria-hidden="true"></i> ${cliente.telefono || '-'}</span>
          </div>
        </div>
        <button class="btn btn-sm btn-secundario" onclick="UI.abrirModalCliente('${cliente.id}')" aria-label="Editar cliente"><i class="ti ti-edit" aria-hidden="true"></i></button>
      </div>
    </div>

    <!-- Sub-pestañas del hub -->
    <div id="hub-tabbar" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px;-webkit-overflow-scrolling:touch;"></div>

    <!-- Contenido de la pestaña activa -->
    <div id="hub-contenido"></div>
  `;

  irA('detalle-cliente');
  hubIrA('resumen');
}

function hubRenderTabbar() {
  const bar = document.getElementById('hub-tabbar');
  if (!bar) return;
  bar.innerHTML = HUB_TABS.map(t => `
    <button onclick="UI.hubIrA('${t.id}')"
      style="display:flex;align-items:center;gap:6px;white-space:nowrap;padding:8px 14px;border-radius:20px;
             font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;
             border:1.5px solid ${t.id === Estado.hubTab ? 'var(--rojo)' : 'var(--gris-300)'};
             background:${t.id === Estado.hubTab ? 'var(--rojo)' : 'white'};
             color:${t.id === Estado.hubTab ? 'white' : 'var(--gris-700)'};">
      <i class="ti ti-${t.icono}" aria-hidden="true"></i>${t.label}
    </button>`).join('');
}

async function hubIrA(tab) {
  Estado.hubTab = tab;
  hubRenderTabbar();
  const cont = document.getElementById('hub-contenido');
  if (!cont) return;
  cont.innerHTML = '<p style="font-size:12.5px;color:var(--gris-400);padding:20px;text-align:center;">Cargando…</p>';
  const clienteId = Estado.clienteDetalleActual;

  if (tab === 'resumen')      return hubRenderResumen(cont, clienteId);
  if (tab === 'inspecciones') return hubRenderInspecciones(cont, clienteId);
  if (tab === 'equipos')      return hubRenderEquipos(cont, clienteId);
  if (tab === 'planes')       return hubRenderPlanes(cont, clienteId);
  if (tab === 'informes')     return hubRenderInformes(cont, clienteId);
}

/* ─── RESUMEN ─── */
async function hubRenderResumen(cont, clienteId) {
  const inspecciones = (await FireDB.getByIndex(FireDB.STORES.INSPECCIONES, 'clienteId', clienteId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const planes = (await FireDB.getByIndex(FireDB.STORES.PLANES_ACCION, 'clienteId', clienteId));
  const abiertos = planes.filter(p => p.estado !== PlanesAccion.ESTADOS.CERRADO);
  const vencidos = abiertos.filter(p => p.estado === PlanesAccion.ESTADOS.VENCIDO);
  const eventos = (await FireDB.getAll(FireDB.STORES.EVENTOS))
    .filter(e => e.clienteId === clienteId && e.fecha >= new Date().toISOString().split('T')[0])
    .sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 3);

  const promedio = inspecciones.length
    ? Math.round(inspecciones.reduce((a, i) => a + (i.cumplimiento || 0), 0) / inspecciones.length) : null;
  const estado = promedio !== null ? NFPA25.estadoPorCumplimiento(promedio) : null;

  cont.innerHTML = `
    <div class="card">
      <div class="card-titulo"><i class="ti ti-gauge" aria-hidden="true"></i>Cumplimiento general
        ${estado ? `<span class="ref-norma" style="color:${estado.color};font-weight:700;">${promedio}% · ${estado.label}</span>` : '<span class="ref-norma">Sin datos</span>'}
      </div>
      ${estado ? `<div class="progreso-barra"><div class="relleno ${estado.nivel === 'ok' ? 'relleno-verde' : estado.nivel === 'warn' ? 'relleno-amber' : 'relleno-rojo'}" style="width:${promedio}%"></div></div>`
               : '<p style="font-size:12.5px;color:var(--gris-500);">Todavía no hay inspecciones registradas</p>'}
      <div style="display:flex;gap:16px;margin-top:12px;font-size:12.5px;color:var(--gris-600);">
        <span><strong style="color:var(--gris-900);">${inspecciones.length}</strong> inspecciones</span>
        <span><strong style="color:${abiertos.length ? 'var(--ambar, #D68910)' : 'var(--gris-900)'};">${abiertos.length}</strong> acciones abiertas</span>
        ${vencidos.length ? `<span style="color:var(--rojo);"><strong>${vencidos.length}</strong> vencidas</span>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-titulo"><i class="ti ti-calendar-event" aria-hidden="true"></i>Próximas visitas<span class="ref-norma">${eventos.length}</span></div>
      ${eventos.length === 0
        ? `<p style="font-size:12.5px;color:var(--gris-500);">Sin visitas agendadas — <a href="#" onclick="UI.irA('calendario');return false;" style="color:var(--rojo);">programar en Agenda</a></p>`
        : eventos.map(e => {
            const modelo = NFPA25.MODELO[e.tipoSistema] || {};
            return `<div class="lista-item" onclick="UI.irA('calendario')">
              <div class="icono-circulo" style="background:${(modelo.color || '#888')}18;"><i class="ti ti-${modelo.icono || 'calendar'}" style="color:${modelo.color || '#888'};" aria-hidden="true"></i></div>
              <div class="info"><p>${modelo.nombre || e.titulo || 'Visita'}</p><span>${formatearFecha(e.fecha)}</span></div>
            </div>`;
          }).join('')}
    </div>

    ${inspecciones.length ? `
    <div class="card">
      <div class="card-titulo"><i class="ti ti-history" aria-hidden="true"></i>Última inspección</div>
      ${(() => {
        const i = inspecciones[0];
        const modelo = NFPA25.MODELO[i.tipoSistema];
        const est = NFPA25.estadoPorCumplimiento(i.cumplimiento || 0);
        return `<div class="lista-item" onclick="UI.verDetalleInspeccion('${i.id}')">
          <div class="icono-circulo" style="background:${modelo.color}18;"><i class="ti ti-${modelo.icono}" style="color:${modelo.color};" aria-hidden="true"></i></div>
          <div class="info"><p>${modelo.nombre}${i.frecuencia ? ' · ' + NFPA25.etiquetaFrecuencia(i.frecuencia) : ''}</p><span>${formatearFecha(i.fecha)} · ${i.inspector || ''}</span></div>
          <span class="badge ${est.nivel === 'ok' ? 'badge-ok' : est.nivel === 'warn' ? 'badge-warn' : 'badge-danger'}">${i.cumplimiento || 0}%</span>
        </div>`;
      })()}
    </div>` : ''}

    <button class="btn btn-primary btn-block" onclick="UI.nuevaInspeccionParaCliente('${clienteId}')">
      <i class="ti ti-clipboard-plus" aria-hidden="true"></i> Nueva inspección
    </button>`;
}

/* ─── INSPECCIONES ─── */
async function hubRenderInspecciones(cont, clienteId) {
  const inspecciones = (await FireDB.getByIndex(FireDB.STORES.INSPECCIONES, 'clienteId', clienteId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const filtro = Estado.hubFiltroSistema || 'todos';
  const lista = filtro === 'todos' ? inspecciones : inspecciones.filter(i => i.tipoSistema === filtro);

  const pill = (id, label) => `
    <button onclick="Estado.hubFiltroSistema='${id}';UI.hubIrA('inspecciones')"
      style="padding:6px 12px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;
             border:1.5px solid ${filtro === id ? 'var(--gris-700)' : 'var(--gris-300)'};
             background:${filtro === id ? 'var(--gris-700)' : 'white'};
             color:${filtro === id ? 'white' : 'var(--gris-600)'};">${label}</button>`;

  cont.innerHTML = `
    <button class="btn btn-primary btn-block" style="margin-bottom:12px;" onclick="UI.nuevaInspeccionParaCliente('${clienteId}')">
      <i class="ti ti-clipboard-plus" aria-hidden="true"></i> Nueva inspección a este cliente
    </button>

    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:10px;">
      ${pill('todos', 'Todos')}
      ${Object.entries(NFPA25.MODELO).map(([id, m]) => pill(id, m.nombre.split(' ')[0])).join('')}
    </div>

    <div class="card">
      <div class="card-titulo"><i class="ti ti-history" aria-hidden="true"></i>Historial<span class="ref-norma">${lista.length}</span></div>
      ${lista.length === 0
        ? `<p style="font-size:12.5px;color:var(--gris-500);">Sin inspecciones${filtro !== 'todos' ? ' de este sistema' : ''} todavía</p>`
        : lista.map(i => {
            const modelo = (typeof HallazgosAuditoria !== 'undefined')
              ? HallazgosAuditoria.resolverModeloVisual(i.tipoSubtipo === 'curva_desempeno' ? 'curva_desempeno' : i.tipoSistema)
              : NFPA25.MODELO[i.tipoSistema];
            const est = NFPA25.estadoPorCumplimiento(i.cumplimiento || 0);
            return `<div class="lista-item" style="display:flex;align-items:center;gap:0;padding-right:4px;">
              <div style="flex:1;display:flex;align-items:center;gap:12px;cursor:pointer;padding:12px 0 12px 12px;" onclick="UI.verDetalleInspeccion('${i.id}')">
                <div class="icono-circulo" style="background:${modelo.color}18;flex-shrink:0;"><i class="ti ti-${modelo.icono}" style="color:${modelo.color};" aria-hidden="true"></i></div>
                <div class="info" style="flex:1;min-width:0;">
                  <p style="margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${modelo.nombre}${i.equipoTag ? ' · ' + i.equipoTag : (i.nombreSistema ? ' · ' + i.nombreSistema : '')}</p>
                  <span>${formatearFecha(i.fecha)}${i.frecuencia ? ' · Visita ' + NFPA25.etiquetaFrecuencia(i.frecuencia) : ''}</span>
                </div>
                <span class="badge ${est.nivel === 'ok' ? 'badge-ok' : est.nivel === 'warn' ? 'badge-warn' : 'badge-danger'}" style="flex-shrink:0;">${i.cumplimiento || 0}%</span>
              </div>
              <button onclick="UI.eliminarInspeccion('${i.id}','${clienteId}')"
                style="flex-shrink:0;background:none;border:none;cursor:pointer;padding:10px 10px 10px 8px;color:var(--gris-400);line-height:1;"
                title="Eliminar inspección" aria-label="Eliminar inspección">
                <i class="ti ti-trash" style="font-size:18px;" aria-hidden="true"></i>
              </button>
            </div>`;
          }).join('')}
    </div>`;
}

/* ─── EQUIPOS ─── */
/* ─── BORRAR INSPECCIÓN ─── */
async function eliminarInspeccion(inspeccionId, clienteId) {
  // Modal de confirmación en lugar de confirm() nativo — más amigable en móvil
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;max-width:340px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.18);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="background:#FEF2F2;border-radius:50%;padding:8px;"><i class="ti ti-trash" style="color:#DC2626;font-size:20px;"></i></div>
        <strong style="font-size:15px;">Eliminar inspección</strong>
      </div>
      <p style="font-size:13px;color:var(--gris-600);line-height:1.5;margin-bottom:20px;">
        Esta acción es permanente. La inspección y sus datos no podrán recuperarse.<br><strong>¿Querés continuar?</strong>
      </p>
      <div style="display:flex;gap:10px;">
        <button id="btn-cancel-del" class="btn btn-secundario" style="flex:1;">Cancelar</button>
        <button id="btn-confirm-del" class="btn" style="flex:1;background:var(--rojo);color:white;">Eliminar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  await new Promise(resolve => {
    modal.querySelector('#btn-cancel-del').onclick  = () => { modal.remove(); resolve(false); };
    modal.querySelector('#btn-confirm-del').onclick = async () => {
      modal.remove();
      try {
        await FireDB.delete(FireDB.STORES.INSPECCIONES, inspeccionId);
        // Eliminar también las fotos asociadas si existen
        const fotos = await FireDB.getByIndex(FireDB.STORES.FOTOS, 'inspeccionId', inspeccionId).catch(() => []);
        for (const f of fotos) await FireDB.delete(FireDB.STORES.FOTOS, f.id).catch(() => {});
        mostrarToast('Inspección eliminada', 'exito');
        hubIrA('inspecciones');
      } catch(e) {
        mostrarToast('Error al eliminar', 'error');
      }
      resolve(true);
    };
  });
}

async function hubRenderEquipos(cont, clienteId) {
  cont.innerHTML = `
    <div class="card">
      <div class="card-titulo"><i class="ti ti-tools" aria-hidden="true"></i>Equipos registrados
        <span class="ref-norma" id="equipos-contador">…</span>
      </div>
      <p style="font-size:11.5px;color:var(--gris-500);margin-bottom:10px;line-height:1.5;">
        Cargá cada equipo una sola vez. En cada inspección lo seleccionás y sus datos ya vienen precargados.
      </p>
      <div id="lista-equipos-cliente"></div>
      <button class="btn btn-secundario btn-block" style="margin-top:8px;" onclick="UI.abrirModalEquipo('${clienteId}')">
        <i class="ti ti-plus" aria-hidden="true"></i> Agregar equipo
      </button>
    </div>`;
  renderizarEquiposCliente(clienteId);
}

/* ─── PLANES DE ACCIÓN ─── */
async function hubRenderPlanes(cont, clienteId) {
  const planes = (await FireDB.getByIndex(FireDB.STORES.PLANES_ACCION, 'clienteId', clienteId))
    .sort((a, b) => {
      const orden = { vencido: 0, pendiente: 1, en_proceso: 2, cerrado: 3 };
      return (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9) || a.fechaLimite.localeCompare(b.fechaLimite);
    });

  const badgeEstado = p => {
    if (p.estado === PlanesAccion.ESTADOS.VENCIDO)    return '<span class="badge badge-danger">Vencido</span>';
    if (p.estado === PlanesAccion.ESTADOS.EN_PROCESO) return '<span class="badge badge-warn">En proceso</span>';
    if (p.estado === PlanesAccion.ESTADOS.CERRADO)    return '<span class="badge badge-ok">Resuelto</span>';
    return '<span class="badge" style="background:var(--gris-200);color:var(--gris-700);">Pendiente</span>';
  };

  cont.innerHTML = `
    <div class="card">
      <div class="card-titulo"><i class="ti ti-list-check" aria-hidden="true"></i>Intervenciones y no conformidades<span class="ref-norma">${planes.length}</span></div>
      ${planes.length === 0
        ? `<p style="font-size:12.5px;color:var(--gris-500);">Este cliente no tiene planes de acción — todo en orden ✓</p>`
        : planes.map(p => `
          <div style="padding:10px 0;border-bottom:1px solid var(--gris-100);">
            <div style="display:flex;align-items:flex-start;gap:8px;">
              <div style="flex:1;min-width:0;">
                <p style="font-size:13px;color:var(--gris-900);line-height:1.4;">${p.descripcion}</p>
                <p style="font-size:11.5px;color:var(--gris-500);margin-top:2px;">
                  ${p.estado === PlanesAccion.ESTADOS.CERRADO ? 'Resuelto' : 'Vence'} ${formatearFecha(p.fechaLimite)}${p.criticidad === 'alta' ? ' · <span style="color:var(--rojo);font-weight:600;">Crítico</span>' : ''}
                </p>
              </div>
              ${badgeEstado(p)}
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
              <button class="btn btn-sm btn-secundario" onclick="UI.abrirModalEditarPlan('${p.id}')"><i class="ti ti-edit" aria-hidden="true"></i> Editar</button>
              ${p.estado !== PlanesAccion.ESTADOS.CERRADO ? `
                ${p.estado !== PlanesAccion.ESTADOS.EN_PROCESO ? `<button class="btn btn-sm btn-secundario" onclick="UI.hubCambiarEstadoPlan('${p.id}','en_proceso')"><i class="ti ti-player-play" aria-hidden="true"></i> En proceso</button>` : ''}
                <button class="btn btn-sm btn-primary" onclick="UI.hubCambiarEstadoPlan('${p.id}','cerrado')"><i class="ti ti-check" aria-hidden="true"></i> Resuelto</button>
              ` : `
                <button class="btn btn-sm btn-secundario" onclick="UI.hubReabrirPlan('${p.id}')"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> Reabrir</button>
              `}
            </div>
          </div>`).join('')}
    </div>`;
}

async function hubCambiarEstadoPlan(planId, estado) {
  await UI.cambiarEstadoPlan(planId, estado);
  hubIrA('planes');
}

async function hubReabrirPlan(planId) {
  if (!confirm('¿Reabrir este plan de acción? Volverá a estado pendiente.')) return;
  await PlanesAccion.actualizarEstado(planId, 'pendiente', 'Plan reabierto por el administrador (cierre por error)');
  await PlanesAccion.actualizarVencimientos();
  mostrarToast('Plan reabierto', 'exito');
  hubIrA('planes');
}

/* ─── INFORMES ─── */
async function hubRenderInformes(cont, clienteId) {
  const inspecciones = (await FireDB.getByIndex(FireDB.STORES.INSPECCIONES, 'clienteId', clienteId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  cont.innerHTML = `
    <div class="card">
      <div class="card-titulo"><i class="ti ti-file-type-pdf" aria-hidden="true"></i>Informes del cliente<span class="ref-norma">${inspecciones.length}</span></div>
      <p style="font-size:11.5px;color:var(--gris-500);margin-bottom:10px;">Tocá para ver en pantalla · <i class="ti ti-download" aria-hidden="true"></i> descarga el PDF directo</p>
      ${inspecciones.length === 0
        ? `<p style="font-size:12.5px;color:var(--gris-500);">Sin informes todavía</p>`
        : inspecciones.map(i => {
            const modelo = (typeof HallazgosAuditoria !== 'undefined')
              ? HallazgosAuditoria.resolverModeloVisual(i.tipoSubtipo === 'curva_desempeno' ? 'curva_desempeno' : i.tipoSistema)
              : NFPA25.MODELO[i.tipoSistema];
            return `<div class="lista-item">
              <div class="icono-circulo" style="background:${modelo.color}18;" onclick="UI.verDetalleInspeccion('${i.id}')"><i class="ti ti-${modelo.icono}" style="color:${modelo.color};" aria-hidden="true"></i></div>
              <div class="info" onclick="UI.verDetalleInspeccion('${i.id}')">
                <p>${i.tipoSubtipo === 'curva_desempeno' ? 'Curva de Desempeño' : modelo.nombre}</p>
                <span>${formatearFecha(i.fecha)} · ${i.inspector || ''}</span>
              </div>
              <button class="btn btn-sm btn-secundario" onclick="event.stopPropagation();UI.descargarPDFInspeccion('${i.id}')" aria-label="Descargar PDF">
                <i class="ti ti-download" aria-hidden="true"></i>
              </button>
            </div>`;
          }).join('')}
    </div>`;
}

/* ─── Nueva inspección con el cliente ya en contexto ─── */
function nuevaInspeccionParaCliente(clienteId) {
  Estado.clientePreseleccionado = clienteId;
  irA('inspeccion');
}

/* ═══════════════════════════════════════════════════════════════
   EQUIPOS DEL CLIENTE (base de activos)
═══════════════════════════════════════════════════════════════ */

async function renderizarEquiposCliente(clienteId) {
  const cont = document.getElementById('lista-equipos-cliente');
  const contador = document.getElementById('equipos-contador');
  if (!cont) return;
  const equipos = await Equipos.listarPorCliente(clienteId);
  if (contador) contador.textContent = equipos.length;

  if (equipos.length === 0) {
    cont.innerHTML = `<p style="font-size:12.5px;color:var(--gris-500);">Sin equipos registrados todavía</p>`;
    return;
  }

  cont.innerHTML = equipos.map(eq => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:var(--gris-50);border:1px solid var(--gris-200);border-radius:var(--border-radius-md);margin-bottom:6px;">
      <div class="icono-circulo" style="background:${Equipos.tipoColor(eq.tipoSistema)}18;flex-shrink:0;">
        <i class="ti ti-${Equipos.tipoIcono(eq.tipoSistema)}" style="color:${Equipos.tipoColor(eq.tipoSistema)};" aria-hidden="true"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <p style="font-size:13px;font-weight:600;color:var(--gris-900);">${eq.tag}</p>
        <p style="font-size:11.5px;color:var(--gris-500);">${Equipos.tipoLabel(eq.tipoSistema)}${Equipos.resumenDe(eq) ? ' · ' + Equipos.resumenDe(eq) : ''}</p>
      </div>
      <button class="btn btn-sm btn-secundario" onclick="UI.abrirModalEquipo('${clienteId}','${eq.id}')" aria-label="Editar equipo"><i class="ti ti-edit" aria-hidden="true"></i></button>
      <button class="btn btn-sm btn-secundario" onclick="UI.eliminarEquipoUI('${eq.id}','${(eq.tag || '').replace(/'/g,'')}','${clienteId}')" aria-label="Eliminar equipo"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>`).join('');
}

/* Construye los campos dinámicos del equipo según su tipo */
function renderizarCamposEquipo(tipo, datos = {}) {
  const campos = Equipos.camposDe(tipo);
  const esBomba = tipo === 'bomba';
  let html = '';
  campos.forEach((campo, idx) => {
    // separador visual entre placa de bomba y datos operativos
    if (esBomba && idx === 0) html += `<div class="seccion-titulo" style="margin-top:4px;">Placa del fabricante</div>`;
    if (esBomba && idx === Equipos.CAMPOS_PLACA_BOMBA.length) html += `<div class="seccion-titulo" style="margin-top:10px;">Datos operativos</div>`;

    const valor = datos[campo.id] !== undefined ? datos[campo.id] : '';
    if (campo.tipo === 'select') {
      const opciones = campo.opciones.map(o => {
        const v = typeof o === 'object' ? o.v : o;
        const t = typeof o === 'object' ? o.t : o;
        return `<option value="${v}" ${String(valor) === String(v) ? 'selected' : ''}>${t}</option>`;
      }).join('');
      html += `<div class="campo"><label>${campo.label}</label><select id="eqc-${campo.id}">${opciones}</select></div>`;
    } else {
      html += `<div class="campo"><label>${campo.label}${campo.opcional ? ' · opcional' : ''}</label>
        <input type="text" id="eqc-${campo.id}" inputmode="${campo.tipo === 'numero' ? 'decimal' : 'text'}"
               placeholder="${campo.placeholder || ''}" value="${valor}"></div>`;
    }
  });
  document.getElementById('equipo-campos-dinamicos').innerHTML = html;
}

async function abrirModalEquipo(clienteId, equipoId) {
  document.getElementById('equipo-cliente-id').value = clienteId;
  document.getElementById('equipo-id-edit').value = equipoId || '';
  document.getElementById('modal-equipo-titulo').textContent = equipoId ? 'Editar equipo' : 'Nuevo equipo';

  const selTipo = document.getElementById('equipo-tipo');
  selTipo.innerHTML = Equipos.TIPOS.map(t => `<option value="${t}">${Equipos.tipoLabel(t)}</option>`).join('');

  if (equipoId) {
    const eq = await Equipos.obtener(equipoId);
    selTipo.value = eq.tipoSistema;
    selTipo.disabled = true;   // el tipo no se cambia al editar
    document.getElementById('equipo-tag').value = eq.tag || '';
    renderizarCamposEquipo(eq.tipoSistema, eq.datos || {});
  } else {
    selTipo.disabled = false;
    selTipo.value = Equipos.TIPOS[0];
    document.getElementById('equipo-tag').value = '';
    renderizarCamposEquipo(selTipo.value);
  }
  abrirModal('modal-equipo');
}

async function guardarEquipo() {
  const clienteId = document.getElementById('equipo-cliente-id').value;
  const equipoId  = document.getElementById('equipo-id-edit').value;
  const tipo      = document.getElementById('equipo-tipo').value;
  const tag       = document.getElementById('equipo-tag').value.trim();
  if (!tag) { mostrarToast('Ingresá la identificación/TAG del equipo', 'error'); return; }

  const datos = {};
  Equipos.camposDe(tipo).forEach(campo => {
    const el = document.getElementById('eqc-' + campo.id);
    if (el && el.value !== '') datos[campo.id] = el.value;
  });

  await Equipos.guardar({ id: equipoId || null, clienteId, tipoSistema: tipo, tag, datos });
  cerrarModal('modal-equipo');
  renderizarEquiposCliente(clienteId);
  mostrarToast('Equipo guardado', 'exito');
}

async function eliminarEquipoUI(equipoId, tag, clienteId) {
  if (!confirm(`¿Eliminar el equipo "${tag}"? Las inspecciones ya realizadas no se pierden.`)) return;
  await Equipos.eliminar(equipoId);
  renderizarEquiposCliente(clienteId);
  mostrarToast('Equipo eliminado');
}

/* ═══════════════════════════════════════════════════════════════
   PARQUE DE EQUIPOS — Vista global de toda la cartera
   Bombas con su empresa, y resumen de infraestructura por cliente
═══════════════════════════════════════════════════════════════ */

async function renderizarEquiposGlobal() {
  const equipos  = await FireDB.getAll(FireDB.STORES.EQUIPOS);
  const clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  const nombreDe = {};
  clientes.forEach(c => nombreDe[c.id] = c.nombre);

  /* ── Bombas de la cartera ── */
  const bombas = equipos.filter(e => e.tipoSistema === 'bomba')
    .sort((a, b) => (nombreDe[a.clienteId] || '').localeCompare(nombreDe[b.clienteId] || '') || (a.tag || '').localeCompare(b.tag || ''));

  if (!Estado.equiposFiltroBomba) Estado.equiposFiltroBomba = 'todas';
  const filtro = Estado.equiposFiltroBomba;
  const esMotobomba = e => (e.datos?.tipoAccion === 'diesel' || e.datos?.tipoAccion === 'vapor');
  const bombasVisibles = bombas.filter(e =>
    filtro === 'todas' ? true : filtro === 'motobombas' ? esMotobomba(e) : !esMotobomba(e));

  const contador = document.getElementById('equipos-bombas-contador');
  if (contador) contador.textContent =
    `${bombas.filter(esMotobomba).length} motobombas · ${bombas.filter(e => !esMotobomba(e)).length} electrobombas`;

  const FILTROS = [
    { id: 'todas',        label: 'Todas' },
    { id: 'motobombas',   label: 'Motobombas (diesel)' },
    { id: 'electrobombas',label: 'Electrobombas' },
  ];
  const filtrosEl = document.getElementById('equipos-filtros-bombas');
  if (filtrosEl) filtrosEl.innerHTML = FILTROS.map(f => `
    <button onclick="Estado.equiposFiltroBomba='${f.id}';UI.renderizarEquiposGlobal()"
      style="padding:6px 13px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;
             border:1.5px solid ${filtro === f.id ? 'var(--gris-700)' : 'var(--gris-300)'};
             background:${filtro === f.id ? 'var(--gris-700)' : 'white'};
             color:${filtro === f.id ? 'white' : 'var(--gris-600)'};">${f.label}</button>`).join('');

  const listaEl = document.getElementById('equipos-lista-bombas');
  if (listaEl) {
    listaEl.innerHTML = bombasVisibles.length === 0
      ? `<p style="font-size:12.5px;color:var(--gris-500);">Sin bombas registradas${filtro !== 'todas' ? ' en este filtro' : ' — cargalas desde el hub de cada cliente'}</p>`
      : bombasVisibles.map(e => {
          const d = e.datos || {};
          const tipoTxt = esMotobomba(e) ? 'Motobomba diesel' : 'Electrobomba';
          const specs = [d.marca, d.qn ? `${d.qn} GPM` : '', d.pn ? `${d.pn} PSI` : ''].filter(Boolean).join(' · ');
          return `
          <div class="lista-item" onclick="UI.verDetalleEquipoGlobal('${e.id}')">
            <div class="icono-circulo" style="background:${esMotobomba(e) ? '#D6891018' : '#1A527618'};">
              <i class="ti ti-engine" style="color:${esMotobomba(e) ? '#D68910' : '#1A5276'};" aria-hidden="true"></i>
            </div>
            <div class="info">
              <p>${e.tag}</p>
              <span><strong style="color:var(--gris-700);">${nombreDe[e.clienteId] || '—'}</strong> · ${tipoTxt}${specs ? ' · ' + specs : ''}</span>
            </div>
            <i class="ti ti-chevron-right" style="color:var(--gris-300);" aria-hidden="true"></i>
          </div>`;
        }).join('');
  }

  /* ── Infraestructura por empresa ── */
  const resumenEl = document.getElementById('equipos-resumen-empresas');
  if (resumenEl) {
    const filas = clientes.map(c => {
      const eqs = equipos.filter(e => e.clienteId === c.id);
      if (eqs.length === 0) return null;
      const tanques = eqs.filter(e => e.tipoSistema === 'tanque');
      const aguaM3 = tanques.reduce((a, t) => {
        const d = t.datos || {};
        if (d.capacidadM3)  return a + (parseFloat(d.capacidadM3) || 0);
        if (d.capacidadGal) return a + (parseFloat(d.capacidadGal) || 0) / 264.172;
        return a;
      }, 0);
      return {
        nombre: c.nombre,
        agua: Math.round(aguaM3 * 10) / 10,
        nTanques: tanques.length,
        nBombas: eqs.filter(e => e.tipoSistema === 'bomba').length,
        nRiser: eqs.filter(e => e.tipoSistema === 'rociador').length,
        nHidrantes: eqs.filter(e => e.tipoSistema === 'hidrante').length,
      };
    }).filter(Boolean);

    const chipInfo = (icono, valor, etiqueta, color) => `
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--gris-700);
                   background:var(--gris-50);border:1px solid var(--gris-200);border-radius:14px;padding:4px 10px;">
        <i class="ti ti-${icono}" style="color:${color};" aria-hidden="true"></i>
        <strong>${valor}</strong>&nbsp;${etiqueta}
      </span>`;

    resumenEl.innerHTML = filas.length === 0
      ? '<p style="font-size:12.5px;color:var(--gris-500);">Todavía no hay equipos registrados</p>'
      : filas.map(f => `
        <div style="padding:11px 0;border-bottom:1px solid var(--gris-100);">
          <p style="font-size:13.5px;font-weight:700;color:var(--gris-900);margin-bottom:7px;">${f.nombre}</p>
          <div style="display:flex;gap:7px;flex-wrap:wrap;">
            ${chipInfo('droplet', `${f.agua.toLocaleString('es-AR')} m³`, `en ${f.nTanques} tanque${f.nTanques === 1 ? '' : 's'}`, '#1A5276')}
            ${chipInfo('engine', f.nBombas, `bomba${f.nBombas === 1 ? '' : 's'}`, '#D68910')}
            ${chipInfo('spray', f.nRiser, 'RISER / ECA', '#C0392B')}
            ${chipInfo('fire-hydrant', f.nHidrantes, `hidrante${f.nHidrantes === 1 ? '' : 's'}`, '#117864')}
          </div>
        </div>`).join('');
  }
}

/* Detalle de equipo: SOLO datos de placa + historial de intervenciones */
async function verDetalleEquipoGlobal(equipoId) {
  const eq = await Equipos.obtener(equipoId);
  if (!eq) { mostrarToast('Equipo no encontrado', 'error'); return; }
  const cliente = await FireDB.get(FireDB.STORES.CLIENTES, eq.clienteId);
  const inspecciones = (await FireDB.getAll(FireDB.STORES.INSPECCIONES))
    .filter(i => i.equipoId === equipoId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  document.getElementById('detalle-equipo-titulo').textContent = eq.tag;

  const campos = Equipos.camposDe(eq.tipoSistema);
  const d = eq.datos || {};
  const valorDe = campo => {
    let v = d[campo.id];
    if (v === undefined || v === '') return null;
    if (campo.tipo === 'select' && Array.isArray(campo.opciones) && typeof campo.opciones[0] === 'object') {
      const op = campo.opciones.find(o => o.v === v);
      if (op) v = op.t;
    }
    return v;
  };
  const conValor = campos.map(campo => ({ campo, valor: valorDe(campo) })).filter(x => x.valor !== null);

  document.getElementById('detalle-equipo-contenido').innerHTML = `
    <p style="font-size:12.5px;color:var(--gris-500);margin-bottom:12px;">
      <i class="ti ti-building" aria-hidden="true"></i> <strong style="color:var(--gris-800);">${cliente?.nombre || '—'}</strong>
      · ${Equipos.tipoLabel(eq.tipoSistema)}
    </p>

    <div class="seccion-titulo">Datos de placa</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin-bottom:14px;">
      ${conValor.length === 0
        ? '<p style="font-size:12.5px;color:var(--gris-500);grid-column:1/-1;">Sin datos cargados</p>'
        : conValor.map(({ campo, valor }) => `
          <div style="background:var(--gris-50);border-radius:var(--border-radius-sm);padding:7px 10px;">
            <p style="font-size:10.5px;color:var(--gris-500);">${campo.label}</p>
            <p style="font-size:13px;font-weight:600;color:var(--gris-900);">${valor}</p>
          </div>`).join('')}
    </div>

    <div class="seccion-titulo">Historial del equipo (${inspecciones.length})</div>
    ${inspecciones.length === 0
      ? '<p style="font-size:12.5px;color:var(--gris-500);margin-bottom:8px;">Sin inspecciones registradas sobre este equipo</p>'
      : inspecciones.map(i => {
          const esCurva = i.tipoSubtipo === 'curva_desempeno';
          const est = NFPA25.estadoPorCumplimiento(i.cumplimiento || 0);
          return `
          <div class="lista-item" onclick="UI.cerrarModal('modal-detalle-equipo');UI.verDetalleInspeccion('${i.id}')">
            <div class="icono-circulo" style="background:${esCurva ? '#1A527618' : 'var(--gris-100)'};">
              <i class="ti ti-${esCurva ? 'chart-line' : 'clipboard-check'}" style="color:${esCurva ? '#1A5276' : 'var(--gris-600)'};" aria-hidden="true"></i>
            </div>
            <div class="info">
              <p>${esCurva ? 'Curva de Desempeño' : 'Inspección' + (i.frecuencia ? ' ' + NFPA25.etiquetaFrecuencia(i.frecuencia) : '')}</p>
              <span>${formatearFecha(i.fecha)} · ${i.inspector || ''}</span>
            </div>
            ${esCurva ? '' : `<span class="badge ${est.nivel === 'ok' ? 'badge-ok' : est.nivel === 'warn' ? 'badge-warn' : 'badge-danger'}">${i.cumplimiento || 0}%</span>`}
          </div>`;
        }).join('')}
  `;
  abrirModal('modal-detalle-equipo');
}

function abrirModalCliente(clienteId) {
  Estado.logoTemporalCliente = null;
  document.getElementById('cliente-id-edit').value = clienteId || '';
  document.getElementById('modal-cliente-titulo').textContent = clienteId ? 'Editar cliente' : 'Nuevo cliente';
  document.getElementById('btn-eliminar-cliente').style.display = clienteId ? 'block' : 'none';

  if (clienteId) {
    FireDB.get(FireDB.STORES.CLIENTES, clienteId).then(cliente => {
      document.getElementById('cliente-nombre').value = cliente.nombre || '';
      document.getElementById('cliente-direccion').value = cliente.direccion || '';
      document.getElementById('cliente-contacto').value = cliente.contacto || '';
      document.getElementById('cliente-telefono').value = cliente.telefono || '';
      document.getElementById('cliente-email').value = cliente.email || '';
      document.getElementById('cliente-solo-incidentes').checked = !!cliente.soloIncidentes;
      document.getElementById('cliente-logo-texto').textContent = cliente.logoDataUrl ? 'Logo cargado · tocar para cambiar' : 'Tocar para subir logo (PNG)';
      Estado.logoTemporalCliente = cliente.logoDataUrl || null;
    });
  } else {
    document.getElementById('cliente-nombre').value = '';
    document.getElementById('cliente-direccion').value = '';
    document.getElementById('cliente-contacto').value = '';
    document.getElementById('cliente-telefono').value = '';
    document.getElementById('cliente-email').value = '';
    document.getElementById('cliente-solo-incidentes').checked = false;
    document.getElementById('cliente-logo-texto').textContent = 'Tocar para subir logo (PNG)';
  }
  abrirModal('modal-cliente');
}

async function guardarCliente() {
  const nombre = document.getElementById('cliente-nombre').value.trim();
  if (!nombre) { mostrarToast('El nombre del cliente es obligatorio', 'error'); return; }

  const id = document.getElementById('cliente-id-edit').value;
  const datos = {
    nombre,
    direccion: document.getElementById('cliente-direccion').value.trim(),
    contacto: document.getElementById('cliente-contacto').value.trim(),
    telefono: document.getElementById('cliente-telefono').value.trim(),
    email: document.getElementById('cliente-email').value.trim(),
    soloIncidentes: document.getElementById('cliente-solo-incidentes').checked,
    logoDataUrl: Estado.logoTemporalCliente
  };

  if (id) {
    const existente = await FireDB.get(FireDB.STORES.CLIENTES, id);
    await FireDB.put(FireDB.STORES.CLIENTES, { ...existente, ...datos });
    mostrarToast('Cliente actualizado', 'exito');
  } else {
    await FireDB.add(FireDB.STORES.CLIENTES, datos);
    mostrarToast('Cliente agregado', 'exito');
  }

  cerrarModal('modal-cliente');
  renderizarListaClientes();
  poblarSelectoresClientes();
}

document.addEventListener('DOMContentLoaded', () => {
  const inputLogo = document.getElementById('cliente-logo-input');
  if (inputLogo) {
    inputLogo.addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;
      const procesada = await FotosManager.procesar(archivo);
      Estado.logoTemporalCliente = procesada.dataUrl;
      document.getElementById('cliente-logo-texto').textContent = 'Logo cargado · tocar para cambiar';
    });
  }
});

/* Llena los <select> de cliente en distintos formularios de la app */
async function poblarSelectoresClientes() {
  const clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  const opciones = clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  ['evento-cliente', 'rep-cliente'].forEach(idSelect => {
    const sel = document.getElementById(idSelect);
    if (sel) sel.innerHTML = opciones || '<option value="">Sin clientes registrados</option>';
  });
}

window.UI = window.UI || {};
/* Wrapper para pantalla informe consolidado — evaluado en tiempo de ejecución */
function renderizarInformeConsolidado() {
  // icRenderPantalla se define en ui-informe-consolidado.js que carga después
  // Usamos window[] para forzar evaluación en tiempo de ejecución, no de parseo
  if (typeof window.icRenderPantalla === 'function') {
    window.icRenderPantalla();
  } else {
    const cont = document.getElementById('ic-contenido');
    if (cont) cont.innerHTML = '<p style="padding:20px;color:red;">Error: módulo de informe no cargado.</p>';
  }
}

Object.assign(window.UI, {
  irA, abrirModal, cerrarModal, renderizarInformeConsolidado,
  renderizarDashboard, renderizarListaClientes, verDetalleCliente, hubIrA, hubCambiarEstadoPlan, hubReabrirPlan, nuevaInspeccionParaCliente, renderizarEquiposCliente, renderizarCamposEquipo, renderizarEquiposGlobal, verDetalleEquipoGlobal, abrirModalEquipo, guardarEquipo, eliminarEquipoUI, eliminarInspeccion,
  abrirModalCliente, guardarCliente, poblarSelectoresClientes
});
window._mostrarToast = mostrarToast;
window._formatearFecha = formatearFecha;
window._diasEntre = diasEntre;
window._Estado = Estado;
