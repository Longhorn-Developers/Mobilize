// POI synchronization utilities
// Migrated from Supabase Edge Functions

export async function syncAccessibleEntrances(db: D1Database, kmlUrl: string): Promise<void> {
  try {
    // Fetch KML data
    const response = await fetch(kmlUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch KML data: ${response.statusText}`);
    }

    const kmlText = await response.text();
    
    // Parse KML data
    const pois = await parseKMLToPOIs(kmlText);
    
    console.log(`Found ${pois.length} accessible entrances in KML data`);

    // Clear existing accessible entrances
    await db.prepare('DELETE FROM pois WHERE poi_type = ?').bind('accessible_entrance').run();

    // Insert new POIs
    for (const poi of pois) {
      try {
        await db.prepare(
          'INSERT INTO pois (poi_type, metadata, location_json) VALUES (?, ?, ?)'
        ).bind(
          poi.poi_type,
          JSON.stringify(poi.metadata),
          JSON.stringify(poi.location_json)
        ).run();
      } catch (error) {
        console.error('Error inserting POI:', error, poi);
        // Continue with other POIs even if one fails
      }
    }

    console.log(`Successfully synced ${pois.length} accessible entrances`);
  } catch (error) {
    console.error('Error in syncAccessibleEntrances:', error);
    throw error;
  }
}

async function parseKMLToPOIs(kmlText: string): Promise<any[]> {
  const pois: any[] = [];
  
  try {
    // Simple KML parsing (in production, use a proper XML parser)
    // This is a basic implementation - you may need to adjust based on your KML structure
    
    // Extract Placemark elements
    const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
    let match;
    
    while ((match = placemarkRegex.exec(kmlText)) !== null) {
      const placemarkContent = match[1];
      
      try {
        const poi = await parsePlacemark(placemarkContent);
        if (poi) {
          pois.push(poi);
        }
      } catch (error) {
        console.error('Error parsing placemark:', error);
        // Continue with other placemarks
      }
    }
  } catch (error) {
    console.error('Error parsing KML:', error);
    throw error;
  }
  
  return pois;
}

async function parsePlacemark(placemarkContent: string): Promise<any | null> {
  try {
    // Extract coordinates
    const coordinatesMatch = placemarkContent.match(/<coordinates>([^<]+)<\/coordinates>/);
    if (!coordinatesMatch) {
      return null;
    }
    
    const coords = coordinatesMatch[1].trim().split(',');
    if (coords.length < 2) {
      return null;
    }
    
    const longitude = parseFloat(coords[0]);
    const latitude = parseFloat(coords[1]);
    
    if (isNaN(longitude) || isNaN(latitude)) {
      return null;
    }

    // Extract name
    const nameMatch = placemarkContent.match(/<name>([^<]+)<\/name>/);
    const name = nameMatch ? nameMatch[1].trim() : null;

    // Extract description for additional metadata
    const descriptionMatch = placemarkContent.match(/<description>([^<]+)<\/description>/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';

    // Parse description for building name and other metadata
    const bldNameMatch = description.match(/Building:\s*([^\n]+)/i);
    const bldName = bldNameMatch ? bldNameMatch[1].trim() : null;

    const floorMatch = description.match(/Floor:\s*(\d+)/i);
    const floor = floorMatch ? parseInt(floorMatch[1]) : null;

    const autoOpenMatch = description.match(/Auto.*open/i);
    const autoOpene = !!autoOpenMatch;

    const poi = {
      poi_type: 'accessible_entrance',
      metadata: {
        name: name,
        bld_name: bldName,
        floor: floor,
        auto_opene: autoOpene
      },
      location_json: {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    };

    return poi;
  } catch (error) {
    console.error('Error parsing placemark:', error);
    return null;
  }
}
