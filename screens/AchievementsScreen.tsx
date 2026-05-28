import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useStore } from '../src/store/useStore';
import { getDatabase } from '../src/db/database';
import { getAchievements } from '../src/db/database';
import type { Achievement } from '../src/types';

export default function AchievementsScreen() {
  const achievements = useStore((s) => s.achievements);

  useEffect(() => {
    getDatabase().then(async (db) => {
      const rows = await getAchievements(db);
      useStore.getState().setAchievements(rows);
    });
  }, []);

  const unlocked = achievements.filter((a) => a.unlocked_at);
  const locked = achievements.filter((a) => !a.unlocked_at);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Достижения</Text>
      <Text style={styles.subtitle}>
        Получено: {unlocked.length} / {achievements.length}
      </Text>

      {unlocked.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>✦ Получено</Text>
          {unlocked.map((a) => (
            <AchievementCard key={a.id} achievement={a} unlocked />
          ))}
        </>
      )}

      {locked.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>✦ В процессе</Text>
          {locked.map((a) => (
            <AchievementCard key={a.id} achievement={a} unlocked={false} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function AchievementCard({ achievement, unlocked }: { achievement: Achievement; unlocked: boolean }) {
  const progress = achievement.progress_max > 0
    ? Math.min(achievement.progress_current, achievement.progress_max)
    : 0;
  const percent = achievement.progress_max > 0
    ? (progress / achievement.progress_max) * 100
    : 0;

  return (
    <View style={[styles.card, unlocked && styles.cardUnlocked]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, unlocked && styles.cardTitleUnlocked]}>
          {unlocked ? '🏆' : '🔒'} {achievement.title}
        </Text>
        {unlocked && (
          <Text style={styles.dateText}>
            {new Date(achievement.unlocked_at!).toLocaleDateString()}
          </Text>
        )}
      </View>
      <Text style={styles.description}>{achievement.description}</Text>
      {!unlocked && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {progress} / {achievement.progress_max}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingTop: 60 },
  title: { color: '#f1f5f9', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 20 },
  sectionTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardUnlocked: {
    borderColor: '#22C55E',
    backgroundColor: '#1a2e1a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: { color: '#cbd5e1', fontSize: 16, fontWeight: '600' },
  cardTitleUnlocked: { color: '#22C55E' },
  dateText: { color: '#64748b', fontSize: 12 },
  description: { color: '#94a3b8', fontSize: 13, marginBottom: 8 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  progressText: { color: '#94a3b8', fontSize: 12, minWidth: 60, textAlign: 'right' },
});
