import type { StationList } from '../api/types.ts';

const STORAGE_KEY = 'worldradio:lists';

export function loadLists(): StationList[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StationList[];
      if (Array.isArray(parsed)) return ensureFavorites(parsed);
    }
  } catch { /* ignore corrupt data */ }
  return ensureFavorites([]);
}

export function saveLists(lists: StationList[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // localStorage quota exceeded — silently fail
  }
}

function ensureFavorites(lists: StationList[]): StationList[] {
  if (!lists.find(l => l.id === 'favorites')) {
    lists.unshift({
      id: 'favorites',
      label: 'Favorites',
      type: 'favorites',
      entries: [],
    });
  }
  return lists;
}
