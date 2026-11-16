/* HidroVerde — motor de cálculo.
 * Funciones puras, sin interfaz: se prueban con `node --test` y en la fase 5 las usa el agente.
 */
(function (root) {
  const KB = (typeof module !== 'undefined' && module.exports) ? require('./kb.js') : root.HV_KB;

  const LIMITES = {
    litrosMin: 0.1, litrosMax: 10000,
    dosisMax: 100,          // ml o g por litro: más que esto es casi seguro un error de tipeo
    ceMin: 0.3, ceMax: 5,   // CE a dosis completa, mS/cm
  };

  const redondear = (n, dec = 1) => Math.round(n * 10 ** dec) / 10 ** dec;
  const es = (n, dec = 1) => Number(n).toFixed(dec).replace('.', ','); // número en formato chileno para textos
  const num = v => (typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v));

  function cultivo(id) {
    const c = KB.CULTIVOS.find(x => x.id === id);
    if (!c) throw new Error(`Cultivo desconocido: ${id}`);
    return c;
  }

  function etapa(cultivoId, etapaId) {
    const c = cultivo(cultivoId);
    const e = c.etapas.find(x => x.id === etapaId);
    if (!e) throw new Error(`Etapa desconocida para ${c.nombre}: ${etapaId}`);
    return e;
  }

  /** CE objetivo: el centro del rango de la etapa. */
  function ceObjetivo(cultivoId, etapaId) {
    const e = etapa(cultivoId, etapaId);
    return redondear((e.ceMin + e.ceMax) / 2, 2);
  }

  /** Dosis por litro a partir de un envase: "este envase rinde N litros". */
  function dosisDesdeEnvase(cantidadEnvase, litrosQueRinde) {
    const c = num(cantidadEnvase), l = num(litrosQueRinde);
    if (!(c > 0) || !(l > 0)) throw new Error('La cantidad del envase y los litros que rinde deben ser mayores que cero.');
    return redondear(c / l, 3);
  }

  /** Revisa un producto (precargado o escrito por el usuario) y lo normaliza. */
  function validarProducto(p) {
    const dosisA = num(p.dosisA), dosisB = num(p.dosisB), ceCompleta = num(p.ceCompleta);
    const errores = [];
    if (!(dosisA > 0)) errores.push('Falta la dosis de la parte A.');
    if (!(dosisB > 0)) errores.push('Falta la dosis de la parte B.');
    if (dosisA > LIMITES.dosisMax || dosisB > LIMITES.dosisMax) errores.push(`Una dosis de más de ${LIMITES.dosisMax} por litro parece un error. Revisa la etiqueta.`);
    if (!(ceCompleta >= LIMITES.ceMin && ceCompleta <= LIMITES.ceMax)) errores.push('La CE a dosis completa debe estar entre 0,3 y 5 mS/cm.');
    if (p.unidad !== 'ml' && p.unidad !== 'g') errores.push('La unidad debe ser ml o g.');
    if (errores.length) throw new Error(errores.join(' '));
    return { ...p, dosisA, dosisB, ceCompleta };
  }

  /**
   * Cuánto de A y de B poner.
   * La dosis de etiqueta da una CE aproximada (ceCompleta). Para llegar a la CE objetivo
   * de la etapa se ajusta en proporción: factor = CE objetivo / CE a dosis completa.
   */
  function dosisAB({ producto, litros, cultivoId, etapaId }) {
    const p = validarProducto(producto);
    const L = num(litros);
    if (!(L >= LIMITES.litrosMin && L <= LIMITES.litrosMax)) {
      throw new Error('Escribe cuántos litros de agua tiene tu depósito (entre 0,1 y 10.000).');
    }
    const e = etapa(cultivoId, etapaId);
    const ceObj = ceObjetivo(cultivoId, etapaId);
    const factor = ceObj / p.ceCompleta;

    const avisos = [];
    if (factor > 1.05) avisos.push(`Este cultivo pide más que la dosis de etiqueta (${Math.round(factor * 100)} %). Sube de a poco y mide la CE.`);
    if (factor < 0.4) avisos.push('Es una dosis muy baja respecto de la etiqueta. Confirma con el medidor.');
    if (!p.verificado) avisos.push('La CE a dosis completa es una estimación: mide la solución y ajusta.');

    return {
      unidad: p.unidad,
      litros: L,
      parteA: redondear(p.dosisA * L * factor),
      parteB: redondear(p.dosisB * L * factor),
      porcentajeEtiqueta: Math.round(factor * 100),
      ceObjetivo: ceObj,
      ceRango: [e.ceMin, e.ceMax],
      phRango: [e.phMin, e.phMax],
      phObjetivo: e.phObj,
      avisos,
    };
  }

  /* ---------------- Modo avanzado: sales individuales ---------------- */

  const sal = id => KB.SALES.find(s => s.id === id);

  /**
   * CE estimada (mS/cm) a partir de los cationes principales:
   * CE ≈ suma de cationes en meq/L ÷ 10 (regla práctica de Sonneveld).
   */
  function estimarCE(ppm) {
    const meq = (ppm.K || 0) / 39.1 + (ppm.Ca || 0) / 20.04 + (ppm.Mg || 0) / 12.15;
    return redondear(meq / 10, 2);
  }

  /** Lee y valida las ppm de una receta (precargada o escrita por el usuario). */
  function ppmReceta({ recetaId, ppm }) {
    let base = ppm;
    if (recetaId) {
      const r = KB.RECETAS.find(x => x.id === recetaId);
      if (!r) throw new Error(`Receta desconocida: ${recetaId}`);
      base = r.ppm;
    }
    if (!base) throw new Error('Falta la receta.');
    const out = {};
    for (const el of KB.ELEMENTOS) {
      const v = num(base[el] ?? 0);
      if (!(v >= 0) || v > 1000) throw new Error(`El valor de ${el} debe estar entre 0 y 1000 ppm.`);
      out[el] = v;
    }
    if (!out.Ca || !out.N || !out.K) throw new Error('La receta necesita al menos nitrógeno, potasio y calcio.');
    return out;
  }

  /**
   * Gramos de cada sal para llegar a la receta.
   * Orden de cálculo (método secuencial):
   *   Ca → nitrato de calcio · P → fosfato monopotásico · Mg → sulfato de magnesio
   *   N que falta → nitrato de potasio · K que falta → sulfato de potasio
   *   Fe → quelato · Mn, B, Zn, Cu, Mo → su sal.
   * Si ajustarCE, la receta se escala para llegar a la CE objetivo del cultivo y etapa.
   */
  function calcularSales({ recetaId, ppm, litros, cultivoId, etapaId, ajustarCE = true }) {
    const L = num(litros);
    if (!(L >= LIMITES.litrosMin && L <= LIMITES.litrosMax)) {
      throw new Error('Escribe cuántos litros de agua tiene tu depósito (entre 0,1 y 10.000).');
    }
    const receta = ppmReceta({ recetaId, ppm });
    const e = etapa(cultivoId, etapaId);
    const ceObj = ceObjetivo(cultivoId, etapaId);
    const ceReceta = estimarCE(receta);
    const factor = ajustarCE && ceReceta > 0 ? ceObj / ceReceta : 1;

    const obj = {};
    for (const el of KB.ELEMENTOS) obj[el] = receta[el] * factor;

    const f = (id, el) => sal(id).comp[el] / 100;
    const mg = {}; // mg de sal por litro

    mg['nitrato-calcio'] = obj.Ca / f('nitrato-calcio', 'Ca');
    mg['fosfato-monopotasico'] = obj.P / f('fosfato-monopotasico', 'P');
    mg['sulfato-magnesio'] = obj.Mg / f('sulfato-magnesio', 'Mg');

    const nPuesto = mg['nitrato-calcio'] * f('nitrato-calcio', 'N');
    mg['nitrato-potasio'] = Math.max(0, obj.N - nPuesto) / f('nitrato-potasio', 'N');

    const kPuesto = mg['fosfato-monopotasico'] * f('fosfato-monopotasico', 'K') + mg['nitrato-potasio'] * f('nitrato-potasio', 'K');
    mg['sulfato-potasio'] = Math.max(0, obj.K - kPuesto) / f('sulfato-potasio', 'K');

    mg['quelato-hierro'] = obj.Fe / f('quelato-hierro', 'Fe');
    mg['sulfato-manganeso'] = obj.Mn / f('sulfato-manganeso', 'Mn');
    mg['acido-borico'] = obj.B / f('acido-borico', 'B');
    mg['sulfato-zinc'] = obj.Zn / f('sulfato-zinc', 'Zn');
    mg['sulfato-cobre'] = obj.Cu / f('sulfato-cobre', 'Cu');
    mg['molibdato-sodio'] = obj.Mo / f('molibdato-sodio', 'Mo');

    // Lo que realmente aporta la mezcla, elemento por elemento.
    const logrado = Object.fromEntries(KB.ELEMENTOS.map(el => [el, 0]));
    for (const [id, m] of Object.entries(mg)) {
      for (const [el, pct] of Object.entries(sal(id).comp)) logrado[el] += m * pct / 100;
    }

    const sales = KB.SALES.filter(s => mg[s.id] > 0).map(s => {
      const gramos = mg[s.id] * L / 1000;
      return {
        id: s.id, nombre: s.nombre, formula: s.formula, tanque: s.tanque,
        mgPorLitro: redondear(mg[s.id], 1),
        gramos: redondear(gramos, 5), // los micronutrientes pueden ser décimas de mg
        micro: ['sulfato-manganeso', 'acido-borico', 'sulfato-zinc', 'sulfato-cobre', 'molibdato-sodio'].includes(s.id),
      };
    });

    const elementos = KB.ELEMENTOS.map(el => ({
      el, objetivo: redondear(obj[el], 2), logrado: redondear(logrado[el], 2),
      diferencia: obj[el] > 0 ? Math.round((logrado[el] / obj[el] - 1) * 100) : 0,
    }));

    const avisos = [];
    for (const x of elementos) {
      if (['N', 'K', 'S'].includes(x.el) && x.objetivo > 0 && Math.abs(x.diferencia) > 15) {
        avisos.push(`${x.el}: la mezcla da ${x.logrado} ppm y la receta pide ${x.objetivo} (${x.diferencia > 0 ? '+' : ''}${x.diferencia} %). Con estas sales no se puede igualar exacto.`);
      }
    }
    if (factor > 1.05) avisos.push(`La receta se subió a ${Math.round(factor * 100)} % para llegar a la CE de este cultivo.`);
    avisos.push('La CE es una estimación: mide la solución ya preparada y ajusta.');
    if (sales.some(s => s.micro && s.gramos < 0.1)) {
      avisos.push('Los micronutrientes son cantidades muy pequeñas. Pésalos en una balanza de 0,01 g o prepara una solución madre de micros.');
    }

    return {
      litros: L, factor: redondear(factor, 3), porcentajeReceta: Math.round(factor * 100),
      ceEstimada: estimarCE(logrado), ceObjetivo: ceObj, ceRango: [e.ceMin, e.ceMax],
      phRango: [e.phMin, e.phMax], phObjetivo: e.phObj,
      sales, elementos, avisos,
    };
  }

  /* ---------------- Fase 2: evaluar una medición ---------------- */

  const NIVEL = { verde: 0, amarillo: 1, rojo: 2 };
  const peor = (...xs) => xs.filter(Boolean).sort((a, b) => NIVEL[b] - NIVEL[a])[0] || 'verde';

  /** Valores aproximados que se leen en una tira de pH común. */
  const TIRAS_PH = [4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0];

  /**
   * Evalúa CE, pH y temperatura del agua de una siembra y dice qué hacer.
   * ce: número o null (sin medidor). ph: número o null. phAproximado: true si viene de tira.
   * Para CE baja, si se entrega `producto` (modo A+B) o `receta` (modo sales), calcula cuánto agregar.
   */
  function evaluarMedicion({ cultivoId, etapaId, litros, ce = null, ph = null, phAproximado = false, temp = null, sistemaId = null, producto = null, receta = null }) {
    const e = etapa(cultivoId, etapaId);
    const c = cultivo(cultivoId);
    const ceObj = ceObjetivo(cultivoId, etapaId);
    const L = num(litros);
    const vacio = v => v === null || v === undefined || v === '';
    const CE = vacio(ce) ? null : num(ce);
    const PH = vacio(ph) ? null : num(ph);
    const T = vacio(temp) ? null : num(temp);

    if (CE !== null && !(CE >= 0 && CE <= 10)) throw new Error('La CE debe estar entre 0 y 10 mS/cm. Revisa la unidad de tu medidor.');
    if (PH !== null && !(PH >= 0 && PH <= 14)) throw new Error('El pH debe estar entre 0 y 14.');
    if (T !== null && !(T >= 0 && T <= 45)) throw new Error('La temperatura del agua debe estar entre 0 y 45 °C.');
    if (CE === null && PH === null) throw new Error('Anota al menos la CE o el pH.');

    const acciones = [];
    const res = { ce: null, ph: null, temp: null };

    // --- CE ---
    if (CE !== null) {
      let estado = 'verde', nivel = 'ok';
      if (CE > e.ceMax) { nivel = 'alta'; estado = CE > e.ceMax * 1.15 ? 'rojo' : 'amarillo'; }
      if (CE < e.ceMin) { nivel = 'baja'; estado = CE < e.ceMin * 0.85 ? 'rojo' : 'amarillo'; }
      res.ce = { valor: CE, nivel, estado, rango: [e.ceMin, e.ceMax], objetivo: ceObj };

      if (nivel === 'alta' && L > 0) {
        const agregar = redondear(L * (CE / ceObj - 1), 1);
        const reemplazar = redondear(L * (1 - ceObj / CE), 1);
        acciones.push({ tipo: 'ce', texto: `La CE está alta. Agrega ${es(agregar)} L de agua sola. Si no cabe, saca ${es(reemplazar)} L de solución y repón esa cantidad con agua sola.`, agregarAgua: agregar, reemplazar });
      }
      if (nivel === 'baja' && L > 0) {
        const fraccion = (ceObj - CE);
        let texto = `La CE está baja: a la planta le faltan nutrientes. Sube la CE ${es(fraccion, 2)} mS/cm agregando nutriente de a poco y vuelve a medir.`;
        const extra = { };
        if (producto) {
          const p = validarProducto(producto);
          extra.parteA = redondear(p.dosisA * L * fraccion / p.ceCompleta);
          extra.parteB = redondear(p.dosisB * L * fraccion / p.ceCompleta);
          extra.unidad = p.unidad;
          texto = `La CE está baja. Agrega aprox. ${es(extra.parteA)} ${p.unidad} de A, revuelve, y luego ${es(extra.parteB)} ${p.unidad} de B. Vuelve a medir.`;
        } else if (receta) {
          const r = calcularSales({ ...receta, litros: L, cultivoId, etapaId, ajustarCE: true });
          extra.sales = r.sales.filter(s => !s.micro).map(s => ({ nombre: s.nombre, gramos: redondear(s.gramos * fraccion / ceObj, 5), tanque: s.tanque }));
          texto = `La CE está baja. Agrega ${Math.round(fraccion / ceObj * 100)} % más de cada sal (grupo A y grupo B por separado) y vuelve a medir.`;
        }
        acciones.push({ tipo: 'ce', texto, ...extra });
      }
    } else {
      const s = sistemaId ? KB.SISTEMAS.find(x => x.id === sistemaId) : null;
      acciones.push({ tipo: 'ce', texto: `Sin medidor de CE no se puede saber si faltan o sobran nutrientes. Prepara la solución con la dosis de HidroVerde y ${s && s.recircula ? 'renuévala completa cada 1 a 2 semanas' : 'repón con solución nueva cuando baje el nivel'}. Un medidor de CE es barato y vale la pena.` });
    }

    // --- pH ---
    if (PH !== null) {
      let estado = 'verde', nivel = 'ok';
      const margen = phAproximado ? 0.25 : 0; // una tira no distingue décimas
      if (PH > e.phMax + margen) { nivel = 'alto'; estado = PH > e.phMax + 0.3 + margen ? 'rojo' : 'amarillo'; }
      if (PH < e.phMin - margen) { nivel = 'bajo'; estado = PH < e.phMin - 0.3 - margen ? 'rojo' : 'amarillo'; }
      res.ph = { valor: PH, nivel, estado, rango: [e.phMin, e.phMax], objetivo: e.phObj, aproximado: phAproximado };
      if (nivel === 'alto') acciones.push({ tipo: 'ph', texto: `El pH está alto: con pH sobre ${es(e.phMax)} la planta no absorbe bien el hierro y otros nutrientes. Agrega regulador de pH- (ácido) gota a gota, revuelve, espera 15 a 30 minutos y vuelve a medir. Objetivo: ${es(e.phObj)}.` });
      if (nivel === 'bajo') acciones.push({ tipo: 'ph', texto: `El pH está bajo. Agrega regulador de pH+ gota a gota, revuelve, espera 15 a 30 minutos y vuelve a medir. Objetivo: ${es(e.phObj)}.` });
      if (phAproximado) acciones.push({ tipo: 'ph', texto: 'La tira de pH da un valor aproximado. Cuando puedas, consigue un medidor de pH digital.' });
    } else {
      acciones.push({ tipo: 'ph', texto: 'Mide también el pH: aunque haya nutrientes, con el pH fuera de rango la planta no los puede absorber.' });
    }

    // --- Temperatura del agua ---
    if (T !== null) {
      let estado = 'verde';
      if (T > 24) { estado = T > 27 ? 'rojo' : 'amarillo'; acciones.push({ tipo: 'temp', texto: 'El agua está caliente: retiene menos oxígeno y aumenta el riesgo de raíces podridas. Pon el depósito a la sombra, aíslalo o agrega agua fresca.' }); }
      if (T < 15) { estado = 'amarillo'; acciones.push({ tipo: 'temp', texto: 'El agua está fría: la planta crece más lento y absorbe menos nutrientes.' }); }
      res.temp = { valor: T, estado };
    }

    const estado = peor(res.ce && res.ce.estado, res.ph && res.ph.estado, res.temp && res.temp.estado);
    if (estado === 'verde' && CE !== null && PH !== null) acciones.unshift({ tipo: 'ok', texto: '¡Todo en rango! No hay que corregir nada.' });

    // Próxima medición sugerida
    const s = sistemaId ? KB.SISTEMAS.find(x => x.id === sistemaId) : null;
    const proximaDias = estado !== 'verde' ? 1 : (s && s.recircula ? 3 : 7);

    // Alertas propias del cultivo que aplican a esta medición
    const alertas = [];
    if (cultivoId === 'lechuga' && CE !== null && CE > 2.0) alertas.push(c.alertas[0]);
    if (cultivoId === 'lechuga' && PH !== null && PH > 6.2) alertas.push(c.alertas[1]);
    if (cultivoId === 'albahaca' && CE !== null && CE > e.ceMax) alertas.push(c.alertas[0]);
    if (cultivoId === 'frutilla' && CE !== null && CE > e.ceMax) alertas.push(c.alertas[0]);

    return { estado, ...res, acciones, alertas, proximaDias };
  }

  const ENGINE = { LIMITES, TIRAS_PH, cultivo, etapa, ceObjetivo, dosisDesdeEnvase, validarProducto, dosisAB, estimarCE, ppmReceta, calcularSales, evaluarMedicion, redondear };
  if (typeof module !== 'undefined' && module.exports) module.exports = ENGINE;
  else root.HV_ENGINE = ENGINE;
})(typeof self !== 'undefined' ? self : this);
