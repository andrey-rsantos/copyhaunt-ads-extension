import { expect, test } from './fixtures'

const PAGINA_FALSA = `
<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><title>Biblioteca de Anúncios (simulada)</title></head>
  <body style="margin:0">
    <div id="barra" style="display:flex;flex-direction:row;align-items:center">
      <div><div role="combobox">Brazil</div></div>
      <div><input type="search" placeholder="Search by keyword or advertiser"></div>
    </div>
    <div id="grade">Identificação da biblioteca: 2366492917183805</div>
  </body>
</html>`

const URL_ALVO =
  'https://www.facebook.com/ads/library/?active_status=active&q=emagrecer'

test('o preset do calendário reescreve a URL sem limite máximo', async ({
  context,
}) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const host = page.locator('#copyhaunt-enxertos')
  await expect(host).toBeAttached({ timeout: 10_000 })

  await host.locator('[data-chave="calendario"]').click()
  await expect(host.locator('[data-preset="14"]')).toHaveText('14+ Dias')
  await host.locator('[data-preset="14"]').click()
  await host.locator('[data-acao="aplicar"]').click()

  await expect
    .poll(() => decodeURIComponent(page.url()), { timeout: 10_000 })
    .toContain('start_date[max]=')
  expect(page.url()).not.toContain('start_date[min]=')
  expect(page.url()).toContain('q=emagrecer')
})

test('o preset selecionado permanece marcado após recarregar', async ({
  context,
}) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const host = page.locator('#copyhaunt-enxertos')
  await expect(host).toBeAttached({ timeout: 10_000 })
  await host.locator('[data-chave="calendario"]').click()
  await host.locator('[data-preset="14"]').click()
  await host.locator('[data-acao="aplicar"]').click()
  await expect.poll(() => page.url(), { timeout: 10_000 }).toContain('start_date')

  await page.reload()
  const novoHost = page.locator('#copyhaunt-enxertos')
  await expect(novoHost).toBeAttached({ timeout: 10_000 })
  await novoHost.locator('[data-chave="calendario"]').click()

  await expect(novoHost.locator('[data-preset="14"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
