import type { Station } from '../api/types.ts';

const POOL_SIZE = 200;

/** A stable hash of today's UTC date, so every visitor sees the same pick. */
function todaySeed(): number {
  const d = new Date();
  const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministically picks one station from the most popular stations, seeded by
 *  today's date (UTC) — the same station for every visitor, all day. */
export function getStationOfTheDay(stations: Station[]): Station | null {
  const pool = [...stations]
    .sort((a, b) => b.clickcount - a.clickcount)
    .slice(0, POOL_SIZE);
  if (pool.length === 0) return null;
  return pool[todaySeed() % pool.length];
}
