/* ═══════════════════════════════════════════════════════════════
   EQUIPOS — Base de activos por cliente

   Cada cliente registra sus equipos UNA sola vez (tanques con su
   capacidad, bombas con toda la placa, ECAs, hidrantes...). Al
   inspeccionar se selecciona el equipo y sus datos se precargan:
   la visita queda solo para control, prueba y mantenimiento.
═══════════════════════════════════════════════════════════════ */

const Equipos = (() => {

  /* ——— Campos de identificación de placa para BOMBAS ———
     Se usan además para precargar la ficha técnica completa
     del módulo de Curva de Desempeño. */
  const CAMPOS_PLACA_BOMBA = [
    { id: 'marca',        label: 'Marca',                          tipo: 'texto',  placeholder: 'Ej: Peerless / Ready Buffalo' },
    { id: 'modelo',       label: 'Modelo',                         tipo: 'texto',  placeholder: 'Ej: 8X8LDF' },
    { id: 'serie',        label: 'Nro. de serie',                  tipo: 'texto',  placeholder: 'Ej: 19-3459LDF8' },
    { id: 'tipoAccion',   label: 'Tipo de accionamiento',          tipo: 'select', opciones: [
        { v: 'electrico', t: 'Eléctrico' },
        { v: 'diesel',    t: 'Diesel / Motor a combustión' },
        { v: 'vapor',     t: 'Vapor' }] },
    { id: 'certificacion',label: 'Certificación',                  tipo: 'select', opciones: [
        { v: 'ul_fm',   t: 'UL / FM Listed' },
        { v: 'ul',      t: 'UL Listed' },
        { v: 'fm',      t: 'FM Approved' },
        { v: 'ninguna', t: 'Sin certificación' }] },
    { id: 'nn',           label: 'Velocidad nominal (RPM)',        tipo: 'numero', placeholder: 'Ej: 2250' },
    { id: 'qn',           label: 'Caudal nominal Qn (GPM)',        tipo: 'numero', unidad: 'caudal',  placeholder: 'Ej: 2500' },
    { id: 'pn',           label: 'Presión nominal Pn (PSI)',       tipo: 'numero', unidad: 'presion', placeholder: 'Ej: 150' },
    { id: 'p150',         label: 'Presión al 150% Qn (PSI)',       tipo: 'numero', unidad: 'presion', placeholder: 'Ej: 97.5' },
    { id: 'pShutoff',     label: 'Presión máx. Shutoff — Q=0 (PSI)', tipo: 'numero', unidad: 'presion', placeholder: 'Ej: 168 (si no se conoce: 140% × Pn)' },
    { id: 'diamSuc',      label: 'Diámetro succión (in)',          tipo: 'numero', placeholder: 'Ej: 10' },
    { id: 'diamDesc',     label: 'Diámetro descarga (in)',         tipo: 'numero', placeholder: 'Ej: 10' },
    { id: 'controlador',  label: 'Controlador / tablero',          tipo: 'texto',  placeholder: 'Ej: Firetrol FTA1100' },
  ];

  /* ——— Devuelve la definición de campos del equipo según el tipo ———
     Combina los campos del modelo NFPA (los que se cargan hoy en cada
     inspección) más, para bombas, la placa completa. */
  function camposDe(tipoSistema) {
    const modelo = NFPA25.MODELO[tipoSistema];
    if (!modelo) return [];
    const base = modelo.campos
      .filter(c => c.tipo !== 'fecha')   // las fechas son de la visita, no del equipo
      .map(c => ({ ...c }));
    if (tipoSistema === 'bomba') {
      return [...CAMPOS_PLACA_BOMBA, ...base];
    }
    return base;
  }

  const TIPOS = Object.keys(NFPA25.MODELO); // tanque, bomba, hidrante, rociador

  function tipoLabel(tipo)  { return NFPA25.MODELO[tipo]?.nombre || tipo; }
  function tipoIcono(tipo)  { return NFPA25.MODELO[tipo]?.icono  || 'box'; }
  function tipoColor(tipo)  { return NFPA25.MODELO[tipo]?.color  || '#555'; }

  /* ——— Resumen de un dato clave para mostrar en la lista ——— */
  function resumenDe(equipo) {
    const d = equipo.datos || {};
    switch (equipo.tipoSistema) {
      case 'tanque':   return d.capacidadM3 ? `${d.capacidadM3} m³` : (d.capacidadGal ? `${d.capacidadGal} gal` : '');
      case 'bomba':    return [d.marca, d.qn ? `${d.qn} GPM` : '', d.pn ? `${d.pn} PSI` : ''].filter(Boolean).join(' · ');
      case 'hidrante': return d.tipoHidrante || '';
      case 'rociador': return d.tipoSistemaRociador || '';
      default: return '';
    }
  }

  /* ——— CRUD ——— */
  async function listarPorCliente(clienteId, tipoSistema) {
    const todos = await FireDB.getByIndex(FireDB.STORES.EQUIPOS, 'clienteId', clienteId);
    const filtrados = tipoSistema ? todos.filter(e => e.tipoSistema === tipoSistema) : todos;
    return filtrados.sort((a, b) =>
      TIPOS.indexOf(a.tipoSistema) - TIPOS.indexOf(b.tipoSistema) || (a.tag || '').localeCompare(b.tag || ''));
  }

  async function obtener(id)  { return FireDB.get(FireDB.STORES.EQUIPOS, id); }
  async function guardar(eq)  {
    if (!eq.id) { eq.id = `eq_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; eq.creadoEl = new Date().toISOString(); }
    await FireSync.put(FireDB.STORES.EQUIPOS, eq);
    return eq;
  }
  async function eliminar(id) { return FireSync.delete(FireDB.STORES.EQUIPOS, id); }

  return { camposDe, CAMPOS_PLACA_BOMBA, TIPOS, tipoLabel, tipoIcono, tipoColor, resumenDe,
           listarPorCliente, obtener, guardar, eliminar };
})();
