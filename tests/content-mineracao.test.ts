/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMinerador, iniciarMineracao } from '../src/content/index'
import { CRITERIOS_PADRAO } from '../src/core/criteria'
import { Minerador } from '../src/core/miner'
import { AdStore } from '../src/core/store'

vi.mock('../src/core/miner', async (importar) => {
  const real = await importar<typeof import('../src/core/miner')>()
  return { ...real, Minerador: vi.fn(class extends real.Minerador {}) }
})

vi.hoisted(() => {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      getURL: vi.fn((caminho: string) => `chrome-extension://teste/${caminho}`),
    },
    tabs: { create: vi.fn() },
  })
})

class WorkerDeTeste {
  onmessage: ((evento: MessageEvent<{ id: number }>) => void) | null = null
  postMessage(): void {}
}

describe('criarMinerador', () => {
  const RITMO = { pisoMs: 2500, timeoutMs: 4500, jitter: 0.4 }

  beforeEach(() => {
    vi.stubGlobal('Worker', WorkerDeTeste)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('monta um minerador parado, sem rolar nada', () => {
    const scrollBy = vi.fn()
    vi.stubGlobal('scrollBy', scrollBy)

    const m = criarMinerador(new AdStore(), CRITERIOS_PADRAO, 100, RITMO)

    expect(m.progresso()).toEqual({
      estado: 'parado',
      analisados: 0,
      encontrados: 0,
      rolagens: 0,
    })
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('mantém o início na aba atual, sem coordenador externo', () => {
    const criarAba = vi.fn()
    const enviar = vi.fn()
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: enviar },
      tabs: { create: criarAba },
    })

    criarAba.mockClear()
    enviar.mockClear()
    criarMinerador(new AdStore(), CRITERIOS_PADRAO, 100, RITMO)

    expect(criarAba).not.toHaveBeenCalled()
    expect(enviar).not.toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'iniciar-mineracao' }),
    )
  })

  it('repassa o teto de aprovados ao motor', () => {
    expect(() => criarMinerador(
      new AdStore(),
      CRITERIOS_PADRAO,
      101,
      RITMO,
    )).toThrow(RangeError)
  })

  it('a primeira sessão também avalia IDs que já estão no store', () => {
    const store = new AdStore()
    store.adicionar([{
      id: 'antigo',
      iniciouEm: new Date('2026-08-01T12:00:00Z'),
      colacao: 1,
      anunciante: { pageId: 'p1', pageName: 'A' },
      midias: [],
      plataformas: [],
      ativo: true,
    }])
    vi.mocked(Minerador).mockClear()

    const m = iniciarMineracao(
      { criterios: CRITERIOS_PADRAO, limiteEncontrados: 10 },
      store,
    )

    expect(m.progresso().estado).toBe('parado')
    expect(vi.mocked(Minerador)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Minerador).mock.calls[0][0].idsAvaliadosInicialmente).toEqual([])
  })
})
