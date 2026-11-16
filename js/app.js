/* HidroVerde — interfaz. */
(function () {
  const KB = self.HV_KB, E = self.HV_ENGINE, S = self.HV_STORE;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => String(n).replace('.', ',');
  const fmt1 = n => Number(n).toFixed(1).replace('.', ','); // CE y pH siempre con un decimal
  const PROPIO = '__propio__';

  const estado = { cultivoId: 'lechuga', modo: 'ab', editandoId: null, ultimo: null };
  const PROPIA = '__propia__';
  const DIF = ['', 'Fácil', 'Media', 'Avanzada'];
  const BOMBA = { no: 'Sin bomba ni electricidad', aire: 'Bomba de aire', agua: 'Bomba de agua', 'agua y aire': 'Bomba de agua y de aire' };

  /* ---------- Tema ---------- */
  try { const t = localStorage.getItem('hidroverde.tema'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  $('#themeBtn').addEventListener('click', () => {
    const oscuro = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const nuevo = oscuro ? 'light' : 'dark';
    document.documentElement.dataset.theme = nuevo;
    try { localStorage.setItem('hidroverde.tema', nuevo); } catch (e) {}
  });

  /* ---------- Navegación ---------- */
  function ir() {
    const vista = (location.hash || '#inicio').slice(1);
    let v = ['inicio', 'calcular', 'aprende'].includes(vista) ? vista : 'inicio';
    if (vista.startsWith('siembra-') && S.siembra(vista.slice(8))) { v = 'siembra'; abrirSiembra(vista.slice(8)); }
    document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + v));
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === (v === 'siembra' ? 'inicio' : v)));
    if (v === 'inicio') pintarSiembras();
    if (v === 'calcular' && !estado.editandoId) $('#calcTitulo').textContent = 'Calcular solución';
    window.scrollTo(0, 0);
  }
  addEventListener('hashchange', ir);

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2600);
  }

  /* ---------- Formulario ---------- */
  function pintarCultivos() {
    $('#chipsCultivo').innerHTML = KB.CULTIVOS.map(c =>
      `<button type="button" class="chip" role="radio" aria-checked="${c.id === estado.cultivoId}" data-cultivo="${c.id}"><span aria-hidden="true">${c.emoji}</span>${esc(c.nombre)}</button>`).join('');
    pintarEtapas();
  }

  function pintarEtapas(etapaId) {
    const c = E.cultivo(estado.cultivoId);
    $('#selEtapa').innerHTML = c.etapas.map(e => `<option value="${e.id}">${esc(e.nombre)} · CE ${fmt1(e.ceMin)}–${fmt1(e.ceMax)}</option>`).join('');
    if (etapaId) $('#selEtapa').value = etapaId;
    $('#campoEtapa').classList.toggle('hidden', c.etapas.length === 1);
  }

  $('#chipsCultivo').addEventListener('click', ev => {
    const b = ev.target.closest('[data-cultivo]'); if (!b) return;
    estado.cultivoId = b.dataset.cultivo; pintarCultivos();
  });

  function productos() { return [...KB.PRODUCTOS, ...S.productosPropios()]; }

  function pintarProductos(sel) {
    $('#selProducto').innerHTML = productos().map(p => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')
      + `<option value="${PROPIO}">Otro producto (escribo la dosis de mi etiqueta)</option>`;
    if (sel) $('#selProducto').value = sel;
    alCambiarProducto();
  }

  function alCambiarProducto() {
    const id = $('#selProducto').value;
    const p = productos().find(x => x.id === id);
    $('#productoPropio').classList.toggle('hidden', id !== PROPIO);
    $('#notaProducto').textContent = p ? (p.nota || `Dosis: ${fmt(p.dosisA)} ${p.unidad} de A y ${fmt(p.dosisB)} ${p.unidad} de B por litro.`) : '';
  }
  $('#selProducto').addEventListener('change', alCambiarProducto);

  /* ---------- Sistemas ---------- */
  $('#selSistema').innerHTML = KB.SISTEMAS.map(s => `<option value="${s.id}">${esc(s.nombre)}${s.corto && s.id !== 'otro' ? ' · ' + esc(s.corto) : ''}</option>`).join('');

  function fichaHTML(s) {
    if (!s || s.id === 'otro') return '';
    return `<div class="ficha-tags"><span class="tag">${DIF[s.dificultad]}</span><span class="tag">${esc(BOMBA[s.bomba] || '')}</span>${s.recircula ? '<span class="tag">Recircula</span>' : ''}</div>
      <p>${esc(s.como)}</p>
      <p><b>Ideal para:</b> ${esc(s.ideal)}</p>
      <p><b>Manejo de la solución:</b> ${esc(s.solucion)}</p>
      ${s.ojo ? `<p class="ojo"><b>Ojo:</b> ${esc(s.ojo)}</p>` : ''}`;
  }
  function pintarFicha() { $('#fichaSistema').innerHTML = fichaHTML(KB.SISTEMAS.find(s => s.id === $('#selSistema').value)); }
  $('#selSistema').addEventListener('change', pintarFicha);

  $('#listaSistemas').innerHTML = KB.SISTEMAS.filter(s => s.id !== 'otro')
    .sort((a, b) => a.dificultad - b.dificultad)
    .map(s => `<details class="sistema"><summary><b>${esc(s.nombre)}</b> <span>${esc(s.corto)}</span></summary>${fichaHTML(s)}</details>`).join('');

  /* ---------- Modo: concentrado A+B o sales individuales ---------- */
  function ponerModo(m) {
    estado.modo = m;
    document.querySelectorAll('[data-modo]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.modo === m)));
    $('#modoAB').classList.toggle('hidden', m !== 'ab');
    $('#modoSales').classList.toggle('hidden', m !== 'sales');
    $('#resultado').classList.add('hidden');
  }
  document.querySelector('.segmento').addEventListener('click', ev => {
    const b = ev.target.closest('[data-modo]'); if (b) ponerModo(b.dataset.modo);
  });

  $('#selReceta').innerHTML = KB.RECETAS.map(r => `<option value="${r.id}">${esc(r.nombre)}</option>`).join('')
    + `<option value="${PROPIA}">Mi propia receta (ppm)</option>`;
  $('#gridPpm').innerHTML = KB.ELEMENTOS.map(el =>
    `<label class="field">${el}<input type="text" inputmode="decimal" data-ppm="${el}" value="${fmt(KB.RECETAS[0].ppm[el] ?? 0)}"></label>`).join('');
  $('#selReceta').addEventListener('change', () => $('#recetaPropia').classList.toggle('hidden', $('#selReceta').value !== PROPIA));

  function ppmPropia() {
    const o = {}; document.querySelectorAll('[data-ppm]').forEach(i => { o[i.dataset.ppm] = i.value.trim() === '' ? 0 : i.value; }); return o;
  }

  $('#btnEnvase').addEventListener('click', () => {
    try {
      const d = E.dosisDesdeEnvase($('#envCant').value, $('#envLitros').value);
      $('#ppA').value = fmt(d); $('#ppB').value = fmt(d);
      toast(`Listo: ${fmt(d)} por litro de cada parte`);
    } catch (e) { mostrarError(e.message); }
  });

  function mostrarError(m) { const el = $('#errCalc'); el.textContent = m; el.classList.toggle('hidden', !m); }

  function productoElegido() {
    const id = $('#selProducto').value;
    if (id !== PROPIO) return productos().find(x => x.id === id);
    return {
      id: null, nombre: $('#ppNombre').value.trim() || 'Mi producto A+B', unidad: $('#ppUnidad').value,
      dosisA: $('#ppA').value, dosisB: $('#ppB').value, ceCompleta: $('#ppCE').value, verificado: false,
    };
  }

  $('#formCalc').addEventListener('submit', ev => {
    ev.preventDefault(); mostrarError('');
    try {
      const comun = { litros: $('#inLitros').value, cultivoId: estado.cultivoId, etapaId: $('#selEtapa').value };
      if (estado.modo === 'sales') {
        const propia = $('#selReceta').value === PROPIA;
        const entrada = { ...comun, recetaId: propia ? null : $('#selReceta').value, ppm: propia ? ppmPropia() : null, ajustarCE: $('#chkAjustar').checked };
        const r = E.calcularSales(entrada);
        estado.ultimo = { ...entrada, modo: 'sales', sistema: $('#selSistema').value, r };
        pintarResultadoSales();
      } else {
        const entrada = { ...comun, producto: productoElegido() };
        const r = E.dosisAB(entrada);
        estado.ultimo = { ...entrada, modo: 'ab', sistema: $('#selSistema').value, r };
        pintarResultado();
      }
    } catch (e) { mostrarError(e.message); $('#resultado').classList.add('hidden'); }
  });

  function pintarResultado() {
    const { r, cultivoId, etapaId } = estado.ultimo;
    const c = E.cultivo(cultivoId), e = E.etapa(cultivoId, etapaId);
    const u = r.unidad;
    const el = $('#resultado');
    el.innerHTML = `
      <p class="kicker">${c.emoji} ${esc(c.nombre)}${c.etapas.length > 1 ? ' · ' + esc(e.nombre) : ''} · ${fmt(r.litros)} L</p>
      <div class="dosis">
        <div><span class="lbl">Parte A</span><span class="val">${fmt(r.parteA)}<small> ${u}</small></span></div>
        <div><span class="lbl">Parte B</span><span class="val">${fmt(r.parteB)}<small> ${u}</small></span></div>
      </div>
      <p class="sub">${r.porcentajeEtiqueta} % de la dosis de etiqueta</p>
      <ol class="pasos">
        <li>Llena el depósito con ${fmt(r.litros)} L de agua.</li>
        <li>Agrega ${fmt(r.parteA)} ${u} de <b>A</b> y revuelve bien.</li>
        <li>Agrega ${fmt(r.parteB)} ${u} de <b>B</b> y revuelve otra vez.</li>
        <li>Mide: la CE debería quedar entre <b>${fmt1(r.ceRango[0])} y ${fmt1(r.ceRango[1])}</b> mS/cm.</li>
        <li>Ajusta el pH a <b>${fmt1(r.phObjetivo)}</b> (rango ${fmt1(r.phRango[0])}–${fmt1(r.phRango[1])}).</li>
      </ol>
      ${r.avisos.length ? `<ul class="avisos">${r.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      ${c.alertas.length ? `<details class="ayuda"><summary>Ojo con la ${esc(c.nombre.toLowerCase())}</summary><ul>${c.alertas.map(a => `<li>${esc(a)}</li>`).join('')}</ul></details>` : ''}
      <button class="btn primary block" id="btnGuardar">${estado.editandoId ? 'Actualizar siembra' : 'Guardar como siembra'}</button>`;
    el.classList.remove('hidden');
    $('#btnGuardar').addEventListener('click', guardar);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const gramosTxt = g => (g >= 1 ? `${fmt(E.redondear(g, 2))} g` : `${fmt(E.redondear(g * 1000, 1))} mg`);

  function pintarResultadoSales() {
    const { r, cultivoId, etapaId } = estado.ultimo;
    const c = E.cultivo(cultivoId), e = E.etapa(cultivoId, etapaId);
    const grupo = (titulo, lista, nota) => lista.length ? `
      <h3 class="tanque">${titulo}</h3>${nota ? `<p class="nota">${nota}</p>` : ''}
      <table class="tabla"><tbody>${lista.map(s => `<tr><td>${esc(s.nombre)}<small>${esc(s.formula)}</small></td><td class="num">${gramosTxt(s.gramos)}</td></tr>`).join('')}</tbody></table>` : '';
    const macroA = r.sales.filter(s => s.tanque === 'A');
    const macroB = r.sales.filter(s => s.tanque === 'B' && !s.micro);
    const micros = r.sales.filter(s => s.micro);
    const el = $('#resultado');
    el.innerHTML = `
      <p class="kicker">${c.emoji} ${esc(c.nombre)}${c.etapas.length > 1 ? ' · ' + esc(e.nombre) : ''} · ${fmt(r.litros)} L · ${r.porcentajeReceta} % de la receta</p>
      <div class="ce-box"><span class="lbl">CE estimada</span><span class="val">${fmt1(r.ceEstimada)}<small> mS/cm</small></span><span class="sub">objetivo ${fmt1(r.ceRango[0])}–${fmt1(r.ceRango[1])}</span></div>
      ${grupo('Grupo A · calcio y hierro', macroA, 'Disuélvelas por separado de las del grupo B.')}
      ${grupo('Grupo B · nitratos, fosfatos y sulfatos', macroB)}
      ${grupo('Micronutrientes', micros)}
      <ol class="pasos">
        <li>Llena el depósito con ${fmt(r.litros)} L de agua.</li>
        <li>Disuelve cada sal del grupo A en un poco de agua aparte y agrégala. Revuelve.</li>
        <li>Haz lo mismo con el grupo B y los micronutrientes, una por una.</li>
        <li>Mide: la CE debería quedar entre <b>${fmt1(r.ceRango[0])} y ${fmt1(r.ceRango[1])}</b> mS/cm.</li>
        <li>Ajusta el pH a <b>${fmt1(r.phObjetivo)}</b> (rango ${fmt1(r.phRango[0])}–${fmt1(r.phRango[1])}).</li>
      </ol>
      <details class="ayuda"><summary>Ver ppm de cada elemento</summary>
        <table class="tabla"><thead><tr><th>Elemento</th><th class="num">Objetivo</th><th class="num">Logrado</th></tr></thead><tbody>
        ${r.elementos.filter(x => x.objetivo > 0).map(x => `<tr><td>${x.el}</td><td class="num">${fmt(E.redondear(x.objetivo, 2))}</td><td class="num">${fmt(E.redondear(x.logrado, 2))}</td></tr>`).join('')}
        </tbody></table></details>
      ${r.avisos.length ? `<ul class="avisos">${r.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      <button class="btn primary block" id="btnGuardar">${estado.editandoId ? 'Actualizar siembra' : 'Guardar como siembra'}</button>`;
    el.classList.remove('hidden');
    $('#btnGuardar').addEventListener('click', guardar);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function guardar() {
    const u = estado.ultimo; if (!u) return;
    const datos = {
      id: estado.editandoId || undefined, modo: u.modo,
      cultivoId: u.cultivoId, etapaId: u.etapaId, litros: u.r.litros, sistema: u.sistema,
    };
    if (u.modo === 'sales') {
      Object.assign(datos, { recetaId: u.recetaId, ppm: u.ppm, ajustarCE: u.ajustarCE });
    } else {
      let producto = u.producto;
      if (!producto.id) producto = S.guardarProductoPropio(E.validarProducto(producto)) || producto;
      datos.productoId = producto.id;
    }
    const s = S.guardarSiembra(datos);
    if (!s) { toast('No se pudo guardar en este navegador'); return; }
    estado.editandoId = null;
    toast('Siembra guardada. Registra tu primera medición.');
    location.hash = '#siembra-' + s.id;
  }

  /* ---------- Lista de siembras ---------- */
  function pintarSiembras() {
    const lista = S.siembras();
    const el = $('#listaSiembras');
    if (!lista.length) {
      el.innerHTML = `<div class="vacio card"><p>Aún no tienes siembras.</p><p class="nota">Parte con una lechuga en un frasco de 1 litro: es lo más fácil.</p></div>`;
      return;
    }
    el.innerHTML = lista.map(s => {
      let c, e;
      try { c = E.cultivo(s.cultivoId); e = E.etapa(s.cultivoId, s.etapaId); } catch (err) { return ''; }
      const sis = KB.SISTEMAS.find(x => x.id === s.sistema);
      const fecha = new Date(s.creada).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
      const ult = (s.mediciones || [])[0];
      return `<article class="siembra card">
        <div class="s-ico" aria-hidden="true">${c.emoji}</div>
        <div class="s-txt"><h3><a class="s-link" href="#siembra-${esc(s.id)}">${esc(c.nombre)}${c.etapas.length > 1 ? ' · ' + esc(e.nombre) : ''}</a>
          ${ult ? `<span class="punto ${esc(ult.estado)}" title="Última medición">${ESTADO_TXT[ult.estado] || ''}</span>` : '<span class="punto sin">Sin mediciones</span>'}</h3>
          <p>${fmt(s.litros)} L · ${esc(sis ? sis.nombre : '')} · ${s.modo === 'sales' ? 'Sales' : 'A+B'} · desde ${esc(fecha)}</p></div>
        <div class="s-acc">
          <button class="btn ghost small" data-abrir="${esc(s.id)}">Recalcular</button>
          <button class="icon-btn" data-borrar="${esc(s.id)}" aria-label="Borrar siembra">✕</button>
        </div></article>`;
    }).join('');
  }

  $('#listaSiembras').addEventListener('click', ev => {
    const a = ev.target.closest('[data-abrir]'), b = ev.target.closest('[data-borrar]');
    if (b && confirm('¿Borrar esta siembra? No se puede deshacer.')) { S.borrarSiembra(b.dataset.borrar); pintarSiembras(); }
    if (a) recalcular(a.dataset.abrir);
  });

  function recalcular(sid) {
    {
      const s = S.siembra(sid); if (!s) return;
      estado.editandoId = s.id; estado.cultivoId = s.cultivoId;
      pintarCultivos(); pintarEtapas(s.etapaId);
      $('#inLitros').value = fmt(s.litros); $('#selSistema').value = s.sistema; pintarFicha();
      if (s.modo === 'sales') {
        ponerModo('sales');
        $('#selReceta').value = s.recetaId || PROPIA;
        $('#recetaPropia').classList.toggle('hidden', !!s.recetaId);
        if (!s.recetaId && s.ppm) document.querySelectorAll('[data-ppm]').forEach(i => { i.value = fmt(s.ppm[i.dataset.ppm] ?? 0); });
        $('#chkAjustar').checked = s.ajustarCE !== false;
      } else {
        ponerModo('ab');
        pintarProductos(productos().some(p => p.id === s.productoId) ? s.productoId : undefined);
      }
      $('#resultado').classList.add('hidden');
      location.hash = '#calcular';
      $('#calcTitulo').textContent = 'Recalcular siembra';
    }
  }

  /* ---------- Detalle de siembra y mediciones (fase 2) ---------- */
  const ESTADO_TXT = { verde: 'En rango', amarillo: 'Revisar', rojo: 'Corregir' };
  const med = { sid: null, phModo: 'medidor', tira: null };
  const fechaTxt = iso => new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  $('#chipsTira').innerHTML = E.TIRAS_PH.map(v => `<button type="button" class="chip" role="radio" aria-checked="false" data-tira="${v}">${fmt1(v)}</button>`).join('');
  $('#chipsTira').addEventListener('click', ev => {
    const b = ev.target.closest('[data-tira]'); if (!b) return;
    med.tira = Number(b.dataset.tira);
    document.querySelectorAll('[data-tira]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
  });
  document.querySelector('[data-ph]').parentElement.addEventListener('click', ev => {
    const b = ev.target.closest('[data-ph]'); if (!b) return;
    med.phModo = b.dataset.ph;
    document.querySelectorAll('[data-ph]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    $('#campoPH').classList.toggle('hidden', med.phModo !== 'medidor');
    $('#campoTira').classList.toggle('hidden', med.phModo !== 'tira');
  });
  $('#mSinCE').addEventListener('change', () => { $('#campoCE').classList.toggle('hidden', $('#mSinCE').checked); });

  function contextoSiembra(s) {
    const ctx = { cultivoId: s.cultivoId, etapaId: s.etapaId, litros: s.litros, sistemaId: s.sistema };
    if (s.modo === 'sales') ctx.receta = s.recetaId ? { recetaId: s.recetaId } : { ppm: s.ppm };
    else { const p = productos().find(x => x.id === s.productoId); if (p) ctx.producto = p; }
    return ctx;
  }

  function abrirSiembra(sid) {
    const s = S.siembra(sid); if (!s) return;
    if (med.sid !== sid) {
      med.sid = sid; med.tira = null;
      $('#formMed').reset(); $('#campoCE').classList.remove('hidden');
      document.querySelectorAll('[data-tira]').forEach(x => x.setAttribute('aria-checked', 'false'));
      $('#resMed').classList.add('hidden'); $('#errMed').classList.add('hidden');
    }
    const c = E.cultivo(s.cultivoId), e = E.etapa(s.cultivoId, s.etapaId);
    const sis = KB.SISTEMAS.find(x => x.id === s.sistema);
    $('#siembraCab').innerHTML = `
      <div class="cab"><span class="s-ico" aria-hidden="true">${c.emoji}</span>
        <div><h1>${esc(c.nombre)}${c.etapas.length > 1 ? ' · ' + esc(e.nombre) : ''}</h1>
        <p class="nota">${fmt(s.litros)} L · ${esc(sis ? sis.nombre : '')} · ${s.modo === 'sales' ? 'Sales individuales' : 'Concentrado A+B'}</p></div></div>
      <div class="rangos"><div><span class="lbl">CE</span><b>${fmt1(e.ceMin)}–${fmt1(e.ceMax)}</b></div><div><span class="lbl">pH</span><b>${fmt1(e.phMin)}–${fmt1(e.phMax)}</b></div></div>
      <button class="btn ghost small" data-abrir="${esc(s.id)}" type="button">Recalcular dosis</button>`;
    pintarHistorial(s);
  }

  function pintarHistorial(s) {
    const lista = s.mediciones || [];
    $('#historial').innerHTML = !lista.length
      ? '<div class="card vacio"><p>Aún no hay mediciones.</p><p class="nota">Mide antes de sembrar y luego cada pocos días.</p></div>'
      : lista.map(m => `<article class="card medicion">
          <span class="punto ${esc(m.estado)}">${ESTADO_TXT[m.estado] || ''}</span>
          <div class="m-txt"><b>${m.ce != null ? 'CE ' + fmt(m.ce) : 'CE sin medir'} · ${m.ph != null ? 'pH ' + (m.phAproximado ? '≈' : '') + fmt1(m.ph) : 'pH sin medir'}${m.temp != null ? ' · ' + fmt(m.temp) + ' °C' : ''}</b>
            <p class="nota">${esc(fechaTxt(m.fecha))}${m.nota ? ' · ' + esc(m.nota) : ''}</p></div>
          <button class="icon-btn" data-borrar-med="${esc(m.id)}" aria-label="Borrar medición">✕</button>
        </article>`).join('');
  }

  $('#historial').addEventListener('click', ev => {
    const b = ev.target.closest('[data-borrar-med]'); if (!b) return;
    if (!confirm('¿Borrar esta medición? No se puede deshacer.')) return;
    S.borrarMedicion(med.sid, b.dataset.borrarMed); pintarHistorial(S.siembra(med.sid));
  });
  $('#siembraCab').addEventListener('click', ev => {
    const a = ev.target.closest('[data-abrir]'); if (a) recalcular(a.dataset.abrir);
  });

  $('#formMed').addEventListener('submit', ev => {
    ev.preventDefault();
    const err = $('#errMed'); err.classList.add('hidden');
    const s = S.siembra(med.sid); if (!s) return;
    try {
      const ce = $('#mSinCE').checked ? null : $('#mCE').value.trim() || null;
      const tira = med.phModo === 'tira';
      const ph = tira ? med.tira : ($('#mPH').value.trim() || null);
      const temp = $('#mT').value.trim() || null;
      const r = E.evaluarMedicion({ ...contextoSiembra(s), ce, ph, phAproximado: tira, temp });
      S.agregarMedicion(s.id, {
        ce: r.ce ? r.ce.valor : null, ph: r.ph ? r.ph.valor : null, phAproximado: tira, temp: r.temp ? r.temp.valor : null,
        estado: r.estado, nota: $('#mNota').value.trim().slice(0, 200),
      });
      pintarResultadoMedicion(r);
      pintarHistorial(S.siembra(s.id));
      $('#mNota').value = '';
    } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
  });

  function pintarResultadoMedicion(r) {
    const prox = new Date(Date.now() + r.proximaDias * 864e5).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });
    const fila = (lbl, x, unidad) => x ? `<div class="sem ${x.estado}"><span class="lbl">${lbl}</span><b>${fmt(x.valor)}${unidad}</b><span>${x.rango ? `rango ${fmt1(x.rango[0])}–${fmt1(x.rango[1])}` : ''}</span></div>` : '';
    const extraSales = a => a.sales ? `<table class="tabla"><tbody>${a.sales.map(s => `<tr><td>${esc(s.nombre)}<small>Grupo ${s.tanque}</small></td><td class="num">${gramosTxt(s.gramos)}</td></tr>`).join('')}</tbody></table>` : '';
    const el = $('#resMed');
    el.className = 'card resmed ' + r.estado;
    el.innerHTML = `
      <p class="estado-big ${r.estado}">${ESTADO_TXT[r.estado]}</p>
      <div class="sems">${fila('CE', r.ce, '')}${fila('pH', r.ph && { ...r.ph, valor: fmt1(r.ph.valor) }, '')}${fila('Agua', r.temp, ' °C')}</div>
      <ul class="acciones">${r.acciones.map(a => `<li class="${a.tipo}">${esc(a.texto)}${extraSales(a)}</li>`).join('')}</ul>
      ${r.alertas.length ? `<ul class="avisos">${r.alertas.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      <p class="nota">Medición guardada. Próxima medición sugerida: <b>${esc(prox)}</b>.</p>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Copia de seguridad ---------- */
  $('#btnExportar').addEventListener('click', () => {
    const blob = new Blob([S.exportar()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hidroverde-copia-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Copia descargada');
  });
  $('#inImportar').addEventListener('change', async ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    if (!confirm('Importar reemplaza las siembras que tienes ahora en este teléfono. ¿Continuar?')) return;
    try { const n = S.importar(await f.text()); toast(`Copia restaurada: ${n} siembra${n === 1 ? '' : 's'}`); pintarSiembras(); }
    catch (e) { toast(e.message); }
  });

  /* ---------- Arranque ---------- */
  pintarCultivos();
  pintarProductos();
  pintarFicha();
  ir();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
