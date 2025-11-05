import { Image } from 'react-native';

interface MapIconSource {
  source: any;
  uri?: string;
  require: any;
}

interface MapIcons {
  point: MapIconSource;
  autoDoor: MapIconSource;
  manualDoor: MapIconSource;
  crosshair: MapIconSource;
  ramp: MapIconSource;
  restroom: MapIconSource;
}

export default function useMapIcons(): MapIcons {
  try {
    // Import all icon assets
    const pointImg = require("assets/map_icons/point.png");
    const autoDoorImg = require("assets/map_icons/auto_door.png");
    const manualDoorImg = require("assets/map_icons/manual_door.png");
    const crosshairImg = require("assets/map_icons/crosshair.png");
    const rampImg = require("assets/map_icons/ramp.png");
    const restroomImg = require("assets/map_icons/restroom.png");

    // Resolve all images to URIs
    const resolve = (img: any) => Image.resolveAssetSource(img)?.uri || img;

    // Prefetch all images (caching for Android/iOS)
    const preloadSources = [pointImg, autoDoorImg, manualDoorImg, crosshairImg, rampImg, restroomImg];
    preloadSources.forEach(img => {
      const uri = resolve(img);
      if (typeof uri === "string") {
        Image.prefetch(uri);
      }
    });

    // Build MapIcons object
    const icons: MapIcons = {
      point: { source: pointImg, uri: resolve(pointImg), require: pointImg },
      autoDoor: { source: autoDoorImg, uri: resolve(autoDoorImg), require: autoDoorImg },
      manualDoor: { source: manualDoorImg, uri: resolve(manualDoorImg), require: manualDoorImg },
      crosshair: { source: crosshairImg, uri: resolve(crosshairImg), require: crosshairImg },
      ramp: { source: rampImg, uri: resolve(rampImg), require: rampImg },
      restroom: { source: restroomImg, uri: resolve(restroomImg), require: restroomImg },
    };

    console.log("Map icons loaded successfully:", Object.keys(icons));
    return icons;
  } catch (error) {
    console.error("Error loading map icons:", error);

    // Fallback placeholder for all icons
    const placeholder = require("assets/map_icons/point.png");
    const resolved = Image.resolveAssetSource(placeholder);
    const fallback: MapIconSource = { source: placeholder, uri: resolved?.uri || '', require: placeholder };

    return {
      point: fallback,
      autoDoor: fallback,
      manualDoor: fallback,
      crosshair: fallback,
      ramp: fallback,
      restroom: fallback,
    };
  }
}

// Helper function to get icon based on POI type
export const getMapIcon = (poiType: string, metadata: any, mapIcons: MapIcons): MapIconSource => {
  switch (poiType) {
    case "accessible_entrance":
      return metadata.auto_opene ? mapIcons.autoDoor : mapIcons.manualDoor;
    case "ramp":
      return mapIcons.ramp;
    case "restroom":
      return mapIcons.restroom;
    default:
      return mapIcons.point;
  }
};
