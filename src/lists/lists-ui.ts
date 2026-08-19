import { store } from '../store/store.ts';
import { audioPlayer } from '../player/audio.ts';
import { showToast } from '../player/player-ui.ts';
import { buildListUrl } from '../router/router.ts';
import { loadCustomStations, saveCustomStations } from '../store/persistence.ts';
import { escapeHtml, escapeAttr } from '../utils/html.ts';
import { geocodeLocation } from '../api/geocode.ts';
import { appendCustomStations } from '../map/clusters.ts';
import { testStreamUrl } from '../utils/stream-check.ts';
import { getHealthStatus, onHealthChange } from './health-check.ts';
import { parsePlaylist } from '../utils/playlist-parser.ts';
import { STATION_PACKS, fetchStationPack, type StationPackMeta } from '../utils/station-packs.ts';
import { t, onLanguageChange } from '../i18n/i18n.ts';
import { isLikelyMixedContentBlocked } from '../utils/mixed-content.ts';
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
    content.innerHTML = `<div class="list-empty">${t('lists.noListsYet')}</div>`;
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
        ? `<div class="list-empty">${t('lists.empty')}</div>`
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
        ? `<div class="list-empty">${t('lists.empty')}</div>`
        : list.entries.map(entry => renderRow(entry, list.id)).join('')
      }
    </div>
  `;
}

function renderRow(entry: StationListEntry, listId: string): string {
  const faviconHtml = entry.favicon
    ? `<img src="${escapeAttr(entry.favicon)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'list-row-favicon-placeholder\\'>📻</span>'">`
    : '<span class="list-row-favicon-placeholder">📻</span>';

  const healthBadge = getHealthStatus(entry.stationuuid) === 'dead'
    ? '<span class="list-row-health-warning" title="This stream failed to play last time — it may be down">⚠</span>'
    : '';

  return `
    <div class="list-row" data-uuid="${entry.stationuuid}" data-list-id="${listId}">
      <div class="list-row-favicon">${faviconHtml}</div>
      <div class="list-row-info">
        <div class="list-row-name">${escapeHtml(entry.name)}${healthBadge}</div>
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
    showToast(t('lists.stationNotLoaded'));
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
    showToast(t('lists.listLinkCopied'));
  }).catch(() => {
    showToast('Failed to copy link');
  });
}

