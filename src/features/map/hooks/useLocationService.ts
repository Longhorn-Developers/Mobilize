// Location Service controller


import * as GeoLocation from 'expo-location';
import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
import { useEffect, useState, useMemo } from "react";


export function useLocationService() {
  const [geoLocation, setGeoLocation] = useState<GeoLocation.LocationObject | null>(null);
  const [deviceMotion, setDeviceMotion] = useState<DeviceMotionMeasurement | null>(null);

  // request location permissions
  useEffect(() => {
    async function getCurrentLocation() {
      let { status } = await GeoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission for location access needed.');
        return;
      }

      let location = await GeoLocation.getCurrentPositionAsync({});
      setGeoLocation(location);
    }
    getCurrentLocation();
  }, []);

  // request device motion permissions
  useEffect(() => {
    async function getDeviceMotion() {
      const isAvailable = await DeviceMotion.isAvailableAsync();
      if (!isAvailable) {
        alert('Device motion sensors not available.');
        return;
      }

      let { status } = await DeviceMotion.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission for device motion sensors needed.');
        return;
      }
      DeviceMotion.addListener(setDeviceMotion);
    }
    getDeviceMotion();
  }, []);

  return {
    state: {
      geoLocation,
      deviceMotion,
    },
  };
}