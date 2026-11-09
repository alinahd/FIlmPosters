/* Remaking Color: Color Wall. One row per remake pair: two strips of color (original on top, remake below).
   Posters melt into their strips as each row scrolls in; hover shows the poster; click opens the pair. */
(() => {
  'use strict';
  const RC = window.RC, RS = window.RS || {}, RPC = window.RPC || {}, pairs = RC.pairs, SD = RC.sd, N = pairs.length;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  const num = (v, d = 1) => v.toFixed(d);
  const SAME = 0.25, DIRNAME = { '-1': 'dec', '0': 'same', '1': 'inc' }, posterUrl = f => '../posters/' + f;
  const METRICS = [
    { k: 'chroma', name: 'Saturation', up: 'more saturated', down: 'less saturated', help: 'how vivid the colors are · higher = more intense, lower = more muted' },
    { k: 'lightness', name: 'Brightness', up: 'brighter', down: 'darker', help: 'how light or dark overall · 0 = black, 100 = white' },
    { k: 'warmth', name: 'Warmth', up: 'warmer', down: 'cooler', help: 'yellow/orange (above 0) vs blue (below 0)' },
    { k: 'contrast', name: 'Contrast', up: 'higher contrast', down: 'lower contrast', help: 'how far apart the lightest and darkest areas are' },
    { k: 'greyness', name: 'Greyness', up: 'greyer', down: 'less grey', help: 'share of the poster with almost no color · change in percentage points' },
    { k: 'texture', name: 'Texture', up: 'more fine detail', down: 'less fine detail', help: 'edges and fine detail; titles and logos count too' },
  ];
  const M = Object.fromEntries(METRICS.map(m => [m.k, m]));
  const verdict = (k, d) => { const z = d / SD[k]; return Math.abs(z) < SAME ? { dir: 0, z } : { dir: z > 0 ? 1 : -1, z }; };
  const word = (k, dir) => dir > 0 ? M[k].up : dir < 0 ? M[k].down : 'about the same';
  pairs.forEach((p, i) => { p.i = i; p.o = p.orig; p.r = p.remake; p.diff = ['chroma', 'lightness', 'warmth', 'contrast'].reduce((s, k) => s + Math.abs(p.ch[k] / SD[k]), 0); });
  const SORTS = [
    { id: 'year', label: 'Timeline' }, { id: 'chroma-', label: 'Lost color', k: 'chroma', dir: 1 }, { id: 'chroma+', label: 'Gained color', k: 'chroma', dir: -1 },
    { id: 'lightness-', label: 'Got darker', k: 'lightness', dir: 1 }, { id: 'lightness+', label: 'Got brighter', k: 'lightness', dir: -1 },
    { id: 'warmth-', label: 'Got cooler', k: 'warmth', dir: 1 }, { id: 'warmth+', label: 'Got warmer', k: 'warmth', dir: -1 },
    { id: 'alike', label: 'Most alike' }, { id: 'diff', label: 'Most different' },
  ];
  const state = { sort: 'year', genre: 'All', q: '', view: 'strips', open: null, po: 0, pr: 0, list: [] };

  /* ---------- strips: 160 sampled colors, each sample drawn as a crisp block ---------- */
  const strip = (cv, file, f, vertical) => {
    const s = RS[file]; if (vertical) { cv.width = 1; cv.height = 160; } else { cv.width = 160; cv.height = 1; }
    const ctx = cv.getContext('2d'); const put = (i, c) => { ctx.fillStyle = c; vertical ? ctx.fillRect(0, i, 1, 1) : ctx.fillRect(i, 0, 1, 1); };
    if (s) for (let i = 0; i < 160; i++) put(i, '#' + s.slice(i * 6, i * 6 + 6));
    else { let acc = 0; f.posters[0].palette.forEach(([hex, pct]) => { const n = Math.round(pct / 100 * 160); for (let k = 0; k < n && acc + k < 160; k++) put(acc + k, hex); acc += n; }); }
  };

  /* ---------- controls ---------- */
  const groups = RC.groups.map(g => ({ g, n: pairs.filter(p => p.shared.includes(g)).length })).filter(r => r.n).sort((a, b) => b.n - a.n);
  // Filter menu (replaces the row of chips): picking an option re-orders the wall immediately, with no scroll transition.
  $('#fmenu').innerHTML = SORTS.map(s => `<button role="menuitemradio" data-sort="${s.id}" aria-checked="false">${s.label}</button>`).join('');
  const fmenu = $('#fmenu'), fbtn = $('#fbtn');
  const menu = open => { fmenu.hidden = !open; fbtn.setAttribute('aria-expanded', open); };
  fbtn.addEventListener('click', e => { e.stopPropagation(); menu(fmenu.hidden); });
  document.addEventListener('click', e => { if (!e.target.closest('.fwrap')) menu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !fmenu.hidden) { menu(false); fbtn.focus(); } });
  $('#genre').innerHTML = `<option value="All">All (${N})</option>` + groups.map(r => `<option value="${esc(r.g)}">${esc(r.g)} (${r.n})</option>`).join('');

  /* ---------- rows ---------- */
  const rowsEl = $('#rows');
  const rowEls = pairs.map(p => {
    const el = document.createElement('div'); el.className = 'r'; el.dataset.i = p.i; el.tabIndex = 0; el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${p.o.title}, ${p.o.year} then ${p.r.year}: open`);
    const t = (f, w) => `<div><b>${f.year}</b>${esc(f.title)}<em>${w}</em></div>`;
    el.innerHTML = `<div class="lab">${t(p.o, 'then')}${t(p.r, 'now')}</div>
      <div class="sg"><canvas data-k="o"></canvas><canvas data-k="r"></canvas><div class="pz"><img loading="lazy" src="${posterUrl(p.o.posters[0].file)}" alt=""><img loading="lazy" src="${posterUrl(p.r.posters[0].file)}" alt=""></div></div><div class="val"></div>`;
    const cs = $$('canvas', el); strip(cs[0], p.o.posters[0].file, p.o); strip(cs[1], p.r.posters[0].file, p.r);
    rowsEl.appendChild(el); return el;
  });
  const hay = p => `${p.o.title} ${p.r.title} ${p.o.year} ${p.r.year}`.toLowerCase();
  const visible = () => {
    const S = SORTS.find(s => s.id === state.sort);
    return pairs.filter(p => (state.genre === 'All' || p.shared.includes(state.genre)) && (!state.q || state.q.toLowerCase().split(/\s+/).every(t => hay(p).includes(t))))
      .sort((a, b) => state.sort === 'year' ? a.r.year - b.r.year || a.id - b.id : state.sort === 'alike' ? a.diff - b.diff : state.sort === 'diff' ? b.diff - a.diff : S.dir * (a.ch[S.k] - b.ch[S.k]) || a.id - b.id);
  };
  function refresh(animate) {
    const list = visible(), set = new Set(list.map(p => p.i)); state.list = list.map(p => p.i);
    const first = new Map(); if (animate) rowEls.forEach(el => { if (!el.hidden) first.set(el, el.getBoundingClientRect().top); });
    list.forEach(p => rowsEl.appendChild(rowEls[p.i])); rowEls.forEach((el, i) => { el.hidden = !set.has(i); });
    const S = SORTS.find(s => s.id === state.sort);
    list.forEach(p => {
      const v = $('.val', rowEls[p.i]);
      if (S.k) { const d = p.ch[S.k], vd = verdict(S.k, d); v.innerHTML = `<b class="w-${DIRNAME[vd.dir]}">${fmt(d)}</b><span class="w-${DIRNAME[vd.dir]}">${word(S.k, vd.dir)}</span>`; }
      else if (state.sort === 'year') v.innerHTML = '';
      else v.innerHTML = `<b class="w-same">${p.diff.toFixed(1)}</b><span class="w-same">overall difference</span>`;
    });
    if (animate) { const vh = innerHeight, mv = []; list.forEach(p => { const el = rowEls[p.i], t0 = first.get(el); if (t0 === undefined) return; const dy = t0 - el.getBoundingClientRect().top; if (Math.abs(dy) < 1 || Math.abs(dy) > vh * 1.2) return; el.style.transition = 'none'; el.style.transform = `translateY(${dy}px)`; mv.push(el); }); void rowsEl.offsetHeight; mv.forEach(el => { el.style.transition = ''; el.style.transform = ''; }); }
    $$('[data-sort]').forEach(b => b.setAttribute('aria-checked', b.dataset.sort === state.sort)); $('#fcur').textContent = SORTS.find(s => s.id === state.sort).label;
    $('#cnt').textContent = `${list.length} of ${N} pairs` + (state.genre !== 'All' && list.length < 5 && list.length ? ' · too few to compare' : '');
    if (!list.length && !$('.empty')) { const e = document.createElement('p'); e.className = 'empty'; e.textContent = 'Nothing matches. Clear the search or pick another genre.'; rowsEl.appendChild(e); } else if (list.length) $$('.empty').forEach(e => e.remove());
    reveal();
  }
  $('#bar').addEventListener('click', e => { const b = e.target.closest('[data-sort]'); if (b) { state.sort = b.dataset.sort; menu(false); refresh(false); } });
  $('#genre').addEventListener('change', e => { state.genre = e.target.value; refresh(false); });
  $('#q').addEventListener('input', e => { state.q = e.target.value.trim(); refresh(false); });
  $('#q').addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; state.q = ''; refresh(false); e.target.blur(); } e.stopPropagation(); });

  /* ---------- scroll: posters melt into their strips as a row arrives ---------- */
  const ease = t => t * t * (3 - 2 * t);
  function reveal() {
    if (state.view === 'wall') return;
    const vh = innerHeight, slack = document.documentElement.scrollHeight - vh - scrollY;
    const lead = Math.max(0, vh * .4 - slack);   // near the end of the page, rows reveal earlier so the last ones are never left half-drawn
    rowEls.forEach(el => {
      if (el.hidden) return; const top = el.getBoundingClientRect().top;
      // one-way: once a row has been revealed it stays revealed, so scrolling back up never hides colors again
      el._pr = Math.max(el._pr || 0, ease(clamp((vh * .94 + lead - top) / (vh * .3), 0, 1)));
      const pr = el._pr, cs = el.children[1].children, pz = el.children[1].lastElementChild;
      cs[0].style.clipPath = `inset(0 ${(1 - clamp(pr * 1.1, 0, 1)) * 100}% 0 0)`; cs[1].style.clipPath = `inset(0 ${(1 - clamp(pr * 1.1 - .1, 0, 1)) * 100}% 0 0)`;
      el.children[0].style.opacity = clamp(pr * 1.6, 0, 1); el.children[0].style.transform = `translateY(${(1 - pr) * 14}px)`;
      pz.style.opacity = clamp(1 - pr * 1.25, 0, 1); pz.style.transform = `scaleX(${1 + pr * 3})`;
    });
  }
  addEventListener('scroll', reveal, { passive: true }); addEventListener('resize', reveal);

  /* ---------- header text follows the view ---------- */
  const HOW = {
    strips: '<span class="lead">Every film here was remade.</span> Each pair is two strips of color: the <b>original poster</b> on top and the <b>remake’s poster</b> below. A strip samples 160 colors from across the poster, colorful ones first (red to purple) and then the greys (white to black), so a longer stretch of one color means more of that color on the poster. Hover a strip to see its poster, and click a pair to open it.',
    wall: '<span class="lead">The same pairs, as posters.</span> The <b>original poster</b> on the left and the <b>remake’s poster</b> on the right. Hover a pair and every other pair turns grey so you can look at it on its own, and click a pair to open it. Switch back to Color strips to compare the colors of each poster directly.',
  };
  function setHeader() {
    const wall = state.view === 'wall';
    $('#stat').innerHTML = `<div><b>${N}</b><span>film pairs</span></div><div><b>${Math.min(...pairs.map(p => p.o.year))}–${Math.max(...pairs.map(p => p.r.year))}</b><span>oldest original to newest remake</span></div>`;
    $('#badge').textContent = wall ? '02' : '01'; $('#kt').textContent = wall ? 'POSTER WALL' : 'THE COLOR STRIPS'; $('#how').innerHTML = HOW[state.view];
  }
  setHeader();

  /* ---------- view mode: color strips <-> poster wall (automatic, smooth) ---------- */
  // Switching views is a choreographed cascade. The pairs are "dealt" one after another in reading order (top to bottom), so the flights never pile up:
  //   strips -> wall: the strips retract into the small poster pair at the start of each row; then each pair flies into its grid cell
  //   wall -> strips: each poster pair flies back to the start of its row; the strips unroll out of it
  // Rows that are on screen in only one of the two layouts rise (or unroll) in place, so every visible poster moves.
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches, EASE = 'cubic-bezier(.65,0,.25,1)';
  let busy = false;
  function setView(v) {
    if (v === state.view || busy) return;
    busy = true;
    const vh = innerHeight, vis = rowEls.filter(el => !el.hidden), D = 55;
    const near = el => { const r = el.getBoundingClientRect(); return r.bottom > -150 && r.top < vh + 150; };
    const pzOf = el => el.children[1].lastElementChild, stripsOf = el => [...el.children[1].querySelectorAll('canvas')], labOf = el => el.children[0];
    const order = els => els.slice().sort((a, b) => { const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return A.top - B.top || A.left - B.left; });
    const commit = () => { state.view = v; $$('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === v)); setHeader(); rowsEl.classList.remove('hovering'); $$('.r.hl', rowsEl).forEach(r => r.classList.remove('hl')); card.hidden = true; };
    const clearInline = el => { [pzOf(el), labOf(el), ...stripsOf(el)].forEach(n => { n.style.transition = ''; n.style.transform = ''; n.style.transformOrigin = ''; n.style.opacity = ''; n.style.clipPath = ''; }); };
    const finish = () => { vis.forEach(clearInline); rowsEl.classList.remove('morphing'); busy = false; if (v === 'strips') reveal(); };
    const anim = order(REDUCED ? [] : vis);   // every pair takes part, not only the ones on screen
    if (!anim.length) { commit(); rowsEl.classList.toggle('wall', v === 'wall'); vis.forEach(clearInline); busy = false; if (v === 'strips') reveal(); return; }
    rowsEl.classList.add('morphing');
    const flip = (el, f, l) => { const pz = pzOf(el); pz.style.transformOrigin = '0 0'; pz.style.transition = 'none'; pz.style.opacity = '1'; pz.style.transform = `translate(${f.left - l.left}px,${f.top - l.top}px) scale(${f.width / l.width},${f.height / l.height})`; };

    if (v === 'wall') {
      // 1 · strips retract to the left and the names fade; the poster pair shows at the start of each row
      anim.forEach((el, i) => {
        const pz = pzOf(el); pz.style.transition = 'none'; pz.style.transform = 'none'; pz.style.opacity = '1';
        stripsOf(el).forEach(c => { c.style.transition = `clip-path .4s ${Math.min(i * 12, 200)}ms ${EASE}`; c.style.clipPath = 'inset(0 100% 0 0)'; });
        labOf(el).style.transition = `opacity .3s ${Math.min(i * 10, 200)}ms`; labOf(el).style.opacity = '0';
      });
      setTimeout(() => {
        // 2 · switch to the grid; each pair flies from its row to its cell, one after another in grid order
        const first = anim.map(el => pzOf(el).getBoundingClientRect());
        commit(); rowsEl.classList.add('wall');
        vis.forEach(el => { if (!anim.includes(el)) clearInline(el); });
        anim.forEach(el => stripsOf(el).forEach(c => { c.style.transition = ''; c.style.clipPath = ''; }));
        const last = anim.map(el => pzOf(el).getBoundingClientRect());
        const inn = order(vis.filter(near)), rank = new Map(inn.map((el, i) => [el, i]));
        anim.forEach((el, i) => { flip(el, first[i], last[i]); labOf(el).style.transition = 'none'; labOf(el).style.opacity = '0'; });
        const fresh = inn.filter(el => !anim.includes(el));
        fresh.forEach(el => { const pz = pzOf(el); pz.style.transition = 'none'; pz.style.opacity = '0'; pz.style.transform = 'translateY(46px)'; labOf(el).style.transition = 'none'; labOf(el).style.opacity = '0'; });
        void rowsEl.offsetHeight;
        anim.forEach(el => { const d = (rank.has(el) ? rank.get(el) : inn.length) * D; pzOf(el).style.transition = `transform .85s ${d}ms ${EASE}`; pzOf(el).style.transform = 'none'; labOf(el).style.transition = `opacity .5s ${d + 560}ms`; labOf(el).style.opacity = '1'; });
        fresh.forEach(el => { const d = rank.get(el) * D, pz = pzOf(el); pz.style.transition = `transform .85s ${d}ms ${EASE}, opacity .6s ${d}ms`; pz.style.transform = 'none'; pz.style.opacity = '1'; labOf(el).style.transition = `opacity .5s ${d + 560}ms`; labOf(el).style.opacity = '1'; });
        setTimeout(finish, 1500 + Math.min(inn.length * D, 1200));
      }, 600);
    } else {
      // 1 · names fade; 2 · switch to rows; each pair flies back to the start of its row, then the strips unroll out of it
      const first = anim.map(el => pzOf(el).getBoundingClientRect());
      anim.forEach(el => { labOf(el).style.transition = 'opacity .25s'; labOf(el).style.opacity = '0'; });
      setTimeout(() => {
        commit(); rowsEl.classList.remove('wall');
        vis.forEach(el => { if (!anim.includes(el)) clearInline(el); });
        const inn = order(vis.filter(near)), rank = new Map(inn.map((el, i) => [el, i]));
        anim.forEach(el => {
          el._pr = 1; stripsOf(el).forEach(c => { c.style.transition = 'none'; c.style.clipPath = 'inset(0 100% 0 0)'; });
          const pz = pzOf(el); pz.style.transition = 'none'; pz.style.opacity = '1'; pz.style.transform = 'none';
          labOf(el).style.transition = 'none'; labOf(el).style.opacity = '0';
        });
        const last = anim.map(el => pzOf(el).getBoundingClientRect());
        anim.forEach((el, i) => flip(el, first[i], last[i]));
        const fresh = inn.filter(el => !anim.includes(el));
        fresh.forEach(el => { el._pr = 1; stripsOf(el).forEach(c => { c.style.transition = 'none'; c.style.clipPath = 'inset(0 100% 0 0)'; }); labOf(el).style.transition = 'none'; labOf(el).style.opacity = '0'; });
        void rowsEl.offsetHeight;
        anim.forEach(el => {
          const d = (rank.has(el) ? rank.get(el) : inn.length) * D, pz = pzOf(el);
          pz.style.transition = `transform .85s ${d}ms ${EASE}, opacity .45s ${d + 800}ms`; pz.style.transform = 'none'; pz.style.opacity = '0';
          stripsOf(el).forEach((c, k) => { c.style.transition = `clip-path .7s ${d + 700 + k * 80}ms ${EASE}`; c.style.clipPath = 'inset(0 0% 0 0)'; });
          labOf(el).style.transition = `opacity .5s ${d + 650}ms`; labOf(el).style.opacity = '1';
        });
        fresh.forEach(el => { const d = rank.get(el) * D; stripsOf(el).forEach((c, k) => { c.style.transition = `clip-path .7s ${d + k * 80}ms ${EASE}`; c.style.clipPath = 'inset(0 0% 0 0)'; }); labOf(el).style.transition = `opacity .5s ${d + 200}ms`; labOf(el).style.opacity = '1'; });
        setTimeout(finish, 1900 + Math.min(inn.length * D, 1200));
      }, 300);
    }
  }
  $('#view').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });

  /* ---------- hover card ---------- */
  const card = $('#card');
  const cardFor = (p, which) => {
    const f = which === 'o' ? p.o : p.r, pc = RPC[f.posters[0].file];
    const line = which === 'o' ? `Original · remade ${p.r.year}` : (p.rel === 'Remake' ? `Remake of ${p.o.year} film` : `${esc(p.rel)} · original ${p.o.year}`);
    return `<img src="${posterUrl(f.posters[0].file)}" alt=""><div><b>${esc(f.title)}</b><span>${f.year}${pc !== undefined ? ` · ${Math.round(pc)}% real color` : ''}</span><span>${line}</span></div>`;
  };
  rowsEl.addEventListener('mousemove', e => {
    const r = e.target.closest('.r');
    if (state.view === 'wall') {   // poster wall: no card. The hovered pair keeps its color, every other pair turns grey.
      card.hidden = true; const prev = $('.r.hl', rowsEl); if (prev && prev !== r) prev.classList.remove('hl');
      if (r) { r.classList.add('hl'); rowsEl.classList.add('hovering'); } else rowsEl.classList.remove('hovering');
      return;
    }
    if (!r) { card.hidden = true; return; }
    const cv = e.target.closest('canvas'), lab = null, im = null; let which = null;   // the card shows only over the color strips, not over the names
    if (cv) which = cv.dataset.k; else if (lab) { const idx = [...lab.children].indexOf(e.target.closest('.lab > div')); which = idx === 0 ? 'o' : 'r'; }
    if (!which) { card.hidden = true; return; }
    card.innerHTML = cardFor(pairs[+r.dataset.i], which); card.hidden = false;
    const b = card.getBoundingClientRect(); card.style.left = clamp(e.clientX + 18, 8, innerWidth - b.width - 8) + 'px'; card.style.top = clamp(e.clientY - b.height / 2, 60, innerHeight - b.height - 8) + 'px';
  });
  rowsEl.addEventListener('mouseleave', () => { card.hidden = true; rowsEl.classList.remove('hovering'); $$('.r.hl', rowsEl).forEach(r => r.classList.remove('hl')); });

  /* ---------- opened pair ---------- */
  const labHex = (L, C, h) => {
    const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180), fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const f = t => t ** 3 > .008856 ? t ** 3 : (t - 16 / 116) / 7.787, X = .95047 * f(fx), Y = f(fy), Z = 1.08883 * f(fz);
    const lin = [3.2404542 * X - 1.5371385 * Y - .4985314 * Z, -.969266 * X + 1.8760108 * Y + .041556 * Z, .0556434 * X - .2040259 * Y + 1.0572252 * Z];
    return '#' + lin.map(c => { c = clamp(c, 0, 1); c = c <= .0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - .055; return Math.round(clamp(c, 0, 1) * 255).toString(16).padStart(2, '0'); }).join('');
  };
  const HUECOL = Array.from({ length: 12 }, (_, j) => labHex(66, 58, 15 + 30 * j));
  const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return .2126 * r + .7152 * g + .0722 * b; };
  const ALL = {}; METRICS.forEach(m => { ALL[m.k] = []; pairs.forEach(p => [p.o, p.r].forEach(f => f.posters.forEach(x => ALL[m.k].push(x.metrics[m.k])))); const s = [...new Set(ALL[m.k])].sort((a, b) => a - b); ALL[m.k] = s; });
  const REL = {
    'Remake': 'The same story filmed again.', 'Remake (TV movie)': 'The same story filmed again, as a TV movie.',
    'Reboot / re-imagining': 'A fresh start that reuses the story or characters without retelling it exactly.',
    'Live-action version of an animated film': 'A live-action film of a story first told as an animated film.',
    'New adaptation of the same source (not a direct remake)': 'Both films adapt the same book, play or other source; the newer one is not a remake of the older film.',
  };
  const polar = (hue, year) => {
    const mx = Math.max(...hue, 1), R = 92, c = 100; let h = '';
    hue.forEach((v, j) => { const r = R * Math.sqrt(v / mx), a0 = (j * 30 - 90) * Math.PI / 180, a1 = ((j + 1) * 30 - 90) * Math.PI / 180; h += `<path d="M${c},${c} L${(c + r * Math.cos(a0)).toFixed(1)},${(c + r * Math.sin(a0)).toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${(c + r * Math.cos(a1)).toFixed(1)},${(c + r * Math.sin(a1)).toFixed(1)} Z" fill="${HUECOL[j]}"><title>hue ${j * 30}–${j * 30 + 30}°: ${v.toFixed(1)}% of the poster’s color</title></path>`; });
    return `<svg viewBox="0 0 200 200" role="img" aria-label="Hue mix ${year}"><circle cx="100" cy="100" r="92" fill="none" stroke="rgba(241,237,228,.12)"/>${h}</svg>`;
  };
  const poster = (f, i) => f.posters[Math.min(i, f.posters.length - 1)];
  function renderOv() {
    const p = pairs[state.open]; if (!p) return; const po = poster(p.o, state.po), pr = poster(p.r, state.pr), multi = p.o.posters.length > 1 || p.r.posters.length > 1;
    const oM = p.o.metrics, rM = p.r.metrics, at = state.list.indexOf(p.i);
    const rows = METRICS.map((m, n) => { const d = rM[m.k] - oM[m.k], v = verdict(m.k, d), [lo, hi] = [ALL[m.k][0], ALL[m.k][ALL[m.k].length - 1]], pc = x => clamp((x - lo) / (hi - lo) * 100, 0, 100); return `<div class="mrow ${DIRNAME[v.dir]} ${n ? '' : 'f'}"><div class="n"><b>${m.name}</b><span>${m.help}</span></div><div class="d">${fmt(d)}<small>${word(m.k, v.dir)}</small></div><div class="trk"><div class="ticks">${ALL[m.k].map(x => `<i style="left:${pc(x)}%"></i>`).join('')}</div><span class="link" style="left:${Math.min(pc(oM[m.k]), pc(rM[m.k]))}%;width:${Math.abs(pc(rM[m.k]) - pc(oM[m.k]))}%"></span><span class="a" style="left:${pc(oM[m.k])}%"></span><span class="b" style="left:${pc(rM[m.k])}%"></span></div></div>`; }).join('');
    const pal = (x, f, role) => `<div class="pl"><span>${role} · ${f.year}</span><span>6 most common colors</span></div><div class="pal">${x.palette.map(([hex, pct]) => `<i style="flex:${pct};background:${hex}">${pct >= 8 ? `<span>${hex} · ${Math.round(pct)}%</span>` : ''}</i>`).join('')}</div>`;
    const thumbs = (f, side, cur, key) => f.posters.length > 1 ? `<span>${side} posters:</span>${f.posters.map((x, j) => `<button data-poster="${key}${j}" aria-pressed="${j === cur}" aria-label="${side} poster ${j + 1}"><img src="${posterUrl(x.file)}" alt=""></button>`).join('')}` : '';
    const pcO = RPC[po.file], pcR = RPC[pr.file];
    $('#ovin').innerHTML = `<div class="side"><canvas data-k="o"></canvas><canvas data-k="r"></canvas></div>
      <div class="main" id="main"><button class="close" data-close aria-label="Close">✕</button>
        <div class="kk" style="margin-bottom:18px"><span class="badge">03</span><span class="kt">THE CLOSE-UP</span></div>
        ${p.o.title === p.r.title
          ? `<h2 class="big">${esc(p.o.title)}</h2>`
          : `<h2 class="big thennow"><span class="tl"><i>Then · ${p.o.year}</i>${esc(p.o.title)}</span><span class="tl now"><i>Now · ${p.r.year}</i>${esc(p.r.title)}</span></h2>`}
        <div class="top"><div><div class="wipe" id="wipe" tabindex="0" role="slider" aria-label="Divider between original and remake poster" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><img src="${posterUrl(po.file)}" alt="Original poster, ${p.o.year}"><img class="wr" src="${posterUrl(pr.file)}" alt="Remake poster, ${p.r.year}"><div class="handle" id="handle" style="left:50%"></div></div><div class="wcap"><span>Original · ${p.o.year}</span><span>Remake · ${p.r.year}</span></div><p class="hintl">Drag the divider, or click the poster and use ← →.</p><div class="thumbs">${thumbs(p.o, 'Original', state.po, 'o')}${thumbs(p.r, 'Remake', state.pr, 'r')}</div></div>
          <div class="about"><div class="sec" style="margin-top:0">The pair</div><p>${p.o.year === p.r.year ? '' : `The remake came out ${p.gap} years after the original.`} ${p.note ? esc(p.note) + '.' : ''}</p><dl><dt>Original</dt><dd>${p.o.year}</dd><dt>Remake</dt><dd>${p.r.year}</dd>${p.rel === 'Remake' ? '' : `<dt>How they’re related</dt><dd><b>${esc(p.rel)}</b></dd>`}${pcO !== undefined && pcR !== undefined ? `<dt>Real color</dt><dd>${Math.round(pcO)}% of the original poster, ${Math.round(pcR)}% of the remake’s. The rest is grey, black or white.</dd>` : ''}${p.shared.length ? `<dt>Genre</dt><dd>${esc(p.shared.slice(0, 3).join(', '))}</dd>` : ''}</dl></div></div>
        <div class="sec">Extracted palette<span>the six most common colors on each poster; width = share of the poster</span></div>${pal(po, p.o, 'Original')}${pal(pr, p.r, 'Remake')}
        <div class="two"><div><div class="sec">Measurements</div>
          <div class="howto"><p><b>How to read each row</b></p><ol>
            <li><b>Left:</b> what was measured.</li>
            <li><b>Big number:</b> the remake’s value minus the original’s. <span class="c-inc">Orange</span> means the remake’s poster has more of it, <span class="c-dec">blue</span> means less. “≈ 0” means about the same: the gap is smaller than a quarter of how much that measure normally differs from one poster to another, too small to call a change.</li>
            <li><b>Bar on the right:</b> every thin line is one poster from the whole set, so you can see where this pair falls among all of them. The ring marks the original poster, the yellow bar marks the remake’s poster, and the colored line between them is the change.</li></ol>${multi ? '<p class="small">This pair has more than one distinct poster; the numbers use the average of a film’s posters.</p>' : ''}</div>${rows}</div>
          <div><div class="sec">Hue mix<span>which colors each poster is made of</span></div><div class="polars"><figure>${polar(poster(p.o, state.po).hue, p.o.year)}<figcaption>Original</figcaption></figure><figure>${polar(poster(p.r, state.pr).hue, p.r.year)}<figcaption>Remake</figcaption></figure></div><p class="cap">Each wedge is one hue family around the color wheel, starting at the top. A longer wedge means more of the poster’s color is in that family. Greys, whites and blacks are left out.</p></div></div>
        <div class="pn"><button class="btn" data-step="-1">← Previous</button><span class="n">${at >= 0 ? `${at + 1} of ${state.list.length}` : ''}</span><button class="btn" data-step="1">Next →</button></div></div>`;
    const cs = $$('.side canvas'); strip(cs[0], po.file, p.o, true); strip(cs[1], pr.file, p.r, true); wireWipe();
  }
  function wireWipe() {
    const w = $('#wipe'); if (!w) return; let pos = 50, drag = false;
    const side = $$('.side canvas');   // the left stripes grow and shrink with the divider: more original as you reveal it, more remake the other way
    const set = v => { pos = clamp(v, 0, 100); $('.wr', w).style.clipPath = `inset(0 0 0 ${pos}%)`; $('#handle').style.left = pos + '%'; w.setAttribute('aria-valuenow', Math.round(pos)); if (side.length === 2) { side[0].style.flexGrow = Math.max(pos, 1.5); side[1].style.flexGrow = Math.max(100 - pos, 1.5); } };
    const fromE = e => { const r = w.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100); };
    w.addEventListener('pointerdown', e => { drag = true; w.setPointerCapture(e.pointerId); w.focus(); fromE(e); }); w.addEventListener('pointermove', e => { if (drag) fromE(e); }); w.addEventListener('pointerup', () => { drag = false; });
    w.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { set(pos + (e.key === 'ArrowLeft' ? -4 : 4)); e.preventDefault(); e.stopPropagation(); } });
  }
  const ov = $('#ov'); let returnTo = null;
  function openOv(i, from) { const was = state.open !== null; state.open = i; if (!was) { state.po = 0; state.pr = 0; returnTo = from || document.activeElement; ov.hidden = false; document.body.classList.add('lock'); requestAnimationFrame(() => ov.classList.add('on')); } else { state.po = 0; state.pr = 0; } renderOv(); history.replaceState(null, '', '#pair=' + pairs[i].id); const m = $('#main'); if (m) m.scrollTop = 0; const c = $('.close', ov); if (c && !was) c.focus({ preventScroll: true }); }
  function closeOv() { if (state.open === null) return; state.open = null; ov.classList.remove('on'); document.body.classList.remove('lock'); history.replaceState(null, '', location.pathname + location.search); setTimeout(() => { if (state.open === null) ov.hidden = true; }, 360); if (returnTo && returnTo.focus) returnTo.focus({ preventScroll: true }); }
  const step = d => { const l = state.list; if (!l.length) return; const at = l.indexOf(state.open); openOv(l[(at + d + l.length) % l.length]); };
  rowsEl.addEventListener('click', e => { const r = e.target.closest('.r'); if (r) openOv(+r.dataset.i, r); });
  rowsEl.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('r')) { e.preventDefault(); openOv(+e.target.dataset.i, e.target); } });
  ov.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.close !== undefined) closeOv(); else if (b.dataset.step) step(+b.dataset.step); else if (b.dataset.poster) { const j = +b.dataset.poster.slice(1); if (b.dataset.poster[0] === 'o') state.po = j; else state.pr = j; const m = $('#main').scrollTop; renderOv(); $('#main').scrollTop = m; } });
  addEventListener('keydown', e => {
    if (state.open === null) return; const t = e.target && e.target.closest ? e.target : document.body;
    if (e.key === 'Escape') closeOv(); else if (!t.closest('#wipe')) { if (e.key === 'ArrowRight') { step(1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); } }
  });

  /* ---------- start ---------- */
  const hp = +(new URLSearchParams(location.hash.slice(1)).get('pair'));
  refresh(false); const f0 = pairs.find(p => p.id === hp); if (f0) openOv(f0.i);
})();
