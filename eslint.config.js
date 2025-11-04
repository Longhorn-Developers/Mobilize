/* eslint-env node */
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*", 
      "worker/**/*.ts",
      "worker/.wrangler/**/*",
      "node_modules/**/*",
      "android/**/*",
      "**/*.generated.*"
    ],
  },
  {
    rules: {
      "react/display-name": "off",
    },
  },
]);
