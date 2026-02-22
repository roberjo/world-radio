import { store } from '../store/store.ts';
import { audioPlayer } from '../player/audio.ts';
import { showToast } from '../player/player-ui.ts';
import { buildListUrl } from '../router/router.ts';
import type { Station, StationList, StationListEntry } from '../api/types.ts';

let activeTab: StationList['type'] = 'favorites';

function getPanel(): HTMLElement {
  return document.getElementById('lists-panel')!;
}

export function toggleListsPanel(): void {
  getPanel().classList.toggle('visible');
}

export function openListsPanel(): void {
  getPanel().classList.add('visible');
}

export function closeListsPanel(): void {
  getPanel().classList.remove('visible');
}

function getListsForTab(tab: StationList['type']): StationList[] {
  return store.get('stationLists').filter(l => l.type === tab);
}

function renderContent(): void {
  const content = document.getElementById('lists-content')!;
  const lists = getListsForTab(activeTab);

  if (lists.length === 0) {
    content.innerHTML = '<div class="list-empty">No lists yet</div>';
    return;
  }

  content.innerHTML = lists.map(list => `
    <div class="list-group" data-list-id="${list.id}">
      <div class="list-group-header">
        <span>${list.label} (${list.entries.length})</span>
        <div class="list-group-actions">
          <button class="list-group-btn" data-action="share" data-list-id="${list.id}" title="Share list">Share</button>
          ${list.id !== 'favorites' ? `<button class="list-group-btn" data-action="delete-list" data-list-id="${list.id}" title="Delete list">Delete</button>` : ''}
        </div>
      </div>
      ${list.entries.length === 0
        ? '<div class="list-empty">No stations</div>'
        : list.entries.map(entry => renderRow(entry, list.id)).join('')
      }
    </div>
  `).join('');
}

