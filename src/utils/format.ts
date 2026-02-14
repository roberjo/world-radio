import type { Station } from '../api/types.ts';

export function formatStationInfo(station: Station): string {
  const parts = [station.name];
  if (station.country) parts.push(station.country);
  return parts.join(' \u00b7 ');
}

export function formatTags(tags: string): string[] {
  if (!tags) return [];
  return tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 3);
}

export function formatBitrate(bitrate: number): string {
  if (!bitrate) return '';
  return `${bitrate} kbps`;
}

export function clusterCountLabel(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}
