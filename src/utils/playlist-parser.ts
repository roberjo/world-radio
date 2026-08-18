export interface ParsedPlaylistEntry {
  url: string;
  name: string;
}

/** Parses pasted M3U/M3U8, PLS, or XSPF playlist text (not fetched — many stations that
 *  don't publish a raw stream URL do publish one of these, and parsing text locally has
 *  no CORS problem the way fetching a third-party playlist file would). */
export function parsePlaylist(text: string): ParsedPlaylistEntry | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('<?xml') || /<playlist[\s>]/i.test(trimmed)) {
    const xspf = parseXspf(trimmed);
    if (xspf) return xspf;
  }

  if (/^\[playlist\]/im.test(trimmed)) {
    const pls = parsePls(trimmed);
    if (pls) return pls;
  }

  return parseM3u(trimmed);
}

function parseXspf(text: string): ParsedPlaylistEntry | null {
  try {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) return null;
    const track = doc.querySelector('track');
    const location = track?.querySelector('location')?.textContent?.trim();
    const title = track?.querySelector('title')?.textContent?.trim();
    if (!location) return null;
    return { url: location, name: title || '' };
  } catch {
    return null;
  }
}

function parsePls(text: string): ParsedPlaylistEntry | null {
  let url = '';
  let name = '';
  for (const line of text.split(/\r?\n/)) {
    const fileMatch = line.match(/^File1\s*=\s*(.+)$/i);
    if (fileMatch) url = fileMatch[1].trim();
    const titleMatch = line.match(/^Title1\s*=\s*(.+)$/i);
    if (titleMatch) name = titleMatch[1].trim();
  }
  return url ? { url, name } : null;
}

function parseM3u(text: string): ParsedPlaylistEntry | null {
  let pendingTitle = '';
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      const comma = line.indexOf(',');
      pendingTitle = comma >= 0 ? line.slice(comma + 1).trim() : '';
      continue;
    }
    if (line.startsWith('#')) continue;
    if (/^https?:\/\//i.test(line)) {
      return { url: line, name: pendingTitle };
    }
  }
  return null;
}
