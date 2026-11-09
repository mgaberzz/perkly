// Metro with Sentry's settings, so error reports from release builds point at the right lines of code.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
