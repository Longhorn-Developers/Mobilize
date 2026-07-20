/* Rendering Layer for Recenter Button */

import { useState, useEffect } from "react";
import { ShapeSource, FillLayer, LineLayer, SymbolLayer } from "@rnmapbox/maps";
import { Button } from "~/src/features/components/Button";

import * as GeoLocation from 'expo-location';
import { DeviceMotion } from 'expo-sensors';

import { Camera } from "@rnmapbox/maps";


type UserOverlayProps = {
  cameraRef: React.RefObject<Camera | null>;
  geoLocation: GeoLocation.LocationObject | null;
  deviceMotion: DeviceMotion.DeviceMotionMeasurement | null;
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