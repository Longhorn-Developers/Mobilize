-- Cloudflare D1 Database Schema for Mobilize
-- Migrated from Supabase PostgreSQL to SQLite

-- Enable FTS (Full Text Search) extensions
-- Note: SQLite doesn't have PostGIS equivalent, so we'll store geospatial data as JSON

-- Profiles table (replaces auth.users + profiles)
CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User navigation preferences
CREATE TABLE user_navigation_preferences (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    avoid_areas BOOLEAN DEFAULT 1,
    gradient_tolerance REAL DEFAULT 0.05,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- User common locations
CREATE TABLE user_common_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    label TEXT NOT NULL,
    location_json TEXT NOT NULL, -- JSON string with lat/lng
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Avoidance areas (storing boundary as GeoJSON string)
CREATE TABLE avoidance_areas (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    name TEXT,
    boundary_json TEXT NOT NULL, -- GeoJSON string for polygon boundary
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
);

-- Avoidance area reports
CREATE TABLE avoidance_area_reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    avoidance_area_id TEXT,
    user_id TEXT,
    title TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (avoidance_area_id) REFERENCES avoidance_areas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
);

-- Points of Interest
CREATE TABLE pois (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    poi_type TEXT NOT NULL CHECK (poi_type IN ('accessible_entrance')),
    metadata TEXT NOT NULL, -- JSON string
    location_json TEXT NOT NULL, -- JSON string with lat/lng
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_avoidance_areas_user_id ON avoidance_areas(user_id);
CREATE INDEX idx_avoidance_area_reports_area_id ON avoidance_area_reports(avoidance_area_id);
CREATE INDEX idx_avoidance_area_reports_user_id ON avoidance_area_reports(user_id);
CREATE INDEX idx_user_common_locations_user_id ON user_common_locations(user_id);
CREATE INDEX idx_user_navigation_preferences_user_id ON user_navigation_preferences(user_id);
CREATE INDEX idx_pois_type ON pois(poi_type);

-- Triggers to update updated_at timestamps
CREATE TRIGGER update_profiles_updated_at 
    AFTER UPDATE ON profiles 
    BEGIN 
        UPDATE profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_user_navigation_preferences_updated_at 
    AFTER UPDATE ON user_navigation_preferences 
    BEGIN 
        UPDATE user_navigation_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_user_common_locations_updated_at 
    AFTER UPDATE ON user_common_locations 
    BEGIN 
        UPDATE user_common_locations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_avoidance_areas_updated_at 
    AFTER UPDATE ON avoidance_areas 
    BEGIN 
        UPDATE avoidance_areas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_avoidance_area_reports_updated_at 
    AFTER UPDATE ON avoidance_area_reports 
    BEGIN 
        UPDATE avoidance_area_reports SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_pois_updated_at 
    AFTER UPDATE ON pois 
    BEGIN 
        UPDATE pois SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
