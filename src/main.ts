import './style.css';
import { initMap, flyToStation } from './map/map.ts';
import { appendCustomStations } from './map/clusters.ts';
import { initPlayerUI, showToast } from './player/player-ui.ts';
import { initScannerUI } from './scanner/scanner-ui.ts';
import { initListsUI, openListsPanel, openListsPanelWithSharedList } from './lists/lists-ui.ts';
import { initHealthTracking } from './lists/health-check.ts';
import { initShortcutsHelp } from './utils/shortcuts-help.ts';
import { getStationOfTheDay } from './utils/station-of-the-day.ts';
import { initListeningStats } from './utils/listening-stats.ts';
import { initCommandPalette } from './utils/command-palette.ts';
import { store } from './store/store.ts';
import { audioPlayer } from './player/audio.ts';
import { loadLists, saveLists, seedDefaultLists, loadCustomStations, saveCustomStations, seedC895 } from './store/persistence.ts';
import { initRouter } from './router/router.ts';
import { fetchStationByUUID } from './api/radio-browser.ts';
import type { Route } from './router/router.ts';
import type { Station, StationListEntry } from './api/types.ts';

async function init(): Promise<void> {
  // Load persisted lists into store
  store.set('stationLists', await loadLists());

  // Persist lists on change
  store.subscribe('stationLists', (lists) => {
    saveLists(lists as import('./api/types.ts').StationList[]);
  });

  // Load and seed custom stations before UI init
  let customStations = await loadCustomStations();
  const seededCustom = await seedC895(customStations);
  if (seededCustom) {
    customStations = seededCustom;
    await saveCustomStations(customStations);
  }
  // Inject into stations Map so they're available for list display
  const stationMap = store.get('stations');
  customStations.forEach(s => stationMap.set(s.stationuuid, s));
  store.set('stations', stationMap);

  initPlayerUI();
  initScannerUI();
  initListsUI();
  initHealthTracking();
  initShortcutsHelp();
  initListeningStats();
  initCommandPalette();

  // If C895 was just seeded, add it to My Stations list
  if (seededCustom) {
    const C895_ENTRY: import('./api/types.ts').StationListEntry = {
      stationuuid: 'custom:c895-seattle',
      name: 'C89.5 FM — Seattle',
      country: 'United States of America',
      favicon: 'https://www.c895.org/wp-content/themes/c895/img/favicon.png',
    };
    const currentLists = store.get('stationLists');
    const myList = currentLists.find(l => l.id === 'custom:my-stations');
    if (myList) {
      store.set('stationLists', currentLists.map(l =>
        l.id === 'custom:my-stations' ? { ...l, entries: [...l.entries, C895_ENTRY] } : l
      ));
    } else {
      store.set('stationLists', [...currentLists, {
        id: 'custom:my-stations',
        label: 'My Stations',
        type: 'custom' as const,
        entries: [C895_ENTRY],
      }]);
    }
  }

  if (window.innerWidth > 640) {
    openListsPanel();
  }
  initSurpriseMe();
  initStationOfTheDay();
  await initMap();

  // Add custom stations with real coordinates to the cluster index
  const geoCustom = customStations.filter(s => s.geo_lat !== 0 || s.geo_long !== 0);
  if (geoCustom.length > 0) {
    appendCustomStations(geoCustom);
  }

  // Seed default genre/country lists from loaded stations (runs once)
  const allStations = Array.from(store.get('stations').values());
  const seeded = await seedDefaultLists(allStations, store.get('stationLists'));
  if (seeded) {
    store.set('stationLists', seeded);
  }

  // Listen for flyTo requests from lists panel
  document.addEventListener('station-fly-to', ((e: CustomEvent<Station>) => {
    flyToStation(e.detail);
  }) as EventListener);

  // Initialize router after stations are loaded
  initRouter(handleRoute);

  // Keep URL in sync — already done in player-ui via setStationHash

  // Hide loading overlay when done
  const overlay = document.getElementById('loading-overlay')!;
  overlay.classList.add('hidden');
}

async function handleRoute(route: Route): Promise<void> {
  if (route.type === 'station') {
    await handleStationRoute(route.id);
  } else if (route.type === 'list') {
    await handleListRoute(route.listData.label, route.listData.ids);
  }
}

async function handleStationRoute(uuid: string): Promise<void> {
  // Check if station is already loaded
  let station = store.get('stations').get(uuid) ?? null;

  if (!station) {
    station = await fetchStationByUUID(uuid);
    if (station) {
      // Add to station map
      const stationMap = store.get('stations');
      stationMap.set(station.stationuuid, station);
      store.set('stations', stationMap);
    }
  }

  if (station) {
    audioPlayer.play(station);
    if (station.geo_lat && station.geo_long) {
      flyToStation(station);
    }
  } else {
    showToast('Station not found');
  }
}

async function handleListRoute(label: string, ids: string[]): Promise<void> {
  const stationMap = store.get('stations');
  const entries: StationListEntry[] = [];

  // Fetch missing stations (limit concurrency to 5)
  const missingIds = ids.filter(id => !stationMap.has(id));
  const BATCH_SIZE = 5;
  for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
    const batch = missingIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(id => fetchStationByUUID(id)));
    results.forEach(s => {
      if (s) {
        stationMap.set(s.stationuuid, s);
      }
    });
  }
  if (missingIds.length > 0) {
    store.set('stations', stationMap);
  }

  // Build entries from loaded stations
  for (const id of ids) {
    const s = stationMap.get(id);
    if (s) {
      entries.push({
        stationuuid: s.stationuuid,
        name: s.name,
        country: s.country,
        favicon: s.favicon,
      });
    }
  }

  if (entries.length > 0) {
    openListsPanelWithSharedList(label, entries);
  } else {
    showToast('No stations found in shared list');
  }
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

function initStationOfTheDay(): void {
  const btn = document.getElementById('btn-station-of-day')!;
  btn.addEventListener('click', () => {
    const stations = Array.from(store.get('stations').values());
    const pick = getStationOfTheDay(stations);
    if (!pick) return;
    audioPlayer.play(pick);
    flyToStation(pick);
  });
}

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // GitHub Pages serves this as a project site under a subpath, so the worker URL has
  // to be resolved relative to where the page actually lives, not the site root.
  const swUrl = new URL('sw.js', document.baseURI).href;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
}

registerServiceWorker();
init();
