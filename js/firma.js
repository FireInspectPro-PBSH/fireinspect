/* ============================================================
   FireInspect Pro — Firma digital
   Punto 5: Firma digital con canvas táctil
   ============================================================
   Captura la firma del inspector (y opcionalmente del cliente)
   directamente con el dedo sobre la pantalla táctil del celular
   o tablet, usando Pointer Events (funciona con touch, mouse y
   lápiz/stylus por igual).
   ============================================================ */

class FirmaDigital {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.dibujando = false;
    this.tieneTrazo = false;
    this.ultimoPunto = null;

    this._ajustarResolucion();
    this._configurarTrazo();
    this._bindEventos();
  }

  /* Ajusta el canvas a la resolución real del dispositivo (evita líneas borrosas en pantallas de alta densidad) */
  _ajustarResolucion() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.anchoCSS = rect.width;
    this.altoCSS = rect.height;
  }

  _configurarTrazo() {
    this.ctx.strokeStyle = '#1a1a1a';
    this.ctx.lineWidth = 2.2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  _obtenerPosicion(evento) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: evento.clientX - rect.left,
      y: evento.clientY - rect.top
    };
  }

  _bindEventos() {
    this.canvas.style.touchAction = 'none'; // evita scroll de la página mientras se firma

    this.canvas.addEventListener('pointerdown', (e) => {
      this.dibujando = true;
      this.ultimoPunto = this._obtenerPosicion(e);
      this.canvas.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dibujando) return;
      const punto = this._obtenerPosicion(e);
      this.ctx.beginPath();
      this.ctx.moveTo(this.ultimoPunto.x, this.ultimoPunto.y);
      this.ctx.lineTo(punto.x, punto.y);
      this.ctx.stroke();
      this.ultimoPunto = punto;
      this.tieneTrazo = true;
    });

    const finalizarTrazo = () => { this.dibujando = false; };
    this.canvas.addEventListener('pointerup', finalizarTrazo);
    this.canvas.addEventListener('pointerleave', finalizarTrazo);
    this.canvas.addEventListener('pointercancel', finalizarTrazo);
  }

  limpiar() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.tieneTrazo = false;
  }

  estaVacia() {
    return !this.tieneTrazo;
  }

  /* Exporta la firma como imagen PNG con fondo blanco (necesario para que se vea bien en el PDF) */
  exportarDataUrl() {
    const canvasFinal = document.createElement('canvas');
    canvasFinal.width = this.canvas.width;
    canvasFinal.height = this.canvas.height;
    const ctxFinal = canvasFinal.getContext('2d');
    ctxFinal.fillStyle = '#ffffff';
    ctxFinal.fillRect(0, 0, canvasFinal.width, canvasFinal.height);
    ctxFinal.drawImage(this.canvas, 0, 0);
    return canvasFinal.toDataURL('image/png');
  }
}

window.FirmaDigital = FirmaDigital;
