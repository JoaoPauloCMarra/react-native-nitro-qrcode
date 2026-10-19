const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  ...config.resolver.blockList,
  /node_modules\/.*\/android\/\.cxx\/.*/,
  /apps\/example\/android\/app\/\.cxx\/.*/,
  /apps\/example\/android\/\.gradle\/.*/,
  /apps\/example\/android\/build\/.*/,
];

module.exports = config;
