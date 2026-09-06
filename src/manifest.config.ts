import { defineManifest } from '@crxjs/vite-plugin'
import pkg from '../package.json'

const AD_LIBRARY = '*://*.facebook.com/ads/library/*'

/**
 * Objeto puro do manifest, exportado à parte para poder ser testado sem
 * depender do build. É a única fonte de verdade das permissões.
 */
export const manifest = {
  manifest_version: 3 as const,
  name: 'CopyHaunt Ads',
  version: pkg.version,
  description: pkg.description,
  icons: { '128': 'icon-128.png' },
  permissions: ['storage'],
  host_permissions: [AD_LIBRARY],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module' as const,
  },
  content_scripts: [
    {
      matches: [AD_LIBRARY],
      js: ['src/interceptor/index.ts'],
      world: 'MAIN' as const,
      run_at: 'document_start' as const,
    },
    {
      matches: [AD_LIBRARY],
      js: ['src/content/index.ts'],
      run_at: 'document_start' as const,
    },
  ],
  web_accessible_resources: [
    {
      resources: ['src/panel/index.html'],
      matches: ['*://*.facebook.com/*'],
    },
  ],
}

export default defineManifest(manifest)
