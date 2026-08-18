import type { Station } from '../api/types.ts';

export interface StationPackMeta {
  id: string;
  path: string;
  label: string;
  description: string;
  count: number;
}

export interface StationPack {
  id: string;
  label: string;
  description: string;
  stations: Station[];
}

/** Hand-curated bundles shipped as static JSON in public/station-packs/ — real stations
 *  pulled from the Radio Browser API (name, tags, votes, geo checked), not fabricated. */
export const STATION_PACKS: StationPackMeta[] = [
  {
    id: 'college-community',
    path: 'station-packs/college-community.json',
    label: 'College & Community Radio',
    description: 'Student-run and community stations broadcasting from campuses around the world.',
    count: 8,
  },
  {
    id: 'internet-independent',
    path: 'station-packs/internet-independent.json',
    label: 'Internet-Only & Independent',
    description: "Stations that only exist online — no FM signal, no corporate owner.",
    count: 8,
  },
  {
    id: 'independent-dance-edm',
    path: 'station-packs/independent-dance-edm.json',
    label: 'Independent Dance & EDM',
    description: 'Small, independent electronic and dance stations from clubs and crews worldwide.',
    count: 7,
  },
];

export async function fetchStationPack(meta: StationPackMeta): Promise<StationPack> {
  const url = new URL(meta.path, document.baseURI).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load station pack: ${meta.id}`);
  return res.json();
}
