-- Seed data for Mobilize database
-- This file provides test data for all tables in the schema

-- ==================================================================
-- PROFILES - User accounts
-- ==================================================================

INSERT INTO profiles (display_name, avatar_url) VALUES
('Alex Chen', 'https://example.com/avatars/alex.jpg'),
('Maria Rodriguez', 'https://example.com/avatars/maria.jpg'),
('James Wilson', 'https://example.com/avatars/james.jpg'),
('Sarah Kim', 'https://example.com/avatars/sarah.jpg'),
('Michael Thompson', 'https://example.com/avatars/michael.jpg');

-- ==================================================================
-- POIS - Points of Interest (Accessibility features)
-- ==================================================================

INSERT INTO pois (poi_type, metadata, location_geojson) VALUES
-- Accessible entrances
('accessible_entrance', '{"building": "City Hall", "automatic_door": true, "door_width": 36}', '{"type":"Point","coordinates":[-122.4194,37.7749]}'),
('accessible_entrance', '{"building": "Public Library", "automatic_door": false, "door_width": 32, "buzzer": true}', '{"type":"Point","coordinates":[-122.4184,37.7739]}'),
('accessible_entrance', '{"building": "BART Station", "automatic_door": true, "elevator": true}', '{"type":"Point","coordinates":[-122.4064,37.7849]}'),

-- Accessible parking
('accessible_parking', '{"spaces": 5, "van_accessible": 2, "hourly_rate": 3.50}', '{"type":"Point","coordinates":[-122.4195,37.7750]}'),
('accessible_parking', '{"spaces": 8, "van_accessible": 3, "free_parking": true, "time_limit": 120}', '{"type":"Point","coordinates":[-122.4174,37.7729]}'),
('accessible_parking', '{"spaces": 12, "van_accessible": 4, "covered": true}', '{"type":"Point","coordinates":[-122.4054,37.7839]}'),

-- Wheelchair ramps
('wheelchair_ramp', '{"grade": "1:12", "handrails": true, "surface": "concrete"}', '{"type":"Point","coordinates":[-122.4196,37.7751]}'),
('wheelchair_ramp', '{"grade": "1:15", "handrails": true, "surface": "asphalt", "covered": true}', '{"type":"Point","coordinates":[-122.4186,37.7741]}'),
('wheelchair_ramp', '{"grade": "1:10", "handrails": false, "surface": "concrete", "temporary": true}', '{"type":"Point","coordinates":[-122.4066,37.7851]}'),

-- Accessible restrooms
('accessible_restroom', '{"single_occupancy": true, "baby_changing": true, "emergency_call": true}', '{"type":"Point","coordinates":[-122.4190,37.7745]}'),
('accessible_restroom', '{"single_occupancy": false, "baby_changing": false, "emergency_call": true, "automatic_flush": true}', '{"type":"Point","coordinates":[-122.4180,37.7735]}'),

-- Elevators
('elevator', '{"floors_served": [1,2,3,4], "voice_announcements": true, "braille_buttons": true}', '{"type":"Point","coordinates":[-122.4200,37.7755]}'),
('elevator', '{"floors_served": [1,2], "voice_announcements": false, "braille_buttons": true, "key_required": true}', '{"type":"Point","coordinates":[-122.4170,37.7725]}'),

-- Audio signals
('audio_signal', '{"type": "crosswalk", "volume_adjustable": true, "locator_tone": true}', '{"type":"Point","coordinates":[-122.4188,37.7743]}'),
('audio_signal', '{"type": "transit_stop", "real_time_announcements": true}', '{"type":"Point","coordinates":[-122.4068,37.7853]}'),

-- Tactile paving
('tactile_paving', '{"type": "warning", "material": "concrete", "condition": "good"}', '{"type":"Point","coordinates":[-122.4192,37.7747]}'),
('tactile_paving', '{"type": "directional", "material": "plastic", "condition": "fair", "needs_repair": true}', '{"type":"Point","coordinates":[-122.4182,37.7737]}');

-- ==================================================================
-- AVOIDANCE AREAS - Areas users want to avoid
-- ==================================================================

INSERT INTO avoidance_areas (user_id, name, description, boundary_geojson) VALUES
(1, 'Construction Zone - Market St', 'Heavy construction with blocked sidewalks',
 '{"type":"Polygon","coordinates":[[[-122.4200,37.7740],[-122.4180,37.7740],[-122.4180,37.7760],[-122.4200,37.7760],[-122.4200,37.7740]]]}'),

(2, 'Steep Hill Area', 'Very steep grades, difficult for wheelchair navigation',
 '{"type":"Polygon","coordinates":[[[-122.4100,37.7800],[-122.4080,37.7800],[-122.4080,37.7820],[-122.4100,37.7820],[-122.4100,37.7800]]]}'),

(3, 'Broken Sidewalk Zone', 'Multiple reports of cracked and uneven pavement',
 '{"type":"Polygon","coordinates":[[[-122.4220,37.7720],[-122.4200,37.7720],[-122.4200,37.7740],[-122.4220,37.7740],[-122.4220,37.7720]]]}'),

