import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { initClusters, loadStations, updateMarkers, updateActiveMarker } from './clusters.ts';
import { fetchTopStations } from '../api/radio-browser.ts';
import { store } from '../store/store.ts';
import { debounce } from '../utils/debounce.ts';
import { getTheme } from '../utils/theme.ts';
import type { Station } from '../api/types.ts';

let map: L.Map;
let baseLayer: L.TileLayer;
let labelLayer: L.TileLayer;

// Esri Canvas basemaps: keyless, and visually close to the CARTO dark/light styles
// this app used until CARTO started requiring an API key (tiles came back watermarked
// "API KEY REQUIRED"). The base layer drops labels past low zooms, so a matching
// "Reference" label layer is stacked on top.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
const TILE_URLS = {
  dark: {
    base: `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  },
  light: {
    base: `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  },
};
/** Canvas tiles exist through z16; Leaflet upscales them beyond that. */
const TILE_OPTIONS: L.TileLayerOptions = { maxNativeZoom: 16, maxZoom: 19 };

export function getMap(): L.Map {
  return map;
}

export function setMapTheme(theme: 'dark' | 'light'): void {
  baseLayer?.setUrl(TILE_URLS[theme].base);
  labelLayer?.setUrl(TILE_URLS[theme].labels);
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

  const theme = getTheme();
  baseLayer = L.tileLayer(TILE_URLS[theme].base, TILE_OPTIONS).addTo(map);
  labelLayer = L.tileLayer(TILE_URLS[theme].labels, TILE_OPTIONS).addTo(map);

  // Zoom control on the right
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Attribution (required by Esri's basemap terms)
  L.control.attribution({ position: 'bottomright' })
    .addAttribution('Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors')
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
