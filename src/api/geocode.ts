export interface GeocodeResult {
  lat: number;
  lon: number;
  country: string;
  displayName: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: { country?: string };
}

/** Free, keyless geocoding via OpenStreetMap's Nominatim. Returns null on any failure or no match. */
export async function geocodeLocation(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const results = await res.json() as NominatimResult[];
    if (results.length === 0) return null;
    const r = results[0];
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return {
      lat, lon,
      country: r.address?.country ?? trimmed,
      displayName: r.display_name,
    };
  } catch {
    return null;
  }
}
