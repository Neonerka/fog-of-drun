import * as SQLite from 'expo-sqlite';
import { getDatabase, beginSession, endSession, insertGpsBatch, insertNewTiles, getStats, updateStats, insertChest, collectChest as dbCollectChest, getChestsAtTile, getAllDiscoveredTiles, getAchievements, upsertAchievement, unlockAchievement, loadHomeFromDb, saveHomeToDb as dbSaveHome, insertSessionArea, insertPhotoTask, insertHiddenTreasure } from '../db/database';
import { tileFromCoordinates, haversineDistance, getTilesInRadius, getTilesInBounds, DEFAULT_ZOOM } from './fog';
import { computeTileXp, isNightTime, computeLevel, CHEST_REWARDS } from './xp';
import { computeChestAtTile, getTodayDateString } from './chests';
import { checkAchievements, ACHIEVEMENT_DEFS } from './achievements';
import { startTracking, requestLocationPermissions } from '../gps/tracker';
import { useStore } from '../store/useStore';
import { getUndiscoveredTilesInArea, pickRandomTiles, randomDescription } from './areas';
import { checkPhotoTaskProximity, sendPhotoToWebView } from './photoTasks';
import { checkTreasureProximity, spawnHiddenTreasure } from './hiddenTreasures';
import { computeSessionSummary } from './analytics';
import type { GpsPoint, AreaGeometry } from '../types';

let db: SQLite.SQLiteDatabase | null = null;
let batchTimer: ReturnType<typeof setInterval> | null = null;
let sessionStartTime: number = 0;

const GPS_BATCH_INTERVAL = 3000;
const MAX_ACCURACY = 100;

export async function initializeEngine(): Promise<void> {
  db = await getDatabase();
  const stats = await getStats(db);
  if (stats) {
    useStore.getState().setPlayerStats(stats);
    const level = computeLevel(stats.total_xp);
    useStore.getState().setPlayerStats({ ...stats, level });
  }

  const allTiles = await getAllDiscoveredTiles(db, DEFAULT_ZOOM);
  useStore.getState().replaceDiscoveredTiles(allTiles);

  const home = await loadHomeFromDb(db);
  if (home) {
    useStore.getState().setHome(home.lat, home.lng);
  }

  const achievements = await getAchievements(db);
  if (achievements.length === 0) {
    for (const def of ACHIEVEMENT_DEFS) {
      await upsertAchievement(db, def.key, def.title, def.description, 0, def.progressMax);
    }
    const seeded = await getAchievements(db);
    useStore.getState().setAchievements(seeded);
  } else {
    useStore.getState().setAchievements(achievements);
  }

  const granted = await requestLocationPermissions();
  if (granted) {
    startTracking(
      (point) => { useStore.getState().addGpsPoint(point); },
      (error) => { console.warn('GPS error:', error); },
    );
  }
}

