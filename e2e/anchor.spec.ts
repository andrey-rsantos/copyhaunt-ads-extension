import { expect, test } from './fixtures'

const URL_BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all' +
  '&country=BR&q=receitas&search_type=keyword_unordered'

/**
 * A ancoragem é testada em jsdom com uma grade que eu mesmo montei — o que
 * prova que o código faz o que foi pedido, não que funciona na Meta.
 *
 * Este teste roda o mesmo algoritmo contra o DOM real. Se a Meta mudar a
 * estrutura a ponto de a regra não achar mais cards, é aqui que aparece.
 */
test('a ancoragem encontra cards no DOM real da Biblioteca', async ({
  context,
}) => {
  const page = await context.newPage()
  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // A grade leva alguns segundos para renderizar; esperar o primeiro card
  // aparecer é mais confiável que um tempo fixo.
  await page
    .locator('text=/\\d{15,17}/')
    .first()
    .waitFor({ state: 'attached', timeout: 25_000 })
  await page.waitForTimeout(2000)

  const relato = await page.evaluate(() => {
    // Mesmo algoritmo de src/content/anchor.ts.
    const PADRAO = /(?<!\d)(\d{15,17})(?!\d)/
    const contarIds = (t: string) =>
      new Set(t.match(new RegExp(PADRAO.source, 'g')) ?? []).size

    const cards = new Map<string, Element>()
    for (const el of Array.from(document.querySelectorAll('span, div, a'))) {
      if (el.children.length > 0) continue
      const id = (el.textContent ?? '').match(PADRAO)?.[1]
      if (!id || cards.has(id)) continue

      let card: Element = el
      let pai = card.parentElement
      while (pai && contarIds(pai.textContent ?? '') === 1) {
        card = pai
        pai = card.parentElement
      }
      cards.set(id, card)
    }

    const elementos = [...cards.values()]
    const grade = elementos[0]?.parentElement ?? null
    const medidas = elementos.map((c) => {
      const r = c.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    })

    return {
      cards: cards.size,
      distintos: new Set(elementos).size,
      todosNaMesmaGrade: elementos.every((c) => c.parentElement === grade),
      larguraMediana: medidas.length
        ? medidas.map((m) => m.w).sort((a, b) => a - b)[
            Math.floor(medidas.length / 2)
          ]
        : 0,
      alturaMinima: medidas.length ? Math.min(...medidas.map((m) => m.h)) : 0,
    }
  })

  console.log('  ancoragem no DOM real:', JSON.stringify(relato))

  // Achou cards de verdade.
  expect(relato.cards).toBeGreaterThan(5)

  // Um elemento por anúncio: nenhum card compartilhado entre dois ids.
  expect(relato.distintos).toBe(relato.cards)

  // Todos irmãos sob o mesmo container: é a grade.
  expect(relato.todosNaMesmaGrade).toBe(true)

  // O card é uma caixa de verdade, não um rótulo solto. Medido: 392x557.
  expect(relato.larguraMediana).toBeGreaterThan(200)
  expect(relato.alturaMinima).toBeGreaterThan(100)
})
