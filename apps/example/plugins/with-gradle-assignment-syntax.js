const {
  withAppBuildGradle,
  withDangerousMod,
  withProjectBuildGradle,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PATCHES = new Map([
  [
    "app/build.gradle",
    [
      ["ndkVersion rootProject.ext.ndkVersion", "ndkVersion = rootProject.ext.ndkVersion"],
      [
        "buildToolsVersion rootProject.ext.buildToolsVersion",
        "buildToolsVersion = rootProject.ext.buildToolsVersion",
      ],
      ["compileSdk rootProject.ext.compileSdkVersion", "compileSdk = rootProject.ext.compileSdkVersion"],
      ["namespace 'com.qrcode.example'", "namespace = 'com.qrcode.example'"],
      ["minSdkVersion rootProject.ext.minSdkVersion", "minSdkVersion = rootProject.ext.minSdkVersion"],
      [
        "targetSdkVersion rootProject.ext.targetSdkVersion",
        "targetSdkVersion = rootProject.ext.targetSdkVersion",
      ],
      ["versionCode 1", "versionCode = 1"],
      ['versionName "1.0.0"', 'versionName = "1.0.0"'],
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

function patchSource(source, replacements) {
  for (const [before, after] of replacements) {
    source = source.replaceAll(before, after);
  }
  return source;
}

module.exports = function withGradleAssignmentSyntax(config) {
  config = withAppBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = patchSource(
      modConfig.modResults.contents,
      PATCHES.get("app/build.gradle"),
    );
    return modConfig;
  });

  config = withProjectBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = patchSource(
      modConfig.modResults.contents,
      PATCHES.get("build.gradle"),
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
