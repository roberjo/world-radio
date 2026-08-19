import { store } from '../store/store.ts';
import * as scanner from './scanner.ts';
import { REGIONS } from '../utils/geo.ts';
import { escapeAttr } from '../utils/html.ts';
import { t, onLanguageChange } from '../i18n/i18n.ts';
import type { Station } from '../api/types.ts';

export function initScannerUI(): void {
  const scannerBtn = document.getElementById('btn-scanner')!;
  const scannerOverlay = document.getElementById('scanner-overlay')!;
  const scannerClose = document.getElementById('scanner-close')!;
  const scannerToggle = document.getElementById('scanner-toggle')!;
  const scannerToggleLabel = document.getElementById('scanner-toggle-label')!;
  const scannerToggleIcon = document.getElementById('scanner-toggle-icon')!;
  const scannerSkip = document.getElementById('scanner-skip')!;
  const scannerPrevRegion = document.getElementById('scanner-prev-region')!;
  const scannerNextRegion = document.getElementById('scanner-next-region')!;
  const scannerRegionName = document.getElementById('scanner-region-name')!;
  const scannerBadge = document.getElementById('scanner-badge')!;
  const scannerStationName = document.getElementById('scanner-station-name')!;
  const scannerStationCountry = document.getElementById('scanner-station-country')!;
  const scannerFavicon = document.getElementById('scanner-favicon')!;
  const freqLine = document.getElementById('scanner-freq-line')!;
  const listsPanel = document.getElementById('lists-panel')!;

  const pauseIconSvg = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  const playIconSvg = '<polygon points="5,3 19,12 5,21"/>';

  // Sync scanner overlay position with lists panel visibility
  function syncListsOpen(): void {
    scannerOverlay.classList.toggle('lists-open', listsPanel.classList.contains('visible'));
  }

  // Observe lists panel class changes
  const observer = new MutationObserver(syncListsOpen);
  observer.observe(listsPanel, { attributes: true, attributeFilter: ['class'] });
  syncListsOpen();

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
    scannerRegionName.textContent = r ? r.name : t('scanner.worldwide');
  });

  // Update scanner state
  store.subscribe('scannerMode', (mode) => {
    const isScanning = mode === 'scanning';
    scannerToggleLabel.textContent = isScanning ? t('scanner.pause') : t('scanner.scan');
    scannerToggleIcon.innerHTML = isScanning ? pauseIconSvg : playIconSvg;
    scannerToggle.classList.toggle('primary', isScanning);
    freqLine.classList.toggle('scanning', isScanning);

    scannerBadge.textContent = isScanning ? t('scanner.scanning') : t('scanner.paused');
    scannerBadge.classList.toggle('paused', !isScanning);
  });

  onLanguageChange(() => {
    const mode = store.get('scannerMode');
    const isScanning = mode === 'scanning';
    scannerToggleLabel.textContent = isScanning ? t('scanner.pause') : t('scanner.scan');
    scannerBadge.textContent = isScanning ? t('scanner.scanning') : t('scanner.paused');
    const region = REGIONS[store.get('scannerRegion')];
    scannerRegionName.textContent = region ? region.name : t('scanner.worldwide');
  });

  // Update currently scanning station
  store.subscribe('currentStation', (station) => {
    if (station && store.get('scannerMode') !== 'idle') {
      const s = station as Station;
      scannerStationName.textContent = s.name;
      scannerStationCountry.textContent = s.country;
      if (s.favicon) {
        scannerFavicon.innerHTML = `<img src="${escapeAttr(s.favicon)}" alt="" onerror="this.parentElement.textContent='📻'">`;
      } else {
        scannerFavicon.textContent = '📻';
      }
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
