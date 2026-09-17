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
    // O script roda em todo frame (a Meta embute iframes na busca). Um
    // observer de iframe nunca vê o host — ele só existe no documento
    // principal — e por isso nunca desconecta e nunca conta replantio real;
    // sem este corte, os replantios de todo iframe se somariam ao do topo.
    if (window !== window.top) return

    const marcos: Record<string, number> = {}
    ;(window as unknown as { __copyhauntMarcos: Record<string, number> }).__copyhauntMarcos = marcos
    let replantios = 0
    ;(window as unknown as { __copyhauntReplantios: number }).__copyhauntReplantios = 0

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
    }

    // Conta quantas vezes o host entra no DOM: um lote de mutações em que
    // algum `addedNodes` é ou contém `#copyhaunt-enxertos`. Olhar os nós
    // inseridos neste lote, em vez de `querySelector` no documento inteiro,
    // é o que distingue "o host continua lá" de "o host foi removido e
    // replantado" — a segunda também deixaria o `querySelector` positivo.
    const contarReplante = (registros: MutationRecord[]): void => {
      const entrou = registros.some(registro =>
        Array.from(registro.addedNodes).some(
          no =>
            no instanceof Element &&
            (no.id === 'copyhaunt-enxertos' ||
              no.querySelector?.('#copyhaunt-enxertos') != null),
        ),
      )
      if (entrou) {
        replantios++
        ;(window as unknown as { __copyhauntReplantios: number }).__copyhauntReplantios =
          replantios
      }
    }

    // Observa `document`, não `document.documentElement`: em `document_start`
    // — o mesmo instante em que este script roda — o `<html>` ainda pode não
    // existir, e `observe(null)` lança `TypeError` que aborta o script inteiro
    // antes mesmo da checagem síncrona abaixo. `document` em si já é um `Node`
    // válido desde sempre.
    //
    // O observer fica vivo até o fim do teste (nunca desconecta): o marco de
    // host/bandeja só precisa do primeiro acerto, mas o contador de
    // replantios precisa continuar vendo o resto da sessão.
    const observador = new MutationObserver(registros => {
      contarReplante(registros)
      conferir()
    })
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
  const [dcl, marcos, replantios] = await Promise.all([
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
    page.evaluate(
      () =>
        (window as unknown as { __copyhauntReplantios: number })
          .__copyhauntReplantios,
    ),
  ])

  console.log('  DOMContentLoaded:', dcl, 'ms desde o início da navegação')
  console.log('  primeiro host anexado:', marcos.host, 'ms')
  console.log('  primeira bandeja observável:', marcos.bandeja, 'ms')
  console.log('  bandejas na primeira tela:', bandejas)
  console.log('  replantios do host:', replantios)
  for (const l of linhas.filter((l) => l.includes('lote do HTML'))) {
    console.log('  ' + l)
  }

  await page.screenshot({
    path: resolve(CAPTURAS, 'topo-com-bandeja.png'),
    fullPage: false,
  })

  expect(bandejas).toBeGreaterThanOrEqual(20)
})
