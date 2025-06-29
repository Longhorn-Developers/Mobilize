# Avoidance Areas Guide for Supabase/PostGIS

**What is this?** This guide shows you how to work with geographic areas (polygons) that your app should avoid - like construction zones, restricted areas, or no-go zones.

## 🗄️ Understanding the Schema

The avoidance areas system consists of three main components:

### 1. Table: `avoidance_areas`

This is the main table that stores your polygon data:

| Column       | Type                    | Description                              |
| ------------ | ----------------------- | ---------------------------------------- |
| `id`         | UUID (PK)               | Unique identifier for each polygon       |
| `name`       | TEXT                    | Human-readable label (optional)          |
| `boundary`   | GEOMETRY(POLYGON, 4326) | The actual polygon shape in WGS84 format |
| `created_at` | TIMESTAMPTZ             | When the polygon was created             |
| `updated_at` | TIMESTAMPTZ             | When the polygon was last modified       |

**Key points:**

- `boundary` stores the polygon in PostGIS format (SRID 4326 = WGS84 coordinates)
- The table has a spatial index for fast geographic queries
- `name` is optional but useful for identifying zones

### 2. View: `avoidance_areas_with_geojson`

This view automatically converts PostGIS geometries to GeoJSON format:

```sql
-- This view is already created in your database
SELECT * FROM avoidance_areas_with_geojson;
```

**What it returns:**

- All the same data as the main table
- Plus `boundary_geojson` - a ready-to-use GeoJSON object
- Perfect for mapping libraries like Leaflet, Mapbox, or Google Maps

### 3. Function: `insert_avoidance_area`

This function safely inserts new polygons with validation:

```sql
-- This function is already available in your database
SELECT insert_avoidance_area('Zone Name', 'POLYGON((...))');
```

**Why use the function instead of direct INSERT?**

- Validates the polygon geometry
- Handles coordinate system conversion
- Returns the new polygon's ID
- Prevents common geometry errors

## 🧭 How to Use from Your App

### Adding a New Avoidance Zone

Here's how to add a new polygon from your JavaScript/TypeScript app:

#### Step 1: Prepare Your Coordinates

First, you need coordinates for your polygon. These should be in latitude/longitude format:

```typescript
// Example: A square around downtown Austin, TX
const coordinates = [
  [-97.7333, 30.2672], // Southwest corner
  [-97.7338, 30.2672], // Southeast corner
  [-97.7338, 30.268], // Northeast corner
  [-97.7333, 30.268], // Northwest corner
  [-97.7333, 30.2672], // Back to start (IMPORTANT!)
];

// Note: The first and last point must be identical to close the polygon
```

#### Step 2: Convert to WKT Format

WKT (Well-Known Text) is the format that PostGIS understands:

```typescript
function coordinatesToWKT(coordinates: number[][]): string {
  // Convert coordinates to "longitude latitude" format
  const points = coordinates
    .map((coord) => `${coord[0]} ${coord[1]}`)
    .join(", ");

  // Wrap in POLYGON format
  return `POLYGON((${points}))`;
}

const wkt = coordinatesToWKT(coordinates);
console.log(wkt);
// Output: POLYGON((-97.7333 30.2672, -97.7338 30.2672, -97.7338 30.268, -97.7333 30.268, -97.7333 30.2672))
```

#### Step 3: Insert the Polygon

Now call the RPC function to insert your polygon:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient("YOUR_SUPABASE_URL", "YOUR_SUPABASE_ANON_KEY");

async function addAvoidanceZone(name: string, coordinates: number[][]) {
  try {
    const wkt = coordinatesToWKT(coordinates);

    const { data, error } = await supabase.rpc("insert_avoidance_area", {
      p_name: name,
      p_wkt: wkt,
    });

    if (error) {
      console.error("Error adding avoidance zone:", error);
      throw error;
    }

    console.log("Successfully added avoidance zone with ID:", data);
    return data;
  } catch (error) {
    console.error("Failed to add avoidance zone:", error);
    throw error;
  }
}

// Usage example
await addAvoidanceZone("Downtown Construction Zone", coordinates);
```

### Fetching Avoidance Zones

To get all avoidance zones for display on a map:

```typescript
async function getAvoidanceZones() {
  try {
    const { data, error } = await supabase
      .from("avoidance_areas_with_geojson")
      .select("*");

    if (error) {
      console.error("Error fetching avoidance zones:", error);
      throw error;
    }

    console.log("Found avoidance zones:", data);
    return data;
  } catch (error) {
    console.error("Failed to fetch avoidance zones:", error);
    throw error;
  }
}

// Usage example
const zones = await getAvoidanceZones();
```

**What you get back:**

```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Downtown Construction Zone",
    "boundary_geojson": {
      "type": "Polygon",
      "coordinates": [
        [
          [-97.7333, 30.2672],
          [-97.7338, 30.2672],
          [-97.7338, 30.268],
          [-97.7333, 30.268],
          [-97.7333, 30.2672]
        ]
      ]
    },
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

### Using with Mapping Libraries

The `boundary_geojson` field is ready to use with popular mapping libraries:

#### Leaflet Example

```typescript
import L from "leaflet";

const zones = await getAvoidanceZones();

zones.forEach((zone) => {
  const polygon = L.geoJSON(zone.boundary_geojson, {
    style: {
      color: "red",
      fillColor: "#f03",
      fillOpacity: 0.3,
    },
  }).addTo(map);

  // Add a popup with the zone name
  polygon.bindPopup(zone.name);
});
```

#### Mapbox Example

```typescript
import mapboxgl from "mapbox-gl";

const zones = await getAvoidanceZones();

zones.forEach((zone) => {
  map.addSource(`zone-${zone.id}`, {
    type: "geojson",
    data: zone.boundary_geojson,
  });

  map.addLayer({
    id: `zone-${zone.id}`,
    type: "fill",
    source: `zone-${zone.id}`,
    paint: {
      "fill-color": "#ff0000",
      "fill-opacity": 0.3,
    },
  });
});
```

## 🔧 Common Issues and Solutions

### "Invalid geometry" Error

**Problem:** You get an error when trying to insert a polygon.

**Common causes:**

1. **Polygon not closed:** The first and last coordinate must be identical
2. **Wrong coordinate order:** WKT expects "longitude latitude" (not "latitude longitude")
3. **Invalid coordinates:** Coordinates must be valid numbers

**Solution:**

```typescript
// ✅ Correct - polygon is closed
const coordinates = [
  [-97.7333, 30.2672],
  [-97.7338, 30.2672],
  [-97.7333, 30.2672], // Same as first point
];

// ❌ Wrong - polygon is not closed
const coordinates = [
  [-97.7333, 30.2672],
  [-97.7338, 30.2672],
  // Missing closing point
];
```

## 🔗 Useful Resources

- [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [GeoJSON Specification](https://geojson.org/)
- [Well-Known Text (WKT) Format](https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry)

## 💡 Pro Tips

1. **Always close your polygons** - The first and last coordinate must be identical
2. **Use the view for GeoJSON** - Don't try to convert geometries in your app code
3. **Use the RPC function** - It handles validation and coordinate system conversion automatically
