import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, ScrollView, Modal } from 'react-native';
import * as Location from 'expo-location';
import LeafletMap, { type MapHandle } from '../src/map/LeafletMap';
import { useStore } from '../src/store/useStore';
import { initializeEngine, startSession, stopSession, refreshChestsInViewport } from '../src/game/engine';
import { tileFromCoordinates, computeViewportTileBounds, DEFAULT_ZOOM } from '../src/game/fog';
import { xpProgressInLevel } from '../src/game/xp';
import { formatDuration, formatDistance, formatArea } from '../src/game/analytics';
import type { ViewportEvent } from '../src/map/LeafletMap';
import type { AreaGeometry } from '../src/types';

function gpsWithTimeout(timeoutMs: number): Promise<Location.LocationObject> {
  return Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('GPS timeout')), timeoutMs),
    ),
  ]);
}

export default function MapScreen() {
  const mapRef = useRef<MapHandle>(null);
  const engineInitialized = useRef(false);
  const hasFlownToFirstLoc = useRef(false);

  const isTracking = useStore((s) => s.isTracking);
  const playerStats = useStore((s) => s.playerStats);
  const visibleChests = useStore((s) => s.visibleChests);
  const discoveredTiles = useStore((s) => s.discoveredTiles);
  const sessionDistance = useStore((s) => s.sessionDistance);
  const lastGpsPoint = useStore((s) => s.lastGpsPoint);
  const homeLat = useStore((s) => s.homeLat);
  const homeLng = useStore((s) => s.homeLng);
  const recentUnlocks = useStore((s) => s.recentUnlockedAchievements);
  const sessionArea = useStore((s) => s.sessionArea);
  const isDrawingArea = useStore((s) => s.isDrawingArea);
  const photoTasks = useStore((s) => s.photoTasks);
  const hiddenTreasures = useStore((s) => s.hiddenTreasures);
  const sessionSummary = useStore((s) => s.sessionSummary);
  const treasuresFound = useStore((s) => s.treasuresFound);
  const photosCompleted = useStore((s) => s.photosCompleted);

  const [initialized, setInitialized] = useState(false);
  const [showUnlocks, setShowUnlocks] = useState(false);
  const [lastUnlocks, setLastUnlocks] = useState<string[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (engineInitialized.current) return;
    engineInitialized.current = true;
    initializeEngine().then(() => setInitialized(true));
  }, []);

  useEffect(() => {
    if (recentUnlocks.length > 0) {
      setLastUnlocks(recentUnlocks);
      setShowUnlocks(true);
      const timer = setTimeout(() => setShowUnlocks(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [recentUnlocks]);

  useEffect(() => {
    if (discoveredTiles.size > 0 && mapRef.current) {
      mapRef.current.addDiscoveredTiles(Array.from(discoveredTiles));
    }
  }, [discoveredTiles]);

  useEffect(() => {
    if (visibleChests.length > 0 && mapRef.current) {
      mapRef.current.setChests(visibleChests);
    }
  }, [visibleChests]);

  useEffect(() => {
    if (lastGpsPoint && mapRef.current) {
      mapRef.current.setUserLocation(lastGpsPoint.lat, lastGpsPoint.lng);
      if (!hasFlownToFirstLoc.current) {
        hasFlownToFirstLoc.current = true;
        mapRef.current.flyTo(lastGpsPoint.lat, lastGpsPoint.lng);
      }
    }
  }, [lastGpsPoint]);

  // Show home marker and fly to home as fallback when no GPS
  useEffect(() => {
    if (!initialized || !mapRef.current) return;
    if (homeLat !== null && homeLng !== null) {
      mapRef.current.setHomeMarker(homeLat, homeLng);
    }
  }, [initialized, homeLat, homeLng]);

  // Module 1: Send session area to map
  useEffect(() => {
    if (!initialized || !mapRef.current) return;
    mapRef.current.setSessionArea(sessionArea);
  }, [initialized, sessionArea]);

  // Module 2: Send photo task markers to map
  useEffect(() => {
    if (!initialized || !mapRef.current) return;
    if (photoTasks.length > 0) {
      mapRef.current.setPhotoTaskMarkers(photoTasks);
    }
  }, [initialized, photoTasks]);

  // Module 3: Send treasure circles to map
  useEffect(() => {
    if (!initialized || !mapRef.current) return;
    if (hiddenTreasures.length > 0) {
      mapRef.current.setTreasureCircles(hiddenTreasures);
    }
  }, [initialized, hiddenTreasures]);

  // Module 4: Show session summary modal
  useEffect(() => {
    if (sessionSummary) {
      setShowSummary(true);
    }
  }, [sessionSummary]);

  useEffect(() => {
    if (!initialized || !mapRef.current) return;
    if (!lastGpsPoint && homeLat !== null && homeLng !== null) {
      mapRef.current.flyTo(homeLat, homeLng);
    }
  }, [initialized, lastGpsPoint, homeLat, homeLng]);

  const precacheCenter = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!initialized || !lastGpsPoint || !mapRef.current) return;

    const center = precacheCenter.current;
    if (center) {
      const R = 6371000;
      const dLat = (lastGpsPoint.lat - center.lat) * Math.PI / 180;
      const dLng = (lastGpsPoint.lng - center.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(center.lat * Math.PI / 180) * Math.cos(lastGpsPoint.lat * Math.PI / 180) * Math.sin(dLng/2)**2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      if (dist < 5000) return;
    }

    precacheCenter.current = { lat: lastGpsPoint.lat, lng: lastGpsPoint.lng };
    const zoomLevels = [10, 11, 12, 13, 14, 15, 16, 17, 18];
    mapRef.current.precacheArea(lastGpsPoint.lat, lastGpsPoint.lng, 10, zoomLevels);
  }, [initialized, lastGpsPoint]);

  const handleStartStop = useCallback(async () => {
    if (isTracking) {
      setShowSummary(false);
      await stopSession();
    } else {
      if (!sessionArea) {
        Alert.alert('Выберите зону', 'Сначала выделите рабочую зону на карте, нажав "Выбрать зону".');
        return;
      }
      const started = await startSession(sessionArea);
      if (!started) {
        Alert.alert(
          'Доступ к геолокации',
          'Разрешите доступ к геолокации в настройках устройства, чтобы начать отслеживание.',
        );
      }
    }
  }, [isTracking, sessionArea]);

  const handleCenterOnMe = useCallback(async () => {
    if (lastGpsPoint && mapRef.current) {
      mapRef.current.flyTo(lastGpsPoint.lat, lastGpsPoint.lng);
      return;
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return;
    try {
      const loc = await gpsWithTimeout(10000);
      if (mapRef.current) {
        mapRef.current.setUserLocation(loc.coords.latitude, loc.coords.longitude);
        mapRef.current.flyTo(loc.coords.latitude, loc.coords.longitude);
      }
    } catch {
      if (homeLat !== null && homeLng !== null && mapRef.current) {
        mapRef.current.flyTo(homeLat, homeLng);
      }
    }
  }, [lastGpsPoint, homeLat, homeLng]);

  const handleAreaDraw = useCallback(() => {
    useStore.getState().setIsDrawingArea(true);
    mapRef.current?.startAreaDraw();
  }, []);

  const handleAreaDrawn = useCallback((coords: Array<[number, number]>) => {
    if (coords.length >= 3) {
      const geometry: AreaGeometry = { type: 'polygon', coords };
      useStore.getState().setSessionArea(geometry);
    }
    useStore.getState().setIsDrawingArea(false);
  }, []);

  const handleCancelArea = useCallback(() => {
    useStore.getState().setSessionArea(null);
    mapRef.current?.setSessionArea(null);
  }, []);

  const handleViewportChange = useCallback(async (event: ViewportEvent) => {
    const bounds = computeViewportTileBounds(
      event.lat, event.lng, DEFAULT_ZOOM,
      10, 10,
    );
    await refreshChestsInViewport(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY);
  }, []);

  const xpProgress = playerStats ? xpProgressInLevel(playerStats.total_xp) : { current: 0, needed: 1 };

  const handleCloseSummary = useCallback(() => {
    setShowSummary(false);
    useStore.getState().setSessionSummary(null);
  }, []);

  return (
    <View style={styles.container}>
      <LeafletMap ref={mapRef} onViewportChange={handleViewportChange} onAreaDrawn={handleAreaDrawn} />

      <TouchableOpacity style={styles.centerButton} onPress={handleCenterOnMe}>
        <Text style={styles.centerButtonText}>◎</Text>
      </TouchableOpacity>

      {!isTracking && (
        <TouchableOpacity style={styles.areaDrawButton} onPress={handleAreaDraw}>
          <Text style={styles.areaDrawButtonText}>
            {sessionArea ? '⊡' : '⊟'}
          </Text>
        </TouchableOpacity>
      )}

      {sessionArea && !isTracking && (
        <TouchableOpacity style={styles.cancelAreaButton} onPress={handleCancelArea}>
          <Text style={styles.cancelAreaButtonText}>✕</Text>
        </TouchableOpacity>
      )}

      <View style={styles.topBar}>
        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            Ур. {playerStats?.level ?? 1}
          </Text>
          <View style={styles.xpBar}>
            <View
              style={[
                styles.xpFill,
                { width: `${(xpProgress.current / Math.max(xpProgress.needed, 1)) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.statText}>
            {xpProgress.current}/{xpProgress.needed} XP
          </Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            🗺️ {playerStats?.total_tiles_opened ?? 0}
          </Text>
          <Text style={styles.statText}>
            📏 {(sessionDistance / 1000).toFixed(2)} км
          </Text>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.mainButton, isTracking ? styles.stopButton : styles.startButton]}
          onPress={handleStartStop}
        >
          <Text style={styles.mainButtonText}>
            {isTracking ? '⏹' : '▶'}
          </Text>
        </TouchableOpacity>
      </View>

      {showUnlocks && lastUnlocks.length > 0 && (
        <View style={styles.unlockBanner}>
          <Text style={styles.unlockText}>🏆 {lastUnlocks.join(', ')}</Text>
        </View>
      )}

      <Modal visible={showSummary && sessionSummary !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>ИТОГИ СЕССИИ</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>📏 Дистанция</Text>
              <Text style={styles.summaryValue}>{formatDistance(sessionSummary?.distanceM ?? 0)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>🗺️ Новых тайлов</Text>
              <Text style={styles.summaryValue}>{sessionSummary?.newTiles ?? 0}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>📐 Площадь</Text>
              <Text style={styles.summaryValue}>{formatArea(sessionSummary?.exploredAreaM2 ?? 0)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>📷 Фото-заданий</Text>
              <Text style={styles.summaryValue}>{sessionSummary?.photosCompleted ?? 0}/{sessionSummary?.totalPhotos ?? 0}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>💎 Сокровищ</Text>
              <Text style={styles.summaryValue}>{sessionSummary?.treasuresFound ?? 0}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>⭐ XP</Text>
              <Text style={styles.summaryValue}>+{sessionSummary?.xpEarned ?? 0}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>⏱ Время</Text>
              <Text style={styles.summaryValue}>{formatDuration(sessionSummary?.durationSec ?? 0)}</Text>
            </View>
            <TouchableOpacity style={styles.summaryButton} onPress={handleCloseSummary}>
              <Text style={styles.summaryButtonText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    padding: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  statText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  xpBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mainButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  startButton: { backgroundColor: '#22C55E' },
  stopButton: { backgroundColor: '#EF4444' },
  mainButtonText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  centerButton: {
    position: 'absolute',
    bottom: 140,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  centerButtonText: { color: '#22C55E', fontSize: 24 },
  unlockBanner: {
    position: 'absolute',
    top: 160,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(250, 204, 21, 0.9)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  unlockText: { color: '#1a1a1a', fontSize: 16, fontWeight: 'bold' },

  // Module 1: Area draw buttons
  areaDrawButton: {
    position: 'absolute',
    bottom: 140,
    right: 80,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  areaDrawButtonText: { color: '#22C55E', fontSize: 24 },
  cancelAreaButton: {
    position: 'absolute',
    bottom: 140,
    right: 140,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelAreaButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Module 4: Session summary modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    width: '85%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryTitle: {
    color: '#22C55E',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  summaryLabel: { color: '#94a3b8', fontSize: 16 },
  summaryValue: { color: '#fff', fontSize: 16, fontWeight: '600' },
  summaryButton: {
    marginTop: 20,
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  summaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
