import { describe, expect, it } from 'vitest'
import { montarUrlFiltro, PRESETS } from '../src/core/dateFilter'

const AGORA = new Date('2026-09-06T12:00:00Z')
const BASE =
  'https://www.facebook.com/ads/library/?active_status=active&q=receitas'

function params(u: string): URLSearchParams {
  return new URLSearchParams(new URL(u).search)
}

describe('PRESETS', () => {
  it('traz os intervalos do spec', () => {
    expect(PRESETS).toEqual([3, 5, 7, 14, 21, 28])
  })
})

describe('montarUrlFiltro', () => {
  it('modo provadas limita a data máxima de início', () => {
    // "ativo há pelo menos 7 dias" = começou em 30/08 ou antes.
    const p = params(montarUrlFiltro(BASE, 'provadas', 7, AGORA))
    expect(p.get('start_date[max]')).toBe('2026-08-30')
    expect(p.get('start_date[min]')).toBeNull()
  })

  it('modo subindo limita a data mínima de início', () => {
    const p = params(montarUrlFiltro(BASE, 'subindo', 7, AGORA))
    expect(p.get('start_date[min]')).toBe('2026-08-30')
    expect(p.get('start_date[max]')).toBeNull()
  })

  it('preserva os outros parâmetros da busca', () => {
    const p = params(montarUrlFiltro(BASE, 'provadas', 3, AGORA))
    expect(p.get('q')).toBe('receitas')
    expect(p.get('active_status')).toBe('active')
  })

  it('substitui filtro anterior em vez de acumular', () => {
    const comFiltro = `${BASE}&start_date[min]=2020-01-01`
    const p = params(montarUrlFiltro(comFiltro, 'provadas', 3, AGORA))
    expect(p.get('start_date[min]')).toBeNull()
    expect(p.get('start_date[max]')).toBe('2026-09-03')
  })

  it('atravessa virada de mês', () => {
    const p = params(
      montarUrlFiltro(BASE, 'provadas', 7, new Date('2026-03-03T00:00:00Z')),
    )
    expect(p.get('start_date[max]')).toBe('2026-02-24')
  })

  it('atravessa 29 de fevereiro em ano bissexto', () => {
    const p = params(
      montarUrlFiltro(BASE, 'provadas', 2, new Date('2024-03-01T00:00:00Z')),
    )
    expect(p.get('start_date[max]')).toBe('2024-02-28')
  })

  it('força a ordenação por impressões totais', () => {
    // Sem isso os escalados só aparecem depois de muita rolagem.
    const p = params(montarUrlFiltro(BASE, 'provadas', 7, AGORA))
    expect(p.get('sort_data[mode]')).toBe('total_impressions')
    expect(p.get('sort_data[direction]')).toBe('desc')
  })

  it('a data sai em ISO, sem hora', () => {
    const p = params(montarUrlFiltro(BASE, 'subindo', 5, AGORA))
    expect(p.get('start_date[min]')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
