// Parse KML file and generate SQL INSERT statements for accessible entrances
const fs = require('fs');

// Read the KML file
const kml = fs.readFileSync('accessible-entrances.kml', 'utf-8');

// Extract all Placemarks
const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
const placemarks = [...kml.matchAll(placemarkRegex)];

const insertStatements = [];

console.log(`Found ${placemarks.length} placemarks`);

placemarks.forEach((match, index) => {
  const placemark = match[1];
  
  // Extract name
  const nameMatch = placemark.match(/<name>(.*?)<\/name>/);
  const name = nameMatch ? nameMatch[1].trim() : '';
  
  // Extract Auto_Opene
  const autoOpeneMatch = placemark.match(/<Data name="Auto_Opene">[\s\S]*?<value>(\d+)<\/value>/);
  const autoOpene = autoOpeneMatch ? parseInt(autoOpeneMatch[1]) === 1 : false;
  
  // Extract Floor
  const floorMatch = placemark.match(/<Data name="Floor">[\s\S]*?<value>(.*?)<\/value>/);
  const floor = floorMatch ? floorMatch[1].trim() : null;
  
  // Extract coordinates (format: longitude,latitude,altitude)
  const coordsMatch = placemark.match(/<coordinates>\s*([-\d.]+),([-\d.]+),[-\d.]+\s*<\/coordinates>/);
  if (!coordsMatch) {
    console.log(`Skipping entry ${index}: No coordinates found`);
    return;
  }
  
  const longitude = parseFloat(coordsMatch[1]);
  const latitude = parseFloat(coordsMatch[2]);
  
  // Generate a unique ID
  const id = `poi-${index + 1}`;
  
  // Create metadata JSON
  const metadata = {
    name: name,
    bld_name: name,
    floor: floor ? parseInt(floor) : null,
    auto_opene: autoOpene
  };
  
  // Create location GeoJSON
  const locationJson = {
    type: "Point",
    coordinates: [longitude, latitude]
  };
  
  // Generate INSERT statement
  const insertStatement = `('${id}', 'accessible_entrance', '${JSON.stringify(metadata).replace(/'/g, "''")}', '${JSON.stringify(locationJson).replace(/'/g, "''")}')`;
  insertStatements.push(insertStatement);
});

// Write SQL file
const sqlContent = `-- Accessible Entrances data from UT Austin Campus Accessibility Map
-- Source: https://www.google.com/maps/d/kml?forcekml=1&mid=1B_X9WRe0kkTlPbfYpmOQz7pHSQs
-- Total entrances: ${insertStatements.length}

INSERT INTO pois (id, poi_type, metadata, location_json) VALUES
${insertStatements.join(',\n')};
`;

fs.writeFileSync('worker/src/database/pois_seed.sql', sqlContent);
console.log(`\nGenerated SQL file with ${insertStatements.length} POI entries`);
console.log('File: worker/src/database/pois_seed.sql');

