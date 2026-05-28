export interface TileCoord {
  x: number;
  y: number;
  zoom: number;
}

export interface TileRow {
  id: number;
  x: number;
  y: number;
  zoom: number;
  discovered_at: number;
  updated_at: number;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
}

export interface GpsLogRow extends GpsPoint {
  id: number;
  session_id: number;
}

export interface Session {
  id: number;
  started_at: number;
  ended_at: number | null;
  distance_m: number;
  avg_speed: number;
  tiles_opened: number;
  xp_earned: number;
}

export interface Chest {
  id: number;
  tile_x: number;
  tile_y: number;
  zoom: number;
  rarity: ChestRarity;
  placed_at: number;
  collected_at: number | null;
  collected_by_session: number | null;
}

export type ChestRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: number;
  key: string;
  title: string;
  description: string;
  unlocked_at: number | null;
  progress_current: number;
  progress_max: number;
}

export interface PlayerStats {
  id: number;
  total_xp: number;
  level: number;
  total_tiles_opened: number;
  total_distance_m: number;
  chests_collected: number;
  night_tiles: number;
}

export interface District {
  id: string;
  name: string;
  bounds: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  };
}

export interface ChestReward {
  rarity: ChestRarity;
  xp: number;
  label: string;
}

// ====== BOUNDING BOX (Module 1) ======
export type AreaGeometry =
  | { type: 'bbox'; minLat: number; minLng: number; maxLat: number; maxLng: number }
  | { type: 'polygon'; coords: Array<[number, number]> };

export interface SessionArea {
  id: number;
  sessionId: number;
  geometry: AreaGeometry;
  createdAt: number;
}

// ====== PHOTO TASKS (Module 2) ======
export interface PhotoTask {
  id: number;
  sessionId: number;
  tileX: number;
  tileY: number;
  zoom: number;
  targetLat: number;
  targetLng: number;
  description: string;
  photoOriginalPath: string | null;
  photoThumbPath: string | null;
  completedAt: number | null;
  createdAt: number;
}

// ====== HIDDEN TREASURES (Module 3) ======
export interface HiddenTreasure {
  id: number;
  sessionId: number;
  tileX: number;
  tileY: number;
  zoom: number;
  targetLat: number;
  targetLng: number;
  circleCenterLat: number;
  circleCenterLng: number;
  circleRadiusM: number;
  collectedAt: number | null;
  xpReward: number;
}

// ====== SESSION SUMMARY (Module 4) ======
export interface SessionSummary {
  sessionId: number;
  distanceM: number;
  exploredAreaM2: number;
  newTiles: number;
  photosCompleted: number;
  totalPhotos: number;
  treasuresFound: number;
  xpEarned: number;
  avgSpeed: number;
  durationSec: number;
}

// ====== SYNC (Module 5) ======
export interface SyncPayload {
  deviceId: string;
  syncedAt: number;
  sessions: Array<{
    session: Session & { explored_area_m2: number; photos_completed: number; treasures_found: number };
    gpsLog: Array<{ lat: number; lng: number; timestamp: number; accuracy: number }>;
    photoTasks: Array<{ id: number; description: string; completedAt: number | null }>;
    hiddenTreasures: Array<{ id: number; targetLat: number; targetLng: number; collectedAt: number | null }>;
    area: AreaGeometry | null;
  }>;
}

export type SyncResult =
  | { success: true; sessionsSynced: number }
  | { success: false; reason: string; status?: number };
