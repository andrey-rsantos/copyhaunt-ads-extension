import { describe, expect, it } from 'vitest'
import { precisaOrdenar, urlOrdenada } from '../../src/core/ordenacao'

const BASE = 'https://www.facebook.com/ads/library/?q=x&country=BR'
const ORDENADA =
  `${BASE}&sort_data[mode]=total_impressions&sort_data[direction]=desc`

describe('precisaOrdenar', () => {
  it('URL sem ordenação precisa', () => {
    expect(precisaOrdenar(BASE)).toBe(true)
  })

  it('URL já ordenada não precisa', () => {
    expect(precisaOrdenar(ORDENADA)).toBe(false)
  })

  it('ordenação por outro modo precisa ser corrigida', () => {
    expect(
      precisaOrdenar(`${BASE}&sort_data[mode]=recency&sort_data[direction]=desc`),
    ).toBe(true)
  })

  it('modo certo com direção errada precisa', () => {
    expect(
      precisaOrdenar(
        `${BASE}&sort_data[mode]=total_impressions&sort_data[direction]=asc`,
      ),
    ).toBe(true)
  })
})

describe('urlOrdenada', () => {
  it('acrescenta os dois parâmetros', () => {
    const p = new URL(urlOrdenada(BASE)).searchParams
    expect(p.get('sort_data[mode]')).toBe('total_impressions')
    expect(p.get('sort_data[direction]')).toBe('desc')
  })

  it('preserva os demais parâmetros', () => {
    const p = new URL(urlOrdenada(BASE)).searchParams
    expect(p.get('q')).toBe('x')
    expect(p.get('country')).toBe('BR')
  })

  it('é idempotente: aplicar de novo não precisa de nova recarga', () => {
    expect(precisaOrdenar(urlOrdenada(BASE))).toBe(false)
  })
})
