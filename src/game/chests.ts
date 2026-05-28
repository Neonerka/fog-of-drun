import type { TileCoord, ChestRarity } from '../types';

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash >>> 0;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

const SPAWN_CHANCE = 0.001;

export function computeChestAtTile(
  tile: TileCoord,
  dateString: string,
): ChestRarity | null {
  const seed = hashCode(`chest_${dateString}_${tile.x}_${tile.y}`);
  const roll = seededRandom(seed);
  if (roll >= SPAWN_CHANCE) return null;

  const rarityRoll = seededRandom(seed + 1);
  if (rarityRoll < 0.70) return 'common';
  if (rarityRoll < 0.90) return 'rare';
  if (rarityRoll < 0.98) return 'epic';
  return 'legendary';
}

export function spawnChestsInBounds(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  zoom: number,
  dateString: string,
): Array<{ tile: TileCoord; rarity: ChestRarity }> {
  const chests: Array<{ tile: TileCoord; rarity: ChestRarity }> = [];
  for (let x = bounds.minX; x <= bounds.maxX; x++) {
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      const tile: TileCoord = { x, y, zoom };
      const rarity = computeChestAtTile(tile, dateString);
      if (rarity) chests.push({ tile, rarity });
    }
  }
  return chests;
}

export function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CHEST_RARITY_COLORS: Record<ChestRarity, string> = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
};

export const CHEST_RARITY_LABELS: Record<ChestRarity, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
};
