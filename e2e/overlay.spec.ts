import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

const URL_BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all' +
  '&country=BR&q=receitas&search_type=keyword_unordered'

const CAPTURAS = resolve(import.meta.dirname, '..', 'capturas')

/**
 * Prova que a bandeja aparece nos cards da Biblioteca real, e guarda
 * capturas de tela para conferência humana do acabamento.
 */
test('a bandeja aparece nos cards reais', async ({ context }) => {
  mkdirSync(CAPTURAS, { recursive: true })

  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  const linhas: string[] = []
  page.on('console', (m) => {
    if (m.text().includes('[CopyHaunt]')) linhas.push(m.text())
  })

  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  for (let i = 0; i < 4; i += 1) {
    await page.mouse.wheel(0, 4000)
    await page.waitForTimeout(2500)
  }
  await page.mouse.wheel(0, -20000)
  await page.waitForTimeout(2000)

  const bandejas = await page
    .locator('[data-copyhaunt-id]')
    .count()

  console.log('  bandejas plantadas:', bandejas)
  for (const l of linhas.filter((l) => l.includes('pintados'))) {
    console.log('  ' + l)
  }

  await page.screenshot({
    path: resolve(CAPTURAS, 'grade-completa.png'),
    fullPage: false,
  })

  const primeiro = page.locator('[data-copyhaunt-id]').first()
  const card = primeiro.locator('xpath=..')
  await card.screenshot({ path: resolve(CAPTURAS, 'card-detalhe.png') })

  expect(bandejas).toBeGreaterThan(5)
})
