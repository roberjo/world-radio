import { store } from '../store/store.ts';
import * as scanner from './scanner.ts';
import { REGIONS } from '../utils/geo.ts';

export function initScannerUI(): void {
  const scannerBtn = document.getElementById('btn-scanner')!;
  const scannerOverlay = document.getElementById('scanner-overlay')!;
  const scannerClose = document.getElementById('scanner-close')!;
  const scannerToggle = document.getElementById('scanner-toggle')!;
  const scannerSkip = document.getElementById('scanner-skip')!;
  const scannerPrevRegion = document.getElementById('scanner-prev-region')!;
  const scannerNextRegion = document.getElementById('scanner-next-region')!;
  const scannerRegionName = document.getElementById('scanner-region-name')!;
  const scannerStatus = document.getElementById('scanner-status')!;
  const freqLine = document.getElementById('scanner-freq-line')!;

  // Open scanner overlay
  scannerBtn.addEventListener('click', () => {
    scannerOverlay.classList.add('visible');
    if (store.get('scannerMode') === 'idle') {
      scanner.start();
    }
  });

  // Close
  scannerClose.addEventListener('click', () => {
    scannerOverlay.classList.remove('visible');
    scanner.stop();
  });

  // Toggle play/pause
  scannerToggle.addEventListener('click', () => {
    const mode = store.get('scannerMode');
    if (mode === 'scanning') {
      scanner.pause();
    } else if (mode === 'paused') {
      scanner.resume();
    } else {
      scanner.start();
    }
  });

  // Skip
  scannerSkip.addEventListener('click', () => scanner.skip());

  // Region navigation
  scannerPrevRegion.addEventListener('click', () => scanner.prevRegion());
  scannerNextRegion.addEventListener('click', () => scanner.nextRegion());

  // Update region display
  store.subscribe('scannerRegion', (region) => {
    const r = REGIONS[region as string];
    scannerRegionName.textContent = r ? r.name : 'Worldwide';
  });

  // Update scanner state
  store.subscribe('scannerMode', (mode) => {
    scannerToggle.textContent = mode === 'scanning' ? 'Pause' : 'Scan';
    freqLine.classList.toggle('scanning', mode === 'scanning');
  });

  // Update currently scanning station
  store.subscribe('currentStation', (station) => {
    if (station && store.get('scannerMode') !== 'idle') {
      const s = station as { name: string; country: string };
      scannerStatus.textContent = `${s.name} \u2014 ${s.country}`;
    }
  });

  // Keyboard: S to toggle scanner
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 's' || e.key === 'S') {
      if (scannerOverlay.classList.contains('visible')) {
        scannerOverlay.classList.remove('visible');
        scanner.stop();
      } else {
        scannerOverlay.classList.add('visible');
        scanner.start();
      }
    }
  });
}
