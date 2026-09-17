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
 *
 * Este teste também é o diagnóstico contínuo do carregamento contra a
 * Biblioteca real (Task 3, Step 4): mede quando cada marco acontece de fato,
 * não quando o Playwright percebe. Um `MutationObserver` injetado antes de
 * qualquer navegação (`addInitScript`) grava `performance.now()` no instante
 * em que `#copyhaunt-enxertos` e a primeira bandeja aparecem — medir a
 * latência do teste (via `expect.poll`) mediria o intervalo de sondagem, não
 * o marco real. Não há limiar de segundos: a Meta real varia, e o objetivo é
 * comparar antes/depois, não travar a suíte à rede.
 */
test('os cards do topo já nascem com bandeja', async ({ context }) => {
  mkdirSync(CAPTURAS, { recursive: true })

  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.addInitScript(() => {
    const marcos: Record<string, number> = {}
    ;(window as unknown as { __copyhauntMarcos: Record<string, number> }).__copyhauntMarcos = marcos

    const conferir = (): void => {
      if (marcos.host === undefined && document.getElementById('copyhaunt-enxertos')) {
        marcos.host = performance.now()
      }
      if (
        marcos.bandeja === undefined &&
        document.querySelector('[data-copyhaunt-id]')
      ) {
        marcos.bandeja = performance.now()
      }
      if (marcos.host !== undefined && marcos.bandeja !== undefined) {
        observador.disconnect()
      }
    }

    // Observa `document`, não `document.documentElement`: em `document_start`
    // — o mesmo instante em que este script roda — o `<html>` ainda pode não
    // existir, e `observe(null)` lança `TypeError` que aborta o script inteiro
    // antes mesmo da checagem síncrona abaixo. `document` em si já é um `Node`
    // válido desde sempre.
    const observador = new MutationObserver(conferir)
    observador.observe(document, { childList: true, subtree: true })

    // O content script da extensão roda em `document_start`, igual a este
    // script: quem injeta primeiro é indefinido pela plataforma. Sem esta
    // checagem síncrona, o observer só veria mutações futuras e perderia o
    // host, se ele já tiver nascido antes de o `observe` começar.
    conferir()
  })

  const linhas: string[] = []
  page.on('console', (m) => {
    if (m.text().includes('[CopyHaunt]')) linhas.push(m.text())
  })

  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Sem rolar: é justamente a primeira tela que estava descoberta.
  //
  // A espera é pela condição, não por um tempo chutado: o número de bandejas
  // é a própria coisa que o teste afirma, então esperar por ele é esperar
  // exatamente o necessário, seja a Meta rápida ou lenta.
  await expect
    .poll(() => page.locator('[data-copyhaunt-id]').count(), {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(20)

  const bandejas = await page.locator('[data-copyhaunt-id]').count()

  // Lido só depois de o `expect.poll` estabilizar: a Meta às vezes navega de
  // novo logo após o primeiro `domcontentloaded` (redirecionamento da própria
  // busca), o que destrói o contexto de um `evaluate` disparado cedo demais.
  // `performance.now()` e `domContentLoadedEventEnd` continuam no mesmo
  // referencial do documento final, então ler mais tarde não distorce os
  // números.
  const [dcl, marcos] = await Promise.all([
    page.evaluate(() => {
      const nav = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming | undefined
      return nav?.domContentLoadedEventEnd ?? null
    }),
    page.evaluate(
      () =>
        (window as unknown as { __copyhauntMarcos: Record<string, number> })
          .__copyhauntMarcos,
    ),
  ])

  console.log('  DOMContentLoaded:', dcl, 'ms desde o início da navegação')
  console.log('  primeiro host anexado:', marcos.host, 'ms')
  console.log('  primeira bandeja observável:', marcos.bandeja, 'ms')
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
