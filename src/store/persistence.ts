import type { Station, StationList, StationListEntry } from '../api/types.ts';

const CUSTOM_STATIONS_KEY = 'worldradio:custom-stations';
const C895_SEEDED_KEY = 'worldradio:c895-seeded';

const C895_STATION: Station = {
  stationuuid: 'custom:c895-seattle',
  name: 'C89.5 FM — Seattle',
  url: 'https://c895.streamguys1.com/c895-live-mp3-128',
  url_resolved: 'https://c895.streamguys1.com/c895-live-mp3-128',
  homepage: 'https://www.c895.org',
  favicon: 'https://www.c895.org/wp-content/themes/c895/img/favicon.png',
  country: 'United States of America',
  countrycode: 'US',
  state: 'Washington',
  city: 'Seattle',
  language: 'english',
  tags: 'pop,top 40,hits,alternative',
  codec: 'MP3',
  bitrate: 128,
  hls: 0,
  lastcheckok: 1,
  clickcount: 0, clicktrend: 0, votes: 0,
  geo_lat: 47.6062,
  geo_long: -122.3321,
};

export function loadCustomStations(): Station[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Station[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore corrupt data */ }
  return [];
}

export function saveCustomStations(stations: Station[]): void {
  try {
    localStorage.setItem(CUSTOM_STATIONS_KEY, JSON.stringify(stations));
  } catch { /* quota exceeded — silently fail */ }
}

export function seedC895(existingCustom: Station[]): Station[] | null {
  try { if (localStorage.getItem(C895_SEEDED_KEY)) return null; } catch { /* proceed */ }
  if (existingCustom.some(s => s.stationuuid === 'custom:c895-seattle')) return null;
  try { localStorage.setItem(C895_SEEDED_KEY, '1'); } catch { /* proceed */ }
  return [C895_STATION, ...existingCustom];
}

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
