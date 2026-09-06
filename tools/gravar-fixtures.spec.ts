import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from '../e2e/fixtures'

const DESTINO = resolve(import.meta.dirname, '..', 'tests', 'fixtures')

const URL_BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all' +
  '&country=BR&q=receitas&search_type=keyword_unordered' +
  '&sort_data[mode]=total_impressions&sort_data[direction]=desc'

/** Só o que interessa: respostas de busca e de colação. */
function ehRespostaDeAnuncios(url: string): boolean {
  return url.includes('/api/graphql/') || url.includes('/search_ads/')
}

/**
 * Ferramenta, não teste de regressão. Roda sob demanda para atualizar as
 * fixtures quando a Meta mudar o formato.
 *
 * Grava APENAS corpos de resposta. A URL de requisição carrega parâmetros de
 * sessão e não pode entrar no repositório.
 */
test('gravar fixtures da Biblioteca de Anúncios', async ({ context }) => {
  mkdirSync(DESTINO, { recursive: true })

  const page = await context.newPage()
  const indice: Array<{ arquivo: string; bytes: number; contem: string[] }> = []
  let n = 0

  page.on('response', async (res) => {
    if (!ehRespostaDeAnuncios(res.url())) return
    let corpo: string
    try {
      corpo = await res.text()
    } catch {
      return // resposta já descartada pelo navegador
    }
    if (corpo.length < 500) return // respostas vazias não servem de amostra

    // Só marcadores de conteúdo, nunca a URL: ela leva sessão junto.
    const marcadores = [
      'search_results_connection',
      'collated_results',
      'ad_archive_id',
      'collation_count',
      'snapshot',
    ].filter((m) => corpo.includes(m))

    if (marcadores.length === 0) return

    n += 1
    const arquivo = `payload-${String(n).padStart(2, '0')}.json`
    writeFileSync(join(DESTINO, arquivo), corpo, 'utf8')
    indice.push({ arquivo, bytes: corpo.length, contem: marcadores })
  })

  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Rolar para a Meta pedir mais páginas. Rolagem humana, sem requisição
  // própria: é a mesma coleta passiva que a extensão faz.
  for (let i = 0; i < 4; i += 1) {
    await page.mouse.wheel(0, 4000)
    await page.waitForTimeout(2500)
  }

  writeFileSync(
    join(DESTINO, 'indice.json'),
    JSON.stringify({ gravadoEm: new Date().toISOString(), payloads: indice }, null, 2),
    'utf8',
  )

  console.log('\n=== FIXTURES GRAVADAS ===')
  for (const p of indice) {
    console.log(`  ${p.arquivo}  ${(p.bytes / 1024).toFixed(0)} kB  [${p.contem.join(', ')}]`)
  }
  console.log(`  total: ${indice.length} arquivos`)
  console.log('=========================\n')
})
