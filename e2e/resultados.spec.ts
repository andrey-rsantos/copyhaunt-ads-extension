import { serializarResultado, type ResultadoLocal } from '../src/core/resultados'
import type { Ad } from '../src/core/types'
import { expect, test } from './fixtures'

function anuncio(opcoes: Partial<Ad> = {}): Ad {
  return {
    id: 'outro',
    iniciouEm: new Date('2026-08-18T12:00:00Z'),
    colacao: 1,
    anunciante: { pageId: 'p2', pageName: 'Página 2' },
    destino: 'https://exemplo.com/oferta',
    texto: 'Texto principal do anúncio',
    titulo: 'Título do anúncio',
    midias: [
      {
        formato: 'imagem',
        alta: 'https://cdn.exemplo.test/alta.jpg',
        baixa: 'https://cdn.exemplo.test/baixa.jpg',
      },
    ],
    plataformas: ['Facebook', 'Instagram'],
    ativo: true,
    ...opcoes,
  }
}

function payloadPersistidoDeTeste() {
  const resultado: ResultadoLocal = {
    salvoEm: new Date('2026-09-17T12:00:00Z'),
    origem: 'https://www.facebook.com/ads/library/?q=receitas',
    estado: 'esgotado',
    anuncios: [
      anuncio({
        id: 'criativo-mais-repetido',
        iniciouEm: new Date('2026-09-10T12:00:00Z'),
        colacao: 2,
        colacaoId: 'grupo-a',
        anunciante: {
          pageId: 'p1',
          pageName: 'Página 1',
          instagram: 'https://www.instagram.com/oficial',
        },
      }),
      anuncio({
        id: 'antigo',
        iniciouEm: new Date('2026-06-19T12:00:00Z'),
        colacao: 1,
        colacaoId: 'grupo-a',
        anunciante: {
          pageId: 'p1',
          pageName: 'Página 1',
          instagram: 'https://www.instagram.com/oficial',
        },
      }),
      anuncio({
        id: 'outro',
        iniciouEm: new Date('2026-08-18T12:00:00Z'),
        anunciante: {
          pageId: 'p2',
          pageName: 'Página 2',
          instagram: 'https://www.instagram.com/outro',
        },
      }),
    ],
  }
  return serializarResultado(resultado)
}

test('a página nova começa com estado vazio', async ({ context, extensionId }) => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/resultados/index.html`)
  await expect(page.getByText('Nenhuma mineração concluída')).toBeVisible()
})

test('renderiza resultado salvo, ordena e abre Links', async ({ context, extensionId }) => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/resultados/index.html`)
  await page.evaluate(async (payload) => {
    await chrome.storage.local.set({ 'copyhaunt:resultado:v1': payload })
  }, payloadPersistidoDeTeste())
  await page.reload()

  await expect(page.locator('[data-testid="resultado-card"]')).toHaveCount(3)
  await page.selectOption('[data-testid="ordenacao"]', 'colacao')
  await expect(page.locator('[data-testid="resultado-card"]').first()).toHaveAttribute(
    'data-ad-id',
    'criativo-mais-repetido',
  )
  await page.locator('[data-acao="links"]').first().click()
  await expect(page.locator('[data-link-chave="perfil"]')).toBeVisible()
})

test('a mensagem abrir-resultados faz o service worker abrir a página', async ({ context, extensionId }) => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/resultados/index.html`)

  const novaAba = context.waitForEvent('page')
  await page.evaluate(() => chrome.runtime.sendMessage({ tipo: 'abrir-resultados' }))

  const aberta = await novaAba
  await aberta.waitForLoadState()
  expect(aberta.url()).toBe(`chrome-extension://${extensionId}/src/resultados/index.html`)
})

test('Instagram desconhecido só oferece a busca; nada sai para a Meta ao abrir Links', async ({ context, extensionId }) => {
  const page = await context.newPage()
  const requisicoes: string[] = []
  page.on('request', (r) => requisicoes.push(r.url()))

  await page.goto(`chrome-extension://${extensionId}/src/resultados/index.html`)
  await page.evaluate(async (payload) => {
    await chrome.storage.local.set({ 'copyhaunt:resultado:v1': payload })
  }, serializarResultado({
    salvoEm: new Date('2026-09-17T12:00:00Z'),
    origem: 'https://www.facebook.com/ads/library/?q=receitas',
    estado: 'esgotado',
    anuncios: [anuncio({ id: 'sem-instagram' })],
  }))
  await page.reload()

  await expect(page.locator('[data-testid="resultado-card"]')).toHaveCount(1)
  await page.locator('[data-acao="links"]').click()

  const item = page.locator('[data-link-chave="instagram"]')
  await expect(item).toHaveText('Buscar Instagram')
  await expect(item).toBeEnabled()
  expect(requisicoes.filter((u) => /facebook\.com|instagram\.com/.test(u))).toEqual([])
  expect(page.url()).toBe(`chrome-extension://${extensionId}/src/resultados/index.html`)
})
