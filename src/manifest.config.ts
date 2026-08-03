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
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://app.morpho.org/*'],
      js: ['src/content/main.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  // chrome.storage.local backs the favorites store — chosen over
  // window.localStorage so the toolbar popup (extension origin) can read
  // the same data that the content script (app.morpho.org origin) writes.
  permissions: ['storage', 'scripting'],
  // `api.morpho.org` is NOT listed here: content scripts can fetch()
  // HTTPS URLs for CORS-enabled endpoints without a host permission, and
  // Morpho's API sends permissive CORS headers. Keeping the permission list
  // minimal makes the Chrome Web Store review simpler.
  host_permissions: ['https://app.morpho.org/*'],
});
