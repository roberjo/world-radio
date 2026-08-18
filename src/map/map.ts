import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { initClusters, loadStations, updateMarkers, updateActiveMarker } from './clusters.ts';
import { fetchTopStations } from '../api/radio-browser.ts';
import { store } from '../store/store.ts';
import { debounce } from '../utils/debounce.ts';
import { getTheme } from '../utils/theme.ts';
import type { Station } from '../api/types.ts';

let map: L.Map;
let tileLayer: L.TileLayer;

const TILE_URLS = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

export function getMap(): L.Map {
  return map;
}

export function setMapTheme(theme: 'dark' | 'light'): void {
  tileLayer?.setUrl(TILE_URLS[theme]);
}

export async function initMap(): Promise<void> {
  map = L.map('map', {
    center: [20, 0],
    zoom: 3,
    minZoom: 2,
    maxZoom: 18,
    zoomControl: false,
    attributionControl: false,
  });

  tileLayer = L.tileLayer(TILE_URLS[getTheme()], {
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Zoom control on the right
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Attribution (required by CartoDB)
  L.control.attribution({ position: 'bottomright' })
    .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>')
    .addTo(map);

  initClusters(map);

  // Update clusters on map move
  const debouncedUpdate = debounce(updateMarkers, 100);
  map.on('moveend', debouncedUpdate);
  map.on('zoomend', debouncedUpdate);

  // Re-render markers when current station changes (to update active marker style)
  store.subscribe('currentStation', () => {
    updateMarkers();
    updateActiveMarker();
  });

  // Load stations
  store.set('loading', true);
  try {
    const stations = await fetchTopStations(5000);
    const stationMap = store.get('stations');
    stations.forEach(s => stationMap.set(s.stationuuid, s));
    store.set('stations', stationMap);
    loadStations(stations);
    store.set('loading', false);
  } catch {
    store.set('error', 'Failed to load radio stations. Please refresh.');
    store.set('loading', false);
  }
}

export function flyToStation(station: Station): void {
  if (map) {
    map.flyTo([station.geo_lat, station.geo_long], Math.max(map.getZoom(), 8), { duration: 1.5 });
  }
}
