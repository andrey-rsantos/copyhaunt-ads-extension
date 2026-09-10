import { describe, expect, it } from 'vitest'
import { avaliar, CRITERIOS_PADRAO, type Criterios } from '../src/core/criteria'
import type { Ad } from '../src/core/types'

const AGORA = new Date('2026-09-06T12:00:00Z')

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '1',
    iniciouEm: new Date('2026-08-01T12:00:00Z'), // 36 dias
    colacao: 5,
    anunciante: { pageId: 'p1', pageName: 'A' },
    midias: [],
    plataformas: [],
    ativo: true,
    ...extra,
  }
}

function ctx(presenca = 10, colacao = 5) {
  return { presenca, colacao, agora: AGORA }
}

describe('CRITERIOS_PADRAO', () => {
  it('usa os padrões do spec', () => {
    expect(CRITERIOS_PADRAO).toEqual({
      colacaoMinima: 5,
      diasMin: 7,
      diasMax: 90,
      presencaMinima: 10,
    })
  })
})

describe('avaliar', () => {
  it('aprova quando tudo bate', () => {
    expect(avaliar(ad(), CRITERIOS_PADRAO, ctx()).passa).toBe(true)
  })

  it('reprova por colação baixa e diz o motivo', () => {
    const r = avaliar(ad(), CRITERIOS_PADRAO, ctx(10, 2))
    expect(r.passa).toBe(false)
    expect(r.motivos.join(' ')).toContain('colação')
  })

  it('reprova anúncio novo demais', () => {
    const novo = ad({ iniciouEm: new Date('2026-09-04T12:00:00Z') }) // 2 dias
    const r = avaliar(novo, CRITERIOS_PADRAO, ctx())
    expect(r.passa).toBe(false)
    expect(r.motivos.join(' ')).toContain('dias')
  })

  it('reprova anúncio velho demais', () => {
    const velho = ad({ iniciouEm: new Date('2025-01-01T12:00:00Z') })
    expect(avaliar(velho, CRITERIOS_PADRAO, ctx()).passa).toBe(false)
  })

  it('reprova por presença baixa do anunciante', () => {
    const r = avaliar(ad(), CRITERIOS_PADRAO, ctx(3))
    expect(r.passa).toBe(false)
    expect(r.motivos.join(' ')).toContain('presença')
  })

  it('acumula todos os motivos, não só o primeiro', () => {
    const ruim = ad({ colacao: 1, iniciouEm: new Date('2026-09-05T12:00:00Z') })
    const r = avaliar(ruim, CRITERIOS_PADRAO, ctx(1, 1))
    expect(r.motivos.length).toBe(3)
  })

  it('critério nulo é critério desligado', () => {
    const so: Criterios = {
      colacaoMinima: null,
      diasMin: null,
      diasMax: null,
      presencaMinima: null,
    }
    expect(avaliar(ad({ colacao: 1 }), so, ctx(0)).passa).toBe(true)
  })

  it('desligar um critério não afeta os outros', () => {
    const c: Criterios = { ...CRITERIOS_PADRAO, colacaoMinima: null }
    expect(avaliar(ad({ colacao: 1 }), c, ctx()).passa).toBe(true)
    expect(avaliar(ad({ colacao: 1 }), c, ctx(2)).passa).toBe(false)
  })

  it('aceita exatamente no limite', () => {
    // O corte é inclusivo: >= 5 deixa passar o 5.
    expect(avaliar(ad({ colacao: 5 }), CRITERIOS_PADRAO, ctx(10)).passa).toBe(
      true,
    )
  })

  it('a colação padrão de 5 reprova a maioria, como medido', () => {
    // 94 anúncios reais: só 18% têm colação >= 5.
    const passam = [1, 1, 2, 3, 5, 1, 2, 14, 1, 1].filter(
      (n) => avaliar(ad(), CRITERIOS_PADRAO, ctx(10, n)).passa,
    )
    expect(passam).toEqual([5, 14])
  })
})
