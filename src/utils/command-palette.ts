import { store } from '../store/store.ts';
import { audioPlayer } from '../player/audio.ts';
import { flyToStation } from '../map/map.ts';
import { escapeHtml, escapeAttr } from './html.ts';
import { t } from '../i18n/i18n.ts';
import type { Station } from '../api/types.ts';

const MAX_RESULTS = 50;

let selectedIndex = 0;
let currentResults: Station[] = [];

function searchStations(query: string): Station[] {
  const stations = Array.from(store.get('stations').values());
  const q = query.trim().toLowerCase();
  const pool = q
    ? stations.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.tags.toLowerCase().includes(q)
      )
    : stations;
  return [...pool].sort((a, b) => b.clickcount - a.clickcount).slice(0, MAX_RESULTS);
}

function renderResults(results: HTMLElement, stations: Station[]): void {
  currentResults = stations;
  selectedIndex = 0;
  if (stations.length === 0) {
    results.innerHTML = `<div class="command-palette-empty">${t('search.noResults')}</div>`;
    return;
  }
  results.innerHTML = stations.map((s, i) => `
    <button class="command-palette-result${i === 0 ? ' selected' : ''}" data-index="${i}">
      <div class="command-palette-favicon">${s.favicon ? `<img src="${escapeAttr(s.favicon)}" alt="" onerror="this.parentElement.textContent='📻'">` : '📻'}</div>
      <div class="command-palette-result-info">
        <div class="command-palette-result-name">${escapeHtml(s.name)}</div>
        <div class="command-palette-result-meta">${escapeHtml(s.country)}</div>
      </div>
    </button>
  `).join('');
}

function updateSelection(results: HTMLElement): void {
  results.querySelectorAll('.command-palette-result').forEach((el, i) => {
    el.classList.toggle('selected', i === selectedIndex);
  });
  results.querySelector('.command-palette-result.selected')?.scrollIntoView({ block: 'nearest' });
}

function playAndClose(station: Station, overlay: HTMLElement): void {
  audioPlayer.play(station);
  if (station.geo_lat || station.geo_long) flyToStation(station);
  overlay.classList.remove('visible');
}

export function initCommandPalette(): void {
  const overlay = document.getElementById('command-palette-overlay')!;
  const input = document.getElementById('command-palette-input') as HTMLInputElement;
  const results = document.getElementById('command-palette-results')!;

  const open = (): void => {
    overlay.classList.add('visible');
    input.value = '';
    renderResults(results, searchStations(''));
    input.focus();
  };
  const close = (): void => {
    overlay.classList.remove('visible');
  };

  input.addEventListener('input', () => {
    renderResults(results, searchStations(input.value));
  });

  results.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.command-palette-result') as HTMLElement | null;
    if (!btn) return;
    const station = currentResults[Number(btn.dataset.index)];
    if (station) playAndClose(station, overlay);
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (overlay.classList.contains('visible')) close(); else open();
      return;
    }
    if (!overlay.classList.contains('visible')) return;
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      updateSelection(results);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection(results);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const station = currentResults[selectedIndex];
      if (station) playAndClose(station, overlay);
    }
  });
}
