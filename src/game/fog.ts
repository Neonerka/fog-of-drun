import type { TileCoord } from '../types';

export const DEFAULT_ZOOM = 21;

export function tileFromCoordinates(lat: number, lng: number, zoom: number = DEFAULT_ZOOM): TileCoord {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, zoom };
}

export function coordinatesFromTile(tile: TileCoord): { lat: number; lng: number } {
  const n = Math.pow(2, tile.zoom);
  const lng = (tile.x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

export function getTileBoundingBox(tile: TileCoord): {
  minLat: number; minLng: number; maxLat: number; maxLng: number;
} {
  const nw = coordinatesFromTile(tile);
  const se = coordinatesFromTile({ x: tile.x + 1, y: tile.y + 1, zoom: tile.zoom });
  return {
    minLat: se.lat,
    minLng: nw.lng,
    maxLat: nw.lat,
    maxLng: se.lng,
  };
}

export function getTileCenter(tile: TileCoord): { lat: number; lng: number } {
  const box = getTileBoundingBox(tile);
  return {
    lat: (box.minLat + box.maxLat) / 2,
    lng: (box.minLng + box.maxLng) / 2,
  };
}

export function getTilesInRadius(
  centerTile: TileCoord,
  radius: number,
): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      tiles.push({
        x: centerTile.x + dx,
        y: centerTile.y + dy,
        zoom: centerTile.zoom,
      });
    }
  }
  return tiles;
}

export function getTilesInBounds(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  zoom: number = DEFAULT_ZOOM,
): TileCoord[] {
  const topLeft = tileFromCoordinates(maxLat, minLng, zoom);
  const bottomRight = tileFromCoordinates(minLat, maxLng, zoom);
  const tiles: TileCoord[] = [];
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ x, y, zoom });
    }
  }
  return tiles;
}

export function metersPerTileAtLatitude(lat: number, zoom: number = DEFAULT_ZOOM): number {
  const earthCircumference = 40075016.686;
  const latRad = (lat * Math.PI) / 180;
  return (earthCircumference * Math.cos(latRad)) / Math.pow(2, zoom);
}

export function tileDistanceInMeters(a: TileCoord, b: TileCoord, lat: number): number {
  const mPerTile = metersPerTileAtLatitude(lat, a.zoom);
  const dx = Math.abs(a.x - b.x) * mPerTile;
  const dy = Math.abs(a.y - b.y) * mPerTile;
  return Math.sqrt(dx * dx + dy * dy);
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computeViewportTileBounds(
  lat: number, lng: number,
  zoom: number,
  screenTilesWide: number,
  screenTilesHigh: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const center = tileFromCoordinates(lat, lng, zoom);
  const halfW = Math.ceil(screenTilesWide / 2);
  const halfH = Math.ceil(screenTilesHigh / 2);
  return {
    minX: center.x - halfW,
    maxX: center.x + halfW,
    minY: center.y - halfH,
    maxY: center.y + halfH,
  };
}
