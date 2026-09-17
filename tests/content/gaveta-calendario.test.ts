// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { montarCalendario } from '../../src/content/gaveta-calendario'

const VAZIA = { diasMin: null, diasMax: null }

describe('montarCalendario', () => {
  it('oferece os cinco presets e a opção de limpar', () => {
    const el = montarCalendario(document, VAZIA, () => {})
    const atalhos = [...el.querySelectorAll('[data-preset]')].map(
      (a) => a.textContent,
    )
    expect(atalhos).toEqual(['Sem filtro', '3+ Dias', '5+ Dias', '14+ Dias', '30+ Dias', '60+ Dias'])
  })

  it('marca o preset em vigor', () => {
    const el = montarCalendario(document, { diasMin: 14, diasMax: null }, () => {})

    expect(el.querySelector('[data-preset="14"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(el.querySelector('[data-preset="5"]')?.getAttribute('aria-pressed')).toBe('false')
    expect(el.querySelector<HTMLElement>('[data-preset="14"]')?.style.outline).toBe(
      '2px solid #7C3AED',
    )
    expect(el.querySelector<HTMLElement>('[data-preset="5"]')?.style.outline).toBe('none')
  })

  it('não mostra campos numéricos de mínimo ou máximo', () => {
    const el = montarCalendario(document, VAZIA, () => {})

    expect(el.querySelector('[data-campo="diasMin"]')).toBeNull()
    expect(el.querySelector('[data-campo="diasMax"]')).toBeNull()
  })

  it('aplicar entrega o preset selecionado como mínimo sem máximo', () => {
    const espiao = vi.fn()
    const el = montarCalendario(document, VAZIA, espiao)

    el.querySelector<HTMLElement>('[data-preset="14"]')?.click()
    expect(el.querySelector<HTMLElement>('[data-preset="14"]')?.style.outline).toBe(
      '2px solid #7C3AED',
    )
    el.querySelector<HTMLElement>('[data-acao="aplicar"]')?.click()

    expect(espiao).toHaveBeenCalledWith({ diasMin: 14, diasMax: null })
  })

  it('sem filtro entrega faixa vazia', () => {
    const espiao = vi.fn()
    const el = montarCalendario(document, { diasMin: 14, diasMax: null }, espiao)

    el.querySelector<HTMLElement>('[data-preset="none"]')?.click()
    el.querySelector<HTMLElement>('[data-acao="aplicar"]')?.click()

    expect(espiao).toHaveBeenCalledWith({ diasMin: null, diasMax: null })
  })
})
