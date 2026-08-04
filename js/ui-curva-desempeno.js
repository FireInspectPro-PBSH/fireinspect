/* ============================================================
   FireInspect Pro — UI: Curva de Desempeño de Bomba CI
   Pantalla de carga de datos + gráfico Presión vs. Caudal
   ============================================================ */

/* Estado temporal de la prueba en curso */
let _datosPrueba = null;
let _resultadoPrueba = null;
let _chartCurva = null;

/* ——— Abre/renderiza la pantalla de Curva de Desempeño ——— */
async function renderizarCurvaDesempeno() {
  const clientes = await FireDB.getAll(FireDB.STORES.CLIENTES);
  const opcionesClientes = clientes.map(c =>
    `<option value="${c.id}">${c.nombre}</option>`
  ).join('') || '<option value="">Agregá un cliente primero</option>';

  document.getElementById('pantalla-curva-desempeno').innerHTML = `
    <button class="btn btn-secundario btn-sm" onclick="UI.irA('inspeccion')" style="margin-bottom:14px;">
      <i class="ti ti-arrow-left" aria-hidden="true"></i> Volver a Inspección
    </button>

    <div class="card">
      <div class="card-titulo"><i class="ti ti-building" aria-hidden="true"></i>Datos de la prueba</div>
      <div class="campo"><label>Cliente *</label>
        <select id="cd-cliente" onchange="UI.cdCargarBombasCliente()">${opcionesClientes}</select>
      </div>
      <div class="campo"><label>Bomba registrada</label>
        <select id="cd-equipo" onchange="UI.cdPrecargarBomba(this.value)">
          <option value="">— Carga manual —</option>
        </select>
        <p style="font-size:11.5px;color:var(--gris-500);margin-top:4px;">Elegí la bomba del cliente y la ficha técnica se completa sola.</p>
      </div>
      <div class="campo-fila">
        <div class="campo"><label>Fecha de prueba</label>
          <input type="date" id="cd-fecha" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="campo"><label>Inspector</label>
          <input type="text" id="cd-inspector" value="${Estado.config.inspector || ''}">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-titulo"><i class="ti ti-engine" aria-hidden="true"></i>Ficha técnica de la bomba<span class="ref-norma">NFPA 20 / Placa del fabricante</span></div>

      <!-- Identificación -->
      <p class="seccion-titulo" style="margin-top:0;">Identificación</p>
      <div class="campo-fila">
        <div class="campo"><label>Marca</label>
          <input type="text" id="cd-marca" placeholder="Ej: Peerless">
        </div>
        <div class="campo"><label>Modelo</label>
          <input type="text" id="cd-modelo" placeholder="Ej: 6AEF12 UL-FM">
        </div>
      </div>
      <div class="campo-fila">
        <div class="campo"><label>Nro. de serie</label>
          <input type="text" id="cd-serie" placeholder="Ej: 50008206">
        </div>
        <div class="campo"><label>Tipo de accionamiento</label>
          <select id="cd-tipo-accion">
            <option value="electrico">Eléctrico</option>
            <option value="diesel">Diesel / Motor a combustión</option>
            <option value="vapor">Vapor</option>
          </select>
        </div>
      </div>
      <div class="campo-fila">
        <div class="campo"><label>Certificación</label>
          <select id="cd-certificacion">
            <option value="ul_fm">UL / FM Listed</option>
            <option value="ul">UL Listed</option>
            <option value="fm">FM Approved</option>
            <option value="ninguna">Sin certificación</option>
          </select>
        </div>
        <div class="campo"><label>Velocidad nominal (RPM)</label>
          <input type="text" id="cd-nn" inputmode="numeric" placeholder="Ej: 2800">
        </div>
      </div>

      <!-- Tamaños de tubería -->
      <p class="seccion-titulo">Tamaños de conexión</p>
      <div class="campo-fila">
        <div class="campo"><label>Diámetro succión (in)</label>
          <input type="text" id="cd-diam-suc" inputmode="decimal" placeholder="Ej: 8"
                 oninput="this.nextElementSibling.textContent=this.value?(Math.round(parseFloat(this.value)*25.4)+' mm'):''" >
          <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
        </div>
        <div class="campo"><label>Diámetro descarga (in)</label>
          <input type="text" id="cd-diam-desc" inputmode="decimal" placeholder="Ej: 6"
                 oninput="this.nextElementSibling.textContent=this.value?(Math.round(parseFloat(this.value)*25.4)+' mm'):''" >
          <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
        </div>
      </div>

      <!-- Parámetros nominales de placa — los que definen la CURVA DEL FABRICANTE -->
      <p class="seccion-titulo">Parámetros nominales de placa <span style="font-weight:400;text-transform:none;font-size:11px;">(definen la curva del fabricante en el gráfico)</span></p>
      <div class="campo-fila">
        <div class="campo"><label>Caudal nominal — Qn (GPM) *</label>
          <input type="text" id="cd-qn" inputmode="decimal" placeholder="Ej: 1500"
            oninput="UI.cdActualizarQ150()">
          <span id="cd-qn-conv" style="font-size:11.5px;color:var(--gris-500);margin-top:3px;display:block;"></span>
        </div>
        <div class="campo"><label>Presión nominal — Pn (PSI) *</label>
          <input type="text" id="cd-pn" inputmode="decimal" placeholder="Ej: 140"
            oninput="UI.cdActualizarLimites()">
          <span id="cd-pn-conv" style="font-size:11.5px;color:var(--gris-500);margin-top:3px;display:block;"></span>
        </div>
      </div>
      <div class="campo-fila">
        <div class="campo">
          <label>Presión a caudal cero — P shutoff (PSI)
            <span style="font-weight:400;font-size:11px;"> · dato de placa si disponible</span>
          </label>
          <input type="text" id="cd-p-shutoff-fab" inputmode="decimal" placeholder="Ej: 168 (si no se conoce, se calcula como 140% × Pn)"
                 oninput="this.nextElementSibling.textContent=Unidades.textoConversion(this.value,'presion')">
          <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
        </div>
      </div>
      <div class="campo-fila">
        <div class="campo">
          <label>Presión al 150%Q — P@150% (PSI) *
            <span style="font-weight:400;font-size:11px;"> · dato de placa del fabricante</span>
          </label>
          <input type="text" id="cd-p150-fab" inputmode="decimal" placeholder="Ej: 102"
                 oninput="UI.cdActualizarLimites(); this.nextElementSibling.textContent=Unidades.textoConversion(this.value,'presion')">
          <span id="cd-p150-conv" style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
        </div>
        <div class="campo"><label>Q al 150% (GPM) — referencia</label>
          <input type="text" id="cd-q150-fab" inputmode="decimal" readonly
                 style="background:var(--gris-100);color:var(--gris-500);"
                 placeholder="Se calcula: 1.5 × Qn">
          <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
        </div>
      </div>

      <!-- Info adicional de la instalación -->
      <p class="seccion-titulo">Información de la instalación</p>
      <div class="campo-fila">
        <div class="campo"><label>Líquido de bombeo</label>
          <input type="text" id="cd-liquido" placeholder="Ej: Agua de cisterna" value="Agua">
        </div>
        <div class="campo"><label>Temperatura de bombeo</label>
          <input type="text" id="cd-temp-bombeo" placeholder="Ej: Ambiente (68-75°F)" value="Ambiente">
        </div>
      </div>
      <div class="campo-fila">
        <div class="campo"><label>Controlador / tablero</label>
          <input type="text" id="cd-controlador" placeholder="Ej: Firetrol FTA1100">
        </div>
        <div class="campo"><label>Capacidad de almacenamiento</label>
          <input type="text" id="cd-capacidad-agua" placeholder="Ej: 600 m³ + 135 m³">
        </div>
      </div>

      <!-- Límites NFPA calculados -->
      <div id="cd-limites-nfpa" style="background:var(--azul-claro);border-radius:var(--border-radius-md);padding:12px 14px;font-size:12px;color:var(--azul);display:none;margin-top:6px;">
        <strong>Límites NFPA 20 para esta bomba:</strong><br>
        <span id="cd-limite-shutoff"></span><br>
        <span id="cd-limite-150"></span><br>
        <span id="cd-curva-fab-resumen" style="margin-top:4px;display:block;font-style:italic;"></span>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════
         REGISTRO FOTOGRÁFICO
         Fotos de la bomba, placa, manómetros e instalación
    ══════════════════════════════════════════════════════ -->
    <div class="card">
      <div class="card-titulo"><i class="ti ti-camera" aria-hidden="true"></i>Registro fotográfico<span class="ref-norma">Documentación de campo</span></div>
      <p style="font-size:12px;color:var(--gris-500);margin-bottom:14px;line-height:1.5;">
        Fotografiá la bomba, la placa de datos, los manómetros y cualquier detalle relevante de la instalación.
      </p>

      <!-- Grilla de categorías de fotos -->
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:12px;">
        ${[
          { id:'foto-bomba',      icono:'engine',           label:'Bomba completa' },
          { id:'foto-placa',      icono:'id-badge-2',       label:'Placa del fabricante' },
          { id:'foto-manometros', icono:'gauge',            label:'Manómetros' },
          { id:'foto-tablero',    icono:'plug-connected',   label:'Tablero / controlador' },
        ].map(f => `
          <div style="border:1.5px dashed var(--gris-300);border-radius:var(--border-radius-md);padding:12px;text-align:center;cursor:pointer;background:var(--gris-50);"
               onclick="UI.cdAgregarFotoCategoria('${f.id}', '${f.label}')">
            <i class="ti ti-${f.icono}" style="font-size:22px;color:var(--gris-500);" aria-hidden="true"></i>
            <p style="font-size:11.5px;color:var(--gris-700);margin-top:5px;font-weight:500;">${f.label}</p>
            <div id="${f.id}-preview" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;justify-content:center;"></div>
          </div>`).join('')}
      </div>

      <!-- Fotos adicionales / libres -->
      <div style="border:1.5px dashed var(--gris-300);border-radius:var(--border-radius-md);padding:10px;background:var(--gris-50);">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:12px;color:var(--gris-700);font-weight:500;"><i class="ti ti-photo-plus" aria-hidden="true"></i> Fotos adicionales</span>
          <button class="btn btn-sm btn-secundario" onclick="UI.cdAgregarFotoCategoria('foto-extra', 'Adicional')">
            <i class="ti ti-plus" aria-hidden="true"></i> Agregar
          </button>
        </div>
        <div id="foto-extra-preview" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;"></div>
      </div>

      <!-- Input oculto que disparan los botones de cada categoría -->
      <input type="file" id="cd-foto-input" accept="image/*" capture="environment" style="display:none"
             onchange="UI.cdConfirmarFoto(this)">
    </div>

    <!-- ══════════════════════════════════════════════════════
         MEDICIONES DE CAMPO
         Con módulo Tubo Pitot integrado
    ══════════════════════════════════════════════════════ -->
    <div class="card">
      <div class="card-titulo"><i class="ti ti-ruler-measure" aria-hidden="true"></i>Mediciones de campo<span class="ref-norma">NFPA 291 / 3 puntos</span></div>

      <!-- Selector del método de medición de caudal -->
      <div style="background:var(--gris-50);border:1px solid var(--gris-200);border-radius:var(--border-radius-md);padding:12px;margin-bottom:16px;">
        <p style="font-size:12.5px;font-weight:600;color:var(--gris-900);margin-bottom:10px;">Método de medición de caudal</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;padding:6px 12px;border:1.5px solid var(--azul);border-radius:20px;background:var(--azul-claro);">
            <input type="radio" name="cd-metodo-q" value="caudalimetro" checked onchange="UI.cdToggleMetodoQ(this.value)" style="accent-color:var(--azul);">
            <i class="ti ti-gauge" aria-hidden="true"></i> Caudalímetro directo
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;padding:6px 12px;border:1.5px solid var(--gris-300);border-radius:20px;">
            <input type="radio" name="cd-metodo-q" value="pitot" onchange="UI.cdToggleMetodoQ(this.value)" style="accent-color:var(--azul);">
            <i class="ti ti-wind" aria-hidden="true"></i> Tubo Pitot (NFPA 291)
          </label>
        </div>
      </div>

      <!-- ─── MÓDULO TUBO PITOT ─── -->
      <div id="cd-pitot-panel" style="display:none;margin-bottom:16px;">
        <div style="background:linear-gradient(135deg,#E8F0FE 0%,#F0F4FF 100%);border:1px solid #C5D5F8;border-radius:var(--border-radius-md);padding:14px;">
          <p style="font-size:13px;font-weight:700;color:#1A237E;margin-bottom:4px;">
            <i class="ti ti-wind" aria-hidden="true"></i> Tubo Pitot — Cálculo automático NFPA 291
          </p>
          <p style="font-size:11.5px;color:#3949AB;margin-bottom:12px;line-height:1.5;">
            Q (GPM) = 29.84 × C<sub>d</sub> × d² × √P<sub>pitot</sub> &nbsp;·&nbsp;
            Q total = Σ boquillas + caudalímetro
          </p>

          <!-- Configuración de boquilla (común a todos los puntos) -->
          <div style="background:white;border-radius:var(--border-radius-sm);padding:10px;margin-bottom:12px;">
            <p style="font-size:12px;font-weight:600;color:var(--gris-900);margin-bottom:8px;">Configuración de boquilla</p>
            <div class="campo-fila">
              <div class="campo">
                <label>Diámetro boquilla (in)</label>
                <input type="text" id="pitot-diam-in" inputmode="decimal" placeholder="Ej: 1.5"
                       oninput="UI.cdPitotRecalcular(); this.nextElementSibling.textContent=this.value?(Math.round(parseFloat(this.value)*25.4*10)/10+' mm'):''" >
                <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
              </div>
              <div class="campo">
                <label>Coef. de descarga C<sub>d</sub></label>
                <select id="pitot-cd" onchange="UI.cdPitotRecalcular()">
                  <option value="0.97">0.97 — Boquilla suave / certificada</option>
                  <option value="0.90">0.90 — Boquilla abierta estándar</option>
                  <option value="0.80">0.80 — Boquilla corta sin bisel</option>
                  <option value="manual">Ingreso manual…</option>
                </select>
              </div>
            </div>
            <div class="campo" id="pitot-cd-manual-wrap" style="display:none;max-width:200px;">
              <label>C<sub>d</sub> manual</label>
              <input type="text" id="pitot-cd-manual" inputmode="decimal" placeholder="0.0–1.0" oninput="UI.cdPitotRecalcular()">
            </div>
          </div>

          <!-- Tabla de mediciones Pitot para los 3 puntos -->
          ${['0','100','150'].map((pt, idx) => {
            const labels = ['Punto 1 — Shutoff (Q=0)', 'Punto 2 — ~100%Q', 'Punto 3 — ~150%Q'];
            const colors = ['var(--gris-400)', 'var(--azul)', 'var(--rojo)'];
            return `
            <div style="background:white;border-radius:var(--border-radius-sm);padding:10px;margin-bottom:10px;border-left:3px solid ${colors[idx]};">
              <p style="font-size:12.5px;font-weight:600;color:var(--gris-900);margin-bottom:8px;">${labels[idx]}</p>
              <div style="overflow-x:auto;max-height:260px;overflow-y:auto;border:1px solid var(--gris-200);border-radius:4px;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                  <thead style="position:sticky;top:0;z-index:1;">
                    <tr style="background:var(--gris-100);">
                      <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--gris-700);">Boquilla</th>
                      <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--gris-700);">P Pitot (PSI)</th>
                      <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--gris-700);">Q calculado</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(n => `
                    <tr style="border-bottom:1px solid var(--gris-100);">
                      <td style="padding:4px 8px;color:var(--gris-600);font-weight:500;">#${n}</td>
                      <td style="padding:4px 8px;">
                        <input type="text" id="pitot-p${pt}-${n}" inputmode="decimal" placeholder="—"
                               style="width:76px;border:1px solid var(--gris-300);border-radius:4px;padding:3px 6px;font-size:12px;"
                               oninput="UI.cdPitotRecalcular()">
                      </td>
                      <td style="padding:4px 8px;">
                        <span id="pitot-q${pt}-${n}" style="font-size:12px;color:var(--azul);font-weight:600;">—</span>
                        <span style="font-size:10.5px;color:var(--gris-500);"> GPM</span>
                      </td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
                <div>
                  <label style="font-size:11.5px;color:var(--gris-600);">+ Caudalímetro directo (GPM)</label>
                  <input type="text" id="pitot-meter${pt}" inputmode="decimal" placeholder="0"
                         style="width:80px;border:1px solid var(--gris-300);border-radius:4px;padding:3px 6px;font-size:12px;margin-left:6px;"
                         oninput="UI.cdPitotRecalcular()">
                </div>
                <div style="background:var(--azul-claro);border-radius:var(--border-radius-sm);padding:5px 12px;">
                  <span style="font-size:11.5px;color:var(--gris-600);">Total: </span>
                  <span id="pitot-qtotal${pt}" style="font-size:14px;font-weight:700;color:var(--azul);">0</span>
                  <span style="font-size:11.5px;color:var(--gris-600);"> GPM</span>
                  <span style="font-size:11px;color:var(--gris-500);"> · </span>
                  <span id="pitot-qtotal${pt}-lmin" style="font-size:12px;color:var(--gris-600);">0 L/min</span>
                </div>
                <button class="btn btn-sm btn-primary" onclick="UI.cdPitotTransferir('${pt}')">
                  <i class="ti ti-arrow-right" aria-hidden="true"></i> Usar como Q${pt === '0' ? ' Shutoff' : pt === '100' ? ' 100%' : ' 150%'}
                </button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- ─── CAMPOS PRINCIPALES DE MEDICIÓN ─── -->
      <p style="font-size:12px;color:var(--gris-500);margin-bottom:14px;line-height:1.5;">
        Presiones en <strong>PSI</strong>. Caudales en <strong>GPM</strong>.
        Conversión automática a bar y L/min debajo de cada campo.
        La corrección por velocidad se aplica automáticamente si difiere de la nominal.
      </p>

      <!-- Punto 1: Shutoff -->
      <div style="border-left:3px solid var(--gris-400);padding-left:12px;margin-bottom:16px;">
        <p style="font-size:13px;font-weight:600;color:var(--gris-900);margin-bottom:10px;">
          Punto 1 — Shutoff (caudal cero)
        </p>
        <div class="campo-fila">
          <div class="campo"><label>Presión succión (PSI)</label>
            <input type="text" id="cd-suc-0" inputmode="decimal" placeholder="0"
                   oninput="this.nextElementSibling.textContent=Unidades.textoConversion(this.value,'presion')">
            <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
          </div>
          <div class="campo"><label>Presión descarga (PSI)</label>
            <input type="text" id="cd-desc-0" inputmode="decimal" placeholder="Ej: 196"
                   oninput="this.nextElementSibling.textContent=Unidades.textoConversion(this.value,'presion')">
            <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
          </div>
        </div>
        <div class="campo" style="max-width:180px;"><label>Velocidad real (RPM)</label>
          <input type="text" id="cd-rpm-0" inputmode="numeric" placeholder="Ej: 2800">
        </div>
      </div>

      <!-- Punto 2: ~100%Q -->
      <div style="border-left:3px solid var(--azul);padding-left:12px;margin-bottom:16px;">
        <p style="font-size:13px;font-weight:600;color:var(--gris-900);margin-bottom:10px;">
          Punto 2 — ~100% del caudal nominal
          <span id="cd-q100-ref" style="font-weight:400;font-size:11.5px;color:var(--azul);"></span>
        </p>
        <div class="campo-fila">
          <div class="campo">
            <label>Caudal medido (GPM)</label>
            <input type="text" id="cd-q-100" inputmode="decimal" placeholder="Ej: 1500"
                   oninput="this.nextElementSibling.textContent=Unidades.textoConversion(this.value,'caudal')">
            <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
          </div>
          <div class="campo"><label>Velocidad real (RPM)</label>
            <input type="text" id="cd-rpm-100" inputmode="numeric" placeholder="Ej: 2730">
          </div>
        </div>
        <div class="campo-fila">
          <div class="campo"><label>Presión succión (PSI)</label>
            <input type="text" id="cd-suc-100" inputmode="decimal" placeholder="Ej: 9"
                   oninput="this.nextElementSibling.textContent=Unidades.textoConversion(this.value,'presion')">
            <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
          </div>
          <div class="campo"><label>Presión descarga (PSI)</label>
            <input type="text" id="cd-desc-100" inputmode="decimal" placeholder="Ej: 135"
                   oninput="this.nextElementSibling.textContent=Unidades.textoConversion(this.value,'presion')">
            <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
          </div>
        </div>
      </div>

      <!-- Punto 3: ~150%Q -->
      <div style="border-left:3px solid var(--rojo);padding-left:12px;">
        <p style="font-size:13px;font-weight:600;color:var(--gris-900);margin-bottom:10px;">
          Punto 3 — ~150% del caudal nominal
          <span id="cd-q150-ref" style="font-weight:400;font-size:11.5px;color:var(--rojo);"></span>
        </p>
        <div class="campo-fila">
          <div class="campo">
            <label>Caudal medido (GPM)</label>
            <input type="text" id="cd-q-150" inputmode="decimal" placeholder="Ej: 2250"
                   oninput="this.nextElementSibling.textContent=Unidades.textoConversion(this.value,'caudal')">
            <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
          </div>
          <div class="campo"><label>Velocidad real (RPM)</label>
            <input type="text" id="cd-rpm-150" inputmode="numeric" placeholder="Ej: 2700">
          </div>
        </div>
        <div class="campo-fila">
          <div class="campo"><label>Presión succión (PSI)</label>
            <input type="text" id="cd-suc-150" inputmode="decimal" placeholder="Ej: 6"
                   oninput="this.nextElementSibling.textContent=Unidades.textoConversion(this.value,'presion')">
            <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
          </div>
          <div class="campo"><label>Presión descarga (PSI)</label>
            <input type="text" id="cd-desc-150" inputmode="decimal" placeholder="Ej: 93"
                   oninput="this.nextElementSibling.textContent=Unidades.textoConversion(this.value,'presion')">
            <span style="font-size:11.5px;color:var(--gris-500);display:block;margin-top:3px;"></span>
          </div>
        </div>
      </div>
    </div>

    <div class="campo"><label>Instrumentos utilizados</label>
      <textarea id="cd-instrumentos" placeholder="Ej: Caudalímetro analógico Global Vision Inc. · Manómetro de descarga (propio instalación) · Manovacuómetro de succión · Tacómetro digital portátil"></textarea>
    </div>
    <div class="campo"><label>Observaciones generales</label>
      <textarea id="cd-observaciones" placeholder="Observaciones sobre el estado de la bomba, controlador, baterías, etc."></textarea>
    </div>
    <div class="campo"><label>Recomendaciones técnicas</label>
      <textarea id="cd-recomendaciones" placeholder="Ej: Se recomienda verificar el nivel de electrolito en baterías del controlador. Realizar mantenimiento preventivo del sello mecánico antes de próxima prueba anual."></textarea>
    </div>

    <button class="btn btn-primary btn-block" onclick="UI.cdCalcularYGraficar()">
      <i class="ti ti-chart-line" aria-hidden="true"></i> Calcular y graficar curva
    </button>

    <!-- RESULTADO (se muestra tras el cálculo) -->
    <div id="cd-resultado" style="display:none;margin-top:14px;">

      <div class="card" id="cd-card-clasificacion">
        <div class="card-titulo"><i class="ti ti-gauge" aria-hidden="true"></i>Resultado de la prueba</div>
        <div id="cd-resumen-clasificacion"></div>
      </div>

      <div class="card">
        <div class="card-titulo"><i class="ti ti-chart-line" aria-hidden="true"></i>Curva de Desempeño — Presión vs. Caudal</div>
        <div style="position:relative;width:100%;height:400px;">
          <canvas id="chart-curva-desempeno" role="img" aria-label="Gráfico de curva de desempeño de bomba contra incendios"></canvas>
        </div>
        <div id="cd-leyenda-curva" style="display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:12px;padding:8px;background:var(--gris-50);border-radius:var(--border-radius-sm);"></div>
      </div>

      <div class="card">
        <div class="card-titulo"><i class="ti ti-file-text" aria-hidden="true"></i>Conclusión técnica</div>
        <div id="cd-conclusion-texto" style="font-size:13px;color:var(--gris-700);line-height:1.7;white-space:pre-wrap;"></div>
      </div>

      <div class="btn-fila">
        <button class="btn btn-primary" onclick="UI.cdGuardar()">
          <i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar prueba
        </button>
        <button class="btn btn-secundario" onclick="UI.cdGenerarPDF()">
          <i class="ti ti-file-type-pdf" aria-hidden="true"></i> Generar informe PDF
        </button>
      </div>
    </div>
  `;
  cdCargarBombasCliente();
}

/* ——— Helpers de actualización del formulario ——— */
function cdActualizarLimites() {
  const pn      = parseFloat(document.getElementById('cd-pn').value);
  const p150fab = parseFloat(document.getElementById('cd-p150-fab')?.value);
  if (isNaN(pn)) return;

  const convPn = document.getElementById('cd-pn-conv');
  if (convPn) convPn.textContent = Unidades.textoConversion(pn, 'presion');

  const lim = document.getElementById('cd-limites-nfpa');
  lim.style.display = 'block';
  document.getElementById('cd-limite-shutoff').textContent =
    `Shutoff (Q=0): P max = ${(pn * 1.40).toFixed(1)} PSI  (≈ ${Unidades.psiABar(pn * 1.40).toFixed(2)} bar)`;
  document.getElementById('cd-limite-150').textContent =
    `Q 150%: P min = ${(pn * 0.65).toFixed(1)} PSI  (≈ ${Unidades.psiABar(pn * 0.65).toFixed(2)} bar)`;

  const resumen = document.getElementById('cd-curva-fab-resumen');
  if (resumen) {
    if (!isNaN(p150fab) && p150fab > 0) {
      resumen.textContent = `Curva fabricante: (0 GPM, ${pn} PSI) → (Qn, ${pn} PSI) → (150%Q, ${p150fab} PSI)`;
    } else {
      resumen.textContent = 'Ingresá la Presión al 150%Q de la placa del fabricante para trazar su curva en el gráfico';
    }
    resumen.style.display = 'block';
  }
}

function cdActualizarQ150() {
  const qn = parseFloat(document.getElementById('cd-qn').value);
  if (isNaN(qn)) return;

  const convQn = document.getElementById('cd-qn-conv');
  if (convQn) convQn.textContent = Unidades.textoConversion(qn, 'caudal');

  const ref100 = document.getElementById('cd-q100-ref');
  const ref150 = document.getElementById('cd-q150-ref');
  if (ref100) ref100.textContent = `(≈ ${qn.toFixed(0)} GPM)`;
  if (ref150) ref150.textContent = `(≈ ${(qn * 1.5).toFixed(0)} GPM)`;

  // Campo readonly que muestra Q@150% calculado automáticamente
  const q150fab = document.getElementById('cd-q150-fab');
  if (q150fab) {
    q150fab.value = (qn * 1.5).toFixed(0);
    const span = q150fab.nextElementSibling;
    if (span) span.textContent = Unidades.textoConversion(qn * 1.5, 'caudal');
  }

  cdActualizarLimites();
}

/* Lee el valor del campo en PSI directamente (unidad fija NFPA) */
function leerPresionEnPsi(inputId) {
  const val = parseFloat(document.getElementById(inputId).value);
  return isNaN(val) ? 0 : val;
}

/* ——— Calcula, clasifica y grafica ——— */
function cdCalcularYGraficar() {
  const pn = parseFloat(document.getElementById('cd-pn').value);
  const qn = parseFloat(document.getElementById('cd-qn').value);
  const nn = parseFloat(document.getElementById('cd-nn').value) || 1;

  if (!pn || !qn) { mostrarToast('Ingresá presión y caudal nominales de placa', 'error'); return; }

  // P@150% del fabricante — el dato de placa que define la curva real del fabricante
  const p150_fab = parseFloat(document.getElementById('cd-p150-fab').value) || (pn * 0.65);
  const p_shutoff_fab = parseFloat(document.getElementById('cd-p-shutoff-fab').value) || null;

  const datos = {
    pn_psi: pn, qn_gpm: qn, nn_rpm: nn,
    p150_fab_psi: p150_fab,          // ← NUEVO: P al 150%Q del fabricante (para curva del fabricante)
    p_shutoff_fab_psi: p_shutoff_fab, // ← NUEVO: P shutoff del fabricante (si está en la placa)
    // Punto 1: Shutoff de campo
    p_suc_shutoff:  leerPresionEnPsi('cd-suc-0'),
    p_desc_shutoff: leerPresionEnPsi('cd-desc-0'),
    n_shutoff:      parseFloat(document.getElementById('cd-rpm-0').value) || nn,
    // Punto 2: ~100%Q de campo
    q_campo_100:    parseFloat(document.getElementById('cd-q-100').value) || qn,
    p_suc_100:      leerPresionEnPsi('cd-suc-100'),
    p_desc_100:     leerPresionEnPsi('cd-desc-100'),
    n_100:          parseFloat(document.getElementById('cd-rpm-100').value) || nn,
    // Punto 3: ~150%Q de campo
    q_campo_150:    parseFloat(document.getElementById('cd-q-150').value) || qn * 1.5,
    p_suc_150:      leerPresionEnPsi('cd-suc-150'),
    p_desc_150:     leerPresionEnPsi('cd-desc-150'),
    n_150:          parseFloat(document.getElementById('cd-rpm-150').value) || nn,
  };

  const resultado = CurvaDesempeno.analizarCurvaDesempeno(datos);
  _datosPrueba = datos;
  _resultadoPrueba = resultado;

  // — Muestra el bloque de resultado —
  document.getElementById('cd-resultado').style.display = 'block';

  // — Card de clasificación —
  const cls = resultado.clasificacion_global;
  const p100cls = resultado.punto100.clasificacion;
  const p150cls = resultado.punto150.clasificacion;
  document.getElementById('cd-resumen-clasificacion').innerHTML = `
    <div style="background:${cls.colorFondo};border-radius:var(--border-radius-md);padding:14px;text-align:center;margin-bottom:14px;">
      <p style="font-size:22px;font-weight:700;color:${cls.color};">${cls.labelEs}</p>
      <p style="font-size:12.5px;color:${cls.color};">${resultado.cumple_nfpa ? '✓ Cumple NFPA 25 — Dentro de parámetros' : '✗ No cumple NFPA 25 — Requiere acción correctiva'}</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px;text-align:center;">
      <div style="padding:10px;background:${resultado.shutoff.ok ? '#EAFAF1' : '#FDEDEC'};border-radius:var(--border-radius-sm);">
        <div style="font-weight:700;color:${resultado.shutoff.ok ? 'var(--verde)' : 'var(--rojo)'};">${resultado.shutoff.ok ? '✓ OK' : '✗ FALLA'}</div>
        <div>Shutoff</div>
        <div style="color:var(--gris-500);">${resultado.shutoff.p_corr.toFixed(1)} PSI</div>
      </div>
      <div style="padding:10px;background:${p100cls.colorFondo};border-radius:var(--border-radius-sm);">
        <div style="font-weight:700;color:${p100cls.color};">${p100cls.porcentaje.toFixed(1)}%</div>
        <div>${p100cls.labelEs}</div>
        <div style="color:var(--gris-500);">Punto 100%Q</div>
      </div>
      <div style="padding:10px;background:${p150cls.colorFondo};border-radius:var(--border-radius-sm);">
        <div style="font-weight:700;color:${p150cls.color};">${p150cls.porcentaje.toFixed(1)}%</div>
        <div>${p150cls.labelEs}</div>
        <div style="color:var(--gris-500);">Punto 150%Q</div>
      </div>
    </div>
  `;

  // — Gráfico Presión vs. Caudal —
  cdRenderizarGrafico(resultado, pn, qn);

  // — Conclusión de texto —
  const datosBomba = {
    marca:   document.getElementById('cd-marca').value,
    modelo:  document.getElementById('cd-modelo').value,
    pn_psi: pn, qn_gpm: qn
  };
  document.getElementById('cd-conclusion-texto').textContent =
    CurvaDesempeno.generarConclusionTexto(resultado, datosBomba);

  // scroll al resultado
  document.getElementById('cd-resultado').scrollIntoView({ behavior: 'smooth' });
  mostrarToast('Curva calculada correctamente', 'exito');
}

/* ——— Renderiza el gráfico con Chart.js ———
   Replica exactamente el gráfico del informe de campo (ej: Cargill S.A.):
   - 4 curvas de clasificación cuadráticas (Lagrange) punteadas con marcadores
   - Curva del fabricante: línea cuadrática negra sólida con triángulos
   - Curva de campo: línea negra sólida con círculos rojos
   - Punto nominal (Pump Rating): triángulo violeta
   - Escala Y ajustada al rango útil (no desde 0)
   - Grilla densa visible
   ——— */
/* Construye el SVG del gráfico y su leyenda a partir de los datos.
   Es PURO (no toca el DOM): sirve tanto para la pantalla en vivo como
   para reconstruir el gráfico desde una prueba guardada en el historial. */
function cdConstruirSVG(resultado, pn_psi, qn_gpm, datosPrueba) {
  /* ═══════════════════════════════════════════════════════
     DATOS BASE
  ═══════════════════════════════════════════════════════ */
  const p150_fab   = (datosPrueba.p150_fab_psi > 0   ? datosPrueba.p150_fab_psi   : pn_psi * 0.65);
  const p_shut_fab = (datosPrueba.p_shutoff_fab_psi > 0 ? datosPrueba.p_shutoff_fab_psi : pn_psi * 1.00);
  const q150       = qn_gpm * 1.5;

  /* ═══════════════════════════════════════════════════════
     INTERPOLACIÓN CUADRÁTICA DE LAGRANGE
     Genera curvas suaves pasando exactamente por 3 puntos
  ═══════════════════════════════════════════════════════ */
  function lagrange3(q, q0,q1,q2, p0,p1,p2) {
    const L0 = ((q-q1)*(q-q2)) / ((q0-q1)*(q0-q2));
    const L1 = ((q-q0)*(q-q2)) / ((q1-q0)*(q1-q2));
    const L2 = ((q-q0)*(q-q1)) / ((q2-q0)*(q2-q1));
    return p0*L0 + p1*L1 + p2*L2;
  }

  function curva(p0, p1, p2, qMax, N) {
    return Array.from({length: N+1}, (_,i) => {
      const q = qMax * i / N;
      return [q, Math.max(lagrange3(q, 0, qn_gpm, qMax, p0, p1, p2), 0)];
    });
  }

  /* ═══════════════════════════════════════════════════════
     DEFINICIÓN DE CURVAS
     4 curvas NFPA + 1 fabricante + 1 campo
  ═══════════════════════════════════════════════════════ */
  const N = 100; // puntos de suavizado (más = más suave)

  // 4 curvas de clasificación NFPA (punteadas, colores)
  const NFPA = [
    { id:'exc', label:'"Excellent" Curve', color:'#1565C0', w:1.8, dash:'10,5',
      p0:pn_psi, p1:pn_psi*1.05, p2:p150_fab*1.05, mk:'diamond' },
    { id:'goo', label:'"Good" Curve',      color:'#29B6F6', w:1.8, dash:'10,5',
      p0:pn_psi, p1:pn_psi*1.00, p2:p150_fab*1.00, mk:'square'  },
    { id:'fai', label:'"Fair" Curve',      color:'#C62828', w:1.8, dash:'10,5',
      p0:pn_psi, p1:pn_psi*0.95, p2:p150_fab*0.95, mk:'circle'  },
    { id:'poo', label:'"Poor" Curve',      color:'#00796B', w:1.8, dash:'10,5',
      p0:pn_psi, p1:pn_psi*0.90, p2:p150_fab*0.90, mk:'square'  },
  ];
  NFPA.forEach(c => { c.pts = curva(c.p0, c.p1, c.p2, q150, N); });

  // Curva del fabricante: negra sólida gruesa (3 puntos de placa)
  const ptsFab = curva(p_shut_fab, pn_psi, p150_fab, q150, N);

  // Curva de campo: negra punteada gruesa (3 puntos medidos corregidos a Nn)
  const pm = resultado.puntos_medidos; // [{q,p,label}]
  const ptsCampo = Array.from({length: N+1}, (_,i) => {
    const q = pm[2].q * i / N;
    return [q, Math.max(lagrange3(q, pm[0].q, pm[1].q, pm[2].q, pm[0].p, pm[1].p, pm[2].p), 0)];
  });

  /* ═══════════════════════════════════════════════════════
     ESCALA DE EJES
  ═══════════════════════════════════════════════════════ */
  const allP = [
    ...NFPA.flatMap(c => c.pts.map(pt => pt[1])),
    ...ptsFab.map(pt => pt[1]),
    ...ptsCampo.map(pt => pt[1]),
    p_shut_fab, p150_fab, pn_psi,
    pm[0].p, pm[1].p, pm[2].p,
  ].filter(v => v > 0);

  const yStep = 20;
  const yMax  = Math.ceil(Math.max(...allP) * 1.08 / yStep) * yStep;
  const yMin  = Math.floor(Math.max(0, Math.min(...allP) * 0.90) / yStep) * yStep;
  const xMax  = Math.ceil(Math.max(q150, pm[2].q) * 1.15 / 250) * 250;

  /* ═══════════════════════════════════════════════════════
     GEOMETRÍA DEL GRÁFICO
     Diseño técnico-ejecutivo con proporciones premium
  ═══════════════════════════════════════════════════════ */
  const W = 900, H = 560;
  const ml = 72, mr = 36, mt = 36, mb = 76;
  const cw = W - ml - mr;
  const ch = H - mt - mb;

  const xP = q  => ml + (q / xMax) * cw;
  const yP = p  => mt + ch - ((p - yMin) / (yMax - yMin)) * ch;
  const pts2str = pts => pts.map(([q,p]) => `${xP(q).toFixed(1)},${yP(p).toFixed(1)}`).join(' ');

  /* ═══════════════════════════════════════════════════════
     MARCADORES INLINE (SVG directo, sin defs/marker)
  ═══════════════════════════════════════════════════════ */
  const mk = {
    diamond: (x,y,r,c,s='white') =>
      `<polygon points="${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}" fill="${c}" stroke="${s}" stroke-width="1.2"/>`,
    square:  (x,y,r,c,s='white') =>
      `<rect x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" fill="${c}" stroke="${s}" stroke-width="1.2"/>`,
    circle:  (x,y,r,c,s='white') =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${s}" stroke-width="1.4"/>`,
    triangle:(x,y,r,c,s='white') =>
      `<polygon points="${x},${y-r} ${x+r*1.0},${y+r*0.8} ${x-r*1.0},${y+r*0.8}" fill="${c}" stroke="${s}" stroke-width="1.2"/>`,
    cross:   (x,y,r,c,s='white') =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${s}" stroke-width="1.4"/>` +
      `<line x1="${x-r}" y1="${y}" x2="${x+r}" y2="${y}" stroke="white" stroke-width="1.5"/>` +
      `<line x1="${x}" y1="${y-r}" x2="${x}" y2="${y+r}" stroke="white" stroke-width="1.5"/>`,
  };

  /* ═══════════════════════════════════════════════════════
     CONSTRUCCIÓN SVG
  ═══════════════════════════════════════════════════════ */
  let svg = '';

  /* ── Fondo premium: blanco puro con sutil gradiente ── */
  svg += `<defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F7F9FC"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  /* ── Fondo del área de plot ── */
  svg += `<rect x="${ml}" y="${mt}" width="${cw}" height="${ch}" fill="url(#bgGrad)" rx="0"/>`;

  /* ── Grilla menor: 125 GPM / 10 PSI — muy tenue ── */
  for (let q = 0; q <= xMax; q += 125) {
    svg += `<line x1="${xP(q).toFixed(1)}" y1="${mt}" x2="${xP(q).toFixed(1)}" y2="${mt+ch}" stroke="#E4E9F0" stroke-width="0.5"/>`;
  }
  for (let p = yMin; p <= yMax; p += 10) {
    svg += `<line x1="${ml}" y1="${yP(p).toFixed(1)}" x2="${ml+cw}" y2="${yP(p).toFixed(1)}" stroke="#E4E9F0" stroke-width="0.5"/>`;
  }

  /* ── Grilla mayor: 250 GPM / 20 PSI — visible y nítida ── */
  for (let q = 0; q <= xMax; q += 250) {
    svg += `<line x1="${xP(q).toFixed(1)}" y1="${mt}" x2="${xP(q).toFixed(1)}" y2="${mt+ch}" stroke="#CDD5E0" stroke-width="0.9"/>`;
  }
  for (let p = yMin; p <= yMax; p += yStep) {
    svg += `<line x1="${ml}" y1="${yP(p).toFixed(1)}" x2="${ml+cw}" y2="${yP(p).toFixed(1)}" stroke="#CDD5E0" stroke-width="0.9"/>`;
  }

  /* ── Líneas de referencia 100%Q y 150%Q ── */
  const x100 = xP(qn_gpm).toFixed(1);
  const x150 = xP(q150).toFixed(1);
  svg += `<line x1="${x100}" y1="${mt}" x2="${x100}" y2="${mt+ch}" stroke="#94A3B8" stroke-width="1.2" stroke-dasharray="6,3"/>`;
  svg += `<text x="${parseFloat(x100)+5}" y="${mt+18}" font-size="11" fill="#64748B" font-family="'Arial','Helvetica',sans-serif" font-weight="600">100%Q</text>`;
  svg += `<line x1="${x150}" y1="${mt}" x2="${x150}" y2="${mt+ch}" stroke="#94A3B8" stroke-width="1.2" stroke-dasharray="6,3"/>`;
  svg += `<text x="${parseFloat(x150)+5}" y="${mt+18}" font-size="11" fill="#64748B" font-family="'Arial','Helvetica',sans-serif" font-weight="600">150%Q</text>`;

  /* ── 4 Curvas de clasificación NFPA (punteadas, colores saturados) ── */
  NFPA.forEach(c => {
    svg += `<polyline points="${pts2str(c.pts)}" fill="none" stroke="${c.color}" stroke-width="${c.w}" stroke-dasharray="${c.dash}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
    // Marcadores en los 3 puntos clave de cada curva
    [[0, c.p0], [qn_gpm, c.p1], [q150, c.p2]].forEach(([q,p]) => {
      const x = xP(q), y = yP(p);
      if      (c.mk === 'diamond') svg += mk.diamond(x, y, 6, c.color);
      else if (c.mk === 'square')  svg += mk.square( x, y, 5.5, c.color);
      else if (c.mk === 'circle')  svg += mk.circle( x, y, 5.5, c.color);
    });
  });

  /* ── CURVA DEL FABRICANTE: negra, sólida, gruesa ──
     Representa los datos nominales de placa.
     Es la curva de referencia teórica del fabricante.     */
  svg += `<polyline points="${pts2str(ptsFab)}" fill="none" stroke="#0F172A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  // Triángulos negros sólidos en los 3 puntos de placa
  [[0, p_shut_fab], [qn_gpm, pn_psi], [q150, p150_fab]].forEach(([q,p]) => {
    svg += mk.triangle(xP(q), yP(p), 8, '#0F172A', 'white');
  });

  /* ── CURVA DE CAMPO: negra, PUNTEADA, gruesa ──
     Representa lo que mediste vos en campo.
     Es diferente de la del fabricante = eso es lo que muestra el ensayo. */
  svg += `<polyline points="${pts2str(ptsCampo)}" fill="none" stroke="#0F172A" stroke-width="3" stroke-dasharray="14,6" stroke-linecap="round" stroke-linejoin="round"/>`;
  // Círculos rojos sólidos en los 3 puntos medidos
  pm.forEach(pt => {
    svg += mk.circle(xP(pt.q), yP(pt.p), 7.5, '#DC2626', 'white');
  });

  /* ── PUNTO PUMP RATING: triángulo violeta ──
     El punto nominal (Qn, Pn) del fabricante, siempre en la curva de referencia */
  svg += mk.triangle(xP(qn_gpm), yP(pn_psi), 9, '#7C3AED', 'white');

  /* ── Ejes principales: líneas limpias y nítidas ── */
  svg += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt+ch+1}" stroke="#1E293B" stroke-width="2"/>`;
  svg += `<line x1="${ml-1}" y1="${mt+ch}" x2="${ml+cw}" y2="${mt+ch}" stroke="#1E293B" stroke-width="2"/>`;

  /* ── Borde del área de plot ── */
  svg += `<rect x="${ml}" y="${mt}" width="${cw}" height="${ch}" fill="none" stroke="#94A3B8" stroke-width="1"/>`;

  /* ── Labels eje X ── */
  for (let q = 0; q <= xMax; q += 250) {
    const x = xP(q).toFixed(1);
    svg += `<line x1="${x}" y1="${mt+ch}" x2="${x}" y2="${mt+ch+6}" stroke="#334155" stroke-width="1.2"/>`;
    svg += `<text x="${x}" y="${mt+ch+21}" text-anchor="middle" font-size="12" font-family="'Arial','Helvetica',sans-serif" fill="#334155">${q}</text>`;
  }
  svg += `<text x="${ml + cw/2}" y="${H-10}" text-anchor="middle" font-size="14" font-weight="700" font-family="'Arial','Helvetica',sans-serif" fill="#0F172A" letter-spacing="0.5">Flow — (gpm)</text>`;

  /* ── Labels eje Y ── */
  for (let p = yMin; p <= yMax; p += yStep) {
    const y = yP(p).toFixed(1);
    svg += `<line x1="${ml-6}" y1="${y}" x2="${ml}" y2="${y}" stroke="#334155" stroke-width="1.2"/>`;
    svg += `<text x="${ml-10}" y="${parseFloat(y)+4}" text-anchor="end" font-size="12" font-family="'Arial','Helvetica',sans-serif" fill="#334155">${p}</text>`;
  }
  svg += `<text transform="rotate(-90,${ml-50},${mt+ch/2})" x="${ml-50}" y="${mt+ch/2}" text-anchor="middle" font-size="14" font-weight="700" font-family="'Arial','Helvetica',sans-serif" fill="#0F172A" letter-spacing="0.5">Net Pressure — (psi)</text>`;

  /* ═══════════════════════════════════════════════════════
     LEYENDA TÉCNICO-EJECUTIVA
     Dos filas: curvas principales arriba, clasificaciones abajo
  ═══════════════════════════════════════════════════════ */
  function legLine(dash, color, w) {
    const d = dash ? `stroke-dasharray="${dash}"` : '';
    return `<svg width="32" height="20" style="vertical-align:middle"><line x1="2" y1="10" x2="30" y2="10" stroke="${color}" stroke-width="${w}" ${d} stroke-linecap="round"/></svg>`;
  }
  function legMk(tipo, color) {
    const s=20, c=10;
    if (tipo==='tri')    return `<svg width="${s}" height="${s}" style="vertical-align:middle">${mk.triangle(c,c,6,color,'white')}</svg>`;
    if (tipo==='triV')   return `<svg width="${s}" height="${s}" style="vertical-align:middle">${mk.triangle(c,c,6,'#7C3AED','white')}</svg>`;
    if (tipo==='ciR')    return `<svg width="${s}" height="${s}" style="vertical-align:middle">${mk.circle(c,c,5,'#DC2626','white')}</svg>`;
    if (tipo==='dia')    return `<svg width="${s}" height="${s}" style="vertical-align:middle">${mk.diamond(c,c,5.5,color,'white')}</svg>`;
    if (tipo==='sq')     return `<svg width="${s}" height="${s}" style="vertical-align:middle">${mk.square(c,c,4.5,color,'white')}</svg>`;
    if (tipo==='ci')     return `<svg width="${s}" height="${s}" style="vertical-align:middle">${mk.circle(c,c,4.5,color,'white')}</svg>`;
    return '';
  }

  const ITEMS_LEY = [
    // Fila 1: las 2 curvas principales
    [
      { line: legLine(null,'#0F172A',3)+legMk('tri','#0F172A'),   label: 'Curva fabricante (datos de placa)' },
      { line: legLine('14,6','#0F172A',3)+legMk('ciR','#DC2626'), label: 'Corr. to Rated Speed (campo)' },
      { line: legMk('triV','#7C3AED'),                             label: 'Pump Rating (nominal)' },
    ],
    // Fila 2: las 4 curvas de clasificación
    [
      { line: legLine('10,5','#1565C0',2)+legMk('dia','#1565C0'), label: '"Excellent" Curve (≥105%)' },
      { line: legLine('10,5','#29B6F6',2)+legMk('sq','#29B6F6'),  label: '"Good" Curve (100%)' },
      { line: legLine('10,5','#C62828',2)+legMk('ci','#C62828'),  label: '"Fair" Curve (95%)' },
      { line: legLine('10,5','#00796B',2)+legMk('sq','#00796B'),  label: '"Poor" Curve (90%)' },
    ],
  ];

  const leyHtml = `
  <div style="margin-top:12px;padding:10px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;font-family:'Arial','Helvetica',sans-serif;">
    ${ITEMS_LEY.map((fila,i) => `
      <div style="display:flex;flex-wrap:wrap;gap:6px 20px;${i===1 ? 'margin-top:6px;padding-top:6px;border-top:1px solid #E2E8F0;' : ''}">
        ${fila.map(it => `
          <span style="display:flex;align-items:center;gap:4px;white-space:nowrap;">
            ${it.line}
            <span style="font-size:11.5px;color:#334155;font-weight:500;">${it.label}</span>
          </span>`).join('')}
      </div>`).join('')}
  </div>`;

  /* ═══════════════════════════════════════════════════════
     SVG COMPLETO — fondo blanco, bordes elegantes
  ═══════════════════════════════════════════════════════ */
  const svgFull = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
    style="width:100%;height:auto;display:block;background:#fff;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.08);"
    role="img" aria-label="Curva de Desempeno — Bomba Contra Incendios NFPA 20/25">
    ${svg}
  </svg>`;

  return { svgHtml: svgFull, leyendaHtml: leyHtml };
}

/* Renderiza el gráfico en la pantalla de Curva de Desempeño (en vivo).
   Soporta re-cálculo: si el canvas original ya fue reemplazado por el SVG
   en un cálculo anterior, actualiza el contenedor existente. */
function cdRenderizarGrafico(resultado, pn_psi, qn_gpm) {
  if (_chartCurva && typeof _chartCurva.destroy === 'function') {
    try { _chartCurva.destroy(); } catch(e) {}
  }
  _chartCurva = null;

  const { svgHtml, leyendaHtml } = cdConstruirSVG(resultado, pn_psi, qn_gpm, _datosPrueba);

  const contSvg = document.getElementById('chart-curva-desempeno-svg');
  if (contSvg) {
    contSvg.innerHTML = svgHtml;              // re-cálculo: reemplaza el SVG existente
  } else {
    const el = document.getElementById('chart-curva-desempeno');
    if (el) {
      el.parentElement.style.height = 'auto';
      el.outerHTML = `<div id="chart-curva-desempeno-svg">${svgHtml}</div>`;
    }
  }
  const ley = document.getElementById('cd-leyenda-curva');
  if (ley) ley.innerHTML = leyendaHtml;
  _chartCurva = { tipo:'svg', svgHtml };
}


/* Convierte un SVG (string) a PNG dataURL — sirve para embeber en PDF */
function cdSvgAPng(svgString) {
  return new Promise(resolve => {
    if (!svgString) { resolve(null); return; }
    const m = svgString.match(/<svg[\s\S]*<\/svg>/);
    if (!m) { resolve(null); return; }
    const blob = new Blob([m[0]], { type:'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 1350; c.height = 840;   // 1.5× del viewBox 900×560 — proporción exacta
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/* Exporta el SVG visible en pantalla como PNG (pantalla en vivo) */
function cdObtenerImagenGrafico() {
  const svgEl = document.querySelector('#chart-curva-desempeno-svg svg');
  if (!svgEl) return Promise.resolve(null);
  return cdSvgAPng(new XMLSerializer().serializeToString(svgEl));
}


/* ——— Guarda la prueba en IndexedDB ——— */
async function cdGuardar() {
  if (!_datosPrueba || !_resultadoPrueba) {
    mostrarToast('Calculá la curva primero', 'error'); return;
  }
  const clienteId = document.getElementById('cd-cliente').value;
  if (!clienteId) { mostrarToast('Seleccioná un cliente', 'error'); return; }

  const prueba = {
    clienteId,
    tipo: 'curva_desempeno',
    fecha:         document.getElementById('cd-fecha').value,
    inspector:     document.getElementById('cd-inspector').value.trim(),
    // Ficha técnica completa de la bomba
    marca:         document.getElementById('cd-marca').value.trim(),
    modelo:        document.getElementById('cd-modelo').value.trim(),
    serie:         document.getElementById('cd-serie').value.trim(),
    tipoAccion:    document.getElementById('cd-tipo-accion').value,
    certificacion: document.getElementById('cd-certificacion').value,
    diamSuccion:   document.getElementById('cd-diam-suc').value.trim(),
    diamDescarga:  document.getElementById('cd-diam-desc').value.trim(),
    liquidoBombeo: document.getElementById('cd-liquido').value.trim(),
    tempBombeo:    document.getElementById('cd-temp-bombeo').value.trim(),
    controlador:   document.getElementById('cd-controlador').value.trim(),
    capacidadAgua: document.getElementById('cd-capacidad-agua').value.trim(),
    instrumentos:    document.getElementById('cd-instrumentos').value.trim(),
    observaciones:   document.getElementById('cd-observaciones').value.trim(),
    recomendaciones: document.getElementById('cd-recomendaciones')?.value.trim() || '',
    fotos:           JSON.parse(JSON.stringify(_cdFotos)),   // snapshot de fotos al guardar
    datosPrueba:     _datosPrueba,
    resultado: {
      shutoff_ok:           _resultadoPrueba.shutoff.ok,
      p_shutoff_corr:       _resultadoPrueba.shutoff.p_corr,
      clasificacion_100:    _resultadoPrueba.punto100.clasificacion.id,
      clasificacion_150:    _resultadoPrueba.punto150.clasificacion.id,
      clasificacion_global: _resultadoPrueba.clasificacion_global.id,
      cumple_nfpa:          _resultadoPrueba.cumple_nfpa,
    },
    conclusion: document.getElementById('cd-conclusion-texto').textContent,
  };

  await FireSync.add(FireDB.STORES.INSPECCIONES, {
    ...prueba,
    tipoSistema: 'bomba',
    tipoSubtipo: 'curva_desempeno',
    equipoId:  Estado.cdEquipoActual?.id  || null,
    equipoTag: Estado.cdEquipoActual?.tag || null,
    cumplimiento: _resultadoPrueba.cumple_nfpa ? 100 : 60,
  });

  mostrarToast('Prueba guardada correctamente', 'exito');
  renderizarDashboard();
}

/* ——— Genera el PDF del informe de Curva de Desempeño ——— */
/* ═══════════════════════════════════════════════════════════════
   PDF DEL INFORME DE CURVA DE DESEMPEÑO
   Núcleo que recibe todos los datos como objeto plano: sirve tanto
   para la pantalla en vivo como para pruebas guardadas en historial.
═══════════════════════════════════════════════════════════════ */

const CD_TIPO_ACCION_TXT = { electrico:'Eléctrico', diesel:'Diesel / Motor a combustión', vapor:'Vapor' };
const CD_CERT_TXT        = { ul_fm:'UL / FM Listed', ul:'UL Listed', fm:'FM Approved', ninguna:'Sin certificación' };
const CD_METODO_TXT      = { pitot:'Tubo Pitot (NFPA 291)', caudal:'Caudalímetro certificado', manual:'Caudal registrado manualmente' };

/* ════════════════════════════════════════════════════════════════════
   MOTOR PDF v3 — Informe Técnico Institucional
   Estructura: Carátula · Encabezado institucional en cada hoja ·
   Secciones numeradas · Sin sellos de fecha de impresión
════════════════════════════════════════════════════════════════════ */

function cdGenerarCodigoInforme(fecha, nombreCliente) {
  const d   = fecha ? new Date(fecha + 'T12:00:00') : new Date();
  const ym  = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`;
  const cli = (nombreCliente || 'CLI').toUpperCase()
              .replace(/[^A-Z0-9]/g,'').substring(0, 8);
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `BCI-${ym}-${cli}-${seq}`;
}

