#!/usr/bin/env node
// Publish an over-the-air update to phones that already have the app.
//
//   npm run update:production -- "Fix quest progress"
//   npm run update:preview    -- "Try new home banner"
//
// Uses the same EXPO_PUBLIC_* settings as the matching build profile in eas.json, so an
// update can never ship with different Supabase/Sentry settings than the store build.
// Only JavaScript, text and images change this way. Anything native (new Expo package,
// permissions, app icon, app.json plugins) still needs a new store build: the runtime
// version (fingerprint) changes, and older builds simply won't receive the update.
const { execSync, spawnSync } = require('child_process');
const path = require('path');

const profile = process.argv[2];
if (!['production', 'preview'].includes(profile)) {
  console.error('Usage: node scripts/ota-update.js <production|preview> "message"');
  process.exit(1);
}
const eas = require(path.join(__dirname, '..', 'eas.json'));
const build = eas.build[profile];
const env = { ...process.env, ...(build.env ?? {}) };

let message = process.argv.slice(3).join(' ').trim();
if (!message) {
  try { message = execSync('git log -1 --pretty=%s', { encoding: 'utf8' }).trim(); } catch { message = 'Update'; }
}

console.log(`Publishing to channel "${build.channel}": ${message}`);
const res = spawnSync('npx', ['eas-cli', 'update', '--channel', build.channel, '--message', message, '--environment', build.environment ?? profile],
  { stdio: 'inherit', env, cwd: path.join(__dirname, '..'), shell: process.platform === 'win32' });
process.exit(res.status ?? 1);
