import * as SQLite from 'expo-sqlite';
import { getTileCenter as getCenterOfTile } from './fog';
import { getDatabase, getUncollectedHiddenTreasures, collectHiddenTreasure, insertHiddenTreasure as dbInsertTreasure } from '../db/database';
import { useStore } from '../store/useStore';
import { haversineDistance } from './fog';
import type { HiddenTreasure, TileCoord } from '../types';

const COLLECT_RADIUS_M = 10;
const MIN_CIRCLE_RADIUS_M = 100;
const MAX_CIRCLE_RADIUS_M = 200;
const CIRCLE_OFFSET_FACTOR = 0.7;
const TREASURE_XP_REWARD = 50;

export function generateHiddenTreasureConfig(
  tile: TileCoord,
): {
  targetLat: number; targetLng: number;
  circleCenterLat: number; circleCenterLng: number;
  circleRadiusM: number;
} {
  const center = getCenterOfTile(tile);
  const targetLat = center.lat;
  const targetLng = center.lng;

  const circleRadiusM = MIN_CIRCLE_RADIUS_M +
    Math.random() * (MAX_CIRCLE_RADIUS_M - MIN_CIRCLE_RADIUS_M);

  const angle = Math.random() * 2 * Math.PI;
  const offsetM = Math.random() * circleRadiusM * CIRCLE_OFFSET_FACTOR;

  const latDelta = (offsetM * Math.cos(angle)) / 111320;
  const lngDelta = (offsetM * Math.sin(angle)) / (111320 * Math.cos((targetLat * Math.PI) / 180));

  return {
    targetLat,
    targetLng,
    circleCenterLat: targetLat + latDelta,
    circleCenterLng: targetLng + lngDelta,
    circleRadiusM: Math.round(circleRadiusM),
  };
}

export async function spawnHiddenTreasure(
  db: SQLite.SQLiteDatabase,
  sessionId: number,
  tile: TileCoord,
): Promise<HiddenTreasure | null> {
  const config = generateHiddenTreasureConfig(tile);

  const id = await dbInsertTreasure(db, {
    sessionId,
    tileX: tile.x,
    tileY: tile.y,
    zoom: tile.zoom,
    ...config,
    xpReward: TREASURE_XP_REWARD,
  });

  if (!id) return null;

  return {
    id,
    sessionId,
    tileX: tile.x,
    tileY: tile.y,
    zoom: tile.zoom,
    ...config,
    collectedAt: null,
    xpReward: TREASURE_XP_REWARD,
  };
}

export async function checkTreasureProximity(
  db: SQLite.SQLiteDatabase,
  sessionId: number,
  gpsLat: number,
  gpsLng: number,
): Promise<void> {
  const uncollected = await getUncollectedHiddenTreasures(db, sessionId);
  if (uncollected.length === 0) return;

  for (const treasure of uncollected) {
    const dist = haversineDistance(gpsLat, gpsLng, treasure.targetLat, treasure.targetLng);
    if (dist <= COLLECT_RADIUS_M) {
      const collected = await collectHiddenTreasure(db, treasure.id);
      if (collected) {
        useStore.getState().incrementTreasuresFound();
        useStore.getState().addTreasureXp(treasure.xpReward);
      }
    }
  }
}

export function getProximityLevel(
  gpsLat: number,
  gpsLng: number,
  treasure: HiddenTreasure,
): 'far' | 'warm' | 'hot' | 'found' {
  const dist = haversineDistance(gpsLat, gpsLng, treasure.targetLat, treasure.targetLng);
  if (dist <= COLLECT_RADIUS_M) return 'found';
  if (dist <= 50) return 'hot';
  if (dist <= 100) return 'warm';
  return 'far';
}
