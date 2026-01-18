// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// Exclude drizzle-kit from Metro bundling (it's a server-side tool)
config.resolver.blockList = [/node_modules\/drizzle-kit\/.*/];

module.exports = withNativeWind(config, { input: "./global.css" });
