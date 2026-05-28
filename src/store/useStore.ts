import { create } from 'zustand';
import type { Session, PlayerStats, Achievement, Chest, GpsPoint, TileCoord, AreaGeometry, PhotoTask, HiddenTreasure, SessionSummary } from '../types';

interface AppState {
  isTracking: boolean;
  currentSession: Session | null;
  currentSessionId: number | null;
  gpsBuffer: GpsPoint[];
  lastGpsPoint: GpsPoint | null;
  playerStats: PlayerStats | null;
  achievements: Achievement[];
  discoveredTiles: Set<string>;
  visibleChests: Chest[];
  recentUnlockedAchievements: string[];
  sessionDistance: number;
  dayTilesCount: number;
  rareChestsCollected: number;
  epicChestsCollected: number;
  leggoChestsCollected: number;
  homeLat: number | null;
  homeLng: number | null;

  // Module 1: Bounding Box
  sessionArea: AreaGeometry | null;
  isDrawingArea: boolean;

  // Module 2: Photo Tasks
  photoTasks: PhotoTask[];
  photosCompleted: number;

  // Module 3: Hidden Treasures
  hiddenTreasures: HiddenTreasure[];
  treasuresFound: number;

  // Module 4: Analytics
  sessionSummary: SessionSummary | null;

  setTracking: (tracking: boolean) => void;
  setCurrentSession: (session: Session | null, id: number | null) => void;
  addGpsPoint: (point: GpsPoint) => void;
  clearGpsBuffer: () => void;
  setPlayerStats: (stats: PlayerStats | null) => void;
  setAchievements: (achievements: Achievement[]) => void;
  addDiscoveredTile: (tile: TileCoord) => void;
  addDiscoveredTiles: (tiles: TileCoord[]) => void;
  replaceDiscoveredTiles: (tiles: Set<string>) => void;
  hasTile: (tile: TileCoord) => boolean;
  setVisibleChests: (chests: Chest[]) => void;
  removeVisibleChest: (chestId: number) => void;
  addRecentUnlock: (key: string) => void;
  clearRecentUnlocks: () => void;
  addSessionDistance: (meters: number) => void;
  setDayTilesCount: (count: number) => void;
  incrementDayTiles: (count: number) => void;
  addRareChest: () => void;
  addEpicChest: () => void;
  addLeggoChest: () => void;
  setHome: (lat: number, lng: number) => void;

  // Module 1
  setSessionArea: (geometry: AreaGeometry | null) => void;
  setIsDrawingArea: (drawing: boolean) => void;

  // Module 2
  setPhotoTasks: (tasks: PhotoTask[]) => void;
  incrementPhotosCompleted: () => void;

  // Module 3
  setHiddenTreasures: (treasures: HiddenTreasure[]) => void;
  incrementTreasuresFound: () => void;
  addTreasureXp: (xp: number) => void;

  // Module 4
  setSessionSummary: (summary: SessionSummary | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  isTracking: false,
  currentSession: null,
  currentSessionId: null,
  gpsBuffer: [],
  lastGpsPoint: null,
  playerStats: null,
  achievements: [],
  discoveredTiles: new Set<string>(),
  visibleChests: [],
  recentUnlockedAchievements: [],
  sessionDistance: 0,
  dayTilesCount: 0,
  rareChestsCollected: 0,
  epicChestsCollected: 0,
  leggoChestsCollected: 0,
  homeLat: null,
  homeLng: null,

  // Module 1
  sessionArea: null,
  isDrawingArea: false,

  // Module 2
  photoTasks: [],
  photosCompleted: 0,

  // Module 3
  hiddenTreasures: [],
  treasuresFound: 0,

  // Module 4
  sessionSummary: null,

  setTracking: (tracking) => set({ isTracking: tracking }),

  setCurrentSession: (session, id) => set({ currentSession: session, currentSessionId: id }),

  addGpsPoint: (point) => set((state) => ({
    gpsBuffer: [...state.gpsBuffer, point],
    lastGpsPoint: point,
  })),

  clearGpsBuffer: () => set({ gpsBuffer: [] }),

  setPlayerStats: (stats) => set({ playerStats: stats }),

  setAchievements: (achievements) => set({ achievements }),

  addDiscoveredTile: (tile) => set((state) => {
    const key = `${tile.zoom}/${tile.x}/${tile.y}`;
    const next = new Set(state.discoveredTiles);
    next.add(key);
    return { discoveredTiles: next };
  }),

  addDiscoveredTiles: (tiles) => set((state) => {
    const next = new Set(state.discoveredTiles);
    for (const t of tiles) {
      next.add(`${t.zoom}/${t.x}/${t.y}`);
    }
    return { discoveredTiles: next };
  }),

  replaceDiscoveredTiles: (tiles) => set({ discoveredTiles: new Set(tiles) }),

  hasTile: (tile) => {
    return get().discoveredTiles.has(`${tile.zoom}/${tile.x}/${tile.y}`);
  },

  setVisibleChests: (chests) => set({ visibleChests: chests }),

  removeVisibleChest: (chestId) => set((state) => ({
    visibleChests: state.visibleChests.filter((c) => c.id !== chestId),
  })),

  addRecentUnlock: (key) => set((state) => ({
    recentUnlockedAchievements: [...state.recentUnlockedAchievements, key],
  })),

  clearRecentUnlocks: () => set({ recentUnlockedAchievements: [] }),

  addSessionDistance: (meters) => set((state) => ({
    sessionDistance: state.sessionDistance + meters,
  })),

  setDayTilesCount: (count) => set({ dayTilesCount: count }),

  incrementDayTiles: (count) => set((state) => ({
    dayTilesCount: state.dayTilesCount + count,
  })),

  addRareChest: () => set((state) => ({ rareChestsCollected: state.rareChestsCollected + 1 })),
  addEpicChest: () => set((state) => ({ epicChestsCollected: state.epicChestsCollected + 1 })),
  addLeggoChest: () => set((state) => ({ leggoChestsCollected: state.leggoChestsCollected + 1 })),

  setHome: (lat, lng) => set({ homeLat: lat, homeLng: lng }),

  // Module 1
  setSessionArea: (geometry) => set({ sessionArea: geometry }),
  setIsDrawingArea: (drawing) => set({ isDrawingArea: drawing }),

  // Module 2
  setPhotoTasks: (tasks) => set({ photoTasks: tasks }),
  incrementPhotosCompleted: () => set((state) => ({ photosCompleted: state.photosCompleted + 1 })),

  // Module 3
  setHiddenTreasures: (treasures) => set({ hiddenTreasures: treasures }),
  incrementTreasuresFound: () => set((state) => ({ treasuresFound: state.treasuresFound + 1 })),
  addTreasureXp: (xp) => set((state) => ({
    playerStats: state.playerStats ? { ...state.playerStats, total_xp: state.playerStats.total_xp + xp } : null,
  })),

  // Module 4
  setSessionSummary: (summary) => set({ sessionSummary: summary }),
}));
