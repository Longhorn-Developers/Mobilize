/* Rendering Layer for Recenter Button */

import { Camera } from "@rnmapbox/maps";
import * as GeoLocation from "expo-location";
import { DeviceMotionMeasurement } from "expo-sensors";
import { useEffect } from "react";
import { TouchableOpacity } from "react-native";

import LocateIcon from "./LocateIcon";

type UserOverlayProps = {
  cameraRef: React.RefObject<Camera | null>;
  geoLocation: GeoLocation.LocationObject | null;
  deviceMotion: DeviceMotionMeasurement | null;
  right: number;
};

export default function UserOverlay({ cameraRef, geoLocation, deviceMotion, right }: UserOverlayProps) {
  const recenterMap = () => {
    if (!geoLocation) {
      alert("Current location not available.");
      return;
    }

    cameraRef.current?.setCamera({
      centerCoordinate: [
        geoLocation.coords.longitude,
        geoLocation.coords.latitude,
      ],
      heading: deviceMotion?.rotation?.alpha
        ? (deviceMotion.rotation.alpha * -180) / Math.PI
        : 0,
      zoomLevel: 17,
      animationDuration: 800,
    });
  };

  useEffect(() => {
    recenterMap();
  }, []);

  if (!geoLocation) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={recenterMap}
      activeOpacity={0.8}
      accessibilityLabel="Recenter map on my location"
      style={{
        position: "absolute",
        bottom: 24,
        right,
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#BF5700",
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      }}
    >
      <LocateIcon size={36} />
    </TouchableOpacity>
  );
}