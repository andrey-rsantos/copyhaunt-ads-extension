import { expect, test } from './fixtures'

const URL_BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all' +
  '&country=BR&q=receitas&search_type=keyword_unordered'

/**
 * Prova o caminho inteiro na Biblioteca real: a página pede, o interceptador
 * captura, o roteador classifica, o normalizador converte e o índice cresce.
 *
 * As peças têm teste cada uma; este é o único que exercita a ligação.
 */
test('o tubo indexa anúncios reais de ponta a ponta', async ({ context }) => {
  const page = await context.newPage()
  const linhas: string[] = []
  page.on('console', (m) => linhas.push(m.text()))

  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  // Quatro rolagens, não três: com três, só a primeira resposta chega a
  // tempo e a asserção de acumulação abaixo fica vazia por falta de pontos.
  for (let i = 0; i < 4; i += 1) {
    await page.mouse.wheel(0, 4000)
    await page.waitForTimeout(2500)
  }

  const indexacoes = linhas
    .filter((l) => l.includes('[CopyHaunt] indexados:'))
    .map((l) => Number(l.split(':').pop()?.trim() ?? 0))

  console.log('  indexações observadas:', indexacoes.join(' → '))

  // Pelo menos duas indexações: com uma só, a asserção de acumulação lá
  // embaixo não compara nada e passaria vazia.
  expect(indexacoes.length).toBeGreaterThanOrEqual(2)

  // O índice cresceu além de um único lote. Medido: três respostas de busca
  // por sessão rendem 27 anúncios.
  const maior = Math.max(...indexacoes)
  expect(maior).toBeGreaterThan(15)

  // A contagem nunca diminui — é índice acumulado, não contador por lote.
  for (let i = 1; i < indexacoes.length; i += 1) {
    expect(indexacoes[i]).toBeGreaterThan(indexacoes[i - 1])
  }
})
