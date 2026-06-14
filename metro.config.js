// Learn more https://docs.expo.io/guides/customizing-metro
const path = require("path");

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// Exclude Gradle build artifacts from Metro's file watcher.
// On Windows, Metro's FallbackWatcher crashes if it tries to watch a directory
// that was created by Gradle and then deleted (e.g. compileKotlin output dirs).
const { blockList } = config.resolver ?? {};
const blockListRE = Array.isArray(blockList)
  ? blockList
  : blockList
    ? [blockList]
    : [];
config.resolver.blockList = [
  ...blockListRE,
  new RegExp(
    path
      .join(__dirname, "node_modules", "expo-modules-core", "expo-module-gradle-plugin", "bin")
      .replace(/[/\\]/g, "[/\\\\]") + ".*"
  ),
  /node_modules\/.*\/\.cxx\/.*/,
  /node_modules\/.*\/build\/intermediates\/.*/,
  // Block large GeoJSON files that are not imported by any JS module.
  // These are only unused static assets; blocking prevents Metro from scanning/hashing
  // them on every bundler startup (UTA_Usability_Layer is ~97 MB).
  new RegExp(
    path.join(__dirname, "assets", "geojson", "UTA_Usability_Layer.geojson").replace(/[/\\]/g, "[/\\\\]")
  ),
  new RegExp(
    path.join(__dirname, "assets", "geojson", "UTA_Curb_Ramps.geojson").replace(/[/\\]/g, "[/\\\\]")
  ),
  new RegExp(
    path.join(__dirname, "assets", "geojson", "UTA_Crosswalks.geojson").replace(/[/\\]/g, "[/\\\\]")
  ),
];

module.exports = withNativeWind(config, { input: "./global.css" });
