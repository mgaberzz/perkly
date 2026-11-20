// Mark hardware features as optional in the Android manifest so Google Play doesn't hide the app
// from devices without them (Play Console warning "Required hardware feature declarations").
// - screen.portrait: implied by orientation "portrait"; landscape-only devices (some tablets, Chromebooks) would be excluded
// - wifi: implied by a library's ACCESS_WIFI_STATE permission; the app works on mobile data
const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL = ['android.hardware.screen.portrait', 'android.hardware.wifi'];

module.exports = function withOptionalHardware(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] ?? [];
    for (const name of OPTIONAL) {
      const existing = manifest['uses-feature'].find((f) => f.$?.['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
