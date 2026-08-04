/* ============================================================
   FireInspect Pro — Curva de Desempeño de Bomba CI
   Módulo de cálculo NFPA 20 / NFPA 25 §8.3.3
   ============================================================
   Lógica validada contra datos reales del informe Cargill S.A.
   (Bomba Peerles 6AEF12, 1500 GPM / 140 PSI / 2800 RPM)
   y la hoja de cálculo GAPS Water Supply Analysis.

   CRITERIOS NFPA 20 (prueba anual):
   - Shutoff (Q=0):   P_corr ≤ 140% × Pn
   - Punto 100%Q:     P_corr comparada contra Pn
   - Punto 150%Q:     P_corr comparada contra 65% × Pn

   LEY DE AFINIDAD (corrección a velocidad nominal):
   Q_corr = Q_campo × (Nn / N_real)
   P_corr = P_campo × (Nn / N_real)²

   CLASIFICACIÓN (bandas GAPS / NFPA 25):
   Excellent:  ratio ≥ 1.05  (≥ 105% del valor de referencia)
   Good:       ratio ≥ 0.95  (≥ 95%  — dentro de parámetros)
   Fair:       ratio ≥ 0.90  (≥ 90%  — requiere atención)
   Poor:       ratio <  0.90 (< 90%  — acción correctiva requerida)
   ============================================================ */

const CURVA_CLASIFICACIONES = [
  { id: 'excellent', label: 'Excellent',  labelEs: '4 - Excelente',   factorMin: 1.05, color: '#1E8449', colorFondo: '#EAFAF1' },
  { id: 'good',      label: 'Good',       labelEs: '3 - Buena',       factorMin: 0.95, color: '#2471A3', colorFondo: '#EBF5FB' },
  { id: 'fair',      label: 'Fair',       labelEs: '2 - Regular',     factorMin: 0.90, color: '#D68910', colorFondo: '#FEF9E7' },
  { id: 'poor',      label: 'Poor',       labelEs: '1 - Deficiente',  factorMin: 0.00, color: '#C0392B', colorFondo: '#FDEDEC' },
];

/* Convierte unidades — usa funciones del módulo Unidades */
function barAPsi(v)  { return Unidades.barAPsi(v);  }
function psiABar(v)  { return Unidades.psiABar(v);  }
function lpmAGpm(v)  { return Unidades.lminAGpm(v); }
function gpmALpm(v)  { return Unidades.gpmALmin(v); }

/* ——— CORRECCIÓN POR VELOCIDAD (ley de afinidad) ——— */
function corregirACaudalNominal(q_campo, p_campo_neta, n_real, n_nominal) {
  if (!n_real || n_real === 0) return { q_corr: q_campo, p_corr: p_campo_neta };
  const factor_q = n_nominal / n_real;
  const factor_p = (n_nominal / n_real) ** 2;
  return {
    q_corr: q_campo * factor_q,
    p_corr: p_campo_neta * factor_p
  };
}

/* ——— CÁLCULO DE UN PUNTO DE CAMPO ——— */
function calcularPuntoCampo({ q_campo, p_succion, p_descarga, n_real, n_nominal }) {
  const p_neta_campo = p_descarga - p_succion;
  const { q_corr, p_corr } = corregirACaudalNominal(q_campo, p_neta_campo, n_real, n_nominal);
  return { q_campo, p_neta_campo, q_corr, p_corr };
}

/* ——— CLASIFICACIÓN DE UN PUNTO OPERATIVO ——— */
function clasificarPunto(p_corr, referencia_psi) {
  if (referencia_psi === 0) return null;
  const ratio = p_corr / referencia_psi;
  for (const cls of CURVA_CLASIFICACIONES) {
    if (ratio >= cls.factorMin) return { ...cls, ratio, porcentaje: ratio * 100 };
  }
  return { ...CURVA_CLASIFICACIONES[3], ratio, porcentaje: ratio * 100 };
}

