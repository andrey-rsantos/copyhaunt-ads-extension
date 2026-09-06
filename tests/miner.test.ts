import { describe, expect, it, vi } from 'vitest'
import { relogioDeTeste } from '../src/core/clock'
import { CRITERIOS_PADRAO, type Criterios } from '../src/core/criteria'
import { Minerador } from '../src/core/miner'
import { AdStore } from '../src/core/store'
import type { Ad } from '../src/core/types'

const AGORA = new Date('2026-09-06T12:00:00Z')

function ad(id: string, colacao: number, pageId = 'p1'): Ad {
  return {
    id,
    iniciouEm: new Date('2026-08-01T12:00:00Z'), // 36 dias
    colacao,
    anunciante: { pageId, pageName: 'A' },
    midias: [],
    plataformas: [],
    ativo: true,
  }
}

/** Sem presença mínima, para os testes isolarem a colação. */
const CRIT: Criterios = { ...CRITERIOS_PADRAO, presencaMinima: null }

function montar(opts: Partial<Record<string, unknown>> = {}) {
  const store = new AdStore()
  const relogio = relogioDeTeste(AGORA)
  const rolar = vi.fn()
  const minerador = new Minerador({
    store,
    criterios: CRIT,
    relogio,
    rolar,
    intervaloMs: 1000,
    maxRolagens: 3,
    limiteEncontrados: 100,
    ...opts,
  })
  return { store, relogio, rolar, minerador }
}

describe('Minerador', () => {
  it('começa parado', () => {
    expect(montar().minerador.progresso().estado).toBe('parado')
  })

  it('rola a página a cada ciclo', async () => {
    const { relogio, rolar, minerador } = montar()
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await relogio.avancar(1000)
    await relogio.avancar(1000)
    await p
    expect(rolar).toHaveBeenCalledTimes(3)
  })

  it('conclui ao atingir o máximo de rolagens', async () => {
    const { relogio, minerador } = montar({ maxRolagens: 2 })
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await relogio.avancar(1000)
    await p
    expect(minerador.progresso().estado).toBe('concluido')
    expect(minerador.progresso().rolagens).toBe(2)
  })

  it('conta analisados e encontrados conforme os critérios', async () => {
    const { store, relogio, minerador } = montar({ maxRolagens: 1 })
    store.adicionar([ad('1', 5), ad('2', 1), ad('3', 9)])
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await p
    const g = minerador.progresso()
    expect(g.analisados).toBe(3)
    expect(g.encontrados).toBe(2)
  })

  it('encontrados devolve os anúncios aprovados', async () => {
    const { store, relogio, minerador } = montar({ maxRolagens: 1 })
    store.adicionar([ad('1', 5), ad('2', 1)])
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await p
    expect(minerador.encontrados().map((a) => a.id)).toEqual(['1'])
  })

  it('parar interrompe antes do máximo', async () => {
    const { relogio, rolar, minerador } = montar({ maxRolagens: 10 })
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    minerador.parar()
    await relogio.avancar(1000)
    await p
    expect(minerador.progresso().estado).toBe('pausado')
    expect(rolar).toHaveBeenCalledTimes(1)
  })

  it('conclui ao atingir o limite de encontrados', async () => {
    const { store, relogio, minerador } = montar({
      maxRolagens: 10,
      limiteEncontrados: 2,
    })
    store.adicionar([ad('1', 5), ad('2', 6), ad('3', 7)])
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await p
    expect(minerador.progresso().estado).toBe('concluido')
  })

  it('avisa o progresso a cada ciclo', async () => {
    const aoProgredir = vi.fn()
    const { relogio, minerador } = montar({ maxRolagens: 2, aoProgredir })
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await relogio.avancar(1000)
    await p
    expect(aoProgredir).toHaveBeenCalledTimes(2)
    expect(aoProgredir.mock.calls[0][0].estado).toBe('minerando')
  })

  it('não conta o mesmo anúncio duas vezes entre ciclos', async () => {
    const { store, relogio, minerador } = montar({ maxRolagens: 2 })
    store.adicionar([ad('1', 5)])
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    store.adicionar([ad('1', 5), ad('2', 5)])
    await relogio.avancar(1000)
    await p
    expect(minerador.progresso().analisados).toBe(2)
  })

  it('iniciar duas vezes não roda dois laços', async () => {
    const { relogio, rolar, minerador } = montar({ maxRolagens: 2 })
    const a = minerador.iniciar()
    const b = minerador.iniciar()
    await relogio.avancar(1000)
    await relogio.avancar(1000)
    await Promise.all([a, b])
    expect(rolar).toHaveBeenCalledTimes(2)
  })

  it('a presença do anunciante entra na avaliação', async () => {
    const { store, relogio, minerador } = montar({
      maxRolagens: 1,
      criterios: { ...CRITERIOS_PADRAO, presencaMinima: 2 },
    })
    // Dois anúncios do mesmo anunciante: presença 2, passa.
    store.adicionar([ad('1', 5, 'px'), ad('2', 5, 'px'), ad('3', 5, 'py')])
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await p
    expect(minerador.encontrados().map((a) => a.id)).toEqual(['1', '2'])
  })
})
