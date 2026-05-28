export const SCHEMA_VERSION = 2;

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS tiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    zoom INTEGER NOT NULL DEFAULT 23,
    discovered_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(x, y, zoom)
  );

  CREATE INDEX IF NOT EXISTS idx_tiles_xy_zoom ON tiles(x, y, zoom);

  CREATE TABLE IF NOT EXISTS gps_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    accuracy REAL NOT NULL DEFAULT 0,
    session_id INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_gps_session ON gps_log(session_id);

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    distance_m REAL NOT NULL DEFAULT 0,
    avg_speed REAL NOT NULL DEFAULT 0,
    tiles_opened INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    explored_area_m2 REAL NOT NULL DEFAULT 0,
    photos_completed INTEGER NOT NULL DEFAULT 0,
    treasures_found INTEGER NOT NULL DEFAULT 0,
    is_synced INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS chests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tile_x INTEGER NOT NULL,
    tile_y INTEGER NOT NULL,
    zoom INTEGER NOT NULL DEFAULT 23,
    rarity TEXT NOT NULL DEFAULT 'common',
    placed_at INTEGER NOT NULL,
    collected_at INTEGER,
    collected_by_session INTEGER,
    UNIQUE(tile_x, tile_y, zoom, placed_at),
    FOREIGN KEY (collected_by_session) REFERENCES sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_chests_collected ON chests(collected_at);

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    unlocked_at INTEGER,
    progress_current INTEGER NOT NULL DEFAULT 0,
    progress_max INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS player_stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    total_tiles_opened INTEGER NOT NULL DEFAULT 0,
    total_distance_m REAL NOT NULL DEFAULT 0,
    chests_collected INTEGER NOT NULL DEFAULT 0,
    night_tiles INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Module 1: Session areas (BBox / polygon)
  CREATE TABLE IF NOT EXISTS session_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    geometry_json TEXT NOT NULL,
    geometry_type TEXT NOT NULL DEFAULT 'bbox',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- Module 2: Photo tasks
  CREATE TABLE IF NOT EXISTS photo_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    tile_x INTEGER NOT NULL,
    tile_y INTEGER NOT NULL,
    zoom INTEGER NOT NULL DEFAULT 21,
    target_lat REAL NOT NULL,
    target_lng REAL NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    photo_original_path TEXT,
    photo_thumb_path TEXT,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- Module 3: Hidden treasures
  CREATE TABLE IF NOT EXISTS hidden_treasures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    tile_x INTEGER NOT NULL,
    tile_y INTEGER NOT NULL,
    zoom INTEGER NOT NULL DEFAULT 21,
    target_lat REAL NOT NULL,
    target_lng REAL NOT NULL,
    circle_center_lat REAL NOT NULL,
    circle_center_lng REAL NOT NULL,
    circle_radius_m REAL NOT NULL DEFAULT 150,
    collected_at INTEGER,
    xp_reward INTEGER NOT NULL DEFAULT 50,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_session_areas_session ON session_areas(session_id);
  CREATE INDEX IF NOT EXISTS idx_photo_tasks_session ON photo_tasks(session_id);
  CREATE INDEX IF NOT EXISTS idx_hidden_treasures_session ON hidden_treasures(session_id);
`;

export const MIGRATE_V1_TO_V2 = `
  ALTER TABLE sessions ADD COLUMN explored_area_m2 REAL NOT NULL DEFAULT 0;
  ALTER TABLE sessions ADD COLUMN photos_completed INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE sessions ADD COLUMN treasures_found INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE sessions ADD COLUMN is_synced INTEGER NOT NULL DEFAULT 0;
`;