export async function startSession(areaGeometry?: AreaGeometry): Promise<boolean> {
  if (!db) db = await getDatabase();
  if (useStore.getState().isTracking) return false;

  const sessionId = await beginSession(db);
  sessionStartTime = Date.now();

  const session = {
    id: sessionId,
    started_at: sessionStartTime,
    ended_at: null,
    distance_m: 0,
    avg_speed: 0,
    tiles_opened: 0,
    xp_earned: 0,
  };

  useStore.getState().setCurrentSession(session, sessionId);
  useStore.getState().setTracking(true);
  useStore.getState().clearGpsBuffer();
  useStore.getState().setDayTilesCount(0);
  useStore.getState().clearRecentUnlocks();
  useStore.getState().addSessionDistance(0);
  useStore.getState().setSessionSummary(null);

  // Module 1: Save area geometry
  if (areaGeometry) {
    await insertSessionArea(db, sessionId, areaGeometry);
    useStore.getState().setSessionArea(areaGeometry);
  }

  // Module 2 & 3: Generate session content within BBox
  if (areaGeometry) {
    const discoveredTiles = useStore.getState().discoveredTiles;
    const hiddenTiles = getUndiscoveredTilesInArea(discoveredTiles, areaGeometry, DEFAULT_ZOOM);

    // Generate 3-5 photo tasks
    const photoTileCount = Math.min(3 + Math.floor(Math.random() * 3), hiddenTiles.length);
    const photoTiles = pickRandomTiles(hiddenTiles, photoTileCount, 2);

    const photoTasks = [];
    for (const tile of photoTiles) {
      const center = { lat: 0, lng: 0 }; // placeholder — computed from tile
      const n = Math.pow(2, tile.zoom);
      center.lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n))) * 180) / Math.PI;
      center.lng = (tile.x / n) * 360 - 180;
      // Use the actual center:
      const bounds = getTilesInBounds(center.lat - 0.001, center.lng - 0.001, center.lat + 0.001, center.lng + 0.001, tile.zoom);
      const tileCenter = { lat: center.lat, lng: center.lng };

      const id = await insertPhotoTask(db, {
        sessionId,
        tileX: tile.x, tileY: tile.y, zoom: tile.zoom,
        targetLat: tileCenter.lat, targetLng: tileCenter.lng,
        description: randomDescription(),
      });
      photoTasks.push({
        id,
        sessionId,
        tileX: tile.x, tileY: tile.y, zoom: tile.zoom,
        targetLat: tileCenter.lat, targetLng: tileCenter.lng,
        description: '',
        photoOriginalPath: null, photoThumbPath: null, completedAt: null, createdAt: Date.now(),
      });
    }
    useStore.getState().setPhotoTasks(photoTasks);

    // Generate 1 hidden treasure
    const treasureTiles = hiddenTiles.filter(t =>
      !photoTiles.some(pt => pt.x === t.x && pt.y === t.y),
    );
    if (treasureTiles.length > 0) {
      const tTile = treasureTiles[Math.floor(Math.random() * treasureTiles.length)];
      const treasure = await spawnHiddenTreasure(db, sessionId, tTile);
      if (treasure) {
        useStore.getState().setHiddenTreasures([treasure]);
      }
    }
  }

  const today = getTodayDateString();
  const _dayTiles = await getDayTilesCount(today);
  useStore.getState().setDayTilesCount(_dayTiles);

  startTracking(
    (point) => {
      useStore.getState().addGpsPoint(point);
    },
    (error) => {
      console.warn('GPS error:', error);
    },
  );

  batchTimer = setInterval(processGpsBatch, GPS_BATCH_INTERVAL);

  return true;
}

async function getDayTilesCount(dateString: string): Promise<number> {
  if (!db) return 0;
  const startOfDay = new Date(dateString).getTime();
  const endOfDay = startOfDay + 86400000;
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM tiles WHERE discovered_at >= ? AND discovered_at < ?',
    startOfDay, endOfDay,
  );
  return row?.count ?? 0;
}

