/* ============================================================
   FireInspect Pro — UI parte 2
   Formulario de inspección NFPA 25, carga de fotos, firma digital
   ============================================================ */

/* ---------------- Pantalla de inspección ---------------- */

function renderizarPantallaInspeccion() {
  const tabsHtml = Object.keys(NFPA25.MODELO).map(tipo => {
    const modelo = NFPA25.MODELO[tipo];
    const activo = tipo === Estado.sistemaInspeccionActual ? 'activo' : '';
    return `<button class="tab-btn ${activo}" onclick="UI.cambiarSistemaInspeccion('${tipo}', this)"><i class="ti ti-${modelo.icono}" aria-hidden="true"></i>${modelo.nombre}</button>`;
  }).join('');
  document.getElementById('tabs-sistemas').innerHTML = tabsHtml;

  renderizarFormularioSistema(Estado.sistemaInspeccionActual);
}

function cambiarFrecuenciaVisita(frecuencia) {
  Estado.frecuenciaVisita = frecuencia;
  Estado.respuestasChecklistTemp = {};
  renderizarFormularioSistema(Estado.sistemaInspeccionActual);
}

function cambiarSistemaInspeccion(tipo, btn) {
  Estado.sistemaInspeccionActual = tipo;
  Estado.fotosInspeccionTemp = [];
  // Pre-cargar la firma predeterminada de configuración si aún no hay firma en sesión
  if (!Estado.firmaTemp) Estado.firmaTemp = Estado.config?.firmaPredeterminada || null;
  document.querySelectorAll('#tabs-sistemas .tab-btn').forEach(b => b.classList.remove('activo'));
  btn.classList.add('activo');
  renderizarFormularioSistema(tipo);
}

