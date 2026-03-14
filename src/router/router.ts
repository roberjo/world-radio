export interface RouteStation { type: 'station'; id: string }
export interface RouteList { type: 'list'; listData: { label: string; ids: string[] } }
export interface RouteHome { type: 'home' }
export type Route = RouteStation | RouteList | RouteHome;

export function parseHash(hash: string): Route {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;

  const stationMatch = h.match(/^\/station\/(.+)$/);
  if (stationMatch) {
    return { type: 'station', id: stationMatch[1] };
  }

  const listMatch = h.match(/^\/list\/(.+)$/);
  if (listMatch) {
    try {
      const json = atob(listMatch[1]);
      const data = JSON.parse(json) as { label: string; ids: string[] };
      if (data.label && Array.isArray(data.ids)) {
        return { type: 'list', listData: data };
      }
    } catch { /* invalid base64 or JSON */ }
  }

  return { type: 'home' };
}

export function setStationHash(uuid: string): void {
  history.replaceState(null, '', `#/station/${uuid}`);
}

export function clearHash(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function buildListUrl(label: string, ids: string[]): string {
  const payload = btoa(JSON.stringify({ label, ids }));
  return `${window.location.origin}${window.location.pathname}#/list/${payload}`;
}

export function initRouter(onRoute: (route: Route) => void): void {
  // Handle initial hash
  const initial = parseHash(window.location.hash);
  if (initial.type !== 'home') {
    onRoute(initial);
  }

  // Listen for hash changes (back/forward navigation, manual URL edits)
  window.addEventListener('hashchange', () => {
    onRoute(parseHash(window.location.hash));
  });
}
