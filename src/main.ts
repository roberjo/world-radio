import './style.css';
import { initMap, flyToStation } from './map/map.ts';
import { initPlayerUI, showToast } from './player/player-ui.ts';
import { initScannerUI } from './scanner/scanner-ui.ts';
import { initListsUI, openListsPanel, openListsPanelWithSharedList } from './lists/lists-ui.ts';
import { store } from './store/store.ts';
import { audioPlayer } from './player/audio.ts';
import { loadLists, saveLists, seedDefaultLists } from './store/persistence.ts';
import { initRouter } from './router/router.ts';
import { fetchStationByUUID } from './api/radio-browser.ts';
import type { Route } from './router/router.ts';
import type { Station, StationListEntry } from './api/types.ts';

async function init(): Promise<void> {
  // Load persisted lists into store
  store.set('stationLists', loadLists());

  // Persist lists on change
  store.subscribe('stationLists', (lists) => {
    saveLists(lists as import('./api/types.ts').StationList[]);
  });

  initPlayerUI();
  initScannerUI();
  initListsUI();
  if (window.innerWidth > 640) {
    openListsPanel();
  }
  initSurpriseMe();
  await initMap();

  // Seed default genre/country lists from loaded stations (runs once)
  const allStations = Array.from(store.get('stations').values());
  const seeded = seedDefaultLists(allStations, store.get('stationLists'));
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

init();
