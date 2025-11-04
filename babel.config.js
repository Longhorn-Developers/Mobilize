// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',   // preset #1
      'nativewind/babel',    // preset #2 (NativeWind v4 is a PRESET)
    ],
    plugins: [
      'expo-router/babel',
      'react-native-worklets/plugin', // Reanimated v4 — keep LAST
    ]
  };
};
