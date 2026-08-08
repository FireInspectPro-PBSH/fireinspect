/* ═══════════════════════════════════════════════════════════════════
   FireInspect Pro — Sincronización Firebase MANUAL
   - Sin sincronización automática en tiempo real
   - Vos decidís cuándo subir (local → nube) y cuándo bajar (nube → local)
   - Los datos locales NUNCA se pisan automáticamente
═══════════════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAk9Tbz1k6oEnh41uTflXhQKifZH1wki-8",
  authDomain: "fireinspect-pbsh.firebaseapp.com",
  projectId: "fireinspect-pbsh",
  storageBucket: "fireinspect-pbsh.firebasestorage.app",
  messagingSenderId: "463578095408",
  appId: "1:463578095408:web:914085ab75c78e9dfdb2f5"
};

const STORES_SYNC = [
  'clientes', 'inspecciones', 'planes_accion',
  'incidentes', 'hallazgos_auditoria', 'equipos',
  'eventos_calendario', 'usuarios'
];

let _db     = null;
let _online = false;
let _listo  = false;

/* ── Indicador visual ── */
function _badge(estado) {
  let b = document.getElementById('sync-badge');
  if (!b) {
    b = document.createElement('div');
    b.id = 'sync-badge';
    b.style.cssText = 'position:fixed;bottom:76px;right:12px;z-index:8888;' +
      'display:flex;align-items:center;gap:6px;background:white;border-radius:20px;' +
      'padding:5px 10px;font-size:11px;font-weight:600;' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.15);border:1px solid #e5e7eb;cursor:default;';
    document.body.appendChild(b);
  }
  const cfg = {
    online:   { c:'#10B981', t:'Firebase listo',  i:'●' },
    offline:  { c:'#F59E0B', t:'Sin conexión',    i:'●' },
    syncing:  { c:'#3B82F6', t:'Sincronizando…',  i:'↻' },
    error:    { c:'#EF4444', t:'Error',            i:'!' },
  };
  const s = cfg[estado] || cfg.offline;
  b.innerHTML = `<span style="color:${s.c};font-size:14px;">${s.i}</span><span style="color:#374151;">${s.t}</span>`;
  b.style.opacity = '1';
  if (estado === 'online') setTimeout(() => { b.style.opacity='0.35'; }, 3000);
}

/* ── Limpiar datos para Firestore (sin imágenes base64) ── */
function _limpiar(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const r = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (typeof v === 'string' && v.startsWith('data:image')) { r[k] = '[img_local]'; continue; }
    if (Array.isArray(v)) { r[k] = v.map(i => typeof i === 'object' ? _limpiar(i) : i); }
    else if (v !== null && typeof v === 'object') { r[k] = _limpiar(v); }
    else r[k] = v;
  }
  return r;
}

/* ── Inicializar Firebase (solo conexión, sin listeners) ── */
async function fsInit() {
  try {
    // SDKs ya cargados desde index.html
    if (!window.firebase) throw new Error('Firebase SDK no cargado');
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();
    _online = true;
    _listo  = true;
    _badge('online');
    console.log('✅ Firebase listo');
    return true;
  } catch(e) {
    console.warn('Firebase no disponible:', e.message);
    _badge('offline');
    return false;
  }
}

function _sdk(url) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${url}"]`)) return res();
    const s = document.createElement('script');
    s.src = url; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

/* ══════════════════════════════════════════════════════════════
   SUBIR — local → Firebase  (no toca datos locales)
══════════════════════════════════════════════════════════════ */
async function fsSyncSUBIR() {
  if (!_listo) { mostrarToast('Firebase no conectado', 'error'); return; }
  _badge('syncing');
  mostrarToast('Subiendo datos a la nube...');
  try {
    let total = 0;
    for (const store of STORES_SYNC) {
      const items = await FireDB.getAll(store);
      if (!items.length) continue;
      // Subir en lotes de 400 (límite Firestore batch = 500)
      for (let i = 0; i < items.length; i += 400) {
        const batch = _db.batch();
        items.slice(i, i + 400).forEach(item => {
          batch.set(_db.collection(store).doc(item.id), _limpiar(item));
        });
        await batch.commit();
      }
      total += items.length;
    }
    _badge('online');
    mostrarToast(`✅ ${total} registros subidos a la nube`, 'exito');
  } catch(e) {
    _badge('error');
    mostrarToast('Error al subir: ' + e.message, 'error');
    console.error(e);
  }
}

