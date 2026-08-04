/* ═══════════════════════════════════════════════════════════════════
   FireInspect Pro — Sincronización Firebase + IndexedDB
   Estrategia híbrida:
   - Offline: todo funciona con IndexedDB local (igual que antes)
   - Online: sincroniza automáticamente con Firestore
   - Sin conexión en campo → se guarda local → al volver a conectar
     sube todo lo pendiente automáticamente
═══════════════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAk9Tbz1k6oEnh41uTflXhQKifZH1wki-8",
  authDomain: "fireinspect-pbsh.firebaseapp.com",
  projectId: "fireinspect-pbsh",
  storageBucket: "fireinspect-pbsh.firebasestorage.app",
  messagingSenderId: "463578095408",
  appId: "1:463578095408:web:914085ab75c78e9dfdb2f5"
};

// Stores que se sincronizan (excluimos CONFIG y FOTOS — muy pesadas)
const STORES_SYNC = [
  'clientes', 'inspecciones', 'planes_accion',
  'incidentes', 'hallazgos_auditoria', 'equipos',
  'eventos_calendario', 'usuarios'
];

let _db       = null;   // Firestore instance
let _online   = false;
let _escuchas = [];     // listeners activos de Firestore

/* ── Inicialización ── */
async function fsInit() {
  try {
    // Cargar SDK de Firebase dinámicamente
    if (!window.firebase) {
      await _cargarSDK('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
      await _cargarSDK('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js');
    }
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();
    // Habilitar persistencia offline (caché local de Firestore)
    await _db.enablePersistence({ synchronizeTabs: true }).catch(e => {
      if (e.code !== 'failed-precondition' && e.code !== 'unimplemented') console.warn('Persistencia Firestore:', e);
    });
    _online = true;
    console.log('✅ Firebase conectado');
    _iniciarEscuchas();
    _sincronizarPendientes();
    _mostrarEstadoSync('online');
    return true;
  } catch(e) {
    console.warn('Firebase no disponible — modo offline:', e.message);
    _online = false;
    _mostrarEstadoSync('offline');
    return false;
  }
}

function _cargarSDK(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = url; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ── Indicador visual de estado de sincronización ── */
function _mostrarEstadoSync(estado) {
  let badge = document.getElementById('sync-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'sync-badge';
    badge.style.cssText = `
      position:fixed;bottom:70px;right:12px;z-index:8888;
      display:flex;align-items:center;gap:6px;
      background:white;border-radius:20px;padding:5px 10px;
      font-size:11px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.15);
      border:1px solid #e5e7eb;transition:opacity 0.3s;cursor:default;
    `;
    document.body.appendChild(badge);
  }
  const configs = {
    online:     { color:'#10B981', texto:'Sincronizado',   icono:'●' },
    offline:    { color:'#F59E0B', texto:'Sin conexión',   icono:'●' },
    syncing:    { color:'#3B82F6', texto:'Sincronizando…', icono:'↻' },
    error:      { color:'#EF4444', texto:'Error sync',     icono:'!' },
  };
  const c = configs[estado] || configs.offline;
  badge.innerHTML = `<span style="color:${c.color};font-size:14px;">${c.icono}</span><span style="color:#374151;">${c.texto}</span>`;
  // Auto-ocultar badge "Sincronizado" después de 4 segundos
  if (estado === 'online') setTimeout(() => { if(badge) badge.style.opacity='0.4'; }, 4000);
  else badge.style.opacity = '1';
}

/* ── Cola de pendientes (guardada en localStorage) ── */
const COLA_KEY = 'fs_cola_pendientes';

function _agregarACola(operacion) {
  const cola = JSON.parse(localStorage.getItem(COLA_KEY) || '[]');
  cola.push({ ...operacion, ts: Date.now() });
  localStorage.setItem(COLA_KEY, JSON.stringify(cola));
}

function _limpiarCola() {
  localStorage.removeItem(COLA_KEY);
}

async function _sincronizarPendientes() {
  if (!_online) return;
  const cola = JSON.parse(localStorage.getItem(COLA_KEY) || '[]');
  if (!cola.length) return;
  _mostrarEstadoSync('syncing');
  try {
    for (const op of cola) {
      if (op.tipo === 'put' || op.tipo === 'add') {
        await _db.collection(op.store).doc(op.data.id).set(_limpiarParaFirestore(op.data));
      } else if (op.tipo === 'delete') {
        await _db.collection(op.store).doc(op.id).delete();
      }
    }
    _limpiarCola();
    _mostrarEstadoSync('online');
  } catch(e) {
    console.warn('Error sincronizando pendientes:', e);
    _mostrarEstadoSync('error');
  }
}

/* ── Limpiar datos antes de enviar a Firestore (sin undefined, sin dataURLs pesadas) ── */
function _limpiarParaFirestore(obj) {
  const limpio = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    // No subir imágenes base64 a Firestore (muy pesadas — van a Storage eventualmente)
    if (typeof v === 'string' && v.startsWith('data:image')) {
      limpio[k] = '[imagen_local]';
      continue;
    }
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      limpio[k] = _limpiarParaFirestore(v);
    } else if (Array.isArray(v)) {
      limpio[k] = v.map(item => typeof item === 'object' && item !== null ? _limpiarParaFirestore(item) : item);
    } else {
      limpio[k] = v;
    }
  }
  return limpio;
}