async function renderizarFormularioSistema(tipo) {
  const modelo = NFPA25.MODELO[tipo];
  const clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  const config = Estado.config;

  const opcionesClientes = clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('') || '<option value="">Agregá un cliente primero</option>';

  const camposExtraHtml = modelo.campos.map(campo => {
    if (campo.tipo === 'select') {
      const opts = campo.opciones.map(o => `<option>${o}</option>`).join('');
      return `<div class="campo"><label>${campo.label}</label><select id="campo-${campo.id}">${opts}</select></div>`;
    }

    // Campos con conversión automática: presión (PSI→bar), caudal (GPM→L/min),
    // volumen (gal→L), temperatura (°F→°C), longitud (ft→m)
    if (campo.unidad) {
      const conversiones = {
        presion:     { hint: 'bar'   },
        caudal:      { hint: 'L/min' },
        volumen:     { hint: 'L'     },
        volumen_m3:  { hint: 'gal'   },
        temperatura: { hint: '°C'   },
        longitud:    { hint: 'm'     },
      };
      const info = conversiones[campo.unidad] || null;
      return `
        <div class="campo">
          <label>${campo.label}${campo.opcional ? ' · opcional' : ''}</label>
          <input type="text" id="campo-${campo.id}" inputmode="decimal"
                 data-unidad-tipo="${campo.unidad}"
                 oninput="UI.actualizarConversionUnidad(this)">
          ${info ? `<span class="conversion-hint" id="conversion-${campo.id}" style="font-size:11.5px;color:var(--gris-500);margin-top:4px;display:block;"></span>` : ''}
        </div>`;
    }

    return `<div class="campo"><label>${campo.label}${campo.opcional ? ' · opcional' : ''}</label><input type="${campo.tipo === 'numero' ? 'text' : campo.tipo}" id="campo-${campo.id}" inputmode="${campo.tipo === 'numero' ? 'decimal' : 'text'}"></div>`;
  }).join('');

  /* ─── Frecuencia de la visita (acumulativa) ───
     Una visita trimestral incluye los ítems semanales y mensuales,
     como se ejecuta en la práctica real de campo. */
  if (!Estado.frecuenciaVisita) Estado.frecuenciaVisita = 'anual';
  const nivelSel = NFPA25.nivelFrecuencia(Estado.frecuenciaVisita);

  const selectorFrecuenciaHtml = `
    <div class="card">
      <div class="card-titulo"><i class="ti ti-calendar-repeat" aria-hidden="true"></i>Frecuencia de la visita
        <span class="ref-norma">Incluye frecuencias menores acumuladas</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;">
        ${NFPA25.FRECUENCIAS.map(f => `
          <button onclick="UI.cambiarFrecuenciaVisita('${f.id}')"
            style="padding:8px 14px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;
                   border:1.5px solid ${f.id === Estado.frecuenciaVisita ? 'var(--rojo)' : 'var(--gris-300)'};
                   background:${f.id === Estado.frecuenciaVisita ? 'var(--rojo)' : 'white'};
                   color:${f.id === Estado.frecuenciaVisita ? 'white' : 'var(--gris-700)'};">
            ${f.label}
          </button>`).join('')}
      </div>
    </div>`;

  /* ─── Checklist filtrado por frecuencia y agrupado ─── */
  const itemsVisibles = modelo.checklist.filter(i => NFPA25.nivelFrecuencia(i.periodicidad) <= nivelSel);
  Estado.checklistVisibleIds = itemsVisibles.map(i => i.id);

  const badgeCategoria = cat => {
    const c = NFPA25.CATEGORIAS[cat] || NFPA25.CATEGORIAS.I;
    return `<span style="display:inline-block;font-size:9.5px;font-weight:700;color:white;background:${c.color};border-radius:4px;padding:1.5px 6px;margin-right:6px;vertical-align:middle;" title="${c.label}">${cat}</span>`;
  };

  let checklistHtml = '';
  NFPA25.FRECUENCIAS.forEach(f => {
    const grupo = itemsVisibles.filter(i => NFPA25.nivelFrecuencia(i.periodicidad) === f.nivel);
    if (grupo.length === 0) return;
    checklistHtml += `
      <div style="display:flex;align-items:center;gap:8px;margin:14px 0 6px;">
        <span style="font-size:11.5px;font-weight:700;letter-spacing:0.6px;color:var(--gris-500);text-transform:uppercase;">${f.label}</span>
        <span style="flex:1;height:1px;background:var(--gris-200);"></span>
        <span style="font-size:11px;color:var(--gris-400);">${grupo.length} ítem${grupo.length > 1 ? 's' : ''}</span>
      </div>`;
    checklistHtml += grupo.map(item => `
      <div class="check-item">
        <div class="check-texto">
          <span class="ref">${badgeCategoria(item.categoria || 'I')}${item.ref}</span>
          <span class="texto">${item.texto}</span>
          <span class="periodicidad"><i class="ti ti-clock" aria-hidden="true"></i> ${item.periodicidadTexto || item.periodicidad}${item.criticidad === 'alta' ? ' · <span style="color:var(--rojo);font-weight:600;">Crítico</span>' : ''}</span>
        </div>
        <div class="check-opciones">
          <button class="check-btn" data-item="${item.id}" data-val="ok" onclick="UI.marcarCheck('${item.id}','ok',this)" title="Conforme">OK</button>
          <button class="check-btn" data-item="${item.id}" data-val="no" onclick="UI.marcarCheck('${item.id}','no',this)" title="No conforme">NC</button>
          <button class="check-btn" data-item="${item.id}" data-val="na" onclick="UI.marcarCheck('${item.id}','na',this)" title="No aplica">NA</button>
        </div>
      </div>`).join('');
  });

  const html = `
    <div class="card">
      <div class="card-titulo"><i class="ti ti-building" aria-hidden="true"></i>Datos generales</div>
      <div class="campo"><label>Cliente *</label><select id="insp-cliente" onchange="UI.cargarEquiposInspeccion()">${opcionesClientes}</select></div>
      <div class="campo"><label>Equipo inspeccionado</label>
        <select id="insp-equipo" onchange="UI.precargarEquipoInspeccion(this.value)">
          <option value="">— Carga manual (sin equipo registrado) —</option>
        </select>
        <p style="font-size:11.5px;color:var(--gris-500);margin-top:4px;">Al elegir un equipo registrado, sus datos se precargan automáticamente.</p>
      </div>
      <div class="campo-fila">
        <div class="campo"><label>Fecha de inspección</label><input type="date" id="insp-fecha" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="campo"><label>Inspector</label><input type="text" id="insp-inspector" value="${config.inspector || ''}"></div>
      </div>
      <div class="campo"><label>Identificación del sistema (opcional)</label><input type="text" id="insp-nombre-sistema" placeholder="Ej: Riser principal - Ala Este"></div>
    </div>

    ${selectorFrecuenciaHtml}

    ${tipo === 'bomba' && nivelSel >= 5 ? `
    <div class="card" style="border:2px solid #1A5276;background:linear-gradient(135deg,#F0F6FC 0%,#FFFFFF 100%);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="background:#1A5276;color:white;font-size:11px;font-weight:700;border-radius:12px;padding:3px 10px;">1º · ENSAYO ANUAL</span>
      </div>
      <div style="background:linear-gradient(135deg,#1A5276 0%,#2471A3 100%);border-radius:var(--border-radius-md);padding:14px;display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="UI.abrirCurvaDesempeno()">
        <div style="background:rgba(255,255,255,0.15);border-radius:8px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="ti ti-chart-line" style="color:white;font-size:20px;" aria-hidden="true"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <p style="font-size:13.5px;font-weight:600;color:white;margin-bottom:2px;">Curva de Desempeño — Prueba de Flujo Anual</p>
          <p style="font-size:11.5px;color:rgba(255,255,255,0.80);">NFPA 25 §8.3.3 · 0% / 100% / 150% Qn · Informe y registro propios</p>
        </div>
        <i class="ti ti-chevron-right" style="color:rgba(255,255,255,0.7);font-size:18px;" aria-hidden="true"></i>
      </div>
      <p style="font-size:11.5px;color:var(--gris-500);margin-top:8px;line-height:1.5;">
        Se ejecuta y se guarda por separado del checklist. Al finalizar, volvé acá para completar el checklist de la visita anual.
      </p>
    </div>` : ''}

    <div class="card">
      <div class="card-titulo"><i class="ti ti-${modelo.icono}" aria-hidden="true"></i>${modelo.nombre}<span class="ref-norma">${modelo.capitulo}</span></div>
      ${camposExtraHtml}
    </div>

    <div class="card">
      <div class="card-titulo"><i class="ti ti-clipboard-check" aria-hidden="true"></i>
        ${tipo === 'bomba' && nivelSel >= 5 ? '<span style="background:var(--gris-700);color:white;font-size:10.5px;font-weight:700;border-radius:10px;padding:2px 8px;margin-right:6px;">2º</span>' : ''}Checklist de la visita ${NFPA25.etiquetaFrecuencia(Estado.frecuenciaVisita)}
        <span class="ref-norma" id="insp-progreso-check">0/${itemsVisibles.length}</span>
      </div>
      ${checklistHtml}
    </div>

    <div class="card">
      <div class="card-titulo"><i class="ti ti-camera" aria-hidden="true"></i>Fotos de defectos<span class="ref-norma" id="insp-contador-fotos">0 fotos</span></div>
      <div class="upload-zone" onclick="UI.abrirModalFoto()">
        <i class="ti ti-camera-plus" aria-hidden="true"></i>
        <span>Tocar para agregar foto de un defecto</span>
      </div>
      <div class="foto-grid" id="insp-foto-grid"></div>
    </div>

    <div class="card">
      <div class="card-titulo"><i class="ti ti-notes" aria-hidden="true"></i>Observaciones</div>
      <textarea id="insp-observaciones" placeholder="Detallar observaciones generales, no conformidades o recomendaciones..."></textarea>
    </div>

    <div class="card">
      <div class="card-titulo"><i class="ti ti-signature" aria-hidden="true"></i>Firma del inspector</div>
      <div id="insp-firma-preview">
        ${Estado.firmaTemp
          ? `<div style="border:1px solid var(--gris-200);border-radius:var(--radio-md);padding:10px;text-align:center;">
               <p style="font-size:11px;color:var(--gris-500);margin-bottom:6px;">Firma cargada (predeterminada)</p>
               <img src="${Estado.firmaTemp}" style="max-height:70px;">
               <div style="margin-top:8px;display:flex;gap:8px;justify-content:center;">
                 <button class="btn btn-secundario btn-sm" onclick="UI.abrirModalFirma()"><i class="ti ti-edit" aria-hidden="true"></i> Cambiar</button>
                 <button class="btn btn-secundario btn-sm" onclick="UI.quitarFirmaInsp()"><i class="ti ti-x" aria-hidden="true"></i> Quitar</button>
               </div>
             </div>`
          : `<div style="display:flex;flex-direction:column;gap:8px;">
               <button class="btn btn-secundario btn-block" onclick="UI.abrirModalFirma()"><i class="ti ti-pencil" aria-hidden="true"></i> Dibujar firma ahora</button>
               ${Estado.config?.firmaPredeterminada ? `<button class="btn btn-secundario btn-block" onclick="UI.usarFirmaPredeterminada()"><i class="ti ti-signature" aria-hidden="true"></i> Usar firma predeterminada</button>` : ''}
             </div>`
        }
      </div>
    </div>

    <button class="btn btn-primary btn-block" style="margin-bottom:20px;" onclick="UI.guardarInspeccion()">
      <i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar inspección
    </button>
  `;

  document.getElementById('form-inspeccion-contenido').innerHTML = html;
  Estado.respuestasChecklistTemp = {};
  Estado.equipoInspeccionActual = null;
  // Si la inspección se inició desde el hub de un cliente, viene preseleccionado
  if (Estado.clientePreseleccionado) {
    const selCliente = document.getElementById('insp-cliente');
    if (selCliente) selCliente.value = Estado.clientePreseleccionado;
    Estado.clientePreseleccionado = null;
  }
  cargarEquiposInspeccion();
}

