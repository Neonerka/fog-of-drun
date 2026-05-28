import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, MIGRATE_V1_TO_V2, SCHEMA_VERSION } from './schema';
import type {
  TileRow, GpsLogRow, Session, Chest,
  PlayerStats, Achievement, TileCoord, ChestRarity,
  AreaGeometry, SessionArea, PhotoTask, HiddenTreasure,
} from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('fogofdrun.db');
  await initDatabase(db);
  return db;
}

async function initDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(CREATE_TABLES_SQL);

  const version = await database.getFirstAsync<{ version: number }>(
    'PRAGMA user_version',
  );

  if (!version || version.version === 0) {
    // Fresh install — already at latest schema
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  } else if (version.version === 1 && SCHEMA_VERSION >= 2) {
    // Migration v1 → v2
    await database.execAsync(MIGRATE_V1_TO_V2);
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  } else if (version.version < SCHEMA_VERSION) {
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }

  const stats = await database.getFirstAsync<PlayerStats>(
    'SELECT id FROM player_stats WHERE id = 1',
  );
  if (!stats) {
    await database.runAsync(
      `INSERT INTO player_stats (id, total_xp, level, total_tiles_opened, total_distance_m, chests_collected, night_tiles) VALUES (1, 0, 1, 0, 0, 0, 0)`,
    );
  }
}

export async function beginSession(database: SQLite.SQLiteDatabase): Promise<number> {
  const now = Date.now();
  const result = await database.runAsync(
    'INSERT INTO sessions (started_at) VALUES (?)',
    now,
  );
  return result.lastInsertRowId;
}

export async function endSession(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
  distance: number,
  avgSpeed: number,
  tilesOpened: number,
  xpEarned: number,
  exploredAreaM2 = 0,
  photosCompleted = 0,
  treasuresFound = 0,
): Promise<void> {
  await database.runAsync(
    `UPDATE sessions SET ended_at = ?, distance_m = ?, avg_speed = ?, tiles_opened = ?, xp_earned = ?, explored_area_m2 = ?, photos_completed = ?, treasures_found = ? WHERE id = ?`,
    Date.now(), distance, avgSpeed, tilesOpened, xpEarned, exploredAreaM2, photosCompleted, treasuresFound, sessionId,
  );
}

export async function insertGpsBatch(
  database: SQLite.SQLiteDatabase,
  points: Array<{ lat: number; lng: number; timestamp: number; accuracy: number; session_id: number }>,
): Promise<void> {
  if (points.length === 0) return;
  const placeholders = points.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const flat: (number | string)[] = [];
  for (const p of points) {
    flat.push(p.lat, p.lng, p.timestamp, p.accuracy, p.session_id);
  }
  await database.runAsync(
    `INSERT INTO gps_log (lat, lng, timestamp, accuracy, session_id) VALUES ${placeholders}`,
    ...flat,
  );
}

