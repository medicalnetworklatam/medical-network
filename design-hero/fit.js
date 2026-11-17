/*
  Justified headline: every line of .hero__words is sized on its own so all
  lines start and end at exactly the same x. Sizes are measured on the
  letters' ink (not the font's side bearings), so edges line up optically.
  Both copies of the words (ink + tinted overlay) get identical values.
  Runs for every hero on the page. Stages in the same hero share one width
  (the narrowest any of them allows), so stacked sentences line up too.
*/
const limits = new Map();   // stage -> function giving its widest allowed W
document.querySelectorAll('.hero__stage').forEach(stage => {
  const layers = [...stage.querySelectorAll('.hero__words')];
  const hero = stage.closest('.hero, .cta');
  const ctx = document.createElement('canvas').getContext('2d');

  const GAP = 0.3;      // space between lines, as a share of the smallest cap height
  const MAX_W = 1400;   // never wider than this (px)

  // wrap each line's text once so it can be positioned on its ink
  layers.forEach(layer => layer.querySelectorAll('.line').forEach(line => {
    if (!line.querySelector('.line__ink')) {
      const ink = document.createElement('span');
      ink.className = 'line__ink';
      ink.textContent = line.textContent.trim();
      line.replaceChildren(ink);
    }
  }));

  function measure() {
    const cs = getComputedStyle(layers[0]);
    ctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;

    return [...layers[0].querySelectorAll('.line')].map(l => {
      const m = ctx.measureText(l.textContent.trim().toUpperCase());
      const A = (m.fontBoundingBoxAscent ?? 92) / 100;
      const D = (m.fontBoundingBoxDescent ?? 24) / 100;
      return {
        ink: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, // ink width at 100px
        left: m.actualBoundingBoxLeft,                          // ink start offset at 100px
        cap: m.actualBoundingBoxAscent / 100,                   // cap height per px of size
        base: (1 - A - D) / 2 + A,                              // baseline from top, line-height 1
      };
    });
  }

  // the widest this stage may be: the hero's width, its share of the height, MAX_W
  function limit() {
    const lines = measure();
    // height of the whole block per 1px of width
    const caps = lines.map(l => l.cap * 100 / l.ink);
    const k = caps.reduce((a, b) => a + b, 0) + GAP * Math.min(...caps) * (lines.length - 1);

    const pad = parseFloat(getComputedStyle(hero).paddingLeft) * 2;
    const availW = hero.clientWidth - pad;
    // data-fit-h: the share of the screen's height this stage may take
    const share = parseFloat(stage.dataset.fitH) || 1;
    const availH = (window.innerHeight - 240) * share;
    return Math.min(availW, availH / k, MAX_W);
  }
  limits.set(stage, limit);

  function fit() {
    const lines = measure();
    const caps = lines.map(l => l.cap * 100 / l.ink);
    const siblings = [...hero.querySelectorAll('.hero__stage')].map(s => limits.get(s)).filter(Boolean);
    const W = Math.max(200, Math.min(...siblings.map(f => f())));

    stage.style.setProperty('--stage-w', W + 'px');
    const gap = GAP * Math.min(...caps) * W;

    layers.forEach(layer => {
      layer.style.setProperty('--gap', gap + 'px');
      layer.querySelectorAll('.line').forEach((el, i) => {
        const l = lines[i];
        const s = 100 * W / l.ink;
        el.style.setProperty('--s', s + 'px');
        el.style.setProperty('--h', l.cap * s + 'px');
        el.style.setProperty('--x', (l.left / 100) * s + 'px');
        el.style.setProperty('--y', -(l.base - l.cap) * s + 'px');
      });
      layer.classList.add('is-fitted');
    });
  }

  let raf = 0;
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
  fit();
  schedule();   // again next frame, once every stage in the hero is known
  document.fonts?.ready.then(schedule);
  document.fonts?.addEventListener?.('loadingdone', schedule);
  window.addEventListener('resize', schedule);
});
