import type { Manifest, OhlcvBar, SymbolSeries } from "../types/market";

/**
 * The rest of the app only ever talks to this interface, never to a file
 * format directly. Today it's backed by static JSON checked into the repo
 * (see scripts/excel_to_json.py). A future provider (live NSE API, a
 * backend, IndexedDB cache, etc.) can implement the same interface without
 * touching any indicator, ranking, or UI code.
 */
export interface DataProvider {
  getSymbols(): Promise<string[]>;
  getOhlcv(symbol: string): Promise<SymbolSeries>;
}

const DATA_BASE = "data"; // resolved relative to Vite's `base`, see vite.config.ts

class JsonDataProvider implements DataProvider {
  private manifestPromise: Promise<Manifest> | null = null;
  private seriesCache = new Map<string, Promise<SymbolSeries>>();

  private loadManifest(): Promise<Manifest> {
    if (!this.manifestPromise) {
      this.manifestPromise = fetch(`${DATA_BASE}/manifest.json`).then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load manifest.json (${res.status})`);
        }
        return res.json() as Promise<Manifest>;
      });
    }
    return this.manifestPromise;
  }

  async getSymbols(): Promise<string[]> {
    const manifest = await this.loadManifest();
    return manifest.symbols.map((s) => s.symbol).sort();
  }

  getOhlcv(symbol: string): Promise<SymbolSeries> {
    const existing = this.seriesCache.get(symbol);
    if (existing) return existing;

    const promise = this.loadManifest().then(async (manifest) => {
      const entry = manifest.symbols.find((s) => s.symbol === symbol);
      if (!entry) {
        throw new Error(`Unknown symbol: ${symbol}`);
      }
      const res = await fetch(`${DATA_BASE}/${entry.file}`);
      if (!res.ok) {
        throw new Error(`Failed to load ${entry.file} (${res.status})`);
      }
      const bars = (await res.json()) as OhlcvBar[];
      return { symbol, bars };
    });

    this.seriesCache.set(symbol, promise);
    return promise;
  }
}

/** Singleton provider used throughout the app. Swap this line to change data source. */
export const dataProvider: DataProvider = new JsonDataProvider();