export async function insertNewTiles(
  database: SQLite.SQLiteDatabase,
  tiles: TileCoord[],
  now: number,
): Promise<number> {
  if (tiles.length === 0) return 0;
  let inserted = 0;
  for (const tile of tiles) {
    const result = await database.runAsync(
      `INSERT OR IGNORE INTO tiles (x, y, zoom, discovered_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      tile.x, tile.y, tile.zoom, now, now,
    );
    if (result.changes > 0) inserted++;
  }
  return inserted;
}

export async function getStats(database: SQLite.SQLiteDatabase): Promise<PlayerStats | null> {
  const row = await database.getFirstAsync<PlayerStats>(
    'SELECT * FROM player_stats WHERE id = 1',
  );
  return row ?? null;
}

export async function updateStats(database: SQLite.SQLiteDatabase, delta: {
  xp?: number;
  tiles?: number;
  distance?: number;
  chests?: number;
  nightTiles?: number;
}): Promise<void> {
  const setClauses: string[] = [];
  const params: (string | number)[] = [];
  if (delta.xp !== undefined) {
    setClauses.push('total_xp = total_xp + ?');
    params.push(delta.xp);
  }
  if (delta.tiles !== undefined) {
    setClauses.push('total_tiles_opened = total_tiles_opened + ?');
    params.push(delta.tiles);
  }
  if (delta.distance !== undefined) {
    setClauses.push('total_distance_m = total_distance_m + ?');
    params.push(delta.distance);
  }
  if (delta.chests !== undefined) {
    setClauses.push('chests_collected = chests_collected + ?');
    params.push(delta.chests);
  }
  if (delta.nightTiles !== undefined) {
    setClauses.push('night_tiles = night_tiles + ?');
    params.push(delta.nightTiles);
  }
  if (setClauses.length === 0) return;
  params.push(1);
  await database.runAsync(
    `UPDATE player_stats SET ${setClauses.join(', ')} WHERE id = ?`,
    ...params,
  );
}

export async function insertChest(
  database: SQLite.SQLiteDatabase,
  tile: TileCoord,
  rarity: ChestRarity,
): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO chests (tile_x, tile_y, zoom, rarity, placed_at) VALUES (?, ?, ?, ?, ?)`,
    tile.x, tile.y, tile.zoom, rarity, Date.now(),
  );
}

export async function collectChest(
  database: SQLite.SQLiteDatabase,
  chestId: number,
  sessionId: number,
): Promise<boolean> {
  const result = await database.runAsync(
    `UPDATE chests SET collected_at = ?, collected_by_session = ? WHERE id = ? AND collected_at IS NULL`,
    Date.now(), sessionId, chestId,
  );
  return (result.changes ?? 0) > 0;
}

export async function getChestsAtTile(
  database: SQLite.SQLiteDatabase,
  tile: TileCoord,
): Promise<Chest[]> {
  const rows = await database.getAllAsync<Chest>(
    `SELECT * FROM chests WHERE tile_x = ? AND tile_y = ? AND zoom = ? AND collected_at IS NULL`,
    tile.x, tile.y, tile.zoom,
  );
  return rows;
}

export async function getUncollectedChestsInBounds(
  database: SQLite.SQLiteDatabase,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): Promise<Chest[]> {
  return database.getAllAsync<Chest>(
    `SELECT * FROM chests WHERE tile_x >= ? AND tile_x <= ? AND tile_y >= ? AND tile_y <= ? AND collected_at IS NULL`,
    bounds.minX, bounds.maxX, bounds.minY, bounds.maxY,
  );
}

export async function getAchievements(database: SQLite.SQLiteDatabase): Promise<Achievement[]> {
  return database.getAllAsync<Achievement>('SELECT * FROM achievements ORDER BY id');
}

export async function upsertAchievement(
  database: SQLite.SQLiteDatabase,
  key: string,
  title: string,
  description: string,
  progressCurrent: number,
  progressMax: number,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO achievements (key, title, description, progress_current, progress_max) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET progress_current = MAX(progress_current, ?), progress_max = ?`,
    key, title, description, progressCurrent, progressMax, progressCurrent, progressMax,
  );
}

export async function unlockAchievement(
  database: SQLite.SQLiteDatabase,
  key: string,
): Promise<boolean> {
  const result = await database.runAsync(
    `UPDATE achievements SET unlocked_at = ? WHERE key = ? AND unlocked_at IS NULL`,
    Date.now(), key,
  );
  return (result.changes ?? 0) > 0;
}

export async function isTileDiscovered(
  database: SQLite.SQLiteDatabase,
  tile: TileCoord,
): Promise<boolean> {
  const row = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM tiles WHERE x = ? AND y = ? AND zoom = ?',
    tile.x, tile.y, tile.zoom,
  );
  return row !== null;
}

export async function getAllDiscoveredTiles(
  database: SQLite.SQLiteDatabase,
  zoom: number,
): Promise<Set<string>> {
  await database.runAsync('DELETE FROM tiles WHERE zoom != ?', zoom);
  const rows = await database.getAllAsync<{ x: number; y: number; zoom: number }>(
    'SELECT x, y, zoom FROM tiles WHERE zoom = ?',
    zoom,
  );
  const set = new Set<string>();
  for (const r of rows) {
    set.add(`${r.zoom}/${r.x}/${r.y}`);
  }
  return set;
}

export async function getSessions(
  database: SQLite.SQLiteDatabase,
  limit = 50,
): Promise<Session[]> {
  return database.getAllAsync<Session>(
    'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?',
    limit,
  );
}

export async function getTileCountInBounds(
  database: SQLite.SQLiteDatabase,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM tiles WHERE x >= ? AND x <= ? AND y >= ? AND y <= ?`,
    bounds.minX, bounds.maxX, bounds.minY, bounds.maxY,
  );
  return row?.count ?? 0;
}

