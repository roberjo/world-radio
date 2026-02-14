import { store } from '../store/store.ts';
import { audioPlayer } from './audio.ts';
import { formatStationInfo, formatTags, formatBitrate } from '../utils/format.ts';
import type { Station } from '../api/types.ts';

export function initPlayerUI(): void {
  const playerBar = document.getElementById('player-bar')!;
  const playBtn = document.getElementById('btn-play')!;
  const prevBtn = document.getElementById('btn-prev')!;
  const nextBtn = document.getElementById('btn-next')!;
  const stationName = document.getElementById('station-name')!;
  const stationMeta = document.getElementById('station-meta')!;
  const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
  const freqBar = document.getElementById('freq-bar')!;
  const toast = document.getElementById('toast')!;

  // Play/Pause
  playBtn.addEventListener('click', () => audioPlayer.toggle());

  // Prev/Next (dispatch events for map to handle)
  prevBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('station-navigate', { detail: -1 }));
  });
  nextBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('station-navigate', { detail: 1 }));
  });

  // Volume
  volumeSlider.value = String(store.get('volume') * 100);
  volumeSlider.addEventListener('input', () => {
    audioPlayer.setVolume(Number(volumeSlider.value) / 100);
  });

  // Subscribe to state changes
  store.subscribe('currentStation', (s) => {
    const station = s as Station | null;
    if (station) {
      playerBar.classList.add('active');
      stationName.textContent = formatStationInfo(station);
      const tags = formatTags(station.tags);
      const bitrate = formatBitrate(station.bitrate);
      const parts = [...tags];
      if (bitrate) parts.push(bitrate);
      stationMeta.textContent = parts.join(' \u00b7 ');
    } else {
      playerBar.classList.remove('active');
      stationName.textContent = 'Click a station on the map to start listening';
      stationMeta.textContent = '';
    }
  });

  store.subscribe('isPlaying', (playing) => {
    playBtn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    freqBar.classList.toggle('playing', playing as boolean);
  });

  store.subscribe('isBuffering', (buffering) => {
    playBtn.classList.toggle('buffering', buffering as boolean);
  });

  store.subscribe('error', (err) => {
    if (err) {
      toast.textContent = err as string;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 3000);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        audioPlayer.toggle();
        break;
      case 'ArrowRight':
        document.dispatchEvent(new CustomEvent('station-navigate', { detail: 1 }));
        break;
      case 'ArrowLeft':
        document.dispatchEvent(new CustomEvent('station-navigate', { detail: -1 }));
        break;
    }
  });
}
