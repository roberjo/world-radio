import type { AppState } from '../api/types.ts';

type Listener<T> = (value: T) => void;

class Store {
  private state: AppState;
  private listeners = new Map<keyof AppState, Set<Listener<unknown>>>();

  constructor() {
    this.state = {
      stations: new Map(),
      currentStation: null,
      isPlaying: false,
      isBuffering: false,
      volume: 0.7,
      scannerMode: 'idle',
      scannerRegion: 'all',
      loading: false,
      error: null,
    };
  }

  get<K extends keyof AppState>(key: K): AppState[K] {
    return this.state[key];
  }

  set<K extends keyof AppState>(key: K, value: AppState[K]): void {
    this.state[key] = value;
    this.notify(key);
  }

  subscribe<K extends keyof AppState>(key: K, fn: Listener<AppState[K]>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = this.listeners.get(key)!;
    set.add(fn as Listener<unknown>);
    return () => set.delete(fn as Listener<unknown>);
  }

  private notify(key: keyof AppState): void {
    const set = this.listeners.get(key);
    if (set) {
      const value = this.state[key];
      set.forEach(fn => fn(value));
    }
  }
}

export const store = new Store();
