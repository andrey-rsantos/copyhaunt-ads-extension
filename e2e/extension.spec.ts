import { expect, test } from './fixtures'

/** Página local servida na URL que casa com o padrão do manifest. */
const PAGINA_FALSA = `
<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><title>Biblioteca de Anúncios (simulada)</title></head>
  <body style="margin:0;font-family:system-ui">
    <div id="grade" style="width:400px;padding:24px;background:#fff;color:#000">
      Identificação da biblioteca: 2366492917183805
    </div>
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

test('o painel monta como iframe sem vazar estilo na página', async ({
  context,
}) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const painel = page.locator('#copyhaunt-panel')
  await expect(painel).toBeAttached({ timeout: 10_000 })

  // O iframe precisa estar por cima de tudo e no canto superior direito.
  const estilo = await painel.evaluate((el) => {
    const s = getComputedStyle(el)
    return { position: s.position, zIndex: s.zIndex, top: s.top }
  })
  expect(estilo.position).toBe('fixed')
  expect(Number(estilo.zIndex)).toBeGreaterThan(1000)

  // A página hospedeira não pode ter sido tocada: fundo branco, texto preto.
  const grade = await page.locator('#grade').evaluate((el) => {
    const s = getComputedStyle(el)
    return { cor: s.color, fundo: s.backgroundColor }
  })
  expect(grade.cor).toBe('rgb(0, 0, 0)')
  expect(grade.fundo).toBe('rgb(255, 255, 255)')

  // O conteúdo do painel vive dentro do iframe, não na página.
  await expect(page.locator('body >> text=CopyHaunt')).toHaveCount(0)
})

test('o painel React renderiza a marca dentro do iframe', async ({
  context,
}) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const painel = page.frameLocator('#copyhaunt-panel')
  await expect(painel.locator('h1')).toContainText('CopyHaunt', {
    timeout: 10_000,
  })

  const roxo = await painel
    .locator('h1 span')
    .evaluate((el) => getComputedStyle(el).color)
  // #7C3AED é o roxo principal do CopyHaunt-IDV.md
  expect(roxo).toBe('rgb(124, 58, 237)')
})
