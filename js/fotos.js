/* ============================================================
   FireInspect Pro — Manejo de fotos
   Punto 4 (parte): Carga de fotos con preview
   ============================================================
   Las fotos se comprimen antes de guardarse: un inspector en
   campo puede sacar 20-30 fotos por inspección, y sin compresión
   eso llena el almacenamiento del dispositivo muy rápido.
   ============================================================ */

const FOTO_MAX_ANCHO = 1280;
const FOTO_CALIDAD_JPEG = 0.72;

/* Convierte un archivo de imagen (input file o cámara) a un dataURL
   comprimido, redimensionando si excede el ancho máximo */
function procesarFoto(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let ancho = img.width;
        let alto = img.height;

        if (ancho > FOTO_MAX_ANCHO) {
          alto = Math.round((alto * FOTO_MAX_ANCHO) / ancho);
          ancho = FOTO_MAX_ANCHO;
        }

        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, ancho, alto);

        const dataUrl = canvas.toDataURL('image/jpeg', FOTO_CALIDAD_JPEG);
        resolve({ dataUrl, ancho, alto, tamanoBytes: Math.round(dataUrl.length * 0.75) });
      };
      img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
      img.src = e.target.result;
    };
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.readAsDataURL(archivo);
  });
}

/* Guarda una foto asociada a una inspección o a un plan de acción */
async function guardarFoto({ archivo, inspeccionId, planAccionId, descripcion }) {
  const procesada = await procesarFoto(archivo);
  const foto = {
    inspeccionId: inspeccionId || null,
    planAccionId: planAccionId || null,
    descripcion: descripcion || '',
    dataUrl: procesada.dataUrl,
    ancho: procesada.ancho,
    alto: procesada.alto,
    tamanoBytes: procesada.tamanoBytes,
    fechaCaptura: new Date().toISOString()
  };
  return FireDB.add(FireDB.STORES.FOTOS, foto);
}

async function obtenerFotosDeInspeccion(inspeccionId) {
  return FireDB.getByIndex(FireDB.STORES.FOTOS, 'inspeccionId', inspeccionId);
}

async function obtenerFotosDePlan(planAccionId) {
  return FireDB.getByIndex(FireDB.STORES.FOTOS, 'planAccionId', planAccionId);
}

async function eliminarFoto(fotoId) {
  return FireDB.delete(FireDB.STORES.FOTOS, fotoId);
}

window.FotosManager = {
  procesar: procesarFoto,
  guardar: guardarFoto,
  obtenerDeInspeccion: obtenerFotosDeInspeccion,
  obtenerDePlan: obtenerFotosDePlan,
  eliminar: eliminarFoto
};
