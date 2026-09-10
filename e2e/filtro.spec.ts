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

test('o atalho do calendário reescreve a URL da Biblioteca', async ({
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
  await host.locator('[data-preset="3"]').click()
  await host.locator('[data-acao="aplicar"]').click()

  // A Meta recarrega com o corte; a busca do usuário sobrevive.
  await expect
    .poll(() => decodeURIComponent(page.url()), { timeout: 10_000 })
    .toContain('start_date[max]=')
  expect(page.url()).toContain('q=emagrecer')
})

test('o máximo de dias corta pela data mínima', async ({ context }) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const host = page.locator('#copyhaunt-enxertos')
  await expect(host).toBeAttached({ timeout: 10_000 })

  await host.locator('[data-chave="calendario"]').click()
  await host.locator('[data-campo="diasMin"]').fill('')
  await host.locator('[data-campo="diasMax"]').fill('3')
  await host.locator('[data-acao="aplicar"]').click()

  await expect
    .poll(() => decodeURIComponent(page.url()), { timeout: 10_000 })
    .toContain('start_date[min]=')
})
