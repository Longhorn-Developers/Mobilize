// useMapIcons.ts

import { Image } from "react-native";

interface MapIconSource {
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

// IMPORTANT: use static require() strings (no variables), and ensure
// you have proper @2x / @3x assets alongside these files.
const pointImg = require("../assets/map_icons/point.png");
const autoDoorImg = require("../assets/map_icons/auto_door.png");
const manualDoorImg = require("../assets/map_icons/manual_door.png");
const crosshairImg = require("../assets/map_icons/crosshair.png");
const rampImg = require("../assets/map_icons/ramp.png");
const restroomImg = require("../assets/map_icons/restroom.png");

export default function useMapIcons(): MapIcons {
  // Log require IDs for debugging
  if (__DEV__) {
    console.log('[useMapIcons] require ids:', {
      point: pointImg,
      autoDoor: autoDoorImg,
      manualDoor: manualDoorImg,
      crosshair: crosshairImg,
      ramp: rampImg,
      restroom: restroomImg,
    });
  }

  return {
    point: { require: pointImg },
    autoDoor: { require: autoDoorImg },
    manualDoor: { require: manualDoorImg },
    crosshair: { require: crosshairImg },
    ramp: { require: rampImg },
    restroom: { require: restroomImg },
  };
}

export const getMapIcon = (poiType: string, metadata: any, mapIcons: MapIcons): MapIconSource => {
  switch (poiType) {
    case "accessible_entrance":
      console.log(metadata);
      return metadata?.auto_opene ? mapIcons.autoDoor : mapIcons.manualDoor;
    case "ramp":
      return mapIcons.ramp;
    case "restroom":
      return mapIcons.restroom;
    default:
      return mapIcons.point;
  }
};