/* ══════════════════════════════════════════════════════════════
   BAJAR — Firebase → local  (reemplaza datos locales)
   ⚠️  Solo usar cuando querés traer datos de otro dispositivo
══════════════════════════════════════════════════════════════ */
async function fsSyncBAJAR() {
  if (!_listo) { mostrarToast('Firebase no conectado', 'error'); return; }

  // Confirmar antes de pisar datos locales
  const ok = await new Promise(resolve => {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    m.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;max-width:340px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <div style="background:#FEF3C7;border-radius:50%;padding:8px;"><i class="ti ti-cloud-download" style="color:#D97706;font-size:20px;"></i></div>
          <strong style="font-size:15px;">Bajar datos de la nube</strong>
        </div>
        <p style="font-size:13px;color:#6B7280;line-height:1.5;margin-bottom:20px;">
          Esto va a <strong>reemplazar tus datos locales</strong> con los que están en Firebase.<br><br>
          Usá esta opción solo para sincronizar desde otro dispositivo.<br><br>
          <strong>¿Querés continuar?</strong>
        </p>
        <div style="display:flex;gap:10px;">
          <button id="_fd_cancel" class="btn btn-secundario" style="flex:1;">Cancelar</button>
          <button id="_fd_ok" class="btn" style="flex:1;background:#D97706;color:white;">Bajar datos</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.querySelector('#_fd_cancel').onclick = () => { m.remove(); resolve(false); };
    m.querySelector('#_fd_ok').onclick     = () => { m.remove(); resolve(true);  };
  });
  if (!ok) return;

  _badge('syncing');
  mostrarToast('Bajando datos de la nube...');
  try {
    let total = 0;
    for (const store of STORES_SYNC) {
      const snap = await _db.collection(store).get();
      for (const doc of snap.docs) {
        const data = { id: doc.id, ...doc.data() };
        await FireDB.put(store, data).catch(()=>{});
        total++;
      }
    }
    _badge('online');
    mostrarToast(`✅ ${total} registros bajados`, 'exito');
    // Refrescar UI
    if (typeof renderizarDashboard === 'function') setTimeout(renderizarDashboard, 500);
  } catch(e) {
    _badge('error');
    mostrarToast('Error al bajar: ' + e.message, 'error');
  }
}

/* ── Detectar conectividad (solo actualiza el badge, no inicia Firebase) ── */
window.addEventListener('online',  () => { _online = true;  if (_listo) _badge('online'); });
window.addEventListener('offline', () => { _online = false; _badge('offline'); });

/* ── Limpiar datos semilla de Firebase (cli_1, cli_2, etc.) ── */
async function fsLimpiarSemillas() {
  if (!_listo) { mostrarToast('Conectá Firebase primero', 'error'); return; }
  try {
    const snap = await _db.collection('clientes').get();
    const semillas = snap.docs.filter(d => /^cli_\d+$/.test(d.id));
    if (semillas.length === 0) {
      mostrarToast('No hay datos semilla para limpiar', 'exito');
      return;
    }
    const batch = _db.batch();
    semillas.forEach(d => batch.delete(d.ref));
    await batch.commit();
    mostrarToast(`✅ ${semillas.length} datos semilla eliminados de Firebase`, 'exito');
  } catch(e) {
    mostrarToast('Error: ' + e.message, 'error');
  }
}

/* ── Export público ── */
window.FireSync = {
  init:           fsInit,
  subir:          fsSyncSUBIR,
  bajar:          fsSyncBAJAR,
  syncCompleto:   fsSyncSUBIR,
  limpiarSemillas: fsLimpiarSemillas,
  get online() { return _online; },
  get listo()  { return _listo;  },
};
