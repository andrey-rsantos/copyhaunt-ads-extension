import { expect, test } from './fixtures'

/**
 * Prova o contrato de `iniciarQuandoHouverBody` (`src/content/arranque.ts`):
 * a interface sobe ao nascer o `body`, não em `DOMContentLoaded`. O cenário
 * trava a página com um `<script>` parser-blocking que só libera depois do
 * host ser detectado — se o bootstrap regredir para esperar o evento, o
 * `toBeAttached` estoura o timeout enquanto o script segue pendurado.
 *
 * A barra usa a estrutura mínima que `acharLinhaDaBusca` (`src/content/barra.ts`)
 * ancora de fato: um `input[type="search"]` cujo ancestral contenha um
 * `[role="combobox"]`. Um `<div aria-label="barra de ferramentas">` solto não
 * serve de âncora — é só decoração, o código procura pelo que os elementos
 * significam, não por como estão rotulados.
 */
test('monta a interface antes de DOMContentLoaded', async ({ context }) => {
  let liberarScript!: () => void
  const scriptLiberado = new Promise<void>((resolve) => {
    liberarScript = resolve
  })

  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', async (route) => {
    if (route.request().url().endsWith('/slow.js')) {
      await scriptLiberado
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: [
        '<!doctype html>',
        '<html><body>',
        '<div id="barra" style="display:flex;flex-direction:row">',
        '<div><div role="combobox">Brazil</div></div>',
        '<div><input type="search"></div>',
        '</div>',
        '<script src="/ads/library/slow.js"></script>',
        '</body></html>',
      ].join(''),
    })
  })

  await page.goto('https://www.facebook.com/ads/library/?id=bootstrap', {
    waitUntil: 'commit',
  })

  await expect(page.locator('#copyhaunt-enxertos')).toBeAttached({ timeout: 10_000 })
  expect(await page.evaluate(() => document.readyState)).toBe('loading')

  liberarScript()
  await page.waitForLoadState('domcontentloaded')
})
