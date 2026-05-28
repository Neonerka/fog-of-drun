import type { Achievement } from '../types';

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  progressMax: number;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { key: 'first_steps', title: 'Первый шаг', description: 'Открой первый тайл', progressMax: 1 },
  { key: 'pioneer', title: 'Первопроходец', description: 'Открой 5 000 тайлов', progressMax: 5000 },
  { key: 'explorer', title: 'Исследователь', description: 'Открой 50 000 тайлов', progressMax: 50000 },
  { key: 'night_wolf', title: 'Ночной волк', description: 'Открой 100 тайлов ночью', progressMax: 100 },
  { key: 'night_legend', title: 'Владыка ночи', description: 'Открой 1 000 тайлов ночью', progressMax: 1000 },
  { key: 'marathoner', title: 'Марафонец', description: 'Пробеги 42 км суммарно', progressMax: 42000 },
  { key: 'sprinter', title: 'Спринтер', description: 'Пробеги 10 км за одну сессию', progressMax: 10000 },
  { key: 'treasure_hunter', title: 'Кладоискатель', description: 'Собери 10 сундуков', progressMax: 10 },
  { key: 'treasure_hoarder', title: 'Сокровищница', description: 'Собери 100 сундуков', progressMax: 100 },
  { key: 'collector', title: 'Коллекционер', description: 'Собери сундук каждой редкости', progressMax: 4 },
  { key: 'level_5', title: 'Путешественник', description: 'Достигни 5 уровня', progressMax: 5 },
  { key: 'level_10', title: 'Бывалый', description: 'Достигни 10 уровня', progressMax: 10 },
  { key: 'level_25', title: 'Легенда', description: 'Достигни 25 уровня', progressMax: 25 },
];

export function checkAchievements(
  achievements: Achievement[],
  stats: {
    totalTiles: number;
    level: number;
    nightTiles: number;
    totalDistance: number;
    sessionDistance: number;
    chestsCollected: number;
    rareChestsCollected: number;
    epicChestsCollected: number;
    leggoChestsCollected: number;
  },
): string[] {
  const newlyUnlocked: string[] = [];

  for (const achievement of achievements) {
    if (achievement.unlocked_at) continue;
    const def = ACHIEVEMENT_DEFS.find((a) => a.key === achievement.key);
    if (!def) continue;

    let progress = 0;
    switch (achievement.key) {
      case 'first_steps':
        progress = Math.min(stats.totalTiles, 1);
        break;
      case 'pioneer':
        progress = stats.totalTiles;
        break;
      case 'explorer':
        progress = stats.totalTiles;
        break;
      case 'night_wolf':
        progress = stats.nightTiles;
        break;
      case 'night_legend':
        progress = stats.nightTiles;
        break;
      case 'marathoner':
        progress = stats.totalDistance;
        break;
      case 'sprinter':
        progress = stats.sessionDistance;
        break;
      case 'treasure_hunter':
        progress = stats.chestsCollected;
        break;
      case 'treasure_hoarder':
        progress = stats.chestsCollected;
        break;
      case 'collector':
        progress = (stats.rareChestsCollected > 0 ? 1 : 0) +
                    (stats.epicChestsCollected > 0 ? 1 : 0) +
                    (stats.leggoChestsCollected > 0 ? 1 : 0);
        if (stats.chestsCollected > 0) progress += 1;
        break;
      case 'level_5':
        progress = stats.level;
        break;
      case 'level_10':
        progress = stats.level;
        break;
      case 'level_25':
        progress = stats.level;
        break;
    }

    if (progress >= def.progressMax) {
      newlyUnlocked.push(achievement.key);
    }
  }

  return newlyUnlocked;
}
