import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Padrão continua node; arquivos que precisam de DOM declaram
    // `@vitest-environment jsdom` no topo.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
