import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useStore } from '../src/store/useStore';
import { getDatabase } from '../src/db/database';
import { getStats } from '../src/db/database';
import { computeLevel, xpProgressInLevel, xpForLevel } from '../src/game/xp';
import type { PlayerStats } from '../src/types';

export default function ProgressScreen() {
  const playerStats = useStore((s) => s.playerStats);
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    getDatabase().then(async (db) => {
      const stats = await getStats(db);
      if (stats) {
        useStore.getState().setPlayerStats(stats);
      }
      setRefreshed(true);
    });
  }, []);

  const stats = playerStats;
  if (!stats) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Загрузка...</Text>
      </View>
    );
  }

  const level = computeLevel(stats.total_xp);
  const progress = xpProgressInLevel(stats.total_xp);
  const nextLevelXp = xpForLevel(level);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Мой прогресс</Text>

      <View style={styles.card}>
        <Text style={styles.levelLabel}>Уровень {level}</Text>
        <View style={styles.xpBar}>
          <View
            style={[
              styles.xpFill,
              { width: `${(progress.current / Math.max(progress.needed, 1)) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.xpText}>
          {progress.current} / {progress.needed} XP (всего: {stats.total_xp})
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Статистика</Text>
        <StatRow label="Открыто тайлов" value={stats.total_tiles_opened.toLocaleString()} />
        <StatRow label="Пройдено дистанция" value={`${(stats.total_distance_m / 1000).toFixed(2)} км`} />
        <StatRow label="Собрано сундуков" value={stats.chests_collected.toString()} />
        <StatRow label="Ночных тайлов" value={stats.night_tiles.toLocaleString()} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Следующий уровень</Text>
        <Text style={styles.bodyText}>
          До уровня {level + 1}: осталось {nextLevelXp - progress.current} XP
        </Text>
      </View>
    </ScrollView>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingTop: 60 },
  loading: { color: '#94a3b8', fontSize: 18, textAlign: 'center', marginTop: 60 },
  title: { color: '#f1f5f9', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  levelLabel: { color: '#f1f5f9', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  xpBar: {
    height: 12,
    backgroundColor: '#334155',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 6,
  },
  xpText: { color: '#94a3b8', fontSize: 12 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  statLabel: { color: '#cbd5e1', fontSize: 14 },
  statValue: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  bodyText: { color: '#cbd5e1', fontSize: 14, lineHeight: 20 },
});
