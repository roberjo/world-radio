import type { Station } from './types.ts';

/**
 * Radio Browser asks clients to discover mirrors at runtime rather than hardcode them —
 * mirrors come and go (nl1/at1 stopped resolving entirely, and de2 became a DNS alias of
 * de1). `all.api.radio-browser.info` round-robins across whatever is live and its
 * /json/servers endpoint lists the current mirrors, CORS-enabled.
 */
const DISCOVERY_URL = 'https://all.api.radio-browser.info/json/servers';
const FALLBACK_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://all.api.radio-browser.info',
];
const DISCOVERY_TIMEOUT_MS = 5000;
const REQUEST_TIMEOUT_MS = 20000;

/** Thrown when every mirror failed — distinct from a successful "no results" answer. */
export class RadioApiUnavailableError extends Error {
  constructor() {
    super('All radio API servers failed');
    this.name = 'RadioApiUnavailableError';
  }
}

let serversPromise: Promise<string[]> | null = null;
/** Last server that answered successfully — tried first on the next request. */
let preferredServer: string | null = null;

async function discoverServers(): Promise<string[]> {
  try {
    const res = await fetch(DISCOVERY_URL, { signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json() as { name: string }[];
    const names = [...new Set(list.map(s => s.name).filter(Boolean))]
      .map(name => `https://${name}`);
    // Shuffle to spread load, then append fallbacks so they're always tried last.
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [names[i], names[j]] = [names[j], names[i]];
    }
    return [...new Set([...names, ...FALLBACK_SERVERS])];
  } catch {
    return [...FALLBACK_SERVERS];
  }
}

function getServers(): Promise<string[]> {
  serversPromise ??= discoverServers();
  return serversPromise;
}

async function orderedServers(): Promise<string[]> {
  const servers = await getServers();
  if (!preferredServer) return servers;
  return [preferredServer, ...servers.filter(s => s !== preferredServer)];
}

/** Try each known mirror once, in order. Per-request iteration, so concurrent calls
 *  can't knock each other onto a bad server. */
async function apiFetch<T>(path: string): Promise<T> {
  for (const server of await orderedServers()) {
    try {
      const res = await fetch(`${server}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as T;
      preferredServer = server;
      return data;
    } catch {
      if (preferredServer === server) preferredServer = null;
    }
  }
  throw new RadioApiUnavailableError();
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

/** Resolves to null when the station doesn't exist; rejects with
 *  RadioApiUnavailableError when no mirror could be reached. */
export async function fetchStationByUUID(uuid: string): Promise<Station | null> {
  const results = await apiFetch<Station[]>(`/json/stations/byuuid/${encodeURIComponent(uuid)}`);
  return results.length > 0 ? results[0] : null;
}

/** Max UUIDs per byuuid request — keeps the query string comfortably under URL limits. */
const UUID_BATCH_SIZE = 100;

/** Look up many stations in as few requests as possible. Unknown UUIDs are simply
 *  absent from the result; rejects with RadioApiUnavailableError when no mirror
 *  could be reached. */
export async function fetchStationsByUUIDs(uuids: string[]): Promise<Station[]> {
  const batches: string[][] = [];
  for (let i = 0; i < uuids.length; i += UUID_BATCH_SIZE) {
    batches.push(uuids.slice(i, i + UUID_BATCH_SIZE));
  }
  const results = await Promise.all(batches.map(batch =>
    apiFetch<Station[]>(`/json/stations/byuuid?uuids=${batch.map(encodeURIComponent).join(',')}`)
  ));
  return results.flat();
}

export function registerClick(stationuuid: string): void {
  void orderedServers().then(([server]) =>
    fetch(`${server}/json/url/${encodeURIComponent(stationuuid)}`, { method: 'POST' })
  ).catch(() => {});
}
