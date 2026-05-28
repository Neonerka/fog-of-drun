import * as SQLite from 'expo-sqlite';
import { documentDirectory, makeDirectoryAsync, moveAsync, readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getUncompletedPhotoTasks, completePhotoTask } from '../db/database';
import { useStore } from '../store/useStore';
import type { PhotoTask } from '../types';

const PHOTO_DIR = `${documentDirectory || '.'}fogofdrun/photos/`;

let lastTriggeredTaskId: number | null = null;
let lastTriggerTime = 0;
const CAMERA_COOLDOWN_MS = 5000;

export async function checkPhotoTaskProximity(
  db: SQLite.SQLiteDatabase,
  sessionId: number,
  gpsLat: number,
  gpsLng: number,
  maxAccuracy: number,
): Promise<void> {
  const uncompleted = await getUncompletedPhotoTasks(db, sessionId);
  if (uncompleted.length === 0) return;

  const now = Date.now();
  if (now - lastTriggerTime < CAMERA_COOLDOWN_MS) return;

  for (const task of uncompleted) {
    const dist = haversineDistance(gpsLat, gpsLng, task.targetLat, task.targetLng);
    if (dist <= maxAccuracy && lastTriggeredTaskId !== task.id) {
      lastTriggeredTaskId = task.id;
      lastTriggerTime = now;
      const success = await triggerCamera(task);
      if (success) {
        await completePhotoTask(db, task.id, success.originalPath, success.thumbPath);
        useStore.getState().incrementPhotosCompleted();
      }
      return;
    }
  }
}

async function triggerCamera(
  task: PhotoTask,
): Promise<{ originalPath: string; thumbPath: string } | null> {
  let ImagePicker: any;
  try {
    ImagePicker = require('expo-image-picker');
  } catch {
    return null;
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    base64: false,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const photoUri = result.assets[0].uri;
  await makeDirectoryAsync(PHOTO_DIR, { intermediates: true });

  const fileName = `photo_${task.sessionId}_${task.id}.jpg`;
  const thumbName = `thumb_${task.sessionId}_${task.id}.jpg`;
  const destPath = `${PHOTO_DIR}${fileName}`;
  const thumbPath = `${PHOTO_DIR}${thumbName}`;

  const manipResult = await manipulateAsync(
    photoUri,
    [{ resize: { width: 1024 } }],
    { compress: 0.6, format: SaveFormat.JPEG },
  );

  await moveAsync({ from: manipResult.uri, to: thumbPath });
  await moveAsync({ from: photoUri, to: destPath });

  return { originalPath: destPath, thumbPath };
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function sendPhotoToWebView(
  thumbPath: string,
): Promise<string | null> {
  try {
    const base64 = await readAsStringAsync(thumbPath, {
      encoding: EncodingType.Base64,
    });
    return base64;
  } catch {
    return null;
  }
}
