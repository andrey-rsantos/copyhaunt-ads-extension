import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

const URL_BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all' +
  '&country=BR&q=receitas&search_type=keyword_unordered'

const CAPTURAS = resolve(import.meta.dirname, '..', 'capturas')

/**
 * A prova do lote embutido: sem rolagem nenhuma, os cards do topo já têm
 * bandeja. Antes desta mudança eram zero, porque nenhum XHR trazia anúncio
 * na carga.
 */
test('os cards do topo já nascem com bandeja', async ({ context }) => {
  mkdirSync(CAPTURAS, { recursive: true })

  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })

  const linhas: string[] = []
  page.on('console', (m) => {
    if (m.text().includes('[CopyHaunt]')) linhas.push(m.text())
  })

  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  // Sem rolar: é justamente a primeira tela que estava descoberta.
  await page.waitForTimeout(8000)

  const bandejas = await page.locator('[data-copyhaunt-id]').count()

  console.log('  bandejas na primeira tela:', bandejas)
  for (const l of linhas.filter((l) => l.includes('lote do HTML'))) {
    console.log('  ' + l)
  }

  await page.screenshot({
    path: resolve(CAPTURAS, 'topo-com-bandeja.png'),
    fullPage: false,
  })

  expect(bandejas).toBeGreaterThanOrEqual(20)
})
