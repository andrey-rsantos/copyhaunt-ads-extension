import { expect, test } from './fixtures'

const PAGINA_FALSA = `
<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><title>Biblioteca de Anúncios (simulada)</title></head>
  <body style="margin:0"><div id="grade">Identificação da biblioteca: 2366492917183805</div></body>
</html>`

const URL_ALVO =
  'https://www.facebook.com/ads/library/?active_status=active&q=emagrecer'

test('o preset do painel reescreve a URL da Biblioteca', async ({ context }) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const painel = page.frameLocator('#copyhaunt-panel')
  await painel.getByRole('button', { name: 'Provadas' }).click()
  await painel.getByRole('button', { name: '1 sem' }).click()

  // A Meta recarrega com o corte; a busca do usuário sobrevive.
  await expect
    .poll(() => decodeURIComponent(page.url()), { timeout: 10_000 })
    .toContain('start_date[max]=')
  expect(page.url()).toContain('q=emagrecer')
})

test('o modo subindo corta pelo mínimo', async ({ context }) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const painel = page.frameLocator('#copyhaunt-panel')
  await painel.getByRole('button', { name: 'Subindo' }).click()
  await painel.getByRole('button', { name: '3 dias' }).click()

  await expect
    .poll(() => decodeURIComponent(page.url()), { timeout: 10_000 })
    .toContain('start_date[min]=')
})
