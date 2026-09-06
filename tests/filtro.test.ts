import { describe, expect, it } from 'vitest'
import { DIAS_MAX, lerComandoFiltro, urlDoComando } from '../src/core/filtro'

const BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&q=emagrecer'

describe('lerComandoFiltro', () => {
  it.each([
    ['provadas', 7],
    ['subindo', 3],
    ['provadas', DIAS_MAX],
  ])('aceita o comando bem formado %s/%i', (modo, dias) => {
    expect(lerComandoFiltro({ modo, dias })).toEqual({ modo, dias })
  })

  it.each([
    ['modo desconhecido', { modo: 'escaladas', dias: 7 }],
    ['modo ausente', { dias: 7 }],
    ['dias zero', { modo: 'provadas', dias: 0 }],
    ['dias negativo', { modo: 'provadas', dias: -7 }],
    ['dias fracionário', { modo: 'provadas', dias: 7.5 }],
    ['dias acima do teto', { modo: 'provadas', dias: DIAS_MAX + 1 }],
    ['dias como texto', { modo: 'provadas', dias: '7' }],
    ['dias NaN', { modo: 'provadas', dias: Number.NaN }],
    ['objeto vazio', {}],
    ['nulo', null],
    ['texto solto', 'provadas 7'],
    ['array', ['provadas', 7]],
  ])('recusa %s', (_caso, valor) => {
    // O main world é território compartilhado: qualquer script da página posta
    // mensagem ali. Nada entra sem passar por aqui.
    expect(lerComandoFiltro(valor)).toBeNull()
  })

  it('ignora campos a mais em vez de recusar o comando', () => {
    // Campo extra é sinal de versão diferente, não de ataque. O que
    // interessa é que os dois campos conhecidos estejam certos.
    expect(lerComandoFiltro({ modo: 'subindo', dias: 5, extra: 'x' })).toEqual({
      modo: 'subindo',
      dias: 5,
    })
  })
})

describe('urlDoComando', () => {
  const agora = new Date('2026-09-06T12:00:00Z')

  it('corta pelo máximo no modo provadas', () => {
    const url = new URL(urlDoComando({ modo: 'provadas', dias: 7 }, BUSCA, agora))
    expect(url.searchParams.get('start_date[max]')).toBe('2026-08-30')
    expect(url.searchParams.get('start_date[min]')).toBeNull()
  })

  it('corta pelo mínimo no modo subindo', () => {
    const url = new URL(urlDoComando({ modo: 'subindo', dias: 3 }, BUSCA, agora))
    expect(url.searchParams.get('start_date[min]')).toBe('2026-09-03')
    expect(url.searchParams.get('start_date[max]')).toBeNull()
  })

  it('preserva a busca do usuário', () => {
    const url = new URL(urlDoComando({ modo: 'provadas', dias: 7 }, BUSCA, agora))
    expect(url.searchParams.get('q')).toBe('emagrecer')
    expect(url.searchParams.get('active_status')).toBe('active')
  })

  it('troca o filtro anterior em vez de acumular', () => {
    // Sem isto, provadas depois de subindo viraria a interseção dos dois
    // cortes, e a grade voltaria vazia sem explicação.
    const antes = urlDoComando({ modo: 'subindo', dias: 3 }, BUSCA, agora)
    const url = new URL(urlDoComando({ modo: 'provadas', dias: 7 }, antes, agora))
    expect(url.searchParams.get('start_date[min]')).toBeNull()
    expect(url.searchParams.get('start_date[max]')).toBe('2026-08-30')
  })
})
