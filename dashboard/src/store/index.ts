import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  locale: 'ko' | 'en';
  setLocale: (locale: 'ko' | 'en') => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  locale: 'ko',
  setLocale: (locale) => set({ locale }),
}));
