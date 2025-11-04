// Define coordinate type for react-native-maps
interface Coordinates {
  latitude: number;
  longitude: number;
}

// Convert coordinates array to GeoJSON format for Cloudflare D1
export function coordinatesToGeoJSON(coordinates: Coordinates[]): any {
  if (coordinates.length < 3) {
    throw new Error('At least 3 coordinates are required to form a polygon');
  }

  // Close the polygon by adding the first coordinate at the end if it's not already there
  const closedCoordinates = [...coordinates];
  if (
    closedCoordinates[0].longitude !== closedCoordinates[closedCoordinates.length - 1].longitude ||
    closedCoordinates[0].latitude !== closedCoordinates[closedCoordinates.length - 1].latitude
  ) {
    closedCoordinates.push(closedCoordinates[0]);
  }

  // Format as GeoJSON Polygon
  return {
    type: 'Polygon',
    coordinates: [closedCoordinates.map(coord => [coord.longitude, coord.latitude])]
  };
}

// Legacy function for backward compatibility
export function coordinatesToWKT(coordinates: Coordinates[]): string {
  const geoJson = coordinatesToGeoJSON(coordinates);
  // Convert GeoJSON back to WKT for legacy compatibility
  const coordinateStrings = geoJson.coordinates[0].map((coord: number[]) => `${coord[0]} ${coord[1]}`);
  return `POLYGON((${coordinateStrings.join(', ')}))`;
}
