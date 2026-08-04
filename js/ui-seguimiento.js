/* ============================================================
   FireInspect Pro — UI de seguimiento extendido
   Recomendaciones del usuario:
   1. Eliminar clientes con archivado de su historial
   2. (conversión de unidades se aplica en ui-inspeccion.js)
   3. Envío de reportes por email
   4. Eventos de incidentes
   5. Hallazgos de auditoría / condiciones inseguras
   ============================================================ */

/* ============================================================
   SUB-NAVEGACIÓN dentro de la pantalla "Planes" (hub de seguimiento)
   ============================================================ */

function cambiarSubTabSeguimiento(subtab, btn) {
  document.querySelectorAll('.subtab-seguimiento').forEach(s => s.style.display = 'none');
  document.getElementById('subtab-' + subtab).style.display = 'block';

  const contenedorTabs = btn.closest('.tabs-scroll');
  contenedorTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
  btn.classList.add('activo');

  // mantiene sincronizado el resaltado del sidebar de escritorio con la
  // sub-pestaña activa, ya que Planes/Incidentes/Auditoría comparten pantalla
  document.querySelectorAll('#sidebar-nav button[data-pantalla="planes"]').forEach(b => {
    b.classList.toggle('activo', b.dataset.subtabTarget === subtab);
  });

  if (subtab === 'incidentes') renderizarIncidentes();
  if (subtab === 'auditoria') renderizarHallazgos();
  if (subtab === 'planes') renderizarPlanes();
}

/* Permite que el sidebar de escritorio navegue directo a una sub-pestaña
   (ej: UI.irA('planes', 'incidentes')) sin romper la navegación normal */
function irAConSubTab(nombrePantalla, subtab) {
  irA(nombrePantalla, subtab);
  if (subtab) {
    setTimeout(() => {
      const btn = document.querySelector(`[data-subtab="${subtab}"]`);
      if (btn) cambiarSubTabSeguimiento(subtab, btn);
    }, 0);
  }
}

/* ============================================================
   RECOMENDACIÓN 1: Eliminar cliente con advertencia y archivado
   ============================================================ */

function iniciarEliminacionCliente() {
  const clienteId = document.getElementById('cliente-id-edit').value;
  if (!clienteId) return;

  FireDB.contarRegistrosDeCliente(clienteId).then(async (conteo) => {
    const cliente = await FireDB.get(FireDB.STORES.CLIENTES, clienteId);
    const cont = document.getElementById('confirmar-eliminar-contenido');

    if (conteo.total === 0) {
      cont.innerHTML = `
        <p style="font-size:13.5px;color:var(--gris-900);margin-bottom:18px;line-height:1.5;">
          ¿Confirmás que querés eliminar a <strong>${cliente.nombre}</strong>? Este cliente no tiene inspecciones ni historial asociado todavía.
        </p>
        <div class="btn-fila" style="margin-top:0;">
          <button class="btn btn-secundario" onclick="UI.cerrarModal('modal-confirmar-eliminar-cliente')">Cancelar</button>
          <button class="btn btn-peligro" onclick="UI.confirmarEliminacionSinArchivo('${clienteId}')"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar</button>
        </div>`;
    } else {
      cont.innerHTML = `
        <p style="font-size:13.5px;color:var(--gris-900);margin-bottom:12px;line-height:1.5;">
          <strong>${cliente.nombre}</strong> tiene historial cargado en la app:
        </p>
        <ul style="font-size:12.5px;color:var(--gris-700);margin-bottom:16px;padding-left:18px;line-height:1.7;">
          ${conteo.sistemas > 0 ? `<li>${conteo.sistemas} sistema${conteo.sistemas === 1 ? '' : 's'} registrado${conteo.sistemas === 1 ? '' : 's'}</li>` : ''}
          ${conteo.inspecciones > 0 ? `<li>${conteo.inspecciones} inspección${conteo.inspecciones === 1 ? '' : 'es'}</li>` : ''}
          ${conteo.planesAccion > 0 ? `<li>${conteo.planesAccion} plan${conteo.planesAccion === 1 ? '' : 'es'} de acción</li>` : ''}
          ${conteo.incidentes > 0 ? `<li>${conteo.incidentes} incidente${conteo.incidentes === 1 ? '' : 's'}</li>` : ''}
          ${conteo.hallazgos > 0 ? `<li>${conteo.hallazgos} hallazgo${conteo.hallazgos === 1 ? '' : 's'} de auditoría</li>` : ''}
          ${conteo.eventos > 0 ? `<li>${conteo.eventos} evento${conteo.eventos === 1 ? '' : 's'} agendado${conteo.eventos === 1 ? '' : 's'}</li>` : ''}
          ${conteo.fotos > 0 ? `<li>${conteo.fotos} foto${conteo.fotos === 1 ? '' : 's'}</li>` : ''}
        </ul>
        <p style="font-size:12.5px;color:var(--gris-700);margin-bottom:16px;line-height:1.5;">
          Antes de borrar todo esto, te recomendamos descargar un archivo de respaldo con toda la información de este cliente.
        </p>
        <button class="btn btn-secundario btn-block" style="margin-bottom:10px;" onclick="UI.descargarArchivoCliente('${clienteId}')"><i class="ti ti-archive" aria-hidden="true"></i> Descargar archivo y luego eliminar</button>
        <div class="btn-fila" style="margin-top:0;">
          <button class="btn btn-secundario" onclick="UI.cerrarModal('modal-confirmar-eliminar-cliente')">Cancelar</button>
          <button class="btn btn-peligro" onclick="UI.confirmarEliminacionSinArchivo('${clienteId}')">Eliminar sin archivar</button>
        </div>`;
    }

    cerrarModal('modal-cliente');
    abrirModal('modal-confirmar-eliminar-cliente');
  });
}

