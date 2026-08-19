import type { Station, StationList, StationListEntry } from '../api/types.ts';
import { idbGet, idbSet } from './idb.ts';

const CUSTOM_STATIONS_KEY = 'worldradio:custom-stations';
const C895_SEEDED_KEY = 'worldradio:c895-seeded';
const STORAGE_KEY = 'worldradio:lists';
const SEEDED_KEY = 'worldradio:lists-seeded';

const C895_STATION: Station = {
  stationuuid: 'custom:c895-seattle',
  name: 'C89.5 FM — Seattle',
  url: 'https://knhc-ice.streamguys1.com/live',
  url_resolved: 'https://knhc-ice.streamguys1.com/live',
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

/**
 * Streams whose http:// URL we've since confirmed also work over https:// on the same
 * origin (verified directly against each server). Browsers silently auto-upgrade
 * http:// media requests to https:// on an https:// page — if that upgrade has nowhere
 * to land, the request just hangs instead of failing cleanly, so a plain http:// URL for
 * these known stations never plays once this app is served over HTTPS (which it always
 * is in production). Storing the corrected URL as the source of truth isn't enough on
 * its own, since returning users already have the old URL persisted locally — so this
 * patches it in place the next time their custom stations load.
 */
const KNOWN_URL_FIXES: Record<string, string> = {
  'custom:c895-seattle': 'https://knhc-ice.streamguys1.com/live',
  '53ef1268-a1f2-4d6f-beaf-6cec98b8fac8': 'https://stream.ruc.pt/high', // RUC Rádio Universidade de Coimbra
  'fdf3592c-3b29-45df-b052-80c7cfcbd3fc': 'https://noasrv.caster.fm:10182/live', // 90.9 Ibero
  '61d90ec1-615e-489b-a175-110076596a3b': 'https://stream2.wfmu.org/freeform-128k', // WFMU
  'ceef0758-99d1-481b-9170-57edec58c7bd': 'https://stream.rcs.revma.com/2v1zz979n98uv', // Radio FG at work
};

function applyKnownUrlFixes(stations: Station[]): { stations: Station[]; changed: boolean } {
  let changed = false;
  const fixed = stations.map((s) => {
    const fix = KNOWN_URL_FIXES[s.stationuuid];
    if (!fix || (s.url === fix && s.url_resolved === fix)) return s;
    changed = true;
    return { ...s, url: fix, url_resolved: fix };
  });
  return { stations: fixed, changed };
}

export async function loadCustomStations(): Promise<Station[]> {
  await migrateFromLocalStorage();
  try {
    const parsed = await idbGet<Station[]>(CUSTOM_STATIONS_KEY);
    if (Array.isArray(parsed)) {
      const { stations, changed } = applyKnownUrlFixes(parsed);
      if (changed) await saveCustomStations(stations);
      return stations;
    }
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
