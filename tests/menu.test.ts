// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { abrirMenu, fecharMenu, type ItemMenu } from '../src/content/menu'

const ITENS: ItemMenu[] = [
  { chave: 'a', rotulo: 'Com dado', valor: 'valor-a' },
  { chave: 'b', rotulo: 'Sem dado', valor: null },
]

function raiz(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function item(r: ParentNode, chave: string): HTMLElement {
  const el = r.querySelector<HTMLElement>(`.item[data-chave="${chave}"]`)
  if (!el) throw new Error(`item ${chave} não encontrado`)
  return el
}

describe('abrirMenu', () => {
  it('desenha um item por entrada, na ordem recebida', () => {
    const r = raiz()
    abrirMenu(r, ITENS, () => {})
    const rotulos = [...r.querySelectorAll('.item')].map((e) => e.textContent)
    expect(rotulos).toEqual(['Com dado', 'Sem dado'])
  })

  it('escolher um item avisa e fecha o menu', () => {
    const r = raiz()
    const aoEscolher = vi.fn()
    abrirMenu(r, ITENS, aoEscolher)
    item(r, 'a').click()
    expect(aoEscolher).toHaveBeenCalledWith(ITENS[0])
    expect(r.querySelector('.menu')).toBeNull()
  })

  it('item sem dado não dispara nada e não fecha o menu', () => {
    const r = raiz()
    const aoEscolher = vi.fn()
    abrirMenu(r, ITENS, aoEscolher)
    item(r, 'b').click()
    expect(aoEscolher).not.toHaveBeenCalled()
    expect(r.querySelector('.menu')).not.toBeNull()
  })

  it('item sem dado explica o motivo no tooltip', () => {
    const r = raiz()
    abrirMenu(r, ITENS, () => {})
    expect(item(r, 'b').title.length).toBeGreaterThan(0)
    expect(item(r, 'b').dataset.desabilitado).toBe('sim')
  })

  it('abrir duas vezes não empilha dois menus', () => {
    const r = raiz()
    abrirMenu(r, ITENS, () => {})
    abrirMenu(r, ITENS, () => {})
    expect(r.querySelectorAll('.menu')).toHaveLength(1)
  })
})

describe('fecharMenu', () => {
  it('remove o menu aberto', () => {
    const r = raiz()
    abrirMenu(r, ITENS, () => {})
    fecharMenu(r)
    expect(r.querySelector('.menu')).toBeNull()
  })

  it('não estoura quando não há menu', () => {
    expect(() => fecharMenu(raiz())).not.toThrow()
  })
})
