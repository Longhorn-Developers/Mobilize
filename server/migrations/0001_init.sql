-- Cloudflare D1 SQLite Schema converted from Supabase PostgreSQL
-- Using SQLite-native ID generation and flexible poi_type

-- ==================================================================
-- TABLES
-- ==================================================================
PRAGMA defer_foreign_keys = on;

CREATE TABLE IF NOT EXISTS avoidance_area_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    avoidance_area_id INTEGER,
    title TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (avoidance_area_id) REFERENCES avoidance_areas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS avoidance_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    description TEXT,
    boundary_geojson TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL,
    CHECK (json_valid(boundary_geojson)),
    CHECK (json_extract(boundary_geojson, '$.type') = 'Polygon' OR json_extract(boundary_geojson, '$.type') = 'MultiPolygon'),
    CHECK (json_extract(boundary_geojson, '$.coordinates') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS pois (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poi_type TEXT NOT NULL,
    metadata TEXT NOT NULL,
    location_geojson TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    CHECK (json_valid(metadata)),
    CHECK (json_valid(location_geojson))
);

CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT,
    avatar_url TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_common_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    label TEXT NOT NULL,
    location_geojson TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,

    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
	CHECK (json_valid(location_geojson))
);

CREATE TABLE IF NOT EXISTS user_navigation_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    avoid_areas BOOLEAN NOT NULL CHECK (avoid_areas IN (0, 1)) DEFAULT 0,
    gradient_tolerance REAL DEFAULT 0.05,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

PRAGMA defer_foreign_keys = off;

-- ==================================================================
-- INDEXES
-- ==================================================================

CREATE INDEX IF NOT EXISTS idx_avoidance_areas_user_id ON avoidance_areas(user_id);
CREATE INDEX IF NOT EXISTS idx_avoidance_areas_created_at ON avoidance_areas(created_at);

CREATE INDEX IF NOT EXISTS idx_pois_poi_type ON pois(poi_type);
CREATE INDEX IF NOT EXISTS idx_pois_created_at ON pois(created_at);

CREATE INDEX IF NOT EXISTS idx_avoidance_area_reports_avoidance_area_id ON avoidance_area_reports(avoidance_area_id);
CREATE INDEX IF NOT EXISTS idx_avoidance_area_reports_user_id ON avoidance_area_reports(user_id);

CREATE INDEX IF NOT EXISTS idx_user_common_locations_user_id ON user_common_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_navigation_preferences_user_id ON user_navigation_preferences(user_id);

-- ==================================================================
-- UNIQUE CONSTRAINTS
-- ==================================================================

-- Ensure one navigation preference per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_navigation_preferences_unique ON user_navigation_preferences(user_id);

-- ==================================================================
-- TRIGGERS for updated_at timestamps
-- ==================================================================

CREATE TRIGGER IF NOT EXISTS trigger_avoidance_area_reports_updated_at
    AFTER UPDATE ON avoidance_area_reports
BEGIN
    UPDATE avoidance_area_reports
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trigger_avoidance_areas_updated_at
    AFTER UPDATE ON avoidance_areas
BEGIN
    UPDATE avoidance_areas
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trigger_pois_updated_at
    AFTER UPDATE ON pois
BEGIN
    UPDATE pois
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trigger_profiles_updated_at
    AFTER UPDATE ON profiles
BEGIN
    UPDATE profiles
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trigger_user_navigation_preferences_updated_at
    AFTER UPDATE ON user_navigation_preferences
BEGIN
    UPDATE user_navigation_preferences
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;
