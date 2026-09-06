import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

const URL_BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all' +
  '&country=BR&q=receitas&search_type=keyword_unordered'

const CAPTURAS = resolve(import.meta.dirname, '..', 'capturas')

/**
 * Prova no navegador real que o menu abre e que escolher um destino abre aba.
 *
 * A área de transferência não entra aqui: exigiria permissão de clipboard no
 * contexto do Playwright, e o teste unitário já cobre a escrita.
 */
test('o menu abre e o destino escolhido abre nova aba', async ({ context }) => {
  mkdirSync(CAPTURAS, { recursive: true })

  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Espera a bandeja existir, não um punhado de segundos. Quanto a Meta leva
  // para renderizar varia com a rede e com a carga da máquina, e chutar o
  // tempo é o que torna um teste verde na mão e vermelho na suíte.
  const host = page.locator('[data-copyhaunt-id]').first()
  await host.waitFor({ state: 'attached', timeout: 30_000 })

  await host.locator('.botao[data-acao="abrir"]').click()

  const itens = host.locator('.menu .item')
  await expect(itens).toHaveCount(6)

  await page.screenshot({
    path: resolve(CAPTURAS, 'menu-open.png'),
    fullPage: false,
  })

  const [nova] = await Promise.all([
    context.waitForEvent('page'),
    host.locator('.item[data-chave="perfil"]').click(),
  ])
  expect(nova.url()).toContain('facebook.com/')
  await nova.close()
})
