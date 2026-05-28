export function xpForLevel(level: number): number {
  return Math.floor(100 * level * 1.5);
}

export function computeLevel(totalXp: number): number {
  let level = 1;
  let needed = xpForLevel(level);
  let accumulated = 0;
  while (accumulated + needed <= totalXp) {
    accumulated += needed;
    level++;
    needed = xpForLevel(level);
  }
  return level;
}

export function xpToNextLevel(totalXp: number): number {
  let level = 1;
  let needed = xpForLevel(level);
  let accumulated = 0;
  while (accumulated + needed <= totalXp) {
    accumulated += needed;
    level++;
    needed = xpForLevel(level);
  }
  return needed;
}

export function xpProgressInLevel(totalXp: number): { current: number; needed: number } {
  let level = 1;
  let needed = xpForLevel(level);
  let accumulated = 0;
  while (accumulated + needed <= totalXp) {
    accumulated += needed;
    level++;
    needed = xpForLevel(level);
  }
  return { current: totalXp - accumulated, needed };
}

const DAILY_TIER_LIMITS = [100, 500];
const DAILY_TIER_MULTIPLIERS = [1.0, 0.5, 0.1];

export function computeTileXp(
  newTilesCount: number,
  dailyTilesOpened: number,
  isNight: boolean,
  isLongDistance: boolean,
  isRemote: boolean,
): number {
  let baseXp = 1;
  for (let i = 0; i < newTilesCount; i++) {
    const dailyCount = dailyTilesOpened + i;
    let multiplier = DAILY_TIER_MULTIPLIERS[DAILY_TIER_MULTIPLIERS.length - 1];
    for (let t = 0; t < DAILY_TIER_LIMITS.length; t++) {
      if (dailyCount < DAILY_TIER_LIMITS[t]) {
        multiplier = DAILY_TIER_MULTIPLIERS[t];
        break;
      }
    }
    baseXp += Math.floor(1 * multiplier);
  }
  let totalXp = baseXp;
  if (isNight) totalXp = Math.floor(totalXp * 2.0);
  if (isLongDistance) totalXp = Math.floor(totalXp * 1.5);
  if (isRemote) totalXp = Math.floor(totalXp * 1.25);
  return totalXp;
}

export function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 5;
}

export const CHEST_REWARDS: Record<string, { xp: number; label: string }> = {
  common: { xp: 5, label: 'Обычный сундук' },
  rare: { xp: 25, label: 'Редкий сундук' },
  epic: { xp: 100, label: 'Эпический сундук' },
  legendary: { xp: 500, label: 'Легендарный сундук' },
};
