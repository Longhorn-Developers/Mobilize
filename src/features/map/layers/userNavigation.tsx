/* Rendering Layer for User Navigation Overlay */

import { useState, useEffect } from "react";
import { ShapeSource, FillLayer, LineLayer, SymbolLayer } from "@rnmapbox/maps";
import { Button } from "~/src/features/components/Button";

import * as GeoLocation from 'expo-location';
import { DeviceMotion } from 'expo-sensors';



type UserNavigationProps = {
  cameraState: any;
  geoLocation: GeoLocation.LocationObject | null;
  deviceMotion: DeviceMotion.DeviceMotionMeasurement | null;
};

export default function UserNavigation({ cameraState, geoLocation, deviceMotion }: UserNavigationProps) {

  const getUserBearing = () => {
    if (!deviceMotion.rotation) return 0;
    return deviceMotion.rotation.alpha * -180 / Math.PI - cameraState.heading;
  }

  if (!geoLocation) {
    return null;
  }
  return (
    <>
      {deviceMotion && (
        <ShapeSource
          id="user-direction"
          shape={{
            'type': 'Point',
            'coordinates': [
              geoLocation.coords.longitude,
              geoLocation.coords.latitude
            ]
          }}>
          <SymbolLayer
            id="user-director"

            style={{
              iconImage: "userDirector",
              iconSize: 0.85,
              iconAllowOverlap: true,
              iconAnchor: "bottom",
              iconRotate: getUserBearing(),
            }}
          />
        </ShapeSource>
      )}

      <ShapeSource
        id="user-location"
        shape={{
          'type': 'Point',
          'coordinates': [
            geoLocation.coords.longitude,
            geoLocation.coords.latitude
          ]
        }}>
        <SymbolLayer
          id="user-icon"

          style={{
            iconImage: "userIcon",
            iconSize: 0.5,
            iconAllowOverlap: true,
            iconAnchor: "center",
          }}
        />
      </ShapeSource>
    </>

  );
}