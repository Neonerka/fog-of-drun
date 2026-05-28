# Fog of Drun — Записка следующему агенту

## Сборка APK
```fish
cd /home/neonerka/Projects/fogofdrun/android && ./gradlew assembleRelease
```
APK: `android/app/build/outputs/apk/release/app-release.apk` (81 MB)
Установка: `adb install -r android/app/build/outputs/apk/release/app-release.apk`

## Типичная проблема: build ломается при переезде
В `android/build/generated/autolinking/autolinking.json` захардкожены **абсолютные пути**. Если проект переехал — clean + rebuild:
```fish
rm -rf android/build android/app/build android/app/.cxx android/.gradle
./gradlew assembleRelease
```
Gradle сам перегенерирует autolinking.json при сборке.

## Gradle — офлайн
`android/gradle/wrapper/gradle-wrapper.properties` → `distributionUrl=file:///.../gradle-9.3.1-bin.zip`.
Gradle 9.3.1 (131 MB) лежит в `android/gradle/dist/`. Сборка без интернета.

## Ключевые архитектурные решения
- **100% офлайн** — Leaflet JS/CSS вшиты в `src/map/mapHtml.ts` (172 KB). Тайлы кэшируются в IndexedDB.
- **GPS всегда активен** — `watchPositionAsync` запускается в `initializeEngine()` (foreground permission, background не нужен). Останавливается только при закрытии приложения.
- **Сессия** — кнопка ▶ стартует batch-таймер (3 сек) для записи тайлов/XP/сундуков в SQLite. GPS при этом уже работает.
- **MAX_ACCURACY = 100 м** (было 15 м) — без AGPS точность ниже.
- **DEFAULT_ZOOM = 21**, radius 1 (3×3 тайла на фикс GPS).
- **Пре-кэш тайлов** — при старте и каждые 5 км перемещения: zoom 10–18, радиус 10 км.

## Структура файлов
- `src/map/mapHtml.ts` — вся карта (Leaflet + IndexedDB + туман + сундуки + сообщения). ~1050 строк.
- `src/map/LeafletMap.tsx` — WebView bridge (React Native → JS).
- `src/game/engine.ts` — основной цикл: GPS, тайлы, XP, сундуки, ачивки.
- `screens/MapScreen.tsx` — экран карты с кнопками и статусами.
- `screens/SettingsScreen.tsx` — настройки, установка дома.
- `src/gps/tracker.ts` — обёртка над `expo-location`.

## Bridge (React Native ↔ WebView)
- RN → JS: `post({ type, ... })` через `handleRncMessage` в mapHtml.ts
- JS → RN: `window.ReactNativeWebView.postMessage(...)` — типы: `ready`, `viewport`, `precacheProgress`
- Добавлять новые типы в: `LeafletMap.tsx` (MapHandle + useImperativeHandle) + `mapHtml.ts` (handleRncMessage)

## GPS без интернета
- Первый фикс: 1–5 мин (холодный старт чипа без AGPS).
- После фикса — стабильно.
- Если карта не показывает точку — жди, чип ищет спутники.
- На кнопку "центр на мне" — если GPS не ответил за 10 сек, летит на дом.

## Дом
- Сохраняется в SQLite (`settings` table), загружается при старте.
- Зелёный маркер 🏠 на карте.
- При старте без GPS — карта летит на дом.
- Установка: Настройки → "Установить текущее местоположение как дом" (использует последнюю GPS-точку из store).

## Fallback тайлов офлайн
Если тайла на zoom 16+ нет в кэше и нет сети — рекурсивно пробует zoom-1 (до 5 уровней) с половинными x/y. Показывает мутный, но рабочий тайл.
