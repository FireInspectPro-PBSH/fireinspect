/* ═══════════════════════════════════════════════════════════════════
   INFORME CONSOLIDADO POR CLIENTE  — ui-informe-consolidado.js
   Diseño: fondo blanco, líneas finas, acento rojo solo en texto/líneas
   Sin rellenos de color en zonas grandes — apto para impresión
═══════════════════════════════════════════════════════════════════ */

/* ── Render de la pantalla de selección ── */
async function icRenderPantalla() {
  const cont = document.getElementById('ic-contenido');
  if (!cont) return;

  const clientes = (await FireDB.getAll(FireDB.STORES.CLIENTES))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const hoy   = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const hasta = hoy.toISOString().split('T')[0];

  cont.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
      <button class="btn btn-secundario btn-sm" onclick="UI.irA('dashboard')">
        <i class="ti ti-arrow-left" aria-hidden="true"></i>
      </button>
      <div>
        <h2 style="font-size:17px;font-weight:700;margin:0;">Informe consolidado</h2>
        <p style="font-size:11.5px;color:var(--gris-500);margin:2px 0 0;">Todas las actividades de un cliente en un período</p>
      </div>
    </div>

    <div class="card">
      <div class="card-titulo"><i class="ti ti-building" aria-hidden="true"></i>Cliente</div>
      <select id="ic-cliente" style="width:100%;">
        <option value="">— Seleccioná un cliente —</option>
        ${clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
      </select>
    </div>

    <div class="card">
      <div class="card-titulo"><i class="ti ti-calendar-range" aria-hidden="true"></i>Período</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px;">
        <div class="campo"><label>Desde</label><input type="date" id="ic-desde" value="${desde}"></div>
        <div class="campo"><label>Hasta</label><input type="date" id="ic-hasta" value="${hasta}"></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${[['Este mes','mes'],['Últ. 3 meses','trim'],['Últ. 6 meses','sem'],['Este año','anio']]
          .map(([l,id]) => `<button class="btn btn-secundario btn-sm" onclick="IC.atajo('${id}')">${l}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-titulo"><i class="ti ti-settings" aria-hidden="true"></i>Opciones</div>
      ${[
        ['ic-checklist','Incluir detalle del checklist por inspección',true],
        ['ic-planes',   'Incluir planes de acción del período',true],
        ['ic-firma',    'Incluir firma del inspector',true],
      ].map(([id,lbl,chk]) => `
        <label style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:10px;cursor:pointer;">
          <input type="checkbox" id="${id}" ${chk?'checked':''} style="width:16px;height:16px;">
          ${lbl}
        </label>`).join('')}
    </div>

    <div id="ic-preview" style="display:none;" class="card">
      <div class="card-titulo"><i class="ti ti-eye" aria-hidden="true"></i>Vista previa</div>
      <div id="ic-preview-cont"></div>
    </div>

    <button class="btn btn-secundario btn-block" style="margin-bottom:10px;" onclick="IC.previsualizar()">
      <i class="ti ti-search" aria-hidden="true"></i> Ver resumen del período
    </button>
    <button class="btn btn-primary btn-block" style="margin-bottom:28px;" onclick="IC.generar()">
      <i class="ti ti-file-analytics" aria-hidden="true"></i> Generar informe PDF
    </button>
  `;
}

/* ── Atajos de fecha ── */
function icAtajo(tipo) {
  const hoy  = new Date();
  const hasta = hoy.toISOString().split('T')[0];
  let desde;
  if (tipo==='mes')  desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  if (tipo==='trim') { const d=new Date(hoy); d.setMonth(d.getMonth()-3); desde=d.toISOString().split('T')[0]; }
  if (tipo==='sem')  { const d=new Date(hoy); d.setMonth(d.getMonth()-6); desde=d.toISOString().split('T')[0]; }
  if (tipo==='anio') desde = `${hoy.getFullYear()}-01-01`;
  document.getElementById('ic-desde').value = desde;
  document.getElementById('ic-hasta').value = hasta;
}

/* ── Recopilar datos del período ── */
async function icDatos() {
  const clienteId = document.getElementById('ic-cliente')?.value;
  const desde     = document.getElementById('ic-desde')?.value;
  const hasta     = document.getElementById('ic-hasta')?.value;
  if (!clienteId) { mostrarToast('Seleccioná un cliente', 'error'); return null; }
  if (!desde||!hasta||desde>hasta) { mostrarToast('Verificá el rango de fechas', 'error'); return null; }

  const cliente = await FireDB.get(FireDB.STORES.CLIENTES, clienteId);
  const todas   = await FireDB.getByIndex(FireDB.STORES.INSPECCIONES, 'clienteId', clienteId);
  const inspecciones = todas.filter(i => i.fecha >= desde && i.fecha <= hasta)
                            .sort((a,b) => a.fecha.localeCompare(b.fecha));
  const todosPlanes  = await FireDB.getAll(FireDB.STORES.PLANES_ACCION);
  const planes = todosPlanes.filter(p => p.clienteId === clienteId);
  return { cliente, inspecciones, planes, desde, hasta };
}

/* ── Vista previa ── */
async function icPrevisualizar() {
  const datos = await icDatos(); if (!datos) return;
  const { cliente, inspecciones, planes, desde, hasta } = datos;
  document.getElementById('ic-preview').style.display = 'block';
  const cont = document.getElementById('ic-preview-cont');
  if (!inspecciones.length) {
    cont.innerHTML = `<p style="font-size:13px;color:var(--gris-500);">Sin inspecciones en ese período para ${cliente.nombre}.</p>`;
    return;
  }
  const cum = Math.round(inspecciones.reduce((s,i)=>s+(i.cumplimiento||0),0)/inspecciones.length);
  const fmtC = f => f?new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}):'';
  const porSist = {};
  inspecciones.forEach(i=>{const k=i.tipoSistema||'otro';if(!porSist[k])porSist[k]=[];porSist[k].push(i);});
  cont.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
      ${[
        [inspecciones.length,'Inspecciones','var(--rojo)'],
        [`${cum}%`,'Cumplimiento global', cum>=85?'#27AE60':cum>=60?'#E67E22':'#E74C3C'],
        [planes.filter(p=>p.estado==='pendiente'||p.estado==='vencido').length,'Planes activos','#E67E22'],
      ].map(([v,l,c])=>`<div style="text-align:center;border:1px solid var(--gris-200);border-radius:10px;padding:10px;">
        <div style="font-size:20px;font-weight:800;color:${c};">${v}</div>
        <div style="font-size:10px;color:var(--gris-500);margin-top:2px;">${l}</div>
      </div>`).join('')}
    </div>
    ${Object.entries(porSist).map(([s,items])=>{
      const m=NFPA25.MODELO[s]||{nombre:s,icono:'clipboard',color:'#888'};
      const c=Math.round(items.reduce((sum,i)=>sum+(i.cumplimiento||0),0)/items.length);
      return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--gris-100);">
        <i class="ti ti-${m.icono}" style="color:${m.color};font-size:16px;flex-shrink:0;"></i>
        <span style="flex:1;font-size:13px;">${m.nombre} <span style="color:var(--gris-400);">(${items.length} visita${items.length!==1?'s':''})</span></span>
        <span style="font-weight:700;font-size:13px;color:${c>=85?'#27AE60':c>=60?'#E67E22':'#E74C3C'};">${c}%</span>
      </div>`;
    }).join('')}
    <p style="font-size:11px;color:var(--gris-400);margin-top:8px;">${fmtC(desde)} — ${fmtC(hasta)}</p>`;
}

/* ══════════════════════════════════════════════════════════════════
   GENERADOR PDF — Diseño institucional, fondo blanco, imprimible
══════════════════════════════════════════════════════════════════ */
async function icGenerarPDF() {
  const datos = await icDatos(); if (!datos) return;
  const { cliente, inspecciones, planes, desde, hasta } = datos;
  if (!inspecciones.length) { mostrarToast('Sin inspecciones en ese período', 'error'); return; }

  mostrarToast('Generando informe...');

  const inclChecklist = document.getElementById('ic-checklist')?.checked ?? true;
  const inclPlanes    = document.getElementById('ic-planes')?.checked    ?? true;
  const inclFirma     = document.getElementById('ic-firma')?.checked     ?? true;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();

  const logoEmp = Estado.config?.logoEmpresa  || null;
  const logoCli = cliente?.logoDataUrl         || null;

  const fmtL = f => f ? new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'}) : '';
  const fmtC = f => f ? new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';

  // Código único
  const ym  = desde.replace(/-/g,'').substring(0,6);
  const tag = (cliente.nombre||'CLI').toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,8);
  const seq = String(Math.floor(Math.random()*900)+100);
  const codigo = `ICP-${ym}-${tag}-${seq}`;

  const cumGlobal = Math.round(inspecciones.reduce((s,i)=>s+(i.cumplimiento||0),0)/inspecciones.length);
  const porSist   = {};
  inspecciones.forEach(i=>{const k=i.tipoSistema||'otro';if(!porSist[k])porSist[k]=[];porSist[k].push(i);});

  /* ── helpers imagen ── */
  function dimImg(url, maxW, maxH) {
    try { const p=doc.getImageProperties(url); const r=Math.min(maxW/p.width,maxH/p.height); return {w:p.width*r,h:p.height*r}; }
    catch(e){ return null; }
  }
  function fmtImg(u){ return (u||'').startsWith('data:image/jpeg')?'JPEG':'PNG'; }
  function addImg(url, x, y, maxW, maxH) {
    if (!url) return;
    const d = dimImg(url, maxW, maxH);
    if (d) try { doc.addImage(url, fmtImg(url), x, y, d.w, d.h); } catch(e){}
  }
  function hexRgb(hex){ const r=parseInt((hex||'#888').slice(1,3),16)||136; const g=parseInt((hex||'#888').slice(3,5),16)||136; const b=parseInt((hex||'#888').slice(5,7),16)||136; return [r,g,b]; }

  /* ── Layout ── */
  let pag = 1;
  const MARGEN_INF = ph - 16;
  const ROJO = [176, 58, 46];

  /* Encabezado institucional — tabla 3 filas */
  function encabezado(nHoja, total) {
    const H1=15, H2=8, H3=7;
    doc.setDrawColor(180,180,180); doc.setLineWidth(0.3);

    // Fila 1
    doc.rect(8, 5, pw-16, H1, 'S');
    doc.line(8+40, 5, 8+40, 5+H1);
    doc.line(pw-8-40, 5, pw-8-40, 5+H1);
    // Logo empresa — sobre fondo blanco, sin recorte
    if (logoEmp) addImg(logoEmp, 10, 6.5, 36, 11);
    else { doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(...ROJO); doc.text(Estado.config?.empresa||'PBSH', 10+20, 5+H1/2+1.5,{align:'center'}); }
    // Centro
    doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
    doc.text('INFORME TÉCNICO', pw/2, 5+H1/2+1.5, {align:'center'});
    // Logo cliente — sobre fondo blanco
    if (logoCli) addImg(logoCli, pw-8-38, 6.5, 36, 11);
    else { doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80); doc.text(codigo, pw-8-20, 5+H1/2+1.5,{align:'center'}); }

    // Fila 2
    doc.rect(8, 5+H1, pw-16, H2, 'S');
    doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
    doc.text('INFORME CONSOLIDADO DE INSPECCIONES — PROTECCIÓN CONTRA INCENDIO', pw/2, 5+H1+H2/2+1.5, {align:'center'});

    // Fila 3
    doc.rect(8, 5+H1+H2, pw-16, H3, 'S');
    const tw=(pw-16)/3;
    doc.line(8+tw, 5+H1+H2, 8+tw, 5+H1+H2+H3);
    doc.line(8+tw*2, 5+H1+H2, 8+tw*2, 5+H1+H2+H3);
    const fy = 5+H1+H2+H3/2+1.5;
    doc.setFontSize(6.5); doc.setFont(undefined,'normal'); doc.setTextColor(40,40,40);
    doc.text(cliente?.nombre||'', 8+tw/2, fy, {align:'center',maxWidth:tw-4});
    doc.text(`${fmtC(desde)} — ${fmtC(hasta)}`, 8+tw+tw/2, fy, {align:'center',maxWidth:tw-4});
    doc.setFont(undefined,'bold');
    doc.text(`HOJA: ${nHoja}   DE: ${total}`, 8+tw*2+tw/2, fy, {align:'center'});
    doc.setTextColor(20,20,20);
    return 5+H1+H2+H3+7; // y inicio contenido
  }

  /* Pie de revisión */
  function pie(nHoja, total) {
    const pieH=7;
    doc.setDrawColor(180,180,180); doc.setLineWidth(0.25);
    doc.rect(8, ph-pieH-3, pw-16, pieH, 'S');
    const tw=(pw-16)/3;
    doc.line(8+tw, ph-pieH-3, 8+tw, ph-3);
    doc.line(8+tw*2, ph-pieH-3, 8+tw*2, ph-3);
    const py=ph-pieH-3+pieH/2+1.5;
    doc.setFontSize(6.5); doc.setFont(undefined,'normal'); doc.setTextColor(100,100,100);
    doc.text('REVISIÓN:  00', 8+tw/2, py, {align:'center'});
    doc.setFont(undefined,'bold'); doc.text(codigo, 8+tw+tw/2, py, {align:'center'});
    doc.setFont(undefined,'normal'); doc.text(`FECHA:  ${fmtC(hasta)}`, 8+tw*2+tw/2, py, {align:'center'});
  }

  function salto(y, h) {
    if (y+h > MARGEN_INF) { pie(pag,'?'); doc.addPage(); pag++; return encabezado(pag,'?'); }
    return y;
  }

  /* Título de sección — línea roja izquierda + texto, SIN relleno */
  function seccion(titulo, y) {
    y = salto(y, 12);
    doc.setDrawColor(...ROJO); doc.setLineWidth(1.2);
    doc.line(8, y+2, 8, y+9);
    doc.setLineWidth(0.3); doc.setDrawColor(220,220,220);
    doc.line(13, y+5.5, pw-8, y+5.5);
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...ROJO);
    doc.text(titulo, 12, y+8);
    doc.setTextColor(20,20,20);
    return y+14;
  }

  /* Fila de dato label: valor */
  function dato(lbl, val, x, y, wLbl) {
    if (!val) return y;
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(120,130,140);
    doc.text(lbl+':', x, y);
    doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
    doc.text(String(val), x+wLbl, y, {maxWidth: pw/2-wLbl-10});
    return y;
  }

  /* ══════════════════════════════════════════════════════
     CARÁTULA — Página 1, diseño limpio sobre blanco
  ══════════════════════════════════════════════════════ */

  // Línea de acento rojo superior (fina)
  doc.setFillColor(...ROJO); doc.rect(0, 0, pw, 3, 'F');

  // Logos — sobre fondo blanco, sin recorte de color
  if (logoEmp) addImg(logoEmp, 14, 10, 52, 22);
  else { doc.setFontSize(14); doc.setFont(undefined,'bold'); doc.setTextColor(...ROJO); doc.text(Estado.config?.empresa||'PBSH', 14, 24); }
  if (logoCli) addImg(logoCli, pw-14-52, 10, 52, 22);

  // Línea separadora bajo logos
  doc.setDrawColor(220,220,220); doc.setLineWidth(0.4);
  doc.line(14, 36, pw-14, 36);

  // Título principal — solo tipografía, sin fondo de color
  doc.setFontSize(24); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
  doc.text('INFORME CONSOLIDADO', pw/2, 68, {align:'center'});
  doc.setFontSize(13); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80);
  doc.text('PROTECCIÓN CONTRA INCENDIO', pw/2, 79, {align:'center'});

  // Línea decorativa roja bajo título
  doc.setFillColor(...ROJO); doc.rect(pw/2-30, 84, 60, 1.2, 'F');

  doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(100,100,100);
  doc.text('NFPA 20 / NFPA 25 — Inspección, Prueba y Mantenimiento', pw/2, 92, {align:'center'});

  // Código — en texto pequeño, sin badge de color
  doc.setFontSize(8); doc.setTextColor(120,120,120);
  doc.text(`Código: ${codigo}`, pw/2, 99, {align:'center'});

  // Línea separadora
  doc.setDrawColor(220,220,220); doc.setLineWidth(0.4);
  doc.line(14, 104, pw-14, 104);

  // Ficha de identificación — texto puro, sin rellenos de color
  const fichaY = 112;
  const col2x  = pw/2 + 4;
  [
    [14,  [['CLIENTE',       cliente.nombre||''],  ['PERÍODO', `${fmtL(desde)} — ${fmtL(hasta)}`]]],
    [124, [['DIRECCIÓN',     cliente.direccion||''],['INSPECTOR', Estado.config?.inspector||'']]],
    [136, [['EMPRESA',       Estado.config?.empresa||''], ['NORMAS', 'NFPA 20 / NFPA 25']]],
  ].forEach(([y2, pares], ri) => {
    if (ri > 0) { doc.setDrawColor(235,235,235); doc.setLineWidth(0.3); doc.line(14, y2-4, pw-14, y2-4); }
    pares.forEach(([lbl,val], ci) => {
      const x = ci===0 ? 14 : col2x;
      doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(140,150,160);
      doc.text(lbl, x, y2);
      doc.setFontSize(9.5); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
      doc.text(String(val||''), x, y2+6, {maxWidth:pw/2-18});
    });
  });

  // Línea antes de KPIs
  doc.setDrawColor(220,220,220); doc.setLineWidth(0.4);
  doc.line(14, 154, pw-14, 154);

  // KPIs — en cajas con borde fino, SIN relleno de color
  const kpiItems = [
    { val: String(inspecciones.length),    lbl:'Inspecciones\nrealizadas',   acento:ROJO },
    { val: `${cumGlobal}%`,                lbl:'Cumplimiento\nglobal',       acento: cumGlobal>=85?[39,174,96]:cumGlobal>=60?[211,84,0]:[192,57,43] },
    { val: String(planes.filter(p=>p.estado==='pendiente'||p.estado==='vencido').length), lbl:'Planes de acción\npendientes', acento:[211,84,0] },
    { val: String(Object.keys(porSist).length), lbl:'Sistemas\ninspeccionados', acento:[52,110,180] },
  ];
  const kpiW = (pw-32)/4;
  kpiItems.forEach((k, ki) => {
    const kx = 8 + ki*(kpiW+5);
    const ky = 160;
    doc.setDrawColor(...k.acento); doc.setLineWidth(0.5);
    doc.rect(kx, ky, kpiW, 24, 'S');
    // Línea superior de acento (3px)
    doc.setFillColor(...k.acento); doc.rect(kx, ky, kpiW, 2.5, 'F');
    doc.setFontSize(18); doc.setFont(undefined,'bold'); doc.setTextColor(...k.acento);
    doc.text(k.val, kx+kpiW/2, ky+14, {align:'center'});
    doc.setFontSize(6); doc.setFont(undefined,'normal'); doc.setTextColor(100,100,100);
    k.lbl.split('\n').forEach((l,li) => doc.text(l, kx+kpiW/2, ky+18+li*3.5, {align:'center'}));
  });

  // Tabla resumen por sistema
  doc.setDrawColor(220,220,220); doc.setLineWidth(0.3);
  doc.line(14, 193, pw-14, 193);
  doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(...ROJO);
  doc.text('RESUMEN POR SISTEMA', 14, 200);

  const sHdr = ['Sistema','Visitas','% Cumplimiento','Estado'];
  const sColW = [70, 20, 40, pw-16-70-20-40];
  const sColX = [8]; sColW.forEach((w,i)=>sColX.push(sColX[i]+w));
  const sRowH = 7; let sY = 204;

  // Header con solo borde y texto oscuro — sin relleno
  doc.setDrawColor(60,60,60); doc.setLineWidth(0.4); doc.rect(8, sY, pw-16, sRowH, 'S');
  sHdr.forEach((h,hi) => { doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20); doc.text(h, sColX[hi]+2, sY+sRowH/2+1.5); });
  sY += sRowH;

  Object.entries(porSist).forEach(([sis,items],ri) => {
    const m = NFPA25.MODELO[sis]||{nombre:sis};
    const c = Math.round(items.reduce((s,i)=>s+(i.cumplimiento||0),0)/items.length);
    const e = NFPA25.estadoPorCumplimiento(c);
    doc.setDrawColor(200,200,200); doc.setLineWidth(0.2); doc.rect(8, sY, pw-16, sRowH, 'S');
    [m.nombre, String(items.length), `${c}%`, e.texto].forEach((v,vi) => {
      doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
      doc.text(v, sColX[vi]+2, sY+sRowH/2+1.5, {maxWidth:sColW[vi]-4});
    });
    sY += sRowH;
  });

  // Pie carátula (sin número de hoja — es página 1)
  doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(140,140,140);
  doc.text(`Documento generado por FireInspect Pro · ${codigo}`, pw/2, ph-8, {align:'center'});

  /* ══════════════════════════════════════════════════════
     PÁGINA 2+: CONTENIDO
  ══════════════════════════════════════════════════════ */
  pie(1,'?');
  doc.addPage(); pag++;
  let y = encabezado(pag,'?');

  /* 1. OBJETIVO */
  y = seccion('1. Objetivo y alcance', y);
  const txtObj = `El presente informe consolida los resultados de las actividades de inspección, prueba y mantenimiento (IPM) realizadas al sistema de protección contra incendios de ${cliente.nombre||''}, durante el período comprendido entre el ${fmtL(desde)} y el ${fmtL(hasta)}. Se incluyen los resultados individuales de cada visita ejecutada, el porcentaje de cumplimiento por sistema y el estado de los planes de acción derivados de las no conformidades identificadas, conforme a los requisitos de la norma NFPA 25.`;
  const linObj = doc.splitTextToSize(txtObj, pw-20);
  y = salto(y, linObj.length*4.5+4);
  doc.setFontSize(8.5); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
  doc.text(linObj, 10, y); y += linObj.length*4.5+8;

  /* 2. RESUMEN EJECUTIVO */
  y = seccion('2. Resumen ejecutivo del período', y);

  // Tabla resumen
  const rHdr = ['Sistema','Visitas','Frecuencias','% Cumpl.','No conformidades'];
  const rColW = [52,16,44,20,pw-16-52-16-44-20];
  const rColX = [8]; rColW.forEach((w,i)=>rColX.push(rColX[i]+w));
  const rRowH = 6.5;
  y = salto(y, rRowH*(Object.keys(porSist).length+2));

  doc.setDrawColor(60,60,60); doc.setLineWidth(0.4); doc.rect(8,y,pw-16,rRowH,'S');
  rHdr.forEach((h,hi)=>{ doc.setFontSize(7);doc.setFont(undefined,'bold');doc.setTextColor(20,20,20);doc.text(h,rColX[hi]+2,y+rRowH/2+1.5); });
  y += rRowH;

  Object.entries(porSist).forEach(([sis,items],ri)=>{
    const m = NFPA25.MODELO[sis]||{nombre:sis};
    const c = Math.round(items.reduce((s,i)=>s+(i.cumplimiento||0),0)/items.length);
    const freqs = [...new Set(items.map(i=>NFPA25.etiquetaFrecuencia(i.frecuencia)||''))].join(', ');
    const nc = items.reduce((s,i)=>{
      const nivel=NFPA25.nivelFrecuencia(i.frecuencia||'anual');
      const cl=(m.checklist||[]).filter(it=>NFPA25.nivelFrecuencia(it.periodicidad)<=nivel);
      return s+cl.filter(it=>i.respuestas?.[it.id]==='nc'||i.respuestas?.[it.id]===false).length;
    },0);
    doc.setDrawColor(200,200,200);doc.setLineWidth(0.2);doc.rect(8,y,pw-16,rRowH,'S');
    [m.nombre,String(items.length),freqs,`${c}%`,String(nc)].forEach((v,vi)=>{
      doc.setFontSize(7.5);doc.setFont(undefined,'normal');doc.setTextColor(20,20,20);
      doc.text(v,rColX[vi]+2,y+rRowH/2+1.5,{maxWidth:rColW[vi]-4});
    });
    y += rRowH;
  });
  // Fila total
  doc.setDrawColor(60,60,60);doc.setLineWidth(0.4);doc.rect(8,y,pw-16,rRowH,'S');
  doc.setFontSize(7.5);doc.setFont(undefined,'bold');doc.setTextColor(20,20,20);
  doc.text('TOTAL / PROMEDIO GLOBAL',rColX[0]+2,y+rRowH/2+1.5);
  doc.text(String(inspecciones.length),rColX[1]+2,y+rRowH/2+1.5);
  doc.text(`${cumGlobal}%`,rColX[3]+2,y+rRowH/2+1.5);
  y += rRowH+8;

  /* 3. DETALLE POR INSPECCIÓN */
  y = seccion('3. Detalle de inspecciones realizadas', y);

  for (const [idx, insp] of inspecciones.entries()) {
    const m    = NFPA25.MODELO[insp.tipoSistema]||{nombre:insp.tipoSistema||'Sistema',icono:'clipboard',color:'#888888',checklist:[]};
    const est  = NFPA25.estadoPorCumplimiento(insp.cumplimiento||0);
    const frec = NFPA25.etiquetaFrecuencia(insp.frecuencia||'');
    const niv  = NFPA25.nivelFrecuencia(insp.frecuencia||'anual');
    const clFilt = (m.checklist||[]).filter(it=>NFPA25.nivelFrecuencia(it.periodicidad)<=niv);
    const ncIt   = clFilt.filter(it=>insp.respuestas?.[it.id]==='nc'||insp.respuestas?.[it.id]===false);
    const okIt   = clFilt.filter(it=>insp.respuestas?.[it.id]===true||insp.respuestas?.[it.id]==='ok');

    y = salto(y, 28);

    // Subencabezado inspección — borde fino + línea de acento de color del sistema
    const [mr,mg,mb] = hexRgb(m.color||'#888888');
    doc.setDrawColor(mr,mg,mb); doc.setLineWidth(1.5); doc.line(8, y+1, 8, y+12);
    doc.setDrawColor(210,215,220); doc.setLineWidth(0.3); doc.rect(11, y-1, pw-19, 14, 'S');
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
    doc.text(`${idx+1}.  ${m.nombre}${insp.equipoTag?' · '+insp.equipoTag:''}`, 15, y+6);
    doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(90,90,90);
    doc.text(`${fmtC(insp.fecha)}   ·   Visita ${frec}   ·   Inspector: ${insp.inspector||''}`, 15, y+11);
    // % cumplimiento — solo texto, sin badge de fondo
    const [cr,cg,cb] = est.nivel==='ok'?[39,174,96]:est.nivel==='warn'?[211,84,0]:[192,57,43];
    doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.setTextColor(cr,cg,cb);
    doc.text(`${insp.cumplimiento||0}%`, pw-14, y+9, {align:'right'});
    y += 18;

    // Stats
    y = salto(y, 6);
    doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80);
    doc.text(`Ítems evaluados: ${clFilt.length}   ·   Conformes: ${okIt.length}   ·   No conformes: ${ncIt.length}`, 12, y);
    y += 6;

    // No conformidades
    if (ncIt.length > 0) {
      y = salto(y, 8+ncIt.length*5);
      doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(192,57,43);
      doc.text('No conformidades:', 12, y); y += 5;
      ncIt.forEach(it => {
        y = salto(y, 5);
        const lin = doc.splitTextToSize(`• [${it.ref}]  ${it.texto}`, pw-26);
        doc.setFont(undefined,'normal'); doc.setTextColor(40,40,40); doc.setFontSize(7.5);
        doc.text(lin, 14, y, {maxWidth:pw-26}); y += lin.length*4.5;
      });
      y += 2;
    }

    // Checklist completo
    if (inclChecklist && clFilt.length > 0) {
      y = salto(y, 10);
      doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(100,110,120);
      doc.text('Checklist completo:', 12, y); y += 5;
      clFilt.forEach((it,ii) => {
        y = salto(y, 5.5);
        const resp=insp.respuestas?.[it.id]; const esOk=resp===true||resp==='ok'; const esNa=resp==='na';
        const etq  = esNa?'N/A':esOk?'OK':'NC';
        const [tr,tg,tb] = esNa?[150,150,150]:esOk?[39,174,96]:[192,57,43];
        if (ii%2===0){doc.setDrawColor(235,235,235);doc.setLineWidth(0.1);doc.rect(10,y-3.5,pw-20,6,'S');}
        // Estado como texto coloreado, no badge sólido
        doc.setFontSize(6.5); doc.setFont(undefined,'bold'); doc.setTextColor(tr,tg,tb);
        doc.text(etq, 14, y);
        doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(30,30,30);
        const lin = doc.splitTextToSize(`${it.ref}  ${it.texto}`, pw-38);
        doc.text(lin, 23, y, {maxWidth:pw-38}); y += Math.max(5.5, lin.length*4);
      });
      y += 3;
    }

    // Observaciones
    if (insp.observaciones) {
      y = salto(y, 10);
      doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(40,40,40);
      doc.text('Observaciones:', 12, y); y += 5;
      const linObs = doc.splitTextToSize(insp.observaciones, pw-26);
      doc.setFont(undefined,'normal'); doc.setTextColor(60,60,60); doc.setFontSize(7.5);
      linObs.forEach(l=>{y=salto(y,5);doc.text(l,14,y);y+=4.5;});
      y += 3;
    }

    // Separador entre inspecciones
    y = salto(y, 4);
    doc.setDrawColor(210,215,220); doc.setLineWidth(0.25); doc.line(8, y, pw-8, y);
    y += 6;
  }

  /* 4. PLANES DE ACCIÓN */
  if (inclPlanes && planes.length > 0) {
    y = seccion('4. Planes de acción — Estado del período', y);

    const resueltos  = planes.filter(p=>p.estado==='resuelto');
    const pendientes = planes.filter(p=>p.estado==='pendiente');
    const vencidos   = planes.filter(p=>p.estado==='vencido');

    // Resumen en texto, sin cajas de color
    y = salto(y, 8);
    doc.setFontSize(8.5); doc.setFont(undefined,'normal'); doc.setTextColor(40,40,40);
    doc.text(`Resueltos: ${resueltos.length}   ·   Pendientes: ${pendientes.length}   ·   Vencidos: ${vencidos.length}`, 10, y);
    y += 8;

    const planesAbiertos = [...vencidos, ...pendientes];
    if (planesAbiertos.length > 0) {
      y = salto(y, 8);
      doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(192,57,43);
      doc.text('Planes abiertos (requieren atención):', 10, y); y += 6;
      planesAbiertos.forEach((pl,pi) => {
        y = salto(y, 10);
        const venc = pl.estado==='vencido';
        const [pr,pg,pb] = venc?[192,57,43]:[211,84,0];
        // Estado como texto + borde izquierdo
        doc.setDrawColor(pr,pg,pb); doc.setLineWidth(1.2); doc.line(10,y-1,10,y+8);
        doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(pr,pg,pb);
        doc.text(venc?'VENCIDO':'PENDIENTE', 14, y+2);
        doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
        const desc = doc.splitTextToSize(pl.descripcion||'Sin descripción', pw-28);
        doc.text(desc, 14, y+7); y += Math.max(10, 7+desc.length*4.5);
        if (pl.fechaVencimiento) {
          doc.setFontSize(6.5); doc.setTextColor(100,100,100);
          doc.text(`Venc.: ${fmtC(pl.fechaVencimiento)}   ·   Resp.: ${pl.responsable||''}`, 14, y);
          y += 5;
        }
        if (pi<planesAbiertos.length-1){doc.setDrawColor(225,225,225);doc.setLineWidth(0.2);doc.line(10,y,pw-10,y);}
        y += 4;
      });
    }

    if (resueltos.length > 0) {
      y = salto(y, 8);
      doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(39,174,96);
      doc.text('Planes resueltos durante el período:', 10, y); y += 6;
      resueltos.forEach(pl => {
        y = salto(y, 5.5);
        doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(40,40,40);
        const lin = doc.splitTextToSize(`✓  ${pl.descripcion||'Sin descripción'}`, pw-24);
        doc.text(lin, 12, y); y += lin.length*4.5+2;
      });
    }
    y += 4;
  }

  /* 5. CONCLUSIÓN */
  y = seccion('5. Conclusión', y);
  const cumLabel = cumGlobal>=95?'Excelente':cumGlobal>=85?'Buena':cumGlobal>=70?'Regular':cumGlobal>=50?'Deficiente':'Crítica';
  const nPlPend  = planes.filter(p=>p.estado==='pendiente'||p.estado==='vencido').length;
  const txtConc  = `En base a las inspecciones realizadas, el sistema de protección contra incendios de ${cliente.nombre||''} presenta un cumplimiento global de ${cumGlobal}% — clasificación: ${cumLabel}. Se realizaron ${inspecciones.length} visita${inspecciones.length!==1?'s':''} cubriendo ${Object.keys(porSist).length} sistema${Object.keys(porSist).length!==1?'s':''}. ${nPlPend>0?`Se registran ${nPlPend} plan${nPlPend!==1?'es':''} de acción pendiente${nPlPend!==1?'s':''} de resolución.`:'Todos los planes de acción del período se encuentran resueltos.'}`;
  const linConc  = doc.splitTextToSize(txtConc, pw-20);
  y = salto(y, linConc.length*4.5+4);
  doc.setFontSize(8.5); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
  doc.text(linConc, 10, y); y += linConc.length*4.5+10;

  /* 6. FIRMA */
  if (inclFirma) {
    const firma = Estado.config?.firmaPredeterminada;
    y = salto(y, 46);
    if (firma) { const d=dimImg(firma,60,25); if(d) try{doc.addImage(firma,'PNG',pw/2-d.w/2,y,d.w,d.h);y+=d.h+4;}catch(e){} }
    else y += 20;
    doc.setDrawColor(80,80,80); doc.setLineWidth(0.5); doc.line(pw/2-35,y,pw/2+35,y); y+=5;
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
    doc.text(Estado.config?.inspector||'', pw/2, y, {align:'center'}); y+=5;
    doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80);
    doc.text(Estado.config?.empresa||'', pw/2, y, {align:'center'}); y+=5;
    doc.text(`Período: ${fmtC(desde)} — ${fmtC(hasta)}`, pw/2, y, {align:'center'});
  }

  /* ── Numeración final ── */
  pie(pag,'?');
  const total = doc.internal.getNumberOfPages();
  const tw3   = (pw-16)/3;
  const pieH  = 7;
  for (let p=2; p<=total; p++) {
    doc.setPage(p);
    // Actualizar HOJA en encabezado
    const fy3 = 5+15+8+7/2+1.5;
    doc.setFillColor(255,255,255); doc.rect(8+tw3*2+0.5, fy3-5, tw3-1, 5.5, 'F');
    doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(30,30,30);
    doc.text(`HOJA: ${p}   DE: ${total}`, 8+tw3*2+tw3/2, fy3, {align:'center'});
    // Actualizar pie
    doc.setFillColor(255,255,255); doc.rect(8+tw3+0.5, ph-pieH-3+0.5, tw3-1, pieH-1, 'F');
    doc.setFont(undefined,'bold'); doc.setTextColor(80,80,80);
    doc.text(codigo, 8+tw3+tw3/2, ph-pieH-3+pieH/2+1.5, {align:'center'});
  }

  // Nombre de archivo
  const cliTag2 = (cliente.nombre||'Cliente').toUpperCase().replace(/[^A-Z0-9]/g,'_').replace(/_+/g,'_');
  doc.save(`${codigo}_Consolidado_${cliTag2}_${desde}_${hasta}.pdf`);
  mostrarToast('Informe consolidado generado', 'exito');
}

/* ── Exports públicos ── */
window.icRenderPantalla = icRenderPantalla;

window.IC = {
  atajo:         icAtajo,
  previsualizar: icPrevisualizar,
  generar:       icGenerarPDF,
};
