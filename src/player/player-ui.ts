import { store } from '../store/store.ts';
import { audioPlayer } from './audio.ts';
import { formatStationInfo, formatTags, formatBitrate } from '../utils/format.ts';
import type { Station, StationList } from '../api/types.ts';
import { setStationHash } from '../router/router.ts';
import { setSleepTimer, onSleepTimerChange } from './sleep-timer.ts';
import { shareNowPlayingCard } from '../utils/now-playing-card.ts';

export function showToast(message: string): void {
  const toast = document.getElementById('toast')!;
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

function isFavorited(station: Station): boolean {
  const lists = store.get('stationLists');
  const favs = lists.find(l => l.id === 'favorites');
  return favs ? favs.entries.some(e => e.stationuuid === station.stationuuid) : false;
}

function toggleFavorite(station: Station): void {
  const lists = [...store.get('stationLists')];
  const favsIndex = lists.findIndex(l => l.id === 'favorites');
  if (favsIndex === -1) return;

  const favs: StationList = { ...lists[favsIndex], entries: [...lists[favsIndex].entries] };
  const existingIndex = favs.entries.findIndex(e => e.stationuuid === station.stationuuid);

  if (existingIndex >= 0) {
    favs.entries.splice(existingIndex, 1);
    showToast('Removed from Favorites');
  } else {
    favs.entries.push({
      stationuuid: station.stationuuid,
      name: station.name,
      country: station.country,
      favicon: station.favicon,
    });
    showToast('Added to Favorites');
  }

  lists[favsIndex] = favs;
  store.set('stationLists', lists);
}

function updateFavoriteButton(btn: HTMLElement, station: Station | null): void {
  if (station && isFavorited(station)) {
    btn.classList.add('favorited');
    btn.title = 'Remove from Favorites';
  } else {
    btn.classList.remove('favorited');
    btn.title = 'Add to Favorites';
  }
}

export function initPlayerUI(): void {
  const playerBar = document.getElementById('player-bar')!;
  const playBtn = document.getElementById('btn-play')!;
  const prevBtn = document.getElementById('btn-prev')!;
  const nextBtn = document.getElementById('btn-next')!;
  const stationName = document.getElementById('station-name')!;
  const stationMeta = document.getElementById('station-meta')!;
  const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
  const freqBar = document.getElementById('freq-bar')!;
  const favoriteBtn = document.getElementById('btn-favorite')!;
  const shareBtn = document.getElementById('btn-share')!;
  const shareImageBtn = document.getElementById('btn-share-image')!;
  const sleepBtn = document.getElementById('btn-sleep')!;
  const sleepMenu = document.getElementById('sleep-menu')!;

  // Play/Pause
  playBtn.addEventListener('click', () => audioPlayer.toggle());

  // Prev/Next (dispatch events for map to handle)
  prevBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('station-navigate', { detail: -1 }));
  });
  nextBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('station-navigate', { detail: 1 }));
  });

  // Favorite button
  favoriteBtn.addEventListener('click', () => {
    const station = store.get('currentStation');
    if (station) toggleFavorite(station);
  });

  // Share button
  shareBtn.addEventListener('click', () => {
    const station = store.get('currentStation');
    if (!station) return;
    const url = `${window.location.origin}${window.location.pathname}#/station/${station.stationuuid}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Station link copied!');
      shareBtn.classList.add('copied');
      setTimeout(() => shareBtn.classList.remove('copied'), 1500);
    }).catch(() => {
      showToast('Failed to copy link');
    });
  });

  // Share as image
  shareImageBtn.addEventListener('click', () => {
    const station = store.get('currentStation');
    if (!station) return;
    const url = `${window.location.origin}${window.location.pathname}#/station/${station.stationuuid}`;
    shareImageBtn.classList.add('working');
    shareNowPlayingCard(station, url)
      .then((ok) => { if (!ok) showToast('Could not create the share image'); })
      .catch(() => showToast('Could not create the share image'))
      .finally(() => shareImageBtn.classList.remove('working'));
  });

  // Sleep timer
  const closeSleepMenu = (): void => {
    sleepMenu.classList.remove('visible');
    sleepBtn.setAttribute('aria-expanded', 'false');
  };
  sleepBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !sleepMenu.classList.contains('visible');
    sleepMenu.classList.toggle('visible', opening);
    sleepBtn.setAttribute('aria-expanded', String(opening));
  });
  sleepMenu.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', closeSleepMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSleepMenu();
  });
  sleepMenu.querySelectorAll('.sleep-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutesAttr = (btn as HTMLElement).dataset.minutes!;
      if (minutesAttr === 'off') {
        setSleepTimer(null);
        showToast('Sleep timer turned off');
      } else {
        const minutes = Number(minutesAttr);
        setSleepTimer(minutes);
        showToast(`Sleep timer set for ${minutes} min`);
      }
      closeSleepMenu();
    });
  });
  onSleepTimerChange((endsAt, reason) => {
    sleepBtn.classList.toggle('active', endsAt !== null);
    if (reason === 'elapsed') showToast('Sleep timer ended');
  });

  // Volume
  volumeSlider.value = String(store.get('volume') * 100);
  volumeSlider.addEventListener('input', () => {
    audioPlayer.setVolume(Number(volumeSlider.value) / 100);
  });

  // Subscribe to state changes
  store.subscribe('currentStation', (s) => {
    const station = s as Station | null;
    if (station) {
      playerBar.classList.add('active');
      stationName.textContent = formatStationInfo(station);
      const tags = formatTags(station.tags);
      const bitrate = formatBitrate(station.bitrate);
      const parts = [...tags];
      if (bitrate) parts.push(bitrate);
      stationMeta.textContent = parts.join(' \u00b7 ');
      setStationHash(station.stationuuid);
      updateFavoriteButton(favoriteBtn, station);
    } else {
      playerBar.classList.remove('active');
      stationName.textContent = 'Click a station on the map to start listening';
      stationMeta.textContent = '';
      updateFavoriteButton(favoriteBtn, null);
    }
  });

  // Update favorite button when lists change
  store.subscribe('stationLists', () => {
    const station = store.get('currentStation');
    updateFavoriteButton(favoriteBtn, station);
  });

  store.subscribe('isPlaying', (playing) => {
    playBtn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    freqBar.classList.toggle('playing', playing as boolean);
  });

  store.subscribe('isBuffering', (buffering) => {
    playBtn.classList.toggle('buffering', buffering as boolean);
  });

  store.subscribe('error', (err) => {
    if (err) showToast(err as string);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        audioPlayer.toggle();
        break;
      case 'ArrowRight':
        document.dispatchEvent(new CustomEvent('station-navigate', { detail: 1 }));
        break;
      case 'ArrowLeft':
        document.dispatchEvent(new CustomEvent('station-navigate', { detail: -1 }));
        break;
    }
  });
}
