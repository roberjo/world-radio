/**
 * True when a stream URL is likely to silently fail to play: browsers auto-upgrade
 * http:// media requests to https:// when the page itself is https:// (which this app
 * always is once deployed), and if the origin server doesn't answer on https, the
 * request just hangs instead of failing with a clear error. Confirmed directly against
 * a real stream: http:// worked immediately over curl, https:// on the same host:port
 * timed out at the TCP level, and in-browser the <audio> element sat at
 * readyState 0 indefinitely with no MediaError ever set.
 */
export function isLikelyMixedContentBlocked(streamUrl: string): boolean {
  if (location.protocol !== 'https:') return false;
  try {
    return new URL(streamUrl).protocol === 'http:';
  } catch {
    return false;
  }
}
