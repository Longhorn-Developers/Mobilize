import { DOMParser } from "@xmldom/xmldom";
import { kml } from "@tmcw/togeojson";
import { SupabaseClient } from "@supabase/supabase-js";

export async function sync_accessible_entrances(
  supabase: SupabaseClient,
  url: string,
) {
  // fetch the KML data from the URL
  const kmlResponse = await fetch(url);
  if (!kmlResponse.ok) {
    throw new Error(`Failed to fetch KML data: ${kmlResponse.statusText}`);
  }
  const kmlText = await kmlResponse.text();

  // parse the KML to GeoJSON
  const dom = new DOMParser().parseFromString(kmlText, "text/xml");
  const geoJSON = kml(dom);

  // prepare the data for insertion
  const poisData = geoJSON.features.map((feature) => {
    const { properties, geometry } = feature;
    if (!properties || !geometry || geometry.type !== "Point") {
      return null;
    }

    // Extract additional data from the description
    const description = properties.description;
    const blgNameMatch = description.match(/BldName\s*(.*)/);
    const autoOpeneMatch = description.match(/Auto_Opene\s+(\d)/);
    const floorMatch = description.match(/Floor\s+(\w+)/);

    const metadata = {
      name: properties.name,
      bld_name: blgNameMatch ? blgNameMatch[1] : null,
      floor: floorMatch
        ? isNaN(parseInt(floorMatch[1], 10))
          ? null
          : parseInt(floorMatch[1], 10)
        : null,
      auto_opene: autoOpeneMatch ? autoOpeneMatch[1] === "1" : false,
    };

    return {
      poi_type: "accessible_entrance",
      metadata,
      location: `POINT(${geometry.coordinates[0]} ${geometry.coordinates[1]})`,
    };
  });

  // insert the data into the 'pois' table
  if (poisData.length > 0) {
    await supabase.from("pois").upsert(poisData).throwOnError();
    console.log(`Upserted ${poisData.length} accessibility entrance POIs...`);
  } else {
    console.log("No new POI data to upsert.");
  }
}
