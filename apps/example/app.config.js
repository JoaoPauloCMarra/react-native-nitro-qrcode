module.exports = {
  expo: {
    name: "Nitro QRCode",
    slug: "nitro-qrcode-example",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    backgroundColor: "#0D0F10",
    scheme: "qrcode",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.qrcode.example",
      infoPlist: {
        CFBundleDevelopmentRegion: "en",
        UIApplicationSceneManifest: {
          UIApplicationSupportsMultipleScenes: false,
          UISceneConfigurations: {
            UIWindowSceneSessionRoleApplication: [
              {
                UISceneConfigurationName: "Default Configuration",
                UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
              },
            ],
          },
        },
      },
    },
    android: {
      package: "com.qrcode.example",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0D0F10",
      },
    },
    web: {
      favicon: "./assets/icon.png",
    },
    plugins: [
      "expo-router",
      "expo-build-properties",
      "./plugins/with-gradle-assignment-syntax",
      "./plugins/with-ios-scene-lifecycle",
      "react-native-nitro-qrcode",
      "expo-status-bar",
    ],
    experiments: {
      reactCompiler: true,
      typedRoutes: true,
    },
  },
};