export async function getSetting(database: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(database: SQLite.SQLiteDatabase, key: string, value: string): Promise<void> {
  await database.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key, value,
  );
}

export async function loadHomeFromDb(database: SQLite.SQLiteDatabase): Promise<{ lat: number; lng: number } | null> {
  const latStr = await getSetting(database, 'home_lat');
  const lngStr = await getSetting(database, 'home_lng');
  if (latStr === null || lngStr === null) return null;
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

export async function saveHomeToDb(database: SQLite.SQLiteDatabase, lat: number, lng: number): Promise<void> {
  await setSetting(database, 'home_lat', lat.toString());
  await setSetting(database, 'home_lng', lng.toString());
}

export async function computeLevel(totalXp: number): Promise<number> {
  let level = 1;
  let xpNeeded = 100;
  let accumulated = 0;
  while (accumulated + xpNeeded <= totalXp) {
    accumulated += xpNeeded;
    level++;
    xpNeeded = Math.floor(100 * level * 1.5);
  }
  return level;
}

export async function computeXpForNextLevel(currentLevel: number): Promise<number> {
  return Math.floor(100 * currentLevel * 1.5);
}

// ====== MODULE 1: SESSION AREAS (BBox/Polygon) ======

export async function insertSessionArea(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
  geometry: AreaGeometry,
): Promise<number> {
  const result = await database.runAsync(
    `INSERT INTO session_areas (session_id, geometry_json, geometry_type, created_at) VALUES (?, ?, ?, ?)`,
    sessionId, JSON.stringify(geometry), geometry.type, Date.now(),
  );
  return result.lastInsertRowId;
}

export async function getSessionArea(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
): Promise<SessionArea | null> {
  const row = await database.getFirstAsync<{
    id: number; session_id: number; geometry_json: string; geometry_type: string; created_at: number;
  }>(
    'SELECT * FROM session_areas WHERE session_id = ?',
    sessionId,
  );
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    geometry: JSON.parse(row.geometry_json),
    createdAt: row.created_at,
  };
}

// ====== MODULE 2: PHOTO TASKS ======

export async function insertPhotoTask(
  database: SQLite.SQLiteDatabase,
  task: {
    sessionId: number;
    tileX: number; tileY: number; zoom: number;
    targetLat: number; targetLng: number;
    description: string;
  },
): Promise<number> {
  const result = await database.runAsync(
    `INSERT INTO photo_tasks (session_id, tile_x, tile_y, zoom, target_lat, target_lng, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    task.sessionId, task.tileX, task.tileY, task.zoom,
    task.targetLat, task.targetLng, task.description, Date.now(),
  );
  return result.lastInsertRowId;
}

export async function getActivePhotoTasks(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
): Promise<PhotoTask[]> {
  const rows = await database.getAllAsync<PhotoTask>(
    'SELECT * FROM photo_tasks WHERE session_id = ?',
    sessionId,
  );
  return rows;
}

export async function getUncompletedPhotoTasks(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
): Promise<PhotoTask[]> {
  return database.getAllAsync<PhotoTask>(
    'SELECT * FROM photo_tasks WHERE session_id = ? AND completed_at IS NULL',
    sessionId,
  );
}

export async function completePhotoTask(
  database: SQLite.SQLiteDatabase,
  taskId: number,
  originalPath: string,
  thumbPath: string,
): Promise<void> {
  await database.runAsync(
    `UPDATE photo_tasks SET photo_original_path = ?, photo_thumb_path = ?, completed_at = ? WHERE id = ?`,
    originalPath, thumbPath, Date.now(), taskId,
  );
}

export async function countCompletedPhotos(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM photo_tasks WHERE session_id = ? AND completed_at IS NOT NULL',
    sessionId,
  );
  return row?.count ?? 0;
}

export async function getSessionPhotoTasks(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
): Promise<Array<{ id: number; description: string; completedAt: number | null }>> {
  const rows = await database.getAllAsync<{ id: number; description: string; completed_at: number | null }>(
    'SELECT id, description, completed_at FROM photo_tasks WHERE session_id = ?',
    sessionId,
  );
  return rows.map(r => ({ id: r.id, description: r.description, completedAt: r.completed_at }));
}

export async function getPhotoPathsForSync(
  database: SQLite.SQLiteDatabase,
  sessionIds: number[],
): Promise<Array<{ taskId: number; sessionId: number; path: string }>> {
  if (sessionIds.length === 0) return [];
  const placeholders = sessionIds.map(() => '?').join(',');
  const rows = await database.getAllAsync<{ id: number; session_id: number; photo_original_path: string }>(
    `SELECT id, session_id, photo_original_path FROM photo_tasks WHERE session_id IN (${placeholders}) AND photo_original_path IS NOT NULL`,
    ...sessionIds,
  );
  return rows.map(r => ({ taskId: r.id, sessionId: r.session_id, path: r.photo_original_path }));
}

// ====== MODULE 3: HIDDEN TREASURES ======

export async function insertHiddenTreasure(
  database: SQLite.SQLiteDatabase,
  t: {
    sessionId: number;
    tileX: number; tileY: number; zoom: number;
    targetLat: number; targetLng: number;
    circleCenterLat: number; circleCenterLng: number;
    circleRadiusM: number;
    xpReward: number;
  },
): Promise<number> {
  const result = await database.runAsync(
    `INSERT INTO hidden_treasures (session_id, tile_x, tile_y, zoom, target_lat, target_lng, circle_center_lat, circle_center_lng, circle_radius_m, xp_reward) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    t.sessionId, t.tileX, t.tileY, t.zoom,
    t.targetLat, t.targetLng, t.circleCenterLat, t.circleCenterLng,
    t.circleRadiusM, t.xpReward,
  );
  return result.lastInsertRowId;
}

