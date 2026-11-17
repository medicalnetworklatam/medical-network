/*
  Palette switcher (for choosing colours): each press of the menu button
  shows the page in the next palette. Palettes are defined in styles.css
  as :root[data-palette="…"]; "negativo" is the default (no attribute).
  The choice is remembered in this browser only.
*/
(() => {
  const PALETTES = [
    { id: 'negativo', name: 'Negativo' },
    { id: 'bello',    name: 'Bello' },
    { id: 'impasto',  name: 'Impasto' },
    { id: 'mnl',      name: 'MNL actual' },
    { id: 'flatline', name: 'Flatline' },
  ];
  const KEY = 'mnl-palette';
  const root = document.documentElement;
  const btn = document.querySelector('.menu-btn');
  const note = document.getElementById('palette-note');
  if (!btn) return;

  let i = 0;
  try { i = Math.max(0, PALETTES.findIndex(p => p.id === localStorage.getItem(KEY))); } catch (e) {}

  let hide = 0;
  function apply(showNote) {
    const p = PALETTES[i];
    if (p.id === 'negativo') root.removeAttribute('data-palette');
    else root.setAttribute('data-palette', p.id);
    try { localStorage.setItem(KEY, p.id); } catch (e) {}
    if (note && showNote) {
      note.textContent = `Paleta ${i + 1}/${PALETTES.length} · ${p.name}`;
      note.classList.add('is-shown');
      clearTimeout(hide);
      hide = setTimeout(() => note.classList.remove('is-shown'), 2200);
    }
  }

  apply(false);
  btn.addEventListener('click', () => { i = (i + 1) % PALETTES.length; apply(true); });
})();
