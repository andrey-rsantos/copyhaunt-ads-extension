// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  EXEMPLOS,
  escreverNaBusca,
  montarExemplos,
} from '../../src/content/gaveta-exemplos'

describe('EXEMPLOS', () => {
  it('traz os cinco exemplos da seção 7.5 do spec', () => {
    expect(EXEMPLOS.length).toBe(5)
    expect(EXEMPLOS.map((e) => e.termo)).toEqual([
      'receitas',
      'receitas api.whatsapp.com',
      '"receita de bolo"',
      'hotmart.com',
      'emagrecimento kiwify.com',
    ])
  })

  it('nenhum exemplo usa operador, que a medição mostrou zerar a busca', () => {
    for (const e of EXEMPLOS) {
      expect(e.termo).not.toMatch(/\b(and|or)\b/i)
    }
  })
})

describe('montarExemplos', () => {
  it('lista um item por exemplo, com termo e explicação', () => {
    const el = montarExemplos(document, () => {})
    const itens = el.querySelectorAll('[data-termo]')

    expect(itens.length).toBe(5)
    expect(el.textContent).toContain('anúncios sobre receitas')
  })

  it('clicar num item devolve o termo daquele item', () => {
    const espiao = vi.fn()
    const el = montarExemplos(document, espiao)

    el.querySelector<HTMLElement>('[data-termo="hotmart.com"]')?.click()

    expect(espiao).toHaveBeenCalledWith('hotmart.com')
  })
})

describe('escreverNaBusca', () => {
  it('escreve o termo no campo da Meta e devolve true', () => {
    document.body.innerHTML = '<input type="search">'
    const campo = document.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )

    expect(escreverNaBusca(document, 'hotmart.com')).toBe(true)
    expect(campo?.value).toBe('hotmart.com')
  })

  it('dispara o evento input, sem o qual o React da Meta ignora', () => {
    document.body.innerHTML = '<input type="search">'
    const campo = document.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )
    const espiao = vi.fn()
    campo?.addEventListener('input', espiao)

    escreverNaBusca(document, 'x')

    expect(espiao).toHaveBeenCalledTimes(1)
  })

  it('devolve false sem campo de busca, em vez de lançar', () => {
    document.body.innerHTML = ''
    expect(escreverNaBusca(document, 'x')).toBe(false)
  })
})
