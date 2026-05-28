import * as SQLite from 'expo-sqlite';
import { getUnsyncedSessions, getSetting, setSetting } from '../db/database';
import type { SyncPayload, AreaGeometry } from '../types';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function buildSyncPayload(db: SQLite.SQLiteDatabase): Promise<SyncPayload | null> {
  let deviceId = await getSetting(db, 'device_id');
  if (!deviceId) {
    deviceId = generateUUID();
    await setSetting(db, 'device_id', deviceId);
  }

  const unsyncedSessions = await getUnsyncedSessions(db);
  if (unsyncedSessions.length === 0) return null;

  const sessions = [];
  for (const session of unsyncedSessions) {
    const gpsLog = await db.getAllAsync<{ lat: number; lng: number; timestamp: number; accuracy: number }>(
      'SELECT lat, lng, timestamp, accuracy FROM gps_log WHERE session_id = ? ORDER BY timestamp ASC',
      session.id,
    );

    const photoTasks = await db.getAllAsync<{ id: number; description: string; completed_at: number | null }>(
      'SELECT id, description, completed_at FROM photo_tasks WHERE session_id = ?',
      session.id,
    );

    const hiddenTreasures = await db.getAllAsync<{ id: number; target_lat: number; target_lng: number; collected_at: number | null }>(
      'SELECT id, target_lat, target_lng, collected_at FROM hidden_treasures WHERE session_id = ?',
      session.id,
    );

    const areaRow = await db.getFirstAsync<{ geometry_json: string }>(
      'SELECT geometry_json FROM session_areas WHERE session_id = ?',
      session.id,
    );
    const area: AreaGeometry | null = areaRow ? JSON.parse(areaRow.geometry_json) : null;

    sessions.push({
      session,
      gpsLog,
      photoTasks: photoTasks.map(t => ({
        id: t.id,
        description: t.description,
        completedAt: t.completed_at,
      })),
      hiddenTreasures: hiddenTreasures.map(t => ({
        id: t.id,
        targetLat: t.target_lat,
        targetLng: t.target_lng,
        collectedAt: t.collected_at,
      })),
      area,
    });
  }

  return { deviceId, syncedAt: Date.now(), sessions };
}
