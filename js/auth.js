/* ═══════════════════════════════════════════════════════════════
   AUTH — Usuarios, roles y sesión de FireInspect Pro

   Roles:
   · admin        → acceso total: carga, modifica, programa
   · visualizador → solo lectura: ve inspecciones y descarga PDF
                    (opcionalmente limitado a un cliente específico)

   El PIN se guarda hasheado (SHA-256 + salt por usuario).
   La sesión persiste en localStorage hasta cerrar sesión.
═══════════════════════════════════════════════════════════════ */

const Auth = (() => {

  const CLAVE_SESION = 'fireinspect_sesion';

  /* ——— Hash del PIN con SHA-256 y salt por usuario ——— */
  async function hashPin(pin, usuario) {
    const texto = `fireinspect·${usuario.toLowerCase()}·${pin}`;
    const data  = new TextEncoder().encode(texto);
    const hash  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ——— ¿Hay usuarios creados? (si no hay, la app funciona sin login) ——— */
  async function hayUsuarios() {
    const usuarios = await FireDB.getAll(FireDB.STORES.USUARIOS);
    return usuarios.length > 0;
  }

  async function listarUsuarios() {
    const usuarios = await FireDB.getAll(FireDB.STORES.USUARIOS);
    return usuarios.sort((a, b) => (a.rol === 'admin' ? -1 : 1) - (b.rol === 'admin' ? -1 : 1) || a.nombre.localeCompare(b.nombre));
  }

  /* ——— Crea un usuario. Valida nombre de usuario único. ——— */
  async function crearUsuario({ nombre, usuario, pin, rol, clienteId, email }) {
    usuario = (usuario || '').trim().toLowerCase();
    nombre  = (nombre  || '').trim();
    if (!nombre)  throw new Error('Ingresá el nombre completo');
    if (!usuario) throw new Error('Ingresá un nombre de usuario');
    if (!/^[a-z0-9._-]{3,20}$/.test(usuario)) throw new Error('Usuario: 3-20 caracteres, solo letras, números, punto, guión');
    if (!/^\d{4,8}$/.test(pin)) throw new Error('El PIN debe tener entre 4 y 8 dígitos');
    if (rol !== 'admin' && rol !== 'visualizador') throw new Error('Rol inválido');

    const existentes = await FireDB.getAll(FireDB.STORES.USUARIOS);
    if (existentes.some(u => u.usuario === usuario)) throw new Error(`El usuario "${usuario}" ya existe`);

    const registro = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nombre,
      usuario,
      pinHash: await hashPin(pin, usuario),
      rol,
      clienteId: rol === 'visualizador' ? (clienteId || null) : null,  // null = ve todos
      email: (email || '').trim() || null,
      creadoEl: new Date().toISOString(),
    };
    await FireDB.put(FireDB.STORES.USUARIOS, registro);
    return registro;
  }

  /* ——— Valida credenciales. Devuelve el usuario o null. ——— */
  async function validarLogin(usuario, pin) {
    usuario = (usuario || '').trim().toLowerCase();
    if (!usuario || !pin) return null;
    const usuarios = await FireDB.getAll(FireDB.STORES.USUARIOS);
    const u = usuarios.find(x => x.usuario === usuario);
    if (!u) return null;
    const hash = await hashPin(pin, usuario);
    return hash === u.pinHash ? u : null;
  }

  /* ——— Elimina un usuario, protegiendo al último admin ——— */
  async function eliminarUsuario(id) {
    const usuarios = await FireDB.getAll(FireDB.STORES.USUARIOS);
    const objetivo = usuarios.find(u => u.id === id);
    if (!objetivo) return;
    if (objetivo.rol === 'admin') {
      const admins = usuarios.filter(u => u.rol === 'admin');
      if (admins.length <= 1) throw new Error('No podés eliminar al último administrador');
    }
    await FireDB.delete(FireDB.STORES.USUARIOS, id);
  }

  /* ——— Cambia el PIN de un usuario ——— */
  async function cambiarPin(id, pinNuevo) {
    if (!/^\d{4,8}$/.test(pinNuevo)) throw new Error('El PIN debe tener entre 4 y 8 dígitos');
    const u = await FireDB.get(FireDB.STORES.USUARIOS, id);
    if (!u) throw new Error('Usuario no encontrado');
    u.pinHash = await hashPin(pinNuevo, u.usuario);
    await FireDB.put(FireDB.STORES.USUARIOS, u);
  }

  /* ——— Sesión ——— */
  function guardarSesion(u) {
    const sesion = { usuarioId: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, clienteId: u.clienteId || null };
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    return sesion;
  }

  function obtenerSesion() {
    try {
      const raw = localStorage.getItem(CLAVE_SESION);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function cerrarSesion() {
    localStorage.removeItem(CLAVE_SESION);
  }

  return {
    hayUsuarios, listarUsuarios, crearUsuario, validarLogin,
    eliminarUsuario, cambiarPin,
    guardarSesion, obtenerSesion, cerrarSesion,
  };
})();
