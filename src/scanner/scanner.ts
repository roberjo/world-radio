import { store } from '../store/store.ts';
import { audioPlayer } from '../player/audio.ts';
import { flyToStation } from '../map/map.ts';
import { REGIONS, REGION_KEYS } from '../utils/geo.ts';
import type { Station } from '../api/types.ts';

let scanTimer: ReturnType<typeof setTimeout> | null = null;
let scanQueue: Station[] = [];
let scanIndex = 0;

const SCAN_INTERVAL = 12000; // 12 seconds per station

function buildScanQueue(): void {
  const stations = Array.from(store.get('stations').values());
  const region = store.get('scannerRegion');

  let filtered: Station[];
  if (region === 'all') {
    filtered = stations;
  } else {
    const bounds = REGIONS[region]?.bounds;
    if (!bounds) {
      filtered = stations;
    } else {
      const [[s, w], [n, e]] = bounds;
      filtered = stations.filter(st =>
        st.geo_lat >= s && st.geo_lat <= n &&
        st.geo_long >= w && st.geo_long <= e
      );
    }
  }

  // Shuffle using Fisher-Yates
  scanQueue = filtered.filter(s => s.lastcheckok === 1);
  for (let i = scanQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scanQueue[i], scanQueue[j]] = [scanQueue[j], scanQueue[i]];
  }
  // Bias toward popular stations: sort top 30% by clickcount, shuffle the rest
  const topCount = Math.floor(scanQueue.length * 0.3);
  const top = scanQueue.slice(0, topCount).sort((a, b) => b.clickcount - a.clickcount);
  const rest = scanQueue.slice(topCount);
  // Interleave: popular, random, popular, random...
  scanQueue = [];
  let ti = 0, ri = 0;
  while (ti < top.length || ri < rest.length) {
    if (ti < top.length) scanQueue.push(top[ti++]);
    if (ri < rest.length) scanQueue.push(rest[ri++]);
  }

  scanIndex = 0;
}

function scanNext(): void {
  if (scanQueue.length === 0) {
    stop();
    return;
  }
  if (scanIndex >= scanQueue.length) scanIndex = 0;

  const station = scanQueue[scanIndex++];
  audioPlayer.play(station);
  flyToStation(station);

  scanTimer = setTimeout(scanNext, SCAN_INTERVAL);
}

export function start(): void {
  buildScanQueue();
  store.set('scannerMode', 'scanning');
  scanNext();
}

export function stop(): void {
  if (scanTimer) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
  store.set('scannerMode', 'idle');
}

export function pause(): void {
  if (scanTimer) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
  store.set('scannerMode', 'paused');
}

export function resume(): void {
  store.set('scannerMode', 'scanning');
  scanTimer = setTimeout(scanNext, SCAN_INTERVAL);
}

export function skip(): void {
  if (scanTimer) clearTimeout(scanTimer);
  scanNext();
}

export function setRegion(region: string): void {
  store.set('scannerRegion', region);
  if (store.get('scannerMode') === 'scanning') {
    if (scanTimer) clearTimeout(scanTimer);
    buildScanQueue();
    scanNext();
  }
}

export function nextRegion(): void {
  const current = store.get('scannerRegion');
  const idx = REGION_KEYS.indexOf(current);
  const next = REGION_KEYS[(idx + 1) % REGION_KEYS.length];
  setRegion(next);
}

export function prevRegion(): void {
  const current = store.get('scannerRegion');
  const idx = REGION_KEYS.indexOf(current);
  const prev = REGION_KEYS[(idx - 1 + REGION_KEYS.length) % REGION_KEYS.length];
  setRegion(prev);
}
