import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useStore } from '../src/store/useStore';
import { saveHomeToDb } from '../src/game/engine';
import { checkServerAvailability, syncAll } from '../src/sync/syncClient';
import { DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT } from '../src/sync/syncConfig';

export default function SettingsScreen() {
  const homeLat = useStore((s) => s.homeLat);
  const homeLng = useStore((s) => s.homeLng);
  const setHome = useStore((s) => s.setHome);
  const lastGpsPoint = useStore((s) => s.lastGpsPoint);

  const [serverHost, setServerHost] = useState(DEFAULT_SERVER_HOST);
  const [serverPort, setServerPort] = useState(String(DEFAULT_SERVER_PORT));
  const [syncStatus, setSyncStatus] = useState<'' | 'checking' | 'available' | 'unavailable'>('');
  const [syncing, setSyncing] = useState(false);

  const handleSetHome = async () => {
    let lat: number, lng: number;
    if (lastGpsPoint && Date.now() - lastGpsPoint.timestamp < 60000) {
      lat = lastGpsPoint.lat;
      lng = lastGpsPoint.lng;
    } else {
      Alert.alert('Нет геопозиции', 'Подождите получения сигнала GPS или начните сессию.');
      return;
    }
    setHome(lat, lng);
    await saveHomeToDb(lat, lng);
    Alert.alert('Дом установлен', `Широта: ${lat.toFixed(4)}, Долгота: ${lng.toFixed(4)}`);
  };

  const handleCheckServer = useCallback(async () => {
    setSyncStatus('checking');
    const url = `http://${serverHost}:${serverPort}`;
    const ok = await checkServerAvailability(url);
    setSyncStatus(ok ? 'available' : 'unavailable');
  }, [serverHost, serverPort]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    const url = `http://${serverHost}:${serverPort}`;
    const result = await syncAll(url);
    setSyncing(false);

    if (result.success) {
      if (result.sessionsSynced === 0) {
        Alert.alert('Синхронизация', 'Нет данных для синхронизации.');
      } else {
        Alert.alert('Синхронизация', `Успешно синхронизировано ${result.sessionsSynced} сессий.`);
      }
    } else {
      const messages: Record<string, string> = {
        server_unreachable: 'Сервер недоступен. Проверьте, запущен ли ПК-сервер в локальной сети.',
        meta_upload_failed: 'Ошибка загрузки метаданных. Проверьте соединение.',
        meta_rejected: `Сервер отклонил данные (код ${result.status ?? 'unknown'}).`,
        photo_upload_failed: 'Ошибка загрузки фотографий.',
      };
      Alert.alert('Ошибка синхронизации', messages[result.reason] || result.reason);
    }
  }, [serverHost, serverPort]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Настройки</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Домашняя зона</Text>
        <Text style={styles.description}>
          Дом используется для бонусов к XP за открытие удалённых районов.
        </Text>
        {homeLat !== null && homeLng !== null ? (
          <Text style={styles.coords}>
            📍 {homeLat.toFixed(4)}, {homeLng.toFixed(4)}
          </Text>
        ) : (
          <Text style={styles.coords}>Не установлен</Text>
        )}
        <TouchableOpacity style={styles.button} onPress={handleSetHome}>
          <Text style={styles.buttonText}>Установить текущее местоположение как дом</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Синхронизация с ПК</Text>
        <Text style={styles.description}>
          Подключитесь к домашней Wi-Fi сети и синхронизируйте данные с локальным сервером.
          Все данные (треки, фото, метрики) будут выгружены на ПК.
        </Text>

        <Text style={styles.inputLabel}>Адрес сервера</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={serverHost}
            onChangeText={setServerHost}
            placeholder="192.168.1.100"
            placeholderTextColor="#64748b"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
          />
          <Text style={styles.inputSeparator}>:</Text>
          <TextInput
            style={[styles.input, { width: 80 }]}
            value={serverPort}
            onChangeText={setServerPort}
            placeholder="8080"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, syncStatus === 'checking' ? styles.buttonDisabled : null]}
          onPress={handleCheckServer}
          disabled={syncStatus === 'checking'}
        >
          {syncStatus === 'checking' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>
              {syncStatus === 'available' ? '✓ Сервер доступен' :
               syncStatus === 'unavailable' ? '✗ Сервер недоступен' :
               'Проверить соединение'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.syncButton, syncing ? styles.buttonDisabled : null]}
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <View style={styles.syncingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.buttonText}>  Синхронизация...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>📤 Синхронизировать все данные</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>О приложении</Text>
        <Text style={styles.description}>
          Fog of Drun v1.0.0{"\n"}
          Карта Прогресса — приложение для прогулок и пробежек с механикой «Туман войны».
          {"\n\n"}Все данные хранятся локально на устройстве.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16, paddingTop: 60 },
  title: { color: '#f1f5f9', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  description: { color: '#cbd5e1', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  coords: { color: '#22C55E', fontSize: 14, marginBottom: 12 },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  syncButton: { backgroundColor: '#22C55E' },
  syncingRow: { flexDirection: 'row', alignItems: 'center' },
  inputLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 6, marginTop: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    color: '#f1f5f9',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputSeparator: { color: '#64748b', fontSize: 18, marginHorizontal: 4 },
});
