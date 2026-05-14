const { getDefaultConfig } = require("expo/metro-config");
const exclusionList =
  require("metro-config/private/defaults/exclusionList").default;
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo without dropping Expo's default workspace entries.
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), monorepoRoot])
);

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.blockList = exclusionList([
  /node_modules\/.*\/android\/\.cxx\/.*/,
  /apps\/example\/android\/app\/\.cxx\/.*/,
  /apps\/example\/android\/\.gradle\/.*/,
  /apps\/example\/android\/build\/.*/,
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    if (moduleName === "react-native-nitro-modules") {
      return { type: "empty" };
    }

    if (moduleName === "react-native-nitro-qrcode") {
      return context.resolveRequest(
        context,
        path.resolve(
          monorepoRoot,
          "packages/react-native-nitro-qrcode/src/index.web.ts"
        ),
        platform
      );
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
