# World Radio

An interactive web app for exploring and listening to radio stations worldwide via a real-time map. Tune into thousands of live broadcasts from every continent — no account required.

**[Live Demo](https://roberjo.github.io/world-radio/)**

## Features

### Interactive Map
- Dark-themed Leaflet map with CartoDB tiles
- 5,000+ geo-located stations loaded on startup via the [Radio Browser API](https://www.radio-browser.info/)
- Supercluster-based point clustering (radius 60px, up to zoom 14) for smooth performance
- Click a cluster to expand, click a station to start listening
- Active station marker stays visible even when surrounding stations are clustered

### Audio Player
- Dual-protocol playback: native HTML5 audio with HLS.js fallback for `.m3u8` streams
- Buffering detection with 15-second timeout and automatic recovery
- Persistent player bar with play/pause, previous/next, volume control
- Favorite and share buttons for the current station

### Radio Scanner
- Auto-play mode that cycles through stations in a geographic region
- 7 regions: Worldwide, Europe, North America, South America, Africa, Asia, Oceania
- Smart shuffle: 70% popular stations (by click count) + 30% random discovery
- 12-second dwell time per station with skip and pause controls
- Compact horizontal UI that adjusts when the Station Lists panel is open

### Station Lists
- Favorites, Genre, Country, and Custom list categories
- Add the currently playing station to any list
- Create and delete custom lists
- Share lists via URL — recipients get a deep link that loads the stations
- Persisted to localStorage across sessions
- Panel opens by default on page load

### Deep Linking
- Share individual stations via URL (`#station=<uuid>`)
- Share curated lists via URL with encoded station IDs
- Stations not yet loaded are fetched on demand from the API

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Left Arrow` | Previous station |
| `Right Arrow` | Next station |
| `S` | Toggle scanner |
| `L` | Toggle station lists |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode, ES2020 target) |
| Build | Vite 7 |
| Map | Leaflet + CartoDB dark tiles |
| Clustering | Supercluster |
| Audio | HTML5 Audio + HLS.js |
| State | Custom observer-pattern Store (no framework) |
| Styling | Vanilla CSS with CSS variables, glassmorphism, dark theme |
| Deployment | GitHub Pages via GitHub Actions |

No frontend framework (React, Vue, etc.) — the entire app is vanilla TypeScript with manual DOM manipulation.

## Project Structure

```
src/
├── api/
│   ├── radio-browser.ts    # API client with 4 fallback servers
│   └── types.ts            # All TypeScript interfaces
├── lists/
│   └── lists-ui.ts         # Station lists panel UI
├── map/
│   ├── clusters.ts         # Supercluster integration & markers
│   └── map.ts              # Leaflet map initialization
├── player/
│   ├── audio.ts            # Dual-protocol audio engine
│   └── player-ui.ts        # Player bar UI & controls
├── router/
│   └── router.ts           # Hash-based routing & deep links
├── scanner/
│   ├── scanner.ts          # Scanner logic & queue management
│   └── scanner-ui.ts       # Scanner overlay UI
├── store/
│   ├── persistence.ts      # localStorage read/write for lists
│   └── store.ts            # Observable state store
├── utils/
│   ├── debounce.ts         # Debounce utility
│   ├── format.ts           # Number formatting (cluster labels)
│   └── geo.ts              # Region definitions & bounds
├── main.ts                 # App entry point & initialization
└── style.css               # All styles (dark theme, glassmorphism)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Development

```bash
# Install dependencies
npm install

# Start dev server with HMR
npm run dev
```

The dev server starts at `http://localhost:5173`.

### Production Build

```bash
# Type-check and build
npm run build

# Preview the build locally
npm run preview
```

Output goes to `dist/`.

## Architecture

### State Management

A single `AppState` object managed by a custom `Store` class using an observer pattern (Map of listeners). Components subscribe to specific keys and react to changes:

```typescript
store.subscribe('currentStation', (station) => { /* update UI */ });
store.set('currentStation', newStation);
```

### Audio Pipeline

1. User clicks station (map, list, scanner, or deep link)
2. `audioPlayer.play(station)` tries native HTML5 `<audio>` first
3. If the URL ends in `.m3u8` or native playback fails, falls back to HLS.js
4. Buffering state tracked and surfaced to the UI with a 15-second timeout
5. Volume synced bidirectionally with the store

### Map Rendering

On every `moveend`/`zoomend` (debounced 100ms):
1. Query Supercluster for features in the current bounding box at the current zoom
2. Render clusters as sized circle markers, individual stations as amber dots
3. Active (playing) station rendered as a standalone marker above the cluster layer so it's always visible

### API

Fetches from the [Radio Browser API](https://api.radio-browser.info/) with 4 hardcoded server URLs and automatic rotation on failure. Loads the top 5,000 stations with geo coordinates on init.

## Deployment

Automated via GitHub Actions (`.github/workflows/deploy.yml`):

1. Push to `main` triggers a build
2. `npm ci && npm run build` produces the `dist/` folder
3. Uploaded as a GitHub Pages artifact and deployed

Vite `base` is set to `'./'` for relative asset paths. The `.nojekyll` file prevents GitHub Pages from running Jekyll on the output.

## License

[GPL-3.0](LICENSE)
