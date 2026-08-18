import type { Station } from '../api/types.ts';
import { registerClick } from '../api/radio-browser.ts';
import { store } from '../store/store.ts';
import { escapeHtml, escapeAttr } from '../utils/html.ts';

const STREAM_TIMEOUT = 15000;

class AudioPlayer {
  private audio: HTMLAudioElement;
  private hls: { destroy(): void } | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private playId = 0;
  private stopping = false;

  constructor() {
    this.audio = document.createElement('audio');
    this.audio.preload = 'none';
    this.audio.volume = store.get('volume');
    this.audio.style.display = 'none';
    document.body.appendChild(this.audio);

    this.audio.addEventListener('playing', () => {
      this.clearStreamTimeout();
      store.set('isPlaying', true);
      store.set('isBuffering', false);
    });

    this.audio.addEventListener('waiting', () => {
      if (!this.stopping) {
        store.set('isBuffering', true);
      }
    });

    this.audio.addEventListener('pause', () => {
      if (!this.stopping) {
        store.set('isPlaying', false);
      }
    });

    this.audio.addEventListener('error', () => {
      if (this.stopping) return;
      this.clearStreamTimeout();
      store.set('isPlaying', false);
      store.set('isBuffering', false);
      if (store.get('currentStation')) {
        store.set('error', 'Stream unavailable');
      }
    });

    store.subscribe('volume', (v) => {
      this.audio.volume = v as number;
    });
  }

  async play(station: Station): Promise<void> {
    const currentPlayId = ++this.playId;

    // Clean stop of any current playback
    this.stopping = true;
    this.clearStreamTimeout();
    this.audio.pause();
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.stopping = false;

    store.set('currentStation', station);
    store.set('isBuffering', true);
    store.set('isPlaying', false);
    store.set('error', null);

    const streamUrl = station.url_resolved || station.url;

    // Let the browser process the pause before starting new playback
    await new Promise(r => setTimeout(r, 50));
    if (this.playId !== currentPlayId) return;

    try {
      if (this.isHLS(streamUrl) || station.hls === 1) {
        await this.playHLS(streamUrl, currentPlayId);
      } else {
        this.audio.src = streamUrl;
        this.audio.load();
        this.startStreamTimeout();
        await this.audio.play();
      }
      if (this.playId === currentPlayId && !station.stationuuid.startsWith('custom:')) {
        registerClick(station.stationuuid);
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (this.playId !== currentPlayId) return;
      // Browser blocked autoplay — show a gentle prompt
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        store.set('isBuffering', false);
        this.showAutoplayPrompt(station);
        return;
      }
      this.clearStreamTimeout();
      store.set('isBuffering', false);
      store.set('error', 'Failed to play stream');
    }
  }

  private isHLS(url: string): boolean {
    return url.includes('.m3u8');
  }

  private async playHLS(url: string, currentPlayId: number): Promise<void> {
    const { default: Hls } = await import('hls.js');
    if (this.playId !== currentPlayId) return;
    if (Hls.isSupported()) {
      const hls = new Hls();
      this.hls = hls;
      hls.loadSource(url);
      hls.attachMedia(this.audio);
      this.startStreamTimeout();
      return new Promise((resolve, reject) => {
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (this.playId !== currentPlayId) { resolve(); return; }
          this.audio.play().then(resolve).catch(reject);
        });
        hls.on(Hls.Events.ERROR, () => reject(new Error('HLS error')));
      });
    } else if (this.audio.canPlayType('application/vnd.apple.mpegurl')) {
      this.audio.src = url;
      this.audio.load();
      this.startStreamTimeout();
      await this.audio.play();
    }
  }

  private startStreamTimeout(): void {
    this.clearStreamTimeout();
    this.timeoutId = setTimeout(() => {
      if (store.get('isBuffering') && !store.get('isPlaying')) {
        store.set('isBuffering', false);
        store.set('error', 'Stream timed out — try another station');
        this.stopping = true;
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
        this.stopping = false;
      }
    }, STREAM_TIMEOUT);
  }

  private clearStreamTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  stop(): void {
    this.playId++;
    this.stopping = true;
    this.clearStreamTimeout();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.stopping = false;
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

  private showAutoplayPrompt(station: Station): void {
    // Remove any existing prompt
    document.getElementById('autoplay-prompt')?.remove();

    const faviconHtml = station.favicon
      ? `<img src="${escapeAttr(station.favicon)}" alt="" class="autoplay-prompt-favicon" onerror="this.style.display='none'">`
      : '';

    const overlay = document.createElement('div');
    overlay.id = 'autoplay-prompt';
    overlay.innerHTML = `
      <div class="autoplay-prompt-card">
        <div class="autoplay-prompt-heading">Welcome to World Radio</div>
        <div class="autoplay-prompt-subheading">Someone shared a station with you</div>
        <div class="autoplay-prompt-station-card">
          ${faviconHtml}
          <div class="autoplay-prompt-station-info">
            <div class="autoplay-prompt-station-name">${escapeHtml(station.name)}</div>
            <div class="autoplay-prompt-station-country">${escapeHtml(station.country)}</div>
          </div>
        </div>
        <div class="autoplay-prompt-play">
          <div class="autoplay-prompt-play-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><polygon points="6,3 20,12 6,21"/></svg>
          </div>
          <span>Tap anywhere to tune in</span>
        </div>
      </div>
    `;

    const dismiss = () => {
      overlay.classList.add('dismissing');
      this.audio.play().catch(() => {});
      setTimeout(() => overlay.remove(), 300);
    };

    overlay.addEventListener('click', dismiss);
    document.body.appendChild(overlay);
    // Trigger enter animation on next frame
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }
}

export const audioPlayer = new AudioPlayer();
