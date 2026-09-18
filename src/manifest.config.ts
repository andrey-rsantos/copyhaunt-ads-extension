import { defineManifest } from '@crxjs/vite-plugin'
import pkg from '../package.json'

const AD_LIBRARY = '*://*.facebook.com/ads/library/*'

/**
 * O host da config remota. Escopo estreito de propósito: só este repositório,
 * não o `raw.githubusercontent.com` inteiro.
 */
const CONFIG_REMOTA =
  'https://raw.githubusercontent.com/andrey-rsantos/copyhaunt-ads-extension/*'

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
  action: { default_title: 'Abrir resultados' },
  host_permissions: [AD_LIBRARY, CONFIG_REMOTA],
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
}

export default defineManifest(manifest)
