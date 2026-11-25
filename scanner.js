// Se inyecta en la página. Solo observa; no modifica nada y no envía datos a ningún servidor.
// Devuelve "hechos" con la ubicación (zona y selector CSS) de cada hallazgo.
window.__auditorScan = async () => {
  const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const clip = (s, n = 70) => { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const visible = el => !!(el && el.getClientRects && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const DYN = 'Carga dinámica (la inyecta otro script, p. ej. un gestor de etiquetas)';

  const css = el => {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.documentElement && parts.length < 6; n = n.parentElement) {
      let p = n.localName;
      if (n.id) { parts.unshift(p + '#' + CSS.escape(n.id)); break; }
      const same = n.parentElement ? [...n.parentElement.children].filter(c => c.localName === n.localName) : [];
      if (same.length > 1) p += `:nth-of-type(${same.indexOf(n) + 1})`;
      parts.unshift(p);
    }
    return parts.join(' > ');
  };
  const zone = el => {
    if (!el) return 'Cuerpo de la página';
    if (el.closest('head')) return 'Cabecera técnica (<head>), no visible';
    if (el.closest('[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[id*="onetrust" i]')) return 'Aviso de cookies';
    if (el.closest('footer,[role=contentinfo],#footer,.footer')) return 'Pie de página';
    if (el.closest('header,[role=banner],#header,.header')) return 'Encabezado';
    if (el.closest('nav,[role=navigation]')) return 'Menú de navegación';
    if (el.closest('aside')) return 'Barra lateral';
    if (el.closest('main,[role=main],article')) return 'Contenido principal';
    return 'Cuerpo de la página';
  };
  const where = el => ({ zone: zone(el), selector: css(el), visible: visible(el) });

  const body = document.body ? document.body.innerText : '';
  const txt = norm(body);
  const anchors = [...document.querySelectorAll('a[href]')];
  const aText = a => norm((a.textContent || '') + ' ' + (a.getAttribute('aria-label') || '') + ' ' + (a.getAttribute('title') || ''));
  const host = location.hostname;
  const base = h => { const p = h.split('.'); const n = p.length > 2 && p[p.length - 1].length === 2 && p[p.length - 2].length <= 3 ? 3 : 2; return p.slice(-n).join('.'); };

  // ---------- Recursos, enlaces a elementos ----------
  const els = [...document.querySelectorAll('script[src],img[src],iframe[src],link[href],embed[src],source[src],video[src],audio[src]')]
    .map(e => ({ e, u: e.src || e.href || '' }));
  const findEl = u => (els.find(x => x.u === u) || {}).e;
  const res = performance.getEntriesByType('resource').map(e => e.name);
  const allUrls = [...new Set([...res, ...els.map(x => x.u)])];
  const rec = (el, extra) => el ? { ...extra, ...where(el) } : { ...extra, zone: DYN, selector: '', visible: false };

  const mixed = location.protocol === 'https:'
    ? [...new Set(res.filter(u => u.startsWith('http:')))].slice(0, 20).map(u => rec(findEl(u), { url: u })) : [];

  // ---------- Enlaces ----------
  const policyRe = /privacidad|datos[- _]?personales|tratamiento[- _]de[- _]datos|privacy|proteccion[- _]de[- _]datos/;
  const policyAnchors = anchors.filter(a => policyRe.test(aText(a) + ' ' + norm(a.href)));
  const policyLinks = policyAnchors.slice(0, 8).map(a => rec(a, { text: clip(a.textContent, 50) || clip(a.getAttribute('aria-label'), 50), href: a.href }));
  const rightsRe = /derechos? (arco|del titular|de acceso|de los titulares)|acceso,? rectificacion|supresion|portabilidad|oposicion|ejercer (sus|tus|los) derechos/;
  const rightsLinks = anchors.filter(a => rightsRe.test(aText(a)) || /mailto:[^ ]*(privacidad|datos|dpo|proteccion)/.test(norm(a.href)))
    .slice(0, 5).map(a => rec(a, { text: clip(a.textContent, 50), href: a.href }));
  const mailtos = anchors.filter(a => /^mailto:/i.test(a.getAttribute('href'))).slice(0, 5)
    .map(a => rec(a, { email: a.getAttribute('href').replace(/^mailto:/i, '').split('?')[0] }));
  const contactLinks = anchors.filter(a => /contacto|contactanos|contactenos|escribenos|contact us/.test(aText(a)) || /\/contact/.test(norm(a.href)))
    .slice(0, 4).map(a => rec(a, { text: clip(a.textContent, 50), href: a.href }));
  const cookiePrefsRe = /(preferencias|configurar|configuracion|gestionar|administrar|cambiar|modificar|ajustes|opciones)( de| sobre)?( las| mis| tus| sus)? cookies|cookie (settings|preferences)|manage cookies|privacy settings/;
  const cookiePrefs = [...document.querySelectorAll('a,button,[role=button]')].filter(e => cookiePrefsRe.test(norm(e.textContent || e.getAttribute('aria-label'))))
    .slice(0, 3).map(e => rec(e, { text: clip(e.textContent, 50) }));

  // ---------- RUT visible ----------
  const rutRe = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;
  const rutHits = rutRe.test(body)
    ? [...document.body.querySelectorAll('*')].filter(e => !e.children.length && rutRe.test(e.textContent)).slice(0, 3).map(e => where(e)) : [];

  // ---------- Aviso de cookies ----------
  const BTN = 'button,[role=button],a[class*=btn i],a[class*=button i],input[type=button],input[type=submit]';
  const bannerCands = [...document.querySelectorAll('[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[id*="onetrust" i],[aria-label*="cookie" i]')]
    .filter(e => visible(e) && e.innerText && e.innerText.length < 2500 && /cookie|consentimiento|privacidad/.test(norm(e.innerText)))
    .sort((a, b) => a.innerText.length - b.innerText.length);
  let banner = null;
  for (const e of bannerCands) {
    const bs = [...e.querySelectorAll(BTN)].filter(visible);
    if (bs.length) {
      const texts = bs.map(b => norm(b.innerText || b.value || b.getAttribute('aria-label') || ''));
      banner = {
        ...where(e), buttons: bs.length, buttonTexts: texts.map(t => clip(t, 25)).filter(Boolean).slice(0, 6),
        hasAccept: texts.some(t => /acept|permitir|entendid|de acuerdo|allow|accept|^ok$/.test(t)),
        hasReject: texts.some(t => /rechaz|denegar|no acepto|solo (las )?(necesarias|esenciales)|reject|decline|deny|only (necessary|essential)/.test(t)),
        hasConfig: texts.some(t => /configur|preferencia|personaliz|gestionar|manage|settings|opciones/.test(t))
      };
      break;
    }
  }
  if (!banner && bannerCands.length) banner = { ...where(bannerCands[0]), buttons: 0, buttonTexts: [] };
  if (!banner && /(usamos|utilizamos|usa|utiliza) cookies/.test(txt)) banner = { zone: 'Texto de la página', selector: '', visible: false, buttons: 0, buttonTexts: [] };

  // ---------- Rastreadores ----------
  const T = [
    ['google-analytics.com', 'Google Analytics'], ['googletagmanager.com', 'Google Tag Manager'],
    ['doubleclick.net', 'Google Ads', 1], ['googleadservices.com', 'Google Ads', 1], ['googlesyndication.com', 'Google Ads', 1],
    ['connect.facebook.net', 'Meta Pixel', 1], ['facebook.com/tr', 'Meta Pixel', 1], ['hotjar.com', 'Hotjar'],
    ['clarity.ms', 'Microsoft Clarity'], ['bat.bing.com', 'Microsoft Ads', 1], ['analytics.tiktok.com', 'TikTok Pixel', 1],
    ['snap.licdn.com', 'LinkedIn Insight', 1], ['px.ads.linkedin.com', 'LinkedIn Insight', 1], ['segment.com', 'Segment'],
    ['segment.io', 'Segment'], ['mixpanel.com', 'Mixpanel'], ['hs-scripts.com', 'HubSpot'], ['hs-analytics.net', 'HubSpot'],
    ['static.ads-twitter.com', 'X Ads', 1], ['criteo.', 'Criteo', 1], ['taboola.com', 'Taboola', 1], ['outbrain.com', 'Outbrain', 1],
    ['amplitude.com', 'Amplitude'], ['fullstory.com', 'FullStory'], ['mouseflow.com', 'Mouseflow']
  ];
  const trackers = [];
  const seen = new Set();
  const addT = (name, ads, kind, url, el) => {
    const r = rec(el, { name, ads: !!ads, kind, url: url || '' });
    const k = name + '|' + r.selector;
    if (!seen.has(k)) { seen.add(k); trackers.push(r); }
  };
  allUrls.forEach(u => T.forEach(([k, name, ads]) => {
    if (u.includes(k)) { const el = findEl(u); addT(name, ads, el ? el.localName : 'recurso', u, el); }
  }));
  const INL = [[/gtag\(|google-analytics/, 'Google Analytics'], [/fbq\(/, 'Meta Pixel', 1], [/ttq\./, 'TikTok Pixel', 1],
    [/clarity\(/, 'Microsoft Clarity'], [/hj\(|_hjSettings/, 'Hotjar'], [/_hsq/, 'HubSpot'], [/googletagmanager/, 'Google Tag Manager']];
  document.querySelectorAll('script:not([src])').forEach(s => {
    const t = s.textContent || '';
    INL.forEach(([re, name, ads]) => { if (re.test(t)) addT(name, ads, 'script en línea', clip(t, 60), s); });
  });
  // Si un servicio aparece como elemento, se descartan sus entradas "dinámicas" duplicadas.
  const withEl = new Set(trackers.filter(t => t.selector).map(t => t.name));
  const trackersClean = trackers.filter(t => t.selector || !withEl.has(t.name));
  const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0]).filter(n => /^(_ga|_gid|_fbp|_gcl_|_hj|_clck|_ttp)/.test(n));

  // ---------- Contenido de terceros ----------
  const embeds = [];
  document.querySelectorAll('iframe[src]').forEach(i => {
    try { const h = new URL(i.src, location.href).hostname; if (base(h) !== base(host)) embeds.push(rec(i, { name: h, kind: 'iframe' })); } catch (e) {}
  });
  allUrls.forEach(u => {
    [['google.com/recaptcha', 'reCAPTCHA'], ['fonts.googleapis.com', 'Google Fonts'], ['maps.googleapis.com', 'Google Maps']].forEach(([k, name]) => {
      if (u.includes(k) && !embeds.some(e => e.name === name)) { const el = findEl(u); embeds.push(rec(el, { name, kind: el ? el.localName : 'recurso' })); }
    });
  });

  // ---------- Formularios ----------
  const dataField = 'input[type=email],input[type=tel],input[name*=rut i],input[name*=nombre i],input[name*=correo i],input[name*=email i],input[name*=fono i],input[name*=telefono i]';
  const containers = new Set();
  [...document.forms].forEach(f => { if (f.querySelector(dataField)) containers.add(f); });
  [...document.querySelectorAll(dataField)].filter(i => !i.form).forEach(i => {
    let c = i.parentElement, n = 0;
    while (c && n < 5 && !c.querySelector('button,input[type=submit],input[type=button]')) { c = c.parentElement; n++; }
    if (c && ![...containers].some(k => k.contains(c) || c.contains(k))) containers.add(c);
  });
  const fieldLabel = i => clip((i.labels && i.labels[0] ? i.labels[0].textContent : '') || i.getAttribute('aria-label') || i.placeholder || i.name || i.id || i.type, 40);
  const forms = [...containers].map(el => {
    const fields = [...el.querySelectorAll('input,select,textarea')].filter(i => !['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio'].includes(i.type));
    const boxes = [...el.querySelectorAll('input[type=checkbox]')];
    const ctx = [el, el.nextElementSibling, el.previousElementSibling].filter(Boolean);
    const par = el.parentElement && el.parentElement !== document.body && (el.parentElement.innerText || '').length < 3000 ? el.parentElement : null;
    const nearText = norm([...ctx, par].filter(Boolean).map(e => (e.innerText || '').slice(0, 3000)).join(' '));
    const nearLinks = [...ctx, par].filter(Boolean).flatMap(e => e.matches('a[href]') ? [e] : [...e.querySelectorAll('a[href]')]);
    const consentBox = c => /acepto|autorizo|consiento|politica|privacidad|datos|terminos|newsletter|boletin|promocion|marketing|comunicaciones/.test(norm((c.labels && c.labels[0] ? c.labels[0].textContent : '') + ' ' + (c.getAttribute('aria-label') || '') + ' ' + (c.parentElement ? c.parentElement.textContent : '').slice(0, 200)));
    const heading = (el.closest('section,div') || el).querySelector('h1,h2,h3,h4');
    let action = '', external = '', insecure = false;
    if (el.localName === 'form') {
      try { const u = new URL(el.getAttribute('action') || '', location.href); action = u.href; if (base(u.hostname) !== base(host)) external = u.hostname; if (u.protocol === 'http:') insecure = true; } catch (e) {}
    }
    const fText = norm(el.innerText || '');
    const nonEmail = fields.filter(i => i.type !== 'email').length;
    const newsletter = /newsletter|boletin|suscri|subscri|novedades|promociones|ofertas/.test(fText);
    return {
      ...where(el), label: clip(el.getAttribute('aria-label') || el.getAttribute('name') || (heading && heading.textContent) || el.id, 50),
      fields: fields.map(fieldLabel).slice(0, 12), nFields: fields.length,
      hasCheckbox: boxes.length > 0,
      preChecked: boxes.filter(c => c.checked && consentBox(c)).map(c => ({ ...where(c), label: clip(c.labels && c.labels[0] ? c.labels[0].textContent : c.name, 60) })),
      hasPolicyLink: nearLinks.some(a => policyRe.test(aText(a) + ' ' + norm(a.href))),
      hasConsentText: /privacidad|datos personales|acepto|consentimiento|terminos/.test(nearText),
      action, external, insecure, newsletter,
      excess: (newsletter && nonEmail >= 3) || fields.length >= 9,
      birth: fields.some(i => i.type === 'date' && /nacimiento|birth|edad/.test(norm(i.name + ' ' + i.id + ' ' + fieldLabel(i)))) || fields.some(i => /nacimiento|birth|\bedad\b/.test(norm(i.name + ' ' + i.id))),
      minors: /menor(es)? de edad|ninos?|ninas?|apoderad|colegio|escolar|alumn|estudiante|hij[oa]s?/.test(fText)
    };
  });

  // ---------- Datos sensibles ----------
  const SENS = [
    ['salud', /salud|diagnostic|enfermedad|medic|alergia|discapacidad|isapre|fonasa|embarazo/],
    ['biométrico', /biometr|huella|facial|reconocimiento|iris/],
    ['socioeconómico', /ingreso|renta|sueldo|socioeconom|situacion economica/],
    ['otro dato sensible', /religi|etnia|origen etnico|pueblo originario|afiliacion|sindic|politic|orientacion|identidad de genero|vida sexual|ideolog/]
  ];
  const sensitive = [];
  document.querySelectorAll('input,select,textarea').forEach(i => {
    if (['hidden', 'submit', 'button'].includes(i.type)) return;
    const t = norm([i.name, i.id, i.placeholder, i.getAttribute('aria-label'), i.labels && i.labels[0] ? i.labels[0].textContent : ''].join(' '));
    const hit = SENS.find(([, re]) => re.test(t));
    if (hit && sensitive.length < 12) sensitive.push({ ...where(i), category: hit[0], label: fieldLabel(i) });
  });

  // ---------- Geolocalización ----------
  const geoScript = [...document.querySelectorAll('script:not([src])')].find(s => /navigator\.geolocation|getCurrentPosition|watchPosition/.test(s.textContent || ''));
  let geoPerm = null;
  try { geoPerm = (await navigator.permissions.query({ name: 'geolocation' })).state; } catch (e) {}
  const geo = { script: geoScript ? where(geoScript) : null, permission: geoPerm };

  // ---------- Política de datos: lectura de su contenido ----------
  const pageLooksPolicy = policyRe.test(norm(location.pathname + ' ' + document.title + ' ' + ((document.querySelector('h1') || {}).textContent || '')));
  const sameSite = a => { try { return base(new URL(a.href).hostname) === base(host); } catch (e) { return false; } };
  const cand = policyAnchors.filter(sameSite).sort((a, b) => /politica/.test(aText(b)) - /politica/.test(aText(a)))[0] || policyAnchors[0];
  const policy = { source: 'none', url: '', length: 0, items: {}, rut: false };
  const analyze = raw => {
    const t = norm(raw);
    const has = re => re.test(t);
    const rightsN = ['acceso', 'rectificacion', 'supresion', 'oposicion', 'portabilidad'].filter(w => t.includes(w)).length;
    return {
      a: has(/ultima actualizacion|fecha de (actualizacion|vigencia|entrada)|version\s*\d|vigente desde|actualizad[oa] (el|al)|actualizacion:/),
      b: has(/responsable (del )?tratamiento|responsable de (los )?datos|representante legal|razon social/),
      c: has(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|formulario de contacto|domicilio/),
      dCat: has(/(categorias|tipos?|clases?) de datos|datos (que )?(recopilamos|recolectamos|tratamos|solicitamos)/),
      dFin: has(/finalidad(es)?|fines? del tratamiento|para que (usamos|utilizamos)/),
      dDest: has(/destinatarios|terceros|encargados|comparti(mos|r)|cesion de datos|comunicacion de datos/),
      dBase: has(/base (de )?(licitud|legitimidad|legal)|fundamento legal|consentimiento|interes legitimo|ejecucion de un contrato/),
      e: has(/medidas de seguridad|politica de seguridad|seguridad de (la )?informacion|cifrad/),
      f: rightsN >= 3,
      g: has(/agencia de proteccion de datos/),
      h: has(/transferencias? internacional|tercer(os)? paises?|fuera de chile|extranjero/),
      i: has(/conservacion|retencion|conservaremos|conservamos|mantendremos|plazo de almacenamiento/),
      j: has(/(fuente|origen) de (los )?datos|fuentes? de acceso publico|obtenemos (sus )?datos de|datos (que )?(provienen|obtenidos)/),
      k: has(/(revocar|retirar|revocacion)( su| el| tu)? consentimiento/),
      l: has(/decisiones automatizadas|elaboracion de perfiles|perfilamiento|perfiles/)
    };
  };
  if (pageLooksPolicy && body.length > 400) {
    Object.assign(policy, { source: 'page', url: location.href, length: body.length, items: analyze(body), rut: rutRe.test(body) });
  } else if (cand) {
    policy.url = cand.href;
    try {
      const r = await fetch(cand.href, { credentials: 'omit' });
      if (!r.ok) throw new Error('http ' + r.status);
      const d = new DOMParser().parseFromString((await r.text()).slice(0, 800000), 'text/html');
      d.querySelectorAll('script,style,noscript,template').forEach(n => n.remove());
      const t = d.body ? d.body.textContent : '';
      if (t.replace(/\s+/g, ' ').length < 400) throw new Error('vacío');
      Object.assign(policy, { source: 'fetched', length: t.length, items: analyze(t), rut: rutRe.test(t) });
    } catch (e) { policy.source = 'unreadable'; }
  }

  // ---------- Cabecera HSTS (indicador técnico) ----------
  let hsts = null;
  if (location.protocol === 'https:') {
    try { hsts = !!(await fetch(location.href, { method: 'HEAD', credentials: 'omit' })).headers.get('strict-transport-security'); } catch (e) {}
  }

  return {
    host, url: location.href, title: clip(document.title, 80), https: location.protocol === 'https:', hsts, mixed,
    policyLinks, rightsLinks, rightsText: rightsRe.test(txt), mailtos, contactLinks, cookiePrefs, rutHits, banner,
    trackers: trackersClean, cookies, embeds, forms, sensitive, geo, policy
  };
};
