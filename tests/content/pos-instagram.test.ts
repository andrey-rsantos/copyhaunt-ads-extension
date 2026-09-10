import { describe, expect, it, vi } from 'vitest'
import { filtrarPorInstagram } from '../../src/content/pos-instagram'
import type { Ad } from '../../src/core/types'

function ad(id: string, pageId: string): Ad {
  return {
    id,
    iniciouEm: new Date('2026-09-01T00:00:00Z'),
    colacao: 5,
    anunciante: { pageId, pageName: `pagina ${pageId}` },
    midias: [],
    plataformas: ['Facebook'],
    ativo: true,
  }
}

/** Espera instantânea: o teste mede a ordem das chamadas, não o relógio. */
const semEspera = () => Promise.resolve()

describe('filtrarPorInstagram', () => {
  it('mantém quem tem Instagram e descarta quem não tem', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p2')]
    const consultar = vi.fn(async (pageId: string) =>
      pageId === 'p1' ? 'https://instagram.com/um' : null,
    )

    const r = await filtrarPorInstagram(aprovados, {
      consultar,
      esperar: semEspera,
    })

    expect(r.map((a) => a.id)).toEqual(['1'])
  })

  it('consulta uma vez por anunciante, não uma por anúncio', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p1'), ad('3', 'p1')]
    const consultar = vi.fn(async () => 'https://instagram.com/um')

    await filtrarPorInstagram(aprovados, { consultar, esperar: semEspera })

    expect(consultar).toHaveBeenCalledTimes(1)
  })

  it('mantém todos os anúncios do anunciante que tem Instagram', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p1')]
    const consultar = vi.fn(async () => 'https://instagram.com/um')

    const r = await filtrarPorInstagram(aprovados, {
      consultar,
      esperar: semEspera,
    })

    expect(r).toHaveLength(2)
  })

  it('espaça as consultas, uma espera entre cada par', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p2'), ad('3', 'p3')]
    const esperas: number[] = []

    await filtrarPorInstagram(aprovados, {
      consultar: async () => null,
      esperar: async (ms) => {
        esperas.push(ms)
      },
      espacoMs: 2000,
    })

    // Três anunciantes, duas esperas: não se espera antes da primeira nem
    // depois da última.
    expect(esperas).toEqual([2000, 2000])
  })

  it('não espera quando há um anunciante só', async () => {
    const esperar = vi.fn(async () => {})

    await filtrarPorInstagram([ad('1', 'p1')], {
      consultar: async () => 'x',
      esperar,
    })

    expect(esperar).not.toHaveBeenCalled()
  })

  it('consulta que falha mantém o anúncio, em vez de descartar', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p2')]
    const consultar = vi.fn(async (pageId: string) => {
      if (pageId === 'p1') throw new Error('rede caiu')
      return 'https://instagram.com/dois'
    })

    const r = await filtrarPorInstagram(aprovados, {
      consultar,
      esperar: semEspera,
    })

    expect(r.map((a) => a.id)).toEqual(['1', '2'])
  })

  it('avisa o progresso a cada anunciante consultado', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p2')]
    const aoProgredir = vi.fn()

    await filtrarPorInstagram(aprovados, {
      consultar: async () => null,
      esperar: semEspera,
      aoProgredir,
    })

    expect(aoProgredir).toHaveBeenNthCalledWith(1, 1, 2)
    expect(aoProgredir).toHaveBeenNthCalledWith(2, 2, 2)
  })

  it('lista vazia não consulta nada', async () => {
    const consultar = vi.fn(async () => null)
    const r = await filtrarPorInstagram([], { consultar, esperar: semEspera })

    expect(r).toEqual([])
    expect(consultar).not.toHaveBeenCalled()
  })

  it('preserva a ordem original dos aprovados', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p2'), ad('3', 'p1')]

    const r = await filtrarPorInstagram(aprovados, {
      consultar: async () => 'x',
      esperar: semEspera,
    })

    expect(r.map((a) => a.id)).toEqual(['1', '2', '3'])
  })
})
