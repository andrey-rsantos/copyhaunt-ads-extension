// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  definirDocIdAnunciante,
  limparCacheInstagram,
} from '../src/content/instagram'
import { plantarBandeja } from '../src/content/tray'
import type { Ad } from '../src/core/types'

const HTML_COM_LSD = `["LSD",[],{"token":"AdLsdToken"},323]`

const RESPOSTA_BOA = {
  data: {
    ad_library_page_info: { page_info: { ig_username: 'renanbotelhodr' } },
  },
}

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    texto: 'O texto do anúncio',
    // Destino que não é Instagram: força o caminho 2, que é o caso de 89%.
    destino: 'https://exemplo.com/oferta',
    midias: [],
    plataformas: [],
    ativo: true,
    ...extra,
  }
}

function plantar(a: Ad = ad()): ShadowRoot {
  const card = document.createElement('div')
  document.body.appendChild(card)
  plantarBandeja(card, a, new Date('2026-09-06T00:00:00Z'))
  return card.querySelector('[data-copyhaunt-id]')!.shadowRoot!
}

function abrirOpen(shadow: ShadowRoot): void {
  shadow.querySelector<HTMLElement>('.botao[data-acao="abrir"]')!.click()
}

function itemInstagram(shadow: ShadowRoot): HTMLElement {
  return shadow.querySelector<HTMLElement>('.item[data-chave="instagram"]')!
}

function respostaBoa() {
  return {
    ok: true,
    text: async () => JSON.stringify(RESPOSTA_BOA),
  } as unknown as Response
}

beforeEach(() => {
  document.body.innerHTML = ''
  limparCacheInstagram()
  definirDocIdAnunciante('26617181747964058')
  document.documentElement.innerHTML = `<head></head><body><script>${HTML_COM_LSD}</script></body>`
})

describe('o item do Instagram quando a derivação passiva não alcança', () => {
  it('fica clicável, e diz que vai buscar', () => {
    const shadow = plantar()
    abrirOpen(shadow)
    const item = itemInstagram(shadow)
    expect(item.dataset.desabilitado).toBeUndefined()
    expect(item.textContent).toContain('buscar')
  })

  it('o menu continua com os seis itens de sempre', () => {
    const shadow = plantar()
    abrirOpen(shadow)
    expect(shadow.querySelectorAll('.menu .item')).toHaveLength(6)
  })

  it('não requisita nada só por abrir o menu', () => {
    const buscar = vi.fn(async () => respostaBoa())
    vi.stubGlobal('fetch', buscar)

    const shadow = plantar()
    abrirOpen(shadow)

    // A primeira trava do spec: nada sai sem clique explícito no item.
    expect(buscar).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('mostra buscando e depois o handle, sem fechar o menu', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaBoa()))
    const shadow = plantar()
    abrirOpen(shadow)

    itemInstagram(shadow).click()
    expect(itemInstagram(shadow).textContent).toBe('buscando…')

    await vi.waitFor(() =>
      expect(itemInstagram(shadow).textContent).toBe('Abrir @renanbotelhodr'),
    )
    expect(shadow.querySelector('.menu')).not.toBeNull()
  })

  it('avisa quando o anunciante não tem Instagram vinculado', async () => {
    const semIg = {
      ok: true,
      text: async () =>
        JSON.stringify({ data: { ad_library_page_info: { page_info: {} } } }),
    } as unknown as Response
    vi.stubGlobal('fetch', vi.fn(async () => semIg))
    const shadow = plantar()
    abrirOpen(shadow)

    itemInstagram(shadow).click()
    await vi.waitFor(() =>
      expect(itemInstagram(shadow).textContent).toBe('sem Instagram vinculado'),
    )
    expect(itemInstagram(shadow).dataset.desabilitado).toBe('sim')
  })

  it('só abre a aba no segundo clique, com ativação do usuário', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    vi.stubGlobal('fetch', vi.fn(async () => respostaBoa()))
    const shadow = plantar()
    abrirOpen(shadow)

    itemInstagram(shadow).click()
    await vi.waitFor(() =>
      expect(itemInstagram(shadow).textContent).toBe('Abrir @renanbotelhodr'),
    )
    expect(open).not.toHaveBeenCalled()

    itemInstagram(shadow).click()
    expect(open).toHaveBeenCalledWith(
      'https://www.instagram.com/renanbotelhodr', '_blank', 'noopener',
    )
  })

  it('uma segunda abertura do menu já mostra o handle, sem requisitar de novo', async () => {
    const buscar = vi.fn(async () => respostaBoa())
    vi.stubGlobal('open', vi.fn())
    vi.stubGlobal('fetch', buscar)
    const shadow = plantar()

    abrirOpen(shadow)
    itemInstagram(shadow).click()
    await vi.waitFor(() =>
      expect(itemInstagram(shadow).textContent).toBe('Abrir @renanbotelhodr'),
    )

    abrirOpen(shadow)
    expect(itemInstagram(shadow).textContent).toBe('Abrir @renanbotelhodr')
    expect(buscar).toHaveBeenCalledTimes(1)
  })
})

describe('quando a derivação passiva alcança', () => {
  it('o item é link direto, e nada é requisitado', async () => {
    const buscar = vi.fn(async () => respostaBoa())
    const open = vi.fn()
    vi.stubGlobal('open', open)
    vi.stubGlobal('fetch', buscar)

    const shadow = plantar(ad({ destino: 'https://www.instagram.com/_u/ricardoperuffo' }))
    abrirOpen(shadow)
    itemInstagram(shadow).click()

    expect(open).toHaveBeenCalledWith(
      'https://www.instagram.com/ricardoperuffo',
      '_blank',
      'noopener',
    )
    // Os 11% que custam zero continuam custando zero.
    expect(buscar).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
