import { test } from './fixtures'

const URL_REAL =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=receitas&search_type=keyword_unordered'

/**
 * Diagnóstico, não asserção. A Biblioteca de Anúncios é pública por obrigação
 * de transparência, mas a Meta bloqueia clientes que parecem robô. Se o acesso
 * falhar, isso é informação — não erro. Este teste nunca reprova.
 *
 * Nenhum login é feito. Nenhuma tentativa de contornar bloqueio.
 */
test('diagnóstico: o que a página real entrega sem sessão', async ({
  context,
}) => {
  const page = await context.newPage()
  const logs: string[] = []
  page.on('console', (msg) => logs.push(msg.text()))

  let csp: string | null = null
  let status: number | null = null

  page.on('response', (res) => {
    if (
      res.url().includes('/ads/library/') &&
      res.request().isNavigationRequest()
    ) {
      status = res.status()
      csp = res.headers()['content-security-policy'] ?? null
    }
  })

  try {
    await page.goto(URL_REAL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
  } catch (erro) {
    console.log('RELATÓRIO: navegação falhou —', (erro as Error).message)
    return
  }

  // A página real é pesada e o painel monta em DOMContentLoaded, que compete
  // com o waitUntil da navegação. Sem esta espera o diagnóstico relata um
  // falso negativo — foi o que aconteceu na primeira execução.
  await page
    .locator('#copyhaunt-panel')
    .waitFor({ state: 'attached', timeout: 15_000 })
    .catch(() => {})

  const urlFinal = page.url()
  const aindaNaBiblioteca = urlFinal.includes('/ads/library/')
  const nossoScriptRodou = logs.some((l) => l.includes('[CopyHaunt]'))
  const ponteFuncionou = logs.some((l) =>
    l.includes('interceptador confirmado pelo content script'),
  )
  const painelMontou = (await page.locator('#copyhaunt-panel').count()) > 0

  console.log('\n=== RELATÓRIO DO DIAGNÓSTICO ===')
  console.log('status da navegação:      ', status)
  console.log('URL final:                ', urlFinal)
  console.log('continua em /ads/library: ', aindaNaBiblioteca)
  console.log('CSP presente:             ', csp ? 'sim' : 'não')
  if (csp) console.log('CSP:', String(csp).slice(0, 400))
  console.log('nosso script rodou:       ', nossoScriptRodou)
  console.log('ponte entre mundos:       ', ponteFuncionou)
  console.log('painel montou:            ', painelMontou)
  console.log(
    'linhas do console:        ',
    logs.filter((l) => l.includes('[CopyHaunt]')),
  )
  console.log('================================\n')
})
