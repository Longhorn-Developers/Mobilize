insert into profiles (id, name, avatar_url) values
(1, 'Alice', 'https://example.com/avatars/alice.png');

insert into avoidance_areas (user_id, name, boundary_geojson) values (
	1,
	'Downtown Austin',
	'{"type":"Polygon","coordinates":[[[-97.73658974358976,30.277696897222185],[-97.73444444444445,30.27788142522794],[-97.73455555555557,30.279985019969626],[-97.73665811965816,30.280117877070907],[-97.73658974358976,30.277696897222185]]]}'
);
