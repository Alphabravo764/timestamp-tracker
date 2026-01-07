const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add CSS support for NativeWind
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("nativewind/metro/transformer"),
};

module.exports = config;