export async function getActiveHiddenTreasures(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
): Promise<HiddenTreasure[]> {
  return database.getAllAsync<HiddenTreasure>(
    'SELECT * FROM hidden_treasures WHERE session_id = ?',
    sessionId,
  );
}

export async function getUncollectedHiddenTreasures(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
): Promise<HiddenTreasure[]> {
  return database.getAllAsync<HiddenTreasure>(
    'SELECT * FROM hidden_treasures WHERE session_id = ? AND collected_at IS NULL',
    sessionId,
  );
}

export async function collectHiddenTreasure(
  database: SQLite.SQLiteDatabase,
  treasureId: number,
): Promise<boolean> {
  const result = await database.runAsync(
    'UPDATE hidden_treasures SET collected_at = ? WHERE id = ? AND collected_at IS NULL',
    Date.now(), treasureId,
  );
  return (result.changes ?? 0) > 0;
}

export async function countCollectedTreasures(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM hidden_treasures WHERE session_id = ? AND collected_at IS NOT NULL',
    sessionId,
  );
  return row?.count ?? 0;
}

export async function getSessionTreasures(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
): Promise<Array<{ id: number; targetLat: number; targetLng: number; collectedAt: number | null }>> {
  return database.getAllAsync(
    'SELECT id, target_lat as targetLat, target_lng as targetLng, collected_at as collectedAt FROM hidden_treasures WHERE session_id = ?',
    sessionId,
  );
}

// ====== MODULE 4: SESSION ANALYTICS ======

export async function getNewTilesInSession(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
  startedAt: number,
): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM tiles WHERE discovered_at >= ? AND discovered_at <= ?',
    startedAt, Date.now(),
  );
  return row?.count ?? 0;
}

export async function getGpsTrackForSession(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
): Promise<Array<{ lat: number; lng: number }>> {
  return database.getAllAsync(
    'SELECT lat, lng FROM gps_log WHERE session_id = ? ORDER BY timestamp ASC',
    sessionId,
  );
}

// ====== MODULE 5: SYNC ======

export async function getUnsyncedSessions(
  database: SQLite.SQLiteDatabase,
): Promise<Array<Session & { explored_area_m2: number; photos_completed: number; treasures_found: number }>> {
  return database.getAllAsync(
    'SELECT * FROM sessions WHERE is_synced = 0',
  );
}

export async function markSessionSynced(
  database: SQLite.SQLiteDatabase,
  sessionId: number,
): Promise<void> {
  await database.runAsync(
    'UPDATE sessions SET is_synced = 1 WHERE id = ?',
    sessionId,
  );
}