/* ═══ Equipos del cliente: poblar selector y precargar datos ═══ */

async function cargarEquiposInspeccion() {
  const sel = document.getElementById('insp-equipo');
  const clienteId = document.getElementById('insp-cliente')?.value;
  if (!sel) return;
  Estado.equipoInspeccionActual = null;
  if (!clienteId) { sel.innerHTML = '<option value="">— Carga manual —</option>'; return; }

  const equipos = await Equipos.listarPorCliente(clienteId, Estado.sistemaInspeccionActual);
  sel.innerHTML = '<option value="">— Carga manual (sin equipo registrado) —</option>' +
    equipos.map(e => `<option value="${e.id}">${e.tag}${Equipos.resumenDe(e) ? ' · ' + Equipos.resumenDe(e) : ''}</option>`).join('');
}

async function precargarEquipoInspeccion(equipoId) {
  if (!equipoId) { Estado.equipoInspeccionActual = null; return; }
  const eq = await Equipos.obtener(equipoId);
  if (!eq) return;
  Estado.equipoInspeccionActual = eq;

  // Identificación del sistema = TAG del equipo
  const nombreEl = document.getElementById('insp-nombre-sistema');
  if (nombreEl && !nombreEl.value) nombreEl.value = eq.tag;

  // Precarga cada campo del formulario cuyo id coincida con los datos del equipo
  const datos = eq.datos || {};
  const modelo = NFPA25.MODELO[Estado.sistemaInspeccionActual];
  let precargados = 0;
  (modelo?.campos || []).forEach(campo => {
    let valor = datos[campo.id];
    // Para bombas: mapear campos de placa a los operativos si faltan
    if (valor === undefined && Estado.sistemaInspeccionActual === 'bomba') {
      if (campo.id === 'caudalNominal' && datos.qn) valor = datos.qn;
      if (campo.id === 'tipoBomba' && datos.tipoAccion) {
        valor = datos.tipoAccion === 'diesel' ? 'Diesel' : 'Eléctrica principal';
      }
    }
    if (valor === undefined) return;
    const el = document.getElementById('campo-' + campo.id);
    if (!el) return;
    el.value = valor;
    precargados++;
    if (el.dataset?.unidadTipo) actualizarConversionUnidad(el);
  });

  if (precargados > 0) mostrarToast(`${precargados} dato${precargados > 1 ? 's' : ''} precargado${precargados > 1 ? 's' : ''} desde "${eq.tag}"`, 'exito');
}