(1, 'Noisy Construction', 'Loud construction affecting hearing aid users',
 '{"type":"Polygon","coordinates":[[[-122.4150,37.7780],[-122.4130,37.7780],[-122.4130,37.7800],[-122.4150,37.7800],[-122.4150,37.7780]]]}');

-- ==================================================================
-- AVOIDANCE AREA REPORTS - User reports about problematic areas
-- ==================================================================

INSERT INTO avoidance_area_reports (user_id, avoidance_area_id, title, description) VALUES
(2, 1, 'Sidewalk completely blocked', 'Construction materials are blocking the entire sidewalk, forcing pedestrians into the street'),
(4, 1, 'No accessible detour', 'The detour route has stairs and no ramp alternative'),
(3, 2, 'Too steep for manual wheelchair', 'Grade appears to exceed ADA guidelines, very difficult to navigate'),
(5, 3, 'Multiple potholes', 'Several large cracks and holes in the sidewalk, dangerous for mobility devices'),
(1, 4, 'Interferes with hearing aids', 'Construction noise causes feedback and makes navigation audio cues inaudible');

-- ==================================================================
-- USER COMMON LOCATIONS - Frequently visited places
-- ==================================================================

INSERT INTO user_common_locations (user_id, label, location_geojson) VALUES
(1, 'Home', '{"type":"Point","coordinates":[-122.4150,37.7650]}'),
(1, 'Work', '{"type":"Point","coordinates":[-122.4200,37.7750]}'),
(1, 'Doctor Office', '{"type":"Point","coordinates":[-122.4100,37.7700]}'),
(1, 'Grocery Store', '{"type":"Point","coordinates":[-122.4180,37.7720]}'),

(2, 'Home', '{"type":"Point","coordinates":[-122.4250,37.7800]}'),
(2, 'Work', '{"type":"Point","coordinates":[-122.4050,37.7850]}'),
(2, 'Physical Therapy', '{"type":"Point","coordinates":[-122.4120,37.7750]}'),
(2, 'Community Center', '{"type":"Point","coordinates":[-122.4170,37.7780]}'),

(3, 'Home', '{"type":"Point","coordinates":[-122.4080,37.7680]}'),
(3, 'University', '{"type":"Point","coordinates":[-122.4160,37.7760]}'),
(3, 'Library', '{"type":"Point","coordinates":[-122.4184,37.7739]}'),

(4, 'Home', '{"type":"Point","coordinates":[-122.4300,37.7900]}'),
(4, 'Work', '{"type":"Point","coordinates":[-122.4190,37.7740]}'),
(4, 'Pharmacy', '{"type":"Point","coordinates":[-122.4210,37.7770]}'),

(5, 'Home', '{"type":"Point","coordinates":[-122.4120,37.7620]}'),
(5, 'Work', '{"type":"Point","coordinates":[-122.4070,37.7840]}'),
(5, 'Gym', '{"type":"Point","coordinates":[-122.4140,37.7740]}');

-- ==================================================================
-- USER NAVIGATION PREFERENCES - User-specific navigation settings
-- ==================================================================

INSERT INTO user_navigation_preferences (user_id, avoid_areas, gradient_tolerance) VALUES
(1, 1, 0.03),  -- Avoid areas, low gradient tolerance (3%)
(2, 1, 0.05),  -- Avoid areas, standard gradient tolerance (5%)
(3, 0, 0.08),  -- Don't avoid areas, higher gradient tolerance (8%)
(4, 1, 0.04),  -- Avoid areas, low-medium gradient tolerance (4%)
(5, 0, 0.10);  -- Don't avoid areas, high gradient tolerance (10%)

-- ==================================================================
-- SAMPLE QUERIES FOR TESTING
-- ==================================================================

-- Query all POIs by type:
-- SELECT * FROM pois WHERE poi_type = 'accessible_entrance';
-- SELECT * FROM pois WHERE poi_type LIKE 'accessible_%';

-- Find user's common locations:
-- SELECT * FROM user_common_locations WHERE user_id = 1;

-- Get user preferences with profile info:
-- SELECT p.display_name, unp.avoid_areas, unp.gradient_tolerance
-- FROM profiles p
-- JOIN user_navigation_preferences unp ON p.id = unp.user_id;

-- Find avoidance areas with reports:
-- SELECT aa.name, aa.description, COUNT(aar.id) as report_count
-- FROM avoidance_areas aa
-- LEFT JOIN avoidance_area_reports aar ON aa.id = aar.avoidance_area_id
-- GROUP BY aa.id, aa.name, aa.description;

-- Get all accessibility features in an area:
-- SELECT poi_type, metadata, location_geojson FROM pois
-- WHERE json_extract(location_geojson, '$.coordinates[0]') BETWEEN -122.42 AND -122.41
-- AND json_extract(location_geojson, '$.coordinates[1]') BETWEEN 37.77 AND 37.78;
