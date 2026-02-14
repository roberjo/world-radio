import type { Station } from '../api/types.ts';
import { registerClick } from '../api/radio-browser.ts';
import { store } from '../store/store.ts';

class AudioPlayer {
  private audio: HTMLAudioElement;
  private hls: { destroy(): void } | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.volume = store.get('volume');

    this.audio.addEventListener('playing', () => {
      store.set('isPlaying', true);
      store.set('isBuffering', false);
    });

    this.audio.addEventListener('waiting', () => {
      store.set('isBuffering', true);
    });

    this.audio.addEventListener('pause', () => {
      store.set('isPlaying', false);
    });

    this.audio.addEventListener('error', () => {
      store.set('isPlaying', false);
      store.set('isBuffering', false);
      store.set('error', 'Stream unavailable');
    });

    store.subscribe('volume', (v) => {
      this.audio.volume = v as number;
    });
  }

  async play(station: Station): Promise<void> {
    this.stop();
    store.set('currentStation', station);
    store.set('isBuffering', true);
    store.set('error', null);

    const streamUrl = station.url_resolved || station.url;

    try {
      if (this.isHLS(streamUrl) || station.hls === 1) {
        await this.playHLS(streamUrl);
      } else {
        this.audio.src = streamUrl;
        await this.audio.play();
      }
      registerClick(station.stationuuid);
    } catch {
      store.set('isBuffering', false);
      store.set('error', 'Failed to play stream');
    }
  }

  private isHLS(url: string): boolean {
    return url.includes('.m3u8');
  }

  private async playHLS(url: string): Promise<void> {
    const { default: Hls } = await import('hls.js');
    if (Hls.isSupported()) {
      const hls = new Hls();
      this.hls = hls;
      hls.loadSource(url);
      hls.attachMedia(this.audio);
      return new Promise((resolve, reject) => {
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          this.audio.play().then(resolve).catch(reject);
        });
        hls.on(Hls.Events.ERROR, () => reject(new Error('HLS error')));
      });
    } else if (this.audio.canPlayType('application/vnd.apple.mpegurl')) {
      this.audio.src = url;
      await this.audio.play();
    }
  }

  stop(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    store.set('isPlaying', false);
    store.set('isBuffering', false);
  }

  toggle(): void {
    if (this.audio.paused && store.get('currentStation')) {
      this.audio.play().catch(() => {});
    } else {
      this.audio.pause();
    }
  }

  setVolume(v: number): void {
    store.set('volume', Math.max(0, Math.min(1, v)));
  }
}

export const audioPlayer = new AudioPlayer();