/* Actualiza el hint de conversión debajo del campo en tiempo real */
function actualizarConversionUnidad(input) {
  const tipo  = input.dataset.unidadTipo;
  const campoId = input.id.replace('campo-', '');
  const hint  = document.getElementById('conversion-' + campoId);
  if (hint) hint.textContent = Unidades.textoConversion(input.value, tipo);
}

/* Marca un ítem del checklist como OK / NC / NA, resaltando el botón elegido */
function marcarCheck(itemId, valor, btnClickeado) {
  if (!Estado.respuestasChecklistTemp) Estado.respuestasChecklistTemp = {};
  Estado.respuestasChecklistTemp[itemId] = valor;

  const grupo = btnClickeado.parentElement.querySelectorAll('.check-btn');
  grupo.forEach(b => b.classList.remove('sel-ok', 'sel-nc', 'sel-na'));
  btnClickeado.classList.add(valor === 'ok' ? 'sel-ok' : (valor === 'no' ? 'sel-nc' : 'sel-na'));

  const visibles = Estado.checklistVisibleIds || [];
  const respondidos = Object.keys(Estado.respuestasChecklistTemp).filter(id => visibles.includes(id)).length;
  document.getElementById('insp-progreso-check').textContent = `${respondidos}/${visibles.length}`;
}