function renderRow(entry: StationListEntry, listId: string): string {
  const faviconHtml = entry.favicon
    ? `<img src="${escapeAttr(entry.favicon)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'list-row-favicon-placeholder\\'>📻</span>'">`
    : '<span class="list-row-favicon-placeholder">📻</span>';

  return `
    <div class="list-row" data-uuid="${entry.stationuuid}" data-list-id="${listId}">
      <div class="list-row-favicon">${faviconHtml}</div>
      <div class="list-row-info">
        <div class="list-row-name">${escapeHtml(entry.name)}</div>
        <div class="list-row-country">${escapeHtml(entry.country)}</div>
      </div>
      <div class="list-row-actions">
        <button class="list-row-btn" data-action="play" data-uuid="${entry.stationuuid}" title="Play">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
        <button class="list-row-btn" data-action="remove" data-uuid="${entry.stationuuid}" data-list-id="${listId}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function handleContentClick(e: Event): void {
  const target = e.target as HTMLElement;
  const btn = target.closest('[data-action]') as HTMLElement | null;
  if (!btn) {
    // Click on row itself — play station
    const row = target.closest('.list-row') as HTMLElement | null;
    if (row) playStationByUUID(row.dataset.uuid!);
    return;
  }

  const action = btn.dataset.action;
  const uuid = btn.dataset.uuid;
  const listId = btn.dataset.listId;

  switch (action) {
    case 'play':
      if (uuid) playStationByUUID(uuid);
      break;
    case 'remove':
      if (uuid && listId) removeFromList(listId, uuid);
      break;
    case 'share':
      if (listId) shareList(listId);
      break;
    case 'delete-list':
      if (listId) deleteList(listId);
      break;
  }
}

function playStationByUUID(uuid: string): void {
  const station = store.get('stations').get(uuid);
  if (station) {
    audioPlayer.play(station);
    // Dispatch flyTo — map module listens for this
    document.dispatchEvent(new CustomEvent('station-fly-to', { detail: station }));
  } else {
    showToast('Station not loaded — try playing from the map');
  }
}

function removeFromList(listId: string, uuid: string): void {
  const lists = store.get('stationLists').map(l => {
    if (l.id !== listId) return l;
    return { ...l, entries: l.entries.filter(e => e.stationuuid !== uuid) };
  });
  store.set('stationLists', lists);
}

function shareList(listId: string): void {
  const list = store.get('stationLists').find(l => l.id === listId);
  if (!list) return;
  const ids = list.entries.map(e => e.stationuuid);
  if (ids.length === 0) {
    showToast('List is empty');
    return;
  }
  const url = buildListUrl(list.label, ids);
  navigator.clipboard.writeText(url).then(() => {
    showToast('List link copied!');
  }).catch(() => {
    showToast('Failed to copy link');
  });
}

function deleteList(listId: string): void {
  const lists = store.get('stationLists').filter(l => l.id !== listId);
  store.set('stationLists', lists);
  showToast('List deleted');
}

function addCurrentStationToList(): void {
  const station = store.get('currentStation');
  if (!station) return;

  if (activeTab === 'favorites') {
    // Add to favorites directly
    addStationToList('favorites', station);
  } else {
    // For other tabs, if there's exactly one list in this tab, add to that; otherwise show favorites
    const lists = getListsForTab(activeTab);
    if (lists.length === 1) {
      addStationToList(lists[0].id, station);
    } else {
      addStationToList('favorites', station);
    }
  }
}

function addStationToList(listId: string, station: Station): void {
  const lists = store.get('stationLists').map(l => {
    if (l.id !== listId) return l;
    if (l.entries.some(e => e.stationuuid === station.stationuuid)) return l;
    return {
      ...l,
      entries: [...l.entries, {
        stationuuid: station.stationuuid,
        name: station.name,
        country: station.country,
        favicon: station.favicon,
      }],
    };
  });
  store.set('stationLists', lists);
  showToast(`Added to list`);
}

function createCustomList(): void {
  const name = prompt('List name:');
  if (!name || !name.trim()) return;

  const lists = [...store.get('stationLists'), {
    id: crypto.randomUUID(),
    label: name.trim(),
    type: 'custom' as const,
    entries: [],
  }];
  store.set('stationLists', lists);
  activeTab = 'custom';
  updateTabUI();
  renderContent();
}

function updateTabUI(): void {
  document.querySelectorAll('.lists-tab').forEach(tab => {
    const el = tab as HTMLElement;
    el.classList.toggle('active', el.dataset.tab === activeTab);
  });
}

export function openListsPanelWithSharedList(label: string, entries: StationListEntry[]): void {
  // Add as a temporary custom list
  const id = `shared-${Date.now()}`;
  const lists = [...store.get('stationLists'), {
    id,
    label: `Shared: ${label}`,
    type: 'custom' as const,
    entries,
  }];
  store.set('stationLists', lists);
  activeTab = 'custom';
  updateTabUI();
  openListsPanel();
}

export function initListsUI(): void {
  const listsBtn = document.getElementById('btn-lists')!;
  const closeBtn = document.getElementById('lists-close')!;
  const addBtn = document.getElementById('btn-add-to-list')!;
  const createBtn = document.getElementById('btn-create-list')!;
  const content = document.getElementById('lists-content')!;
  const addCurrentDiv = document.getElementById('lists-add-current')!;

  listsBtn.addEventListener('click', toggleListsPanel);
  closeBtn.addEventListener('click', closeListsPanel);
  addBtn.addEventListener('click', addCurrentStationToList);
  createBtn.addEventListener('click', createCustomList);
  content.addEventListener('click', handleContentClick);

  // Tab switching
  document.querySelectorAll('.lists-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = (tab as HTMLElement).dataset.tab as StationList['type'];
      updateTabUI();
      renderContent();
    });
  });

  // Re-render when lists change
  store.subscribe('stationLists', () => renderContent());

  // Show/hide "add current station" button
  store.subscribe('currentStation', (s) => {
    addCurrentDiv.style.display = s ? '' : 'none';
  });

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'l' || e.key === 'L') {
      if (!e.ctrlKey && !e.metaKey) {
        toggleListsPanel();
      }
    }
  });

  // Initial render
  renderContent();
}
