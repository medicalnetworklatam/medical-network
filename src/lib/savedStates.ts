/* The states the user chose on the map, kept in this browser only
   (localStorage "mn_estados"): [{ id: "by", name: "Bayern" }, ...] in the
   order picked. An empty list means "No lo sé".

   Later this will be saved to the user's account instead (Supabase); only
   this file should need to change. */

export interface SavedState {
  id: string;
  name: string;
}

const KEY = 'mn_estados';

export function saveChosenStates(list: SavedState[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage blocked (e.g. private mode): nothing to do */
  }
}

/** The saved list, or null when nothing (valid) was saved yet. */
export function loadChosenStates(): SavedState[] | null {
  let saved: unknown = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
  if (!Array.isArray(saved)) return null;
  return saved.filter(
    (st): st is SavedState =>
      !!st && typeof st.id === 'string' && typeof st.name === 'string',
  );
}