/* ── Helpers de imagen ── */
function _pdfDims(doc, dataUrl, maxW, maxH) {
  try {
    const p = doc.getImageProperties(dataUrl);
    const r = Math.min(maxW / p.width, maxH / p.height);
    return { w: p.width * r, h: p.height * r };
  } catch(e) { return null; }
}
function _pdfFmt(u) { return (u||'').startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'; }

/* ── Encabezado institucional (todas las hojas excepto carátula) ──
   Replica el estilo tabla del informe Colgate:
   [Logo PBSH | INFORME TÉCNICO | Código]
   [           | Título subtema  |       ]
   [Cliente    | Planta/Dir      | Ciudad ]           */
function _pdfEncabezado(doc, d, codigo, hoja, totalHojas) {
  const pw  = doc.internal.pageSize.getWidth();
  const logoEmp = Estado.config?.logoEmpresa || null;
  const logoCli = d.cliente?.logoDataUrl || null;

  // Fila 1: logos + "INFORME TÉCNICO" + código del informe
  const fila1H = 16;
  // Borde exterior
  doc.setDrawColor(160, 160, 160); doc.setLineWidth(0.4);
  doc.rect(8, 6, pw - 16, fila1H, 'S');

  // Columna logo empresa (izq)
  doc.line(8 + 38, 6, 8 + 38, 6 + fila1H);
  if (logoEmp) {
    const dd = _pdfDims(doc, logoEmp, 34, 12);
    if (dd) try { doc.addImage(logoEmp, _pdfFmt(logoEmp), 10, 8, dd.w, dd.h); } catch(e){}
  } else {
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(176,58,46);
    doc.text(Estado.config?.empresa || 'PBSH', 10 + 19, 6 + fila1H/2 + 1.5, { align:'center' });
  }

  // Columna central: "INFORME TÉCNICO"
  doc.line(pw - 8 - 38, 6, pw - 8 - 38, 6 + fila1H);
  doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(30,30,30);
  doc.text('INFORME TÉCNICO', pw/2, 6 + fila1H/2 + 1.5, { align:'center' });

  // Columna logo cliente (der) + código
  if (logoCli) {
    const dd = _pdfDims(doc, logoCli, 34, 12);
    if (dd) try { doc.addImage(logoCli, _pdfFmt(logoCli), pw - 8 - dd.w - 2, 8, dd.w, dd.h); } catch(e){}
  } else {
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(30,30,30);
    doc.text(codigo, pw - 8 - 19, 6 + fila1H/2 + 1.5, { align:'center' });
  }

  // Fila 2: "PRUEBA DE PERFORMANCE BOMBAS CONTRA INCENDIO" centrado
  const fila2H = 9;
  doc.rect(8, 6 + fila1H, pw - 16, fila2H, 'S');
  doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(30,30,30);
  doc.text('PRUEBA DE PERFORMANCE — BOMBA CONTRA INCENDIO', pw/2, 6 + fila1H + fila2H/2 + 1.5, { align:'center' });

  // Fila 3: Cliente | Planta / Dirección | Ciudad · HOJA X DE Y
  const fila3H = 8;
  doc.rect(8, 6 + fila1H + fila2H, pw - 16, fila3H, 'S');
  const f3y = 6 + fila1H + fila2H + fila3H/2 + 1.5;
  const tW = (pw - 16) / 3;
  doc.line(8 + tW, 6 + fila1H + fila2H, 8 + tW, 6 + fila1H + fila2H + fila3H);
  doc.line(8 + tW*2, 6 + fila1H + fila2H, 8 + tW*2, 6 + fila1H + fila2H + fila3H);
  doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(30,30,30);
  doc.text(d.cliente?.nombre || '', 8 + tW/2, f3y, { align:'center', maxWidth: tW - 4 });
  doc.text(d.cliente?.direccion || '', 8 + tW + tW/2, f3y, { align:'center', maxWidth: tW - 4 });
  doc.setFont(undefined,'bold');
  doc.text(`HOJA: ${hoja}   DE: ${totalHojas}`, 8 + tW*2 + tW/2, f3y, { align:'center' });

  doc.setTextColor(30,30,30);
  return 6 + fila1H + fila2H + fila3H + 6; // y de inicio de contenido
}

/* ── Pie de revisión (todas las hojas excepto carátula) ── */
function _pdfPieRevision(doc, codigo, fecha) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const pieH = 8;
  doc.setDrawColor(160,160,160); doc.setLineWidth(0.3);
  doc.rect(8, ph - pieH - 4, pw - 16, pieH, 'S');
  const tW = (pw - 16) / 3;
  doc.line(8 + tW, ph - pieH - 4, 8 + tW, ph - 4);
  doc.line(8 + tW*2, ph - pieH - 4, 8 + tW*2, ph - 4);
  const py = ph - pieH - 4 + pieH/2 + 1.5;
  doc.setFontSize(6.5); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80);
  doc.text('REVISIÓN:  00', 8 + tW/2, py, { align:'center' });
  doc.setFont(undefined,'bold');
  doc.text(codigo, 8 + tW + tW/2, py, { align:'center' });
  doc.setFont(undefined,'normal');
  const fechaStr = fecha ? new Date(fecha+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
  doc.text(`FECHA:  ${fechaStr}`, 8 + tW*2 + tW/2, py, { align:'center' });
}

