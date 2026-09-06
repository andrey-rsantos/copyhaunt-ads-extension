import { defineConfig } from '@playwright/test'

/**
 * Configuração separada para o gravador de fixtures.
 *
 * O gravador vive fora de `e2e/` de propósito. Enquanto estava lá, um
 * `playwright test` comum o executava junto e **sobrescrevia as fixtures
 * commitadas** com dados novos da Meta — o que tornava não-determinísticos
 * todos os testes unitários que dependem delas.
 *
 * Agora ele só roda por `npm run gravar:fixtures`, deliberadamente.
 */
export default defineConfig({
  testDir: './tools',
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  // Navegar e rolar a Biblioteca real leva bem mais que o padrão de 30s.
  timeout: 180_000,
})
