/*
  Second hero: one sentence pushes the other. The hero is pinned while you
  scroll through .push-track__push. Sentence B rises from just below the
  screen, linearly with the scroll. Sentence A stays in the middle of the
  screen until B reaches it, then is pushed up ahead of B, keeping the same
  gap. They end as a pair, centred together on the screen.
  Everything is computed from the scroll position, so scrolling up reverses
  it exactly.
*/
(() => {
  const track = document.querySelector('.push-track');
  if (!track) return;
  const hero = track.querySelector('.hero');
  const push = track.querySelector('.push-track__push');
  const a = hero.querySelector('.hero__stage--a');
  const b = hero.querySelector('.hero__stage--b');
  if (!push || !a || !b) return;

  // The spacer is 160svh: the push takes the first 85svh, the rest is a
  // pause with both sentences on screen before the phases start to rise.
  const HOLD = 1 - 85 / 160;   // last share of the push distance spent at rest
  const clamp = v => Math.min(1, Math.max(0, v));

  hero.classList.add('is-pushing');
  track.classList.add('is-pushing');   // shows the push spacer

  function update() {
    const H = hero.clientHeight;
    const hA = a.offsetHeight, hB = b.offsetHeight;
    const scrolled = -track.getBoundingClientRect().top;
    const t = clamp(scrolled / (push.offsetHeight * (1 - HOLD)));

    // The gap between the two at the end: about half a sentence's height, so
    // they read as one pair, centred together on the screen. On a wide screen,
    // where the sentences are tall, it is capped so each keeps its own half.
    const gap = Math.max(Math.min(0.6 * Math.max(hA, hB), H / 2 - (hA + hB) / 2), H * 0.03);
    const bFrom = H;                                  // just below the screen
    const bTo = H / 2 - (hA + gap + hB) / 2 + hA + gap; // the pair centred
    const bTop = bFrom + (bTo - bFrom) * t;
    const aTop = Math.min(H / 2 - hA / 2, bTop - gap - hA);

    a.style.setProperty('--top', aTop.toFixed(1) + 'px');
    b.style.setProperty('--top', bTop.toFixed(1) + 'px');
  }

  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
  update();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  document.fonts?.ready.then(schedule);   // fit.js resizes the words once fonts load
})();
