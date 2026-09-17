import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import manifest from './src/manifest.config'

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        panel: 'src/panel/index.html',
        resultados: 'src/resultados/index.html',
        boasVindas: 'src/boas-vindas/index.html',
      },
    },
  },
})
