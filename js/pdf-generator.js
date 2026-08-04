/* ============================================================
   FireInspect Pro — Generador de reportes PDF
   Punto 4: Generación PDF funcional con jsPDF
   ============================================================
   Genera un PDF profesional por inspección o consolidado por
   cliente/período, incluyendo logo, checklist NFPA 25, fotos de
   defectos y firma digital del inspector.
   ============================================================ */

const COLOR_ROJO = [192, 57, 43];
const COLOR_GRIS_TEXTO = [52, 58, 64];
const COLOR_GRIS_CLARO = [233, 236, 239];
const COLOR_VERDE = [30, 132, 73];
const COLOR_AMBAR = [214, 137, 16];

function colorPorEstado(nivel) {
  if (nivel === 'ok') return COLOR_VERDE;
  if (nivel === 'warn') return COLOR_AMBAR;
  return COLOR_ROJO;
}

/* Convierte una fecha en formato ISO (AAAA-MM-DD) a formato local DD/MM/AAAA */
function formatearFechaPDF(fechaIso) {
  if (!fechaIso) return '-';
  const partes = fechaIso.split('-');
  if (partes.length !== 3) return fechaIso;
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

/* Dibuja el encabezado del documento: logo del cliente + datos de la empresa inspectora */
/* Calcula dimensiones de un logo manteniendo su proporción real */
function dimsLogo(doc, dataUrl, maxW, maxH) {
  try {
    const p = doc.getImageProperties(dataUrl);
    const r = Math.min(maxW / p.width, maxH / p.height);
    return { w: p.width * r, h: p.height * r };
  } catch (e) { return null; }
}

function formatoImagen(dataUrl) {
  return (dataUrl || '').startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
}

/* Encabezado ejecutivo sobre fondo blanco — logos sin recorte de color.
   Línea de acento roja en lugar de bloque de color sólido. */
function dibujarEncabezado(doc, { logoDataUrl, nombreCliente, empresaInspectora }) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Línea de acento superior (3mm) — sin bloque rojo
  doc.setFillColor(...COLOR_ROJO);
  doc.rect(0, 0, pageWidth, 2.5, 'F');

  // Título sobre fondo blanco
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('Reporte de inspección', 12, 12);
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Sistemas de protección contra incendios — NFPA 25', 12, 18);

  // Línea separadora
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.4);
  doc.line(12, 22, pageWidth - 12, 22);

  // — Logos sobre fondo blanco, sin recorte —
  const logoEmpresa = (typeof Estado !== 'undefined' && Estado.config?.logoEmpresa) || null;
  const logoCliente = logoDataUrl || null;

  let y = 27;
  const altoFranja = (logoEmpresa || logoCliente) ? 20 : 0;

  if (logoEmpresa) {
    const d = dimsLogo(doc, logoEmpresa, 50, 18);
    if (d) {
      try { doc.addImage(logoEmpresa, formatoImagen(logoEmpresa), 12, y, d.w, d.h); } catch (e) {}
    }
  } else {
    // sin logo: nombre de la empresa como texto
    doc.setTextColor(...COLOR_GRIS_TEXTO);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(empresaInspectora || 'FireInspect Pro', 12, y + 5);
    doc.setFont(undefined, 'normal');
  }

  if (logoCliente) {
    const d = dimsLogo(doc, logoCliente, 52, 21);
    if (d) {
      try { doc.addImage(logoCliente, formatoImagen(logoCliente), pageWidth - 12 - d.w, y, d.w, d.h); } catch (e) {}
    }
  }

  if (altoFranja) {
    // línea divisoria sutil bajo la franja de marcas
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(12, y + altoFranja + 3, pageWidth - 12, y + altoFranja + 3);
    return y + altoFranja + 9;
  }
  return 44;
}

/* Dibuja una tabla simple de datos generales (cliente, fecha, inspector, sistema) */
function dibujarDatosGenerales(doc, y, datos) {
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...COLOR_GRIS_TEXTO);
  doc.text('Datos generales', 12, y);
  y += 6;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  const filas = [
    ['Cliente',               datos.nombreCliente || '-'],
    ['Dirección',             datos.direccion || '-'],
    ['Sistema inspeccionado', datos.nombreSistema || '-'],
    ['Tipo (NFPA 25)',        datos.capitulo || '-'],
    ['Fecha de inspección',   formatearFechaPDF(datos.fecha)],
    ['Inspector responsable', datos.inspector || '-'],
    ['Tipo de visita',        datos.frecuencia ? `${datos.frecuencia}  (${datos.itemsTotal || 0} ítems aplicables)` : '-'],
  ];

  filas.forEach(([label, valor]) => {
    if (!valor || valor === '-') return;
    doc.setFont(undefined, 'bold');
    doc.text(label + ':', 12, y);
    doc.setFont(undefined, 'normal');
    doc.text(String(valor), 62, y);
    y += 5.5;
  });

  return y + 4;
}

