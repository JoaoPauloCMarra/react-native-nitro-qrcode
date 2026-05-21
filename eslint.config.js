const expoConfig = require("eslint-config-expo/flat");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      "**/node_modules/**",
      "**/lib/**",
      "**/coverage/**",
      "**/build/**",
      "**/nitrogen/generated/**",
      "**/.turbo/**",
      "**/android/build/**",
      "**/android/.cxx/**",
      "**/ios/build/**",
    ],
  },
  {
    files: ["packages/react-native-nitro-qrcode/src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off",
      "react-native/no-unused-styles": "off",
    },
  },
  {
    files: ["packages/react-native-nitro-qrcode/src/__tests__/**/*.{ts,tsx}"],
    rules: {
      "import/first": "off",
      "import/order": "off",
      "import-x/first": "off",
      "import-x/order": "off",
    },
  },
  {
    files: ["scripts/**/*.js", "packages/*/scripts/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        Buffer: "readonly",
        __dirname: "readonly",
        console: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "no-console": "off",
    },
  },
]);
