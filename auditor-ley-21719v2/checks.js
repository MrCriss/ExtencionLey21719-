(function (root) {
  const LABEL = { fail: 'Alerta', warn: 'Por revisar', ok: 'Sin hallazgos', na: 'No aplica' };
  const KEY = { fail: 'alerta', warn: 'por_revisar', ok: 'sin_hallazgos', na: 'no_aplica' };

  const clip = (s, n = 80) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  // Ubicación: "donde" = parte de la página; selector = ruta CSS (si existe) para resaltarla.
  const loc = (donde, nota = '', w = {}) => ({ donde, nota, selector: w.selector || '', visible: !!w.selector && w.visible !== false });
  const formName = x => x.label ? `Formulario «${x.label}»` : 'Formulario sin título';
  const fromIssues = (issues, okDetail, okLocs = []) => issues.length
    ? [issues.some(i => i.sev === 'fail') ? 'fail' : 'warn', issues.map(i => i.text).join(' '), issues.flatMap(i => i.locs || [])]
    : ['ok', okDetail, okLocs];
  const na = text => ['na', text, []];
  const names = list => [...new Set(list.map(t => t.name))];

  const CHECKS = {
    https: f => {
      const issues = [];
      if (!f.https) issues.push({ sev: 'fail', text: 'La página se sirve sin cifrar (HTTP).', locs: [loc('Toda la página', f.url)] });
      if (f.mixed.length) issues.push({ sev: 'warn', text: `${f.mixed.length} recurso(s) se cargan por HTTP dentro de una página HTTPS.`, locs: f.mixed.slice(0, 6).map(m => loc(m.zone, clip(m.url, 100), m)) });
      const bad = f.forms.filter(x => x.insecure);
      if (bad.length) issues.push({ sev: 'fail', text: `${bad.length} formulario(s) envían los datos por HTTP sin cifrar.`, locs: bad.map(x => loc(`${x.zone} — ${formName(x)}`, clip(x.action, 100), x)) });
      if (f.https && f.hsts === false) issues.push({ sev: 'warn', text: 'El servidor no envía la cabecera HSTS (indicador técnico; la ley no la exige literalmente).', locs: [loc('Cabeceras HTTP de la respuesta del servidor', 'Falta Strict-Transport-Security')] });
      return fromIssues(issues, 'La página usa HTTPS, no carga recursos sin cifrar y envía los formularios por HTTPS.', [loc('Toda la página', f.url)]);
    },

    policy: f => {
      const ls = f.policyLinks;
      if (!ls.length) return ['fail', 'No se encontró ningún enlace a la política de tratamiento de datos.', [loc('Toda la página', 'No hay enlaces con «privacidad», «datos personales» o similares. Lo habitual es el pie de página (<footer>).')]];
      if (!ls.some(l => l.visible)) return ['warn', 'Hay enlaces a la política, pero ninguno está visible para el visitante.', ls.slice(0, 3).map(l => loc(l.zone, `«${l.text}» → ${clip(l.href, 80)}`, l))];
      return ['ok', 'Hay un enlace a la política de tratamiento de datos (su contenido se revisa en la regla siguiente).', ls.slice(0, 4).map(l => loc(l.zone, `«${l.text}» → ${clip(l.href, 80)}`, l))];
    },

    policyContent: (f, cfg) => {
      const p = f.policy;
      if (p.source === 'none') return na('No se encontró una política que analizar (ver la regla anterior).');
      if (p.source === 'unreadable') return ['warn', 'No se pudo leer el contenido de la política (otro dominio, protegida o cargada con JavaScript).', [loc('Página de la política', p.url)]];
      const miss = cfg.policyItems.filter(i => !p.items[i.key]);
      const where = loc(`Página de la política`, p.url);
      if (!miss.length) return ['ok', 'Se encontraron menciones a los 15 puntos del art. 14 ter. Falta que revises su calidad y que estén completos.', [where]];
      const locs = [where, ...miss.map(i => loc('Texto de la política', `No se encontró: ${i.label}`))];
      return [miss.length >= 6 ? 'fail' : 'warn', `Faltan menciones a ${miss.length} de 15 puntos exigidos por el art. 14 ter (búsqueda por palabras clave).`, locs, [`Puntos que faltan: ${miss.map(i => i.label.replace(/ \(letra \w+\)/, '')).join('; ')}.`]];
    },

    controller: f => {
      if (f.rutHits.length) return ['ok', 'Se encontró un RUT en la página, que ayuda a identificar al responsable.', f.rutHits.slice(0, 3).map(h => loc(h.zone, 'RUT visible', h))];
      if (f.policy.rut) return ['ok', 'Se encontró un RUT en la política de tratamiento de datos.', [loc('Página de la política', f.policy.url)]];
      return ['warn', 'No se encontró un RUT ni una razón social que identifiquen al responsable, ni en esta página ni en la política.', [loc('Pie de página o política de datos', 'Es el lugar habitual para identificar al responsable y a su representante legal.')]];
    },

    contact: f => {
      const hits = [...f.mailtos.map(m => loc(m.zone, m.email, m)), ...f.contactLinks.map(c => loc(c.zone, `«${c.text}»`, c))];
      if (hits.length) return ['ok', 'Hay un correo o enlace de contacto en la página.', hits.slice(0, 4)];
      if (f.policy.items && f.policy.items.c) return ['ok', 'La política menciona un medio de contacto.', [loc('Página de la política', f.policy.url)]];
      const sev = f.policy.source === 'fetched' || f.policy.source === 'page' ? 'fail' : 'warn';
      return [sev, 'No se encontró correo, formulario ni domicilio para que los titulares presenten solicitudes.', [loc('Pie de página o página de contacto', 'No hay enlaces «mailto:» ni de contacto.')]];
    },

    rights: f => {
      if (f.rightsLinks.length) return ['ok', 'Hay un enlace o contacto para ejercer derechos del titular.', f.rightsLinks.slice(0, 4).map(l => loc(l.zone, `«${l.text}»`, l))];
      if (f.rightsText) return ['ok', 'El texto de la página menciona los derechos del titular.', [loc('Texto de la página', 'Menciona acceso, rectificación, supresión u otros derechos (no se identificó el bloque exacto).')]];
      if (f.policy.items && f.policy.items.f) return ['ok', 'La política menciona los derechos del titular.', [loc('Página de la política', f.policy.url)]];
      return ['warn', 'No se encontró un canal ni una mención a los derechos de acceso, rectificación, supresión, oposición y portabilidad.', [loc('Pie de página o política de datos', 'Debe haber un medio sencillo para ejercer estos derechos.')]];
    },

    trackers: f => {
      const n = names(f.trackers);
      if (!n.length && !f.cookies.length) return ['ok', 'No se detectaron rastreadores ni cookies de analítica o publicidad de terceros.', []];
      const locs = f.trackers.slice(0, 10).map(t => loc(t.zone, `${t.name} (${t.kind}): ${clip(t.url, 90)}`, t));
      if (f.cookies.length) locs.push(loc('Cookies del navegador (document.cookie)', f.cookies.join(', ')));
      const what = [...n, ...(f.cookies.length ? ['cookies ' + f.cookies.join(', ')] : [])].join(', ');
      return f.banner
        ? ['warn', `Se detectó ${what}. Hay aviso de cookies, pero desde aquí no se puede comprobar que estos servicios esperen a que la persona acepte.`, locs, ['Prueba en una ventana de incógnito: no aceptes nada, abre F12 → Red y comprueba que estos servicios no se carguen antes del consentimiento.']]
        : ['fail', `Se detectó ${what} y no hay aviso de cookies ni consentimiento visible.`, locs];
    },

    cookieChoice: f => {
      const b = f.banner, third = f.trackers.length || f.cookies.length;
      if (!third && !b) return na('No se detectaron cookies de terceros ni un aviso de cookies.');
      const issues = [];
      if (!b) issues.push({ sev: 'fail', text: 'Hay rastreadores o cookies, pero no se encontró un aviso para pedir consentimiento.', locs: [loc('Toda la página', 'No hay un banner de cookies visible al cargar. Debe aparecer antes de que se carguen los rastreadores.')] });
      else if (!b.buttons) issues.push({ sev: 'warn', text: 'Hay un aviso de cookies, pero no se pudieron leer sus botones (puede estar en un iframe o shadow DOM).', locs: [loc(b.zone, 'Aviso de cookies', b)] });
      else if (!b.hasReject) issues.push({ sev: 'warn', text: 'El aviso no muestra un botón de rechazo directo.', locs: [loc(b.zone, `Botones encontrados: ${b.buttonTexts.join(' | ')}`, b)] });
      if (!f.cookiePrefs.length) issues.push({ sev: 'warn', text: 'No se encontró un enlace permanente para cambiar o retirar el consentimiento.', locs: [loc('Pie de página', 'Debería haber un enlace tipo «Configurar cookies» siempre disponible.')] });
      return fromIssues(issues, 'El aviso permite aceptar y rechazar, y hay un enlace para cambiar preferencias.', [...(b ? [loc(b.zone, `Botones: ${b.buttonTexts.join(' | ')}`, b)] : []), ...f.cookiePrefs.map(c => loc(c.zone, `«${c.text}»`, c))]);
    },

    embeds: f => f.embeds.length
      ? ['warn', `La página incrusta contenido de terceros (${names(f.embeds).join(', ')}) que puede recibir datos del visitante.`, f.embeds.slice(0, 8).map(e => loc(e.zone, `${e.name} (${e.kind})`, e))]
      : ['ok', 'No se detectaron iframes ni recursos incrustados de terceros.', []],

    transfer: f => {
      const n = names([...f.trackers, ...f.embeds]);
      if (!n.length) return na('No se detectaron servicios de terceros que probablemente operen fuera de Chile.');
      const said = f.policy.items && f.policy.items.h;
      const locs = [...f.trackers, ...f.embeds].slice(0, 6).map(t => loc(t.zone, t.name, t));
      return said
        ? ['ok', `La política menciona transferencias a otros países. Servicios detectados: ${n.join(', ')}.`, locs]
        : ['warn', `Estos servicios suelen operar fuera de Chile: ${n.join(', ')}. No se encontró en la política una mención a transferencia internacional.`, [...locs, loc('Página de la política', f.policy.url || 'No se pudo leer la política')]];
    },

    profiling: f => {
      const ads = f.trackers.filter(t => t.ads);
      if (!ads.length) return na('No se detectaron pixeles de publicidad o remarketing.');
      const locs = ads.slice(0, 6).map(t => loc(t.zone, `${t.name} (${t.kind})`, t));
      return f.policy.items && f.policy.items.l
        ? ['ok', 'La política menciona perfiles o decisiones automatizadas.', locs]
        : ['warn', `Se detectaron pixeles publicitarios (${names(ads).join(', ')}) que permiten elaborar perfiles; no se encontró mención en la política.`, locs];
    },

    formsConsent: f => {
      if (!f.forms.length) return na('No hay formularios con datos personales en esta página.');
      const issues = f.forms.filter(x => !x.hasPolicyLink).map(x => ({
        sev: (x.hasConsentText || x.hasCheckbox) ? 'warn' : 'fail',
        text: '', locs: [loc(`${x.zone} — ${formName(x)}`, `Campos: ${x.fields.slice(0, 5).join(', ')}. ${(x.hasConsentText || x.hasCheckbox) ? 'Hay texto o casilla, pero falta enlazar la política.' : 'No muestra consentimiento, finalidad ni enlace a la política.'}`, x)]
      }));
      if (!issues.length) return ['ok', `${f.forms.length} formulario(s) enlazan la política de datos cerca de los campos.`, f.forms.slice(0, 4).map(x => loc(`${x.zone} — ${formName(x)}`, 'Con enlace a la política', x))];
      const sev = issues.some(i => i.sev === 'fail') ? 'fail' : 'warn';
      return [sev, `${issues.length} de ${f.forms.length} formulario(s) no informan la finalidad ni enlazan la política.`, issues.flatMap(i => i.locs)];
    },

    formsPrechecked: f => {
      if (!f.forms.length) return na('No hay formularios con datos personales en esta página.');
      const pre = f.forms.flatMap(x => x.preChecked.map(c => ({ x, c })));
      return pre.length
        ? ['fail', `${pre.length} casilla(s) de consentimiento o marketing vienen marcadas de antemano.`, pre.map(({ x, c }) => loc(`${x.zone} — ${formName(x)}`, `Casilla marcada: «${c.label}»`, c))]
        : ['ok', 'No hay casillas de consentimiento premarcadas.', []];
    },

    formsMinimization: f => {
      if (!f.forms.length) return na('No hay formularios con datos personales en esta página.');
      const ex = f.forms.filter(x => x.excess);
      return ex.length
        ? ['warn', `${ex.length} formulario(s) piden muchos campos o más de los que su finalidad parece requerir.`, ex.map(x => loc(`${x.zone} — ${formName(x)}`, `${x.nFields} campos: ${x.fields.slice(0, 8).join(', ')}`, x))]
        : ['ok', 'La cantidad de campos de los formularios parece proporcionada.', []];
    },

    formsExternal: f => {
      if (!f.forms.length) return na('No hay formularios con datos personales en esta página.');
      const ex = f.forms.filter(x => x.external);
      return ex.length
        ? ['warn', `${ex.length} formulario(s) envían datos a otro dominio.`, ex.map(x => loc(`${x.zone} — ${formName(x)}`, `Destino: ${x.external}`, x))]
        : ['ok', 'Los formularios visibles envían los datos al mismo sitio (los enviados por JavaScript no se pueden ver).', []];
    },

    marketing: f => {
      const nl = f.forms.filter(x => x.newsletter);
      if (!nl.length) return na('No se detectaron formularios de suscripción o promociones.');
      const bad = nl.filter(x => !x.hasCheckbox);
      return bad.length
        ? ['warn', `${bad.length} formulario(s) de suscripción no tienen una casilla separada para aceptar comunicaciones comerciales.`, bad.map(x => loc(`${x.zone} — ${formName(x)}`, 'Sin casilla de consentimiento', x))]
        : ['ok', 'Los formularios de suscripción incluyen casilla de consentimiento (verifica que cada correo tenga enlace de baja).', nl.map(x => loc(`${x.zone} — ${formName(x)}`, 'Con casilla', x))];
    },

    sensitive: f => {
      if (!f.sensitive.length) return ['ok', 'No se detectaron campos que pidan datos sensibles.', []];
      const cats = [...new Set(f.sensitive.map(s => s.category))];
      const extra = [];
      if (cats.includes('salud')) extra.push('Salud: art. 16 bis; solo para los fines de las leyes sanitarias o sus excepciones.');
      if (cats.includes('biométrico')) extra.push('Biométricos: art. 16 ter exige informar sistema, finalidad, período y forma de ejercer derechos.');
      return ['warn', `${f.sensitive.length} campo(s) parecen pedir datos sensibles (${cats.join(', ')}).`, f.sensitive.map(s => loc(s.zone, `Campo «${s.label}» (${s.category})`, s)), extra];
    },

    minors: f => {
      const hits = f.forms.filter(x => x.birth || x.minors);
      if (!hits.length) return na('No se detectaron señales de que el sitio trate datos de menores.');
      return ['warn', `${hits.length} formulario(s) parecen recoger datos de menores o su fecha de nacimiento.`,
        hits.map(x => loc(`${x.zone} — ${formName(x)}`, x.birth ? 'Pide fecha de nacimiento o edad' : 'El texto menciona menores, colegio, apoderados o hijos', x))];
    },

    geo: f => {
      const g = f.geo;
      if (!g.script && g.permission !== 'granted') return na('No se detectó uso de geolocalización.');
      const locs = [];
      if (g.script) locs.push(loc(g.script.zone, 'Script en línea que usa navigator.geolocation', g.script));
      if (g.permission === 'granted') locs.push(loc('Permisos del navegador', 'El sitio ya tiene permiso de ubicación concedido'));
      return ['warn', 'El sitio usa o tiene permiso para usar la ubicación del visitante.', locs];
    }
  };

  function buildReport(cfg, facts, meta = {}) {
    const results = cfg.rules.map(r => {
      const [status, detail, locations = [], extra = []] = CHECKS[r.check](facts, cfg);
      return { id: r.id, area: r.area, title: r.title, ref: r.ref, status, detail, locations,
        solutions: status === 'fail' || status === 'warn' ? [...extra, ...r.solutions] : [] };
    });
    const count = { fail: 0, warn: 0, ok: 0, na: 0 };
    results.forEach(r => count[r.status]++);
    return {
      meta: cfg.meta, fecha: meta.fecha || new Date().toISOString(), version: meta.version || '', url: facts.url, host: facts.host,
      count, results, manual: cfg.manual, facts
    };
  }

  const api = { LABEL, KEY, CHECKS, buildReport, clip };
  root.Auditor = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