/* Dibuja la barra/indicador de cumplimiento general de la inspección */
function dibujarCumplimiento(doc, y, cumplimiento, estado) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const anchoBarra = pageWidth - 24;

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...COLOR_GRIS_TEXTO);
  doc.text('Nivel de cumplimiento', 12, y);
  doc.setFontSize(14);
  doc.setTextColor(...colorPorEstado(estado.nivel));
  doc.text(`${cumplimiento}% — ${estado.label}`, pageWidth - 12, y, { align: 'right' });
  y += 4;

  doc.setFillColor(...COLOR_GRIS_CLARO);
  doc.roundedRect(12, y, anchoBarra, 4, 1, 1, 'F');
  doc.setFillColor(...colorPorEstado(estado.nivel));
  doc.roundedRect(12, y, anchoBarra * (cumplimiento / 100), 4, 1, 1, 'F');

  return y + 12;
}

/* Dibuja el checklist filtrado por frecuencia con referencia normativa y resultado por ítem */
function dibujarChecklist(doc, y, checklist, respuestas, etiquetaFrecuencia) {
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Título con la frecuencia de la visita
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...COLOR_GRIS_TEXTO);
  const tituloChecklist = etiquetaFrecuencia
    ? `Checklist de inspección — Visita ${etiquetaFrecuencia}`
    : 'Checklist de inspección';
  doc.text(tituloChecklist, 12, y);

  if (etiquetaFrecuencia) {
    doc.setFontSize(7.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Incluye ítems acumulados hasta frecuencia ${etiquetaFrecuencia.toLowerCase()} — ${checklist.length} punto${checklist.length !== 1 ? 's' : ''} aplicable${checklist.length !== 1 ? 's' : ''}`,
      12, y + 5
    );
    y += 11;
  } else {
    y += 7;
  }

  // Agrupa por periodicidad para separadores visuales
  let ultimaPeriodicidad = null;

  checklist.forEach((item, idx) => {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = 15;
    }

    // Separador de grupo cuando cambia la periodicidad
    if (item.periodicidad !== ultimaPeriodicidad) {
      if (ultimaPeriodicidad !== null) y += 2;
      const labelPer = item.periodicidad.charAt(0).toUpperCase() + item.periodicidad.slice(1);
      // Separador sin relleno — solo línea y texto
      doc.setDrawColor(200, 205, 215); doc.setLineWidth(0.25);
      doc.line(10, y - 1, pageWidth - 10, y - 1);
      doc.setFontSize(7); doc.setFont(undefined, 'bold'); doc.setTextColor(120, 130, 145);
      doc.text(`▸  Ítems de frecuencia ${labelPer}`, 13, y + 2.5);
      doc.setTextColor(...COLOR_GRIS_TEXTO);
      y += 7;
      ultimaPeriodicidad = item.periodicidad;
    }

    if (y > pageHeight - 25) { doc.addPage(); y = 15; }

    const respuesta   = respuestas[item.id];
    const esConforme  = respuesta === true || respuesta === 'ok';
    const esNA        = respuesta === 'na';
    const colorEstado = esNA ? [150, 150, 150] : (esConforme ? COLOR_VERDE : COLOR_ROJO);
    const textoEstado = esNA ? 'N/A' : (esConforme ? 'OK' : 'NC');

    if (idx % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(10, y - 4, pageWidth - 20, 8, 'F');
    }

    doc.setFillColor(...colorEstado);
    doc.roundedRect(12, y - 3.5, 10, 5.5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text(textoEstado, 17, y, { align: 'center' });

    // Badge de categoría IPM
    const catColor = item.categoria === 'I' ? [26,82,118] : item.categoria === 'P' ? [108,52,131] : [17,120,100];
    doc.setFillColor(...catColor);
    doc.roundedRect(24, y - 3.5, 6, 5.5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.text(item.categoria || '', 27, y, { align: 'center' });

    doc.setTextColor(...COLOR_GRIS_TEXTO);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    const textoItem = `${item.ref}  ${item.texto}`;
    const lineas    = doc.splitTextToSize(textoItem, pageWidth - 44);
    doc.text(lineas, 33, y);
    y += Math.max(6, lineas.length * 4.2);
  });

  return y + 4;
}

/* Dibuja las observaciones generales de la inspección */
function dibujarObservaciones(doc, y, observaciones) {
  if (!observaciones) return y;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  if (y > pageHeight - 40) { doc.addPage(); y = 15; }

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...COLOR_GRIS_TEXTO);
  doc.text('Observaciones', 12, y);
  y += 6;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  const lineas = doc.splitTextToSize(observaciones, pageWidth - 24);
  doc.text(lineas, 12, y);
  return y + lineas.length * 4.5 + 4;
}

/* Inserta las fotos de defectos en grilla de 2 columnas */
function dibujarFotos(doc, y, fotos) {
  if (!fotos || fotos.length === 0) return y;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const anchoFoto = (pageWidth - 24 - 6) / 2;
  const altoFoto = anchoFoto * 0.75;

  if (y > pageHeight - altoFoto - 20) { doc.addPage(); y = 15; }

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...COLOR_GRIS_TEXTO);
  doc.text('Registro fotográfico', 12, y);
  y += 6;

  let col = 0;
  fotos.forEach((foto) => {
    if (y > pageHeight - altoFoto - 15) { doc.addPage(); y = 15; }
    const x = 12 + col * (anchoFoto + 6);
    try {
      doc.addImage(foto.dataUrl, 'JPEG', x, y, anchoFoto, altoFoto);
      doc.setDrawColor(...COLOR_GRIS_CLARO);
      doc.rect(x, y, anchoFoto, altoFoto);
      if (foto.descripcion) {
        doc.setFontSize(7);
        doc.setTextColor(...COLOR_GRIS_TEXTO);
        doc.text(foto.descripcion, x, y + altoFoto + 3.5);
      }
    } catch (e) {
      // imagen inválida, se omite
    }
    col++;
    if (col === 2) { col = 0; y += altoFoto + 8; }
  });
  if (col === 1) y += altoFoto + 8;

  return y + 4;
}

/* Dibuja el bloque de firma digital al final del documento.
   Si la inspección no tiene firma manual capturada, usa la firma
   predeterminada del inspector configurada en Ajustes (imagen con
   fondo blanco), de forma automática en todos los reportes. */
function dibujarFirma(doc, y, firmaDataUrl, nombreInspector) {
  const pageHeight = doc.internal.pageSize.getHeight();
  // La imagen de la firma se dibuja 22mm por encima de la línea, así que
  // se necesita ese margen adicional para no pisar el contenido anterior
  y += 24;
  if (y > pageHeight - 45) { doc.addPage(); y = 38; }

  y += 8;
  doc.setDrawColor(...COLOR_GRIS_CLARO);
  doc.line(12, y, 70, y);
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_GRIS_TEXTO);

  const firmaFinal = firmaDataUrl
    || (typeof Estado !== 'undefined' && Estado.config?.firmaPredeterminada)
    || null;

  if (firmaFinal) {
    try {
      doc.addImage(firmaFinal, 'PNG', 12, y - 22, 50, 20);
    } catch (e) { /* firma inválida, se omite */ }
  }

  doc.text('Firma del inspector', 12, y + 5);
  doc.setFont(undefined, 'bold');
  doc.text(nombreInspector || (typeof Estado !== 'undefined' ? Estado.config?.inspector : '') || '', 12, y + 10);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Documento generado por FireInspect Pro — ${new Date().toLocaleDateString('es-AR')}`, 12, y + 16);

  return y + 20;
}