/* ── Escuchas en tiempo real (Firestore → IndexedDB local) ── */
function _iniciarEscuchas() {
  if (!_online || !_db) return;
  // Cancelar escuchas anteriores
  _escuchas.forEach(u => u());
  _escuchas = [];

  STORES_SYNC.forEach(store => {
    const unsub = _db.collection(store).onSnapshot(async snapshot => {
      for (const change of snapshot.docChanges()) {
        const data = { id: change.doc.id, ...change.doc.data() };
        if (change.type === 'added' || change.type === 'modified') {
          // Restaurar imágenes locales si existen
          const local = await FireDB.get({ STORES: { [store.toUpperCase()]: store } }.STORES?.[store.toUpperCase()] || store, data.id).catch(()=>null);
          if (local) {
            // Preservar imágenes locales que Firestore no tiene
            for (const k of Object.keys(local)) {
              if (typeof local[k] === 'string' && local[k].startsWith('data:image') && data[k] === '[imagen_local]') {
                data[k] = local[k];
              }
            }
          }
          await FireDB.put(store, data).catch(()=>{});
        } else if (change.type === 'removed') {
          await FireDB.delete(store, data.id).catch(()=>{});
        }
      }
      // Refrescar la UI si hay datos nuevos
      if (snapshot.docChanges().length > 0 && typeof renderizarDashboard === 'function') {
        renderizarDashboard();
      }
    }, err => {
      console.warn('Error escucha Firestore:', store, err);
    });
    _escuchas.push(unsub);
  });
}

/* ── API pública: operaciones que van a IndexedDB + Firestore ── */

async function fsPut(store, data) {
  // 1. Guardar local siempre (funciona offline)
  const resultado = await FireDB.put(store, data);
  // 2. Intentar subir a Firestore
  if (_online && _db) {
    try {
      await _db.collection(store).doc(data.id).set(_limpiarParaFirestore(data));
    } catch(e) {
      // Si falla, agregar a cola de pendientes
      _agregarACola({ tipo: 'put', store, data });
      _mostrarEstadoSync('offline');
    }
  } else {
    _agregarACola({ tipo: 'put', store, data });
  }
  return resultado;
}

async function fsAdd(store, data) {
  const resultado = await FireDB.add(store, data);
  if (_online && _db) {
    try {
      await _db.collection(store).doc(resultado.id).set(_limpiarParaFirestore(resultado));
    } catch(e) {
      _agregarACola({ tipo: 'add', store, data: resultado });
      _mostrarEstadoSync('offline');
    }
  } else {
    _agregarACola({ tipo: 'add', store, data: resultado });
  }
  return resultado;
}

async function fsDelete(store, id) {
  await FireDB.delete(store, id);
  if (_online && _db) {
    try {
      await _db.collection(store).doc(id).delete();
    } catch(e) {
      _agregarACola({ tipo: 'delete', store, id });
    }
  } else {
    _agregarACola({ tipo: 'delete', store, id });
  }
}

/* ── Subida inicial: mandar todos los datos locales a Firebase (primera vez) ── */
async function fsSyncCompleto() {
  if (!_online || !_db) {
    mostrarToast('Sin conexión — imposible sincronizar', 'error');
    return;
  }
  _mostrarEstadoSync('syncing');
  mostrarToast('Subiendo datos a la nube...');
  try {
    let total = 0;
    for (const store of STORES_SYNC) {
      const items = await FireDB.getAll(store);
      const batch = _db.batch();
      items.forEach(item => {
        const ref = _db.collection(store).doc(item.id);
        batch.set(ref, _limpiarParaFirestore(item));
      });
      if (items.length) await batch.commit();
      total += items.length;
    }
    _limpiarCola();
    _mostrarEstadoSync('online');
    mostrarToast(`✅ ${total} registros sincronizados`, 'exito');
  } catch(e) {
    _mostrarEstadoSync('error');
    mostrarToast('Error al sincronizar: ' + e.message, 'error');
  }
}

/* ── Detectar cambios de conectividad ── */
window.addEventListener('online',  () => { _online = true;  fsInit(); });
window.addEventListener('offline', () => { _online = false; _mostrarEstadoSync('offline'); });

/* ── Export público ── */
window.FireSync = {
  init:         fsInit,
  put:          fsPut,
  add:          fsAdd,
  delete:       fsDelete,
  syncCompleto: fsSyncCompleto,
  get online()  { return _online; },
};