async function processGpsBatch(): Promise<void> {
  const state = useStore.getState();
  if (!state.isTracking || !db) return;

  const buffer = state.gpsBuffer;
  state.clearGpsBuffer();

  const sessionId = state.currentSessionId;
  if (!sessionId) return;

  const accuratePoints = buffer.filter((p) => p.accuracy <= MAX_ACCURACY);

  if (accuratePoints.length > 0) {
    const gpsRows = accuratePoints.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.timestamp,
      accuracy: p.accuracy,
      session_id: sessionId,
    }));
    await insertGpsBatch(db, gpsRows);
  }

  const lastAccurate = accuratePoints.length > 0 ? accuratePoints[accuratePoints.length - 1] : null;
  const storeLast = useStore.getState().lastGpsPoint;
  const lastPoint = lastAccurate || (storeLast && storeLast.accuracy <= MAX_ACCURACY ? storeLast : null);
  if (!lastPoint) return;

  const today = getTodayDateString();
  const homeLat = state.homeLat;
  const homeLng = state.homeLng;
  const isNight = isNightTime();

  const centerTile = tileFromCoordinates(lastPoint.lat, lastPoint.lng, DEFAULT_ZOOM);
  const neighbors = getTilesInRadius(centerTile, 1);
  const newTiles = await insertNewTiles(db, neighbors, lastPoint.timestamp);

  const dailyCount = state.dayTilesCount + newTiles;
  const isRemote = homeLat !== null && homeLng !== null &&
    haversineDistance(homeLat, homeLng, lastPoint.lat, lastPoint.lng) > 5000;
  const isLongDistance = state.sessionDistance > 10000;

  const xpGained = newTiles > 0
    ? computeTileXp(newTiles, dailyCount, isNight, isLongDistance, isRemote)
    : 0;
  const nightTileCount = isNight ? newTiles : 0;

  if (buffer.length > 1) {
    const d = haversineDistance(buffer[0].lat, buffer[0].lng, lastPoint.lat, lastPoint.lng);
    useStore.getState().addSessionDistance(d);
  }

  let chestsCollected = 0;
  let chestXp = 0;
  if (newTiles > 0) {
    for (const t of neighbors) {
      const chest = computeChestAtTile(t, today);
      if (chest) await insertChest(db, t, chest);
    }
    for (const t of neighbors) {
      const chestsHere = await getChestsAtTile(db, t);
      for (const chest of chestsHere) {
        const collected = await dbCollectChest(db, chest.id, sessionId);
        if (collected) {
          useStore.getState().removeVisibleChest(chest.id);
          const reward = CHEST_REWARDS[chest.rarity];
          chestXp += reward.xp;
          if (chest.rarity === 'rare') useStore.getState().addRareChest();
          if (chest.rarity === 'epic') useStore.getState().addEpicChest();
          if (chest.rarity === 'legendary') useStore.getState().addLeggoChest();
          chestsCollected++;
        }
      }
    }
  }

  const totalXp = xpGained + chestXp;

  // Module 2: Check photo task proximity
  if (lastPoint && sessionId) {
    await checkPhotoTaskProximity(db, sessionId, lastPoint.lat, lastPoint.lng, MAX_ACCURACY);
  }

  // Module 3: Check hidden treasure proximity
  if (lastPoint && sessionId) {
    await checkTreasureProximity(db, sessionId, lastPoint.lat, lastPoint.lng);
  }

  if (newTiles > 0 || chestsCollected > 0) {
    await updateStats(db, {
      xp: totalXp,
      tiles: newTiles,
      chests: chestsCollected,
      distance: 0,
      nightTiles: nightTileCount > 0 ? nightTileCount : undefined,
    });
    const updatedStats = await getStats(db);
    if (updatedStats) {
      const level = computeLevel(updatedStats.total_xp);
      useStore.getState().setPlayerStats({ ...updatedStats, level });
    }
  }

  useStore.getState().incrementDayTiles(newTiles);

  const allTiles = await getAllDiscoveredTiles(db, DEFAULT_ZOOM);
  useStore.getState().replaceDiscoveredTiles(allTiles);

  const updatedAchievements = await getAchievements(db);
  useStore.getState().setAchievements(updatedAchievements);

  const stats = useStore.getState().playerStats;
  if (stats) {
    const newlyUnlocked = checkAchievements(updatedAchievements, {
      totalTiles: stats.total_tiles_opened,
      level: stats.level,
      nightTiles: stats.night_tiles,
      totalDistance: stats.total_distance_m,
      sessionDistance: useStore.getState().sessionDistance,
      chestsCollected: stats.chests_collected,
      rareChestsCollected: useStore.getState().rareChestsCollected,
      epicChestsCollected: useStore.getState().epicChestsCollected,
      leggoChestsCollected: useStore.getState().leggoChestsCollected,
    });
    for (const key of newlyUnlocked) {
      await unlockAchievement(db, key);
      useStore.getState().addRecentUnlock(key);
    }
  }
}

export async function stopSession(): Promise<void> {
  if (!db) return;
  const state = useStore.getState();
  if (!state.isTracking) return;

  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
  }

  await processGpsBatch();

  useStore.getState().setTracking(false);

  const sessionId = state.currentSessionId;
  if (!sessionId) return;

  const elapsed = (Date.now() - sessionStartTime) / 1000;
  const distance = state.sessionDistance;
  const avgSpeed = elapsed > 0 ? distance / elapsed : 0;
  const tilesOpened = state.currentSession?.tiles_opened ?? 0;
  const xpEarned = state.currentSession?.xp_earned ?? 0;

  // Module 4: Compute session summary
  const summary = await computeSessionSummary(
    db, sessionId, sessionStartTime, Date.now(), distance, xpEarned,
  );

  await endSession(
    db, sessionId, distance, avgSpeed, tilesOpened, xpEarned,
    summary.exploredAreaM2, summary.photosCompleted, summary.treasuresFound,
  );
  useStore.getState().setSessionSummary(summary);
  useStore.getState().setCurrentSession(null, null);
}

export async function refreshChestsInViewport(
  minX: number, maxX: number, minY: number, maxY: number,
): Promise<void> {
  if (!db) return;
  const chests = await db.getAllAsync<import('../types').Chest>(
    `SELECT * FROM chests WHERE tile_x >= ? AND tile_x <= ? AND tile_y >= ? AND tile_y <= ? AND collected_at IS NULL`,
    minX, maxX, minY, maxY,
  );
  useStore.getState().setVisibleChests(chests);
}

export async function saveHomeToDb(lat: number, lng: number): Promise<void> {
  if (!db) db = await getDatabase();
  await dbSaveHome(db, lat, lng);
}

export { getDatabase };
