/* HidroVerde — datos del usuario, guardados solo en este dispositivo. */
(function (root) {
  const KEY = 'hidroverde.v1';
  const vacio = () => ({ siembras: [], productosPropios: [] });

  function leer() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return vacio();
      const d = JSON.parse(raw);
      return { siembras: Array.isArray(d.siembras) ? d.siembras : [], productosPropios: Array.isArray(d.productosPropios) ? d.productosPropios : [] };
    } catch (e) { return vacio(); }
  }

  function escribir(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  }

  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const STORE = {
    siembras: () => leer().siembras,
    guardarSiembra(s) {
      const d = leer();
      if (s.id) { d.siembras = d.siembras.map(x => (x.id === s.id ? { ...x, ...s } : x)); }
      else { s = { ...s, id: id(), creada: new Date().toISOString() }; d.siembras.unshift(s); }
      return escribir(d) ? s : null;
    },
    borrarSiembra(sid) { const d = leer(); d.siembras = d.siembras.filter(x => x.id !== sid); return escribir(d); },
    siembra: sid => leer().siembras.find(x => x.id === sid) || null,
    agregarMedicion(sid, m) {
      const d = leer();
      const s = d.siembras.find(x => x.id === sid); if (!s) return null;
      const med = { ...m, id: id(), fecha: m.fecha || new Date().toISOString() };
      s.mediciones = [med, ...(s.mediciones || [])];
      return escribir(d) ? med : null;
    },
    borrarMedicion(sid, mid) {
      const d = leer();
      const s = d.siembras.find(x => x.id === sid); if (!s) return false;
      s.mediciones = (s.mediciones || []).filter(x => x.id !== mid);
      return escribir(d);
    },
    /** Copia de seguridad: todo lo guardado como texto JSON. */
    exportar: () => JSON.stringify({ app: 'HidroVerde', version: 1, exportado: new Date().toISOString(), ...leer() }, null, 2),
    /** Restaura una copia. Reemplaza lo actual; devuelve cuántas siembras trae. */
    importar(texto) {
      let d;
      try { d = JSON.parse(texto); } catch (e) { throw new Error('El archivo no es una copia de HidroVerde.'); }
      if (!d || d.app !== 'HidroVerde' || !Array.isArray(d.siembras)) throw new Error('El archivo no es una copia de HidroVerde.');
      const limpio = { siembras: d.siembras, productosPropios: Array.isArray(d.productosPropios) ? d.productosPropios : [] };
      if (!escribir(limpio)) throw new Error('No se pudo guardar en este navegador.');
      return limpio.siembras.length;
    },
    productosPropios: () => leer().productosPropios,
    guardarProductoPropio(p) {
      const d = leer();
      p = { ...p, id: p.id || 'propio-' + id() };
      d.productosPropios = [p, ...d.productosPropios.filter(x => x.id !== p.id)];
      return escribir(d) ? p : null;
    },
  };
  root.HV_STORE = STORE;
})(self);
