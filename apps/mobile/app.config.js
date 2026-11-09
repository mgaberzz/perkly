// Extends app.json. The Firebase config for Android push notifications is not committed:
// on Expo's build servers it comes from the secret file variable GOOGLE_SERVICES_JSON,
// locally from ./google-services.json if you have one.
const fs = require('fs');

module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ?? (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);
  return { ...config, android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) } };
};
