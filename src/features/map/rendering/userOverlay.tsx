/* Rendering Layer for Recenter Button */

import { ShapeSource, FillLayer, LineLayer, SymbolLayer , Camera } from "@rnmapbox/maps";
import * as GeoLocation from 'expo-location';
import { DeviceMotionMeasurement } from 'expo-sensors';
import { useState, useEffect } from "react";

import { Button } from "~/src/features/components/Button";




type UserOverlayProps = {
  cameraRef: React.RefObject<Camera | null>;
  geoLocation: GeoLocation.LocationObject | null;
  deviceMotion: DeviceMotionMeasurement | null;
};

export default function UserOverlay({ cameraRef, geoLocation, deviceMotion }: UserOverlayProps) {

  const recenterMap = () => {

    if (!geoLocation) {
      alert('Current location not available.');
      return;
    }

    cameraRef.current?.setCamera({
      centerCoordinate: [
        geoLocation.coords.longitude,
        geoLocation.coords.latitude
      ],
      heading: deviceMotion?.rotation?.alpha ? deviceMotion.rotation.alpha * -180 / Math.PI : 0,
      zoomLevel: 17,
      animationDuration: 800,
    });
    // console.log(geoLocation);
    // console.log(deviceMotion);
  }

  if (!geoLocation) {
    return null;
  }
  return (
    <Button
      className="absolute bottom-4 right-4"
      title="Center"
      variant="gray"
      onPress={recenterMap}
      style={{ position: "absolute", bottom: 70, right: 16 }}
    />
  );
}