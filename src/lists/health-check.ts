import { store } from '../store/store.ts';

export type HealthStatus = 'ok' | 'dead';

const healthStatus = new Map<string, HealthStatus>();
const listeners = new Set<() => void>();

export function getHealthStatus(stationuuid: string): HealthStatus | undefined {
  return healthStatus.get(stationuuid);
}

export function onHealthChange(cb: () => void): void {
  listeners.add(cb);
}

function setStatus(stationuuid: string, status: HealthStatus): void {
  if (healthStatus.get(stationuuid) === status) return;
  healthStatus.set(stationuuid, status);
  listeners.forEach(cb => cb());
}

/**
 * Marks a station dead/ok based on real playback outcomes rather than a synthetic
 * background probe. A proactive probe (loading each stream in a hidden audio element,
 * or a no-cors fetch) was tried and measured against a real live Icecast stream: it
 * false-flagged a genuinely working station as dead, because browsers throttle/delay
 * buffering for media elements with no user gesture and no visible playback. Piggybacking
 * on audio.ts's already-tuned 15s timeout and real error/playing events is both more
 * accurate and free — it only runs when the user actually tries to listen.
 */
export function initHealthTracking(): void {
  store.subscribe('isPlaying', (playing) => {
    if (!playing) return;
    const station = store.get('currentStation');
    if (station) setStatus(station.stationuuid, 'ok');
  });

  store.subscribe('error', (err) => {
    if (!err) return;
    const station = store.get('currentStation');
    if (station) setStatus(station.stationuuid, 'dead');
  });
}
