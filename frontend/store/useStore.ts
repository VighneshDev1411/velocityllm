import { create } from 'zustand';

interface AppState {
  // UI State
  sidebarOpen: boolean;
  theme: 'light' | 'dark';

  // User State
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;

  // Settings
  settings: {
    autoRefresh: boolean;
    refreshInterval: number;
    notifications: boolean;
  };

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setUser: (user: AppState['user']) => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  sidebarOpen: true,
  theme: 'light',
  user: null,
  settings: {
    autoRefresh: true,
    refreshInterval: 5000,
    notifications: true,
  },

  // Actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
  setUser: (user) => set({ user }),
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
}));
