import * as Location from 'expo-location';
import type { GpsPoint } from '../types';

export type LocationCallback = (point: GpsPoint) => void;
export type LocationErrorCallback = (error: string) => void;

let locationSubscription: Location.LocationSubscription | null = null;
let callback: LocationCallback | null = null;
let errorCallback: LocationErrorCallback | null = null;
let lastPoint: GpsPoint | null = null;

const DISTANCE_FILTER = 0;
const FOREGROUND_INTERVAL = 1000;

export async function requestLocationPermissions(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  return foreground.granted;
}

export function startTracking(
  onLocation: LocationCallback,
  onError?: LocationErrorCallback,
): void {
  if (locationSubscription) {
    callback = onLocation;
    errorCallback = onError ?? null;
    return;
  }
  callback = onLocation;
  errorCallback = onError ?? null;
  lastPoint = null;

  Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: DISTANCE_FILTER,
      timeInterval: FOREGROUND_INTERVAL,
    },
    (loc) => {
      const point: GpsPoint = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        timestamp: loc.timestamp,
        accuracy: loc.coords.accuracy ?? 0,
      };
      lastPoint = point;
      callback?.(point);
    },
  ).then((sub) => {
    locationSubscription = sub;
  }).catch((err) => {
    errorCallback?.(err instanceof Error ? err.message : String(err));
  });
}

export function stopTracking(): void {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
  callback = null;
  errorCallback = null;
  lastPoint = null;
}

export function getLastPoint(): GpsPoint | null {
  return lastPoint;
}

export function isTracking(): boolean {
  return locationSubscription !== null;
}
