import type { Station } from './types.ts';

const API_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];

let currentServerIndex = 0;

function getServer(): string {
  return API_SERVERS[currentServerIndex];
}

function nextServer(): void {
  currentServerIndex = (currentServerIndex + 1) % API_SERVERS.length;
}

async function apiFetch<T>(path: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${getServer()}${path}`, {
        headers: { 'User-Agent': 'WorldRadio/1.0' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json() as T;
    } catch {
      nextServer();
      if (i === retries - 1) throw new Error('All radio API servers failed');
    }
  }
  throw new Error('All radio API servers failed');
}

export async function fetchTopStations(limit = 5000): Promise<Station[]> {
  return apiFetch<Station[]>(
    `/json/stations/search?has_geo_info=true&hidebroken=true&lastcheckok=1&order=clickcount&reverse=true&limit=${limit}`
  );
}

export async function fetchStationsByCountry(countrycode: string, limit = 200): Promise<Station[]> {
  return apiFetch<Station[]>(
    `/json/stations/search?has_geo_info=true&hidebroken=true&lastcheckok=1&countrycode=${encodeURIComponent(countrycode)}&order=clickcount&reverse=true&limit=${limit}`
  );
}

export function registerClick(stationuuid: string): void {
  fetch(`${getServer()}/json/url/${stationuuid}`, { method: 'POST' }).catch(() => {});
}
