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
  let guardado: unknown = resultado ? serializarResultado(resultado) : null
  return {
    get: async () => guardado,
    set: async (_chave, valor) => {
      guardado = valor
    },
  }
}

/** O runtime da extensão, respondendo o que o teste mandar. */
function stubRuntime(responder?: (mensagem: unknown) => unknown) {
  const enviar = vi.fn((_mensagem: unknown, callback: (resposta: unknown) => void) => {
    if (responder) callback(responder(_mensagem))
  })
  vi.stubGlobal('chrome', { runtime: { sendMessage: enviar, lastError: undefined } })
  return enviar
}

function semInstagram(): ResultadoLocal {
  const resultado = resultadoComTresAnuncios()
  for (const anuncio of resultado.anuncios) anuncio.anunciante.instagram = undefined
  return resultado
}

function itemInstagram(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('[data-link-chave="instagram"]')!
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

describe('estado do snapshot', () => {
  it.each([
    ['pausado', 'Resultados parciais — mineração pausada'],
    ['interrompida', 'Resultados parciais — mineração interrompida'],
    ['concluido', 'Mineração concluída'],
    ['esgotado', 'Fim dos resultados'],
  ] as const)('exibe o estado %s no cabeçalho', async (estado, rotulo) => {
    renderizarComStorage({
      ...resultadoComTresAnuncios(),
      estado,
    })

    await aguardarCards()
    expect(
      document.querySelector('[data-testid="resultado-estado"]')?.textContent,
    ).toBe(rotulo)
  })
})


describe('busca de Instagram pelo menu', () => {
  it('mostra o perfil encontrado e compartilha consulta pelo anunciante', async () => {
    const enviar = stubRuntime(() => ({ ok: true, url: 'https://www.instagram.com/oficial' }))
    const resultado = semInstagram()
    renderizarComStorage(resultado)
    await aguardarCards()

    // `antigo` e `criativo-mais-repetido` são do mesmo anunciante (p1).
    const links = (id: string) =>
      document.querySelector<HTMLButtonElement>(`[data-ad-id="${id}"] [data-acao="links"]`)!
    act(() => links('antigo').click())
    await act(async () => { itemInstagram().click() })

    await vi.waitFor(() => expect(enviar).toHaveBeenCalledTimes(1))
    expect(enviar.mock.calls[0][0]).toEqual({
      tipo: 'buscar-instagram',
      pageId: 'p1',
      origem: resultado.origem,
    })
    await vi.waitFor(() => {
      const link = document.querySelector<HTMLAnchorElement>('a[data-link-chave="instagram"]')
      expect(link?.getAttribute('href')).toBe('https://www.instagram.com/oficial')
      expect(link?.textContent).toBe('Instagram do anunciante')
    })

    // O outro card do mesmo anunciante já vem como link, sem nova consulta.
    act(() => links('criativo-mais-repetido').click())
    expect(
      document.querySelector<HTMLAnchorElement>('a[data-link-chave="instagram"]')?.getAttribute('href'),
    ).toBe('https://www.instagram.com/oficial')
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('mantém o menu aberto e o item ocupado enquanto busca', async () => {
    let responder!: (resposta: unknown) => void
    const enviar = vi.fn((_m: unknown, callback: (resposta: unknown) => void) => {
      responder = callback
    })
    vi.stubGlobal('chrome', { runtime: { sendMessage: enviar, lastError: undefined } })

    renderizarComStorage(semInstagram())
    await aguardarCards()
    clicar('[data-acao="links"]')
    await act(async () => { itemInstagram().click() })

    expect(itemInstagram().disabled).toBe(true)
    expect(itemInstagram().textContent).toContain('Buscando Instagram…')

    await act(async () => { responder({ ok: true, url: null }) })
    expect(itemInstagram().disabled).toBe(true)
    expect(itemInstagram().textContent).toContain('Instagram não encontrado')
  })

  it('mostra falha controlada quando a ponte não responde', async () => {
    stubRuntime(() => ({ ok: false, motivo: 'aba-indisponivel' }))

    renderizarComStorage(semInstagram())
    await aguardarCards()
    clicar('[data-acao="links"]')
    await act(async () => { itemInstagram().click() })

    await vi.waitFor(() => {
      expect(itemInstagram().disabled).toBe(true)
      expect(itemInstagram().textContent).toContain('Não foi possível buscar Instagram')
    })
  })

  it('persiste o perfil encontrado no snapshot', async () => {
    stubRuntime(() => ({ ok: true, url: 'https://www.instagram.com/oficial' }))
    const resultado = semInstagram()
    const storage = mapaStorage(resultado)
    document.body.innerHTML = '<div id="root"></div>'
    raiz = createRoot(document.querySelector('#root')!)
    act(() => {
      raiz?.render(<App storage={storage} agora={() => new Date('2026-09-17T12:00:00Z')} />)
    })
    await aguardarCards()
    clicar('[data-acao="links"]')
    await act(async () => { itemInstagram().click() })

    await vi.waitFor(async () => {
      const salvo = (await storage.get('copyhaunt:resultado:v1')) as {
        anuncios: Array<{ anunciante: { pageId: string; instagram?: string } }>
      }
      expect(salvo.anuncios.map((a) => a.anunciante.instagram)).toEqual([
        'https://www.instagram.com/oficial',
        'https://www.instagram.com/oficial',
        undefined,
      ])
    })
  })
})

afterEach(() => {
  act(() => raiz?.unmount())
  raiz = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
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

  it('oferece Buscar Instagram somente por ação explícita', async () => {
    const enviar = stubRuntime()

    renderizarComStorage(semInstagram())
    await aguardarCards()
    clicar('[data-acao="links"]')

    const instagram = itemInstagram()
    expect(instagram.disabled).toBe(false)
    expect(instagram.textContent).toContain('Buscar Instagram')
    expect(enviar).not.toHaveBeenCalled()
  })

  it('mostra o termo da busca no cabeçalho e os dias como badge da imagem', async () => {
    renderizarComStorage(resultadoComTresAnuncios())
    await vi.waitFor(() => expect(document.querySelectorAll('[data-testid="resultado-card"]')).toHaveLength(3))

    const resumo = document.querySelector('.resultado-resumo')!
    expect(resumo.textContent).toContain('receitas')
    expect(resumo.textContent).not.toContain('https://www.facebook.com')
    expect(resumo.querySelector('a')?.getAttribute('href')).toBe('https://www.facebook.com/ads/library/?q=receitas')

    const badge = document.querySelector('[data-ad-id="criativo-mais-repetido"] .resultado-preview .resultado-badge')!
    expect(badge.textContent).toBe('7 DIAS')
    expect(badge.getAttribute('data-faixa')).toBe('provado')
  })

  it('confirma visualmente quando uma cópia termina', async () => {
    const escrever = vi.fn(async () => {})
    const descritorOriginal = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: escrever },
    })

    try {
      renderizarComStorage(resultadoComTresAnuncios())
      await aguardarCards()

      clicar('[data-acao="copiar"]')
      const item = document.querySelector<HTMLButtonElement>(
        '[data-copy-chave="texto"]',
      )!
      await act(async () => {
        item.click()
        await Promise.resolve()
      })

      await vi.waitFor(() => {
        expect(escrever).toHaveBeenCalledWith('Texto principal do anúncio')
        expect(item.textContent).toContain('Copiado')
        expect(item.dataset.estado).toBe('copiado')
        expect(document.querySelector('[data-testid="copia-feedback"]')?.textContent).toBe(
          'Copiado',
        )
      })
    } finally {
      if (descritorOriginal) {
        Object.defineProperty(navigator, 'clipboard', descritorOriginal)
      } else {
        delete (navigator as { clipboard?: Clipboard }).clipboard
      }
    }
  })
})