/* ────────────────────────────────────────────────────────────────
   CARÁTULA — Página 1, diseño institucional limpio
──────────────────────────────────────────────────────────────── */
function _pdfCaratula(doc, d, codigo) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const logoEmp = Estado.config?.logoEmpresa || null;
  const logoCli = d.cliente?.logoDataUrl || null;

  // ── Encabezado institucional (misma tabla que el resto) ──
  const yPost = _pdfEncabezado(doc, d, codigo, 1, '?'); // total se actualiza al final
  // no hay pie en carátula

  // ── Zona central ejecutiva ──
  const zonaCentroY = ph * 0.32;

  // Línea decorativa superior roja
  doc.setFillColor(176, 58, 46);
  doc.rect(8, zonaCentroY - 2, pw - 16, 1.5, 'F');

  // Título principal
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(22); doc.setFont(undefined,'bold');
  doc.text('INFORME TÉCNICO', pw/2, zonaCentroY + 16, { align:'center' });

  doc.setFontSize(14); doc.setFont(undefined,'normal');
  doc.text('PROTECCIÓN CONTRA INCENDIO', pw/2, zonaCentroY + 26, { align:'center' });

  // Línea decorativa inferior roja
  doc.setFillColor(176, 58, 46);
  doc.rect(8, zonaCentroY + 32, pw - 16, 1.5, 'F');

  // Subtítulo ensayo
  doc.setTextColor(176, 58, 46);
  doc.setFontSize(13); doc.setFont(undefined,'bold');
  doc.text('PRUEBA DE PERFORMANCE — BOMBA CONTRA INCENDIO', pw/2, zonaCentroY + 44, { align:'center' });

  // Código del informe centrado
  doc.setFontSize(10); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80);
  doc.text(codigo, pw/2, zonaCentroY + 54, { align:'center' });

  // Logo cliente grande centrado
  if (logoCli) {
    const dd = _pdfDims(doc, logoCli, 70, 40);
    if (dd) try {
      doc.addImage(logoCli, _pdfFmt(logoCli), (pw-dd.w)/2, zonaCentroY + 64, dd.w, dd.h);
    } catch(e) {}
  }

  // ── Tabla de identificación inferior ──
  const tabY = ph * 0.72;
  const tabH = 8;
  const col1w = 40, col2w = pw - 16 - col1w*2;

  // Datos del informe en tabla 2 columnas
  const filas = [
    [d.cliente?.nombre || '',      d.fecha ? new Date(d.fecha+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'}) : ''],
    [d.cliente?.direccion || '',   d.inspector || Estado.config?.inspector || ''],
    [Estado.config?.empresa || '', `NFPA 20 / NFPA 25 — §8.3.3`],
  ];
  const hdrs = [['CLIENTE','FECHA DE PRUEBA'],['DIRECCIÓN / PLANTA','INSPECTOR'],['EMPRESA INSPECTORA','NORMAS DE APLICACIÓN']];

  doc.setDrawColor(160,160,160); doc.setLineWidth(0.3);
  const totalTabH = (tabH * 2 + 1) * filas.length;
  doc.rect(8, tabY, pw - 16, totalTabH, 'S');

  filas.forEach((fila, i) => {
    const fy = tabY + i * (tabH * 2 + 1);
    if (i > 0) doc.line(8, fy, pw - 8, fy);
    doc.line(pw/2, fy, pw/2, fy + tabH*2);

    // Labels
    doc.setFontSize(6.5); doc.setFont(undefined,'bold'); doc.setTextColor(120,120,120);
    doc.text(hdrs[i][0], 12, fy + 5);
    doc.text(hdrs[i][1], pw/2 + 4, fy + 5);
    // Valores
    doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
    doc.text(String(fila[0]), 12, fy + 5 + 6, { maxWidth: pw/2 - 16 });
    doc.text(String(fila[1]), pw/2 + 4, fy + 5 + 6, { maxWidth: pw/2 - 16 });
  });

  // ── Tabla de revisión inferior (estilo portada) ──
  const revY = ph - 22;
  doc.rect(8, revY, pw - 16, 14, 'S');
  const rW = (pw-16)/3;
  doc.line(8+rW, revY, 8+rW, revY+14);
  doc.line(8+rW*2, revY, 8+rW*2, revY+14);
  doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(60,60,60);
  doc.text('REVISIÓN', 8+rW*0.3, revY+5);
  doc.text('00', 8+rW*0.3, revY+11);
  doc.text('FECHA', 8+rW*0.15, revY+5);
  const fechaStr = d.fecha ? new Date(d.fecha+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
  // Reorganizar pie de portada
  doc.setFont(undefined,'bold');
  doc.text('REVISIÓN', 10, revY+5); doc.setFont(undefined,'normal'); doc.text('00', 10, revY+11);
  doc.setFont(undefined,'bold');
  doc.text('FECHA', 10+rW, revY+5); doc.setFont(undefined,'normal'); doc.text(fechaStr, 10+rW, revY+11);
  doc.setFont(undefined,'bold');
  doc.text(codigo, 8+rW*2 + rW/2, revY+8, { align:'center' });
}

/* ────────────────────────────────────────────────────────────────
   NÚCLEO PDF — Genera el informe completo
──────────────────────────────────────────────────────────────── */
async function cdGenerarPDFNucleo(d) {
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw   = doc.internal.pageSize.getWidth();
  const ph   = doc.internal.pageSize.getHeight();
  const dp   = d.datosPrueba;
  const R    = d.resultado;

  const codigo   = cdGenerarCodigoInforme(d.fecha, d.cliente?.nombre);
  const fechaStr = d.fecha ? new Date(d.fecha+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'}) : '';
  const margenInf = ph - 18; // zona segura antes del pie

  /* Helpers de layout */
  let paginaActual = 1;
  const paginas    = [];   // se llenan al cerrar cada página

  function nuevaPagina(yInicio) {
    _pdfPieRevision(doc, codigo, d.fecha);
    doc.addPage();
    paginaActual++;
    return _pdfEncabezado(doc, d, codigo, paginaActual, '?');
  }

  function checkSalto(y, necesita) {
    if (y + necesita > margenInf) return nuevaPagina(y);
    return y;
  }

  /* ── SECCION helper ── */
  function seccion(titulo, y) {
    y = checkSalto(y, 14);
    doc.setFillColor(176, 58, 46);
    doc.rect(8, y - 1, pw - 16, 8, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(8); doc.setFont(undefined,'bold');
    doc.text(titulo.toUpperCase(), 12, y + 4.5);
    doc.setTextColor(20,20,20);
    return y + 12;
  }

  function fila(lbl, val, x, y, wLbl) {
    if (!val && val !== 0) return y;
    const v = String(val);
    doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(100,110,120);
    doc.text(lbl + ':', x, y);
    doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
    doc.text(v, x + wLbl, y, { maxWidth: pw/2 - wLbl - 10 });
    return y;
  }

  /* ══════════════════════════════════════════════════════
     PÁGINA 1: CARÁTULA
  ══════════════════════════════════════════════════════ */
  _pdfCaratula(doc, d, codigo);

  /* ══════════════════════════════════════════════════════
     PÁGINA 2: OBJETIVO · NORMAS · DESCRIPCIÓN · INSTRUMENTOS
  ══════════════════════════════════════════════════════ */
  doc.addPage(); paginaActual++;
  let y = _pdfEncabezado(doc, d, codigo, paginaActual, '?');

  /* 1. OBJETIVO */
  y = seccion('1. Objetivo', y);
  doc.setFontSize(8.5); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
  const txtObjetivo = `El objetivo es realizar la curva de desempeño presión-caudal de la bomba contra incendios y verificar el cumplimiento de los criterios de aceptación exigidos por la N.F.P.A. Los resultados permiten determinar si la bomba cumple con las condiciones de diseño del sistema de protección activa contra incendios.`;
  const linObj = doc.splitTextToSize(txtObjetivo, pw - 20);
  y = checkSalto(y, linObj.length * 4.5 + 4);
  doc.text(linObj, 10, y); y += linObj.length * 4.5 + 7;

  /* 2. NORMAS DE APLICACIÓN */
  y = seccion('2. Normas de aplicación', y);
  const normas = ['NFPA 20 — Standard for the Installation of Stationary Pumps for Fire Protection.', 'NFPA 25 — Standard for the Inspection, Testing, and Maintenance of Water-Based Fire Protection Systems.', 'NFPA 25 — §8.3.3: Annual fire pump performance test.'];
  normas.forEach(n => {
    y = checkSalto(y, 7);
    doc.setFillColor(245,245,245); doc.rect(10, y-3.5, pw-20, 6.5, 'F');
    doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
    doc.text('•  ' + n, 13, y, { maxWidth: pw - 24 });
    y += 7;
  });
  y += 4;

  /* 3. DESCRIPCIÓN DEL ENSAYO */
  y = seccion('3. Descripción del ensayo', y);
  const metodo = d.metodoQ || 'pitot';
  const metodoTxt = metodo === 'pitot'
    ? 'Se utilizó un cabezal de prueba con boquillas y Tubo Pitot para la medición de caudal (NFPA 291). Las lecturas de presión dinámica en las boquillas permiten calcular el caudal mediante la fórmula Q = 29.84 × Cd × d² × √P_pitot.'
    : metodo === 'caudal'
      ? 'Se utilizó un caudalímetro certificado para la medición directa del caudal en cada punto de ensayo.'
      : 'El caudal fue registrado manualmente por el inspector en base a las condiciones de campo.';
  const txtDesc = `La medición de los distintos puntos de la curva se tomó en el cabezal de pruebas dispuesto en la línea de descarga. A cada posición le corresponde un valor de presión de succión y descarga leído en los manómetros de la bomba, representados en el eje de ordenadas del gráfico Presión vs. Caudal.\n${metodoTxt}`;
  const linDesc = doc.splitTextToSize(txtDesc, pw - 20);
  y = checkSalto(y, linDesc.length * 4.5 + 4);
  doc.setFontSize(8.5); doc.setFont(undefined,'normal');
  doc.text(linDesc, 10, y); y += linDesc.length * 4.5 + 7;

  /* 4. INSTRUMENTOS UTILIZADOS */
  y = seccion('4. Instrumentos utilizados', y);
  let listaInstr = [];
  if (d.instrumentos) {
    listaInstr = d.instrumentos.split(/[\n·•,]+/).map(s=>s.trim()).filter(Boolean);
  }
  if (listaInstr.length === 0) {
    // Instrumentos por defecto según método
    listaInstr = metodo === 'pitot'
      ? ['Tubo Pitot (NFPA 291)', 'Manómetro de descarga — propio de la instalación', 'Manovacuómetro de succión — propio de la instalación', 'Tacómetro digital portátil']
      : ['Caudalímetro certificado', 'Manómetro de descarga', 'Manovacuómetro de succión', 'Tacómetro digital portátil'];
  }
  listaInstr.forEach((inst, idx) => {
    y = checkSalto(y, 7);
    if (idx % 2 === 0) { doc.setFillColor(248,248,248); doc.rect(10, y-3.5, pw-20, 6.5, 'F'); }
    doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
    doc.text(`${idx+1}.  ${inst}`, 13, y, { maxWidth: pw - 26 });
    y += 7;
  });
  y += 6;

  /* ══════════════════════════════════════════════════════
     PÁGINA 3+: RESULTADOS DEL ENSAYO
  ══════════════════════════════════════════════════════ */
  _pdfPieRevision(doc, codigo, d.fecha);
  doc.addPage(); paginaActual++;
  y = _pdfEncabezado(doc, d, codigo, paginaActual, '?');

  /* 5. RESULTADOS DEL ENSAYO */
  y = seccion('5. Resultados del ensayo', y);

  /* 5.1 Datos de identificación de la bomba */
  doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(176,58,46);
  doc.text('5.1  Motobomba — Datos de placa', 10, y); y += 7;

  const pShutFab = dp.p_shutoff_fab_psi || (dp.pn_psi * 1.40);
  const p150fab  = dp.p150_fab_psi      || (dp.pn_psi * 0.65);
  const q150fab  = (dp.qn_gpm * 1.5);

  // Grilla de datos en 2 columnas
  const col1d = [
    ['Marca',              d.marca || ''],
    ['Modelo',             d.modelo || ''],
    ['N.° de serie',       d.serie || ''],
    ['Tipo de accionamiento', d.tipoAccionTxt || ''],
    ['Certificación',      d.certTxt || ''],
    ['Diám. succión',      d.diamSuc ? d.diamSuc + ' in' : ''],
    ['Diám. descarga',     d.diamDesc ? d.diamDesc + ' in' : ''],
  ].filter(r => r[1]);
  const col2d = [
    ['Caudal nominal (Qn)', `${dp.qn_gpm} GPM — ${Unidades.gpmALmin(dp.qn_gpm).toFixed(0)} L/min`],
    ['Presión nominal (Pn)', `${dp.pn_psi} PSI — ${Unidades.psiABar(dp.pn_psi).toFixed(2)} bar`],
    ['Velocidad nominal',   `${dp.nn_rpm} RPM`],
    ['Controlador',         d.controlador || ''],
    ['Líquido bombeado',    d.liquidoBombeo || ''],
    ['Temperatura',         d.tempBombeo || ''],
    ['Depósito / Capacidad', d.capacidadAgua || ''],
  ].filter(r => r[1]);

  const maxD = Math.max(col1d.length, col2d.length);
  const yIniD = y;
  const midX  = pw / 2 + 2;
  for (let i = 0; i < maxD; i++) {
    y = checkSalto(y, 6);
    if (col1d[i]) fila(col1d[i][0], col1d[i][1], 10, y, 38);
    if (col2d[i]) fila(col2d[i][0], col2d[i][1], midX, y, 42);
    y += 5.5;
  }
  y += 5;

  /* Verificación de parámetros NFPA */
  doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(176,58,46);
  y = checkSalto(y, 10);
  doc.text('Verificación de parámetros exigidos por N.F.P.A. 20 / N.F.P.A. 25', 10, y); y += 5;
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
  const txtVerif = `La N.F.P.A. 25 establece que al 150% del caudal nominal la presión no debe ser inferior al 65% de la presión nominal. Además, la presión a caudal cero (shutoff) no debe superar el 140% de la presión nominal.`;
  const linVerif = doc.splitTextToSize(txtVerif, pw - 20);
  doc.text(linVerif, 10, y); y += linVerif.length * 4.5 + 3;

  // Límites específicos de esta bomba
  doc.setFillColor(240, 244, 248);
  doc.rect(10, y, pw-20, 14, 'F');
  doc.setDrawColor(176,58,46); doc.setLineWidth(0.8);
  doc.line(10, y, 10, y+14);
  doc.setDrawColor(160,160,160); doc.setLineWidth(0.3);
  doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
  doc.text(`Para esta bomba (Qn = ${dp.qn_gpm} GPM, Pn = ${dp.pn_psi} PSI):`, 14, y + 5);
  doc.setFont(undefined,'normal');
  doc.text(`Q = 0 (Shutoff): Presión máxima admitida = ${pShutFab.toFixed(1)} PSI  (140% × ${dp.pn_psi} PSI)`, 14, y + 10);
  doc.text(`Q = ${q150fab.toFixed(0)} GPM (150% Qn): Presión mínima requerida = ${p150fab.toFixed(1)} PSI  (65% × ${dp.pn_psi} PSI)`, 14 + (pw-34)/2, y + 10);
  y += 19;

  /* 5.2 Tabla de puntos medidos */
  doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(176,58,46);
  y = checkSalto(y, 10);
  doc.text('5.2  Puntos de medición registrados en campo', 10, y); y += 7;

  // Tabla: Punto | P suc | P desc | V.Head | RPM | P neta corr. | Q corr. | Clasificación
  const thW  = [28, 20, 20, 18, 18, 24, 22, pw - 16 - 28 - 20 - 20 - 18 - 18 - 24 - 22];
  const thX  = [8];
  thW.forEach((w,i) => thX.push(thX[i]+w));
  const thH  = 14; // alto encabezado (2 líneas)
  const trH  = 7;
  const thLabels = ['Punto de\nmedición','P suc.\n(PSI)','P desc.\n(PSI)','Vel.Head\n(PSI)','RPM\nmedidos','P neta corr.\n(PSI)','Q corr.\n(GPM)','Clasificación NFPA 20'];

  y = checkSalto(y, thH + trH * 3 + 4);
  // Encabezado
  doc.setFillColor(52, 58, 64); doc.rect(8, y, pw-16, thH, 'F');
  thLabels.forEach((lbl, ci) => {
    doc.setFontSize(6.5); doc.setFont(undefined,'bold'); doc.setTextColor(255,255,255);
    const lineas = lbl.split('\n');
    lineas.forEach((l, li) => doc.text(l, thX[ci]+2, y + 5 + li * 4.5));
  });
  y += thH;

  // Filas de datos
  const ptData = [
    { lbl:'Shutoff (Q = 0)', pSuc: dp.p_suc_shutoff, pDesc: dp.p_desc_shutoff, vHead: null, rpm: dp.rpm_shutoff, pNeta: R.shutoff.p_corr, qCorr: 0,
      clas: R.shutoff.ok ? `OK — dentro del límite máximo (${pShutFab.toFixed(1)} PSI)` : `FALLA — supera el límite (${pShutFab.toFixed(1)} PSI)`, ok: R.shutoff.ok },
    { lbl:`100% Qn (${R.punto100.q_corr.toFixed(0)} GPM)`, pSuc: dp.p_suc_100, pDesc: dp.p_desc_100, vHead: null, rpm: dp.rpm_100,
      pNeta: R.punto100.p_corr, qCorr: R.punto100.q_corr,
      clas: `${R.punto100.clasificacion.labelEs} — ${R.punto100.clasificacion.porcentaje.toFixed(1)}% de Pn`, ok: true },
    { lbl:`150% Qn (${R.punto150.q_corr.toFixed(0)} GPM)`, pSuc: dp.p_suc_150, pDesc: dp.p_desc_150, vHead: null, rpm: dp.rpm_150,
      pNeta: R.punto150.p_corr, qCorr: R.punto150.q_corr,
      clas: `${R.punto150.clasificacion.labelEs} — ${R.punto150.clasificacion.porcentaje.toFixed(1)}% del mínimo NFPA`, ok: true },
  ];

  ptData.forEach((pt, ri) => {
    if (ri % 2 === 0) { doc.setFillColor(246,248,250); doc.rect(8, y, pw-16, trH, 'F'); }
    const vals = [
      pt.lbl,
      pt.pSuc != null ? pt.pSuc.toFixed(1) : '—',
      pt.pDesc != null ? pt.pDesc.toFixed(1) : '—',
      pt.vHead != null ? pt.vHead.toFixed(1) : '—',
      pt.rpm   != null ? String(Math.round(pt.rpm)) : '—',
      pt.pNeta != null ? pt.pNeta.toFixed(1) : '—',
      pt.qCorr != null ? pt.qCorr.toFixed(0) : '—',
      pt.clas,
    ];
    vals.forEach((v, ci) => {
      doc.setFontSize(7); doc.setFont(undefined, ci===0?'bold':'normal'); doc.setTextColor(20,20,20);
      doc.text(v, thX[ci]+2, y + trH/2 + 1.5, { maxWidth: thW[ci]-3 });
    });
    if (ri < ptData.length-1) {
      doc.setDrawColor(220,225,230); doc.setLineWidth(0.2);
      doc.line(8, y+trH, pw-8, y+trH);
    }
    y += trH;
  });
  doc.setDrawColor(160,160,160); doc.setLineWidth(0.3);
  doc.rect(8, y - ptData.length*trH - thH, pw-16, thH + ptData.length*trH, 'S');
  y += 8;

  /* ══════════════════════════════════════════════════════
     GRÁFICO: curva P vs Q
  ══════════════════════════════════════════════════════ */
  if (d.imgData) {
    const gW = pw - 16;
    const gH = gW * (560/900);
    _pdfPieRevision(doc, codigo, d.fecha);
    doc.addPage(); paginaActual++;
    y = _pdfEncabezado(doc, d, codigo, paginaActual, '?');

    y = seccion('6. Curva de desempeño — Presión vs. Caudal', y);
    y = checkSalto(y, gH + 4);
    doc.addImage(d.imgData, 'PNG', 8, y, gW, gH);
    y += gH + 10;
  }

  /* ══════════════════════════════════════════════════════
     PÁGINA: CONCLUSIONES
  ══════════════════════════════════════════════════════ */
  _pdfPieRevision(doc, codigo, d.fecha);
  doc.addPage(); paginaActual++;
  y = _pdfEncabezado(doc, d, codigo, paginaActual, '?');

  const numConc = d.imgData ? '7' : '6';
  y = seccion(`${numConc}. Conclusiones`, y);

  // Conclusión auto-generada + la del inspector
  const clsGlobal = R.clasificacion_global?.labelEs || '';
  const cumple    = R.cumple_nfpa;
  doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
  doc.text('Motobomba:', 10, y); y += 6;
  doc.setFont(undefined,'normal');

  if (d.conclusion) {
    const linConc = doc.splitTextToSize(d.conclusion, pw - 20);
    linConc.forEach(l => {
      y = checkSalto(y, 5.5);
      doc.text((l.startsWith('•') ? '' : '') + l, 10, y, { maxWidth: pw - 20 });
      y += 5;
    });
  }
  y += 4;

  // Observaciones
  if (d.observaciones) {
    y = checkSalto(y, 10);
    doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
    doc.text('Observaciones de campo:', 10, y); y += 6;
    doc.setFont(undefined,'normal');
    const linObs = doc.splitTextToSize(d.observaciones, pw - 20);
    linObs.forEach(l => { y = checkSalto(y, 5.5); doc.text(l, 10, y); y += 5; });
    y += 4;
  }

  /* ══════════════════════════════════════════════════════
     RECOMENDACIONES
  ══════════════════════════════════════════════════════ */
  if (d.recomendaciones) {
    const numRec = parseInt(numConc) + 1;
    y = checkSalto(y, 20);
    y = seccion(`${numRec}. Recomendaciones`, y);
    const linRec = d.recomendaciones.split(/[\n]+/).map(s=>s.trim()).filter(Boolean);
    linRec.forEach(l => {
      const alto = Math.ceil(doc.splitTextToSize(l, pw - 28).length) * 4.5 + 4;
      y = checkSalto(y, alto + 3);
      doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(20,20,20);
      doc.setFillColor(245,245,245); doc.rect(10, y-3, pw-20, alto, 'F');
      doc.setFillColor(176,58,46); doc.rect(10, y-3, 3, alto, 'F');
      const linP = doc.splitTextToSize(l, pw - 32);
      doc.text(linP, 16, y); y += alto + 3;
    });
    y += 4;
  }

  /* ══════════════════════════════════════════════════════
     FOTOS
  ══════════════════════════════════════════════════════ */
  const catLabels = { 'foto-bomba':'Bomba completa', 'foto-placa':'Placa del fabricante', 'foto-manometros':'Manómetros', 'foto-tablero':'Tablero / Controlador', 'foto-extra':'Foto adicional' };
  const todasFotos = [];
  if (d.fotos) {
    Object.entries(d.fotos).forEach(([cat, arr]) => {
      (arr||[]).forEach(f => { if(f?.dataUrl) todasFotos.push({ dataUrl:f.dataUrl, cat }); });
    });
  }
  if (todasFotos.length > 0) {
    const numFot = parseInt(numConc) + (d.recomendaciones ? 2 : 1);
    _pdfPieRevision(doc, codigo, d.fecha);
    doc.addPage(); paginaActual++;
    y = _pdfEncabezado(doc, d, codigo, paginaActual, '?');
    y = seccion(`${numFot}. Registro fotográfico`, y);
    const fW = (pw - 26) / 2;
    const fH = fW * 0.72;
    let col = 0;
    todasFotos.forEach((f, idx) => {
      if (col === 0 && idx > 0) { y += fH + 12; col = 0; }
      const fx = col === 0 ? 8 : 8 + fW + 10;
      y = checkSalto(y, fH + 12);
      try {
        doc.addImage(f.dataUrl, _pdfFmt(f.dataUrl), fx, y, fW, fH);
        doc.setFontSize(7); doc.setFont(undefined,'italic'); doc.setTextColor(80,80,80);
        doc.text(`Ilustración ${idx+1} — ${catLabels[f.cat]||f.cat}`, fx + fW/2, y + fH + 4, { align:'center' });
      } catch(e) {}
      col = col === 0 ? 1 : 0;
      if (col === 0) y += fH + 12;
    });
    y += fH + 12;
  }

  /* ══════════════════════════════════════════════════════
     FIRMA DEL PROFESIONAL
  ══════════════════════════════════════════════════════ */
  const firma = Estado.config?.firmaPredeterminada || null;
  if (firma || d.inspector) {
    y = checkSalto(y, 50);

    // Firma
    if (firma) {
      const dd = _pdfDims(doc, firma, 60, 25);
      if (dd) try { doc.addImage(firma, 'PNG', pw/2 - dd.w/2, y, dd.w, dd.h); y += dd.h + 4; } catch(e){}
    } else { y += 20; }

    // Línea y datos
    doc.setDrawColor(60,60,60); doc.setLineWidth(0.5);
    doc.line(pw/2 - 35, y, pw/2 + 35, y); y += 5;
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
    doc.text(d.inspector || Estado.config?.inspector || '', pw/2, y, { align:'center' }); y += 5;
    doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80);
    doc.text(Estado.config?.empresa || '', pw/2, y, { align:'center' }); y += 5;
    doc.text(fechaStr, pw/2, y, { align:'center' });
  }

  /* ══════════════════════════════════════════════════════
     NUMERACIÓN: actualizar total en todas las páginas
  ══════════════════════════════════════════════════════ */
  _pdfPieRevision(doc, codigo, d.fecha);
  const total = doc.internal.getNumberOfPages();

  // Re-imprimir encabezados con número total correcto
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    // Reescribir solo la celda HOJA/DE en la fila 3 del encabezado
    const fila3Y = 6 + 16 + 9 + 8/2 + 1.5;
    const tW2 = (pw - 16) / 3;
    // Cubrir el texto anterior
    doc.setFillColor(255,255,255);
    doc.rect(8 + tW2*2 + 1, fila3Y - 5, tW2 - 2, 6, 'F');
    doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(30,30,30);
    doc.text(`HOJA: ${p}   DE: ${total}`, 8 + tW2*2 + tW2/2, fila3Y, { align:'center' });
  }

  // Nombre de archivo
  const clienteTag = (d.cliente?.nombre||'Bomba').toUpperCase().replace(/[^A-Z0-9]/g,'_').replace(/_+/g,'_');
  const fechaTag   = (d.fecha||new Date().toISOString().split('T')[0]).replace(/-/g,'');
  doc.save(`${codigo}_DesempeñoBomba_${clienteTag}_${fechaTag}.pdf`);
}

/* ── PDF desde pantalla en vivo ── */
async function cdGenerarPDF() {
  if (!_resultadoPrueba) { mostrarToast('Calculá la curva primero', 'error'); return; }
  mostrarToast('Generando informe...');
  const clienteId = document.getElementById('cd-cliente').value;
  const cliente   = await FireDB.get(FireDB.STORES.CLIENTES, clienteId || '');
  const selAcc    = document.getElementById('cd-tipo-accion');
  const selCert   = document.getElementById('cd-certificacion');
  const fotosActuales = {};
  Object.entries(_cdFotos).forEach(([cat, arr]) => { fotosActuales[cat] = arr.filter(Boolean); });
  // Detectar método de caudal activo
  const metodoQ = document.querySelector('input[name="cd-metodo-q"]:checked')?.value
                 || (document.getElementById('cd-pitot-panel')?.style.display !== 'none' ? 'pitot' : 'manual');
  await cdGenerarPDFNucleo({
    cliente,
    fecha:           document.getElementById('cd-fecha').value,
    inspector:       document.getElementById('cd-inspector').value.trim(),
    marca:           document.getElementById('cd-marca').value.trim(),
    modelo:          document.getElementById('cd-modelo').value.trim(),
    serie:           document.getElementById('cd-serie').value.trim(),
    tipoAccionTxt:   selAcc.options[selAcc.selectedIndex].text,
    certTxt:         selCert.options[selCert.selectedIndex].text,
    diamSuc:         document.getElementById('cd-diam-suc').value.trim(),
    diamDesc:        document.getElementById('cd-diam-desc').value.trim(),
    liquidoBombeo:   document.getElementById('cd-liquido').value.trim(),
    tempBombeo:      document.getElementById('cd-temp-bombeo').value.trim(),
    controlador:     document.getElementById('cd-controlador').value.trim(),
    capacidadAgua:   document.getElementById('cd-capacidad-agua').value.trim(),
    datosPrueba:     _datosPrueba,
    resultado:       _resultadoPrueba,
    conclusion:      document.getElementById('cd-conclusion-texto').textContent,
    observaciones:   document.getElementById('cd-observaciones').value.trim(),
    recomendaciones: document.getElementById('cd-recomendaciones')?.value.trim() || '',
    instrumentos:    document.getElementById('cd-instrumentos').value.trim(),
    metodoQ,
    fotos:           fotosActuales,
    imgData:         await cdObtenerImagenGrafico(),
  });
  mostrarToast('Informe PDF generado', 'exito');
}

/* ── PDF desde prueba GUARDADA ── */
async function cdGenerarPDFGuardado(insp, cliente) {
  if (!insp?.datosPrueba) { mostrarToast('La prueba guardada no tiene datos completos', 'error'); return; }
  mostrarToast('Generando informe...');
  const resultado = CurvaDesempeno.analizarCurvaDesempeno(insp.datosPrueba);
  const { svgHtml } = cdConstruirSVG(resultado, insp.datosPrueba.pn_psi, insp.datosPrueba.qn_gpm, insp.datosPrueba);
  const imgData = await cdSvgAPng(svgHtml);
  await cdGenerarPDFNucleo({
    cliente,
    fecha:           insp.fecha,
    inspector:       insp.inspector,
    marca:           insp.marca,
    modelo:          insp.modelo,
    serie:           insp.serie,
    tipoAccionTxt:   CD_TIPO_ACCION_TXT[insp.tipoAccion] || insp.tipoAccion || '-',
    certTxt:         CD_CERT_TXT[insp.certificacion]     || insp.certificacion || '-',
    diamSuc:         insp.diamSuccion,
    diamDesc:        insp.diamDescarga,
    liquidoBombeo:   insp.liquidoBombeo   || '',
    tempBombeo:      insp.tempBombeo      || '',
    controlador:     insp.controlador     || '',
    capacidadAgua:   insp.capacidadAgua   || '',
    datosPrueba:     insp.datosPrueba,
    resultado,
    conclusion:      insp.conclusion,
    observaciones:   insp.observaciones,
    recomendaciones: insp.recomendaciones || '',
    instrumentos:    insp.instrumentos,
    metodoQ:         insp.metodoQ || 'pitot',
    fotos:           insp.fotos   || {},
    imgData,
  });
  mostrarToast('Informe PDF generado', 'exito');
}

/* ═══════════════════════════════════════════════════════════════════
   GENERADOR DE CÓDIGO DE INFORME
   Formato: BCI-YYYYMM-CLIENTE-XXX
   Ej: BCI-202506-CARGILL-001
═══════════════════════════════════════════════════════════════════ */
function cdGenerarCodigoInforme(fecha, nombreCliente) {
  const d   = fecha ? new Date(fecha + 'T12:00:00') : new Date();
  const ym  = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`;
  const cli = (nombreCliente || 'CLI').toUpperCase()
              .replace(/[^A-Z0-9]/g,'').substring(0, 8);
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `BCI-${ym}-${cli}-${seq}`;
}

/* ═══════════════════════════════════════════════════════════════════
   HELPERS INTERNOS DEL PDF
═══════════════════════════════════════════════════════════════════ */
function _pdfDims(doc, dataUrl, maxW, maxH) {
  try {
    const p = doc.getImageProperties(dataUrl);
    const r = Math.min(maxW / p.width, maxH / p.height);
    return { w: p.width * r, h: p.height * r };
  } catch(e) { return null; }
}
function _pdfFmt(u) { return (u||'').startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'; }

/* Dibuja el header rojo + banda de logos en CADA página nueva */
function _pdfHeader(doc, logoEmp, logoCli) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(176, 58, 46);
  doc.rect(0, 0, pw, 14, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(7.5); doc.setFont(undefined,'bold');
  doc.text('INFORME DE ENSAYO DE DESEMPEÑO — BOMBA CONTRA INCENDIOS', 12, 9);
  doc.setFont(undefined,'normal'); doc.setFontSize(6.5);
  doc.text('NFPA 20 / NFPA 25 §8.3.3 · Fire Pump Performance Test', 12, 13.5);
  doc.setTextColor(52,58,64);
}

/* Pie de página con número */
function _pdfFooter(doc, pagina, total, codigo) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.3);
  doc.line(12, ph - 12, pw - 12, ph - 12);
  doc.setFontSize(6.5); doc.setTextColor(140,140,140);
  doc.setFont(undefined,'normal');
  doc.text(`Código: ${codigo}`, 12, ph - 7);
  doc.text(`FireInspect Pro · ${new Date().toLocaleDateString('es-AR')}`, pw/2, ph - 7, { align:'center' });
  doc.text(`Página ${pagina} de ${total}`, pw - 12, ph - 7, { align:'right' });
}

/* Sección con título rojo + contenido */
function _pdfSeccion(doc, titulo, y, pw) {
  doc.setFillColor(176, 58, 46);
  doc.rect(10, y-3, pw-20, 7, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(8); doc.setFont(undefined,'bold');
  doc.text(titulo.toUpperCase(), 13, y+1.5);
  doc.setTextColor(52,58,64);
  return y + 9;
}

/* Fila de dato simple: etiqueta + valor */
function _pdfFila(doc, etiqueta, valor, x, y, anchoLabel) {
  if (!valor || valor === '-' || valor === '') return y;
  doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(100,110,120);
  doc.text(etiqueta + ':', x, y);
  doc.setFont(undefined,'normal'); doc.setTextColor(30,40,50);
  doc.text(String(valor), x + anchoLabel, y);
  return y + 5.5;
}

/* ═══════════════════════════════════════════════════════════════════
   CARÁTULA — Página 1 completa, estilo ejecutivo
═══════════════════════════════════════════════════════════════════ */
function _pdfCaratula(doc, d, codigo) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Fondo degradado rojo superior (55% de la hoja)
  doc.setFillColor(176, 58, 46);
  doc.rect(0, 0, pw, ph * 0.55, 'F');

  // Acento lateral izquierdo
  doc.setFillColor(220, 80, 60);
  doc.rect(0, 0, 4, ph, 'F');

  // Logo empresa — arriba izquierda
  const logoEmp = Estado.config?.logoEmpresa || null;
  if (logoEmp) {
    const dd = _pdfDims(doc, logoEmp, 55, 24);
    if (dd) try { doc.addImage(logoEmp, _pdfFmt(logoEmp), 14, 14, dd.w, dd.h); } catch(e){}
  } else {
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont(undefined,'bold');
    doc.text(Estado.config?.empresa || 'PBSH', 14, 24);
    doc.setFont(undefined,'normal');
  }

  // Logo cliente — arriba derecha
  const logoCli = d.cliente?.logoDataUrl || null;
  if (logoCli) {
    const dd = _pdfDims(doc, logoCli, 55, 24);
    if (dd) try { doc.addImage(logoCli, _pdfFmt(logoCli), pw - 14 - dd.w, 14, dd.w, dd.h); } catch(e){}
  }

  // Título principal centrado en la zona roja
  const midRed = (ph * 0.55) / 2;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20); doc.setFont(undefined,'bold');
  doc.text('INFORME DE ENSAYO DE', pw/2, midRed - 16, { align:'center' });
  doc.text('DESEMPEÑO DE BOMBA', pw/2, midRed - 4, { align:'center' });
  doc.setFontSize(11); doc.setFont(undefined,'normal');
  doc.text('CONTRA INCENDIOS', pw/2, midRed + 6, { align:'center' });

  // Línea divisoria blanca
  doc.setDrawColor(255,255,255); doc.setLineWidth(0.8);
  doc.line(30, midRed + 12, pw - 30, midRed + 12);

  // Subtítulo norma
  doc.setFontSize(8.5); doc.setFont(undefined,'italic');
  doc.text('NFPA 20 / NFPA 25 — §8.3.3  ·  Fire Pump Performance Test', pw/2, midRed + 20, { align:'center' });

  // — Zona inferior: ficha de identificación —
  const yBase = ph * 0.55 + 14;
  doc.setTextColor(30,40,50);

  // Badge código
  doc.setFillColor(176, 58, 46);
  doc.roundedRect(pw - 90, yBase - 7, 78, 11, 2, 2, 'F');
  doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont(undefined,'bold');
  doc.text(`Código: ${codigo}`, pw - 51, yBase - 1, { align:'center' });
  doc.setTextColor(30,40,50);

  // Datos principales en 2 columnas
  let y1 = yBase + 10;
  const col1w = 28, col2w = 28;
  const c1x = 14, c2x = pw/2 + 4;

  const fichaIzq = [
    ['CLIENTE',   d.cliente?.nombre || '-'],
    ['DIRECCIÓN', d.cliente?.direccion || ''],
    ['TELÉFONO',  d.cliente?.telefono || ''],
  ];
  const fichaDer = [
    ['FECHA DE PRUEBA',  d.fecha ? new Date(d.fecha+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'}) : '-'],
    ['INSPECTOR',        d.inspector || '-'],
    ['EMPRESA',          Estado.config?.empresa || '-'],
  ];

  fichaIzq.forEach(([lbl,val]) => {
    if (!val) return;
    doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(120,130,140);
    doc.text(lbl, c1x, y1);
    doc.setFont(undefined,'normal'); doc.setTextColor(30,40,50); doc.setFontSize(9);
    doc.text(String(val), c1x, y1 + 4, { maxWidth: pw/2 - 18 });
    y1 += 14;
  });

  let y2 = yBase + 10;
  fichaDer.forEach(([lbl,val]) => {
    if (!val) return;
    doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(120,130,140);
    doc.text(lbl, c2x, y2);
    doc.setFont(undefined,'normal'); doc.setTextColor(30,40,50); doc.setFontSize(9);
    doc.text(String(val), c2x, y2 + 4, { maxWidth: pw/2 - 18 });
    y2 += 14;
  });

  // Línea separadora
  const yLinea = Math.max(y1, y2) + 4;
  doc.setDrawColor(200,210,220); doc.setLineWidth(0.4);
  doc.line(14, yLinea, pw - 14, yLinea);

  // Datos bomba (fila compacta)
  const dp = d.datosPrueba;
  let yBomba = yLinea + 8;
  doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(120,130,140);
  doc.text('EQUIPO ENSAYADO', 14, yBomba); yBomba += 5;

  const bombaData = [
    `${d.marca || ''} ${d.modelo || ''}`.trim() || '-',
    d.serie ? `S/N: ${d.serie}` : '',
    d.tipoAccionTxt || '',
    d.certTxt || '',
  ].filter(Boolean).join('   ·   ');
  doc.setFont(undefined,'normal'); doc.setTextColor(30,40,50); doc.setFontSize(8.5);
  doc.text(bombaData, 14, yBomba, { maxWidth: pw - 28 });

  // Resultado global (badge de clasificación)
  const R = d.resultado;
  const cumple = R?.cumple_nfpa;
  const clasGlobal = R?.clasificacion_global?.labelEs || (cumple ? 'APROBADA' : 'OBSERVADA');
  const [bgR, bgG, bgB] = cumple ? [39, 174, 96] : [211, 84, 0];
  const yBadge = ph - 36;
  doc.setFillColor(bgR, bgG, bgB);
  doc.roundedRect(pw/2 - 40, yBadge - 6, 80, 16, 3, 3, 'F');
  doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont(undefined,'bold');
  doc.text(clasGlobal.toUpperCase(), pw/2, yBadge + 5, { align:'center' });

  // Pie carátula
  doc.setFontSize(6.5); doc.setTextColor(140,140,140); doc.setFont(undefined,'normal');
  doc.text(`Documento generado por FireInspect Pro · ${new Date().toLocaleDateString('es-AR')}`, pw/2, ph - 10, { align:'center' });
  doc.text(`Código: ${codigo}  ·  Página 1`, pw/2, ph - 5, { align:'center' });
}

/* ═══════════════════════════════════════════════════════════════════
   NÚCLEO — Genera el PDF completo
═══════════════════════════════════════════════════════════════════ */
async function cdGenerarPDFNucleo(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();
  const logoEmp = Estado.config?.logoEmpresa || null;
  const logoCli = d.cliente?.logoDataUrl || null;
  const dp      = d.datosPrueba;
  const R       = d.resultado;

  // Código de informe único
  const codigo = cdGenerarCodigoInforme(d.fecha, d.cliente?.nombre);

  // ── PÁGINA 1: CARÁTULA ──────────────────────────────────────────
  _pdfCaratula(doc, d, codigo);

  // ── PÁGINA 2: FICHA TÉCNICA + DATOS DEL ENSAYO ──────────────────
  doc.addPage();
  _pdfHeader(doc, logoEmp, logoCli);
  let y = 22;

  // SECCIÓN: IDENTIFICACIÓN DEL EQUIPO
  y = _pdfSeccion(doc, '1. Identificación del equipo y condiciones del ensayo', y, pw);

  // 2 columnas de datos
  const col1 = [], col2 = [];
  if (d.marca)        col1.push(['Marca',           d.marca]);
  if (d.modelo)       col1.push(['Modelo',          d.modelo]);
  if (d.serie)        col1.push(['N.º de serie',    d.serie]);
  if (d.tipoAccionTxt) col1.push(['Accionamiento',  d.tipoAccionTxt]);
  if (d.certTxt)      col1.push(['Certificación',   d.certTxt]);
  if (d.diamSuc)      col1.push(['Diám. succión',   d.diamSuc + ' in']);
  if (d.diamDesc)     col1.push(['Diám. descarga',  d.diamDesc + ' in']);

  if (dp.qn_gpm)  col2.push(['Caudal nominal (Qn)',   `${dp.qn_gpm} GPM (${Unidades.gpmALmin(dp.qn_gpm).toFixed(0)} L/min)`]);
  if (dp.pn_psi)  col2.push(['Presión nominal (Pn)',  `${dp.pn_psi} PSI (${Unidades.psiABar(dp.pn_psi).toFixed(2)} bar)`]);
  if (dp.nn_rpm)  col2.push(['Velocidad nominal',     `${dp.nn_rpm} RPM`]);
  if (d.controlador)  col2.push(['Controlador',       d.controlador]);
  if (d.liquidoBombeo) col2.push(['Líquido bombeado', d.liquidoBombeo]);
  if (d.tempBombeo)    col2.push(['Temperatura',      d.tempBombeo]);
  if (d.capacidadAgua) col2.push(['Capacidad depósito', d.capacidadAgua]);

  const midX = pw / 2 + 2;
  const maxR  = Math.max(col1.length, col2.length);
  const yIni  = y;
  for (let i = 0; i < maxR; i++) {
    const yRow = yIni + i * 5.5;
    if (col1[i]) { _pdfFila(doc, col1[i][0], col1[i][1], 12, yRow, 34); }
    if (col2[i]) { _pdfFila(doc, col2[i][0], col2[i][1], midX, yRow, 38); }
  }
  y = yIni + maxR * 5.5 + 6;

  // SECCIÓN: DATOS DE PLACA DEL FABRICANTE
  y = _pdfSeccion(doc, '2. Datos de placa del fabricante', y, pw);
  const pShutFab = dp.p_shutoff_fab_psi || (dp.pn_psi * 1.40);
  const p150fab  = dp.p150_fab_psi      || (dp.pn_psi * 0.65);
  const q150fab  = dp.qn_gpm * 1.5;

  doc.setFillColor(242, 245, 250);
  doc.rect(10, y - 2, pw - 20, 14, 'F');
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(30,40,50);

  const dpFilas = [
    [`Shutoff (Q = 0): P max ${pShutFab.toFixed(1)} PSI`,
     `Punto nominal (${dp.qn_gpm} GPM): ${dp.pn_psi} PSI`,
     `Q150% (${q150fab.toFixed(0)} GPM): P min ${p150fab.toFixed(1)} PSI`],
  ];
  dpFilas[0].forEach((txt, i) => {
    doc.text(txt, 13 + i * 65, y + 4);
  });
  doc.text(`Presiones de placa en bar — Shutoff: ${Unidades.psiABar(pShutFab).toFixed(2)} bar  |  Pn: ${Unidades.psiABar(dp.pn_psi).toFixed(2)} bar  |  P150%: ${Unidades.psiABar(p150fab).toFixed(2)} bar`, 13, y + 10);
  doc.setTextColor(52,58,64);
  y += 19;

  // SECCIÓN: PUNTOS DE MEDICIÓN
  y = _pdfSeccion(doc, '3. Puntos de medición registrados en campo', y, pw);

  // Tabla completa de puntos medidos
  const colW     = [28, 22, 22, 22, 22, 28, 38];
  const colAlign = ['left','right','right','right','right','right','left'];
  const colX2    = [10];
  colW.forEach((w,i) => colX2.push(colX2[i] + w));
  const hdrs     = ['Punto','Q suc. (PSI)','P desc. (PSI)','P neta (PSI)','RPM medidos','Q (GPM) corr.','Clasificación'];
  const pts = [
    { label:'Shutoff (0%)',
      qSuc:  dp.p_suc_shutoff,  pDesc: dp.p_desc_shutoff, rpmMed: dp.rpm_shutoff,
      pNeta: R.shutoff.p_corr,  qCorr: 0,
      clas:  R.shutoff.ok ? 'OK ✓' : 'FALLA ✗' },
    { label:'100% Qn',
      qSuc:  dp.p_suc_100,      pDesc: dp.p_desc_100,     rpmMed: dp.rpm_100,
      pNeta: R.punto100.p_corr, qCorr: R.punto100.q_corr,
      clas:  `${R.punto100.clasificacion.labelEs} (${R.punto100.clasificacion.porcentaje.toFixed(1)}%)` },
    { label:'150% Qn',
      qSuc:  dp.p_suc_150,      pDesc: dp.p_desc_150,     rpmMed: dp.rpm_150,
      pNeta: R.punto150.p_corr, qCorr: R.punto150.q_corr,
      clas:  `${R.punto150.clasificacion.labelEs} (${R.punto150.clasificacion.porcentaje.toFixed(1)}%)` },
  ];

  const rowH2 = 6.5;
  // Header
  doc.setFillColor(52, 58, 64); doc.rect(10, y - 4, pw - 20, rowH2, 'F');
  hdrs.forEach((h, ci) => {
    doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(255,255,255);
    doc.text(h, colX2[ci] + 2, y);
  });
  y += rowH2;

  pts.forEach((pt, ri) => {
    const esOk = pt.clas.includes('OK') || pt.clas.includes('Conforme') || pt.clas.includes('Aprobado') || pt.clas.includes('%');
    if (ri % 2 === 0) { doc.setFillColor(246, 248, 250); doc.rect(10, y-4, pw-20, rowH2, 'F'); }
    const vals = [
      pt.label,
      pt.qSuc  != null ? pt.qSuc.toFixed(1)  : '-',
      pt.pDesc != null ? pt.pDesc.toFixed(1)  : '-',
      pt.pNeta != null ? pt.pNeta.toFixed(1)  : '-',
      pt.rpmMed != null ? String(Math.round(pt.rpmMed)) : '-',
      pt.qCorr  != null ? pt.qCorr.toFixed(0)  : '-',
      pt.clas,
    ];
    vals.forEach((v, ci) => {
      doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(30,40,50);
      if (colAlign[ci] === 'right') {
        doc.text(v, colX2[ci] + colW[ci] - 2, y, { align:'right' });
      } else {
        doc.text(v, colX2[ci] + 2, y, { maxWidth: colW[ci] - 3 });
      }
    });
    if (ri < pts.length - 1) {
      doc.setDrawColor(220,225,232); doc.setLineWidth(0.2);
      doc.line(10, y + rowH2 - 4, pw - 10, y + rowH2 - 4);
    }
    y += rowH2;
  });
  doc.setDrawColor(180,190,200); doc.setLineWidth(0.4);
  doc.rect(10, y - pts.length * rowH2 - 6.5, pw - 20, (pts.length + 1) * rowH2, 'S');
  y += 6;

  // SECCIÓN: GRÁFICO
  if (d.imgData) {
    const graphW = pw - 20;
    const graphH = graphW * (560 / 900);
    if (y + graphH + 16 > ph - 20) { doc.addPage(); _pdfHeader(doc, logoEmp, logoCli); y = 22; }
    y = _pdfSeccion(doc, '4. Curva de desempeño — Presión vs. Caudal', y, pw);
    doc.addImage(d.imgData, 'PNG', 10, y, graphW, graphH);
    y += graphH + 8;
  }

  // Numerar páginas hasta aquí (la carátula es página 1; la actual es 2)
  // Se completará al final cuando sepamos cuántas páginas hay.

  // — Conclusión técnica —
  if (d.conclusion) {
    if (y + 30 > ph - 20) { doc.addPage(); _pdfHeader(doc, logoEmp, logoCli); y = 22; }
    y = _pdfSeccion(doc, '5. Conclusión técnica NFPA 20', y, pw);
    doc.setFontSize(8.5); doc.setFont(undefined,'normal'); doc.setTextColor(30,40,50);
    const linConc = doc.splitTextToSize(d.conclusion, pw - 24);
    doc.text(linConc, 12, y); y += linConc.length * 4.5 + 8;
  }

  // — Observaciones —
  if (d.observaciones) {
    if (y + 20 > ph - 20) { doc.addPage(); _pdfHeader(doc, logoEmp, logoCli); y = 22; }
    y = _pdfSeccion(doc, '6. Observaciones de campo', y, pw);
    doc.setFontSize(8.5); doc.setFont(undefined,'normal'); doc.setTextColor(30,40,50);
    const linObs = doc.splitTextToSize(d.observaciones, pw - 24);
    doc.text(linObs, 12, y); y += linObs.length * 4.5 + 8;
  }

  // — Recomendaciones —
  if (d.recomendaciones) {
    if (y + 20 > ph - 20) { doc.addPage(); _pdfHeader(doc, logoEmp, logoCli); y = 22; }
    y = _pdfSeccion(doc, '7. Recomendaciones técnicas', y, pw);
    doc.setFontSize(8.5); doc.setFont(undefined,'normal'); doc.setTextColor(30,40,50);
    const linRec = doc.splitTextToSize(d.recomendaciones, pw - 24);
    // Bullets
    linRec.forEach(linea => {
      if (linea.trim()) {
        doc.setFillColor(176,58,46); doc.circle(14, y - 1.5, 0.9, 'F');
        doc.text(linea, 17, y, { maxWidth: pw - 30 });
      }
      y += 5;
    });
    y += 4;
  }

  // — Instrumentos utilizados —
  if (d.instrumentos) {
    if (y + 20 > ph - 20) { doc.addPage(); _pdfHeader(doc, logoEmp, logoCli); y = 22; }
    const numSec = d.recomendaciones ? '8' : '7';
    y = _pdfSeccion(doc, `${numSec}. Instrumentos y equipos de medición utilizados`, y, pw);

    // Parsear instrumentos separados por · o nueva línea
    const lista = d.instrumentos.split(/[\n·•]+/).map(s=>s.trim()).filter(Boolean);
    if (lista.length > 1) {
      // Tabla de instrumentos
      const iColW = [8, pw - 28];
      const iColX = [10, 18];
      lista.forEach((inst, idx) => {
        if (y + 7 > ph - 20) { doc.addPage(); _pdfHeader(doc, logoEmp, logoCli); y = 22; }
        if (idx % 2 === 0) { doc.setFillColor(246,248,250); doc.rect(10, y-3.5, pw-20, 6, 'F'); }
        doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(30,40,50);
        doc.text(`${idx+1}.`, iColX[0]+2, y);
        doc.text(inst, iColX[1], y, { maxWidth: pw - 28 });
        y += 6;
      });
      doc.setDrawColor(180,190,200); doc.setLineWidth(0.3);
      doc.rect(10, y - lista.length*6 - 3.5, pw-20, lista.length*6, 'S');
    } else {
      doc.setFontSize(8.5); doc.setFont(undefined,'normal'); doc.setTextColor(30,40,50);
      doc.text(d.instrumentos, 12, y, { maxWidth: pw - 24 });
    }
    y += 8;
  }

  // — Fotos adjuntas —
  const todasFotos = [];
  const catLabels = { 'foto-bomba':'Bomba completa', 'foto-placa':'Placa del fabricante', 'foto-manometros':'Manómetros', 'foto-tablero':'Tablero / Controlador', 'foto-extra':'Foto adicional' };
  if (d.fotos) {
    Object.entries(d.fotos).forEach(([cat, arr]) => {
      (arr||[]).forEach(f => { if(f?.dataUrl) todasFotos.push({ dataUrl:f.dataUrl, cat }); });
    });
  }
  if (todasFotos.length > 0) {
    if (y + 60 > ph - 20) { doc.addPage(); _pdfHeader(doc, logoEmp, logoCli); y = 22; }
    const numSec2 = (d.instrumentos && d.recomendaciones) ? '9' : (d.instrumentos || d.recomendaciones) ? '8' : '7';
    y = _pdfSeccion(doc, `${numSec2}. Registro fotográfico`, y, pw);
    const fW = (pw - 26) / 2;
    const fH = fW * 0.65;
    todasFotos.forEach((f, idx) => {
      const col = idx % 2;
      const fx  = col === 0 ? 10 : 10 + fW + 6;
      if (col === 0 && idx > 0) y += fH + 10;
      if (y + fH + 12 > ph - 20) { doc.addPage(); _pdfHeader(doc, logoEmp, logoCli); y = 22; }
      try {
        doc.addImage(f.dataUrl, _pdfFmt(f.dataUrl), fx, y, fW, fH);
        doc.setFillColor(0,0,0,50);
        doc.setFontSize(6.5); doc.setTextColor(80,80,80);
        doc.text(catLabels[f.cat] || f.cat, fx + 2, y + fH - 2);
      } catch(e) {}
    });
    y += fH + 12;
  }

  // — FIRMA —
  const firma = Estado.config?.firmaPredeterminada || null;
  if (firma || d.inspector) {
    if (y + 40 > ph - 20) { doc.addPage(); _pdfHeader(doc, logoEmp, logoCli); y = 22; }
    doc.setDrawColor(200,210,220); doc.setLineWidth(0.3);
    doc.line(12, y, pw - 12, y); y += 8;

    // Firma imagen
    if (firma) {
      const dd = _pdfDims(doc, firma, 55, 22);
      if (dd) try { doc.addImage(firma, 'PNG', 12, y, dd.w, dd.h); } catch(e){}
    }
    const yFirmaTexto = y + 26;
    doc.setDrawColor(100,100,100); doc.setLineWidth(0.4);
    doc.line(12, yFirmaTexto, 80, yFirmaTexto);
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(30,40,50);
    doc.text(d.inspector || Estado.config?.inspector || 'Inspector', 12, yFirmaTexto + 4);
    doc.setFont(undefined,'normal'); doc.setFontSize(7); doc.setTextColor(100,110,120);
    doc.text(Estado.config?.empresa || '', 12, yFirmaTexto + 8);
    doc.text(`Fecha: ${d.fecha ? new Date(d.fecha+'T12:00:00').toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')}`, 12, yFirmaTexto + 12);
  }

  // — NUMERACIÓN DE PÁGINAS (retroactiva) —
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let p = 2; p <= totalPaginas; p++) {
    doc.setPage(p);
    _pdfFooter(doc, p, totalPaginas, codigo);
  }
  // Pie de carátula (ya tiene texto propio, solo actualizar número de páginas si quisiéramos)
  doc.setPage(1);
  // La carátula ya incluyó "Página 1" en su texto fijo.

  // Nombre de archivo codificado
  const clienteTag = (d.cliente?.nombre || 'Bomba').toUpperCase().replace(/[^A-Z0-9]/g,'_').replace(/_+/g,'_');
  const fechaTag   = (d.fecha || new Date().toISOString().split('T')[0]).replace(/-/g,'');
  const nombreArchivo = `${codigo}_DesempeñoBomba_${clienteTag}_${fechaTag}.pdf`;
  doc.save(nombreArchivo);
}

/* PDF desde la pantalla en vivo (lee el formulario actual) */
async function cdGenerarPDF() {
  if (!_resultadoPrueba) { mostrarToast('Calculá la curva primero', 'error'); return; }
  mostrarToast('Generando informe...');

  const clienteId = document.getElementById('cd-cliente').value;
  const cliente   = await FireDB.get(FireDB.STORES.CLIENTES, clienteId || '');
  const selAcc    = document.getElementById('cd-tipo-accion');
  const selCert   = document.getElementById('cd-certificacion');

  // Recolectar fotos actuales
  const fotosActuales = {};
  Object.entries(_cdFotos).forEach(([cat, arr]) => { fotosActuales[cat] = arr.filter(Boolean); });

  await cdGenerarPDFNucleo({
    cliente,
    fecha:           document.getElementById('cd-fecha').value,
    inspector:       document.getElementById('cd-inspector').value.trim(),
    marca:           document.getElementById('cd-marca').value.trim(),
    modelo:          document.getElementById('cd-modelo').value.trim(),
    serie:           document.getElementById('cd-serie').value.trim(),
    tipoAccionTxt:   selAcc.options[selAcc.selectedIndex].text,
    certTxt:         selCert.options[selCert.selectedIndex].text,
    diamSuc:         document.getElementById('cd-diam-suc').value.trim(),
    diamDesc:        document.getElementById('cd-diam-desc').value.trim(),
    liquidoBombeo:   document.getElementById('cd-liquido').value.trim(),
    tempBombeo:      document.getElementById('cd-temp-bombeo').value.trim(),
    controlador:     document.getElementById('cd-controlador').value.trim(),
    capacidadAgua:   document.getElementById('cd-capacidad-agua').value.trim(),
    datosPrueba:     _datosPrueba,
    resultado:       _resultadoPrueba,
    conclusion:      document.getElementById('cd-conclusion-texto').textContent,
    observaciones:   document.getElementById('cd-observaciones').value.trim(),
    recomendaciones: document.getElementById('cd-recomendaciones')?.value.trim() || '',
    instrumentos:    document.getElementById('cd-instrumentos').value.trim(),
    fotos:           fotosActuales,
    imgData:         await cdObtenerImagenGrafico(),
  });
  mostrarToast('Informe PDF generado', 'exito');
}

/* PDF desde una prueba GUARDADA (historial) — reconstruye resultado y gráfico */
async function cdGenerarPDFGuardado(insp, cliente) {
  if (!insp?.datosPrueba) { mostrarToast('La prueba guardada no tiene datos completos', 'error'); return; }
  mostrarToast('Generando informe...');

  const resultado = CurvaDesempeno.analizarCurvaDesempeno(insp.datosPrueba);
  const { svgHtml } = cdConstruirSVG(resultado, insp.datosPrueba.pn_psi, insp.datosPrueba.qn_gpm, insp.datosPrueba);
  const imgData = await cdSvgAPng(svgHtml);

  await cdGenerarPDFNucleo({
    cliente,
    fecha:           insp.fecha,
    inspector:       insp.inspector,
    marca:           insp.marca,
    modelo:          insp.modelo,
    serie:           insp.serie,
    tipoAccionTxt:   CD_TIPO_ACCION_TXT[insp.tipoAccion] || insp.tipoAccion || '-',
    certTxt:         CD_CERT_TXT[insp.certificacion]     || insp.certificacion || '-',
    diamSuc:         insp.diamSuccion,
    diamDesc:        insp.diamDescarga,
    liquidoBombeo:   insp.liquidoBombeo   || '',
    tempBombeo:      insp.tempBombeo      || '',
    controlador:     insp.controlador     || '',
    capacidadAgua:   insp.capacidadAgua   || '',
    datosPrueba:     insp.datosPrueba,
    resultado,
    conclusion:      insp.conclusion,
    observaciones:   insp.observaciones,
    recomendaciones: insp.recomendaciones || '',
    instrumentos:    insp.instrumentos,
    fotos:           insp.fotos           || {},
    imgData,
  });
  mostrarToast('Informe PDF generado', 'exito');
}

/* ═══════════════════════════════════════════════════════════════
   MÓDULO TUBO PITOT — Cálculo NFPA 291
   Q (GPM) = 29.84 × Cd × d² × √P_pitot
   Soporta hasta 4 boquillas simultáneas por punto de ensayo
═══════════════════════════════════════════════════════════════ */

function cdToggleMetodoQ(metodo) {
  const panel = document.getElementById('cd-pitot-panel');
  if (!panel) return;
  panel.style.display = metodo === 'pitot' ? 'block' : 'none';
}

function cdPitotGetCd() {
  const sel = document.getElementById('pitot-cd');
  if (!sel) return 0.97;
  if (sel.value === 'manual') {
    return parseFloat(document.getElementById('pitot-cd-manual')?.value) || 0.97;
  }
  return parseFloat(sel.value) || 0.97;
}

/* Calcula Q por boquilla en GPM desde una lectura Pitot en PSI */
function cdPitotCalcularQ(p_pitot_psi, d_in, cd) {
  if (!p_pitot_psi || !d_in || p_pitot_psi <= 0 || d_in <= 0) return 0;
  return 29.84 * cd * (d_in * d_in) * Math.sqrt(p_pitot_psi);
}

/* Recalcula todos los caudales Pitot cada vez que cambia algún campo */
function cdPitotRecalcular() {
  const diam = parseFloat(document.getElementById('pitot-diam-in')?.value) || 0;
  const cd   = cdPitotGetCd();
  const cdSel = document.getElementById('pitot-cd');
  if (cdSel) {
    const manualWrap = document.getElementById('pitot-cd-manual-wrap');
    if (manualWrap) manualWrap.style.display = cdSel.value === 'manual' ? 'block' : 'none';
  }

  ['0','100','150'].forEach(pt => {
    let totalGpm = 0;
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(n => {
      const pEl  = document.getElementById(`pitot-p${pt}-${n}`);
      const qEl  = document.getElementById(`pitot-q${pt}-${n}`);
      if (!pEl || !qEl) return;
      const pPsi = parseFloat(pEl.value) || 0;
      const qGpm = (pPsi > 0 && diam > 0) ? cdPitotCalcularQ(pPsi, diam, cd) : 0;
      qEl.textContent = qGpm > 0 ? qGpm.toFixed(1) : '—';
      totalGpm += qGpm;
    });

    // Suma el caudalímetro directo si está presente
    const meter = parseFloat(document.getElementById(`pitot-meter${pt}`)?.value) || 0;
    totalGpm += meter;

    const totalEl     = document.getElementById(`pitot-qtotal${pt}`);
    const totalLminEl = document.getElementById(`pitot-qtotal${pt}-lmin`);
    if (totalEl) totalEl.textContent = totalGpm.toFixed(1);
    if (totalLminEl) totalLminEl.textContent = `${Unidades.gpmALmin(totalGpm).toFixed(1)} L/min`;
  });
}

/* Transfiere el total calculado al campo de caudal del punto correspondiente */
function cdPitotTransferir(pt) {
  const totalEl = document.getElementById(`pitot-qtotal${pt}`);
  if (!totalEl) return;
  const total = parseFloat(totalEl.textContent) || 0;
  if (total <= 0) { mostrarToast('Ingresá al menos una lectura Pitot o de caudalímetro', 'warn'); return; }

  const campoId = pt === '0' ? null : `cd-q-${pt}`;
  if (!campoId) {
    mostrarToast('El shutoff (Q=0) no tiene campo de caudal para transferir', 'warn');
    return;
  }
  const campo = document.getElementById(campoId);
  if (campo) {
    campo.value = total.toFixed(1);
    campo.nextElementSibling.textContent = Unidades.textoConversion(total, 'caudal');
    campo.style.background = '#E8F5E9';
    setTimeout(() => { campo.style.background = ''; }, 1500);
    mostrarToast(`Q ${pt === '100' ? '100%' : '150%'} = ${total.toFixed(1)} GPM transferido al formulario`, 'exito');
  }
}

/* ═══════════════════════════════════════════════════════════════
   REGISTRO FOTOGRÁFICO
   Galería de fotos por categoría (bomba, placa, manómetros, etc.)
═══════════════════════════════════════════════════════════════ */

// Estado interno de fotos por categoría
const _cdFotos = { 'foto-bomba': [], 'foto-placa': [], 'foto-manometros': [], 'foto-tablero': [], 'foto-extra': [] };
let _cdFotoCategoriaActiva = null;

function cdAgregarFotoCategoria(categoriaId, label) {
  _cdFotoCategoriaActiva = categoriaId;
  const input = document.getElementById('cd-foto-input');
  if (input) { input.value = ''; input.click(); }
}

function cdConfirmarFoto(input) {
  if (!input.files || !input.files[0] || !_cdFotoCategoriaActiva) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const cat = _cdFotoCategoriaActiva;
    if (!_cdFotos[cat]) _cdFotos[cat] = [];
    const idx = _cdFotos[cat].push({ dataUrl, nombre: file.name, fecha: new Date().toISOString() }) - 1;
    cdRenderizarMiniatura(cat, idx, dataUrl);
  };
  reader.readAsDataURL(file);
}