/* ——— ANÁLISIS COMPLETO DE UNA PRUEBA DE BOMBA ——— */
function analizarCurvaDesempeno(datosPrueba) {
  const {
    pn_psi,        // Presión nominal de placa [PSI]
    qn_gpm,        // Caudal nominal de placa [GPM]
    nn_rpm,        // Velocidad nominal de placa [RPM]
    // Punto 1: shutoff (Q=0)
    p_suc_shutoff, p_desc_shutoff, n_shutoff,
    // Punto 2: ~100% de Q nominal
    q_campo_100,   p_suc_100,      p_desc_100,    n_100,
    // Punto 3: ~150% de Q nominal
    q_campo_150,   p_suc_150,      p_desc_150,    n_150,
  } = datosPrueba;

  // — Punto Shutoff —
  const shutoff = calcularPuntoCampo({
    q_campo: 0, p_succion: p_suc_shutoff, p_descarga: p_desc_shutoff,
    n_real: n_shutoff, n_nominal: nn_rpm
  });
  const limite_shutoff = pn_psi * 1.40;
  const shutoff_ok = shutoff.p_corr <= limite_shutoff;

  // — Punto 100% —
  const pt100 = calcularPuntoCampo({
    q_campo: q_campo_100, p_succion: p_suc_100, p_descarga: p_desc_100,
    n_real: n_100, n_nominal: nn_rpm
  });
  const cls100 = clasificarPunto(pt100.p_corr, pn_psi);

  // — Punto 150% —
  const pt150 = calcularPuntoCampo({
    q_campo: q_campo_150, p_succion: p_suc_150, p_descarga: p_desc_150,
    n_real: n_150, n_nominal: nn_rpm
  });
  const cls150 = clasificarPunto(pt150.p_corr, pn_psi * 0.65);

  // — Clasificación global: la peor de los dos puntos operativos —
  const clases_ord = CURVA_CLASIFICACIONES.map(c => c.id);
  const idx_global = Math.max(
    clases_ord.indexOf(cls100.id),
    clases_ord.indexOf(cls150.id)
  );
  const clasificacion_global = CURVA_CLASIFICACIONES[idx_global];

  // — Cumplimiento NFPA 25 —
  const cumple_nfpa = shutoff_ok && cls100.factorMin >= 0.90 && cls150.factorMin >= 0.90;

  // — Puntos de las 4 curvas de referencia para el gráfico —
  const curvas_referencia = generarPuntosGrafico(pn_psi, qn_gpm);

  return {
    shutoff:   { ...shutoff, limite: limite_shutoff, ok: shutoff_ok },
    punto100:  { ...pt100,   clasificacion: cls100 },
    punto150:  { ...pt150,   clasificacion: cls150 },
    clasificacion_global,
    cumple_nfpa,
    curvas_referencia,
    puntos_medidos: [
      { q: shutoff.q_corr, p: shutoff.p_corr, label: 'Shutoff' },
      { q: pt100.q_corr,   p: pt100.p_corr,   label: '~100% Q' },
      { q: pt150.q_corr,   p: pt150.p_corr,   label: '~150% Q' },
    ]
  };
}

/* ——— GENERA PUNTOS PARA LAS 4 CURVAS DE REFERENCIA DEL GRÁFICO ——— */
function generarPuntosGrafico(pn_psi, qn_gpm) {
  // Curva de referencia: línea entre (0, Pn) y (1.5×Qn, 0.65×Pn)
  // multiplicada por el factor de cada clasificación
  const Q_puntos = [0, qn_gpm * 0.25, qn_gpm * 0.50, qn_gpm * 0.75,
                    qn_gpm, qn_gpm * 1.25, qn_gpm * 1.50];

  function p_ref_en_q(q, factor) {
    const pendiente = (pn_psi * 0.65 - pn_psi) / (qn_gpm * 1.50);
    return (pn_psi + pendiente * q) * factor;
  }

  return CURVA_CLASIFICACIONES.map(cls => ({
    ...cls,
    puntos: Q_puntos.map(q => ({
      q,
      p: p_ref_en_q(q, cls.id === 'excellent' ? 1.05 :
                       cls.id === 'good'      ? 1.00 :
                       cls.id === 'fair'      ? 0.95 : 0.90)
    }))
  }));
}

/* ——— GENERA EL TEXTO DE CONCLUSIÓN (igual al informe de campo) ——— */
function generarConclusionTexto(resultado, datosBomba) {
  const { clasificacion_global, punto100, punto150, shutoff, cumple_nfpa } = resultado;
  const { marca, modelo, qn_gpm, pn_psi } = datosBomba;

  const labelGlobal = clasificacion_global.labelEs;

  let texto = `Realizadas las pruebas para trazar la curva de desempeño de la bomba contra incendios `;
  texto += `${marca ? marca + ' ' : ''}${modelo ? '(' + modelo + ') ' : ''}, se constatan los siguientes resultados:\n\n`;
  texto += `• Punto shutoff (Q=0): ${shutoff.p_corr.toFixed(1)} PSI `;
  texto += shutoff.ok
    ? `— dentro del límite máximo NFPA 20 (max ${shutoff.limite.toFixed(0)} PSI). OK`
    : `— SUPERA el límite máximo NFPA 20 (max ${shutoff.limite.toFixed(0)} PSI). FALLA`;
  texto += `\n\n`;
  texto += `• Punto 100%Q (${punto100.q_corr.toFixed(0)} GPM): presión neta ${punto100.p_corr.toFixed(1)} PSI `;
  texto += `— ${punto100.clasificacion.porcentaje.toFixed(1)}% de la presión nominal. Clasificación: ${punto100.clasificacion.labelEs}.\n\n`;
  texto += `• Punto 150%Q (${punto150.q_corr.toFixed(0)} GPM): presión neta ${punto150.p_corr.toFixed(1)} PSI `;
  texto += `— ${punto150.clasificacion.porcentaje.toFixed(1)}% del mínimo NFPA 20. Clasificación: ${punto150.clasificacion.labelEs}.\n\n`;
  texto += `En base a los datos obtenidos, se concluye que la bomba se encuentra en punto `;
  texto += `${labelGlobal.toUpperCase()} según lo especificado por NFPA 25.\n\n`;
  texto += cumple_nfpa
    ? `La bomba CUMPLE con los criterios de aceptación de la norma NFPA 20/25.`
    : `La bomba NO CUMPLE con los criterios de aceptación de la norma NFPA 20/25. Se recomienda acción correctiva inmediata.`;

  return texto;
}

window.CurvaDesempeno = {
  CLASIFICACIONES: CURVA_CLASIFICACIONES,
  barAPsi, psiABar, lpmAGpm, gpmALpm,
  corregirACaudalNominal,
  analizarCurvaDesempeno,
  generarPuntosGrafico,
  generarConclusionTexto,
};
