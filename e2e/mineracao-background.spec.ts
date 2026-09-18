import { expect, test } from './fixtures'

const URL_ALVO =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all' +
  '&country=BR&q=background&search_type=keyword_unordered' +
  '&sort_data[mode]=total_impressions&sort_data[direction]=desc'

const PAGINA_FALSA = `
<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><title>Biblioteca simulada</title></head>
  <body style="margin:0;min-height:1000px">
    <div id="barra" style="display:flex;flex-direction:row;align-items:center">
      <div><div role="combobox">Brazil</div></div>
      <div><input type="search" placeholder="Search by keyword or advertiser"></div>
    </div>
    <div id="grade" style="height:1000px">Biblioteca simulada</div>
    <script>
      window.addEventListener('scroll', () => {
        document.body.style.minHeight = (document.body.scrollHeight + 1000) + 'px'
      })
    </script>
  </body>
</html>`

test('mineração continua oculta e preserva checkpoint ao sair da página', async ({
  context,
}) => {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const host = page.locator('#copyhaunt-enxertos')
  await expect(host).toBeAttached({ timeout: 10_000 })
  await host.locator('[data-chave="minerar"]').click()
  await host.locator('[data-acao="iniciar"]').click()

  const progresso = host.locator('[data-chave="progresso"]')
  await expect(progresso).toBeAttached()
  const rolagens = progresso.locator('[data-papel="rolagens"]')
  await expect.poll(
    async () => Number(await rolagens.textContent()),
    { timeout: 15_000 },
  ).toBeGreaterThan(0)
  const antesDeOcultar = Number(await rolagens.textContent())

  const outra = await context.newPage()
  await outra.goto('data:text/html,<title>Outra aba</title>')
  await outra.bringToFront()

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))
  })

  await expect.poll(
    async () => Number(await rolagens.textContent()),
    { timeout: 15_000 },
  ).toBeGreaterThan(antesDeOcultar)

  await page.bringToFront()
  await expect(progresso).toBeVisible()
  await expect(progresso.locator('[data-acao="pausar"]')).toBeVisible()

  await expect.poll(async () => worker.evaluate(async () => {
    const resultado = await chrome.storage.local.get('copyhaunt:resultado:v1')
    return resultado['copyhaunt:resultado:v1']?.estado ?? null
  }), { timeout: 5_000 }).toBe('minerando')

  await page.goto('data:text/html,<title>Fora da Biblioteca</title>')
  expect(context.pages().some((aba) => aba.url().includes('/ads/library/'))).toBe(false)

  await outra.close()
})