function cdRenderizarMiniatura(cat, idx, dataUrl) {
  const preview = document.getElementById(`${cat}-preview`);
  if (!preview) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;display:inline-block;';
  wrap.innerHTML = `
    <img src="${dataUrl}" alt="Foto ${idx+1}"
         style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:2px solid var(--gris-200);cursor:pointer;"
         onclick="UI.cdVerFoto('${cat}',${idx})">
    <button onclick="UI.cdEliminarFoto('${cat}',${idx},this.parentElement)"
            style="position:absolute;top:-5px;right:-5px;background:var(--rojo);color:white;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">×</button>`;
  preview.appendChild(wrap);
}

function cdVerFoto(cat, idx) {
  const foto = _cdFotos[cat]?.[idx];
  if (!foto) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
  overlay.innerHTML = `
    <img src="${foto.dataUrl}" style="max-width:94vw;max-height:80vh;border-radius:8px;object-fit:contain;">
    <button onclick="this.parentElement.remove()" style="background:white;color:#111;border:none;padding:8px 24px;border-radius:20px;font-size:14px;cursor:pointer;">Cerrar</button>`;
  document.body.appendChild(overlay);
}

function cdEliminarFoto(cat, idx, elem) {
  if (_cdFotos[cat]) _cdFotos[cat][idx] = null;
  elem?.remove();
}

