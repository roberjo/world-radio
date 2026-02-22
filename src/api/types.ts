export interface Station {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  country: string;
  countrycode: string;
  state: string;
  city: string;
  language: string;
  tags: string;
  codec: string;
  bitrate: number;
  hls: number;
  lastcheckok: number;
  clickcount: number;
  clicktrend: number;
  votes: number;
  geo_lat: number;
  geo_long: number;
}

export interface StationGeoJSON {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    stationuuid: string;
    name: string;
    country: string;
    countrycode: string;
    tags: string;
    favicon: string;
    clickcount: number;
  };
}

export interface ClusterProperties {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: number | string;
}

export interface StationPointProperties {
  cluster: false;
  stationuuid: string;
  name: string;
  country: string;
  countrycode: string;
  tags: string;
  favicon: string;
  clickcount: number;
}

export type MarkerProperties = ClusterProperties | StationPointProperties;

export type ScannerState = 'idle' | 'scanning' | 'paused';

export interface StationListEntry {
  stationuuid: string;
  name: string;
  country: string;
  favicon: string;
}

export interface StationList {
  id: string;
  label: string;
  type: 'favorites' | 'genre' | 'country' | 'custom';
  entries: StationListEntry[];
}

export interface AppState {
  stations: Map<string, Station>;
  currentStation: Station | null;
  isPlaying: boolean;
  isBuffering: boolean;
  volume: number;
  scannerMode: ScannerState;
  scannerRegion: string;
  loading: boolean;
  error: string | null;
  stationLists: StationList[];
}
