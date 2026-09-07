// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  abrirMenu,
  atualizarItem,
  fecharMenu,
  type ItemMenu,
} from '../src/content/menu'

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

describe('item que mantém o menu aberto', () => {
  it('não fecha o menu quando o item pede para ficar', () => {
    const raiz = document.createElement('div')
    abrirMenu(raiz, [{ chave: 'ig', rotulo: 'Instagram', valor: 'x', mantemAberto: true }], () => {})
    ;(raiz.querySelector('[data-chave="ig"]') as HTMLElement).click()
    expect(raiz.querySelector('.menu')).not.toBeNull()
  })

  it('fecha normalmente quando o item não pede nada', () => {
    const raiz = document.createElement('div')
    abrirMenu(raiz, [{ chave: 'site', rotulo: 'Site', valor: 'x' }], () => {})
    ;(raiz.querySelector('[data-chave="site"]') as HTMLElement).click()
    expect(raiz.querySelector('.menu')).toBeNull()
  })
})

describe('atualizarItem', () => {
  it('troca o rótulo e marca o item como buscando', () => {
    const raiz = document.createElement('div')
    abrirMenu(raiz, [{ chave: 'ig', rotulo: 'Instagram', valor: 'x' }], () => {})
    atualizarItem(raiz, 'ig', { rotulo: 'buscando…', estado: 'buscando' })

    const linha = raiz.querySelector('[data-chave="ig"]') as HTMLElement
    expect(linha.textContent).toBe('buscando…')
    expect(linha.dataset.estado).toBe('buscando')
  })

  it('deixa o item apagado e sem ação quando o estado é apagado', () => {
    const raiz = document.createElement('div')
    const escolhas: string[] = []
    abrirMenu(raiz, [{ chave: 'ig', rotulo: 'Instagram', valor: 'x' }], (i) => escolhas.push(i.chave))
    atualizarItem(raiz, 'ig', { rotulo: 'sem Instagram vinculado', estado: 'apagado' })
    ;(raiz.querySelector('[data-chave="ig"]') as HTMLElement).click()

    expect(raiz.querySelector('[data-chave="ig"]')!.getAttribute('data-desabilitado')).toBe('sim')
    expect(escolhas).toEqual([])
  })

  it('instala a ação nova, porque a troca descarta a antiga', () => {
    const raiz = document.createElement('div')
    const antiga = vi.fn()
    const nova = vi.fn()
    abrirMenu(raiz, [{ chave: 'ig', rotulo: 'Instagram', valor: 'x' }], antiga)
    atualizarItem(raiz, 'ig', { rotulo: 'Abrir @perfil', estado: 'achou', aoClicar: nova })
    ;(raiz.querySelector('[data-chave="ig"]') as HTMLElement).click()

    expect(nova).toHaveBeenCalledTimes(1)
    expect(antiga).not.toHaveBeenCalled()
  })

  it('não explode quando o menu já foi fechado', () => {
    const raiz = document.createElement('div')
    expect(() => atualizarItem(raiz, 'ig', { rotulo: 'x', estado: 'achou' })).not.toThrow()
  })
})
