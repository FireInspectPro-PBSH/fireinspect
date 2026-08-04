/* ============================================================
   FireInspect Pro — Inicialización de la aplicación
   ============================================================ */

async function inicializarApp() {
  await FireDB.openDB();
  const seCargoSemilla = await FireDB.cargarDatosSemillaSiVacio();

  const empresa  = await FireDB.configGet('empresa');
  const inspector = await FireDB.configGet('inspector');
  const firmaPred = await FireDB.configGet('firmaPredeterminada');
  const logoEmp   = await FireDB.configGet('logoEmpresa');
  const appUrl    = await FireDB.configGet('appUrl');
  Estado.config.empresa  = empresa  || '';
  Estado.config.inspector = inspector || '';
  Estado.config.firmaPredeterminada = firmaPred || null;
  Estado.config.logoEmpresa = logoEmp || null;
  Estado.config.appUrl = appUrl || '';
  const inputAppUrl = document.getElementById('config-app-url');
  if (inputAppUrl) inputAppUrl.value = Estado.config.appUrl;

  document.getElementById('empresa-nombre-top').textContent = empresa || 'Inspecciones NFPA 25';
  document.getElementById('config-empresa').value   = empresa  || '';
  document.getElementById('config-inspector').value = inspector || '';
  actualizarPreviewFirmaConfig();
  actualizarPreviewLogoConfig();

  await poblarSelectoresClientes();
  await PlanesAccion.actualizarVencimientos();
  renderizarDashboard();

  if (seCargoSemilla) {
    setTimeout(() => mostrarToast('Datos de ejemplo cargados para que pruebes la app'), 800);
  }

  registrarServiceWorker();
  configurarImportacion();

  /* ——— Control de acceso ———
     Si hay usuarios creados, se exige iniciar sesión.
     Si no hay ninguno, la app funciona en modo libre (admin implícito). */
  Estado.sesion = Auth.obtenerSesion();
  const requiereLogin = await Auth.hayUsuarios();
  if (requiereLogin && !Estado.sesion) {
    mostrarPantallaLogin();
  } else {
    aplicarPermisos();
  }
  renderizarListaUsuarios();
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN, SESIÓN Y PERMISOS
═══════════════════════════════════════════════════════════════ */

function mostrarPantallaLogin() {
  const pantalla = document.getElementById('pantalla-login');
  // Marca de la empresa en la pantalla de ingreso
  if (Estado.config.logoEmpresa) {
    const img = document.getElementById('login-logo');
    img.src = Estado.config.logoEmpresa;
    img.style.display = 'block';
    document.getElementById('login-icono').style.display = 'none';
  }
  if (Estado.config.empresa) {
    document.getElementById('login-titulo').textContent = Estado.config.empresa;
  }
  pantalla.style.display = 'flex';
  setTimeout(() => document.getElementById('login-usuario')?.focus(), 150);
}

async function intentarLogin() {
  const usuario = document.getElementById('login-usuario').value;
  const pin     = document.getElementById('login-pin').value;
  const errorEl = document.getElementById('login-error');
  const u = await Auth.validarLogin(usuario, pin);
  if (!u) {
    errorEl.style.display = 'block';
    document.getElementById('login-pin').value = '';
    return;
  }
  errorEl.style.display = 'none';
  Estado.sesion = Auth.guardarSesion(u);
  document.getElementById('pantalla-login').style.display = 'none';
  aplicarPermisos();
  renderizarListaUsuarios();
  mostrarToast(`Hola, ${u.nombre.split(' ')[0]}`, 'exito');
}

function cerrarSesionUI() {
  Auth.cerrarSesion();
  location.reload();
}

/* Aplica las restricciones de interfaz según el rol de la sesión activa */
function aplicarPermisos() {
  const btnLogout = document.getElementById('btn-cerrar-sesion');
  if (btnLogout) btnLogout.style.display = Estado.sesion ? 'inline-flex' : 'none';

  if (!Estado.sesion || Estado.sesion.rol === 'admin') return; // acceso total

  /* — Rol VISUALIZADOR: solo Reportes (ver + PDF) — */
  document.body.classList.add('rol-visualizador');

  // Oculta toda la navegación excepto Reportes
  document.querySelectorAll('[data-pantalla]').forEach(btn => {
    if (btn.dataset.pantalla !== 'reportes') btn.style.display = 'none';
  });

  // Oculta los botones flotantes de acción (nueva inspección, etc.)
  document.querySelectorAll('.fab, #fab-principal').forEach(el => el.style.display = 'none');

  // El engranaje de configuración pasa a ser "cerrar sesión"
  document.querySelectorAll('.icon-btn').forEach(btn => {
    btn.innerHTML = '<i class="ti ti-logout" aria-hidden="true"></i>';
    btn.onclick = cerrarSesionUI;
    btn.setAttribute('aria-label', 'Cerrar sesión');
  });

  // Muestra quién está conectado en el encabezado
  const sub = document.querySelector('.header-sub, #empresa-nombre-top');
  if (sub) sub.textContent = `${Estado.sesion.nombre} · Visualizador`;

  // Va directo a Reportes
  UI.irA('reportes');
}

/* ═══════════════════════════════════════════════════════════════
   GESTIÓN DE USUARIOS (sección en Configuración)
═══════════════════════════════════════════════════════════════ */

async function renderizarListaUsuarios() {
  const cont = document.getElementById('lista-usuarios');
  if (!cont) return;
  const usuarios = await Auth.listarUsuarios();
  if (usuarios.length === 0) {
    cont.innerHTML = `<p style="font-size:12.5px;color:var(--gris-500);padding:8px 0;">
      Sin usuarios creados — la app funciona sin login. Creá el primero para activar el control de acceso.</p>`;
    return;
  }
  const clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  const nombreCliente = id => clientes.find(c => c.id === id)?.nombre || null;

  cont.innerHTML = usuarios.map(u => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:var(--gris-50);border:1px solid var(--gris-200);border-radius:var(--border-radius-md);margin-bottom:6px;">
      <div style="width:34px;height:34px;border-radius:50%;background:${u.rol === 'admin' ? 'var(--rojo)' : 'var(--azul)'}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="ti ti-${u.rol === 'admin' ? 'shield-check' : 'eye'}" style="color:${u.rol === 'admin' ? 'var(--rojo)' : 'var(--azul)'};font-size:17px;" aria-hidden="true"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <p style="font-size:13px;font-weight:600;color:var(--gris-900);">${u.nombre} <span style="font-weight:400;color:var(--gris-500);">· ${u.usuario}</span></p>
        <p style="font-size:11.5px;color:var(--gris-500);">
          ${u.rol === 'admin' ? 'Administrador' : 'Visualizador'}${u.rol === 'visualizador' ? (u.clienteId ? ' — ' + (nombreCliente(u.clienteId) || 'cliente eliminado') : ' — todos los clientes') : ''}
        </p>
      </div>
      ${u.email ? `<button class="btn btn-sm btn-secundario" onclick="UI.reenviarInvitacion('${u.id}')" aria-label="Enviar invitación por email">
        <i class="ti ti-mail-forward" aria-hidden="true"></i>
      </button>` : ''}
      <button class="btn btn-sm btn-secundario" onclick="UI.eliminarUsuarioUI('${u.id}', '${u.nombre.replace(/'/g, '')}')" aria-label="Eliminar usuario">
        <i class="ti ti-trash" aria-hidden="true"></i>
      </button>
    </div>`).join('');
}

async function abrirModalUsuario() {
  // Puebla el selector de clientes para visualizadores
  const clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  const sel = document.getElementById('usuario-cliente');
  sel.innerHTML = `<option value="">Todos los clientes</option>` +
    clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  document.getElementById('usuario-nombre').value = '';
  document.getElementById('usuario-usuario').value = '';
  document.getElementById('usuario-pin').value = '';
  document.getElementById('usuario-rol').value = 'admin';
  document.getElementById('usuario-cliente-wrap').style.display = 'none';
  abrirModal('modal-usuario');
}

async function guardarUsuario() {
  try {
    const rol = document.getElementById('usuario-rol').value;
    const pin = document.getElementById('usuario-pin').value;
    const registro = await Auth.crearUsuario({
      nombre:  document.getElementById('usuario-nombre').value,
      usuario: document.getElementById('usuario-usuario').value,
      pin,
      rol,
      clienteId: rol === 'visualizador' ? document.getElementById('usuario-cliente').value || null : null,
      email:   document.getElementById('usuario-email').value,
    });
    cerrarModal('modal-usuario');
    await renderizarListaUsuarios();
    mostrarToast('Usuario creado', 'exito');
    if (!Estado.sesion) {
      mostrarToast('Control de acceso activado: la próxima vez se pedirá iniciar sesión');
    }
    // Si cargó email, ofrece enviar la invitación (con el PIN, que solo
    // existe en texto plano en este momento — después queda hasheado)
    if (registro.email) {
      abrirModalInvitacion(registro, pin);
    }
  } catch (e) {
    mostrarToast(e.message || 'No se pudo crear el usuario', 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   INVITACIÓN POR EMAIL
   Genera un correo pre-redactado (mailto) con link de acceso,
   credenciales e instrucciones. El admin solo toca "Enviar".
═══════════════════════════════════════════════════════════════ */

let _invitacionPendiente = null;

function construirInvitacion(u, pinPlano) {
  const empresa = Estado.config.empresa || 'FireInspect Pro';
  const url = Estado.config.appUrl || (window.location.origin + window.location.pathname);

  const asunto = `Acceso a tus inspecciones NFPA 25 — ${empresa}`;

  const lineas = [
    `Hola ${u.nombre.split(' ')[0]},`,
    ``,
    `Te damos acceso al portal de inspecciones de ${empresa}, donde vas a poder consultar tus inspecciones NFPA 25 y descargar los informes en PDF.`,
    ``,
    `Ingresá desde este enlace:`,
    url,
    ``,
    `Tus credenciales de acceso:`,
    `• Usuario: ${u.usuario}`,
    pinPlano ? `• PIN: ${pinPlano}` : `• PIN: el que te fue provisto oportunamente`,
    ``,
    `Podés abrirlo desde el celular, la tablet o la PC. Desde el navegador del celular, usá la opción "Agregar a pantalla de inicio" para instalarlo como aplicación.`,
    ``,
    `Ante cualquier consulta, respondé este correo.`,
    ``,
    `Saludos,`,
    empresa,
  ];

  return `mailto:${encodeURIComponent(u.email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(lineas.join('\n'))}`;
}

function abrirModalInvitacion(u, pinPlano) {
  _invitacionPendiente = { mailto: construirInvitacion(u, pinPlano) };
  document.getElementById('invitacion-resumen').innerHTML = `
    <strong>${u.nombre}</strong> · ${u.email}<br>
    Usuario: <strong>${u.usuario}</strong> · Perfil: ${u.rol === 'admin' ? 'Administrador' : 'Visualizador'}
    ${pinPlano ? '<br><span style="color:var(--verde);">✓ La invitación incluye el PIN de acceso</span>' : ''}`;
  abrirModal('modal-invitacion');
}

function enviarInvitacionPendiente() {
  if (!_invitacionPendiente) return;
  window.location.href = _invitacionPendiente.mailto;
  cerrarModal('modal-invitacion');
  mostrarToast('Invitación lista en tu correo — tocá Enviar', 'exito');
}

/* Re-envía la invitación desde la lista de usuarios (sin PIN: ya está hasheado) */
async function reenviarInvitacion(id) {
  const u = await FireDB.get(FireDB.STORES.USUARIOS, id);
  if (!u?.email) { mostrarToast('Este usuario no tiene email cargado', 'error'); return; }
  abrirModalInvitacion(u, null);
}

async function eliminarUsuarioUI(id, nombre) {
  if (!confirm(`¿Eliminar al usuario "${nombre}"?`)) return;
  try {
    await Auth.eliminarUsuario(id);
    await renderizarListaUsuarios();
    mostrarToast('Usuario eliminado');
  } catch (e) {
    mostrarToast(e.message, 'error');
  }
}

/* ——— Firma predeterminada del inspector ——— */

function actualizarPreviewFirmaConfig() {
  const firma = Estado.config.firmaPredeterminada;
  const preview  = document.getElementById('config-firma-preview');
  const img      = document.getElementById('config-firma-img');
  const btnTexto = document.getElementById('config-firma-btn-texto');
  const btnQuitar= document.getElementById('config-firma-quitar');
  if (!preview) return;
  if (firma) {
    img.src = firma;
    preview.style.display = 'block';
    btnQuitar.style.display = 'inline-flex';
    btnTexto.textContent = 'Cambiar firma';
  } else {
    preview.style.display = 'none';
    btnQuitar.style.display = 'none';
    btnTexto.textContent = 'Cargar firma';
  }
}

function cargarFirmaPredeterminada(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    // Normaliza la imagen: la dibuja sobre un canvas con fondo blanco para
    // garantizar que el PDF nunca reciba transparencias que se vean negras
    const img = new Image();
    img.onload = async () => {
      const maxW = 600;
      const escala = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');

      Estado.config.firmaPredeterminada = dataUrl;
      await FireDB.configSet('firmaPredeterminada', dataUrl);
      actualizarPreviewFirmaConfig();
      mostrarToast('Firma predeterminada guardada', 'exito');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  input.value = '';
}

async function quitarFirmaPredeterminada() {
  Estado.config.firmaPredeterminada = null;
  await FireDB.configSet('firmaPredeterminada', null);
  actualizarPreviewFirmaConfig();
  mostrarToast('Firma predeterminada eliminada');
}

/* ——— Logo de la empresa inspectora ——— */

function actualizarPreviewLogoConfig() {
  const logo = Estado.config.logoEmpresa;
  const preview  = document.getElementById('config-logo-preview');
  const img      = document.getElementById('config-logo-img');
  const btnTexto = document.getElementById('config-logo-btn-texto');
  const btnQuitar= document.getElementById('config-logo-quitar');
  if (!preview) return;
  if (logo) {
    img.src = logo;
    preview.style.display = 'block';
    btnQuitar.style.display = 'inline-flex';
    btnTexto.textContent = 'Cambiar logo';
  } else {
    preview.style.display = 'none';
    btnQuitar.style.display = 'none';
    btnTexto.textContent = 'Cargar logo';
  }
}

function cargarLogoEmpresa(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    // Normaliza sobre fondo blanco (los PNG transparentes se ven negros en el PDF)
    const img = new Image();
    img.onload = async () => {
      const maxW = 500;
      const escala = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');

      Estado.config.logoEmpresa = dataUrl;
      await FireDB.configSet('logoEmpresa', dataUrl);
      actualizarPreviewLogoConfig();
      mostrarToast('Logo de empresa guardado', 'exito');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  input.value = '';
}

async function quitarLogoEmpresa() {
  Estado.config.logoEmpresa = null;
  await FireDB.configSet('logoEmpresa', null);
  actualizarPreviewLogoConfig();
  mostrarToast('Logo de empresa eliminado');
}

async function guardarConfig() {
  const empresa  = document.getElementById('config-empresa').value.trim();
  const inspector = document.getElementById('config-inspector').value.trim();
  const appUrl   = document.getElementById('config-app-url').value.trim();

  await FireDB.configSet('empresa',  empresa);
  await FireDB.configSet('inspector', inspector);
  await FireDB.configSet('appUrl',   appUrl);

  Estado.config.empresa  = empresa;
  Estado.config.inspector = inspector;
  Estado.config.appUrl   = appUrl;
  document.getElementById('empresa-nombre-top').textContent = empresa || 'Inspecciones NFPA 25';

  cerrarModal('modal-config');
  mostrarToast('Configuración guardada', 'exito');

  if (Estado.pantallaActual === 'inspeccion') renderizarPantallaInspeccion();
}

/* ---------------- Respaldo: exportar / importar ---------------- */

async function exportarRespaldo() {
  mostrarToast('Preparando respaldo...');
  const datos = await FireDB.exportarTodo();
  const blob = new Blob([JSON.stringify(datos)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fireinspect_respaldo_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  mostrarToast('Respaldo descargado', 'exito');
}

function configurarImportacion() {
  const input = document.getElementById('input-importar');
  if (!input) return;
  input.addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
      const texto = await archivo.text();
      const datos = JSON.parse(texto);
      await FireDB.importarTodo(datos);
      mostrarToast('Datos importados correctamente', 'exito');
      cerrarModal('modal-config');
      renderizarDashboard();
      poblarSelectoresClientes();
    } catch (err) {
      mostrarToast('El archivo no es un respaldo válido', 'error');
    }
    e.target.value = '';
  });
}

/* ---------------- Service Worker (modo offline + instalación) ---------------- */

function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // si falla el registro (ej: corriendo desde file://), la app sigue funcionando online
    });
  }
}

window.UI = window.UI || {};
Object.assign(window.UI, { guardarConfig, exportarRespaldo, cargarFirmaPredeterminada, quitarFirmaPredeterminada, cargarLogoEmpresa, quitarLogoEmpresa,
  intentarLogin, cerrarSesionUI, abrirModalUsuario, guardarUsuario, eliminarUsuarioUI,
  enviarInvitacionPendiente, reenviarInvitacion });

document.addEventListener('DOMContentLoaded', inicializarApp);
