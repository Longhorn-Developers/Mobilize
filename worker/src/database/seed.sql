-- Seed data for Mobilize database
-- Sample avoidance areas and POIs around UT Austin campus

-- Insert sample avoidance areas
INSERT INTO avoidance_areas (id, user_id, name, boundary_json, description) VALUES
-- Construction zone near UT Tower
('test-aa-1', NULL, 'Tower Construction Zone', 
 '{"type":"Polygon","coordinates":[[[-97.7395,30.2862],[-97.7390,30.2862],[-97.7390,30.2857],[-97.7395,30.2857],[-97.7395,30.2862]]]}',
 'Construction area with limited accessibility'),

-- Steps near Main Building
('test-aa-2', NULL, 'Main Building Steps', 
 '{"type":"Polygon","coordinates":[[[-97.7420,30.2855],[-97.7415,30.2855],[-97.7415,30.2850],[-97.7420,30.2850],[-97.7420,30.2855]]]}',
 'Large staircase without ramp access'),

-- Rough terrain near Gregory Gym
('test-aa-3', NULL, 'Gregory Gym Area', 
 '{"type":"Polygon","coordinates":[[[-97.7365,30.2838],[-97.7360,30.2838],[-97.7360,30.2833],[-97.7365,30.2833],[-97.7365,30.2838]]]}',
 'Uneven pavement and construction');

-- Insert sample POIs (accessible entrances)
INSERT INTO pois (id, poi_type, metadata, location_json) VALUES
-- UT Tower accessible entrance
('test-poi-1', 'accessible_entrance',
 '{"name":"UT Tower Accessible Entrance","bld_name":"Main Building","floor":1,"auto_opene":true}',
 '{"type":"Point","coordinates":[-97.7392,30.2859]}'),

-- Student Activity Center entrance
('test-poi-2', 'accessible_entrance',
 '{"name":"SAC West Entrance","bld_name":"Student Activity Center","floor":1,"auto_opene":true}',
 '{"type":"Point","coordinates":[-97.7410,30.2870]}'),

-- PCL accessible entrance
('test-poi-3', 'accessible_entrance',
 '{"name":"PCL South Entrance","bld_name":"Perry-Castañeda Library","floor":1,"auto_opene":true}',
 '{"type":"Point","coordinates":[-97.7393,30.2835]}'),

-- Welch Hall entrance
('test-poi-4', 'accessible_entrance',
 '{"name":"Welch Hall Main Entrance","bld_name":"Welch Hall","floor":1,"auto_opene":false}',
 '{"type":"Point","coordinates":[-97.7375,30.2865]}'),

-- Jester Center entrance
('test-poi-5', 'accessible_entrance',
 '{"name":"Jester West Auto Door","bld_name":"Jester Dormitory","floor":1,"auto_opene":true}',
 '{"type":"Point","coordinates":[-97.7330,30.2850]}');



