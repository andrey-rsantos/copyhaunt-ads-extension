// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  abrirGaveta,
  alternarGaveta,
  fecharGaveta,
  gavetaAberta,
} from '../../src/content/gaveta'

let shadow: ShadowRoot
let botaoA: HTMLElement
let botaoB: HTMLElement

beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>'
  const host = document.getElementById('host') as HTMLElement
  shadow = host.attachShadow({ mode: 'open' })

  botaoA = document.createElement('div')
  botaoA.dataset.chave = 'calendario'
  botaoB = document.createElement('div')
  botaoB.dataset.chave = 'minerar'
  shadow.append(botaoA, botaoB)
})

function conteudo(texto: string): HTMLElement {
  const div = document.createElement('div')
  div.textContent = texto
  return div
}

describe('gaveta', () => {
  it('não há gaveta aberta no começo', () => {
    expect(gavetaAberta(shadow)).toBeNull()
  })

  it('abrir mostra o conteúdo e registra o dono', () => {
    abrirGaveta(shadow, botaoA, conteudo('faixa de dias'))

    expect(gavetaAberta(shadow)).toBe('calendario')
    expect(shadow.querySelector('.gaveta')?.textContent).toContain(
      'faixa de dias',
    )
  })

  it('marca o botão dono como aberto', () => {
    abrirGaveta(shadow, botaoA, conteudo('x'))
    expect(botaoA.dataset.aberto).toBe('1')
  })

  it('abrir a segunda fecha a primeira: só uma por vez', () => {
    abrirGaveta(shadow, botaoA, conteudo('primeira'))
    abrirGaveta(shadow, botaoB, conteudo('segunda'))

    expect(gavetaAberta(shadow)).toBe('minerar')
    expect(shadow.querySelectorAll('.gaveta').length).toBe(1)
    expect(shadow.querySelector('.gaveta')?.textContent).toContain('segunda')
    expect(botaoA.dataset.aberto).toBeUndefined()
  })

  it('fechar remove a gaveta e a marca do botão', () => {
    abrirGaveta(shadow, botaoA, conteudo('x'))
    fecharGaveta(shadow)

    expect(gavetaAberta(shadow)).toBeNull()
    expect(shadow.querySelector('.gaveta')).toBeNull()
    expect(botaoA.dataset.aberto).toBeUndefined()
  })

  it('fechar sem nada aberto não quebra', () => {
    expect(() => fecharGaveta(shadow)).not.toThrow()
  })

  it('alternar abre quando fechada e fecha quando é a mesma', () => {
    alternarGaveta(shadow, botaoA, () => conteudo('x'))
    expect(gavetaAberta(shadow)).toBe('calendario')

    alternarGaveta(shadow, botaoA, () => conteudo('x'))
    expect(gavetaAberta(shadow)).toBeNull()
  })

  it('alternar troca quando o dono é outro', () => {
    alternarGaveta(shadow, botaoA, () => conteudo('a'))
    alternarGaveta(shadow, botaoB, () => conteudo('b'))
    expect(gavetaAberta(shadow)).toBe('minerar')
  })

  it('monta o conteúdo só quando abre, não a cada alternância', () => {
    let montagens = 0
    const montar = () => {
      montagens += 1
      return conteudo('x')
    }

    alternarGaveta(shadow, botaoA, montar)
    alternarGaveta(shadow, botaoA, montar)

    expect(montagens).toBe(1)
  })
})
