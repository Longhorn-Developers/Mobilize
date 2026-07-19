/* Rendering Layer for User Navigation Overlay */

import { useState, useEffect } from "react";
import { ShapeSource, FillLayer, LineLayer, SymbolLayer } from "@rnmapbox/maps";

import * as GeoLocation from 'expo-location';
import { DeviceMotion } from 'expo-sensors';


export default function UserNavigation() {

    const [geoLocation, setGeoLocation] = useState<GeoLocation.LocationObject | null>(null);

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

        }
        getDeviceMotion();
    }, []);

    // console.log("LOCATION:" + JSON.stringify(geoLocation));


    return (

        <ShapeSource
            id="user-navigation"
            shape={{
                    'type': 'LineString',
                    'coordinates': [
                        [-97.735, 30.285],
                        [-97.736, 30.285],
                    ]
            }}>

            <LineLayer
                id="user-direction-line"
                style={{
                    lineColor: "rgba(9, 88, 206, 0.9)",
                    lineWidth: 20,
                }}
            />
        </ShapeSource>
    );
}