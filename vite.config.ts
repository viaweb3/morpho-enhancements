import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import manifest from './src/manifest.config';

// Patches dist/manifest.json after crxjs has written it, adding a second
// content_script that runs in world:'MAIN'. We can't declare this in the
// source manifest because crxjs tries to resolve it as a bundled entry,
// and its default loader wrapper uses chrome.runtime.getURL which is not
// available in MAIN world.
function mainWorldBridge(): Plugin {
  return {
    name: 'morpho-ext:main-world-bridge',
    apply: 'build',
    closeBundle: {
      order: 'post',
      handler() {
        const distManifestPath = resolve(__dirname, 'dist', 'manifest.json');
        const manifestJson = JSON.parse(readFileSync(distManifestPath, 'utf8'));
        const scripts = manifestJson.content_scripts ?? (manifestJson.content_scripts = []);
        const exists = scripts.some((s: { js?: string[] }) =>
          s.js?.includes('injected/provider-bridge.js'),
        );
        if (!exists) {
          scripts.push({
            matches: ['https://app.morpho.org/*'],
            js: ['injected/provider-bridge.js'],
            run_at: 'document_start',
            all_frames: false,
            world: 'MAIN',
          });
          writeFileSync(distManifestPath, JSON.stringify(manifestJson, null, 2));
        }
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwind(), crx({ manifest }), mainWorldBridge()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
