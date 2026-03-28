const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Limit workers to reduce memory usage
config.maxWorkers = 1;

module.exports = config;
