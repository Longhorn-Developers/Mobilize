insert into profiles (id, name, avatar_url) values
(0, 'Bob', 'https://example.com/avatars/bob.png');

insert into avoidance_areas (user_id, name, boundary_geojson) values (
	0,
	'Downtown Austin',
	'{"type":"Polygon","coordinates":[[[-97.7333,30.2672],[-97.7338,30.2672],[-97.7338,30.268],[-97.7333,30.268],[-97.7333,30.2672]]]}'
);
