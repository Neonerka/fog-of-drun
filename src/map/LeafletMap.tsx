import React, { useRef, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { generateMapHtml } from './mapHtml';
import type { Chest, PhotoTask, HiddenTreasure, AreaGeometry } from '../types';

export interface MapHandle {
  addDiscoveredTiles: (tiles: string[]) => void;
  setUserLocation: (lat: number, lng: number) => void;
  setChests: (chests: Chest[]) => void;
  setHomeMarker: (lat: number | null, lng: number | null) => void;
  flyTo: (lat: number, lng: number) => void;
  precacheArea: (lat: number, lng: number, radiusKm: number, zoomLevels: number[]) => void;

  // Module 1: Bounding Box
  setSessionArea: (geometry: AreaGeometry | null) => void;
  startAreaDraw: () => void;

  // Module 2: Photo Tasks
  setPhotoTaskMarkers: (tasks: PhotoTask[]) => void;
  showPhotoInPopup: (taskId: number, base64: string) => void;

  // Module 3: Hidden Treasures
  setTreasureCircles: (treasures: HiddenTreasure[]) => void;
  treasureCollected: (data: { treasureId: number; xpReward: number }) => void;
}

export interface ViewportEvent {
  lat: number;
  lng: number;
  zoom: number;
  SW: { lat: number; lng: number };
  NE: { lat: number; lng: number };
}

interface LeafletMapProps {
  onViewportChange?: (event: ViewportEvent) => void;
  onAreaDrawn?: (coords: Array<[number, number]>) => void;
}

const LeafletMap = forwardRef<MapHandle, LeafletMapProps>(({ onViewportChange, onAreaDrawn }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const queueRef = useRef<string[]>([]);

  const flush = useCallback(() => {
    const q = queueRef.current;
    queueRef.current = [];
    for (const msg of q) {
      webViewRef.current?.postMessage(msg);
    }
  }, []);

  const post = useCallback((data: object) => {
    const msg = JSON.stringify(data);
    if (readyRef.current) {
      webViewRef.current?.postMessage(msg);
    } else {
      queueRef.current.push(msg);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    addDiscoveredTiles: (tiles: string[]) => {
      post({ type: 'tiles', tiles });
    },
    setUserLocation: (lat: number, lng: number) => {
      post({ type: 'location', lat, lng });
    },
    setChests: (chests: Chest[]) => {
      const mapped = chests.map((c) => ({
        id: c.id,
        tileX: c.tile_x,
        tileY: c.tile_y,
        zoom: c.zoom,
        rarity: c.rarity,
      }));
      post({ type: 'chests', chests: mapped });
    },
    setHomeMarker: (lat: number | null, lng: number | null) => {
      post({ type: 'homeMarker', lat, lng });
    },
    flyTo: (lat: number, lng: number) => {
      post({ type: 'flyTo', lat, lng });
    },
    precacheArea: (lat: number, lng: number, radiusKm: number, zoomLevels: number[]) => {
      post({ type: 'precache', lat, lng, radiusKm, zoomLevels });
    },

    // Module 1
    setSessionArea: (geometry: AreaGeometry | null) => {
      post({ type: 'sessionArea', geometry });
    },
    startAreaDraw: () => {
      post({ type: 'startAreaDraw' });
    },

    // Module 2
    setPhotoTaskMarkers: (tasks: PhotoTask[]) => {
      const mapped = tasks.map(t => ({
        id: t.id, tileX: t.tileX, tileY: t.tileY, zoom: t.zoom,
        targetLat: t.targetLat, targetLng: t.targetLng,
        description: t.description, completed: t.completedAt !== null,
      }));
      post({ type: 'photoTaskMarkers', tasks: mapped });
    },
    showPhotoInPopup: (taskId: number, base64: string) => {
      post({ type: 'showPhoto', taskId, base64 });
    },

    // Module 3
    setTreasureCircles: (treasures: HiddenTreasure[]) => {
      const mapped = treasures.map(t => ({
        id: t.id, centerLat: t.circleCenterLat, centerLng: t.circleCenterLng,
        radiusM: t.circleRadiusM, collected: t.collectedAt !== null, xpReward: t.xpReward,
      }));
      post({ type: 'treasureCircles', circles: mapped });
    },
    treasureCollected: (data: { treasureId: number; xpReward: number }) => {
      post({ type: 'treasureCollected', ...data });
    },
  }));

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        readyRef.current = true;
        flush();
        return;
      }
      if (data.type === 'viewport' && onViewportChange) {
        onViewportChange(data as ViewportEvent);
        return;
      }
      if (data.type === 'areaDrawn' && onAreaDrawn) {
        onAreaDrawn(data.coords as Array<[number, number]>);
      }
    } catch {}
  }, [onViewportChange, onAreaDrawn, flush]);

  const html = generateMapHtml();

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        style={styles.webview}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        mixedContentMode="always"
        geolocationEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        onMessage={handleMessage}
      />
    </View>
  );
});

LeafletMap.displayName = 'LeafletMap';

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#1a1a2e' },
});

export default LeafletMap;
