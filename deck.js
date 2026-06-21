/* nomade.works page transition — deck switcher (2D)
   Vertical axis = main pages (in Webflow order)
   Horizontal axis = items inside a CMS collection
   Captions: 12px uppercase page/item name under each card. */
(function () {
  if (window.top !== window.self) return;            // never run inside an iframe
  var d = document;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  // ---------- config ----------
  var S = 0.7, D = 800, G = 18, R = 28, E = 'cubic-bezier(.7,0,.2,1)';
  var busy = false;

  // Main pages in vertical order (path, label)
  var MAIN = [
    ['/', 'Home'], ['/about', 'About'], ['/services', 'Services'],
    ['/solutions-list', 'Solutions'], ['/quick-wins-list', 'Quick Wins'],
    ['/pricing', 'Pricing'], ['/work', 'Work'], ['/contact', 'Contact']
  ];
  // CMS collections: detail-path prefix -> the listing page it lives under
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

  function fetchDoc(url) {
    return fetch(url).then(function (r) { return r.text(); })
      .then(function (t) { return new DOMParser().parseFromString(t, 'text/html'); });
  }

  // Collect ordered, unique CMS item links from a listing document
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
      cap.style.cssText = 'position:absolute;left:0;right:0;top:100%;margin-top:12px;text-align:center;font-family:inherit;font-weight:600;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#FAF8F3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8%';
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
  function phCard(title, w, h, label) {
    var c = card(w, h, label);
    c.clip.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;padding:0 9%"><div style="font-family:inherit;font-weight:500;letter-spacing:-.03em;font-size:clamp(30px,6vw,56px);color:#111">' + title + '</div></div>';
    return c.wrap;
  }

  // ---------- overlay + animation ----------
  function overlay() {
    var o = d.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;background:#000;z-index:2147483647;overflow:hidden';
    var k = d.createElement('div');
    k.style.cssText = 'position:absolute;left:0;top:0;width:100%';
    o.appendChild(k);
    return { o: o, k: k };
  }

  // axis: 'x' (horizontal) | 'y' (vertical)
  function runDeck(axis, cards, ai, bi, onDone) {
    var W = vw(), H = vh(), ov = overlay(), k = ov.k;
    var span = axis === 'x' ? W : H, step = span + G;
    cards.forEach(function (c, i) {
      c.style.width = W + 'px'; c.style.height = H + 'px';
      if (axis === 'x') { c.style.left = (i * step) + 'px'; c.style.top = '0'; }
      else { c.style.top = (i * step) + 'px'; c.style.left = '0'; }
      k.appendChild(c);
    });
    k.style.transformOrigin = axis === 'x' ? '0 50%' : '50% 0';
    function st(idx, s) {
      var t = span / 2 - (idx * step + span / 2) * s;
      return (axis === 'x' ? 'translateX(' + t + 'px)' : 'translateY(' + t + 'px)') + ' scale(' + s + ')';
    }
    k.style.transform = st(ai, 1);
    d.body.appendChild(ov.o);
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
  function swp(doc, url, push) {
    var P = doc.documentElement.getAttribute('data-wf-page');
    if (P) d.documentElement.setAttribute('data-wf-page', P);
    d.title = doc.title;
    d.body.className = doc.body.className;
    d.body.innerHTML = doc.body.innerHTML;
    if (push) history.pushState({}, '', url);
    ri(); busy = false;
  }
  function curLabel() {
    var mi = mainIndex(location.pathname);
    if (mi >= 0) return MAIN[mi][1];
    return (d.title || '').split('|')[0].split('—')[0].trim();
  }

  // ---------- navigations ----------
  function goVertical(url, tp) {
    fetchDoc(url).then(function (tdoc) {
      var ti = mainIndex(tp);
      var cc = cmsOf(location.pathname);
      var ci = cc ? mainIndex(cc.list) : mainIndex(location.pathname); // stand-in slot for CMS item
      var W = vw(), H = vh(), y = pageYOffset;
      if (ci < 0 || ti < 0) {
        var f = [liveCard(d.body.cloneNode(true), y, W, H, curLabel()),
                 liveCard(tdoc.body.cloneNode(true), 0, W, H, ti >= 0 ? MAIN[ti][1] : (tdoc.title || ''))];
        runDeck('y', f, 0, 1, function () { swp(tdoc, url, true); });
        return;
      }
      var cards = MAIN.map(function (m, i) {
        if (i === ci) return liveCard(d.body.cloneNode(true), y, W, H, curLabel());
        if (i === ti) return liveCard(tdoc.body.cloneNode(true), 0, W, H, m[1]);
        return phCard(m[1], W, H, m[1]);
      });
      runDeck('y', cards, ci, ti, function () { swp(tdoc, url, true); });
    }).catch(function () { location.href = url; });
  }

  function goHorizontal(url, tp, t) {
    Promise.all([fetchDoc(url), fetchDoc(location.origin + t.list)]).then(function (res) {
      var tdoc = res[0], lane = scrapeLane(res[1], t.pfx);
      var ti = laneIndex(lane, tp);
      if (ti < 0) { lane = [[tp, (tdoc.title || '').split('|')[0].trim()]]; ti = 0; }
      var W = vw(), H = vh(), y = pageYOffset;
      var cc = cmsOf(location.pathname), cards, ai, bi;
      if (cc && cc.pfx === t.pfx && laneIndex(lane, location.pathname) >= 0) {
        // sibling -> sibling, both already in the lane
        var ci = laneIndex(lane, location.pathname);
        cards = lane.map(function (it, i) {
          if (i === ci) return liveCard(d.body.cloneNode(true), y, W, H, it[1]);
          if (i === ti) return liveCard(tdoc.body.cloneNode(true), 0, W, H, it[1]);
          return phCard(it[1], W, H, it[1]);
        });
        ai = ci; bi = ti;
      } else {
        // entering from a main/other page: current at far left, items to the right
        var cur = liveCard(d.body.cloneNode(true), y, W, H, curLabel());
        cards = [cur].concat(lane.map(function (it, i) {
          return i === ti ? liveCard(tdoc.body.cloneNode(true), 0, W, H, it[1]) : phCard(it[1], W, H, it[1]);
        }));
        ai = 0; bi = 1 + ti;
      }
      runDeck('x', cards, ai, bi, function () { swp(tdoc, url, true); });
    }).catch(function () { location.href = url; });
  }

  function go(url) {
    if (busy) return; busy = true;
    var tp; try { tp = norm(new URL(url, location.href).pathname); } catch (e) { location.href = url; return; }
    var t = cmsOf(tp);
    if (t) goHorizontal(url, tp, t); else goVertical(url, tp);
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
  d.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (ok(a, e)) { e.preventDefault(); go(a.href); }
  });
  addEventListener('popstate', function () { location.reload(); });
})();
