/* nomade.works page transition — deck switcher (2D), live previews + captions
   Vertical axis = main pages (Webflow order). Horizontal axis = CMS collection items.
   All cards render the real page UI (prefetched). Captions: 14px uppercase name. */
(function () {
  if (window.top !== window.self) return;            // never run inside an iframe
  var d = document;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  // ---------- config ----------
  var S = 0.7, D = 800, G = 64, R = 28, E = 'cubic-bezier(.7,0,.2,1)';
  var busy = false;

  var MAIN = [
    ['/', 'Home'], ['/services', 'Services'], ['/work', 'Work'],
    ['/quick-wins-list', 'Quick Wins'], ['/solutions-list', 'Solutions'],
    ['/pricing', 'Pricing'], ['/about', 'About'], ['/contact', 'Contact']
  ];
  // 404 page ids (data-wf-page) — never animate to/from these; behave as plain return-to-site
  var P404 = ['6a1a14c59d8a242efacc9a00', '6a1a09712ebe57c2bc195bb6'];
  var CMS = [
    { pfx: '/quick-wins/', list: '/quick-wins-list' },
    { pfx: '/solutions/', list: '/solutions-list' },
    { pfx: '/work/', list: '/work' },
    { pfx: '/services-cat/', list: '/services' }
  ];

  // ---------- helpers ----------
  var raf = window.requestAnimationFrame.bind(window);
  function norm(p) { return p.replace(/\/+$/, '') || '/'; }
  function mainIndex(p) { p = norm(p); for (var i = 0; i < MAIN.length; i++) if (norm(MAIN[i][0]) === p) return i; return -1; }
  function cmsOf(p) { for (var i = 0; i < CMS.length; i++) if (p.indexOf(CMS[i].pfx) === 0) return CMS[i]; return null; }
  function laneIndex(lane, p) { p = norm(p); for (var i = 0; i < lane.length; i++) if (norm(lane[i][0]) === p) return i; return -1; }
  function vw() { return window.innerWidth; }
  function vh() { return window.innerHeight; }
  function pageId(doc) { return (doc || d).documentElement.getAttribute('data-wf-page'); }
  function is404(doc) { return P404.indexOf(pageId(doc)) >= 0; }

  // ---------- doc cache (live previews) ----------
  var cache = {};
  function getDoc(path) {
    var key = norm(path);
    if (cache[key]) return cache[key];
    var p = fetch(location.origin + path).then(function (r) { return r.text(); })
      .then(function (t) { return new DOMParser().parseFromString(t, 'text/html'); })
      .catch(function () { return null; });
    cache[key] = p; return p;
  }
  function resolve(paths) { return Promise.all(paths.map(getDoc)); }

  function scrapeLane(doc, pfx) {
    var seen = {}, out = [], a = doc.querySelectorAll('a[href]');
    for (var i = 0; i < a.length; i++) {
      var href = a[i].getAttribute('href') || '', u;
      try { u = new URL(href, location.origin); } catch (e) { continue; }
      if (u.origin !== location.origin) continue;
      var p = u.pathname;
      if (p.indexOf(pfx) === 0 && p !== pfx && !seen[norm(p)]) {
        seen[norm(p)] = 1;
        var label = (a[i].textContent || '').replace(/\s+/g, ' ').trim();
        out.push([p, label || p]);
      }
    }
    return out;
  }

  // ---------- card builders ----------
  function card(w, h, label) {
    var wrap = d.createElement('div');
    wrap.style.cssText = 'position:absolute;left:0;top:0;width:' + w + 'px;height:' + h + 'px';
    var clip = d.createElement('div');
    clip.style.cssText = 'position:absolute;inset:0;overflow:hidden;border-radius:' + R + 'px;background:#FAF8F3;box-shadow:0 30px 80px rgba(0,0,0,.45)';
    wrap.appendChild(clip);
    if (label) {
      var cap = d.createElement('div');
      cap.textContent = label;
      cap.style.cssText = 'position:absolute;left:0;right:0;top:100%;margin-top:10px;text-align:center;font-family:inherit;font-weight:400;font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:#FAF8F3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8%';
      wrap.appendChild(cap);
    }
    return { wrap: wrap, clip: clip };
  }
  function liveCard(node, off, w, h, label) {
    var c = card(w, h, label);
    var inner = d.createElement('div');
    inner.style.cssText = 'position:absolute;left:0;top:0;width:100%;transform:translateY(' + (-off) + 'px)';
    inner.appendChild(node);
    c.clip.appendChild(inner);
    return c.wrap;
  }
  function docCard(doc, w, h, label) {
    return doc ? liveCard(doc.body.cloneNode(true), 0, w, h, label) : phCard(label, w, h, label);
  }
  function snapCard(w, h, label) { return liveCard(d.body.cloneNode(true), pageYOffset, w, h, label); }
  function phCard(title, w, h, label) {
    var c = card(w, h, label);
    c.clip.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;padding:0 9%"><div style="font-family:inherit;font-weight:500;letter-spacing:-.03em;font-size:clamp(30px,6vw,56px);color:#111">' + (title || '') + '</div></div>';
    return c.wrap;
  }

  // ---------- overlay + animation ----------
  function runDeck(axis, cards, ai, bi, onDone) {
    var W = vw(), H = vh();
    var o = d.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;background:#000;z-index:2147483647;overflow:hidden';
    var k = d.createElement('div');
    k.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px';
    o.appendChild(k);
    var span = axis === 'x' ? W : H, step = span + G;
    cards.forEach(function (c, i) {
      c.style.width = W + 'px'; c.style.height = H + 'px';
      if (axis === 'x') { c.style.left = (i * step) + 'px'; c.style.top = '0'; }
      else { c.style.top = (i * step) + 'px'; c.style.left = '0'; }
      k.appendChild(c);
    });
    k.style.transformOrigin = axis === 'x' ? ('0px ' + (H / 2) + 'px') : ((W / 2) + 'px 0px');
    function st(idx, s) {
      var t = span / 2 - (idx * step + span / 2) * s;
      return (axis === 'x' ? 'translateX(' + t + 'px)' : 'translateY(' + t + 'px)') + ' scale(' + s + ')';
    }
    k.style.transform = st(ai, 1);
    d.body.appendChild(o);
    raf(function () { raf(function () {
      k.style.transition = 'transform ' + D + 'ms ' + E;
      k.style.transform = st(ai, S);
      setTimeout(function () {
        k.style.transform = st(bi, S);
        setTimeout(function () {
          k.style.transform = st(bi, 1);
          setTimeout(onDone, D + 40);
        }, D);
      }, D);
    }); });
  }

  // ---------- swap (SPA, no reload) ----------
  function ri() {
    d.documentElement.style.overflow = ''; d.body.style.overflow = ''; d.body.style.height = '';
    try {
      var W = window.Webflow;
      if (W) { W.destroy(); W.ready(); var x = W.require && W.require('ix2'); if (x && x.init) x.init(); }
    } catch (e) {}
    try { dispatchEvent(new Event('resize')); } catch (e) {}
    scrollTo(0, 0);
  }
  function applyDoc(doc, url, push) {
    var P = doc.documentElement.getAttribute('data-wf-page');
    if (P) d.documentElement.setAttribute('data-wf-page', P);
    d.title = doc.title;
    d.body.className = doc.body.className;
    d.body.innerHTML = doc.body.innerHTML;
    if (push) history.pushState({}, '', url);
    ri(); setupAuto();
  }
  function swp(doc, url, push) { applyDoc(doc, url, push); busy = false; }

  // ---------- auto-advance "next page" sections (scroll storytelling) ----------
  function nameToUrl(name) {
    name = (name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    for (var i = 0; i < MAIN.length; i++) if (MAIN[i][1].toLowerCase() === name) return MAIN[i][0];
    return null;
  }
  var autoObs = null;
  function setupAuto() {
    if (autoObs) { autoObs.disconnect(); autoObs = null; }
    var secs = d.querySelectorAll('.next-page');
    if (!secs.length || !window.IntersectionObserver) return;
    autoObs = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        var s = en.target;
        if (en.isIntersecting && en.intersectionRatio >= 0.8) { if (!s.__armed) { s.__armed = 1; startAuto(s); } }
        else if (s.__armed && !s.__fired) { s.__armed = 0; clearTimeout(s.__t); var l = s.querySelector('.next-step-loading-line'); if (l) { l.style.transition = 'none'; l.style.width = '0%'; } }
      });
    }, { threshold: [0, 0.8, 1] });
    for (var i = 0; i < secs.length; i++) autoObs.observe(secs[i]);
  }
  function startAuto(s) {
    var url = s.getAttribute('data-next') || nameToUrl(s.textContent);
    if (!url || norm(new URL(url, location.href).pathname) === norm(location.pathname)) return;
    var dur = parseFloat(s.getAttribute('data-duration')); dur = dur ? (dur < 100 ? dur * 1000 : dur) : 6000;
    var l = s.querySelector('.next-step-loading-line');
    if (l) { l.style.transition = 'none'; l.style.width = '0%'; void l.offsetWidth; l.style.transition = 'width ' + dur + 'ms linear'; l.style.width = '100%'; }
    s.__t = setTimeout(function () { s.__fired = 1; revealTo(url, s); }, dur);
  }
  function revealTo(url, sec) {
    if (busy) return; busy = true;
    var bg = getComputedStyle(sec).backgroundColor;
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = '#FAF8F3';
    var docP = getDoc(url);                         // start fetching the next page now
    // Phase A: fade out the progress line + text inside the section
    [].forEach.call(sec.children, function (c) { c.style.transition = 'opacity 350ms ease'; c.style.opacity = '0'; });
    setTimeout(function () {
      // Phase B: the white panel expands from the section's rect to full viewport (100svh)
      var r = sec.getBoundingClientRect();
      var ov = d.createElement('div');
      ov.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height +
        'px;background:' + bg + ';z-index:2147483647;pointer-events:none;transition:left 650ms ' + E + ',top 650ms ' + E + ',width 650ms ' + E + ',height 650ms ' + E;
      d.documentElement.appendChild(ov);            // on <html> so body swap won't remove it
      raf(function () { raf(function () {
        ov.style.left = '0px'; ov.style.top = '0px'; ov.style.width = window.innerWidth + 'px'; ov.style.height = window.innerHeight + 'px';
      }); });
      // Phase C: once covered, swap content and reveal from opacity 0 + blur 10
      setTimeout(function () {
        docP.then(function (doc) {
          if (!doc || is404(doc)) { location.href = url; return; }
          applyDoc(doc, url, true);
          d.body.style.transition = 'none'; d.body.style.opacity = '0'; d.body.style.filter = 'blur(10px)';
          raf(function () { raf(function () {
            d.body.style.transition = 'opacity 700ms ease, filter 700ms ease';
            d.body.style.opacity = '1'; d.body.style.filter = 'blur(0px)';
            ov.style.transition = 'opacity 500ms ease'; ov.style.opacity = '0';
            setTimeout(function () {
              if (ov.parentNode) ov.parentNode.removeChild(ov);
              d.body.style.transition = ''; d.body.style.filter = ''; d.body.style.opacity = '';
              busy = false;
            }, 720);
          }); });
        }).catch(function () { location.href = url; });
      }, 690);
    }, 360);
  }
  function curLabel() {
    var mi = mainIndex(location.pathname);
    if (mi >= 0) return MAIN[mi][1];
    return (d.title || '').split('|')[0].split('—')[0].trim();
  }

  // ---------- navigations ----------
  function goVertical(url, tp) {
    var ti = mainIndex(tp), cc = cmsOf(location.pathname);
    var ci = cc ? mainIndex(cc.list) : mainIndex(location.pathname);
    var W = vw(), H = vh();
    Promise.all([getDoc(tp), resolve(MAIN.map(function (m) { return m[0]; }))]).then(function (res) {
      var tdoc = res[0], mdocs = res[1];
      if (!tdoc || is404(tdoc)) { location.href = url; return; }
      if (ci < 0 || ti < 0) {
        var f = [snapCard(W, H, curLabel()), docCard(tdoc, W, H, ti >= 0 ? MAIN[ti][1] : (tdoc.title || ''))];
        runDeck('y', f, 0, 1, function () { swp(tdoc, url, true); }); return;
      }
      var cards = MAIN.map(function (m, i) {
        if (i === ci) return snapCard(W, H, curLabel());
        return docCard(i === ti ? tdoc : mdocs[i], W, H, m[1]);
      });
      runDeck('y', cards, ci, ti, function () { swp(tdoc, url, true); });
    });
  }

  function goHorizontal(url, tp, t) {
    var W = vw(), H = vh();
    Promise.all([getDoc(tp), getDoc(t.list)]).then(function (r) {
      var tdoc = r[0], ldoc = r[1];
      if (!tdoc || is404(tdoc)) { location.href = url; return; }
      var lane = ldoc ? scrapeLane(ldoc, t.pfx) : [];
      var ti = laneIndex(lane, tp);
      if (ti < 0) { lane = [[tp, (tdoc.title || '').split('|')[0].trim()]]; ti = 0; }
      resolve(lane.map(function (x) { return x[0]; })).then(function (idocs) {
        var cc = cmsOf(location.pathname), cards, ai, bi;
        var ciL = (cc && cc.pfx === t.pfx) ? laneIndex(lane, location.pathname) : -1;
        if (ciL >= 0) {
          cards = lane.map(function (it, i) {
            if (i === ciL) return snapCard(W, H, it[1]);
            return docCard(i === ti ? tdoc : idocs[i], W, H, it[1]);
          });
          ai = ciL; bi = ti;
        } else {
          cards = [snapCard(W, H, curLabel())].concat(lane.map(function (it, i) {
            return docCard(i === ti ? tdoc : idocs[i], W, H, it[1]);
          }));
          ai = 0; bi = 1 + ti;
        }
        runDeck('x', cards, ai, bi, function () { swp(tdoc, url, true); });
      });
    });
  }

  // CMS item -> its own parent listing: stay horizontal, slide back to the first (parent) card
  function goHorizontalBack(url, cc) {
    var W = vw(), H = vh();
    getDoc(cc.list).then(function (ldoc) {
      if (!ldoc || is404(ldoc)) { location.href = url; return; }
      var lane = scrapeLane(ldoc, cc.pfx);
      var ci = laneIndex(lane, location.pathname);
      resolve(lane.map(function (x) { return x[0]; })).then(function (idocs) {
        var mi = mainIndex(cc.list);
        var listLabel = mi >= 0 ? MAIN[mi][1] : (ldoc.title || '');
        var cards = [docCard(ldoc, W, H, listLabel)].concat(lane.map(function (it, i) {
          return i === ci ? snapCard(W, H, it[1]) : docCard(idocs[i], W, H, it[1]);
        }));
        runDeck('x', cards, ci >= 0 ? (1 + ci) : 0, 0, function () { swp(ldoc, url, true); });
      });
    });
  }

  function go(url) {
    if (busy) return; busy = true;
    var tp; try { tp = norm(new URL(url, location.href).pathname); } catch (e) { location.href = url; return; }
    var t = cmsOf(tp), cc = cmsOf(location.pathname);
    if (t) goHorizontal(url, tp, t);
    else if (cc && norm(tp) === norm(cc.list)) goHorizontalBack(url, cc);
    else goVertical(url, tp);
  }

  // ---------- prefetch (so previews are ready) ----------
  function prefetch() {
    resolve(MAIN.map(function (m) { return m[0]; }));
    var here = norm(location.pathname);
    var cc = cmsOf(location.pathname);
    var listPath = cc ? cc.list : null;
    CMS.forEach(function (c) { if (norm(c.list) === here) listPath = c.list; });
    if (listPath) {
      var pfx = (cc || CMS.filter(function (c) { return norm(c.list) === here; })[0]).pfx;
      getDoc(listPath).then(function (ld) { if (ld) resolve(scrapeLane(ld, pfx).map(function (x) { return x[0]; })); });
    }
  }
  // ---------- wiring ----------
  function ok(a, e) {
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download') || a.hasAttribute('data-no-pt')) return false;
    var h = a.getAttribute('href') || '';
    if (/^(#|mailto:|tel:|javascript:)/i.test(h)) return false;
    var u; try { u = new URL(a.href, location.href); } catch (e2) { return false; }
    return u.origin === location.origin && u.pathname !== location.pathname;
  }
  if (!is404()) {
    d.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (ok(a, e)) { e.preventDefault(); go(a.href); }
    });
    addEventListener('popstate', function () { location.reload(); });
    (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(prefetch);
    setupAuto();
  }
})();