function cdObtenerTodasFotos() {
  const todas = [];
  Object.entries(_cdFotos).forEach(([cat, fotos]) => {
    (fotos || []).forEach(f => { if (f) todas.push({ ...f, categoria: cat }); });
  });
  return todas;
}

/* ═══ Bombas registradas del cliente: precarga de ficha técnica ═══ */

async function cdCargarBombasCliente() {
  const sel = document.getElementById('cd-equipo');
  const clienteId = document.getElementById('cd-cliente')?.value;
  if (!sel) return;
  Estado.cdEquipoActual = null;
  if (!clienteId) { sel.innerHTML = '<option value="">— Carga manual —</option>'; return; }
  const bombas = await Equipos.listarPorCliente(clienteId, 'bomba');
  sel.innerHTML = '<option value="">— Carga manual —</option>' +
    bombas.map(b => `<option value="${b.id}">${b.tag}${Equipos.resumenDe(b) ? ' · ' + Equipos.resumenDe(b) : ''}</option>`).join('');
}

async function cdPrecargarBomba(equipoId) {
  if (!equipoId) { Estado.cdEquipoActual = null; return; }
  const eq = await Equipos.obtener(equipoId);
  if (!eq?.datos) { Estado.cdEquipoActual = null; return; }
  Estado.cdEquipoActual = { id: eq.id, tag: eq.tag };
  const d = eq.datos;

  const set = (id, valor) => {
    if (valor === undefined || valor === null || valor === '') return false;
    const el = document.getElementById(id);
    if (!el) return false;
    el.value = valor;
    return true;
  };

  let n = 0;
  n += set('cd-marca',        d.marca)        ? 1 : 0;
  n += set('cd-modelo',       d.modelo)       ? 1 : 0;
  n += set('cd-serie',        d.serie)        ? 1 : 0;
  n += set('cd-tipo-accion',  d.tipoAccion)   ? 1 : 0;
  n += set('cd-certificacion',d.certificacion)? 1 : 0;
  n += set('cd-nn',           d.nn)           ? 1 : 0;
  n += set('cd-diam-suc',     d.diamSuc)      ? 1 : 0;
  n += set('cd-diam-desc',    d.diamDesc)     ? 1 : 0;
  n += set('cd-controlador',  d.controlador)  ? 1 : 0;
  n += set('cd-qn',           d.qn)           ? 1 : 0;
  n += set('cd-pn',           d.pn)           ? 1 : 0;
  n += set('cd-p150-fab',     d.p150)         ? 1 : 0;
  n += set('cd-p-shutoff-fab',d.pShutoff)     ? 1 : 0;

  // Recalcula referencias que dependen de Qn/Pn (100%Q, 150%Q, límites)
  try { cdActualizarQ150(); } catch(e) {}
  try { cdActualizarLimites(); } catch(e) {}

  if (n > 0) mostrarToast(`Ficha técnica precargada desde "${eq.tag}" (${n} datos)`, 'exito');
}

window.UI = window.UI || {};
Object.assign(window.UI, {
  renderizarCurvaDesempeno,
  cdCargarBombasCliente, cdPrecargarBomba,
  cdActualizarLimites, cdActualizarQ150,
  cdToggleMetodoQ, cdPitotRecalcular, cdPitotTransferir,
  cdAgregarFotoCategoria, cdConfirmarFoto, cdVerFoto, cdEliminarFoto,
  cdCalcularYGraficar, cdGuardar, cdGenerarPDF,
  cdConstruirSVG, cdGenerarPDFGuardado,
});
