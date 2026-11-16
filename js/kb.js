/* HidroVerde — base de conocimiento.
 * Rangos de CE y pH aprobados por Juancho (ingeniero agrónomo) el 2026-11-16.
 * Fuente: cuaderno NotebookLM "hidroponia"; detalle en projects/agroinicio/rangos-cultivos.md.
 * Cambiar un valor aquí cambia lo que recomienda la app (y, en la fase 5, el agente).
 */
(function (root) {
  const CULTIVOS = [
    {
      id: 'lechuga', nombre: 'Lechuga', emoji: '🥬',
      etapas: [
        { id: 'plantula', nombre: 'Plántula', ceMin: 0.8, ceMax: 1.0, phMin: 5.5, phMax: 6.0, phObj: 5.8 },
        { id: 'crecimiento', nombre: 'Crecimiento', ceMin: 1.0, ceMax: 1.4, phMin: 5.5, phMax: 6.0, phObj: 5.8 },
        { id: 'cosecha', nombre: 'Cosecha', ceMin: 1.5, ceMax: 1.8, phMin: 5.5, phMax: 6.0, phObj: 5.8 },
      ],
      alertas: [
        'Con CE sobre 2,0 aparece quemadura en los bordes de las hojas (tip burn).',
        'Con pH sobre 6,2 las hojas se ponen amarillas por falta de hierro.',
      ],
    },
    {
      id: 'albahaca', nombre: 'Albahaca', emoji: '🌿',
      etapas: [{ id: 'ciclo', nombre: 'Todo el ciclo', ceMin: 1.0, ceMax: 1.6, phMin: 5.5, phMax: 6.5, phObj: 5.8 }],
      alertas: ['Con la CE muy alta las hojas salen más pequeñas y amargas.'],
    },
    {
      id: 'espinaca', nombre: 'Espinaca', emoji: '🍃',
      etapas: [{ id: 'ciclo', nombre: 'Todo el ciclo', ceMin: 1.8, ceMax: 2.3, phMin: 6.0, phMax: 7.0, phObj: 6.5 }],
      alertas: ['Es la hoja que más nutrientes pide; tolera un pH algo más alto que las demás.'],
    },
    {
      id: 'rucula', nombre: 'Rúcula', emoji: '🥗',
      etapas: [{ id: 'ciclo', nombre: 'Todo el ciclo', ceMin: 0.8, ceMax: 1.8, phMin: 5.8, phMax: 6.5, phObj: 6.0 }],
      alertas: [],
    },
    {
      id: 'frutilla', nombre: 'Frutilla', emoji: '🍓',
      etapas: [
        { id: 'vegetativo', nombre: 'Vegetativo', ceMin: 1.0, ceMax: 1.4, phMin: 5.5, phMax: 6.2, phObj: 5.8 },
        { id: 'floracion', nombre: 'Floración y fruto', ceMin: 1.0, ceMax: 1.4, phMin: 5.5, phMax: 6.2, phObj: 5.8 },
      ],
      alertas: [
        'Sus raíces son sensibles a la sal: no pases del rango de CE.',
        'Al florecer, cambia a una solución con más potasio y fósforo, sin subir la CE.',
      ],
    },
  ];

  /* Productos A+B precargados.
   * dosisA / dosisB: cantidad por litro de agua a dosis completa de etiqueta.
   * ceCompleta: CE aproximada (mS/cm) de la solución a dosis completa. Es una estimación:
   * la app siempre pide medir para confirmar.
   */
  const PRODUCTOS = [
    {
      id: 'chileindoor-liquida', nombre: 'Chile Indoor · Solución líquida concentrada A+B',
      unidad: 'ml', dosisA: 2.5, dosisB: 2.5, ceCompleta: 1.8,
      nota: 'Dosis de etiqueta: 2,5 ml de A y 2,5 ml de B por litro. Revisa tu envase: algunas presentaciones indican otra dosis.',
      verificado: false,
    },
  ];

  /* Sistemas hidropónicos.
   * dificultad: 1 fácil · 2 media · 3 avanzada. bomba: 'no' | 'aire' | 'agua' | 'agua y aire'.
   * recircula: true si la solución vuelve al depósito (hay que renovarla cada cierto tiempo).
   */
  const SISTEMAS = [
    {
      id: 'kratky', nombre: 'Kratky', corto: 'Frasco o caja sin bomba', dificultad: 1, bomba: 'no', electricidad: false, recircula: false,
      como: 'Las raíces cuelgan en la solución. A medida que la planta toma agua, el nivel baja y deja una cámara de aire donde respiran las raíces de arriba.',
      ideal: 'Lechuga, rúcula, albahaca y otras hojas de ciclo corto.',
      solucion: 'No rellenes hasta arriba: la cámara de aire es parte del sistema. Si el nivel baja mucho, repón con solución, dejando aire.',
      ojo: 'No sirve bien para plantas grandes o de fruto, que toman mucha agua.',
    },
    {
      id: 'mecha', nombre: 'Mecha', corto: 'Una mecha sube la solución al sustrato', dificultad: 1, bomba: 'no', electricidad: false, recircula: false,
      como: 'Una mecha de tela o cuerda lleva la solución desde el depósito hasta un sustrato (fibra de coco, perlita) por capilaridad.',
      ideal: 'Aromáticas y hojas pequeñas.',
      solucion: 'Rellena el depósito con solución; cada 2 semanas riega el sustrato con agua sola para lavar las sales acumuladas.',
      ojo: 'Entrega poca agua: se queda corto con plantas grandes o con calor.',
    },
    {
      id: 'dwc', nombre: 'Raíz profunda (DWC)', corto: 'Balde con bomba de aire', dificultad: 2, bomba: 'aire', electricidad: true, recircula: true,
      como: 'Las raíces quedan sumergidas en solución, y una bomba de aire con piedra difusora la oxigena todo el tiempo.',
      ideal: 'Lechuga, espinaca, albahaca; también plantas más grandes en baldes.',
      solucion: 'Mide CE y pH cada pocos días. Renueva toda la solución cada 1 a 2 semanas.',
      ojo: 'Si la bomba de aire se detiene por mucho tiempo, las raíces se asfixian y se pudren.',
    },
    {
      id: 'balsa', nombre: 'Raíz flotante (balsa)', corto: 'Plancha flotando en una piscina', dificultad: 2, bomba: 'aire', electricidad: true, recircula: true,
      como: 'Una plancha de plumavit con agujeros flota sobre un estanque de solución; las plantas van en los agujeros con las raíces en el agua. Se oxigena con bomba de aire o agitando.',
      ideal: 'Lechuga y hojas. Muy usado en huertos escolares y producción a pequeña escala.',
      solucion: 'El gran volumen de agua es estable. Mide CE y pH cada semana y repón lo que se consume.',
      ojo: 'Necesita oxigenación; en verano el agua caliente retiene menos oxígeno.',
    },
    {
      id: 'nft', nombre: 'NFT', corto: 'Tubos con una lámina de agua corriendo', dificultad: 2, bomba: 'agua', electricidad: true, recircula: true,
      como: 'Una bomba sube la solución a canales o tubos inclinados. Corre una lámina delgada por las raíces y vuelve al depósito.',
      ideal: 'Lechuga, rúcula, espinaca, albahaca y frutilla.',
      solucion: 'Mide CE y pH cada pocos días. Renueva la solución cada 1 a 2 semanas.',
      ojo: 'Depende de la bomba: si se corta la luz, las raíces se secan en pocas horas.',
    },
    {
      id: 'ngs', nombre: 'NGS (multicapa)', corto: 'Bolsas de varias capas con riego', dificultad: 3, bomba: 'agua', electricidad: true, recircula: true,
      como: 'Canales de varias capas de plástico por donde circula la solución; las raíces se reparten entre capas con agua y capas con aire.',
      ideal: 'Hortalizas de hoja, frutilla y algunas de fruto.',
      solucion: 'Mide CE y pH a diario en producción; renueva periódicamente.',
      ojo: 'Más usado en producción comercial que en casa.',
    },
    {
      id: 'flujo', nombre: 'Flujo y reflujo', corto: 'Bandeja que se inunda y se vacía', dificultad: 2, bomba: 'agua', electricidad: true, recircula: true,
      como: 'Una bomba con temporizador inunda una bandeja con sustrato o macetas; luego la solución se drena de vuelta al depósito.',
      ideal: 'Muy versátil: hojas, aromáticas y plantas medianas.',
      solucion: 'Mide CE y pH cada pocos días; renueva cada 1 a 2 semanas.',
      ojo: 'Si falla el temporizador, la bandeja puede quedar inundada o seca.',
    },
    {
      id: 'goteo', nombre: 'Goteo con sustrato', corto: 'Goteros sobre fibra de coco o perlita', dificultad: 2, bomba: 'agua', electricidad: true, recircula: false,
      como: 'Una bomba lleva la solución por mangueras y goteros a cada planta en un sustrato. Puede recircular o no.',
      ideal: 'Plantas de fruto: tomate, pimiento, pepino y frutilla.',
      solucion: 'Mide también la CE del agua que drena: si sube mucho, riega con más volumen para lavar sales.',
      ojo: 'Los goteros se tapan con sales; límpialos seguido.',
    },
    {
      id: 'dutch', nombre: 'Dutch bucket', corto: 'Baldes con perlita y goteo', dificultad: 2, bomba: 'agua', electricidad: true, recircula: true,
      como: 'Baldes individuales con perlita reciben solución por goteo; el sobrante drena por un tubo de vuelta al depósito.',
      ideal: 'Plantas grandes y de raíz profunda: tomate, pepino, pimiento.',
      solucion: 'Mide CE y pH del depósito cada pocos días; renueva cada 1 a 2 semanas.',
      ojo: 'Cada balde suma conexiones: revisa que ninguna gotee o se tape.',
    },
    {
      id: 'torre', nombre: 'Torre vertical', corto: 'Columna con plantas a los lados', dificultad: 2, bomba: 'agua', electricidad: true, recircula: true,
      como: 'Una bomba sube la solución a lo alto de una columna y baja por gravedad mojando las raíces de cada nivel.',
      ideal: 'Lechuga, aromáticas y frutilla en poco espacio (balcón, terraza).',
      solucion: 'Mide CE y pH cada pocos días; renueva cada 1 a 2 semanas.',
      ojo: 'Las plantas de abajo y de arriba reciben distinta luz y agua: rota o revisa cada nivel.',
    },
    {
      id: 'aeroponia', nombre: 'Aeroponía', corto: 'Raíces en el aire con neblina', dificultad: 3, bomba: 'agua', electricidad: true, recircula: true,
      como: 'Las raíces cuelgan en una cámara oscura y unos aspersores las rocían con solución a intervalos cortos.',
      ideal: 'Hojas y aromáticas; crece muy rápido.',
      solucion: 'Mide CE y pH a diario; los aspersores necesitan solución limpia.',
      ojo: 'Es la más exigente: si los aspersores se detienen, las raíces se secan en minutos. No es para empezar.',
    },
    {
      id: 'otro', nombre: 'Otro', corto: 'Mi sistema no está en la lista', dificultad: 0, bomba: '', electricidad: null, recircula: null,
      como: '', ideal: '', solucion: 'Mide CE y pH con regularidad y renueva la solución si recircula.', ojo: '',
    },
  ];

  /* Sales para el modo avanzado. Porcentajes en peso del elemento (no del óxido),
   * para fertilizantes de grado comercial. tanque: dónde va en una solución concentrada.
   * El calcio nunca va en el mismo tanque que sulfatos y fosfatos: precipitan.
   */
  const SALES = [
    { id: 'nitrato-calcio', nombre: 'Nitrato de calcio', formula: 'Ca(NO₃)₂', tanque: 'A', comp: { N: 15.5, Ca: 19 } },
    { id: 'quelato-hierro', nombre: 'Quelato de hierro (EDTA 13 %)', formula: 'Fe-EDTA', tanque: 'A', comp: { Fe: 13 } },
    { id: 'nitrato-potasio', nombre: 'Nitrato de potasio', formula: 'KNO₃', tanque: 'B', comp: { N: 13, K: 38 } },
    { id: 'fosfato-monopotasico', nombre: 'Fosfato monopotásico (MKP)', formula: 'KH₂PO₄', tanque: 'B', comp: { P: 22.7, K: 28.7 } },
    { id: 'sulfato-magnesio', nombre: 'Sulfato de magnesio', formula: 'MgSO₄·7H₂O', tanque: 'B', comp: { Mg: 9.9, S: 13 } },
    { id: 'sulfato-potasio', nombre: 'Sulfato de potasio', formula: 'K₂SO₄', tanque: 'B', comp: { K: 41.5, S: 17 } },
    { id: 'sulfato-manganeso', nombre: 'Sulfato de manganeso', formula: 'MnSO₄·H₂O', tanque: 'B', comp: { Mn: 32 } },
    { id: 'acido-borico', nombre: 'Ácido bórico', formula: 'H₃BO₃', tanque: 'B', comp: { B: 17.5 } },
    { id: 'sulfato-zinc', nombre: 'Sulfato de zinc', formula: 'ZnSO₄·7H₂O', tanque: 'B', comp: { Zn: 22.7 } },
    { id: 'sulfato-cobre', nombre: 'Sulfato de cobre', formula: 'CuSO₄·5H₂O', tanque: 'B', comp: { Cu: 25.5 } },
    { id: 'molibdato-sodio', nombre: 'Molibdato de sodio', formula: 'Na₂MoO₄·2H₂O', tanque: 'B', comp: { Mo: 39.6 } },
  ];

  /* Recetas en ppm (mg/L) del elemento.
   * Steiner: solución universal (NO₃ 12, H₂PO₄ 1, SO₄ 7, K 7, Ca 9, Mg 4 meq/L), CE ≈ 2,0.
   * Hoagland: solución n.º 1 clásica, CE ≈ 2,3.
   */
  const RECETAS = [
    { id: 'steiner', nombre: 'Steiner (universal)', ppm: { N: 168, P: 31, K: 274, Ca: 180, Mg: 49, S: 112, Fe: 2, Mn: 0.5, B: 0.5, Zn: 0.05, Cu: 0.02, Mo: 0.01 } },
    { id: 'hoagland', nombre: 'Hoagland n.º 1', ppm: { N: 210, P: 31, K: 235, Ca: 200, Mg: 48, S: 64, Fe: 2.5, Mn: 0.5, B: 0.5, Zn: 0.05, Cu: 0.02, Mo: 0.01 } },
  ];

  const ELEMENTOS = ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'B', 'Zn', 'Cu', 'Mo'];

  const KB = { CULTIVOS, PRODUCTOS, SISTEMAS, SALES, RECETAS, ELEMENTOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = KB;
  else root.HV_KB = KB;
})(typeof self !== 'undefined' ? self : this);