/* ---------------- Carga de fotos durante la inspección ---------------- */

function abrirModalFoto() {
  Estado.fotoTempActual = null;
  document.getElementById('foto-preview-actual').innerHTML = '';
  document.getElementById('foto-descripcion').value = '';
  document.getElementById('btn-confirmar-foto').setAttribute('disabled', 'true');
  abrirModal('modal-foto');
}

document.addEventListener('DOMContentLoaded', () => {
  const inputFoto = document.getElementById('foto-input-camara');
  if (inputFoto) {
    inputFoto.addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;
      mostrarToast('Procesando foto...');
      const procesada = await FotosManager.procesar(archivo);
      Estado.fotoTempActual = procesada.dataUrl;
      document.getElementById('foto-preview-actual').innerHTML = `<img src="${procesada.dataUrl}" style="width:100%;border-radius:var(--radio-md);max-height:220px;object-fit:cover;">`;
      document.getElementById('btn-confirmar-foto').removeAttribute('disabled');
      e.target.value = '';
    });
  }
});

function confirmarFoto() {
  if (!Estado.fotoTempActual) return;
  Estado.fotosInspeccionTemp.push({
    dataUrl: Estado.fotoTempActual,
    descripcion: document.getElementById('foto-descripcion').value.trim()
  });
  renderizarGridFotosTemp();
  cerrarModal('modal-foto');
  mostrarToast('Foto agregada', 'exito');
}

