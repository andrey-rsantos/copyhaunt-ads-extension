// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { montarCalendario } from '../../src/content/gaveta-calendario'

const VAZIA = { diasMin: null, diasMax: null }

describe('montarCalendario', () => {
  it('oferece os cinco atalhos da seção 7.2', () => {
    const el = montarCalendario(document, VAZIA, () => {})
    const atalhos = [...el.querySelectorAll('[data-preset]')].map(
      (a) => a.textContent,
    )
    expect(atalhos).toEqual(['3+', '5+', '14+', '30+', '60+'])
  })

  it('parte dos valores recebidos', () => {
    const el = montarCalendario(document, { diasMin: 7, diasMax: 30 }, () => {})
    const min = el.querySelector<HTMLInputElement>('[data-campo="diasMin"]')
    const max = el.querySelector<HTMLInputElement>('[data-campo="diasMax"]')

    expect(min?.value).toBe('7')
    expect(max?.value).toBe('30')
  })

  it('um atalho move o mínimo e não mexe no máximo', () => {
    const el = montarCalendario(document, { diasMin: 3, diasMax: 30 }, () => {})
    el.querySelector<HTMLElement>('[data-preset="14"]')?.click()

    const min = el.querySelector<HTMLInputElement>('[data-campo="diasMin"]')
    const max = el.querySelector<HTMLInputElement>('[data-campo="diasMax"]')

    expect(min?.value).toBe('14')
    expect(max?.value).toBe('30')
  })

  it('aplicar entrega a faixa digitada', () => {
    const espiao = vi.fn()
    const el = montarCalendario(document, VAZIA, espiao)

    const min = el.querySelector<HTMLInputElement>('[data-campo="diasMin"]')
    if (min) min.value = '5'

    el.querySelector<HTMLElement>('[data-acao="aplicar"]')?.click()

    expect(espiao).toHaveBeenCalledWith({ diasMin: 5, diasMax: null })
  })

  it('campo vazio vira null, não zero', () => {
    const espiao = vi.fn()
    const el = montarCalendario(document, { diasMin: 7, diasMax: 30 }, espiao)

    const max = el.querySelector<HTMLInputElement>('[data-campo="diasMax"]')
    if (max) max.value = ''

    el.querySelector<HTMLElement>('[data-acao="aplicar"]')?.click()

    expect(espiao).toHaveBeenCalledWith({ diasMin: 7, diasMax: null })
  })

  it('faixa invertida não aplica e avisa na própria gaveta', () => {
    const espiao = vi.fn()
    const el = montarCalendario(document, VAZIA, espiao)

    const min = el.querySelector<HTMLInputElement>('[data-campo="diasMin"]')
    const max = el.querySelector<HTMLInputElement>('[data-campo="diasMax"]')
    if (min) min.value = '30'
    if (max) max.value = '7'

    el.querySelector<HTMLElement>('[data-acao="aplicar"]')?.click()

    expect(espiao).not.toHaveBeenCalled()
    expect(el.textContent).toContain('mínimo não pode ser maior')
  })
})
