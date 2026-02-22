import type { Station, StationList, StationListEntry } from '../api/types.ts';

const STORAGE_KEY = 'worldradio:lists';
const SEEDED_KEY = 'worldradio:lists-seeded';

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

/** Genres to create default lists for, mapped to tag substrings to match */
const DEFAULT_GENRES: [string, string[]][] = [
  ['Jazz',        ['jazz']],
  ['Classical',   ['classical', 'classic']],
  ['Rock',        ['rock']],
  ['Pop',         ['pop']],
  ['Electronic',  ['electronic', 'techno', 'house', 'trance', 'edm']],
  ['Hip Hop',     ['hip hop', 'hiphop', 'hip-hop', 'rap']],
  ['Blues',       ['blues']],
  ['Country',     ['country']],
  ['Reggae',      ['reggae']],
  ['Latin',       ['latin', 'salsa', 'cumbia', 'reggaeton']],
  ['Ambient',     ['ambient', 'chillout', 'chill']],
  ['World Music', ['world', 'folk', 'african', 'celtic']],
  ['News',        ['news', 'talk', 'information', 'public radio']],
];

/** Countries to create default lists for (by country name, to match station.country) */
const DEFAULT_COUNTRIES = [
  'United States of America',
  'United Kingdom',
  'Germany',
  'France',
  'Brazil',
  'Japan',
  'Australia',
  'Canada',
  'Mexico',
  'India',
  'Spain',
  'Italy',
  'Netherlands',
  'Argentina',
  'South Korea',
];

const MAX_PER_LIST = 20;

function stationToEntry(s: Station): StationListEntry {
  return {
    stationuuid: s.stationuuid,
    name: s.name,
    country: s.country,
    favicon: s.favicon,
  };
}

/** Build default genre and country lists from the loaded station set. Only runs once. */
export function seedDefaultLists(stations: Station[], existingLists: StationList[]): StationList[] | null {
  // Only seed once — if user clears lists they stay cleared
  try {
    if (localStorage.getItem(SEEDED_KEY)) return null;
  } catch { /* proceed */ }

  // Stations sorted by popularity (already mostly sorted, but be safe)
  const sorted = [...stations].sort((a, b) => b.clickcount - a.clickcount);

  const newLists: StationList[] = [];

  // Genre lists
  for (const [label, tags] of DEFAULT_GENRES) {
    const matches = sorted.filter(s => {
      const stationTags = s.tags.toLowerCase();
      return tags.some(t => stationTags.includes(t));
    });
    if (matches.length < 3) continue; // skip if too few stations
    newLists.push({
      id: `genre:${label.toLowerCase().replace(/\s+/g, '-')}`,
      label,
      type: 'genre',
      entries: matches.slice(0, MAX_PER_LIST).map(stationToEntry),
    });
  }

  // Country lists
  for (const countryName of DEFAULT_COUNTRIES) {
    const matches = sorted.filter(s => s.country === countryName);
    if (matches.length < 3) continue;
    // Use a short label
    const shortLabel = countryName
      .replace('United States of America', 'USA')
      .replace('United Kingdom', 'UK')
      .replace('South Korea', 'S. Korea');
    newLists.push({
      id: `country:${shortLabel.toLowerCase().replace(/[\s.]+/g, '-')}`,
      label: shortLabel,
      type: 'country',
      entries: matches.slice(0, MAX_PER_LIST).map(stationToEntry),
    });
  }

  try {
    localStorage.setItem(SEEDED_KEY, '1');
  } catch { /* proceed */ }

  return [...existingLists, ...newLists];
}