function renderizarGridFotosTemp() {
  const grid = document.getElementById('insp-foto-grid');
  document.getElementById('insp-contador-fotos').textContent = `${Estado.fotosInspeccionTemp.length} foto${Estado.fotosInspeccionTemp.length === 1 ? '' : 's'}`;
  grid.innerHTML = Estado.fotosInspeccionTemp.map((foto, idx) => `
    <div class="foto-item">
      <img src="${foto.dataUrl}" alt="${foto.descripcion || 'Foto de defecto'}">
      <button class="borrar-foto" onclick="UI.eliminarFotoTemp(${idx})" aria-label="Eliminar foto"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>`).join('');
}

function eliminarFotoTemp(idx) {
  Estado.fotosInspeccionTemp.splice(idx, 1);
  renderizarGridFotosTemp();
}

/* ---------------- Firma digital ---------------- */

function abrirModalFirma() {
  abrirModal('modal-firma');
  setTimeout(() => {
    const canvas = document.getElementById('firma-canvas');
    Estado.firmaInstancia = new FirmaDigital(canvas);
    document.getElementById('firma-placeholder').style.display = Estado.firmaTemp ? 'none' : 'flex';
    if (Estado.firmaTemp) {
      const img = new Image();
      img.onload = () => Estado.firmaInstancia.ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = Estado.firmaTemp;
    }
    canvas.addEventListener('pointerdown', () => { document.getElementById('firma-placeholder').style.display = 'none'; });
  }, 50);
}

function limpiarFirma() {
  if (Estado.firmaInstancia) Estado.firmaInstancia.limpiar();
  document.getElementById('firma-placeholder').style.display = 'flex';
}

function confirmarFirma() {
  if (!Estado.firmaInstancia || Estado.firmaInstancia.estaVacia()) {
    mostrarToast('Por favor firme antes de confirmar', 'error');
    return;
  }
  Estado.firmaTemp = Estado.firmaInstancia.exportarDataUrl();
  document.getElementById('insp-firma-preview').innerHTML = `
    <div style="border:1px solid var(--gris-200);border-radius:var(--radio-md);padding:10px;text-align:center;">
      <img src="${Estado.firmaTemp}" style="max-height:70px;">
      <div style="margin-top:8px;"><button class="btn btn-secundario btn-sm" onclick="UI.abrirModalFirma()"><i class="ti ti-edit" aria-hidden="true"></i> Volver a firmar</button></div>
    </div>`;
  cerrarModal('modal-firma');
  mostrarToast('Firma guardada', 'exito');
}

/* ---------------- Helpers de firma en inspección ---------------- */

function usarFirmaPredeterminada() {
  const firma = Estado.config?.firmaPredeterminada;
  if (!firma) { mostrarToast('No hay firma predeterminada configurada', 'error'); return; }
  Estado.firmaTemp = firma;
  document.getElementById('insp-firma-preview').innerHTML = `
    <div style="border:1px solid var(--gris-200);border-radius:var(--radio-md);padding:10px;text-align:center;">
      <p style="font-size:11px;color:var(--gris-500);margin-bottom:6px;">Firma predeterminada</p>
      <img src="${firma}" style="max-height:70px;">
      <div style="margin-top:8px;display:flex;gap:8px;justify-content:center;">
        <button class="btn btn-secundario btn-sm" onclick="UI.abrirModalFirma()"><i class="ti ti-edit" aria-hidden="true"></i> Cambiar</button>
        <button class="btn btn-secundario btn-sm" onclick="UI.quitarFirmaInsp()"><i class="ti ti-x" aria-hidden="true"></i> Quitar</button>
      </div>
    </div>`;
  mostrarToast('Firma predeterminada cargada', 'exito');
}

