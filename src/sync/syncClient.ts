import * as SQLite from 'expo-sqlite';
import { getSetting, markSessionSynced } from '../db/database';
import { buildSyncPayload } from './packetBuilder';
import { buildServerUrl, PING_TIMEOUT_MS, META_UPLOAD_TIMEOUT_MS, PHOTO_UPLOAD_TIMEOUT_MS } from './syncConfig';
import type { SyncResult } from '../types';

let _db: SQLite.SQLiteDatabase | null = null;

export function setSyncDb(database: SQLite.SQLiteDatabase): void {
  _db = database;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    const { getDatabase } = require('../db/database');
    _db = await getDatabase();
  }
  return _db!;
}

export async function checkServerAvailability(serverUrl?: string): Promise<boolean> {
  const database = await getDb();
  const url = serverUrl || (await getSetting(database, 'sync_server_url')) || buildServerUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const response = await fetch(`${url}/api/ping`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

export async function syncAll(serverUrl?: string): Promise<SyncResult> {
  const database = await getDb();
  const baseUrl = serverUrl || (await getSetting(database, 'sync_server_url')) || buildServerUrl();

  const available = await checkServerAvailability(baseUrl);
  if (!available) {
    return { success: false, reason: 'server_unreachable' };
  }

  const payload = await buildSyncPayload(database);
  if (!payload) {
    return { success: true, sessionsSynced: 0 };
  }

  let metaResponse: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), META_UPLOAD_TIMEOUT_MS);
    metaResponse = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    return { success: false, reason: 'meta_upload_failed' };
  }

  if (!metaResponse.ok) {
    return { success: false, reason: 'meta_rejected', status: metaResponse.status };
  }

  const sessionIds = payload.sessions.map(s => s.session.id);

  const allTaskIds = payload.sessions.flatMap(s =>
    s.photoTasks.filter(t => t.completedAt !== null).map(t => t.id),
  );

  if (allTaskIds.length > 0) {
    const photosOk = await uploadPhotos(database, allTaskIds, baseUrl);
    if (!photosOk) {
      return { success: false, reason: 'photo_upload_failed' };
    }
  }

  for (const id of sessionIds) {
    await markSessionSynced(database, id);
  }

  return { success: true, sessionsSynced: sessionIds.length };
}

async function uploadPhotos(
  database: SQLite.SQLiteDatabase,
  taskIds: number[],
  baseUrl: string,
): Promise<boolean> {
  const placeholders = taskIds.map(() => '?').join(',');
  const tasks = await database.getAllAsync<{ id: number; session_id: number; photo_original_path: string }>(
    `SELECT id, session_id, photo_original_path FROM photo_tasks WHERE id IN (${placeholders}) AND photo_original_path IS NOT NULL`,
    ...taskIds,
  );

  if (tasks.length === 0) return true;

  try {
    const formData = new FormData();
    for (const task of tasks) {
      const fileName = `session_${task.session_id}_task_${task.id}.jpg`;
      formData.append(fileName, {
        uri: task.photo_original_path,
        type: 'image/jpeg',
        name: fileName,
      } as any);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PHOTO_UPLOAD_TIMEOUT_MS);
    const response = await fetch(`${baseUrl}/api/photos`, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
