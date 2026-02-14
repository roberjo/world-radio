import './style.css';
import { initMap, flyToStation } from './map/map.ts';
import { initPlayerUI } from './player/player-ui.ts';
import { initScannerUI } from './scanner/scanner-ui.ts';
import { store } from './store/store.ts';
import { audioPlayer } from './player/audio.ts';

async function init(): Promise<void> {
  initPlayerUI();
  initScannerUI();
  initSurpriseMe();
  await initMap();

  // Hide loading overlay when done
  const overlay = document.getElementById('loading-overlay')!;
  overlay.classList.add('hidden');
}

function initSurpriseMe(): void {
  const btn = document.getElementById('btn-surprise')!;
  btn.addEventListener('click', () => {
    const stations = Array.from(store.get('stations').values());
    if (stations.length === 0) return;
    const random = stations[Math.floor(Math.random() * stations.length)];
    audioPlayer.play(random);
    flyToStation(random);
  });
}

init();
