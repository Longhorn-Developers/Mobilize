/* eslint-env node */
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const pluginQuery = require("@tanstack/eslint-plugin-query");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "supabase/functions/**/*.ts"],
  },
  {
    rules: {
      "react/display-name": "off",
    },
  },
  pluginQuery.configs["flat/recommended"],
]);
