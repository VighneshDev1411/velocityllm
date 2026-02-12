import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TokenMetrics {
  total_tokens_counted: number;
  cache_size: number;
  contexts_created: number;
  active_contexts: number;
  budgets_allocated: number;
}

interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number;
}

interface DataState {
  // Metrics cache
  tokenMetrics: TokenMetrics | null;
  workerMetrics: any | null;
  streamMetrics: any | null;
  cacheMetrics: any | null;

  // Data cache with TTL
  dataCache: Map<string, CacheEntry>;

  // Loading states
  isLoading: {
    tokens: boolean;
    workers: boolean;
    streams: boolean;
    cache: boolean;
  };

  // Error states
  errors: {
    tokens: string | null;
    workers: string | null;
    streams: string | null;
    cache: string | null;
  };

  // Filters and preferences
  filters: {
    dateRange: { start: Date | null; end: Date | null };
    workers: string[];
    status: string[];
  };

  preferences: {
    refreshInterval: number;
    chartType: 'line' | 'bar' | 'area';
    showLegend: boolean;
    compactView: boolean;
  };

  // Actions
  setTokenMetrics: (metrics: TokenMetrics) => void;
  setWorkerMetrics: (metrics: any) => void;
  setStreamMetrics: (metrics: any) => void;
  setCacheMetrics: (metrics: any) => void;

  setLoading: (key: keyof DataState['isLoading'], value: boolean) => void;
  setError: (key: keyof DataState['errors'], value: string | null) => void;

  // Cache management
  setCacheData: (key: string, value: any, ttl?: number) => void;
  getCacheData: (key: string) => any | null;
  clearCacheData: (key?: string) => void;
  invalidateCache: () => void;

  // Filters
  setFilters: (filters: Partial<DataState['filters']>) => void;
  clearFilters: () => void;

  // Preferences
  setPreferences: (prefs: Partial<DataState['preferences']>) => void;
  resetPreferences: () => void;
}

const DEFAULT_TTL = 60000; // 1 minute

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      // Initial state
      tokenMetrics: null,
      workerMetrics: null,
      streamMetrics: null,
      cacheMetrics: null,

      dataCache: new Map(),

      isLoading: {
        tokens: false,
        workers: false,
        streams: false,
        cache: false,
      },

      errors: {
        tokens: null,
        workers: null,
        streams: null,
        cache: null,
      },

      filters: {
        dateRange: { start: null, end: null },
        workers: [],
        status: [],
      },

      preferences: {
        refreshInterval: 5000,
        chartType: 'line',
        showLegend: true,
        compactView: false,
      },

      // Actions
      setTokenMetrics: (metrics) => set({ tokenMetrics: metrics }),
      setWorkerMetrics: (metrics) => set({ workerMetrics: metrics }),
      setStreamMetrics: (metrics) => set({ streamMetrics: metrics }),
      setCacheMetrics: (metrics) => set({ cacheMetrics: metrics }),

      setLoading: (key, value) =>
        set((state) => ({
          isLoading: { ...state.isLoading, [key]: value },
        })),

      setError: (key, value) =>
        set((state) => ({
          errors: { ...state.errors, [key]: value },
        })),

      // Cache management
      setCacheData: (key, value, ttl = DEFAULT_TTL) => {
        const cache = get().dataCache;
        cache.set(key, {
          key,
          value,
          timestamp: Date.now(),
          ttl,
        });
        set({ dataCache: new Map(cache) });
      },

      getCacheData: (key) => {
        const cache = get().dataCache;
        const entry = cache.get(key);

        if (!entry) return null;

        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
          cache.delete(key);
          set({ dataCache: new Map(cache) });
          return null;
        }

        return entry.value;
      },

      clearCacheData: (key) => {
        if (key) {
          const cache = get().dataCache;
          cache.delete(key);
          set({ dataCache: new Map(cache) });
        } else {
          set({ dataCache: new Map() });
        }
      },

      invalidateCache: () => {
        const cache = get().dataCache;
        const now = Date.now();

        // Remove expired entries
        for (const [key, entry] of cache.entries()) {
          if (now - entry.timestamp > entry.ttl) {
            cache.delete(key);
          }
        }

        set({ dataCache: new Map(cache) });
      },

      // Filters
      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      clearFilters: () =>
        set({
          filters: {
            dateRange: { start: null, end: null },
            workers: [],
            status: [],
          },
        }),

      // Preferences
      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      resetPreferences: () =>
        set({
          preferences: {
            refreshInterval: 5000,
            chartType: 'line',
            showLegend: true,
            compactView: false,
          },
        }),
    }),
    {
      name: 'velocityllm-data-store',
      partialize: (state) => ({
        preferences: state.preferences,
        filters: state.filters,
      }),
    }
  )
);
