// Import FastImage from @d11/react-native-fast-image
import FastImage from '@d11/react-native-fast-image';
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
    // Preload images with FastImage for caching
    const pointImg = require("assets/map_icons/point.png");
    const autoDoorImg = require("assets/map_icons/auto_door.png");
    const manualDoorImg = require("assets/map_icons/manual_door.png");
    const crosshairImg = require("assets/map_icons/crosshair.png");
    const rampImg = require("assets/map_icons/ramp.png");
    const restroomImg = require("assets/map_icons/restroom.png");

    // Resolve asset sources to URIs for FastImage compatibility
    const resolveToUri = (img: any) => {
      const resolved = Image.resolveAssetSource(img);
      return resolved?.uri || img;
    };

    // Pre-load with FastImage cache using URIs
    const preloadSources = [
      pointImg,
      autoDoorImg,
      manualDoorImg,
      crosshairImg,
      rampImg,
      restroomImg,
    ].map(img => {
      const resolved = Image.resolveAssetSource(img);
      return resolved?.uri ? { uri: resolved.uri } : img;
    });
    
    FastImage.preload(preloadSources);

    // Resolve all images to get proper URIs for Android
    // Add null checks to prevent crashes
    const pointResolved = Image.resolveAssetSource(pointImg);
    const autoDoorResolved = Image.resolveAssetSource(autoDoorImg);
    const manualDoorResolved = Image.resolveAssetSource(manualDoorImg);
    const crosshairResolved = Image.resolveAssetSource(crosshairImg);
    const rampResolved = Image.resolveAssetSource(rampImg);
    const restroomResolved = Image.resolveAssetSource(restroomImg);

    // Verify all resolved sources exist
    if (!pointResolved || !autoDoorResolved || !manualDoorResolved || 
        !crosshairResolved || !rampResolved || !restroomResolved) {
      throw new Error('Failed to resolve one or more asset sources');
    }

    const icons: MapIcons = {
      point: { 
        source: pointResolved,
        uri: pointResolved.uri || '',
        require: pointImg
      },
      autoDoor: { 
        source: autoDoorResolved,
        uri: autoDoorResolved.uri || '',
        require: autoDoorImg
      },
      manualDoor: { 
        source: manualDoorResolved,
        uri: manualDoorResolved.uri || '',
        require: manualDoorImg
      },
      crosshair: { 
        source: crosshairResolved,
        uri: crosshairResolved.uri || '',
        require: crosshairImg
      },
      ramp: { 
        source: rampResolved,
        uri: rampResolved.uri || '',
        require: rampImg
      },
      restroom: { 
        source: restroomResolved,
        uri: restroomResolved.uri || '',
        require: restroomImg
      },
    };
    
    console.log('Map icons loaded successfully with FastImage preload');
    console.log('Sample icon URI:', icons.point.uri);
    return icons;
  } catch (error) {
    console.error('Error loading icons:', error);
    
    // Return fallback with placeholder sources
    try {
      const placeholder = require("assets/map_icons/point.png");
      const resolved = Image.resolveAssetSource(placeholder);
      
      const fallbackIcon = {
        source: resolved || placeholder,
        uri: resolved?.uri || '',
        require: placeholder
      };
      
      return {
        point: fallbackIcon,
        autoDoor: fallbackIcon,
        manualDoor: fallbackIcon,
        crosshair: fallbackIcon,
        ramp: fallbackIcon,
        restroom: fallbackIcon,
      };
    } catch (fallbackError) {
      console.error('Critical: Could not load even fallback icon:', fallbackError);
      // Return empty objects that won't crash but won't show icons
      const emptyIcon = { source: null, uri: '', require: null };
      return {
        point: emptyIcon,
        autoDoor: emptyIcon,
        manualDoor: emptyIcon,
        crosshair: emptyIcon,
        ramp: emptyIcon,
        restroom: emptyIcon,
      };
    }
  }
}

// Export FastImage for use in components
export { FastImage };

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
