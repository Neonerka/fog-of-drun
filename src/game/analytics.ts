import * as SQLite from 'expo-sqlite';
import { haversineDistance, metersPerTileAtLatitude, DEFAULT_ZOOM } from './fog';
import { getNewTilesInSession, getGpsTrackForSession } from '../db/database';
import type { SessionSummary } from '../types';

export async function computeSessionSummary(
  db: SQLite.SQLiteDatabase,
  sessionId: number,
  startedAt: number,
  endedAt: number,
  distanceM: number,
  xpEarned: number,
): Promise<SessionSummary> {
  const newTiles = await getNewTilesInSession(db, sessionId, startedAt);

  const firstPoint = await db.getFirstAsync<{ lat: number }>(
    'SELECT lat FROM gps_log WHERE session_id = ? ORDER BY timestamp ASC LIMIT 1',
    sessionId,
  );
  const refLat = firstPoint?.lat ?? 55.7558;
  const mPerTile = metersPerTileAtLatitude(refLat, DEFAULT_ZOOM);
  const exploredAreaM2 = newTiles * mPerTile * mPerTile;

  const photosRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM photo_tasks WHERE session_id = ? AND completed_at IS NOT NULL',
    sessionId,
  );
  const photosCompleted = photosRow?.count ?? 0;

  const totalPhotosRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM photo_tasks WHERE session_id = ?',
    sessionId,
  );
  const totalPhotos = totalPhotosRow?.count ?? 0;

  const treasuresRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM hidden_treasures WHERE session_id = ? AND collected_at IS NOT NULL',
    sessionId,
  );
  const treasuresFound = treasuresRow?.count ?? 0;

  const durationSec = (endedAt - startedAt) / 1000;
  const avgSpeed = durationSec > 0 ? distanceM / durationSec : 0;

  return {
    sessionId,
    distanceM,
    exploredAreaM2: Math.round(exploredAreaM2),
    newTiles,
    photosCompleted,
    totalPhotos,
    treasuresFound,
    xpEarned,
    avgSpeed: Math.round(avgSpeed * 100) / 100,
    durationSec: Math.round(durationSec),
  };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}ч ${m}м ${s}с`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} км`;
  return `${Math.round(meters)} м`;
}

export function formatArea(m2: number): string {
  if (m2 >= 1000000) return `${(m2 / 1000000).toFixed(2)} км²`;
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} га`;
  return `${m2} м²`;
}