function deleteList(listId: string): void {
  if (drillListId === listId) drillListId = null;
  const lists = store.get('stationLists').filter(l => l.id !== listId);
  store.set('stationLists', lists);
  showToast(t('lists.listDeleted'));
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

async function addCustomStation(
  name: string,
  url: string,
  location: string,
  tags: string,
  favicon: string,
  onStatus: (msg: string) => void,
): Promise<void> {
  const uuid = `custom:${crypto.randomUUID()}`;

  let geo_lat = 0;
  let geo_long = 0;
  let country = '';
  if (location) {
    onStatus('Locating on the map…');
    const geo = await geocodeLocation(location);
    if (geo) {
      geo_lat = geo.lat;
      geo_long = geo.lon;
      country = geo.country;
    } else {
      country = location;
    }
  }

  const isHls = url.includes('.m3u8');
  if (!isHls) {
    onStatus('Checking stream…');
    const ok = await testStreamUrl(url);
    if (!ok) {
      onStatus(
        isLikelyMixedContentBlocked(url)
          ? "Couldn't verify it — this URL is http:// and most browsers block that on a secure site like this one, so it likely won't play. Saving it anyway in case you have an https:// link handy."
          : 'Could not verify the stream — saving it anyway.'
      );
    }
  }

  const station: Station = {
    stationuuid: uuid,
    name: name.trim(),
    url, url_resolved: url,
    homepage: '', favicon,
    country, countrycode: '', state: '', city: '', language: '',
    tags: tags || 'custom',
    codec: '', bitrate: 0,
    hls: isHls ? 1 : 0,
    lastcheckok: 1,
    clickcount: 0, clicktrend: 0, votes: 0,
    geo_lat, geo_long,
  };

  const existing = await loadCustomStations();
  await saveCustomStations([...existing, station]);

  const stationMap = store.get('stations');
  stationMap.set(uuid, station);
  store.set('stations', stationMap);

  if (geo_lat !== 0 || geo_long !== 0) {
    appendCustomStations([station]);
  }

  addToMyStationsList(station);
  showToast(t('lists.stationAdded'));
}

async function importStationPack(meta: StationPackMeta): Promise<void> {
  const pack = await fetchStationPack(meta);

  const stationMap = store.get('stations');
  const existingCustom = await loadCustomStations();
  const existingIds = new Set(existingCustom.map(s => s.stationuuid));
  const newToPersist = pack.stations.filter(s => !existingIds.has(s.stationuuid));

  for (const s of pack.stations) stationMap.set(s.stationuuid, s);
  store.set('stations', stationMap);

  if (newToPersist.length > 0) {
    await saveCustomStations([...existingCustom, ...newToPersist]);
    const geoStations = newToPersist.filter(s => s.geo_lat !== 0 || s.geo_long !== 0);
    if (geoStations.length > 0) appendCustomStations(geoStations);
  }

  const entries: StationListEntry[] = pack.stations.map(s => ({
    stationuuid: s.stationuuid,
    name: s.name,
    country: s.country,
    favicon: s.favicon,
  }));

  activeTab = 'custom';
  updateTabUI();

  const listId = `pack:${pack.id}`;
  const lists = store.get('stationLists');
  const existingIndex = lists.findIndex(l => l.id === listId);
  if (existingIndex >= 0) {
    const updated = [...lists];
    updated[existingIndex] = { ...updated[existingIndex], entries };
    store.set('stationLists', updated);
  } else {
    store.set('stationLists', [...lists, { id: listId, label: pack.label, type: 'custom' as const, entries }]);
  }
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
  const modalStatus = document.getElementById('modal-add-station-status')!;
  const modalSubmitBtn = modalForm.querySelector('.modal-submit-btn') as HTMLButtonElement;

  const modalFieldNames = ['station-name', 'station-url', 'station-location', 'station-tags', 'station-favicon'];

  const togglePlaylistBtn = document.getElementById('btn-toggle-playlist-paste')!;
  const playlistSection = document.getElementById('playlist-paste-section')!;
  const playlistInput = document.getElementById('input-playlist-paste') as HTMLTextAreaElement;
  const playlistParseBtn = document.getElementById('btn-parse-playlist')!;
  const playlistStatus = document.getElementById('playlist-paste-status')!;

  addStationUrlBtn.addEventListener('click', () => {
    for (const field of modalFieldNames) {
      (modalForm.elements.namedItem(field) as HTMLInputElement).value = '';
    }
    modalError.textContent = '';
    modalStatus.textContent = '';
    playlistInput.value = '';
    playlistStatus.textContent = '';
    playlistSection.hidden = true;
    modal.classList.add('visible');
    (modalForm.elements.namedItem('station-name') as HTMLInputElement).focus();
  });

  togglePlaylistBtn.addEventListener('click', () => {
    playlistSection.hidden = !playlistSection.hidden;
    if (!playlistSection.hidden) playlistInput.focus();
  });

  playlistParseBtn.addEventListener('click', () => {
    const parsed = parsePlaylist(playlistInput.value);
    if (!parsed) {
      playlistStatus.textContent = "Couldn't find a stream URL in that text.";
      return;
    }
    const nameField = modalForm.elements.namedItem('station-name') as HTMLInputElement;
    const urlField = modalForm.elements.namedItem('station-url') as HTMLInputElement;
    urlField.value = parsed.url;
    if (parsed.name && !nameField.value.trim()) nameField.value = parsed.name;
    playlistStatus.textContent = 'Filled in the name and URL above — review, then add the station.';
  });

  modalClose.addEventListener('click', () => modal.classList.remove('visible'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('visible'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('visible')) modal.classList.remove('visible');
  });

  modalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name     = ((modalForm.elements.namedItem('station-name')     as HTMLInputElement).value).trim();
    const url      = ((modalForm.elements.namedItem('station-url')      as HTMLInputElement).value).trim();
    const location = ((modalForm.elements.namedItem('station-location') as HTMLInputElement).value).trim();
    const tags     = ((modalForm.elements.namedItem('station-tags')     as HTMLInputElement).value).trim();
    const favicon  = ((modalForm.elements.namedItem('station-favicon')  as HTMLInputElement).value).trim();
    if (!name) { modalError.textContent = 'Please enter a station name.'; return; }
    if (!url)  { modalError.textContent = 'Please enter a stream URL.'; return; }
    try {
      const p = new URL(url);
      if (p.protocol !== 'http:' && p.protocol !== 'https:') throw new Error();
    } catch {
      modalError.textContent = 'URL must start with http:// or https://';
      return;
    }
    if (favicon) {
      try {
        const p = new URL(favicon);
        if (p.protocol !== 'http:' && p.protocol !== 'https:') throw new Error();
      } catch {
        modalError.textContent = 'Favicon URL must start with http:// or https://';
        return;
      }
    }
    modalError.textContent = '';
    modalSubmitBtn.disabled = true;
    addCustomStation(name, url, location, tags, favicon, (msg) => { modalStatus.textContent = msg; })
      .then(() => { modal.classList.remove('visible'); })
      .catch(() => { modalError.textContent = 'Something went wrong adding the station.'; })
      .finally(() => {
        modalSubmitBtn.disabled = false;
        modalStatus.textContent = '';
      });
  });

  // Station packs
  const browsePacksBtn = document.getElementById('btn-browse-packs')!;
  const packsModal = document.getElementById('modal-station-packs')!;
  const packsModalClose = document.getElementById('modal-station-packs-close')!;
  const packsList = document.getElementById('station-packs-list')!;

  function renderStationPacks(): void {
    packsList.innerHTML = STATION_PACKS.map(meta => `
      <div class="station-pack-card" data-pack-id="${meta.id}">
        <div class="station-pack-label">${escapeHtml(meta.label)} <span class="station-pack-count">(${meta.count} stations)</span></div>
        <p class="station-pack-description">${escapeHtml(meta.description)}</p>
        <button type="button" class="station-pack-import-btn" data-pack-id="${meta.id}">Import pack</button>
      </div>
    `).join('');
  }

  browsePacksBtn.addEventListener('click', () => {
    renderStationPacks();
    packsModal.classList.add('visible');
  });
  packsModalClose.addEventListener('click', () => packsModal.classList.remove('visible'));
  packsModal.addEventListener('click', (e) => { if (e.target === packsModal) packsModal.classList.remove('visible'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && packsModal.classList.contains('visible')) packsModal.classList.remove('visible');
  });

  packsList.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.station-pack-import-btn') as HTMLButtonElement | null;
    if (!btn) return;
    const meta = STATION_PACKS.find(p => p.id === btn.dataset.packId);
    if (!meta) return;
    btn.disabled = true;
    btn.textContent = 'Importing…';
    importStationPack(meta)
      .then(() => {
        btn.textContent = 'Imported ✓';
        showToast(`Imported ${meta.label}`);
      })
      .catch(() => {
        btn.disabled = false;
        btn.textContent = 'Import pack';
        showToast('Could not import that pack');
      });
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

  // Re-render when a station's playback health changes (see health-check.ts)
  onHealthChange(() => renderContent());

  // Re-render when the language changes (list content is regenerated, not data-i18n driven)
  onLanguageChange(() => renderContent());

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
