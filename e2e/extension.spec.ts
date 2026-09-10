import { expect, test } from './fixtures'

/** Página local servida na URL que casa com o padrão do manifest. */
const PAGINA_FALSA = `
<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><title>Biblioteca de Anúncios (simulada)</title></head>
  <body style="margin:0;font-family:system-ui">
    <div id="barra" style="display:flex;flex-direction:row;align-items:center">
      <div><div role="combobox">Brazil</div></div>
      <div><input type="search" placeholder="Search by keyword or advertiser"></div>
    </div>
    <div id="grade" style="width:400px;padding:24px;background:#fff;color:#000">Identificação da biblioteca: 2366492917183805</div>
  </body>
</html>`

const URL_ALVO =
  'https://www.facebook.com/ads/library/?active_status=active&q=teste'

test('a extensão carrega e o service worker sobe', async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-z]{32}$/)
})

test('o interceptador roda no main world e o content script confirma', async ({
  context,
}) => {
  const page = await context.newPage()
  const logs: string[] = []
  page.on('console', (msg) => logs.push(msg.text()))

  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )

  await page.goto(URL_ALVO)
  await expect
    .poll(() => logs.join('\n'), { timeout: 10_000 })
    .toContain('[CopyHaunt] interceptador confirmado pelo content script')

  // As outras duas linhas provam que ambos os mundos executaram.
  expect(logs.join('\n')).toContain('[CopyHaunt] interceptador ativo no main world')
  expect(logs.join('\n')).toContain('[CopyHaunt] content script ativo')
})

test('os enxertos plantam na barra sem vazar estilo na página', async ({
  context,
}) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const host = page.locator('#copyhaunt-enxertos')
  await expect(host).toBeAttached({ timeout: 10_000 })

  // Plantado dentro da barra da Meta, não solto no body.
  const paiId = await host.evaluate((el) => el.parentElement?.id)
  expect(paiId).toBe('barra')

  // A página hospedeira não pode ter sido tocada: fundo branco, texto preto.
  const grade = await page.locator('#grade').evaluate((el) => {
    const s = getComputedStyle(el)
    return { cor: s.color, fundo: s.backgroundColor }
  })
  expect(grade.cor).toBe('rgb(0, 0, 0)')
  expect(grade.fundo).toBe('rgb(255, 255, 255)')

})

test('os três botões vivem no shadow root, na cor da marca', async ({
  context,
}) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const host = page.locator('#copyhaunt-enxertos')
  await expect(host).toBeAttached({ timeout: 10_000 })

  // O Playwright atravessa shadow root aberto sozinho.
  await expect(host.locator('[data-chave="ajuda"]')).toBeAttached()
  await expect(host.locator('[data-chave="calendario"]')).toBeAttached()
  await expect(host.locator('[data-chave="minerar"]')).toBeAttached()

  // #7C3AED é o roxo principal de CopyHaunt-IDV.md; Minerar é a ação sólida.
  const fundo = await host
    .locator('[data-chave="minerar"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(fundo).toBe('rgb(124, 58, 237)')
})
