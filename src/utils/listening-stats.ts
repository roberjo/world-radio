import { store } from '../store/store.ts';
import { idbGet, idbSet } from '../store/idb.ts';

const COUNTRIES_KEY = 'worldradio:stats-countries';
const PLAYS_KEY = 'worldradio:stats-plays';

let countries = new Set<string>();
let plays = 0;
let loaded = false;
const listeners = new Set<() => void>();

export function onStatsChange(cb: () => void): void {
  listeners.add(cb);
}

function notify(): void {
  listeners.forEach(cb => cb());
}

export interface ListeningStats {
  countries: number;
  plays: number;
}

export function getStats(): ListeningStats {
  return { countries: countries.size, plays };
}

async function persist(): Promise<void> {
  try {
    await idbSet(COUNTRIES_KEY, [...countries]);
    await idbSet(PLAYS_KEY, plays);
  } catch { /* storage unavailable — stats just won't persist across reloads */ }
}

function recordPlay(country: string): void {
  plays += 1;
  const trimmed = country.trim();
  if (trimmed) countries.add(trimmed);
  notify();
  persist();
}

function renderStatsDisplay(): void {
  const el = document.getElementById('listening-stats');
  if (!el) return;
  if (plays === 0) {
    el.innerHTML = '';
    return;
  }
  const countryLabel = countries.size === 1 ? 'country' : 'countries';
  const playLabel = plays === 1 ? 'station' : 'stations';
  el.innerHTML = `<span>🌍 <strong>${countries.size}</strong> ${countryLabel} explored</span><span><strong>${plays}</strong> ${playLabel} played</span>`;
}

/** Loads persisted stats, then starts recording real plays (the store's 'isPlaying'
 *  transition to true — the same "it actually started" signal used by health-check.ts). */
export async function initListeningStats(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const savedCountries = await idbGet<string[]>(COUNTRIES_KEY);
    if (Array.isArray(savedCountries)) countries = new Set(savedCountries);
    const savedPlays = await idbGet<number>(PLAYS_KEY);
    if (typeof savedPlays === 'number') plays = savedPlays;
  } catch { /* start fresh */ }
  onStatsChange(renderStatsDisplay);
  renderStatsDisplay();

  let lastCountedStation: string | null = null;
  store.subscribe('isPlaying', (playing) => {
    if (!playing) return;
    const station = store.get('currentStation');
    if (!station || station.stationuuid === lastCountedStation) return;
    lastCountedStation = station.stationuuid;
    recordPlay(station.country);
  });
}
