// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  definirDocIdAnunciante,
  instagramConhecido,
  limparCacheInstagram,
} from '../src/content/instagram'
import { plantarBandeja } from '../src/content/tray'
import type { Ad } from '../src/core/types'

const HTML_LOGADO = `["DTSGInitData",[],{"token":"NAcMtoken"},1]`

const RESPOSTA_BOA = {
  data: { page: { extraPageInfo: { page_info: { ig_username: 'renanbotelho' } } } },
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
  definirDocIdAnunciante('7193625857423421')
  document.documentElement.innerHTML = `<head></head><body><script>${HTML_LOGADO}</script></body>`
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

  it('o clique busca e abre a aba com o perfil achado', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    vi.stubGlobal('fetch', vi.fn(async () => respostaBoa()))

    const shadow = plantar()
    abrirOpen(shadow)
    itemInstagram(shadow).click()

    await vi.waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        'https://www.instagram.com/renanbotelho',
        '_blank',
        'noopener',
      )
    })
    vi.unstubAllGlobals()
  })

  it('depois de achar, o item vira link direto e não busca de novo', async () => {
    const buscar = vi.fn(async () => respostaBoa())
    vi.stubGlobal('open', vi.fn())
    vi.stubGlobal('fetch', buscar)

    const shadow = plantar()
    abrirOpen(shadow)
    itemInstagram(shadow).click()
    await vi.waitFor(() =>
      expect(instagramConhecido('378128628724966')).toBe(
        'https://www.instagram.com/renanbotelho',
      ),
    )

    abrirOpen(shadow)
    const item = itemInstagram(shadow)
    expect(item.dataset.desabilitado).toBeUndefined()
    expect(item.textContent).not.toContain('buscar')

    item.click()
    await vi.waitFor(() =>
      expect(window.open).toHaveBeenCalledWith(
        'https://www.instagram.com/renanbotelho',
        '_blank',
        'noopener',
      ),
    )
    // A segunda trava: o anunciante não é perguntado duas vezes.
    expect(buscar).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('quando a busca não acha, o item volta a desabilitado e cala', async () => {
    const buscar = vi.fn(
      async () => ({ ok: true, text: async () => '{"data":{}}' }) as unknown as Response,
    )
    const open = vi.fn()
    vi.stubGlobal('open', open)
    vi.stubGlobal('fetch', buscar)

    const shadow = plantar()
    abrirOpen(shadow)
    itemInstagram(shadow).click()
    await vi.waitFor(() => expect(instagramConhecido('378128628724966')).toBeNull())

    // Falha silenciosa: nenhuma aba, nenhum erro na cara do usuário.
    expect(open).not.toHaveBeenCalled()

    abrirOpen(shadow)
    expect(itemInstagram(shadow).dataset.desabilitado).toBe('sim')

    itemInstagram(shadow).click()
    // E nenhuma repetição automática nem manual.
    expect(buscar).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
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
