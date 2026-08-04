/* ============================================================
   FireInspect Pro — Capa de datos (IndexedDB)
   Punto 1: Guardado real de datos con persistencia entre sesiones
   ============================================================
   Por qué IndexedDB y no localStorage:
   - localStorage solo guarda texto y tiene límite ~5MB (las fotos lo agotan rápido)
   - IndexedDB soporta blobs binarios (fotos, firmas) y varios GB de espacio
   - Funciona 100% offline, ideal para inspectores en campo sin señal
   ============================================================ */

const DB_NAME = 'fireinspect_db';
const DB_VERSION = 4;

const STORES = {
  CLIENTES: 'clientes',
  SISTEMAS: 'sistemas',
  INSPECCIONES: 'inspecciones',
  PLANES_ACCION: 'planes_accion',
  FOTOS: 'fotos',
  EVENTOS: 'eventos_calendario',
  CONFIG: 'config',
  INCIDENTES: 'incidentes',
  HALLAZGOS_AUDITORIA: 'hallazgos_auditoria',
  USUARIOS: 'usuarios',
  EQUIPOS: 'equipos'
};

let dbInstance = null;

/* Abre (o crea) la base de datos y define la estructura de tablas */
function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.CLIENTES)) {
        const store = db.createObjectStore(STORES.CLIENTES, { keyPath: 'id' });
        store.createIndex('nombre', 'nombre', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SISTEMAS)) {
        const store = db.createObjectStore(STORES.SISTEMAS, { keyPath: 'id' });
        store.createIndex('clienteId', 'clienteId', { unique: false });
        store.createIndex('tipo', 'tipo', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.INSPECCIONES)) {
        const store = db.createObjectStore(STORES.INSPECCIONES, { keyPath: 'id' });
        store.createIndex('clienteId', 'clienteId', { unique: false });
        store.createIndex('sistemaId', 'sistemaId', { unique: false });
        store.createIndex('fecha', 'fecha', { unique: false });
        store.createIndex('tipoSistema', 'tipoSistema', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.PLANES_ACCION)) {
        const store = db.createObjectStore(STORES.PLANES_ACCION, { keyPath: 'id' });
        store.createIndex('clienteId', 'clienteId', { unique: false });
        store.createIndex('inspeccionId', 'inspeccionId', { unique: false });
        store.createIndex('estado', 'estado', { unique: false });
        store.createIndex('fechaLimite', 'fechaLimite', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.FOTOS)) {
        const store = db.createObjectStore(STORES.FOTOS, { keyPath: 'id' });
        store.createIndex('inspeccionId', 'inspeccionId', { unique: false });
        store.createIndex('planAccionId', 'planAccionId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.EVENTOS)) {
        const store = db.createObjectStore(STORES.EVENTOS, { keyPath: 'id' });
        store.createIndex('fecha', 'fecha', { unique: false });
        store.createIndex('clienteId', 'clienteId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CONFIG)) {
        db.createObjectStore(STORES.CONFIG, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORES.INCIDENTES)) {
        const store = db.createObjectStore(STORES.INCIDENTES, { keyPath: 'id' });
        store.createIndex('clienteId', 'clienteId', { unique: false });
        store.createIndex('fecha', 'fecha', { unique: false });
        store.createIndex('tipoSistema', 'tipoSistema', { unique: false });
        store.createIndex('esAlarmaFalsa', 'esAlarmaFalsa', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.HALLAZGOS_AUDITORIA)) {
        const store = db.createObjectStore(STORES.HALLAZGOS_AUDITORIA, { keyPath: 'id' });
        store.createIndex('clienteId', 'clienteId', { unique: false });
        store.createIndex('fecha', 'fecha', { unique: false });
        store.createIndex('severidad', 'severidad', { unique: false });
        store.createIndex('estado', 'estado', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.USUARIOS)) {
        const store = db.createObjectStore(STORES.USUARIOS, { keyPath: 'id' });
        store.createIndex('usuario', 'usuario', { unique: true });
        store.createIndex('rol', 'rol', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.EQUIPOS)) {
        const store = db.createObjectStore(STORES.EQUIPOS, { keyPath: 'id' });
        store.createIndex('clienteId', 'clienteId', { unique: false });
        store.createIndex('tipoSistema', 'tipoSistema', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error('No se pudo abrir la base de datos: ' + event.target.error));
    };
  });
}

