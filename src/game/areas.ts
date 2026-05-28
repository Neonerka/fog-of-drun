import { tileFromCoordinates, getTilesInBounds, DEFAULT_ZOOM } from './fog';
import { getSetting } from '../db/database';
import type { TileCoord, AreaGeometry } from '../types';

export function isPointInBBox(
  lat: number,
  lng: number,
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
}

export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: Array<[number, number]>,
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][1], yi = polygon[i][0];
    const xj = polygon[j][1], yj = polygon[j][0];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function isTileInArea(tile: TileCoord, geometry: AreaGeometry): boolean {
  const zoom = tile.zoom;
  const n = Math.pow(2, zoom);
  const tileLat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n))) * 180) / Math.PI;
  const tileLng = (tile.x / n) * 360 - 180;

  if (geometry.type === 'bbox') {
    return isPointInBBox(tileLat, tileLng, geometry);
  }
  return isPointInPolygon(tileLat, tileLng, geometry.coords);
}

export function getUndiscoveredTilesInArea(
  discoveredTiles: Set<string>,
  geometry: AreaGeometry,
  zoom: number = DEFAULT_ZOOM,
): TileCoord[] {
  let candidates: TileCoord[];

  if (geometry.type === 'bbox') {
    candidates = getTilesInBounds(
      geometry.minLat, geometry.minLng,
      geometry.maxLat, geometry.maxLng,
      zoom,
    );
  } else {
    const lats = geometry.coords.map(c => c[0]);
    const lngs = geometry.coords.map(c => c[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    candidates = getTilesInBounds(minLat, minLng, maxLat, maxLng, zoom);

    candidates = candidates.filter(t => isTileInArea(t, geometry));
  }

  return candidates.filter(t => !discoveredTiles.has(`${t.zoom}/${t.x}/${t.y}`));
}

export function pickRandomTiles(
  tiles: TileCoord[],
  count: number,
  minDistanceTiles: number = 2,
): TileCoord[] {
  if (tiles.length <= count) return [...tiles];

  const chosen: TileCoord[] = [];
  const pool = [...tiles];

  while (chosen.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    const picked = pool.splice(idx, 1)[0];

    const tooClose = chosen.some(c =>
      Math.abs(c.x - picked.x) <= minDistanceTiles &&
      Math.abs(c.y - picked.y) <= minDistanceTiles,
    );

    if (!tooClose) {
      chosen.push(picked);
    }
  }

  return chosen;
}

export const PHOTO_TASK_DESCRIPTIONS = [
  'Сфотографируйте дерево',
  'Сфотографируйте скамейку',
  'Сфотографируйте здание',
  'Сфотографируйте дорожный знак',
  'Сфотографируйте фонарный столб',
  'Сфотографируйте забор',
  'Сфотографируйте входную дверь',
  'Сфотографируйте окно',
  'Сфотографируйте лестницу',
  'Сфотографируйте водосточную трубу',
];

export function randomDescription(): string {
  return PHOTO_TASK_DESCRIPTIONS[Math.floor(Math.random() * PHOTO_TASK_DESCRIPTIONS.length)];
}
