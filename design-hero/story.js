/*
  Mi historia: one pinned screen in which the "now" layout (hoy, después)
  fades in on top of "then" (bio, mis inicios, antes) as you scroll, from a
  faint blur to fully clear.

  Each layout has a rest zone (--story-hold of scroll) where nothing
  changes: "then" stays put for a while after it fills the screen, and
  "now" stays put for a while before the section moves on. So a casual
  scroll while reading does not tip you into the next one.

  No snapping (owner's choice): the page rests wherever you stop, even half
  way through the fade. It follows the scroll both ways.
*/
(() => {
  const story = document.querySelector('.story');
  const pin = story?.querySelector('.story__pin');
  if (!story || !pin) return;

  // the fade runs from a ("then" fully shown, after its rest) to b ("now"
  // fully clear, before its rest)
  function points() {
    const top = story.getBoundingClientRect().top + window.scrollY;
    const extra = story.offsetHeight - pin.offsetHeight;   // 2 rests + the fade
    const cs = getComputedStyle(story);
    const H = parseFloat(cs.getPropertyValue('--story-hold'));
    const F = parseFloat(cs.getPropertyValue('--story-fade'));
    const hold = extra * H / (2 * H + F);
    return [top + hold, top + extra - hold];
  }

  function paint() {
    const [a, b] = points();
    const f = Math.min(1, Math.max(0, (window.scrollY - a) / (b - a)));
    story.style.setProperty('--f', f.toFixed(3));
    story.classList.toggle('is-now', f > 0.5);
  }
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
  paint();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
})();
