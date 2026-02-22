import Supercluster from 'supercluster';
import L from 'leaflet';
import type { Station, StationGeoJSON } from '../api/types.ts';
import { clusterCountLabel } from '../utils/format.ts';
import { store } from '../store/store.ts';
import { audioPlayer } from '../player/audio.ts';

const index = new Supercluster<StationGeoJSON['properties']>({
  radius: 60,
  maxZoom: 14,
  minPoints: 2,
});

let markerLayer: L.LayerGroup;
let map: L.Map;
let visibleStations: Station[] = [];
let currentStationIndex = -1;
let activeMarker: L.Marker | null = null;

export function initClusters(leafletMap: L.Map): void {
  map = leafletMap;
  markerLayer = L.layerGroup().addTo(map);

  // Handle prev/next navigation
  document.addEventListener('station-navigate', ((e: CustomEvent<number>) => {
    if (visibleStations.length === 0) return;
    currentStationIndex = (currentStationIndex + e.detail + visibleStations.length) % visibleStations.length;
    const station = visibleStations[currentStationIndex];
    audioPlayer.play(station);
    map.flyTo([station.geo_lat, station.geo_long], Math.max(map.getZoom(), 8), { duration: 1 });
  }) as EventListener);
}

export function loadStations(stations: Station[]): void {
  const points: GeoJSON.Feature<GeoJSON.Point, StationGeoJSON['properties']>[] = stations.map(s => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [s.geo_long, s.geo_lat] },
    properties: {
      stationuuid: s.stationuuid,
      name: s.name,
      country: s.country,
      countrycode: s.countrycode,
      tags: s.tags,
      favicon: s.favicon,
      clickcount: s.clickcount,
    },
  }));
  index.load(points);
  updateMarkers();
}

export function updateMarkers(): void {
  if (!map) return;
  markerLayer.clearLayers();

  const bounds = map.getBounds();
  const zoom = Math.floor(map.getZoom());
  const bbox: GeoJSON.BBox = [
    bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(),
  ];

  const clusters = index.getClusters(bbox as [number, number, number, number], zoom);

  // Track visible individual stations for prev/next navigation
  visibleStations = [];

  clusters.forEach(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = feature.properties as any;

    if (props.cluster) {
      // Cluster marker
      const count = props.point_count as number;
      const size = count < 10 ? 30 : count < 100 ? 40 : count < 500 ? 50 : 60;

      const icon = L.divIcon({
        html: `<div class="cluster-marker" style="width:${size}px;height:${size}px"><span>${clusterCountLabel(count)}</span></div>`,
        className: 'cluster-icon',
        iconSize: L.point(size, size),
      });

      const marker = L.marker([lat, lng], { icon });
      marker.on('click', () => {
        const expansionZoom = Math.min(index.getClusterExpansionZoom(props.cluster_id as number), 18);
        map.flyTo([lat, lng], expansionZoom, { duration: 0.5 });
      });
      markerLayer.addLayer(marker);
    } else {
      // Individual station marker
      const stationData = store.get('stations').get(props.stationuuid as string);
      if (stationData) visibleStations.push(stationData);

      const currentStation = store.get('currentStation');
      const isActive = currentStation?.stationuuid === props.stationuuid;

      // Skip adding active station to cluster layer — standalone activeMarker handles it
      if (isActive) return;

      const icon = L.divIcon({
        html: `<div class="station-marker"><div class="station-dot"></div></div>`,
        className: 'station-icon',
        iconSize: L.point(16, 16),
      });

      const marker = L.marker([lat, lng], { icon });

      // Tooltip with station name
      marker.bindTooltip(
        `<strong>${props.name}</strong><br>${props.country}`,
        { className: 'station-tooltip', direction: 'top', offset: L.point(0, -10) }
      );

      marker.on('click', () => {
        if (stationData) {
          currentStationIndex = visibleStations.indexOf(stationData);
          audioPlayer.play(stationData);
        }
      });

      markerLayer.addLayer(marker);
    }
  });
}

export function updateActiveMarker(): void {
  if (!map) return;

  // Remove old active marker
  if (activeMarker) {
    map.removeLayer(activeMarker);
    activeMarker = null;
  }

  const currentStation = store.get('currentStation');
  if (!currentStation) return;

  const icon = L.divIcon({
    html: `<div class="station-marker active"><div class="station-dot"></div></div>`,
    className: 'station-icon',
    iconSize: L.point(16, 16),
  });

  activeMarker = L.marker([currentStation.geo_lat, currentStation.geo_long], {
    icon,
    zIndexOffset: 1000,
  });

  activeMarker.bindTooltip(
    `<strong>${currentStation.name}</strong><br>${currentStation.country}`,
    { className: 'station-tooltip', direction: 'top', offset: L.point(0, -10) }
  );

  activeMarker.on('click', () => {
    audioPlayer.play(currentStation);
  });

  activeMarker.addTo(map);
}
