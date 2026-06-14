export default {
  expo: {
    name: "MobilizeUT",
    slug: "mobilizeut",
    version: "1.0.0",
    scheme: "mobilizeut",
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-web-browser",
      "expo-font",
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          RNMAPBOX_MAPS_DOWNLOAD_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
        },
      ],
      [
      "expo-camera",
        {
          cameraPermission: "Allow MobilizeUT to access your camera",
          recordAudioAndroid: false
        }
      ]
    ],
    experiments: {
      typedRoutes: true,
      tsconfigPaths: true,
    },
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.astrol.mobilizeut",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.astrol.mobilizeut",
    },
  },
};
