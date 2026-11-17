/*
  "las 3 / fases." staged over the second hero. After the two sentences have
  met (push.js), the phases' cells rise from below one at a time and settle
  in place on top of the pinned hero, step by step through
  .push-track__phases:

    step 0  the title cell rises to the top of the screen
    step 1  phase 01 rises under it, full size
    step 2  phase 02 rises; phase 01 shrinks to its number and title
    step 3  phase 03 rises; phase 02 shrinks too

  At the end the title, two shrunk rows and phase 03 at full size fill the
  screen exactly. A shrunk row keeps its text, greyed out, faded at the
  bottom where it does not fit (styles.css). The phase in focus always gets
  the height its text needs; when that is more than the screen leaves (a
  small phone), the whole screen scrolls on at the end to show the rest.

  Then any phase can be chosen: hovering it (mouse), or clicking / tapping
  / focusing it. The chosen one glides to full size and the others shrink.
  Scrolling back up returns the focus to phase 03.

  Closing (.push-track__close): the closing slide (.cta) is pinned behind
  the phases, hidden until they fill the screen. Then a circle centred on
  the screen closes in on the phases, pulling them slightly inward, and
  leaves the closing slide: the "ruta." opening circle in reverse.

  No snapping: the page rests wherever you stop, even half way through a
  step. Everything is computed from the scroll position, so scrolling up
  reverses it exactly.
*/
(() => {
  const track = document.querySelector('.push-track');
  const phases = track?.querySelector('.phases');
  const push = track?.querySelector('.push-track__push');
  const spacer = track?.querySelector('.push-track__phases');
  const more = track?.querySelector('.push-track__more');
  const close = track?.querySelector('.push-track__close');
  if (!phases || !push || !spacer) return;
  const head = phases.querySelector('.phases__head');
  const rows = [...phases.querySelectorAll('.phase')];
  if (!head || rows.length !== 3) return;

  // share of the spacer each step takes: title, 01, 02, 03
  const STEPS = [50, 70, 70, 70];
  const TOTAL = STEPS.reduce((a, b) => a + b, 0);
  const CLOSE_REST = 50 / 170; // first share of the closing scroll: a rest on the finished phases
  const CLOSE_HOLD = 0.15;     // last share of the circle's scroll spent at rest
  const ABSORB = 0.12;        // how much the phases shrink while the circle closes

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = matchMedia('(max-width: 700px)');
  const clamp = v => Math.min(1, Math.max(0, v));
  const smooth = v => v * v * (3 - 2 * v);   // ease in and out
  const lerp = (a, b, t) => a + (b - a) * t;

  phases.classList.add('is-staged');
  track.classList.add('is-staged');   // shows the spacer

  // scroll position (page y) at which each step is complete; [0] is the start
  function points() {
    const base = track.getBoundingClientRect().top + window.scrollY + push.offsetHeight;
    const out = [base];
    let sum = 0;
    STEPS.forEach(s => { sum += s; out.push(base + spacer.offsetHeight * sum / TOTAL); });
    return out;
  }

  // A text cell's own height: padding + its children + the gaps between
  // them. (Not its box: the row stretches or squeezes that.)
  function contentH(el) {
    const cs = getComputedStyle(el);
    const kids = [...el.children];
    const gap = parseFloat(cs.rowGap) || 0;
    return parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      + kids.reduce((s, k) => s + k.offsetHeight, 0) + gap * Math.max(0, kids.length - 1);
  }

  // The height a row's text needs at a given shrink k: 0 = in focus (all
  // of it), 1 = minimised (title and the empty "resultado" box). Measured
  // by briefly setting --k, then cached until the size or fonts change.
  function textH(row, k) {
    const saved = row.style.getPropertyValue('--k');
    row.style.setProperty('--k', k);
    const main = contentH(row.querySelector('.phase__main'));
    const detail = contentH(row.querySelector('.phase__detail'));
    row.style.setProperty('--k', saved);
    return phone.matches ? main + detail : Math.max(main, detail);
  }
  let sizes = null;   // [{ open, min }] per row
  function measure() {
    sizes = rows.map(row => ({ open: textH(row, 0), min: textH(row, 1) + 2 }));
  }
  const compact = (_, i) => sizes[i].min;
  const natural = (_, i) => sizes[i].open;

  // Layout with phase j in focus: j as tall as it needs (on a phone, plus
  // room for the photo when there is enough), the other two sharing what
  // is left equally. Every layout fills the screen under the title exactly.
  // If the focused phase needs more than the screen leaves it, it still gets
  // all it needs (the others keep their minimum) and the screen scrolls on
  // at the end to show the rest (see "shift" in paint).
  function layouts(H, hHead) {
    if (!sizes) measure();
    const minSmall = Math.max(...rows.map(compact));
    const fit = H - hHead - 2 * minSmall;   // the most a focused row can take on screen
    return rows.map((row, j) => {
      const text = natural(row, j);
      let full = text;
      let photo = false;
      if (phone.matches) {
        const room = Math.min(0.3 * H, fit - text);
        if (room >= 110) { full += room; photo = true; }
      } else {
        full = Math.max(text, Math.min(fit, 420, Math.max(260, 0.36 * H)));
      }
      const small = Math.max(minSmall, (H - hHead - full) / 2);
      return { heights: rows.map((_, i) => (i === j ? full : small)), photo };
    });
  }

  function paint(now = performance.now()) {
    const H = phases.clientHeight;
    const hHead = head.offsetHeight;
    const L = layouts(H, hHead);

    // progress through each step
    const p = points();
    const y = window.scrollY;
    const e = STEPS.map((_, i) => smooth(clamp((y - p[i]) / (p[i + 1] - p[i]))));

    // the title cell's colour follows each phase as it arrives (styles.css)
    for (let i = 1; i <= 3; i++) head.style.setProperty('--e' + i, e[i].toFixed(3));

    // Choosing: once all three are in, the chosen phase is full size and the
    // others shrink. Until then (or when scrolling back) it is phase 03.
    const all = e[3] >= 0.999;
    if (!all) chosen = 2;
    if (all !== phases.classList.contains('is-choosable')) {
      phases.classList.toggle('is-choosable', all);
      rows.forEach(row => all ? row.setAttribute('tabindex', '0') : row.removeAttribute('tabindex'));
    }
    const dt = Math.min(64, now - last); last = now;
    let moving = false;
    focus.forEach((q, i) => {
      const target = i === chosen ? 1 : 0;
      focus[i] = reduce.matches ? target : q + (target - q) * (1 - Math.pow(1 - EASE, dt / 16.7));
      if (Math.abs(target - focus[i]) < 0.001) focus[i] = target; else moving = true;
    });

    // How much each phase is in focus (the three add up to 1). While rising,
    // the focus passes to each new phase as it comes in; once all are in, it
    // follows the choice. The heights are the same mix of the layouts, so
    // they always fill the screen.
    const rising = [1 - e[2], e[2] - e[3], e[3]];
    const w = rising.map((r, i) => lerp(r, focus[i], e[3]));
    const hs = rows.map((_, i) => L.reduce((s, l, j) => s + w[j] * l.heights[i], 0));

    // Taller than the screen: add that much scroll after the last step, and
    // move everything up with it so the rest of the open phase can be read.
    // (a few px over is only bottom padding: not worth any scroll)
    let extra = Math.max(0, Math.round(hHead + hs.reduce((a, b) => a + b, 0) - H));
    if (extra <= 6) extra = 0;
    if (more && Math.abs(more.offsetHeight - extra) > 1) more.style.height = extra + 'px';
    const shift = Math.min(extra, Math.max(0, y - p[4]));
    head.style.setProperty('--y', (lerp(H, 0, e[0]) - shift).toFixed(1) + 'px');

    let settled = hHead;   // where each row settles: right under the one above
    rows.forEach((row, i) => {
      row.style.setProperty('--y', (lerp(H, settled, e[i + 1]) - shift).toFixed(1) + 'px');
      row.style.setProperty('--h', hs[i].toFixed(1) + 'px');
      row.style.setProperty('--k', (1 - w[i]).toFixed(3));
      row.classList.toggle('no-media', !L[i].photo && phone.matches);
      settled += hs[i];
    });

    // Closing: once the phases fill the screen the closing slide can sit
    // behind them; past the extra scroll and a rest, the circle closes on them.
    track.classList.toggle('is-closing', y >= p[4] - 1);
    const rest = close ? close.offsetHeight * CLOSE_REST : 0;
    const c0 = p[4] + extra + rest;
    const tc = close ? clamp((y - c0) / ((close.offsetHeight - rest) * (1 - CLOSE_HOLD))) : 0;
    if (tc <= 0) {
      phases.style.clipPath = '';
      phases.style.transform = '';
    } else {
      const full = Math.hypot(phases.clientWidth / 2, H / 2) + 2;   // centre to corner
      phases.style.clipPath = `circle(${((1 - tc) * full).toFixed(1)}px at 50% 50%)`;
      phases.style.transform = `scale(${(1 - ABSORB * smooth(tc)).toFixed(4)})`;
    }
    if (moving) schedule();
  }

  // ---- choosing a phase ----
  const EASE = 0.14;         // how quickly a choice opens, per frame at 60fps
  let chosen = 2;            // phase 03 is in focus when the three arrive
  const focus = [0, 0, 1];   // how much each phase is in focus while choosing
  let last = performance.now();

  function choose(i) {
    if (!phases.classList.contains('is-choosable') || chosen === i) return;
    chosen = i;
    last = performance.now();
    schedule();
  }
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  rows.forEach((row, i) => {
    row.addEventListener('pointerenter', () => { if (canHover.matches) choose(i); });
    row.addEventListener('click', () => choose(i));
    row.addEventListener('focus', () => choose(i));
  });

  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(now => { raf = 0; paint(now); }); };
  const remeasure = () => { sizes = null; schedule(); };
  paint();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  document.fonts?.ready.then(remeasure);
})();
