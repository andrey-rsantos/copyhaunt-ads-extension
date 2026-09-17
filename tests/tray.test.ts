// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  aplicarVeredito,
  ATRIBUTO_ID,
  limparVeredito,
  plantarBandeja,
} from '../src/content/tray'
import type { Ad } from '../src/core/types'

const AGORA = new Date('2026-09-06T12:00:00Z')

function ad(id = '1', iniciouEm = new Date('2026-08-01T12:00:00Z')): Ad {
  return {
    id,
    iniciouEm,
    colacao: 3,
    anunciante: { pageId: 'p', pageName: 'A' },
    midias: [],
    plataformas: [],
    ativo: true,
  }
}

function card(): HTMLElement {
  const el = document.createElement('div')
  el.textContent = 'Library ID: 1'
  document.body.appendChild(el)
  return el
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('plantarBandeja', () => {
  it('planta um host com shadow root no card', () => {
    const c = card()
    plantarBandeja(c, ad(), AGORA)
    const host = c.querySelector(`[${ATRIBUTO_ID}]`) as HTMLElement
    expect(host).toBeTruthy()
    expect(host.shadowRoot).toBeTruthy()
  })

  it('marca o host com o id do anúncio', () => {
    const c = card()
    plantarBandeja(c, ad('652131454176487'), AGORA)
    const host = c.querySelector(`[${ATRIBUTO_ID}]`)
    expect(host?.getAttribute(ATRIBUTO_ID)).toBe('652131454176487')
  })

  it('reserva uma faixa no topo do card para a bandeja e o badge', () => {
    // Sem a faixa, os dois cobrem a linha "Active" e o Library ID da Meta.
    const c = card()
    plantarBandeja(c, ad(), AGORA)
    expect(c.style.paddingTop).toBe('46px')
  })

  it('não deixa o card esticar até a altura da linha da grade', () => {
    // A grade da Meta é grid com altura de linha fixa: sem isto o card mais
    // curto da linha ganha um vazio no rodapé.
    const c = card()
    plantarBandeja(c, ad(), AGORA)
    expect(c.style.alignSelf).toBe('start')
  })

  it('plantar duas vezes não duplica', () => {
    const c = card()
    plantarBandeja(c, ad(), AGORA)
    plantarBandeja(c, ad(), AGORA)
    expect(c.querySelectorAll(`[${ATRIBUTO_ID}]`)).toHaveLength(1)
  })

  it('replantar com outro anúncio troca o conteúdo, não duplica', () => {
    // A Meta recicla nós na rolagem: o mesmo elemento reaparece com outro anúncio.
    const c = card()
    plantarBandeja(c, ad('111'), AGORA)
    plantarBandeja(c, ad('222'), AGORA)
    const hosts = c.querySelectorAll(`[${ATRIBUTO_ID}]`)
    expect(hosts).toHaveLength(1)
    expect(hosts[0].getAttribute(ATRIBUTO_ID)).toBe('222')
  })

  it('exibe os dias ativos no badge', () => {
    const c = card()
    plantarBandeja(c, ad('1', new Date('2026-08-01T12:00:00Z')), AGORA)
    const badge = c
      .querySelector(`[${ATRIBUTO_ID}]`)
      ?.shadowRoot?.querySelector('.badge')
    expect(badge?.textContent).toContain('36')
  })

  it('marca a faixa do badge conforme os dias', () => {
    const c = card()
    plantarBandeja(c, ad('1', new Date('2026-09-05T12:00:00Z')), AGORA)
    const badge = c
      .querySelector(`[${ATRIBUTO_ID}]`)
      ?.shadowRoot?.querySelector('.badge')
    expect(badge?.getAttribute('data-faixa')).toBe('novo')
  })

  it('planta os três botões da bandeja', () => {
    const c = card()
    plantarBandeja(c, ad(), AGORA)
    const botoes = c
      .querySelector(`[${ATRIBUTO_ID}]`)
      ?.shadowRoot?.querySelectorAll('.botao')
    expect(botoes).toHaveLength(3)
  })

  it('posiciona o card só se ele for estático', () => {
    const c = card()
    c.style.position = 'absolute'
    plantarBandeja(c, ad(), AGORA)
    // Já estava posicionado: não mexemos.
    expect(c.style.position).toBe('absolute')
  })

  it('não altera o texto original do card', () => {
    const c = card()
    const antes = c.textContent
    plantarBandeja(c, ad(), AGORA)
    expect(c.textContent).toContain(antes ?? '')
  })
})

describe('aplicarVeredito', () => {
  it('esconde o card reprovado', () => {
    const c = card()
    aplicarVeredito(c, false)
    expect(c.style.display).toBe('none')
  })

  it('destaca o card aprovado com outline, nunca border', () => {
    const c = card()
    aplicarVeredito(c, true)
    expect(c.style.display).not.toBe('none')
    expect(c.style.outline).toContain('#7C3AED')
    // border deslocaria todos os cards da grade.
    expect(c.style.border).toBe('')
  })

  it('limparVeredito devolve o card ao estado original', () => {
    const c = card()
    aplicarVeredito(c, false)
    limparVeredito(c)
    expect(c.style.display).toBe('')
    expect(c.style.outline).toBe('')
  })

  it('aprovar depois de reprovar volta a exibir', () => {
    const c = card()
    aplicarVeredito(c, false)
    aplicarVeredito(c, true)
    expect(c.style.display).not.toBe('none')
  })
})