function quitarFirmaInsp() {
  Estado.firmaTemp = null;
  const tienePred = !!Estado.config?.firmaPredeterminada;
  document.getElementById('insp-firma-preview').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      <button class="btn btn-secundario btn-block" onclick="UI.abrirModalFirma()"><i class="ti ti-pencil" aria-hidden="true"></i> Dibujar firma ahora</button>
      ${tienePred ? `<button class="btn btn-secundario btn-block" onclick="UI.usarFirmaPredeterminada()"><i class="ti ti-signature" aria-hidden="true"></i> Usar firma predeterminada</button>` : ''}
    </div>`;
}

/* ---------------- Guardado de la inspección completa ---------------- */

async function guardarInspeccion() {
  const clienteId = document.getElementById('insp-cliente').value;
  if (!clienteId) { mostrarToast('Seleccioná un cliente', 'error'); return; }

  const tipo = Estado.sistemaInspeccionActual;
  const modelo = NFPA25.MODELO[tipo];
  const respuestas = Estado.respuestasChecklistTemp || {};

  if (Object.keys(respuestas).length === 0) {
    mostrarToast('Completá al menos un ítem del checklist', 'error');
    return;
  }

  const valoresExtra = {};
  modelo.campos.forEach(campo => {
    const el = document.getElementById('campo-' + campo.id);
    if (el) valoresExtra[campo.id] = el.value;
  });

  // El cumplimiento se calcula SOLO sobre los ítems de la frecuencia elegida
  const nivelSel = NFPA25.nivelFrecuencia(Estado.frecuenciaVisita || 'anual');
  const itemsVisita = modelo.checklist.filter(i => NFPA25.nivelFrecuencia(i.periodicidad) <= nivelSel);
  const cumplimiento = NFPA25.calcularCumplimiento(itemsVisita, respuestas);

  const inspeccion = {
    clienteId,
    tipoSistema: tipo,
    frecuencia: Estado.frecuenciaVisita || 'anual',
    equipoId:  Estado.equipoInspeccionActual?.id  || null,
    equipoTag: Estado.equipoInspeccionActual?.tag || null,
    nombreSistema: document.getElementById('insp-nombre-sistema').value.trim(),
    fecha: document.getElementById('insp-fecha').value,
    inspector: document.getElementById('insp-inspector').value.trim(),
    respuestas,
    valoresExtra,
    observaciones: document.getElementById('insp-observaciones').value.trim(),
    cumplimiento,
    firmaDataUrl: Estado.firmaTemp,
    fotos: Estado.fotosInspeccionTemp.slice()
  };

  const guardada = await FireSync.add(FireDB.STORES.INSPECCIONES, inspeccion);

  // guarda las fotos también en su propia tabla, asociadas a esta inspección
  for (const foto of Estado.fotosInspeccionTemp) {
    await FireSync.add(FireDB.STORES.FOTOS, { inspeccionId: guardada.id, dataUrl: foto.dataUrl, descripcion: foto.descripcion });
  }

  const planesGenerados = await PlanesAccion.generarDesdeInspeccion(guardada);

  // limpia el estado temporal para la próxima inspección
  Estado.fotosInspeccionTemp = [];
  Estado.firmaTemp = null;
  Estado.respuestasChecklistTemp = {};

  const estadoResultado = NFPA25.estadoPorCumplimiento(cumplimiento);
  mostrarToast(`Inspección guardada · ${cumplimiento}% ${estadoResultado.label}`, estadoResultado.nivel === 'danger' ? 'error' : 'exito');

  if (planesGenerados.length > 0) {
    setTimeout(() => mostrarToast(`Se generaron ${planesGenerados.length} plan(es) de acción automáticamente`), 2000);
  }

  renderizarFormularioSistema(tipo);
  renderizarDashboard();
}

window.UI = window.UI || {};
Object.assign(window.UI, {
  cambiarSistemaInspeccion, cambiarFrecuenciaVisita, cargarEquiposInspeccion, precargarEquipoInspeccion, marcarCheck, actualizarConversionUnidad,
  abrirModalFoto, confirmarFoto, eliminarFotoTemp,
  abrirModalFirma, limpiarFirma, confirmarFirma, usarFirmaPredeterminada, quitarFirmaInsp,
  guardarInspeccion, renderizarPantallaInspeccion,
  abrirCurvaDesempeno: () => {
    irA('curva-desempeno');
    UI.renderizarCurvaDesempeno();
  }
});
