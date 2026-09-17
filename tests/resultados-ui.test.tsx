// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/resultados/App'
import { serializarResultado, type ResultadoLocal } from '../src/core/resultados'
import type { Ad } from '../src/core/types'
import type { StorageLocal } from '../src/storage/resultados'

let raiz: Root | null = null
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

function resultadoComTresAnuncios(): ResultadoLocal {
  return {
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
}

function mapaStorage(resultado: ResultadoLocal | null): StorageLocal {
  return {
    get: async () => (resultado ? serializarResultado(resultado) : null),
    set: async () => {},
  }
}

function renderizarComStorage(resultado: ResultadoLocal | null): void {
  document.body.innerHTML = '<div id="root"></div>'
  raiz = createRoot(document.querySelector('#root')!)
  act(() => {
    raiz?.render(
      <App
        storage={mapaStorage(resultado)}
        agora={() => new Date('2026-09-17T12:00:00Z')}
      />,
    )
  })
}

async function aguardarCards(): Promise<void> {
  await vi.waitFor(() => {
    expect(document.querySelectorAll('[data-testid="resultado-card"]')).toHaveLength(3)
  })
}

function selecionar(rotulo: string): void {
  const select = document.querySelector<HTMLSelectElement>('[data-testid="ordenacao"]')!
  const opcao = [...select.options].find((item) => item.textContent === rotulo)
  select.value = opcao?.value ?? ''
  act(() => select.dispatchEvent(new Event('change', { bubbles: true })))
}

function idsDosCards(): string[] {
  return [...document.querySelectorAll<HTMLElement>('[data-testid="resultado-card"]')].map(
    (card) => card.dataset.adId ?? '',
  )
}

function clicar(seletor: string): void {
  act(() => document.querySelector<HTMLElement>(seletor)?.click())
}

afterEach(() => {
  act(() => raiz?.unmount())
  raiz = null
  document.body.innerHTML = ''
})

describe('página de resultados', () => {
  it('mostra estado vazio quando ainda não há resultado', async () => {
    renderizarComStorage(null)

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Nenhuma mineração concluída'),
    )
  })

  it('mostra cards e troca a ordem pelo seletor', async () => {
    renderizarComStorage(resultadoComTresAnuncios())
    await aguardarCards()

    selecionar('Mais criativos repetidos')
    await vi.waitFor(() =>
      expect(idsDosCards()).toEqual(['criativo-mais-repetido', 'antigo', 'outro']),
    )
  })

  it('abre o menu Links com os seis destinos do gerenciador', async () => {
    renderizarComStorage(resultadoComTresAnuncios())
    await aguardarCards()

    clicar('[data-acao="links"]')

    expect([...document.querySelectorAll('[data-link-chave]')].map((el) => el.textContent)).toEqual([
      'Site do anúncio',
      'Perfil do anunciante',
      'Instagram do anunciante',
      'Buscar anúncios deste site',
      'Buscar anúncios deste anunciante',
      'URL do anúncio na Biblioteca',
    ])
  })

  it('mantém um menu aberto e fecha ao clicar fora', async () => {
    renderizarComStorage(resultadoComTresAnuncios())
    await aguardarCards()

    const botoes = document.querySelectorAll<HTMLButtonElement>('[data-acao="links"]')
    act(() => botoes[0].click())
    expect(document.querySelectorAll('[data-link-chave]')).toHaveLength(6)
    act(() => botoes[1].click())
    expect(document.querySelectorAll('[data-link-chave]')).toHaveLength(6)
    act(() => document.body.click())
    expect(document.querySelector('[data-link-chave]')).toBeNull()
  })

  it('desabilita Instagram desconhecido e orienta a busca na Biblioteca', async () => {
    const resultado = resultadoComTresAnuncios()
    for (const anuncio of resultado.anuncios) anuncio.anunciante.instagram = undefined
    renderizarComStorage(resultado)
    await aguardarCards()

    clicar('[data-acao="links"]')
    const instagram = document.querySelector<HTMLButtonElement>(
      '[data-link-chave="instagram"]',
    )!
    expect(instagram.disabled).toBe(true)
    expect(instagram.textContent).toContain('Abrir na Biblioteca')
  })
})