/* ============================================================
   Función principal: genera el PDF de UNA inspección puntual
   ============================================================ */
async function generarPDFInspeccion(inspeccion, opciones = {}) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const modeloSistema = NFPA25.MODELO[inspeccion.tipoSistema];
  const cliente = await FireDB.get(FireDB.STORES.CLIENTES, inspeccion.clienteId);
  const sistema = inspeccion.sistemaId ? await FireDB.get(FireDB.STORES.SISTEMAS, inspeccion.sistemaId) : null;

  // ── FILTRAR checklist por la frecuencia de la visita ──────────────
  // Una visita semanal solo muestra ítems semanales.
  // Una visita trimestral muestra semanal + mensual + trimestral. Etc.
  const frecuenciaVisita   = inspeccion.frecuencia || 'anual';
  const nivelVisita        = NFPA25.nivelFrecuencia(frecuenciaVisita);
  const checklistFiltrado  = modeloSistema.checklist.filter(
    item => NFPA25.nivelFrecuencia(item.periodicidad) <= nivelVisita
  );
  const etiquetaFrecuencia = NFPA25.etiquetaFrecuencia(frecuenciaVisita);
  // ──────────────────────────────────────────────────────────────────

  const cumplimiento = inspeccion.cumplimiento ?? NFPA25.calcularCumplimiento(checklistFiltrado, inspeccion.respuestas);
  const estado = NFPA25.estadoPorCumplimiento(cumplimiento);

  let y = dibujarEncabezado(doc, {
    logoDataUrl: opciones.incluirLogo ? cliente?.logoDataUrl : null,
    nombreCliente: cliente?.nombre,
    empresaInspectora: opciones.empresaInspectora
  });

  y = dibujarDatosGenerales(doc, y, {
    nombreCliente:  cliente?.nombre,
    direccion:      cliente?.direccion,
    nombreSistema:  sistema?.nombre || modeloSistema.nombre,
    capitulo:       modeloSistema.capitulo,
    fecha:          inspeccion.fecha,
    inspector:      inspeccion.inspector,
    frecuencia:     etiquetaFrecuencia,
    itemsTotal:     checklistFiltrado.length,
  });

  y = dibujarCumplimiento(doc, y, cumplimiento, estado);
  y = dibujarChecklist(doc, y, checklistFiltrado, inspeccion.respuestas, etiquetaFrecuencia);
  y = dibujarObservaciones(doc, y, inspeccion.observaciones);

  if (opciones.incluirFotos && inspeccion.fotos?.length) {
    y = dibujarFotos(doc, y, inspeccion.fotos);
  }

  if (opciones.incluirFirma) {
    y = dibujarFirma(doc, y, inspeccion.firmaDataUrl, inspeccion.inspector);
  }

  return doc;
}

