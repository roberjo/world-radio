import { audioPlayer } from './audio.ts';

export type SleepTimerReason = 'set' | 'cancelled' | 'elapsed';

let timeoutId: ReturnType<typeof setTimeout> | null = null;
let endsAt: number | null = null;
const listeners = new Set<(endsAt: number | null, reason: SleepTimerReason) => void>();

export function onSleepTimerChange(cb: (endsAt: number | null, reason: SleepTimerReason) => void): void {
  listeners.add(cb);
}

function notify(reason: SleepTimerReason): void {
  listeners.forEach(cb => cb(endsAt, reason));
}

export function getSleepTimerEndsAt(): number | null {
  return endsAt;
}

/** Pass null to cancel any running timer. */
export function setSleepTimer(minutes: number | null): void {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (minutes === null) {
    endsAt = null;
    notify('cancelled');
    return;
  }
  const durationMs = minutes * 60_000;
  endsAt = Date.now() + durationMs;
  timeoutId = setTimeout(() => {
    endsAt = null;
    timeoutId = null;
    notify('elapsed');
    audioPlayer.fadeOutAndStop();
  }, durationMs);
  notify('set');
}
