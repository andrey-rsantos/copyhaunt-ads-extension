import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // A extensão é carregada num contexto persistente compartilhado por teste;
  // rodar em paralelo criaria perfis concorrentes sem ganho real.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
