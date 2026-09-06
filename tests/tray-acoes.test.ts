// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { plantarBandeja } from '../src/content/tray'
import type { Ad } from '../src/core/types'

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    texto: 'O texto do anúncio',
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
  const host = card.querySelector('[data-copyhaunt-id]')!
  return host.shadowRoot!
}

function botao(shadow: ShadowRoot, acao: string): HTMLElement {
  return shadow.querySelector<HTMLElement>(`.botao[data-acao="${acao}"]`)!
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('botão copiar', () => {
  it('abre o menu com os cinco itens de cópia', () => {
    const shadow = plantar()
    botao(shadow, 'copiar').click()
    expect(shadow.querySelectorAll('.menu .item')).toHaveLength(5)
  })

  it('escolher um item escreve o valor na área de transferência', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const shadow = plantar()
    botao(shadow, 'copiar').click()
    shadow.querySelector<HTMLElement>('.item[data-chave="texto"]')!.click()

    expect(writeText).toHaveBeenCalledWith('O texto do anúncio')
    vi.unstubAllGlobals()
  })
})

describe('botão abrir', () => {
  it('abre o menu com os seis destinos', () => {
    const shadow = plantar()
    botao(shadow, 'abrir').click()
    expect(shadow.querySelectorAll('.menu .item')).toHaveLength(6)
  })

  it('escolher um destino abre nova aba, sem passar opener', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)

    const shadow = plantar()
    botao(shadow, 'abrir').click()
    shadow.querySelector<HTMLElement>('.item[data-chave="perfil"]')!.click()

    expect(open).toHaveBeenCalledWith(
      'https://www.facebook.com/378128628724966',
      '_blank',
      'noopener',
    )
    vi.unstubAllGlobals()
  })
})

describe('botão baixar', () => {
  it('ainda não faz nada, e não estoura ao ser clicado', () => {
    const shadow = plantar()
    expect(() => botao(shadow, 'baixar').click()).not.toThrow()
    expect(shadow.querySelector('.menu')).toBeNull()
  })
})
