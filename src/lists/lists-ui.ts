import { store } from '../store/store.ts';
import { audioPlayer } from '../player/audio.ts';
import { showToast } from '../player/player-ui.ts';
import { buildListUrl } from '../router/router.ts';
import { loadCustomStations, saveCustomStations } from '../store/persistence.ts';
import { escapeHtml, escapeAttr } from '../utils/html.ts';
import type { Station, StationList, StationListEntry } from '../api/types.ts';

let activeTab: StationList['type'] = 'favorites';
let drillListId: string | null = null;

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

  // Favorites tab is always flat (no drill-down)
  if (activeTab === 'favorites') {
    content.innerHTML = renderFlatLists(lists);
    return;
  }

  // Drill-down view
  if (drillListId) {
    const list = lists.find(l => l.id === drillListId);
    if (!list) {
      drillListId = null;
      renderContent();
      return;
    }
    content.innerHTML = renderDrillDown(list);
    return;
  }

  // Category grid view
  content.innerHTML = renderCategoryGrid(lists);
}

function renderFlatLists(lists: StationList[]): string {
  return lists.map(list => `
    <div class="list-group" data-list-id="${list.id}">
      <div class="list-group-header">
        <span>${escapeHtml(list.label)} (${list.entries.length})</span>
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

function renderCategoryGrid(lists: StationList[]): string {
  return `<div class="list-card-grid">${lists.map(list => {
    const previews = list.entries.slice(0, 4).map(e =>
      e.favicon
        ? `<img src="${escapeAttr(e.favicon)}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : ''
    ).filter(Boolean).join('');

    return `
      <div class="list-card" data-action="drill" data-list-id="${list.id}">
        <div class="list-card-label">${escapeHtml(list.label)}</div>
        <div class="list-card-count">${list.entries.length} station${list.entries.length !== 1 ? 's' : ''}</div>
        ${previews ? `<div class="list-card-previews">${previews}</div>` : ''}
      </div>
    `;
  }).join('')}</div>`;
}

function renderDrillDown(list: StationList): string {
  return `
    <div class="list-drill-back" data-action="back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
      Back
    </div>
    <div class="list-group" data-list-id="${list.id}">
      <div class="list-group-header">
        <span>${escapeHtml(list.label)} (${list.entries.length})</span>
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
  `;
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
    case 'drill':
      if (listId) {
        drillListId = listId;
        renderContent();
      }
      break;
    case 'back':
      drillListId = null;
      renderContent();
      break;
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
    if (station.geo_lat || station.geo_long) {
      document.dispatchEvent(new CustomEvent('station-fly-to', { detail: station }));
    }
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
  if (drillListId === listId) drillListId = null;
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

const MY_STATIONS_ID = 'custom:my-stations';

function addToMyStationsList(station: Station): void {
  const entry: StationListEntry = {
    stationuuid: station.stationuuid,
    name: station.name,
    country: station.country,
    favicon: station.favicon,
  };
  const lists = store.get('stationLists');
  const exists = lists.find(l => l.id === MY_STATIONS_ID);
  if (exists) {
    store.set('stationLists', lists.map(l =>
      l.id === MY_STATIONS_ID ? { ...l, entries: [...l.entries, entry] } : l
    ));
  } else {
    store.set('stationLists', [...lists, {
      id: MY_STATIONS_ID,
      label: 'My Stations',
      type: 'custom' as const,
      entries: [entry],
    }]);
  }
  activeTab = 'custom';
  drillListId = MY_STATIONS_ID;
  updateTabUI();
  renderContent();
}

function addCustomStation(name: string, url: string): void {
  const uuid = `custom:${crypto.randomUUID()}`;
  const station: Station = {
    stationuuid: uuid,
    name: name.trim(),
    url, url_resolved: url,
    homepage: '', favicon: '',
    country: '', countrycode: '', state: '', city: '', language: '',
    tags: 'custom',
    codec: '', bitrate: 0,
    hls: url.includes('.m3u8') ? 1 : 0,
    lastcheckok: 1,
    clickcount: 0, clicktrend: 0, votes: 0,
    geo_lat: 0, geo_long: 0,
  };

  const existing = loadCustomStations();
  saveCustomStations([...existing, station]);

  const stationMap = store.get('stations');
  stationMap.set(uuid, station);
  store.set('stations', stationMap);

  addToMyStationsList(station);
  showToast('Station added');
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

  const addStationUrlBtn = document.getElementById('btn-add-station-url')!;
  const modal = document.getElementById('modal-add-station')!;
  const modalClose = document.getElementById('modal-add-station-close')!;
  const modalForm = document.getElementById('form-add-station') as HTMLFormElement;
  const modalError = document.getElementById('modal-add-station-error')!;

  addStationUrlBtn.addEventListener('click', () => {
    (modalForm.elements.namedItem('station-name') as HTMLInputElement).value = '';
    (modalForm.elements.namedItem('station-url') as HTMLInputElement).value = '';
    modalError.textContent = '';
    modal.classList.add('visible');
    (modalForm.elements.namedItem('station-name') as HTMLInputElement).focus();
  });

  modalClose.addEventListener('click', () => modal.classList.remove('visible'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('visible'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('visible')) modal.classList.remove('visible');
  });

  modalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = ((modalForm.elements.namedItem('station-name') as HTMLInputElement).value).trim();
    const url  = ((modalForm.elements.namedItem('station-url')  as HTMLInputElement).value).trim();
    if (!name) { modalError.textContent = 'Please enter a station name.'; return; }
    if (!url)  { modalError.textContent = 'Please enter a stream URL.'; return; }
    try {
      const p = new URL(url);
      if (p.protocol !== 'http:' && p.protocol !== 'https:') throw new Error();
    } catch {
      modalError.textContent = 'URL must start with http:// or https://';
      return;
    }
    addCustomStation(name, url);
    modal.classList.remove('visible');
  });

  // Tab switching
  document.querySelectorAll('.lists-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = (tab as HTMLElement).dataset.tab as StationList['type'];
      drillListId = null;
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
