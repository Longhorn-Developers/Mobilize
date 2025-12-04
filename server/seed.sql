-- First, create a test user
INSERT INTO user (id, email, name, email_verified, role, username, created_at, updated_at) VALUES
('test-user-1', 'test@utexas.edu', 'Test Student', 1, 'student', 'teststudent', unixepoch(), unixepoch());

-- Create profile for the test user
INSERT INTO profiles (user_id, display_name, avatar_url, class_year, major, mobility_preference, created_at, updated_at) VALUES
('test-user-1', 'Test Student', 'https://example.com/avatars/alice.png', 'Senior', 'Computer Science', 'walking', unixepoch(), unixepoch());

-- Create avoidance area
INSERT INTO avoidance_areas (user_id, name, description, boundary_geojson, created_at, updated_at) VALUES 
('test-user-1', 'Downtown Austin', 'Construction zone', '{"type":"Polygon","coordinates":[[[-97.73658974358976,30.277696897222185],[-97.73444444444445,30.27788142522794],[-97.73455555555557,30.279985019969626],[-97.73665811965816,30.280117877070907],[-97.73658974358976,30.277696897222185]]]}', unixepoch(), unixepoch());

-- Create some POIs
INSERT INTO pois (poi_type, metadata, location_geojson, created_at, updated_at) VALUES
('landmark', '{"name":"UT Tower"}', '{"type":"Point","coordinates":[-97.7394,30.2862]}', unixepoch(), unixepoch()),
('building', '{"name":"PCL Library"}', '{"type":"Point","coordinates":[-97.7382,30.2827]}', unixepoch(), unixepoch()),
('building', '{"name":"Gregory Gym"}', '{"type":"Point","coordinates":[-97.7364,30.2844]}', unixepoch(), unixepoch());