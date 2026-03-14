# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

World Radio is an interactive web app for exploring and listening to radio stations worldwide via an interactive map. Built with vanilla TypeScript and Vite (no framework like React/Vue).

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — TypeScript type-check + Vite production build (`tsc && vite build`)
- `npm run preview` — Preview production build locally

There are no tests or linting commands configured.

## Architecture

### State Management
Custom observer-pattern `Store` class in `src/store/store.ts` using a Map of listeners. All shared state (stations, playback, scanner mode, volume) lives in a single `AppState` object. Components subscribe to specific keys and react to changes via `set()`.

### Audio Playback (`src/player/audio.ts`)
Dual-protocol engine: tries native HTML5 audio first, falls back to HLS.js for `.m3u8` streams. Has buffering detection with a 15-second timeout. Volume is synced with the store.

### Map & Clustering (`src/map/`)
Leaflet map with CartoDB dark tiles. Supercluster handles point clustering (radius 60px, maxZoom 14). Markers are dynamically rendered on map move/zoom. Clicking a station triggers flyTo animation and starts playback.

### Scanner (`src/scanner/`)
Region-based auto-play that cycles through stations in geographic areas (7 regions defined in `src/utils/geo.ts`). Uses a smart shuffle: 70% popular stations (by clickcount) + 30% random. 12-second dwell time per station.

### API (`src/api/radio-browser.ts`)
Fetches from the Radio Browser API with 4 hardcoded fallback servers and automatic rotation on failure. Loads top 5000 geo-enabled stations on init.

### Types
All TypeScript interfaces are in `src/api/types.ts` — Station, AppState, GeoJSON feature types, scanner state, etc.

## Deployment

GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`). Vite `base` is set to `'./'` for relative paths. The `.nojekyll` file disables Jekyll processing.

## Key Conventions

- TypeScript strict mode is enabled (noUnusedLocals, noUnusedParameters)
- ES2020 target with ESNext modules
- Manual chunk splitting in `vite.config.ts`: leaflet and supercluster are separate bundles
- Dark theme with amber accent (`#f59e0b`), glassmorphism styling
- Keyboard shortcuts: Space (play/pause), arrows (prev/next station), S (toggle scanner)
