/* ============================================================
   FireInspect Pro — Conversión de unidades
   Estándar NFPA: PSI y GPM como unidades principales.
   Conversión automática a bar y L/min como referencia.
   ============================================================ */

const PSI_A_BAR   = 0.0689476;
const BAR_A_PSI   = 14.5038;
const GPM_A_LMIN  = 3.78541;
const LMIN_A_GPM  = 0.264172;
const GAL_A_LITRO = 3.78541;
const F_A_C       = (f) => ((f - 32) * 5) / 9;
const FT_A_M      = 0.3048;
const M3_A_GAL    = 264.172;

/* Conversiones base */
function psiABar(psi)   { const n = parseFloat(psi); return isNaN(n) ? null : Math.round(n * PSI_A_BAR   * 100) / 100; }
function barAPsi(bar)   { const n = parseFloat(bar); return isNaN(n) ? null : Math.round(n * BAR_A_PSI   * 10)  / 10;  }
function gpmALmin(gpm)  { const n = parseFloat(gpm); return isNaN(n) ? null : Math.round(n * GPM_A_LMIN  * 10)  / 10;  }
function lminAGpm(lpm)  { const n = parseFloat(lpm); return isNaN(n) ? null : Math.round(n * LMIN_A_GPM  * 10)  / 10;  }
function galALitros(g)  { const n = parseFloat(g);   return isNaN(n) ? null : Math.round(n * GAL_A_LITRO * 10)  / 10;  }
function ftAMetros(ft)  { const n = parseFloat(ft);  return isNaN(n) ? null : Math.round(n * FT_A_M      * 100) / 100; }
function m3AGal(m3)     { const n = parseFloat(m3);  return isNaN(n) ? null : Math.round(n * M3_A_GAL) ; }
function fAGrados(f)    { const n = parseFloat(f);   return isNaN(n) ? null : Math.round(F_A_C(n) * 10)           / 10;  }

/*
 * Devuelve el texto de conversión que va debajo del campo.
 * unidadTipo: 'presion' | 'caudal' | 'volumen' | 'temperatura' | 'longitud'
 */
function textoConversion(valor, unidadTipo) {
  const v = parseFloat(valor);
  if (isNaN(v) || valor === '') return '';
  switch (unidadTipo) {
    case 'presion':     { const b = psiABar(v);   return b  !== null ? `≈ ${b} bar`    : ''; }
    case 'caudal':      { const l = gpmALmin(v);  return l  !== null ? `≈ ${l} L/min`  : ''; }
    case 'volumen':     { const l = galALitros(v);return l  !== null ? `≈ ${l} L`      : ''; }
    case 'volumen_m3':  { const g = m3AGal(v);    return g  !== null ? `≈ ${g.toLocaleString('es-AR')} gal` : ''; }
    case 'temperatura': { const c = fAGrados(v);  return c  !== null ? `≈ ${c} °C`     : ''; }
    case 'longitud':    { const m = ftAMetros(v); return m  !== null ? `≈ ${m} m`      : ''; }
    default:            return '';
  }
}

window.Unidades = {
  psiABar, barAPsi, gpmALmin, lminAGpm, galALitros, ftAMetros, fAGrados, m3AGal,
  textoConversion,
};
