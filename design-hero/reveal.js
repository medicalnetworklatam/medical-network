/*
  Circle transitions on pinned tracks. Each .hero-track pins its hero while
  you scroll through its .hero-track__grow spacer, and a circle centred on
  the screen changes size with the scroll.

  .intro  (first track): the circle grows with the scroll and shows only the
          title, centred. Once the whole title fits inside, the section
          "opens": the circle widens to full screen, the title glides to its
          place and the rest fades in. Scrolling back up runs the same
          motion in reverse, following the scroll.
*/
(() => {
  const HOLD = 0.15;     // last share of each grow distance spent at rest
  const BACK = 0.22;     // how far below the opening point the reverse finishes (share of the grow)
  const EASE = 0.11;     // how quickly the opening catches up with its target, per frame at 60fps

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const circles = [];
  document.querySelectorAll('.hero-track').forEach(track => {
    const grow = track.querySelector('.hero-track__grow');
    const opener = track.querySelector('.intro');
    if (grow && opener) circles.push({ track, grow, el: opener,
      title: opener.querySelector('.intro__title'), open: false, q: 0, tMax: 0 });
  });
  if (!circles.length) return;

  const clamp = v => Math.min(1, Math.max(0, v));
  const smooth = v => v * v * (3 - 2 * v);   // ease in and out

  let first = true, last = performance.now();

  function update(now = performance.now()) {
    const w = window.innerWidth, h = window.innerHeight;
    const full = Math.hypot(w / 2, h / 2) + 2;   // centre-to-corner distance
    const dt = Math.min(64, now - last); last = now;
    let moving = false;

    circles.forEach(c => {
      const { track, grow, el } = c;
      const scrolled = -track.getBoundingClientRect().top;
      const t = clamp(scrolled / (grow.offsetHeight * (1 - HOLD)));
      const top = el.getBoundingClientRect().top;
      const cy = h / 2 - top;

      const title = c.title;
      const need = title ? Math.hypot(title.offsetWidth / 2, title.offsetHeight / 2) * 1.1 : 0;
      const tOpen = Math.min(1, need / full);     // scroll point where the title fits
      const back = Math.min(BACK, tOpen * 0.6);

      // where the opening should be heading
      if (!c.open && t >= tOpen) { c.open = true; c.tMax = t; }
      let target = 0;
      if (c.open) {
        // Once open, the motion is spread over all the scroll from the furthest
        // point reached (tMax) back to a little before the opening point, so
        // scrolling up undoes it gradually from the very first pixel.
        c.tMax = Math.max(c.tMax, t);
        const from = tOpen - back;
        target = clamp((t - from) / Math.max(c.tMax - from, 1e-3));
      }

      // ease q toward the target (instant on first paint or with reduced motion)
      if (first || reduce.matches) c.q = target;
      else c.q += (target - c.q) * (1 - Math.pow(1 - EASE, dt / 16.7));
      if (Math.abs(target - c.q) < 0.001) c.q = target; else moving = true;
      if (c.open && c.q === 0 && t < tOpen) { c.open = false; c.tMax = 0; }

      const e = smooth(c.q);
      const r = t * full + (full - t * full) * e;
      setCircle(el, r, full, cy);

      if (title) {
        const dx = w / 2 - (title.offsetLeft + title.offsetWidth / 2);
        const dy = cy - (title.offsetTop + title.offsetHeight / 2);
        title.style.setProperty('--tx', (dx * (1 - e)).toFixed(1) + 'px');
        title.style.setProperty('--ty', (dy * (1 - e)).toFixed(1) + 'px');
      }
      el.style.setProperty('--o', clamp((e - 0.5) / 0.5).toFixed(3));   // rest fades in on the second half
    });

    first = false;
    if (moving) schedule();
  }

  function setCircle(el, r, full, cy) {
    if (r >= full - 0.5) { el.style.clipPath = 'none'; return; }   // fully covering: no clipping
    el.style.clipPath = '';
    el.style.setProperty('--r', Math.max(0, r).toFixed(1) + 'px');
    el.style.setProperty('--cy', cy.toFixed(1) + 'px');
  }

  let raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(now => { raf = 0; update(now); }); }
  update();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);   // images can change the layout
})();
