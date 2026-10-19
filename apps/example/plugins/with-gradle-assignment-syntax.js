const {
  withAppBuildGradle,
  withDangerousMod,
  withProjectBuildGradle,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function buildPatches(config) {
  const namespace = config.android?.package;
  const versionName = config.version;
  const versionCode = config.android?.versionCode ?? 1;
  for (const [key, value] of Object.entries({ namespace, versionName })) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`with-gradle-assignment-syntax: missing ${key} in the Expo config`);
    }
  }

  return new Map([
    [
      "app/build.gradle",
      [
        ["ndkVersion rootProject.ext.ndkVersion", "ndkVersion = rootProject.ext.ndkVersion"],
        [
          "buildToolsVersion rootProject.ext.buildToolsVersion",
          "buildToolsVersion = rootProject.ext.buildToolsVersion",
        ],
        ["compileSdk rootProject.ext.compileSdkVersion", "compileSdk = rootProject.ext.compileSdkVersion"],
        [`namespace '${namespace}'`, `namespace = '${namespace}'`],
        ["minSdkVersion rootProject.ext.minSdkVersion", "minSdkVersion = rootProject.ext.minSdkVersion"],
        [
          "targetSdkVersion rootProject.ext.targetSdkVersion",
          "targetSdkVersion = rootProject.ext.targetSdkVersion",
        ],
        [`versionCode ${versionCode}`, `versionCode = ${versionCode}`],
        [`versionName "${versionName}"`, `versionName = "${versionName}"`],
        ["storeFile file('debug.keystore')", "storeFile = file('debug.keystore')"],
        ["storePassword 'android'", "storePassword = 'android'"],
        ["keyAlias 'androiddebugkey'", "keyAlias = 'androiddebugkey'"],
        ["keyPassword 'android'", "keyPassword = 'android'"],
        ["signingConfig signingConfigs.debug", "signingConfig = signingConfigs.debug"],
        ["shrinkResources enableShrinkResources.toBoolean()", "shrinkResources = enableShrinkResources.toBoolean()"],
        ["minifyEnabled enableMinifyInReleaseBuilds", "minifyEnabled = enableMinifyInReleaseBuilds"],
        ["crunchPngs enablePngCrunchInRelease.toBoolean()", "crunchPngs = enablePngCrunchInRelease.toBoolean()"],
        ["useLegacyPackaging enableLegacyPackaging.toBoolean()", "useLegacyPackaging = enableLegacyPackaging.toBoolean()"],
        [
          "ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~'",
          "ignoreAssetsPattern = '!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~'",
        ],
      ],
    ],
    [
      "build.gradle",
      [["maven { url 'https://www.jitpack.io' }", "maven { url = 'https://www.jitpack.io' }"]],
    ],
  ]);
}

function patchSource(file, source, replacements) {
  for (const [before, after] of replacements) {
    if (source.includes(before)) {
      source = source.replaceAll(before, after);
    } else if (!source.includes(after)) {
      throw new Error(
        `with-gradle-assignment-syntax: pattern not found in ${file}: ${before}`,
      );
    }
  }
  return source;
}

module.exports = function withGradleAssignmentSyntax(config) {
  const patches = buildPatches(config);

  config = withAppBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = patchSource(
      "app/build.gradle",
      modConfig.modResults.contents,
      patches.get("app/build.gradle"),
    );
    return modConfig;
  });

  config = withProjectBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = patchSource(
      "build.gradle",
      modConfig.modResults.contents,
      patches.get("build.gradle"),
    );
    return modConfig;
  });

  config = withDangerousMod(config, [
    "android",
    async (modConfig) => {
      for (const manifest of [
        "app/src/debug/AndroidManifest.xml",
        "app/src/debugOptimized/AndroidManifest.xml",
      ]) {
        const manifestPath = path.join(
          modConfig.modRequest.platformProjectRoot,
          manifest,
        );
        if (!fs.existsSync(manifestPath)) {
          throw new Error(
            `with-gradle-assignment-syntax: manifest not found: ${manifest}`,
          );
        }
        const source = fs.readFileSync(manifestPath, "utf8");
        fs.writeFileSync(
          manifestPath,
          source.replace(' tools:replace="android:usesCleartextTraffic"', ""),
        );
      }
      return modConfig;
    },
  ]);

  return config;
};