/* Genera y descarga el archivo JSON con todo el historial del cliente,
   y luego de la descarga procede a eliminarlo de la base */
async function descargarArchivoCliente(clienteId) {
  const datos = await FireDB.recopilarDatosDeCliente(clienteId);
  const nombreCliente = datos.cliente ? datos.cliente.nombre : 'cliente';

  const paquete = {
    _tipo: 'archivo_cliente_fireinspect',
    _archivadoEn: new Date().toISOString(),
    ...datos
  };

  const blob = new Blob([JSON.stringify(paquete, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Archivo_${nombreCliente.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  await FireDB.eliminarClienteYTodoSuHistorial(clienteId);
  mostrarToast('Cliente archivado y eliminado correctamente', 'exito');
  finalizarEliminacionCliente();
}

async function confirmarEliminacionSinArchivo(clienteId) {
  await FireDB.eliminarClienteYTodoSuHistorial(clienteId);
  mostrarToast('Cliente eliminado', 'exito');
  finalizarEliminacionCliente();
}

function finalizarEliminacionCliente() {
  cerrarModal('modal-confirmar-eliminar-cliente');
  renderizarListaClientes();
  poblarSelectoresClientes();
  renderizarDashboard();
  if (Estado.pantallaActual === 'detalle-cliente') irA('clientes');
}

/* ============================================================
   RECOMENDACIÓN 4: Eventos de incidentes
   ============================================================ */

async function renderizarIncidentes() {
  const indicadores = await Incidentes.calcularIndicadores();
  document.getElementById('incidentes-metricas').innerHTML = `
    <div class="metrica neutro"><div class="valor">${indicadores.total}</div><div class="etiqueta">Total registrados</div></div>
    <div class="metrica warn"><div class="valor">${indicadores.alarmasFalsas}</div><div class="etiqueta">Alarmas falsas</div></div>
    <div class="metrica ok"><div class="valor">${indicadores.tasaAlarmasFalsas}%</div><div class="etiqueta">Tasa de falsas</div></div>
  `;

  const incidentes = (await FireDB.getAll(FireDB.STORES.INCIDENTES)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  const clientesMap = {};
  clientes.forEach(c => clientesMap[c.id] = c);

  const cont = document.getElementById('lista-incidentes');
  if (incidentes.length === 0) {
    cont.innerHTML = `<div class="estado-vacio"><i class="ti ti-alert-octagon" aria-hidden="true"></i><p>No hay incidentes registrados todavía</p></div>`;
    return;
  }

  cont.innerHTML = incidentes.map(inc => {
    const tipoInfo = Incidentes.obtenerTipo(inc.tipoIncidente);
    const nombreCliente = inc.clienteId ? (clientesMap[inc.clienteId]?.nombre || 'Cliente eliminado') : inc.nombreClienteLibre;
    return `
      <div class="card">
        <div style="display:flex;align-items:flex-start;gap:11px;">
          <div class="icono-circulo" style="background:${inc.esAlarmaFalsa ? 'var(--amber-light)' : 'var(--rojo-claro)'};flex-shrink:0;">
            <i class="ti ti-${tipoInfo.icono}" style="color:${inc.esAlarmaFalsa ? 'var(--amber)' : 'var(--rojo)'};font-size:18px;" aria-hidden="true"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <p style="font-size:13.5px;font-weight:600;color:var(--gris-900);">${tipoInfo.label}</p>
            <span style="font-size:11.5px;color:var(--gris-500);">${nombreCliente} · ${formatearFecha(inc.fecha)}${inc.hora ? ' · ' + inc.hora + 'hs' : ''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            ${inc.esAlarmaFalsa ? '<span class="badge badge-warn">Falsa alarma</span>' : ''}
            <button onclick="UI.eliminarIncidente('${inc.id}')"
              style="background:none;border:none;cursor:pointer;padding:4px;color:var(--gris-400);line-height:1;"
              title="Eliminar incidente" aria-label="Eliminar incidente">
              <i class="ti ti-trash" style="font-size:16px;" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        ${inc.descripcion ? `<p style="font-size:12.5px;color:var(--gris-700);margin-top:10px;line-height:1.4;">${inc.descripcion}</p>` : ''}
        ${inc.accionesTomadas ? `<p style="font-size:11.5px;color:var(--gris-500);margin-top:6px;"><i class="ti ti-checks" aria-hidden="true"></i> ${inc.accionesTomadas}</p>` : ''}
      </div>`;
  }).join('');
}

/* ── Helper modal de confirmación reutilizable ── */
function modalConfirmar(titulo, mensaje) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;max-width:340px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.18);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <div style="background:#FEF2F2;border-radius:50%;padding:8px;"><i class="ti ti-trash" style="color:#DC2626;font-size:20px;"></i></div>
          <strong style="font-size:15px;">${titulo}</strong>
        </div>
        <p style="font-size:13px;color:var(--gris-600);line-height:1.5;margin-bottom:20px;">${mensaje}<br><strong>¿Querés continuar?</strong></p>
        <div style="display:flex;gap:10px;">
          <button id="_mc_cancel" class="btn btn-secundario" style="flex:1;">Cancelar</button>
          <button id="_mc_confirm" class="btn" style="flex:1;background:var(--rojo);color:white;">Eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#_mc_cancel').onclick  = () => { modal.remove(); resolve(false); };
    modal.querySelector('#_mc_confirm').onclick = () => { modal.remove(); resolve(true);  };
  });
}

async function eliminarIncidente(incidenteId) {
  const ok = await modalConfirmar('Eliminar incidente', 'Este incidente y sus datos no podrán recuperarse.');
  if (!ok) return;
  try {
    await FireSync.delete(FireDB.STORES.INCIDENTES, incidenteId);
    mostrarToast('Incidente eliminado', 'exito');
    renderizarIncidentes();
    renderizarDashboard();
  } catch(e) { mostrarToast('Error al eliminar', 'error'); }
}

async function eliminarHallazgo(hallazgoId) {
  const ok = await modalConfirmar('Eliminar hallazgo', 'Este hallazgo y su plan de acción asociado no podrán recuperarse.');
  if (!ok) return;
  try {
    await FireSync.delete(FireDB.STORES.HALLAZGOS_AUDITORIA, hallazgoId);
    mostrarToast('Hallazgo eliminado', 'exito');
    renderizarHallazgos();
    renderizarDashboard();
  } catch(e) { mostrarToast('Error al eliminar', 'error'); }
}

function abrirModalIncidente() {
  document.getElementById('incidente-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('incidente-hora').value = new Date().toTimeString().slice(0, 5);
  document.getElementById('incidente-tipo').innerHTML = Incidentes.TIPOS.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
  document.getElementById('incidente-descripcion').value = '';
  document.getElementById('incidente-danos').value = '';
  document.getElementById('incidente-acciones').value = '';
  document.getElementById('incidente-responsable').value = Estado.config.inspector || '';
  document.getElementById('incidente-alarma-falsa').checked = false;
  document.getElementById('incidente-cliente-libre').value = '';
  document.getElementById('incidente-cliente-libre-wrap').style.display = 'block'; // visible por defecto: el select arranca vacío ("sin sistema cargado")

  FireDB.getAll(FireDB.STORES.CLIENTES).then(clientes => {
    const opciones = clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    document.getElementById('incidente-cliente').innerHTML =
      '<option value="">Cliente sin sistema cargado (ingresar nombre)</option>' + opciones;
  });

  abrirModal('modal-incidente');
}

function toggleClienteLibreIncidente() {
  const valor = document.getElementById('incidente-cliente').value;
  document.getElementById('incidente-cliente-libre-wrap').style.display = valor ? 'none' : 'block';
}

async function guardarIncidente() {
  const clienteId = document.getElementById('incidente-cliente').value;
  const nombreClienteLibre = document.getElementById('incidente-cliente-libre').value.trim();

  if (!clienteId && !nombreClienteLibre) {
    mostrarToast('Indicá el cliente o el nombre del lugar del incidente', 'error');
    return;
  }

  await Incidentes.crear({
    clienteId: clienteId || null,
    nombreClienteLibre,
    fecha: document.getElementById('incidente-fecha').value,
    hora: document.getElementById('incidente-hora').value,
    tipoIncidente: document.getElementById('incidente-tipo').value,
    tipoSistema: document.getElementById('incidente-sistema').value || null,
    esAlarmaFalsa: document.getElementById('incidente-alarma-falsa').checked,
    descripcion: document.getElementById('incidente-descripcion').value.trim(),
    danosReportados: document.getElementById('incidente-danos').value.trim(),
    accionesTomadas: document.getElementById('incidente-acciones').value.trim(),
    responsableReporte: document.getElementById('incidente-responsable').value.trim()
  });

  cerrarModal('modal-incidente');
  mostrarToast('Incidente registrado', 'exito');
  renderizarIncidentes();
}

/* ============================================================
   RECOMENDACIÓN 5: Hallazgos de auditoría
   ============================================================ */

async function renderizarHallazgos() {
  const indicadores = await HallazgosAuditoria.calcularIndicadores();
  document.getElementById('auditoria-metricas').innerHTML = `
    <div class="metrica neutro"><div class="valor">${indicadores.total}</div><div class="etiqueta">Total hallazgos</div></div>
    <div class="metrica warn"><div class="valor">${indicadores.abiertos}</div><div class="etiqueta">Abiertos</div></div>
    <div class="metrica danger"><div class="valor">${indicadores.porSeveridad.critica}</div><div class="etiqueta">Críticos</div></div>
  `;

  const hallazgos = (await FireDB.getAll(FireDB.STORES.HALLAZGOS_AUDITORIA)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  const clientesMap = {};
  clientes.forEach(c => clientesMap[c.id] = c);

  const cont = document.getElementById('lista-hallazgos');
  if (hallazgos.length === 0) {
    cont.innerHTML = `<div class="estado-vacio"><i class="ti ti-shield-exclamation" aria-hidden="true"></i><p>No hay hallazgos de auditoría registrados</p></div>`;
    return;
  }

  cont.innerHTML = hallazgos.map(h => {
    const categoriaInfo = HallazgosAuditoria.CATEGORIAS.find(c => c.id === h.categoria);
    const sevInfo = HallazgosAuditoria.SEVERIDADES[h.severidad];
    const cerrado = h.estado === 'cerrado';
    return `
      <div class="card plan-card ${h.severidad === 'critica' || h.severidad === 'alta' ? 'criticidad-alta' : 'criticidad-media'} ${cerrado ? 'estado-cerrado' : ''}">
        <div class="plan-header">
          <span class="ref">${clientesMap[h.clienteId]?.nombre || 'Cliente eliminado'}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="badge" style="background:${sevInfo.color}18;color:${sevInfo.color};">${sevInfo.label}</span>
            <button onclick="UI.eliminarHallazgo('${h.id}')"
              style="background:none;border:none;cursor:pointer;padding:4px;color:var(--gris-400);line-height:1;"
              title="Eliminar hallazgo" aria-label="Eliminar hallazgo">
              <i class="ti ti-trash" style="font-size:16px;" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div class="plan-desc">
          <strong>${categoriaInfo ? categoriaInfo.label : ''}</strong>${h.ubicacion ? ' · ' + h.ubicacion : ''}<br>
          ${h.descripcion}
        </div>
        <div class="plan-meta">
          <span>${formatearFecha(h.fecha)}${h.contextoAuditoria ? ' · ' + h.contextoAuditoria : ''}</span>
          <span>${cerrado ? 'Resuelto' : 'Vence: ' + formatearFecha(h.fechaLimite)}</span>
        </div>
      </div>`;
  }).join('');
}

function abrirModalHallazgo() {
  document.getElementById('hallazgo-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('hallazgo-categoria').innerHTML = HallazgosAuditoria.CATEGORIAS.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  document.getElementById('hallazgo-ubicacion').value = '';
  document.getElementById('hallazgo-descripcion').value = '';
  document.getElementById('hallazgo-contexto').value = '';
  document.getElementById('hallazgo-detectado-por').value = Estado.config.inspector || '';

  FireDB.getAll(FireDB.STORES.CLIENTES).then(clientes => {
    document.getElementById('hallazgo-cliente').innerHTML = clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('') || '<option value="">Agregá un cliente primero</option>';
  });

  abrirModal('modal-hallazgo');
}

async function guardarHallazgo() {
  const clienteId = document.getElementById('hallazgo-cliente').value;
  if (!clienteId) { mostrarToast('Seleccioná un cliente', 'error'); return; }

  await HallazgosAuditoria.crear({
    clienteId,
    fecha: document.getElementById('hallazgo-fecha').value,
    categoria: document.getElementById('hallazgo-categoria').value,
    severidad: document.getElementById('hallazgo-severidad').value,
    ubicacion: document.getElementById('hallazgo-ubicacion').value.trim(),
    descripcion: document.getElementById('hallazgo-descripcion').value.trim(),
    contextoAuditoria: document.getElementById('hallazgo-contexto').value.trim(),
    detectadoPor: document.getElementById('hallazgo-detectado-por').value.trim()
  });

  cerrarModal('modal-hallazgo');
  mostrarToast('Hallazgo registrado y plan de acción generado', 'exito');
  renderizarHallazgos();
  renderizarDashboard();
}

/* ============================================================
   RECOMENDACIÓN 3: Envío de reporte por email
   ============================================================ */

/* Abre el modal de envío: genera el PDF, lo prepara para compartir
   (Web Share API si el dispositivo lo soporta, que es lo más cómodo en
   celular porque deja elegir Gmail/WhatsApp/Mail con el archivo ya
   adjunto) y como respaldo siempre ofrece un mailto con instrucciones,
   ya que no hay servidor propio de envío de correo en esta app */
async function abrirModalEnviarEmail() {
  const clienteId = document.getElementById('rep-cliente').value;
  if (!clienteId) { mostrarToast('Seleccioná un cliente primero', 'error'); return; }

  const cliente = await FireDB.get(FireDB.STORES.CLIENTES, clienteId);
  const cont = document.getElementById('enviar-email-contenido');

  if (!cliente.email) {
    cont.innerHTML = `
      <p style="font-size:13px;color:var(--gris-900);margin-bottom:14px;line-height:1.5;">
        <strong>${cliente.nombre}</strong> no tiene un email de contacto guardado.
      </p>
      <button class="btn btn-primary btn-block" onclick="UI.cerrarModal('modal-enviar-email'); UI.abrirModalCliente('${clienteId}')">
        <i class="ti ti-edit" aria-hidden="true"></i> Agregar email al cliente
      </button>`;
    abrirModal('modal-enviar-email');
    return;
  }

  cont.innerHTML = `<p style="font-size:13px;color:var(--gris-500);text-align:center;padding:20px 0;">Generando el reporte PDF...</p>`;
  abrirModal('modal-enviar-email');

  const inspecciones = (await FireDB.getByIndex(FireDB.STORES.INSPECCIONES, 'clienteId', clienteId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (inspecciones.length === 0) {
    cont.innerHTML = `<p style="font-size:13px;color:var(--gris-700);">Este cliente todavía no tiene inspecciones registradas para enviar.</p>`;
    return;
  }

  const doc = await ReportesPDF.generarConsolidado(clienteId, inspecciones, {
    incluirLogo: true, incluirFirma: true, periodoLabel: 'Todo el historial',
    empresaInspectora: Estado.config.empresa, inspector: Estado.config.inspector,
    firmaDataUrl: inspecciones[0]?.firmaDataUrl
  });

  const nombreArchivo = `Reporte_${cliente.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  const blobPdf = doc.output('blob');
  const asunto = `Reporte de inspección NFPA 25 — ${cliente.nombre}`;
  const cuerpo = `Hola ${cliente.contacto || ''},\n\nAdjunto el reporte de inspección de sistemas de protección contra incendios correspondiente a ${cliente.nombre}.\n\nSaludos,\n${Estado.config.inspector || Estado.config.empresa || ''}`;

  const puedeCompartirArchivo = navigator.canShare && navigator.canShare({ files: [new File([blobPdf], nombreArchivo, { type: 'application/pdf' })] });

  let botonesHtml = '';
  if (puedeCompartirArchivo) {
    botonesHtml += `<button class="btn btn-primary btn-block" id="btn-compartir-pdf" style="margin-bottom:10px;"><i class="ti ti-share" aria-hidden="true"></i> Compartir PDF (Gmail, WhatsApp, etc.)</button>`;
  }

  const mailtoUrl = `mailto:${encodeURIComponent(cliente.email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo + '\n\n(Recordá adjuntar el PDF que se descargó)')}`;

  cont.innerHTML = `
    <p style="font-size:13px;color:var(--gris-900);margin-bottom:14px;">
      Reporte listo para <strong>${cliente.nombre}</strong><br>
      <span style="color:var(--gris-500);font-size:12px;">${cliente.email}</span>
    </p>
    ${botonesHtml}
    <button class="btn btn-secundario btn-block" style="margin-bottom:10px;" onclick="UI.descargarYAbrirMail('${clienteId}', '${mailtoUrl.replace(/'/g, "\\'")}')">
      <i class="ti ti-download" aria-hidden="true"></i> Descargar PDF y abrir email
    </button>
    <p style="font-size:11px;color:var(--gris-500);line-height:1.4;">
      ${puedeCompartirArchivo ? 'La opción de compartir adjunta el PDF directamente.' : 'Esta app no tiene servidor de correo propio: se descarga el PDF y se abre tu app de mail para que lo adjuntes manualmente.'}
    </p>
  `;

  if (puedeCompartirArchivo) {
    document.getElementById('btn-compartir-pdf').addEventListener('click', async () => {
      try {
        await navigator.share({
          files: [new File([blobPdf], nombreArchivo, { type: 'application/pdf' })],
          title: asunto,
          text: cuerpo
        });
        cerrarModal('modal-enviar-email');
      } catch (err) {
        // el usuario canceló el share sheet, no es un error real
      }
    });
  }

  Estado.pdfPendienteEnvio = { blob: blobPdf, nombreArchivo };
}

/* Camino de respaldo para navegadores sin Web Share API: descarga el
   PDF y abre el cliente de correo con el destinatario y asunto ya
   completos, para que el usuario solo tenga que adjuntar el archivo */
function descargarYAbrirMail(clienteId, mailtoUrl) {
  if (Estado.pdfPendienteEnvio) {
    const url = URL.createObjectURL(Estado.pdfPendienteEnvio.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = Estado.pdfPendienteEnvio.nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  window.location.href = mailtoUrl;
  cerrarModal('modal-enviar-email');
  mostrarToast('PDF descargado, completá el envío en tu app de mail', 'exito');
}

window.UI = window.UI || {};
Object.assign(window.UI, {
  cambiarSubTabSeguimiento,
  iniciarEliminacionCliente, descargarArchivoCliente, confirmarEliminacionSinArchivo,
  abrirModalIncidente, toggleClienteLibreIncidente, guardarIncidente, eliminarIncidente,
  abrirModalHallazgo, guardarHallazgo, eliminarHallazgo,
  abrirModalEnviarEmail, descargarYAbrirMail
});

// Sobrescribe UI.irA para soportar el segundo parámetro opcional de sub-pestaña
const _irAOriginal = irA;
window.UI.irA = function (pantalla, subtab) {
  if (subtab) { irAConSubTab(pantalla, subtab); }
  else { _irAOriginal(pantalla); }
};
