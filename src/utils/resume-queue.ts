import { store } from '../store/store.ts';
import { idbGet, idbSet } from '../store/idb.ts';
import type { Station, StationListEntry } from '../api/types.ts';

const QUEUE_KEY = 'worldradio:resume-queue';
const MAX_ENTRIES = 5;
const RESUME_LIST_ID = 'recent-played';

let queue: StationListEntry[] = [];

function entryFromStation(s: Station): StationListEntry {
  return { stationuuid: s.stationuuid, name: s.name, country: s.country, favicon: s.favicon };
}

function syncListsStore(): void {
  const lists = store.get('stationLists');
  const idx = lists.findIndex(l => l.id === RESUME_LIST_ID);
  if (queue.length === 0) {
    if (idx >= 0) store.set('stationLists', lists.filter(l => l.id !== RESUME_LIST_ID));
    return;
  }
  const list = { id: RESUME_LIST_ID, label: 'Recently Played', type: 'custom' as const, entries: queue };
  if (idx >= 0) {
    const updated = [...lists];
    updated[idx] = list;
    store.set('stationLists', updated);
  } else {
    store.set('stationLists', [...lists, list]);
  }
}

async function persist(): Promise<void> {
  try {
    await idbSet(QUEUE_KEY, queue);
  } catch { /* storage unavailable — resume history just won't survive reload */ }
}

function recordPlay(station: Station): void {
  const entry = entryFromStation(station);
  queue = [entry, ...queue.filter(e => e.stationuuid !== station.stationuuid)].slice(0, MAX_ENTRIES);
  syncListsStore();
  persist();
}

/** Tracks the last few stations that genuinely played (real 'isPlaying' transitions,
 *  same signal health-check.ts and listening-stats.ts use) as a "Recently Played" list
 *  in the Custom tab, so a listener can pick up where they left off across sessions. */
export async function initResumeQueue(): Promise<void> {
  try {
    const saved = await idbGet<StationListEntry[]>(QUEUE_KEY);
    if (Array.isArray(saved)) queue = saved;
  } catch { /* start fresh */ }
  syncListsStore();

  let lastCounted: string | null = null;
  store.subscribe('isPlaying', (playing) => {
    if (!playing) return;
    const station = store.get('currentStation');
    if (!station || station.stationuuid === lastCounted) return;
    lastCounted = station.stationuuid;
    recordPlay(station);
  });
}
