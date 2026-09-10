import { describe, expect, it } from 'vitest'
import {
  lerFaixaDaUrl,
  montarUrlFiltro,
  PRESETS,
  rotuloDaFaixa,
} from '../src/core/dateFilter'

const AGORA = new Date('2026-09-10T12:00:00Z')
const BASE = 'https://www.facebook.com/ads/library/?q=teste'

describe('PRESETS', () => {
  it('traz os intervalos do spec', () => {
    expect(PRESETS).toEqual([3, 5, 14, 30, 60])
  })
})

describe('montarUrlFiltro', () => {
  it('mínimo de dias limita a data máxima de início', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: 7, diasMax: null }, AGORA))
    expect(url.searchParams.get('start_date[max]')).toBe('2026-09-03')
    expect(url.searchParams.get('start_date[min]')).toBeNull()
  })

  it('máximo de dias limita a data mínima de início', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: null, diasMax: 7 }, AGORA))
    expect(url.searchParams.get('start_date[min]')).toBe('2026-09-03')
    expect(url.searchParams.get('start_date[max]')).toBeNull()
  })

  it('os dois juntos formam uma faixa', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: 7, diasMax: 30 }, AGORA))
    expect(url.searchParams.get('start_date[max]')).toBe('2026-09-03')
    expect(url.searchParams.get('start_date[min]')).toBe('2026-08-11')
  })

  it('sem faixa nenhuma, limpa os dois cortes', () => {
    const comFiltro = 'https://www.facebook.com/ads/library/?q=t&start_date[max]=2020-01-01'
    const url = new URL(montarUrlFiltro(comFiltro, { diasMin: null, diasMax: null }, AGORA))
    expect(url.searchParams.get('start_date[max]')).toBeNull()
    expect(url.searchParams.get('start_date[min]')).toBeNull()
  })

  it('substitui filtro anterior em vez de acumular', () => {
    const comFiltro = 'https://www.facebook.com/ads/library/?q=t&start_date[min]=2020-01-01'
    const url = new URL(montarUrlFiltro(comFiltro, { diasMin: 7, diasMax: null }, AGORA))
    expect(url.searchParams.get('start_date[min]')).toBeNull()
    expect(url.searchParams.get('start_date[max]')).toBe('2026-09-03')
  })

  it('preserva os outros parâmetros da busca', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: 7, diasMax: null }, AGORA))
    expect(url.searchParams.get('q')).toBe('teste')
  })

  it('atravessa virada de mês', () => {
    const url = new URL(
      montarUrlFiltro(BASE, { diasMin: 14, diasMax: null }, new Date('2026-03-05T12:00:00Z')),
    )
    expect(url.searchParams.get('start_date[max]')).toBe('2026-02-19')
  })

  it('atravessa 29 de fevereiro em ano bissexto', () => {
    const url = new URL(
      montarUrlFiltro(BASE, { diasMin: 3, diasMax: null }, new Date('2024-03-01T12:00:00Z')),
    )
    expect(url.searchParams.get('start_date[max]')).toBe('2024-02-27')
  })

  it('força a ordenação por impressões totais', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: 7, diasMax: null }, AGORA))
    expect(url.searchParams.get('sort_data[mode]')).toBe('total_impressions')
    expect(url.searchParams.get('sort_data[direction]')).toBe('desc')
  })
})

describe('rotuloDaFaixa', () => {
  it('só mínimo vira "7+ dias no ar"', () => {
    expect(rotuloDaFaixa({ diasMin: 7, diasMax: null })).toBe('7+ dias no ar')
  })

  it('faixa fechada vira "7–30 dias no ar", com travessão', () => {
    expect(rotuloDaFaixa({ diasMin: 7, diasMax: 30 })).toBe(
      '7–30 dias no ar',
    )
  })

  it('só máximo vira "até 30 dias no ar"', () => {
    expect(rotuloDaFaixa({ diasMin: null, diasMax: 30 })).toBe(
      'até 30 dias no ar',
    )
  })

  it('faixa vazia vira "Tempo ativo"', () => {
    expect(rotuloDaFaixa({ diasMin: null, diasMax: null })).toBe('Tempo ativo')
  })
})

describe('lerFaixaDaUrl', () => {
  const agora = new Date('2026-09-10T12:00:00Z')

  it('lê de volta o que montarUrlFiltro escreveu', () => {
    const url = montarUrlFiltro(
      'https://www.facebook.com/ads/library/?q=x',
      { diasMin: 7, diasMax: 30 },
      agora,
    )
    expect(lerFaixaDaUrl(url, agora)).toEqual({ diasMin: 7, diasMax: 30 })
  })

  it('lê a faixa aberta de um lado só', () => {
    const url = montarUrlFiltro(
      'https://www.facebook.com/ads/library/?q=x',
      { diasMin: 14, diasMax: null },
      agora,
    )
    expect(lerFaixaDaUrl(url, agora)).toEqual({ diasMin: 14, diasMax: null })
  })

  it('URL sem filtro devolve faixa vazia', () => {
    expect(
      lerFaixaDaUrl('https://www.facebook.com/ads/library/?q=x', agora),
    ).toEqual({ diasMin: null, diasMax: null })
  })

  it('data ilegível vira null em vez de NaN', () => {
    expect(
      lerFaixaDaUrl(
        'https://www.facebook.com/ads/library/?start_date[max]=ontem',
        agora,
      ),
    ).toEqual({ diasMin: null, diasMax: null })
  })
})
