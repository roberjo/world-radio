import type { Station, StationList, StationListEntry } from '../api/types.ts';
import { idbGet, idbSet } from './idb.ts';

const CUSTOM_STATIONS_KEY = 'worldradio:custom-stations';
const C895_SEEDED_KEY = 'worldradio:c895-seeded';
const STORAGE_KEY = 'worldradio:lists';
const SEEDED_KEY = 'worldradio:lists-seeded';

const C895_STATION: Station = {
  stationuuid: 'custom:c895-seattle',
  name: 'C89.5 FM — Seattle',
  url: 'http://knhc-ice.streamguys1.com:8080/live',
  url_resolved: 'http://knhc-ice.streamguys1.com:8080/live',
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

// One-time move of existing localStorage data into IndexedDB, so returning users keep
// their lists and custom stations after the storage backend switch.
let migrated: Promise<void> | null = null;
function migrateFromLocalStorage(): Promise<void> {
  if (!migrated) {
    migrated = (async () => {
      for (const key of [CUSTOM_STATIONS_KEY, C895_SEEDED_KEY, STORAGE_KEY, SEEDED_KEY]) {
        try {
          const raw = localStorage.getItem(key);
          if (raw === null) continue;
          if ((await idbGet(key)) !== undefined) { localStorage.removeItem(key); continue; }
          let value: unknown;
          try { value = JSON.parse(raw); } catch { value = raw; }
          await idbSet(key, value);
          localStorage.removeItem(key);
        } catch { /* leave localStorage untouched — will retry next load */ }
      }
    })();
  }
  return migrated;
}

export async function loadCustomStations(): Promise<Station[]> {
  await migrateFromLocalStorage();
  try {
    const parsed = await idbGet<Station[]>(CUSTOM_STATIONS_KEY);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* ignore corrupt data */ }
  return [];
}

export async function saveCustomStations(stations: Station[]): Promise<void> {
  try {
    await idbSet(CUSTOM_STATIONS_KEY, stations);
  } catch { /* storage unavailable — silently fail */ }
}

export async function seedC895(existingCustom: Station[]): Promise<Station[] | null> {
  await migrateFromLocalStorage();
  try { if (await idbGet(C895_SEEDED_KEY)) return null; } catch { /* proceed */ }
  if (existingCustom.some(s => s.stationuuid === 'custom:c895-seattle')) return null;
  try { await idbSet(C895_SEEDED_KEY, true); } catch { /* proceed */ }
  return [C895_STATION, ...existingCustom];
}

export async function loadLists(): Promise<StationList[]> {
  await migrateFromLocalStorage();
  try {
    const parsed = await idbGet<StationList[]>(STORAGE_KEY);
    if (Array.isArray(parsed)) return ensureFavorites(parsed);
  } catch { /* ignore corrupt data */ }
  return ensureFavorites([]);
}

export async function saveLists(lists: StationList[]): Promise<void> {
  try {
    await idbSet(STORAGE_KEY, lists);
  } catch { /* storage unavailable — silently fail */ }
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
export async function seedDefaultLists(stations: Station[], existingLists: StationList[]): Promise<StationList[] | null> {
  // Only seed once — if user clears lists they stay cleared
  await migrateFromLocalStorage();
  try {
    if (await idbGet(SEEDED_KEY)) return null;
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
    await idbSet(SEEDED_KEY, true);
  } catch { /* proceed */ }

  return [...existingLists, ...newLists];
}
