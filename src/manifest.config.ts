import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Morpho Enhancements',
  description:
    'Adds market-level Supply and direct-market position visibility to app.morpho.org',
  version: pkg.version,
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_title: 'Morpho Enhancements',
  },
  content_scripts: [
    {
      matches: ['https://app.morpho.org/*'],
      js: ['src/content/main.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
    // Second content_script (MAIN world, provider bridge) is appended
    // post-build by the mainWorldBridge() Vite plugin — it's copied from
    // public/injected/provider-bridge.js as a static asset, which crxjs
    // would otherwise wrap with a chrome.runtime.getURL loader that fails
    // in MAIN world (no chrome.* API there).
  ],
  // Intentionally empty — this extension holds no state, reads no tabs, and
  // uses no Chrome APIs. Host permissions below are the only elevated access.
  permissions: [],
  // `blue-api.morpho.org` is NOT listed here: content scripts can fetch()
  // HTTPS URLs for CORS-enabled endpoints without a host permission, and
  // Morpho's API sends permissive CORS headers. Keeping the permission list
  // minimal makes the Chrome Web Store review simpler.
  host_permissions: ['https://app.morpho.org/*'],
});