/* Genera un ID único basado en timestamp + random, suficiente para uso local */
function generarId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

/* ---------- Operaciones genéricas CRUD ---------- */

async function dbAdd(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    if (!data.id) data.id = generarId();
    if (!data.creadoEn) data.creadoEn = new Date().toISOString();
    data.actualizadoEn = new Date().toISOString();
    const request = store.add(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    data.actualizadoEn = new Date().toISOString();
    const request = store.put(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
}

async function dbGet(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/* ---------- Config simple key-value (ej: datos de la empresa, logo) ---------- */

async function configGet(key) {
  const row = await dbGet(STORES.CONFIG, key);
  return row ? row.value : null;
}

async function configSet(key, value) {
  return dbPut(STORES.CONFIG, { key, value });
}

/* ---------- Exportar / Importar todo (respaldo manual) ---------- */

async function exportarTodo() {
  const data = {};
  for (const storeName of Object.values(STORES)) {
    data[storeName] = await dbGetAll(storeName);
  }
  data._exportadoEn = new Date().toISOString();
  data._version = DB_VERSION;
  return data;
}

async function importarTodo(data) {
  const db = await openDB();
  for (const storeName of Object.values(STORES)) {
    if (!Array.isArray(data[storeName])) continue;
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of data[storeName]) {
      store.put(item);
    }
    await new Promise((res) => { tx.oncomplete = res; });
  }
  return true;
}

/* ---------- Eliminación de cliente con archivado (Recomendación 1) ---------- */

/* Reúne todo lo que tiene un cliente en la base (sistemas, inspecciones,
   planes de acción, fotos, incidentes, hallazgos) para poder armar un
   archivo de respaldo antes de borrarlo definitivamente */
async function recopilarDatosDeCliente(clienteId) {
  const cliente = await dbGet(STORES.CLIENTES, clienteId);
  const sistemas = await dbGetByIndex(STORES.SISTEMAS, 'clienteId', clienteId);
  const inspecciones = await dbGetByIndex(STORES.INSPECCIONES, 'clienteId', clienteId);
  const planesAccion = await dbGetByIndex(STORES.PLANES_ACCION, 'clienteId', clienteId);
  const incidentes = await dbGetByIndex(STORES.INCIDENTES, 'clienteId', clienteId);
  const hallazgos = await dbGetByIndex(STORES.HALLAZGOS_AUDITORIA, 'clienteId', clienteId);
  const eventos = await dbGetByIndex(STORES.EVENTOS, 'clienteId', clienteId);

  const inspeccionIds = inspecciones.map(i => i.id);
  const todasFotos = await dbGetAll(STORES.FOTOS);
  const fotos = todasFotos.filter(f =>
    inspeccionIds.includes(f.inspeccionId) ||
    planesAccion.some(p => p.id === f.planAccionId)
  );

  return { cliente, sistemas, inspecciones, planesAccion, incidentes, hallazgos, eventos, fotos };
}

/* Cuenta cuántos registros relacionados tiene un cliente, para mostrar
   la advertencia antes de borrar ("este cliente tiene 8 inspecciones...") */
async function contarRegistrosDeCliente(clienteId) {
  const datos = await recopilarDatosDeCliente(clienteId);
  return {
    sistemas: datos.sistemas.length,
    inspecciones: datos.inspecciones.length,
    planesAccion: datos.planesAccion.length,
    incidentes: datos.incidentes.length,
    hallazgos: datos.hallazgos.length,
    eventos: datos.eventos.length,
    fotos: datos.fotos.length,
    total: datos.sistemas.length + datos.inspecciones.length + datos.planesAccion.length +
           datos.incidentes.length + datos.hallazgos.length + datos.eventos.length
  };
}

/* Borra definitivamente al cliente y todo lo relacionado. Se llama
   DESPUÉS de que el archivo de respaldo ya fue generado y descargado */
async function eliminarClienteYTodoSuHistorial(clienteId) {
  const datos = await recopilarDatosDeCliente(clienteId);

  for (const s of datos.sistemas) await dbDelete(STORES.SISTEMAS, s.id);
  for (const i of datos.inspecciones) await dbDelete(STORES.INSPECCIONES, i.id);
  for (const p of datos.planesAccion) await dbDelete(STORES.PLANES_ACCION, p.id);
  for (const inc of datos.incidentes) await dbDelete(STORES.INCIDENTES, inc.id);
  for (const h of datos.hallazgos) await dbDelete(STORES.HALLAZGOS_AUDITORIA, h.id);
  for (const e of datos.eventos) await dbDelete(STORES.EVENTOS, e.id);
  for (const f of datos.fotos) await dbDelete(STORES.FOTOS, f.id);
  await dbDelete(STORES.CLIENTES, clienteId);

  return true;
}



async function cargarDatosSemillaSiVacio() {
  const clientes = await dbGetAll(STORES.CLIENTES);
  if (clientes.length > 0) return false;

  const clientesSemilla = [
    { id: 'cli_1', nombre: 'Hospital San Martín', direccion: 'Av. Libertador 1450', contacto: 'María Fernández', telefono: '11-4555-2030', email: 'mfernandez@hospitalsanmartin.com.ar', logoDataUrl: null },
    { id: 'cli_2', nombre: 'Industrial Norte', direccion: 'Parque Industrial Lote 14', contacto: 'Carlos Ibáñez', telefono: '11-4789-1122', email: 'cibanez@industrialnorte.com.ar', logoDataUrl: null },
    { id: 'cli_3', nombre: 'Shopping Plaza', direccion: 'Ruta 8 Km 45', contacto: 'Lucía Méndez', telefono: '11-4321-9087', email: 'lmendez@shoppingplaza.com.ar', logoDataUrl: null },
    { id: 'cli_4', nombre: 'Edificio Centro', direccion: 'Calle San Luis 220', contacto: 'Roberto Paz', telefono: '11-4112-5566', email: 'rpaz@edificiocentro.com.ar', logoDataUrl: null }
  ];

  for (const c of clientesSemilla) {
    c.creadoEn = new Date().toISOString();
    c.actualizadoEn = c.creadoEn;
    await dbPut(STORES.CLIENTES, c);
  }

  const sistemasSemilla = [
    { id: 'sis_1', clienteId: 'cli_1', tipo: 'rociador', nombre: 'RISER principal — Ala Este',     subtipo: 'Tubería húmeda (wet pipe)' },
    { id: 'sis_2', clienteId: 'cli_2', tipo: 'bomba',    nombre: 'Motobomba diesel principal',      subtipo: 'Diesel — 1500 GPM / 140 PSI' },
    { id: 'sis_3', clienteId: 'cli_3', tipo: 'hidrante', nombre: 'Hidrantes exteriores perímetro', subtipo: 'Exterior' },
    { id: 'sis_4', clienteId: 'cli_4', tipo: 'tanque',   nombre: 'Reserva de agua principal',      subtipo: '13,000 gal (≈49 m³)' }
  ];

  for (const s of sistemasSemilla) {
    s.creadoEn = new Date().toISOString();
    s.actualizadoEn = s.creadoEn;
    await dbPut(STORES.SISTEMAS, s);
  }

  return true;
}

window.FireDB = {
  STORES,
  openDB,
  generarId,
  add: dbAdd,
  put: dbPut,
  get: dbGet,
  getAll: dbGetAll,
  getByIndex: dbGetByIndex,
  delete: dbDelete,
  configGet,
  configSet,
  exportarTodo,
  importarTodo,
  recopilarDatosDeCliente,
  contarRegistrosDeCliente,
  eliminarClienteYTodoSuHistorial,
  cargarDatosSemillaSiVacio
};
