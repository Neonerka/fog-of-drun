# Fog of Drun — Technical Plan for 5 Modules (Backup)

## Overview
Extending Fog of Drun with: Bounding Box, Photo Tasks, Hidden Treasures, Session Analytics, PC Server Sync.

## Module 1: Bounding Box
- `session_areas` table (geometry_json, geometry_type)
- Interactive polygon drawing in WebView → RN bridge
- Content generation filtered by BBox + undiscovered tiles only

## Module 2: Photo Tasks
- `photo_tasks` table (target coordinates, session_id, photo paths)
- Haversine proximity check in processGpsBatch
- expo-camera trigger at MAX_ACCURACY distance
- Photo saved to FileSystem, thumbnail shown in Leaflet popup via base64

## Module 3: Hidden Treasures
- `hidden_treasures` table (target T, circle center C, radius R)
- C = T + random offset (0-70% of R, random angle)
- Collection at 10m from true target T via GPS batch check

## Module 4: Analytics
- New columns on sessions: explored_area_m2, photos_completed, treasures_found, is_synced
- Haversine sum for distance, tileCount×tileArea for explored area
- Summary screen after session stop

## Module 5: PC Sync
- Two-phase protocol: JSON metadata → multipart photos → is_synced=1
- Health check via GET /api/ping
- Settings page with IP config + sync button
