export interface Region {
  name: string;
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
}

export const REGIONS: Record<string, Region> = {
  all: { name: 'Worldwide', bounds: [[-90, -180], [90, 180]] },
  europe: { name: 'Europe', bounds: [[35, -25], [72, 45]] },
  north_america: { name: 'North America', bounds: [[15, -170], [72, -50]] },
  south_america: { name: 'South America', bounds: [[-56, -82], [13, -34]] },
  africa: { name: 'Africa', bounds: [[-35, -20], [37, 52]] },
  asia: { name: 'Asia', bounds: [[0, 25], [70, 150]] },
  oceania: { name: 'Oceania', bounds: [[-50, 110], [0, 180]] },
};

export const REGION_KEYS = Object.keys(REGIONS);

export function getRegionForCoords(lat: number, lng: number): string {
  for (const [key, region] of Object.entries(REGIONS)) {
    if (key === 'all') continue;
    const [[s, w], [n, e]] = region.bounds;
    if (lat >= s && lat <= n && lng >= w && lng <= e) return key;
  }
  return 'all';
}
