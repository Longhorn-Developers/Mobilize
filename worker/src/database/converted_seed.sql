-- Converted seed data for Cloudflare D1 database
-- Original PostgreSQL data converted to SQLite with GeoJSON

-- Insert Downtown Austin avoidance area
-- Original WKT: POLYGON((-97.7333 30.2672, -97.7338 30.2672, -97.7338 30.268, -97.7333 30.268, -97.7333 30.2672))
INSERT INTO avoidance_areas (id, user_id, name, boundary_json, description) VALUES
('downtown-austin-1', NULL, 'Downtown Austin', 
 '{"type":"Polygon","coordinates":[[[-97.7333,30.2672],[-97.7338,30.2672],[-97.7338,30.268],[-97.7333,30.268],[-97.7333,30.2672]]]}',
 'Downtown Austin area');

-- Add some sample POIs around UT Austin campus
-- These are accessible entrances at common campus locations

INSERT INTO pois (id, poi_type, metadata, location_json) VALUES
-- UT Tower accessible entrance
('poi-ut-tower', 'accessible_entrance',
 '{"name":"UT Tower Accessible Entrance","bld_name":"Main Building","floor":1,"auto_opene":true}',
 '{"type":"Point","coordinates":[-97.7392,30.2859]}'),

-- Student Activity Center entrance
('poi-sac', 'accessible_entrance',
 '{"name":"SAC West Entrance","bld_name":"Student Activity Center","floor":1,"auto_opene":true}',
 '{"type":"Point","coordinates":[-97.7410,30.2870]}'),

-- Perry-Castañeda Library entrance
('poi-pcl', 'accessible_entrance',
 '{"name":"PCL South Entrance","bld_name":"Perry-Castañeda Library","floor":1,"auto_opene":true}',
 '{"type":"Point","coordinates":[-97.7393,30.2835]}'),

-- Welch Hall entrance
('poi-welch', 'accessible_entrance',
 '{"name":"Welch Hall Main Entrance","bld_name":"Welch Hall","floor":1,"auto_opene":false}',
 '{"type":"Point","coordinates":[-97.7375,30.2865]}'),

-- Jester Center entrance
('poi-jester', 'accessible_entrance',
 '{"name":"Jester West Auto Door","bld_name":"Jester Dormitory","floor":1,"auto_opene":true}',
 '{"type":"Point","coordinates":[-97.7330,30.2850]}');



