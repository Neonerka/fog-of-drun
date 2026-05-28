import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { getDatabase } from '../src/db/database';
import { getSessions } from '../src/db/database';
import type { Session } from '../src/types';

export default function SessionsScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const db = await getDatabase();
    const rows = await getSessions(db, 100);
    setSessions(rows);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
    >
      <Text style={styles.title}>История прогулок</Text>
      {sessions.length === 0 && <Text style={styles.empty}>Пока нет завершённых сессий</Text>}
      {sessions.map((s) => {
        const start = new Date(s.started_at);
        const end = s.ended_at ? new Date(s.ended_at) : null;
        const duration = end
          ? Math.floor((end.getTime() - start.getTime()) / 1000)
          : 0;
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return (
          <View key={s.id} style={styles.card}>
            <Text style={styles.date}>{start.toLocaleDateString('ru-RU')}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Дистанция</Text>
              <Text style={styles.value}>{(s.distance_m / 1000).toFixed(2)} км</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Время</Text>
              <Text style={styles.value}>{minutes}:{String(seconds).padStart(2, '0')}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Тайлов открыто</Text>
              <Text style={styles.value}>{s.tiles_opened}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>XP получено</Text>
              <Text style={styles.value}>+{s.xp_earned}</Text>
            </View>
            {s.avg_speed > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Средняя скорость</Text>
                <Text style={styles.value}>{(s.avg_speed * 3.6).toFixed(1)} км/ч</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingTop: 60 },
  title: { color: '#f1f5f9', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  empty: { color: '#64748b', fontSize: 16, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  date: { color: '#22C55E', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: { color: '#94a3b8', fontSize: 14 },
  value: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
});