/* ============================================================
   Función: genera un PDF consolidado de varias inspecciones
   (reporte por cliente y período)
   ============================================================ */
async function generarPDFConsolidado(clienteId, inspecciones, opciones = {}) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cliente = await FireDB.get(FireDB.STORES.CLIENTES, clienteId);
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = dibujarEncabezado(doc, {
    logoDataUrl: opciones.incluirLogo ? cliente?.logoDataUrl : null,
    nombreCliente: cliente?.nombre,
    empresaInspectora: opciones.empresaInspectora
  });

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...COLOR_GRIS_TEXTO);
  doc.text(`Reporte consolidado — ${cliente?.nombre || ''}`, 12, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Período: ${opciones.periodoLabel || 'Todas las inspecciones'} · Total: ${inspecciones.length} inspecciones`, 12, y);
  y += 10;

  const promedioGeneral = inspecciones.length
    ? Math.round(inspecciones.reduce((a, i) => a + (i.cumplimiento || 0), 0) / inspecciones.length)
    : 100;
  const estadoGeneral = NFPA25.estadoPorCumplimiento(promedioGeneral);
  y = dibujarCumplimiento(doc, y, promedioGeneral, estadoGeneral);

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text('Detalle de inspecciones', 12, y);
  y += 7;

  inspecciones.forEach((insp, idx) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y > pageHeight - 20) { doc.addPage(); y = 15; }

    const modeloSistema = NFPA25.MODELO[insp.tipoSistema];
    const est = NFPA25.estadoPorCumplimiento(insp.cumplimiento || 0);

    if (idx % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(10, y - 4, pageWidth - 20, 8, 'F');
    }

    doc.setFontSize(8.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...COLOR_GRIS_TEXTO);
    doc.text(formatearFechaPDF(insp.fecha), 12, y);
    doc.text(modeloSistema?.nombre || insp.tipoSistema, 38, y);
    doc.setTextColor(...colorPorEstado(est.nivel));
    doc.setFont(undefined, 'bold');
    doc.text(`${insp.cumplimiento || 0}% ${est.label}`, pageWidth - 12, y, { align: 'right' });
    y += 7;
  });

  if (opciones.incluirFirma) {
    dibujarFirma(doc, y, opciones.firmaDataUrl, opciones.inspector);
  }

  return doc;
}

/* Descarga el PDF generado con un nombre de archivo descriptivo */
function descargarPDF(doc, nombreArchivo) {
  doc.save(nombreArchivo);
}

window.ReportesPDF = {
  generarInspeccion: generarPDFInspeccion,
  generarConsolidado: generarPDFConsolidado,
  descargar: descargarPDF
};
