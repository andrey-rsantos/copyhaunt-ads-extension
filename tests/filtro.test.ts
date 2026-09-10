import { describe, expect, it } from 'vitest'
import { DIAS_MAX, lerComandoFiltro, urlDoComando } from '../src/core/filtro'

const BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&q=emagrecer'

describe('lerComandoFiltro', () => {
  it('aceita só o mínimo', () => {
    expect(lerComandoFiltro({ diasMin: 7, diasMax: null })).toEqual({ diasMin: 7, diasMax: null })
  })

  it('aceita só o máximo', () => {
    expect(lerComandoFiltro({ diasMin: null, diasMax: 7 })).toEqual({ diasMin: null, diasMax: 7 })
  })

  it('aceita a faixa', () => {
    expect(lerComandoFiltro({ diasMin: 7, diasMax: 30 })).toEqual({ diasMin: 7, diasMax: 30 })
  })

  it('recusa faixa invertida', () => {
    expect(lerComandoFiltro({ diasMin: 30, diasMax: 7 })).toBeNull()
  })

  it('recusa fora do intervalo permitido', () => {
    expect(lerComandoFiltro({ diasMin: 0, diasMax: null })).toBeNull()
    expect(lerComandoFiltro({ diasMin: DIAS_MAX + 1, diasMax: null })).toBeNull()
  })

  it('recusa não inteiro', () => {
    expect(lerComandoFiltro({ diasMin: 7.5, diasMax: null })).toBeNull()
  })

  it('recusa o que não é comando', () => {
    expect(lerComandoFiltro(null)).toBeNull()
    expect(lerComandoFiltro([])).toBeNull()
    expect(lerComandoFiltro({ modo: 'provadas', dias: 7 })).toBeNull()
  })
})

describe('urlDoComando', () => {
  const agora = new Date('2026-09-06T12:00:00Z')

  it('aplica o mínimo pela data máxima de início', () => {
    const url = new URL(urlDoComando({ diasMin: 7, diasMax: null }, BUSCA, agora))
    expect(url.searchParams.get('start_date[max]')).toBe('2026-08-30')
    expect(url.searchParams.get('start_date[min]')).toBeNull()
  })

  it('aplica o máximo pela data mínima de início', () => {
    const url = new URL(urlDoComando({ diasMin: null, diasMax: 3 }, BUSCA, agora))
    expect(url.searchParams.get('start_date[min]')).toBe('2026-09-03')
    expect(url.searchParams.get('start_date[max]')).toBeNull()
  })

  it('preserva a busca do usuário', () => {
    const url = new URL(urlDoComando({ diasMin: 7, diasMax: null }, BUSCA, agora))
    expect(url.searchParams.get('q')).toBe('emagrecer')
    expect(url.searchParams.get('active_status')).toBe('active')
  })

  it('troca o filtro anterior em vez de acumular', () => {
    const antes = urlDoComando({ diasMin: null, diasMax: 3 }, BUSCA, agora)
    const url = new URL(urlDoComando({ diasMin: 7, diasMax: null }, antes, agora))
    expect(url.searchParams.get('start_date[min]')).toBeNull()
    expect(url.searchParams.get('start_date[max]')).toBe('2026-08-30')
  })
})
