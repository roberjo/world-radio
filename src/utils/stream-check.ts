/** Best-effort: try loading a stream in a hidden audio element to catch obviously-dead URLs.
 *  HLS (.m3u8) isn't natively playable, so those are trusted without a check. */
export function testStreamUrl(url: string, timeoutMs = 4000): Promise<boolean> {
  if (url.includes('.m3u8')) return Promise.resolve(true);
  return new Promise((resolve) => {
    const audio = new Audio();
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      audio.src = '';
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    audio.addEventListener('canplay', () => finish(true), { once: true });
    audio.addEventListener('loadedmetadata', () => finish(true), { once: true });
    audio.addEventListener('error', () => finish(false), { once: true });
    audio.preload = 'metadata';
    audio.src = url;
  });
}
